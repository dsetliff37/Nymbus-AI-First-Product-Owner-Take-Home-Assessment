/**
 * Calculation Engine
 *
 * Pure, synchronous function that filters and aggregates transactions
 * given a structured ParsedIntent. No API calls, no side effects.
 *
 * Validates: Requirements 5.1–5.8, 6.4, 6.5
 */

import type {
  ParsedIntent,
  Transaction,
  CalculationResult,
  CompareValues,
} from '../types/index';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Half-up rounding to 2 decimal places. */
function roundHalfUp(x: number): number {
  return Math.round(x * 100) / 100;
}

/**
 * Returns true when the transaction's category matches any of the supplied
 * category strings (case-insensitive) and its date falls within [start, end]
 * inclusive.
 */
function matchesFilter(
  tx: Transaction,
  categories: string[],
  start: string,
  end: string,
): boolean {
  const txCategory = tx.category.toLowerCase();
  const categoryMatch = categories.some(
    (c) => c.toLowerCase() === txCategory,
  );
  if (!categoryMatch) return false;

  // YYYY-MM-DD string comparison works correctly for ISO dates
  return tx.date >= start && tx.date <= end;
}

/**
 * Sort comparator: most-recent date first; same-date rows alphabetically
 * ascending by description.
 */
function sortTransactions(a: Transaction, b: Transaction): number {
  if (b.date < a.date) return -1;
  if (b.date > a.date) return 1;
  // Same date — sort by description ascending
  return a.description.localeCompare(b.description);
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function calculate(
  intent: ParsedIntent,
  transactions: Transaction[],
): CalculationResult {
  const { intent_type, categories, timeframe } = intent;
  const { start, end } = timeframe;

  // 1. Filter transactions: category match (case-insensitive) + date in range
  const matched = transactions.filter((tx) =>
    matchesFilter(tx, categories, start, end),
  );

  // 7. Zero-match guard
  const zeroMatch = matched.length === 0;

  // 8. Sort and cap source transactions
  const sourceTransactions = [...matched]
    .sort(sortTransactions)
    .slice(0, 100);

  // 2–5. Compute the value based on intent type
  let value: number | CompareValues;

  if (zeroMatch) {
    // Return 0 for all intent types when no rows matched
    if (intent_type === 'compare') {
      const catA = categories[0] ?? '';
      const catB = categories[1] ?? '';
      value = {
        categoryA: catA,
        categoryB: catB,
        sumA: 0,
        sumB: 0,
        difference: 0,
      } satisfies CompareValues;
    } else {
      value = 0;
    }
  } else {
    switch (intent_type) {
      case 'sum': {
        // Requirement 5.2 — arithmetic sum of amount fields
        const total = matched.reduce((acc, tx) => acc + tx.amount, 0);
        value = roundHalfUp(total);
        break;
      }

      case 'compare': {
        // Requirement 5.3 — separate sum per category, signed difference
        const catA = categories[0] ?? '';
        const catB = categories[1] ?? '';
        const catALower = catA.toLowerCase();
        const catBLower = catB.toLowerCase();

        const rawSumA = matched
          .filter((tx) => tx.category.toLowerCase() === catALower)
          .reduce((acc, tx) => acc + tx.amount, 0);

        const rawSumB = matched
          .filter((tx) => tx.category.toLowerCase() === catBLower)
          .reduce((acc, tx) => acc + tx.amount, 0);

        const sumA = roundHalfUp(rawSumA);
        const sumB = roundHalfUp(rawSumB);

        value = {
          categoryA: catA,
          categoryB: catB,
          sumA,
          sumB,
          difference: roundHalfUp(sumA - sumB),
        } satisfies CompareValues;
        break;
      }

      case 'average': {
        // Requirement 5.4 — arithmetic mean
        const total = matched.reduce((acc, tx) => acc + tx.amount, 0);
        value = roundHalfUp(total / matched.length);
        break;
      }

      case 'count': {
        // Requirement 5.5 — count of matching rows (no rounding needed)
        value = matched.length;
        break;
      }

      default: {
        // Exhaustive check — TypeScript will catch unhandled intent types
        const _exhaustive: never = intent_type;
        throw new Error(`Unsupported intent type: ${_exhaustive}`);
      }
    }
  }

  return {
    intentType: intent_type,
    categories,
    timeframe,
    value,
    sourceTransactions,
    zeroMatch,
  };
}
