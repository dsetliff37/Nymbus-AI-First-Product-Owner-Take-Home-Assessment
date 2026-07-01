/**
 * intentService.ts
 *
 * Calls the LLM API to parse a natural-language spending query into a
 * structured ParsedIntent. Sends ONLY the query text and available category
 * names — never amounts, descriptions, or dates (Req 4.2, 9.1).
 */

import type { IntentResult, ParsedIntent, IntentType } from '../types';

const SUPPORTED_INTENT_TYPES: ReadonlySet<string> = new Set([
  'sum',
  'compare',
  'average',
  'count',
]);

const LLM_TIMEOUT_MS = 5_000;

/**
 * Returns today's date as YYYY-MM-DD in the user's local timezone.
 * Used to resolve relative timeframes (e.g., "last month") in the prompt
 * without leaking any transaction data (Req 4.9).
 */
function getLocalTodayDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Builds the system message for the LLM prompt.
 * Contains ONLY category names and today's date — no transaction data.
 */
function buildSystemMessage(availableCategories: string[], todayDate: string): string {
  const categoriesList = availableCategories.join(', ');
  return `You are a query parser for a personal finance app.
Return ONLY valid JSON with these fields:
- intent_type: one of "sum" | "compare" | "average" | "count"
- categories: array of 1-10 strings matching provided category names
- timeframe: { start: "YYYY-MM-DD", end: "YYYY-MM-DD" } resolved to today's date
If you cannot resolve a field, set it to null.
Available categories: ${categoriesList}
Today's date: ${todayDate} (user's local timezone)`;
}

/**
 * Validates the raw parsed JSON from the LLM response.
 * Returns a validated ParsedIntent or an IntentResult error.
 */
function validateLlmResponse(raw: unknown): IntentResult {
  if (typeof raw !== 'object' || raw === null) {
    return {
      ok: false,
      error: { type: 'missing_fields', missingFields: ['intent_type', 'categories', 'timeframe'] },
    };
  }

  const obj = raw as Record<string, unknown>;

  // Check for missing or wrong-type required fields
  const missingFields: string[] = [];

  const hasIntentType =
    'intent_type' in obj && (typeof obj.intent_type === 'string' || obj.intent_type === null);
  const hasCategories =
    'categories' in obj && (Array.isArray(obj.categories) || obj.categories === null);
  const hasTimeframe =
    'timeframe' in obj &&
    (typeof obj.timeframe === 'object' || obj.timeframe === null);

  if (!hasIntentType) missingFields.push('intent_type');
  if (!hasCategories) missingFields.push('categories');
  if (!hasTimeframe) missingFields.push('timeframe');

  if (missingFields.length > 0) {
    return { ok: false, error: { type: 'missing_fields', missingFields } };
  }

  // Check for unsupported intent_type (before null checks so we give the right error)
  if (
    typeof obj.intent_type === 'string' &&
    !SUPPORTED_INTENT_TYPES.has(obj.intent_type)
  ) {
    return {
      ok: false,
      error: { type: 'unsupported_intent_type', received: obj.intent_type },
    };
  }

  // Check for null / unresolvable fields
  const unresolvableFields: string[] = [];
  if (obj.intent_type === null) unresolvableFields.push('intent_type');
  if (obj.categories === null) unresolvableFields.push('categories');
  if (obj.timeframe === null) unresolvableFields.push('timeframe');

  if (unresolvableFields.length > 0) {
    return { ok: false, error: { type: 'unresolvable_fields', fields: unresolvableFields } };
  }

  // Validate timeframe shape
  const timeframe = obj.timeframe as Record<string, unknown>;
  if (
    typeof timeframe !== 'object' ||
    timeframe === null ||
    typeof timeframe.start !== 'string' ||
    typeof timeframe.end !== 'string'
  ) {
    return {
      ok: false,
      error: { type: 'missing_fields', missingFields: ['timeframe'] },
    };
  }

  // All checks passed — assemble the ParsedIntent
  const intent: ParsedIntent = {
    intent_type: obj.intent_type as IntentType,
    categories: obj.categories as string[],
    timeframe: {
      start: timeframe.start as string,
      end: timeframe.end as string,
    },
  };

  return { ok: true, intent };
}

/**
 * Detects category names in `intentCategories` that have no case-insensitive
 * match in `availableCategories` (Req 4.10, 8.1, 8.3).
 *
 * @param intentCategories    Category names returned by the LLM in ParsedIntent.
 * @param availableCategories Distinct category names from the active dataset.
 * @returns Array of unmatched category names from `intentCategories`.
 */
export function detectCategoryMismatches(
  intentCategories: string[],
  availableCategories: string[]
): string[] {
  const normalised = new Set(availableCategories.map((c) => c.toLowerCase()));
  return intentCategories.filter((c) => !normalised.has(c.toLowerCase()));
}

/**
 * Interprets a natural-language spending query using the LLM API.
 *
 * Privacy guarantee: only `queryText` and `availableCategories` are sent to
 * the external API. Transaction amounts, descriptions, and dates never leave
 * the browser (Req 4.2, 9.1).
 *
 * @param queryText         The user's raw query string.
 * @param availableCategories Distinct category names from the active dataset.
 * @returns IntentResult — either a validated ParsedIntent or a typed error.
 */
export async function interpretQuery(
  queryText: string,
  availableCategories: string[]
): Promise<IntentResult> {
  const todayDate = getLocalTodayDate();
  const systemMessage = buildSystemMessage(availableCategories, todayDate);

  const apiKey =
    process.env.NEXT_PUBLIC_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey ?? ''}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: 'gpt-4o',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: queryText },
        ],
      }),
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        ok: false,
        error: { type: 'api_failure', statusCode: response.status },
      };
    }

    const responseJson = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const rawContent = responseJson?.choices?.[0]?.message?.content;

    if (typeof rawContent !== 'string' || rawContent.trim() === '') {
      return {
        ok: false,
        error: { type: 'missing_fields', missingFields: ['intent_type', 'categories', 'timeframe'] },
      };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      return {
        ok: false,
        error: { type: 'missing_fields', missingFields: ['intent_type', 'categories', 'timeframe'] },
      };
    }

    return validateLlmResponse(parsed);
  } catch (err) {
    clearTimeout(timeoutId);

    // AbortController fires a DOMException with name 'AbortError' on timeout
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false, error: { type: 'api_timeout' } };
    }

    // Any other network-level failure
    return { ok: false, error: { type: 'api_failure' } };
  }
}
