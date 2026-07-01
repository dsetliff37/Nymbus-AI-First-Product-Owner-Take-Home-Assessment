/**
 * CSV Parser — full PapaParse-based implementation (task 3.1).
 *
 * Validates file size, required columns, and each row's date/amount fields.
 * Runs entirely in the browser; no server-side logic.
 *
 * Requirements: 1.3, 1.5, 1.6
 */

import Papa from 'papaparse';
import { CsvUploadResult, Transaction } from '../types';

/** Maximum accepted file size: 10 MB (Requirement 1.3) */
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/** Columns that must be present in the CSV header (case-insensitive check). */
const REQUIRED_COLUMNS = ['date', 'amount', 'description', 'category'] as const;

export interface ParseCsvResult {
  result: CsvUploadResult;
  /** Parsed transactions — only populated when result.ok === true */
  transactions: Transaction[];
}

// ── Date helpers ───────────────────────────────────────────────────────────────

/**
 * Try to parse a date string in YYYY-MM-DD or MM/DD/YYYY format.
 * Returns the normalized YYYY-MM-DD string, or null if neither format matches.
 */
function parseDate(raw: string): string | null {
  const trimmed = raw.trim();

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const d = new Date(trimmed + 'T00:00:00'); // force local midnight
    if (!isNaN(d.getTime())) return trimmed;
  }

  // MM/DD/YYYY
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed)) {
    const [month, day, year] = trimmed.split('/').map(Number);
    const d = new Date(year, month - 1, day);
    if (
      !isNaN(d.getTime()) &&
      d.getFullYear() === year &&
      d.getMonth() === month - 1 &&
      d.getDate() === day
    ) {
      const mm = String(month).padStart(2, '0');
      const dd = String(day).padStart(2, '0');
      return `${year}-${mm}-${dd}`;
    }
  }

  return null;
}

// ── Main export ────────────────────────────────────────────────────────────────

/**
 * Parse a CSV File and return a structured result plus the parsed rows.
 *
 * Validation order:
 *   1. File size ≤ 10 MB
 *   2. Required columns present
 *   3. Per-row: valid date + numeric amount (skip invalid rows)
 *   4. At least one valid row
 */
export async function parseCsv(file: File): Promise<ParseCsvResult> {
  // ── 1. File size check ──────────────────────────────────────────────────────
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      result: { ok: false, error: { type: 'file_too_large' } },
      transactions: [],
    };
  }

  // ── 2. Parse with PapaParse ─────────────────────────────────────────────────
  const parsed = await new Promise<Papa.ParseResult<Record<string, string>>>(
    (resolve) => {
      Papa.parse<Record<string, string>>(file, {
        header: true,
        skipEmptyLines: true,
        complete: resolve,
      });
    }
  );

  // ── 3. Required-column check ────────────────────────────────────────────────
  // PapaParse normalises header keys; compare case-insensitively.
  const headerKeys = (parsed.meta.fields ?? []).map((f) => f.toLowerCase());
  const missingColumns = REQUIRED_COLUMNS.filter(
    (col) => !headerKeys.includes(col)
  );

  if (missingColumns.length > 0) {
    return {
      result: {
        ok: false,
        error: { type: 'missing_columns', missingColumns },
      },
      transactions: [],
    };
  }

  // Build a mapping from lowercase column name → actual key in the parsed row
  // (handles cases where the header has mixed casing).
  const fieldMap: Record<string, string> = {};
  for (const key of parsed.meta.fields ?? []) {
    fieldMap[key.toLowerCase()] = key;
  }

  // ── 4. Row-level validation ─────────────────────────────────────────────────
  const transactions: Transaction[] = [];
  let rowsSkipped = 0;

  for (const row of parsed.data) {
    const rawDate = row[fieldMap['date']] ?? '';
    const rawAmount = row[fieldMap['amount']] ?? '';
    const rawDescription = row[fieldMap['description']] ?? '';
    const rawCategory = row[fieldMap['category']] ?? '';

    // Validate date
    const parsedDate = parseDate(rawDate);
    if (parsedDate === null) {
      rowsSkipped++;
      continue;
    }

    // Validate amount
    const amount = parseFloat(rawAmount);
    if (isNaN(amount)) {
      rowsSkipped++;
      continue;
    }

    transactions.push({
      date: parsedDate,
      amount,
      description: rawDescription.trim(),
      category: rawCategory.trim(),
    });
  }

  // ── 5. Outcome ──────────────────────────────────────────────────────────────
  if (transactions.length === 0) {
    return {
      result: { ok: false, error: { type: 'no_valid_rows' } },
      transactions: [],
    };
  }

  return {
    result: {
      ok: true,
      rowsLoaded: transactions.length,
      rowsSkipped,
    },
    transactions,
  };
}
