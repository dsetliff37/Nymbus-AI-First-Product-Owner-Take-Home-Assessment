/**
 * intentService.ts
 *
 * Calls the LLM API to parse a natural-language spending query into a
 * structured ParsedIntent. Sends ONLY the query text and available category
 * names — never amounts, descriptions, or dates (Req 4.2, 9.1).
 */

import type { IntentResult, ParsedIntent, IntentType } from '../types';

const SUPPORTED_INTENT_TYPES: ReadonlySet<string> = new Set([
  'sum', 'compare', 'average', 'count', 'max', 'min', 'trend', 'breakdown',
  'top_merchants', 'monthly_average', 'percent_of_total', 'frequency',
  'top_category', 'month_over_month', 'daily_average', 'recurring',
  'day_of_week', 'refunds', 'week_over_week', 'savings_rate',
  'largest_category_transaction', 'spending_velocity',
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
function buildSystemMessage(availableCategories: string[], todayDate: string, previousContext?: string): string {
  const categoriesList = availableCategories.join(', ');
  let msg = `You are a query parser for a personal finance app.
Return ONLY valid JSON with these fields:
- intent_type: one of the supported types below
- categories: array of category strings, OR null if the question is about ALL spending
- timeframe: { start: "YYYY-MM-DD", end: "YYYY-MM-DD" } resolved relative to today's date

IMPORTANT: If the user asks about overall/total spending without naming a category, set categories to null.
If the user mentions a specific category, match it to available categories.
If unsure about timeframe, set it to null (we'll default to the full year).
For "last month" use the previous calendar month. For "this month" use the current month so far.

Intent types:
- "sum": total spending ("How much did I spend?", "How much on X?", "How much at Amazon?")
- "compare": compare two categories ("X vs Y", "groceries vs eating out")
- "average": average per transaction ("Average X purchase?")
- "count": number of transactions ("How many times?")
- "max": largest single transaction ("Biggest purchase?", "Largest expenditure?")
- "min": smallest transaction ("Cheapest X?")
- "trend": spending over time ("Is spending going up?", "Spending trend")
- "breakdown": all categories breakdown ("Where does my money go?", "Top 5 categories", "What are my spending categories?")
- "top_merchants": top places by spend ("Where do I spend most?", "How much at Amazon/Walmart/Target?")
- "monthly_average": average per month ("How much per month?")
- "percent_of_total": category % ("What percent is X?")
- "frequency": how often ("How often do I eat out?")
- "top_category": highest category ("What do I spend most on?", "Biggest expense category")
- "month_over_month": compare months ("More or less than last month?", "June vs May", "Category that increased most")
- "daily_average": per day ("Daily spending?", "How much per day?")
- "recurring": repeated charges ("Subscriptions?", "Recurring charges?", "Monthly bills", "Which bills changed?")
- "day_of_week": by weekday ("What day do I spend most?")
- "refunds": refunds/credits ("How much in refunds?")
- "week_over_week": this week vs last ("Spending more this week?")
- "savings_rate": net spending ("Money left after bills?", "Net spending?", "Can I afford $X?")
- "largest_category_transaction": single biggest purchase ("Biggest expenditure?", "Largest purchase this year?")
- "spending_velocity": burn rate ("On pace to go over budget?", "Projected monthly spending?", "At this rate...")

For questions about unusual/unexpected transactions, use "max".
For questions about non-essential spending, use "sum" with categories like Entertainment, Shopping, Dining Out.
For savings projections ("if I reduced X by 20%"), use "sum" for the category mentioned.
For "can I afford $X" type questions, use "savings_rate".

Available categories: ${categoriesList}
Today's date: ${todayDate}`;

  if (previousContext) {
    msg += `\n\nPrevious answer context (user may be asking a follow-up):\n${previousContext}`;
  }

  return msg;
}

/**
 * Validates the raw parsed JSON from the LLM response.
 * Returns a validated ParsedIntent or an IntentResult error.
 */
function validateLlmResponse(raw: unknown, availableCategories: string[]): IntentResult {
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

  // Check for null / unresolvable fields — only intent_type is truly required
  if (obj.intent_type === null) {
    return { ok: false, error: { type: 'unresolvable_fields', fields: ['intent_type'] } };
  }

  // Validate timeframe shape — if null or invalid, default to full year
  let resolvedStart: string;
  let resolvedEnd: string;
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const yearStartStr = `${today.getFullYear()}-01-01`;

  if (obj.timeframe === null || typeof obj.timeframe !== 'object') {
    // Default to full current year
    resolvedStart = yearStartStr;
    resolvedEnd = todayStr;
  } else {
    const timeframe = obj.timeframe as Record<string, unknown>;
    if (typeof timeframe.start === 'string' && typeof timeframe.end === 'string') {
      resolvedStart = timeframe.start;
      resolvedEnd = timeframe.end;
    } else {
      resolvedStart = yearStartStr;
      resolvedEnd = todayStr;
    }
  }

  // Categories: if null or empty, default to ALL available categories
  const rawCategories = obj.categories as string[] | null;
  const resolvedCategories = (!rawCategories || rawCategories.length === 0)
    ? availableCategories
    : rawCategories;

  const intent: ParsedIntent = {
    intent_type: obj.intent_type as IntentType,
    categories: resolvedCategories,
    timeframe: {
      start: resolvedStart,
      end: resolvedEnd,
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
  availableCategories: string[],
  previousContext?: string
): Promise<IntentResult> {
  const todayDate = getLocalTodayDate();
  const systemMessage = buildSystemMessage(availableCategories, todayDate, previousContext);

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
        model: 'gpt-4o-mini',
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
      const errorBody = await response.text().catch(() => '');
      console.error(`[intentService] API error ${response.status}: ${errorBody}`);
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

    return validateLlmResponse(parsed, availableCategories);
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
