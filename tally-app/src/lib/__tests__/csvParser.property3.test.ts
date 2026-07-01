// Feature: tally-spending-analyst, Property 3: Missing required columns reject the file

/**
 * Property 3: For any CSV file missing at least one required column
 * (`date`, `amount`, `description`, `category`), parseCsv() SHALL return
 * ok === false with error.type === 'missing_columns', and the list of absent
 * columns SHALL match exactly what was removed (case-insensitive).
 *
 * Validates: Requirement 1.5
 */

import * as fc from 'fast-check';
import { parseCsv } from '../csvParser';

const REQUIRED_COLUMNS = ['date', 'amount', 'description', 'category'] as const;
type RequiredColumn = (typeof REQUIRED_COLUMNS)[number];

/**
 * Build a minimal CSV string whose header contains only `presentColumns`.
 * A single data row is included so PapaParse has something to parse beyond
 * just the header line.
 */
function buildCsvWithColumns(presentColumns: RequiredColumn[]): string {
  if (presentColumns.length === 0) {
    // No columns at all — use a placeholder so the file isn't empty
    return 'extra\nvalue\n';
  }

  const header = presentColumns.join(',');

  // Provide valid-looking values for each present column so row-level
  // validation (date / amount) doesn't interfere with the column check.
  const rowValues: Record<RequiredColumn, string> = {
    date: '2024-01-01',
    amount: '42.00',
    description: 'Test purchase',
    category: 'Groceries',
  };

  const row = presentColumns.map((col) => rowValues[col]).join(',');
  return `${header}\n${row}\n`;
}

/**
 * Wrap a CSV string in a browser-compatible File object.
 * The jsdom environment provides the File constructor via jest-environment-jsdom.
 */
function csvToFile(csvContent: string, name = 'test.csv'): File {
  return new File([csvContent], name, { type: 'text/csv' });
}

describe('Property 3 — Missing required columns reject the file', () => {
  it('returns missing_columns error for every non-empty subset of removed columns', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Pick 1–4 columns to remove (at least one must be absent)
        fc.subarray(
          [...REQUIRED_COLUMNS] as RequiredColumn[],
          { minLength: 1 },
        ),
        async (removedColumns: RequiredColumn[]) => {
          const presentColumns = REQUIRED_COLUMNS.filter(
            (col) => !removedColumns.includes(col),
          );

          const csvContent = buildCsvWithColumns(presentColumns);
          const file = csvToFile(csvContent);

          const { result } = await parseCsv(file);

          // Assertion 1: result must indicate failure
          expect(result.ok).toBe(false);
          if (result.ok) return; // narrowing for TypeScript — never reached

          // Assertion 2: error type must be 'missing_columns'
          expect(result.error.type).toBe('missing_columns');
          if (result.error.type !== 'missing_columns') return;

          // Assertion 3: missingColumns must contain exactly the removed columns
          // (case-insensitive comparison)
          const reportedMissing = result.error.missingColumns.map((c) =>
            c.toLowerCase(),
          );
          const expectedMissing = removedColumns.map((c) => c.toLowerCase());

          // Every removed column must appear in the reported list
          for (const col of expectedMissing) {
            expect(reportedMissing).toContain(col);
          }

          // No extra columns should be reported beyond what was removed
          expect(reportedMissing).toHaveLength(expectedMissing.length);
        },
      ),
      { numRuns: 100 },
    );
  });
});
