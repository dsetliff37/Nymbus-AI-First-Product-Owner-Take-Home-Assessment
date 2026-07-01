/**
 * Unit tests for src/lib/csvParser.ts
 *
 * Validates: Requirements 1.3, 1.5, 1.6
 *
 * PapaParse is mocked so tests run reliably under jsdom without a real
 * FileReader implementation. The mock calls the `complete` callback
 * synchronously with whatever we inject via `__setNextResult`.
 */

import Papa from 'papaparse';
import { parseCsv, MAX_FILE_SIZE_BYTES } from '../csvParser';

// ── PapaParse mock ─────────────────────────────────────────────────────────────

jest.mock('papaparse');

const mockPapa = Papa as jest.Mocked<typeof Papa>;

/** Shape that our mock returns on the next `Papa.parse` call. */
let nextParseResult: Papa.ParseResult<Record<string, string>> | null = null;

function setNextResult(result: Papa.ParseResult<Record<string, string>>) {
  nextParseResult = result;
}

/** Build a minimal ParseResult to keep test fixtures concise. */
function makeResult(
  fields: string[],
  data: Record<string, string>[]
): Papa.ParseResult<Record<string, string>> {
  return {
    data,
    errors: [],
    meta: { fields, delimiter: ',', linebreak: '\n', aborted: false, truncated: false, cursor: 0 },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  // Wire up the mock so it calls `complete` synchronously.
  (mockPapa.parse as jest.Mock).mockImplementation(
    (_file: File, config: Papa.ParseConfig<Record<string, string>>) => {
      if (nextParseResult && config.complete) {
        config.complete(nextParseResult, _file as File);
      }
      nextParseResult = null;
    }
  );
});

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Create a File whose `size` property equals the byte-length of `content`. */
function makeFile(content: string, name = 'test.csv'): File {
  return new File([content], name, { type: 'text/csv' });
}

/** Create a File with an artificially large `size` property. */
function makeLargeFile(sizeBytes: number): File {
  const f = new File(['x'], 'big.csv', { type: 'text/csv' });
  Object.defineProperty(f, 'size', { value: sizeBytes });
  return f;
}

// ── Test 1: Valid file loads all rows ─────────────────────────────────────────

describe('parseCsv — valid file', () => {
  it('returns ok:true with correct rowsLoaded/rowsSkipped and all transactions', async () => {
    // Validates: Requirement 1.3, 1.6
    const rows: Record<string, string>[] = [
      { date: '2024-01-15', amount: '42.50', description: 'Coffee', category: 'Food' },
      { date: '2024-02-01', amount: '-10.00', description: 'Refund', category: 'Shopping' },
      { date: '2024-03-10', amount: '120.75', description: 'Groceries', category: 'Food' },
    ];

    setNextResult(makeResult(['date', 'amount', 'description', 'category'], rows));

    const { result, transactions } = await parseCsv(makeFile('ignored'));

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');

    expect(result.rowsLoaded).toBe(3);
    expect(result.rowsSkipped).toBe(0);
    expect(transactions).toHaveLength(3);

    expect(transactions[0]).toEqual({ date: '2024-01-15', amount: 42.50, description: 'Coffee', category: 'Food' });
    expect(transactions[1]).toEqual({ date: '2024-02-01', amount: -10.00, description: 'Refund', category: 'Shopping' });
    expect(transactions[2]).toEqual({ date: '2024-03-10', amount: 120.75, description: 'Groceries', category: 'Food' });
  });
});

// ── Test 2: All-rows-invalid → no_valid_rows ──────────────────────────────────

describe('parseCsv — all rows invalid', () => {
  it('returns no_valid_rows error when every row has an invalid amount', async () => {
    // Validates: Requirement 1.5, 1.6
    const rows: Record<string, string>[] = [
      { date: '2024-01-01', amount: 'not-a-number', description: 'Bad', category: 'X' },
      { date: '2024-01-02', amount: '', description: 'Also bad', category: 'X' },
      { date: '2024-01-03', amount: 'N/A', description: 'Still bad', category: 'X' },
    ];

    setNextResult(makeResult(['date', 'amount', 'description', 'category'], rows));

    const { result, transactions } = await parseCsv(makeFile('ignored'));

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');

    expect(result.error.type).toBe('no_valid_rows');
    expect(transactions).toHaveLength(0);
  });
});

// ── Test 3: Partial skip — rowsLoaded + rowsSkipped === totalRows ─────────────

describe('parseCsv — partial skip', () => {
  it('correctly counts rowsLoaded and rowsSkipped that sum to total rows', async () => {
    // Validates: Requirement 1.5, 1.6
    const rows: Record<string, string>[] = [
      { date: '2024-01-01', amount: '10.00',       description: 'Valid 1', category: 'A' }, // valid
      { date: '2024-01-02', amount: 'bad',          description: 'Invalid', category: 'B' }, // skipped — bad amount
      { date: 'not-a-date', amount: '20.00',        description: 'Invalid', category: 'C' }, // skipped — bad date
      { date: '2024-01-04', amount: '30.00',        description: 'Valid 2', category: 'D' }, // valid
      { date: '2024-01-05', amount: 'also-bad',     description: 'Invalid', category: 'E' }, // skipped
    ];

    setNextResult(makeResult(['date', 'amount', 'description', 'category'], rows));

    const { result, transactions } = await parseCsv(makeFile('ignored'));

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');

    const totalRows = rows.length;
    expect(result.rowsLoaded + result.rowsSkipped).toBe(totalRows);
    expect(result.rowsLoaded).toBe(2);
    expect(result.rowsSkipped).toBe(3);
    expect(transactions).toHaveLength(2);
  });
});

// ── Test 4: File-too-large → file_too_large ───────────────────────────────────

describe('parseCsv — file too large', () => {
  it('returns file_too_large error when file size exceeds 10 MB', async () => {
    // Validates: Requirement 1.3
    const oversizedFile = makeLargeFile(MAX_FILE_SIZE_BYTES + 1);

    const { result, transactions } = await parseCsv(oversizedFile);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');

    expect(result.error.type).toBe('file_too_large');
    expect(transactions).toHaveLength(0);

    // PapaParse should never have been called — size check is first.
    expect(mockPapa.parse).not.toHaveBeenCalled();
  });

  it('accepts a file exactly at the 10 MB limit', async () => {
    // Validates: Requirement 1.3 — boundary: exactly MAX_FILE_SIZE_BYTES is allowed
    const rows: Record<string, string>[] = [
      { date: '2024-01-01', amount: '5.00', description: 'OK', category: 'Cat' },
    ];
    setNextResult(makeResult(['date', 'amount', 'description', 'category'], rows));

    const exactFile = makeLargeFile(MAX_FILE_SIZE_BYTES);
    const { result } = await parseCsv(exactFile);

    expect(result.ok).toBe(true);
  });
});

// ── Test 5: Both date formats are accepted and normalized ─────────────────────

describe('parseCsv — date format normalisation', () => {
  it('accepts YYYY-MM-DD and stores it as-is', async () => {
    // Validates: Requirement 1.6
    const rows: Record<string, string>[] = [
      { date: '2024-06-15', amount: '55.00', description: 'ISO date', category: 'Test' },
    ];
    setNextResult(makeResult(['date', 'amount', 'description', 'category'], rows));

    const { result, transactions } = await parseCsv(makeFile('ignored'));

    expect(result.ok).toBe(true);
    expect(transactions[0].date).toBe('2024-06-15');
  });

  it('accepts MM/DD/YYYY and normalizes to YYYY-MM-DD', async () => {
    // Validates: Requirement 1.6
    const rows: Record<string, string>[] = [
      { date: '06/15/2024', amount: '55.00', description: 'US date', category: 'Test' },
    ];
    setNextResult(makeResult(['date', 'amount', 'description', 'category'], rows));

    const { result, transactions } = await parseCsv(makeFile('ignored'));

    expect(result.ok).toBe(true);
    expect(transactions[0].date).toBe('2024-06-15');
  });

  it('handles single-digit month and day in MM/DD/YYYY (e.g. 1/5/2024 → 2024-01-05)', async () => {
    // Validates: Requirement 1.6 — the regex allows \d{1,2} for month/day
    const rows: Record<string, string>[] = [
      { date: '1/5/2024', amount: '9.99', description: 'Short date', category: 'Test' },
    ];
    setNextResult(makeResult(['date', 'amount', 'description', 'category'], rows));

    const { result, transactions } = await parseCsv(makeFile('ignored'));

    expect(result.ok).toBe(true);
    expect(transactions[0].date).toBe('2024-01-05');
  });
});

// ── Test 6: Missing required columns → missing_columns ───────────────────────

describe('parseCsv — missing columns', () => {
  it('returns missing_columns error identifying absent columns', async () => {
    // Validates: Requirement 1.5
    // CSV has only date and amount — description and category are missing.
    setNextResult(makeResult(['date', 'amount'], []));

    const { result, transactions } = await parseCsv(makeFile('ignored'));

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');

    expect(result.error.type).toBe('missing_columns');
    if (result.error.type !== 'missing_columns') throw new Error('wrong error type');

    expect(result.error.missingColumns).toContain('description');
    expect(result.error.missingColumns).toContain('category');
    expect(result.error.missingColumns).not.toContain('date');
    expect(result.error.missingColumns).not.toContain('amount');
    expect(transactions).toHaveLength(0);
  });

  it('returns missing_columns listing all absent columns when header is completely empty', async () => {
    // Validates: Requirement 1.5
    setNextResult(makeResult([], []));

    const { result } = await parseCsv(makeFile('ignored'));

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.type).toBe('missing_columns');

    if (result.error.type !== 'missing_columns') throw new Error('wrong error type');
    expect(result.error.missingColumns).toEqual(
      expect.arrayContaining(['date', 'amount', 'description', 'category'])
    );
  });

  it('performs a case-insensitive column check (DATE/AMOUNT/DESCRIPTION/CATEGORY)', async () => {
    // Validates: Requirement 1.5 — header keys are compared case-insensitively
    const rows: Record<string, string>[] = [
      { DATE: '2024-01-01', AMOUNT: '10.00', DESCRIPTION: 'Upper', CATEGORY: 'X' },
    ];
    setNextResult(makeResult(['DATE', 'AMOUNT', 'DESCRIPTION', 'CATEGORY'], rows));

    const { result } = await parseCsv(makeFile('ignored'));

    expect(result.ok).toBe(true);
  });
});
