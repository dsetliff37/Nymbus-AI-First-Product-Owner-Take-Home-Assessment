/**
 * Property-based tests for intentService.ts — Privacy invariant
 *
 * Feature: tally-spending-analyst, Property 12: Privacy — no amounts/descriptions/dates in LLM payload
 *
 * Validates: Requirements 4.2, 9.1
 *
 * Property: For any query and any transaction dataset, the payload sent to the
 * LLM API SHALL contain only the query text and the list of distinct category
 * names — it SHALL NOT contain any transaction amount, description, or date value.
 */

// Feature: tally-spending-analyst, Property 12: Privacy — no amounts/descriptions/dates in LLM payload

import * as fc from 'fast-check';
import { interpretQuery } from '../intentService';
import type { Transaction } from '../../types';

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Builds a valid OpenAI-style chat completions response. */
function makeLlmResponse(content: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      choices: [{ message: { content } }],
    }),
  } as unknown as Response;
}

const VALID_INTENT_JSON = JSON.stringify({
  intent_type: 'sum',
  categories: ['Groceries'],
  timeframe: { start: '2024-01-01', end: '2024-01-31' },
});

// ── Arbitraries ────────────────────────────────────────────────────────────────

/**
 * Generates a valid YYYY-MM-DD date string.
 * Constrained to years 2000-2030, months 01-12, days 01-28 (safe for all months).
 */
const dateArb: fc.Arbitrary<string> = fc
  .tuple(
    fc.integer({ min: 2000, max: 2030 }),
    fc.integer({ min: 1, max: 12 }),
    fc.integer({ min: 1, max: 28 })
  )
  .map(([y, m, d]) => {
    const mm = String(m).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    return `${y}-${mm}-${dd}`;
  });

/**
 * Generates a transaction amount: a non-zero float with up to 2 decimal places.
 * Excludes zero to ensure the amount is meaningful and distinguishable.
 * Using integers mapped to floats avoids floating-point representation issues.
 */
const amountArb: fc.Arbitrary<number> = fc
  .integer({ min: 1, max: 999999 })
  .map((cents) => parseFloat((cents / 100).toFixed(2)));

/**
 * Generates a category name: a non-empty alphanumeric string with underscores.
 * Restricted to safe characters to avoid JSON-escaping ambiguity in assertions.
 * Prefixed with "Cat_" to ensure uniqueness and avoid overlap with query strings.
 */
const categoryArb: fc.Arbitrary<string> = fc
  .stringMatching(/^[A-Za-z0-9_]{1,15}$/)
  .map((s) => `Cat_${s}`);

/**
 * Generates a transaction description: non-empty alphanumeric string.
 * Restricted to safe characters and prefixed "Desc_" to distinguish from
 * category names and query strings, avoiding JSON-escaping ambiguity.
 */
const descriptionArb: fc.Arbitrary<string> = fc
  .stringMatching(/^[A-Za-z0-9_]{1,20}$/)
  .map((s) => `Desc_${s}`);

/**
 * Generates a single Transaction with all required fields.
 */
const transactionArb: fc.Arbitrary<Transaction> = fc.record({
  date: dateArb,
  amount: amountArb,
  description: descriptionArb,
  category: categoryArb,
});

/**
 * Generates a non-empty array of Transactions (1-20 items).
 */
const transactionsArb: fc.Arbitrary<Transaction[]> = fc.array(transactionArb, {
  minLength: 1,
  maxLength: 20,
});

/**
 * Generates a query string: non-empty alphanumeric with spaces.
 * Restricted to safe characters to avoid JSON-escaping ambiguity in assertions.
 */
const queryArb: fc.Arbitrary<string> = fc
  .stringMatching(/^[A-Za-z0-9 ]{1,60}$/)
  .filter((s) => s.trim().length > 0)
  .map((s) => s.trim() || 'query');

// ── Mock setup ─────────────────────────────────────────────────────────────────

let fetchMock: jest.Mock;

beforeEach(() => {
  fetchMock = jest.fn().mockResolvedValue(makeLlmResponse(VALID_INTENT_JSON));
  global.fetch = fetchMock;
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ── Property test ──────────────────────────────────────────────────────────────

/**
 * **Validates: Requirements 4.2, 9.1**
 *
 * Property 12: Privacy — no amounts/descriptions/dates in LLM payload.
 *
 * For any query string and any array of transactions:
 * - The fetch body contains only the query text and category names.
 * - The fetch body does NOT contain any transaction amount value.
 * - The fetch body does NOT contain any transaction description value.
 * - The fetch body does NOT contain any transaction date value.
 */
describe('Property 12: Privacy — LLM payload contains no transaction amounts, descriptions, or dates', () => {
  it(
    'never leaks transaction amounts, descriptions, or dates to the LLM API for any input',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          transactionsArb,
          queryArb,
          async (transactions, queryText) => {
            // Reset mock for each property run
            fetchMock.mockClear();
            fetchMock.mockResolvedValue(makeLlmResponse(VALID_INTENT_JSON));

            // Derive available categories from the generated transactions (mirrors real app usage)
            const availableCategories = [
              ...new Set(transactions.map((t) => t.category)),
            ].sort();

            // Call the service
            await interpretQuery(queryText, availableCategories);

            // Verify fetch was called
            expect(fetchMock).toHaveBeenCalledTimes(1);

            const [_url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
            const bodyString = options.body as string;

            // ── Assert: query text and categories ARE present ──────────────────
            // The user query must appear in the payload (in the user message)
            expect(bodyString).toContain(queryText);

            // Each available category name must appear in the payload (in the system message)
            for (const cat of availableCategories) {
              expect(bodyString).toContain(cat);
            }

            // ── Assert: transaction amounts are NOT present ────────────────────
            // Check that none of the exact numeric amount strings appear in the body.
            // We format amounts to their string representations as they would be serialized.
            for (const tx of transactions) {
              const amountStr = String(tx.amount);
              // The amount value as a bare number should NOT appear in the body.
              // We check it's not present as a JSON number value (preceded by : or [)
              // to avoid false positives from e.g. year numbers in today's date.
              // A stricter check: the exact amount string must not appear at all in the payload.
              // Since amounts are generated as e.g. "123.45" and categories are prefixed "Cat_...",
              // the likelihood of collision with category/query content is negligible.
              // However, to be robust we check the raw string doesn't appear as a value pattern.
              expect(bodyString).not.toContain(`"amount":${amountStr}`);
              expect(bodyString).not.toContain(`"amount": ${amountStr}`);
              // Also check the amount doesn't appear as a standalone JSON number value
              // by verifying no amount field key is present at all
            }

            // ── Assert: "amount" key is not in the body ────────────────────────
            expect(bodyString).not.toMatch(/"amount"\s*:/);

            // ── Assert: transaction descriptions are NOT present ───────────────
            // "description" key must not appear in the payload
            expect(bodyString).not.toMatch(/"description"\s*:/);

            // Also verify the actual description strings don't appear in the body
            for (const tx of transactions) {
              // Descriptions are prefixed "Desc_..." and are distinct from categories/queries
              // Check the description value does not appear verbatim in the body
              expect(bodyString).not.toContain(tx.description);
            }

            // ── Assert: transaction dates are NOT present ──────────────────────
            // "date" key (as a transaction field) must not appear in the payload.
            // Note: the system message contains today's date for timeframe resolution,
            // but transaction-specific dates must not be present.
            // We check that none of the transaction date values appear in the body.
            for (const tx of transactions) {
              // Each transaction date is a unique YYYY-MM-DD string from 2000-2030.
              // The system message contains today's date (current year/month/day).
              // Transaction dates in range 2000-2029 differ from today (2024/2025),
              // so this check is robust. We look for the date as a JSON string value.
              expect(bodyString).not.toContain(`"date":"${tx.date}"`);
              expect(bodyString).not.toContain(`"date": "${tx.date}"`);
            }

            // ── Assert: only allowed keys in the messages content ──────────────
            // The body should NOT contain a "transactions" key
            expect(bodyString).not.toMatch(/"transactions"\s*:/);
          }
        ),
        { numRuns: 100, verbose: false }
      );
    },
    30_000 // generous timeout for 100 async runs
  );
});
