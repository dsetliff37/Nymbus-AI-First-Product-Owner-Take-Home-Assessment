/**
 * Property-based test — Property 1: CSV parse round-trip preserves valid rows
 *
 * Feature: tally-spending-analyst, Property 1: CSV parse round-trip preserves valid rows
 *
 * **Validates: Requirements 1.3, 1.6**
 *
 * For any CSV file containing N valid rows (parseable date, numeric amount,
 * non-empty description, non-empty category), parsing the file and loading it
 * into the transaction dataset SHALL yield exactly N transactions, each with
 * the same date, amount, description, and category as the source row.
 */

import * as fc from 'fast-check';
import { parseCsv } from '../csvParser';

// ── Arbitraries ────────────────────────────────────────────────────────────────

/** Produces a valid YYYY-MM-DD date string. */
const validDateArb: fc.Arbitrary<string> = fc
  .record({
    year: fc.integer({ min: 2000, max: 2024 }),
    month: fc.integer({ min: 1, max: 12 }),
    day: fc.integer({ min: 1, max: 28 }), // cap at 28 to avoid month-overflow issues
  })
  .map(({ year, month, day }) => {
    const mm = String(month).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${year}-${mm}-${dd}`;
  });

/** Produces a valid finite numeric amount (including negatives). */
const validAmountArb: fc.Arbitrary<number> = fc.float({
  min: -1_000_000,
  max: 1_000_000,
  noNaN: true,
  noDefaultInfinity: true,
});

/**
 * Produces a non-empty string that is safe to embed in a CSV cell.
 * We exclude commas, double-quotes, and newline characters to keep the
 * generated CSV unambiguous without needing per-field quoting logic.
 */
const safeCsvStringArb: fc.Arbitrary<string> = fc
  .string({ minLength: 1, maxLength: 40 })
  .map((s) => s.replace(/[",\r\n]/g, '_'))
  .filter((s) => s.trim().length > 0);

/** One valid CSV source row. */
interface SourceRow {
  date: string;
  amount: number;
  description: string;
  category: string;
}

const sourceRowArb: fc.Arbitrary<SourceRow> = fc.record({
  date: validDateArb,
  amount: validAmountArb,
  description: safeCsvStringArb,
  category: safeCsvStringArb,
});

/** An array of ≥ 1 valid source rows. */
const sourceRowsArb: fc.Arbitrary<SourceRow[]> = fc.array(sourceRowArb, {
  minLength: 1,
  maxLength: 50,
});

// ── Helper ─────────────────────────────────────────────────────────────────────

/** Build an in-memory CSV string from a header + rows array. */
function buildCsv(rows: SourceRow[]): string {
  const header = 'date,amount,description,category';
  const lines = rows.map(
    (r) => `${r.date},${r.amount},${r.description},${r.category}`,
  );
  return [header, ...lines].join('\n');
}

/** Wrap a CSV string in a browser-compatible File object (jsdom). */
function csvToFile(csv: string, name = 'test.csv'): File {
  return new File([csv], name, { type: 'text/csv' });
}

// ── Property test ──────────────────────────────────────────────────────────────

describe('Property 1: CSV parse round-trip preserves valid rows', () => {
  // Feature: tally-spending-analyst, Property 1: CSV parse round-trip preserves valid rows
  it(
    'parses N valid rows → result.ok, rowsLoaded === N, fields match source',
    async () => {
      await fc.assert(
        fc.asyncProperty(sourceRowsArb, async (rows) => {
          const csv = buildCsv(rows);
          const file = csvToFile(csv);

          const { result, transactions } = await parseCsv(file);

          // result.ok must be true for an all-valid CSV
          expect(result.ok).toBe(true);
          if (!result.ok) return; // type-narrow; the assertion above already fails

          // Exactly N transactions loaded
          expect(result.rowsLoaded).toBe(rows.length);
          expect(transactions).toHaveLength(rows.length);

          // Each transaction must mirror its source row
          for (let i = 0; i < rows.length; i++) {
            const src = rows[i];
            const tx = transactions[i];

            expect(tx.date).toBe(src.date);
            // parseFloat round-trip: compare to the value the parser would see
            expect(tx.amount).toBe(parseFloat(String(src.amount)));
            expect(tx.description).toBe(src.description.trim());
            expect(tx.category).toBe(src.category.trim());
          }
        }),
        { numRuns: 100, verbose: false },
      );
    },
    // Generous timeout: 100 runs × async PapaParse parse in jsdom
    30_000,
  );
});
