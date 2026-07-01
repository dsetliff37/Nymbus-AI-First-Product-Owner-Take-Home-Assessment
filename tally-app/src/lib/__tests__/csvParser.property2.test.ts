/**
 * Property-Based Test — Property 2: Invalid-amount rows are always skipped.
 *
 * // Feature: tally-spending-analyst, Property 2: Invalid-amount rows are always skipped
 *
 * **Validates: Requirement 1.6**
 *
 * For any CSV file where a subset of rows have an `amount` field that cannot be
 * parsed as a number (empty string, alphabetic text, symbols, etc.), those rows
 * SHALL be excluded from the loaded transaction dataset and the loaded count
 * SHALL equal the number of valid-amount rows.
 *
 * If ALL rows have invalid amounts the result MUST be:
 *   { ok: false, error: { type: 'no_valid_rows' } }
 */

import * as fc from 'fast-check';
import { parseCsv } from '../csvParser';

// ── Arbitraries ────────────────────────────────────────────────────────────────

/**
 * Produces a well-formed YYYY-MM-DD date string that parseDate() will accept.
 * We use integer-based generation (capping days at 28 to avoid month-overflow)
 * to guarantee every produced string is a valid calendar date.
 */
const validDateArb = fc
  .record({
    year: fc.integer({ min: 2000, max: 2030 }),
    month: fc.integer({ min: 1, max: 12 }),
    day: fc.integer({ min: 1, max: 28 }), // cap at 28 — avoids all month-end overflow
  })
  .map(({ year, month, day }) => {
    const mm = String(month).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${year}-${mm}-${dd}`;
  });

/**
 * Produces a numeric amount string that parseFloat() will NOT return NaN for.
 * We use a float and format it as a plain decimal string (no currency symbols).
 */
const validAmountArb = fc.float({ min: -1_000_000, max: 1_000_000, noNaN: true }).map(String);

/**
 * Produces strings that are definitively non-numeric so that
 * parseFloat(value) === NaN.  We use a curated set of literals and short
 * alphabetic strings rather than fc.string() to avoid accidental numeric hits.
 */
const invalidAmountArb = fc.oneof(
  // Empty string
  fc.constant(''),
  // Pure alphabetic
  fc.stringMatching(/^[a-zA-Z]{1,8}$/),
  // Currency-prefixed
  fc.oneof(
    fc.constant('$10'),
    fc.constant('€20'),
    fc.constant('£5'),
    fc.constant('¥100'),
  ),
  // Symbols / whitespace only
  fc.oneof(
    fc.constant('N/A'),
    fc.constant('--'),
    fc.constant('???'),
    fc.constant('  '),
    fc.constant('null'),
    fc.constant('undefined'),
    fc.constant('NaN'),    // parseFloat('NaN') === NaN ✓
    fc.constant('Infinity'),  // parseFloat('Infinity') is NOT NaN — exclude
  ).filter((s) => isNaN(parseFloat(s))),
);

/**
 * A single CSV row represented as an object with the four required columns.
 */
interface RowSpec {
  date: string;
  amount: string;
  description: string;
  category: string;
  isValid: boolean; // true ↔ amount is parseable as a number
}

/** Generator for a row with a VALID amount. */
const validRowArb: fc.Arbitrary<RowSpec> = fc.record({
  date: validDateArb,
  amount: validAmountArb,
  description: fc.string({ minLength: 0, maxLength: 40 }),
  category: fc.string({ minLength: 1, maxLength: 20 }),
}).map((r) => ({ ...r, isValid: true }));

/** Generator for a row with an INVALID amount. */
const invalidRowArb: fc.Arbitrary<RowSpec> = fc.record({
  date: validDateArb,
  amount: invalidAmountArb,
  description: fc.string({ minLength: 0, maxLength: 40 }),
  category: fc.string({ minLength: 1, maxLength: 20 }),
}).map((r) => ({ ...r, isValid: false }));

/**
 * Builds an array of RowSpec that contains at least one entry.
 * We interleave valid and invalid rows using fc.array + fc.oneof so that
 * the ratio is varied across runs (could be all-valid, all-invalid, or mixed).
 */
const rowsArb: fc.Arbitrary<RowSpec[]> = fc
  .array(fc.oneof(validRowArb, invalidRowArb), { minLength: 1, maxLength: 30 })
  .filter((rows) => rows.length > 0);

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Escape a CSV field (wrap in quotes if it contains commas, quotes, or newlines). */
function csvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Convert an array of RowSpec into a CSV string (with header). */
function buildCsv(rows: RowSpec[]): string {
  const header = 'date,amount,description,category';
  const lines = rows.map(
    (r) =>
      [
        csvField(r.date),
        csvField(r.amount),
        csvField(r.description),
        csvField(r.category),
      ].join(','),
  );
  return [header, ...lines].join('\n');
}

/** Wrap a CSV string in a File object (as the browser / parseCsv expects). */
function makeFile(csvContent: string): File {
  return new File([csvContent], 'test.csv', { type: 'text/csv' });
}

// ── Property test ──────────────────────────────────────────────────────────────

describe('Property 2 — invalid-amount rows are always skipped', () => {
  it(
    'excludes rows with non-numeric amounts and counts only valid rows',
    async () => {
      await fc.assert(
        fc.asyncProperty(rowsArb, async (rows) => {
          const validCount = rows.filter((r) => r.isValid).length;
          const csvContent = buildCsv(rows);
          const file = makeFile(csvContent);

          const { result, transactions } = await parseCsv(file);

          if (validCount === 0) {
            // All amounts are invalid → parser must report no_valid_rows
            expect(result.ok).toBe(false);
            if (!result.ok) {
              expect(result.error.type).toBe('no_valid_rows');
            }
            expect(transactions).toHaveLength(0);
          } else {
            // Some rows are valid → parser must succeed and load exactly validCount rows
            expect(result.ok).toBe(true);
            if (result.ok) {
              expect(result.rowsLoaded).toBe(validCount);
            }
            expect(transactions).toHaveLength(validCount);
          }
        }),
        {
          numRuns: 100,
          verbose: true,
        },
      );
    },
    // generous timeout for 100 async runs
    30_000,
  );

  it(
    'returns no_valid_rows when every row has an invalid amount',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(invalidRowArb, { minLength: 1, maxLength: 20 }),
          async (rows) => {
            const csvContent = buildCsv(rows);
            const file = makeFile(csvContent);

            const { result, transactions } = await parseCsv(file);

            expect(result.ok).toBe(false);
            if (!result.ok) {
              expect(result.error.type).toBe('no_valid_rows');
            }
            expect(transactions).toHaveLength(0);
          },
        ),
        { numRuns: 100 },
      );
    },
    30_000,
  );
});
