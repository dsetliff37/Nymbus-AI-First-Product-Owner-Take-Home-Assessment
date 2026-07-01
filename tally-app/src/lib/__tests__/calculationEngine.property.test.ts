/**
 * Property-based tests for the Calculation Engine
 *
 * Feature: tally-spending-analyst
 * Properties: 5, 6, 7, 8, 10, 11, 14
 *
 * Tests cover sum/average/compare correctness, zero-match behaviour,
 * source transaction sorting, 100-row cap, and case-insensitive category match.
 */

import * as fc from 'fast-check';
import { calculate } from '../calculationEngine';
import type {
  Transaction,
  ParsedIntent,
  IntentType,
  DateRange,
  CompareValues,
} from '../../types/index';

// ── Arbitraries ────────────────────────────────────────────────────────────────

/** Valid YYYY-MM-DD date string (2020–2024, day 1–28). */
const dateArb: fc.Arbitrary<string> = fc
  .record({
    year: fc.integer({ min: 2020, max: 2024 }),
    month: fc.integer({ min: 1, max: 12 }),
    day: fc.integer({ min: 1, max: 28 }),
  })
  .map(({ year, month, day }) => {
    const mm = String(month).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${year}-${mm}-${dd}`;
  });

/** Numeric amount in [-10000, 10000], finite, no NaN. */
const amountArb: fc.Arbitrary<number> = fc.float({
  min: -10000,
  max: 10000,
  noNaN: true,
  noDefaultInfinity: true,
});

/** Non-empty description string (avoids empty after trim). */
const descriptionArb: fc.Arbitrary<string> = fc
  .string({ minLength: 1, maxLength: 30 })
  .filter((s) => s.trim().length > 0);

/** Non-empty category string (avoids empty after trim). */
const categoryArb: fc.Arbitrary<string> = fc
  .string({ minLength: 1, maxLength: 20 })
  .filter((s) => s.trim().length > 0);

/** A single Transaction arbitrary. */
const transactionArb: fc.Arbitrary<Transaction> = fc.record({
  date: dateArb,
  amount: amountArb,
  description: descriptionArb,
  category: categoryArb,
});

/** Array of transactions (1–60 rows). */
const transactionsArb: fc.Arbitrary<Transaction[]> = fc.array(transactionArb, {
  minLength: 1,
  maxLength: 60,
});

/** Large array of transactions (101–150 rows) for cap testing. */
const largeTransactionsArb: fc.Arbitrary<Transaction[]> = fc.array(
  transactionArb,
  { minLength: 101, maxLength: 150 },
);

/** Date range where start ≤ end. */
const dateRangeArb: fc.Arbitrary<DateRange> = fc
  .tuple(dateArb, dateArb)
  .map(([a, b]) => (a <= b ? { start: a, end: b } : { start: b, end: a }));

/** 1–3 category strings for an intent. */
const intentCategoriesArb: fc.Arbitrary<string[]> = fc.array(categoryArb, {
  minLength: 1,
  maxLength: 3,
});

/** ParsedIntent with a specific intent_type. */
function intentArb(type: IntentType): fc.Arbitrary<ParsedIntent> {
  return fc.record({
    intent_type: fc.constant(type),
    categories: intentCategoriesArb,
    timeframe: dateRangeArb,
  });
}

/** ParsedIntent with compare type — always has ≥ 2 categories. */
const compareIntentArb: fc.Arbitrary<ParsedIntent> = fc
  .record({
    intent_type: fc.constant('compare' as IntentType),
    categories: fc.array(categoryArb, { minLength: 2, maxLength: 3 }),
    timeframe: dateRangeArb,
  });

/** Any intent type for generic properties. */
const anyIntentArb: fc.Arbitrary<ParsedIntent> = fc.oneof(
  intentArb('sum'),
  intentArb('average'),
  intentArb('count'),
  compareIntentArb,
);

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Half-up rounding to 2dp (mirrors engine logic). */
function roundHalfUp(x: number): number {
  return Math.round(x * 100) / 100;
}

/** Filter transactions matching intent categories and timeframe (case-insensitive, inclusive). */
function filterMatching(
  transactions: Transaction[],
  categories: string[],
  timeframe: DateRange,
): Transaction[] {
  const lowerCats = categories.map((c) => c.toLowerCase());
  return transactions.filter(
    (tx) =>
      lowerCats.includes(tx.category.toLowerCase()) &&
      tx.date >= timeframe.start &&
      tx.date <= timeframe.end,
  );
}

// ── Property Tests ─────────────────────────────────────────────────────────────

describe('Calculation Engine — Property-based tests', () => {
  // Feature: tally-spending-analyst, Property 5–8, 10–11, 14

  // ──────────────────────────────────────────────────────────────────────────────
  // Property 5 — sum correctness
  // **Validates: Requirements 5.1, 5.2**
  // ──────────────────────────────────────────────────────────────────────────────
  it(
    'Property 5: sum value equals arithmetic sum of matching transactions',
    () => {
      fc.assert(
        fc.property(
          intentArb('sum'),
          transactionsArb,
          (intent, transactions) => {
            const result = calculate(intent, transactions);
            const matched = filterMatching(
              transactions,
              intent.categories,
              intent.timeframe,
            );
            const expectedSum = roundHalfUp(
              matched.reduce((acc, tx) => acc + tx.amount, 0),
            );
            expect(result.value).toBe(expectedSum);
          },
        ),
        { numRuns: 100 },
      );
    },
    60_000,
  );

  // ──────────────────────────────────────────────────────────────────────────────
  // Property 6 — average correctness
  // **Validates: Requirements 5.1, 5.4, 5.6**
  // ──────────────────────────────────────────────────────────────────────────────
  it(
    'Property 6: average value equals sum/count rounded to 2dp when ≥1 match',
    () => {
      fc.assert(
        fc.property(
          intentArb('average'),
          transactionsArb,
          (intent, transactions) => {
            const matched = filterMatching(
              transactions,
              intent.categories,
              intent.timeframe,
            );
            const result = calculate(intent, transactions);

            if (matched.length === 0) {
              // Covered by Property 8
              expect(result.value).toBe(0);
            } else {
              const sum = matched.reduce((acc, tx) => acc + tx.amount, 0);
              const expectedAvg = roundHalfUp(sum / matched.length);
              expect(result.value).toBe(expectedAvg);
            }
          },
        ),
        { numRuns: 100 },
      );
    },
    60_000,
  );

  // ──────────────────────────────────────────────────────────────────────────────
  // Property 7 — compare correctness
  // **Validates: Requirements 5.1, 5.3**
  // ──────────────────────────────────────────────────────────────────────────────
  it(
    'Property 7: compare returns correct sumA, sumB, and difference === sumA - sumB',
    () => {
      fc.assert(
        fc.property(
          compareIntentArb,
          transactionsArb,
          (intent, transactions) => {
            const result = calculate(intent, transactions);
            const value = result.value as CompareValues;

            const catALower = intent.categories[0].toLowerCase();
            const catBLower = intent.categories[1].toLowerCase();

            // Compute matching transactions per category
            const allMatched = filterMatching(
              transactions,
              intent.categories,
              intent.timeframe,
            );

            const matchedA = allMatched.filter(
              (tx) => tx.category.toLowerCase() === catALower,
            );
            const matchedB = allMatched.filter(
              (tx) => tx.category.toLowerCase() === catBLower,
            );

            const expectedSumA = roundHalfUp(
              matchedA.reduce((acc, tx) => acc + tx.amount, 0),
            );
            const expectedSumB = roundHalfUp(
              matchedB.reduce((acc, tx) => acc + tx.amount, 0),
            );

            expect(value.sumA).toBe(expectedSumA);
            expect(value.sumB).toBe(expectedSumB);
            expect(value.difference).toBe(
              roundHalfUp(expectedSumA - expectedSumB),
            );
          },
        ),
        { numRuns: 100 },
      );
    },
    60_000,
  );

  // ──────────────────────────────────────────────────────────────────────────────
  // Property 8 — zero-match returns zero
  // **Validates: Requirements 5.7, 5.8**
  // ──────────────────────────────────────────────────────────────────────────────
  it(
    'Property 8: zero-match returns 0 value and zeroMatch true',
    () => {
      // Generate intent with a category guaranteed not to appear in the dataset
      const noMatchIntentArb: fc.Arbitrary<ParsedIntent> = fc.record({
        intent_type: fc.constantFrom(
          'sum' as IntentType,
          'average' as IntentType,
          'count' as IntentType,
        ),
        categories: fc.constant(['__NOMATCH_CATEGORY_XYZ__']),
        timeframe: dateRangeArb,
      });

      const noMatchCompareIntentArb: fc.Arbitrary<ParsedIntent> = fc.record({
        intent_type: fc.constant('compare' as IntentType),
        categories: fc.constant([
          '__NOMATCH_A_XYZ__',
          '__NOMATCH_B_XYZ__',
        ]),
        timeframe: dateRangeArb,
      });

      // Test non-compare intents
      fc.assert(
        fc.property(
          noMatchIntentArb,
          transactionsArb,
          (intent, transactions) => {
            const result = calculate(intent, transactions);
            expect(result.zeroMatch).toBe(true);
            expect(result.value).toBe(0);
          },
        ),
        { numRuns: 100 },
      );

      // Test compare intents
      fc.assert(
        fc.property(
          noMatchCompareIntentArb,
          transactionsArb,
          (intent, transactions) => {
            const result = calculate(intent, transactions);
            expect(result.zeroMatch).toBe(true);
            const value = result.value as CompareValues;
            expect(value.sumA).toBe(0);
            expect(value.sumB).toBe(0);
            expect(value.difference).toBe(0);
          },
        ),
        { numRuns: 100 },
      );
    },
    60_000,
  );

  // ──────────────────────────────────────────────────────────────────────────────
  // Property 10 — source transactions correctly sorted
  // **Validates: Requirements 6.5**
  // ──────────────────────────────────────────────────────────────────────────────
  it(
    'Property 10: source transactions sorted most-recent first, then alpha by description',
    () => {
      fc.assert(
        fc.property(anyIntentArb, transactionsArb, (intent, transactions) => {
          const result = calculate(intent, transactions);
          const src = result.sourceTransactions;

          for (let i = 1; i < src.length; i++) {
            const prev = src[i - 1];
            const curr = src[i];

            if (prev.date === curr.date) {
              // Same date: alphabetical ascending by description
              expect(
                prev.description.localeCompare(curr.description),
              ).toBeLessThanOrEqual(0);
            } else {
              // Most recent first: prev.date >= curr.date
              expect(prev.date >= curr.date).toBe(true);
            }
          }
        }),
        { numRuns: 100 },
      );
    },
    60_000,
  );

  // ──────────────────────────────────────────────────────────────────────────────
  // Property 11 — source list capped at 100
  // **Validates: Requirements 6.4**
  // ──────────────────────────────────────────────────────────────────────────────
  it(
    'Property 11: sourceTransactions.length ≤ 100 regardless of match count',
    () => {
      // Use a large dataset with a category guaranteed to match all rows
      const fixedCategory = 'TestCat';
      const largeFixedTransactionsArb: fc.Arbitrary<Transaction[]> = fc.array(
        fc.record({
          date: dateArb,
          amount: amountArb,
          description: descriptionArb,
          category: fc.constant(fixedCategory),
        }),
        { minLength: 101, maxLength: 150 },
      );

      const matchAllIntent: fc.Arbitrary<ParsedIntent> = fc.record({
        intent_type: fc.constantFrom(
          'sum' as IntentType,
          'average' as IntentType,
          'count' as IntentType,
        ),
        categories: fc.constant([fixedCategory]),
        timeframe: fc.constant({ start: '2020-01-01', end: '2024-12-28' }),
      });

      fc.assert(
        fc.property(
          matchAllIntent,
          largeFixedTransactionsArb,
          (intent, transactions) => {
            const result = calculate(intent, transactions);
            expect(result.sourceTransactions.length).toBeLessThanOrEqual(100);
          },
        ),
        { numRuns: 100 },
      );
    },
    60_000,
  );

  // ──────────────────────────────────────────────────────────────────────────────
  // Property 14 — category match is case-insensitive
  // **Validates: Requirements 5.1**
  // ──────────────────────────────────────────────────────────────────────────────
  it(
    'Property 14: transaction with different casing category is still included',
    () => {
      // Generate a category, then create transactions with randomly altered casing
      const caseMutateArb: fc.Arbitrary<{
        originalCategory: string;
        mutatedCategory: string;
      }> = categoryArb
        .filter((c) => /[a-zA-Z]/.test(c)) // Ensure there's at least one letter
        .map((c) => ({
          originalCategory: c,
          mutatedCategory: c
            .split('')
            .map((ch) => (Math.random() > 0.5 ? ch.toUpperCase() : ch.toLowerCase()))
            .join(''),
        }));

      fc.assert(
        fc.property(
          caseMutateArb,
          dateRangeArb,
          amountArb,
          descriptionArb,
          (catPair, timeframe, amount, desc) => {
            // Create a transaction with the mutated casing
            const tx: Transaction = {
              date: timeframe.start, // guaranteed in range
              amount,
              description: desc,
              category: catPair.mutatedCategory,
            };

            // Create an intent that uses the original casing
            const intent: ParsedIntent = {
              intent_type: 'sum',
              categories: [catPair.originalCategory],
              timeframe,
            };

            const result = calculate(intent, [tx]);

            // The transaction should be included (not zero-match)
            // because category match is case-insensitive
            expect(result.zeroMatch).toBe(false);
            expect(result.sourceTransactions).toHaveLength(1);
            expect(result.sourceTransactions[0]).toEqual(tx);
          },
        ),
        { numRuns: 100 },
      );
    },
    60_000,
  );
}, 60_000);
