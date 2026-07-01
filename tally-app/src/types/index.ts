export interface Transaction {
  date: string;       // normalized to YYYY-MM-DD after parsing
  amount: number;     // parsed float; negative = refund
  description: string;
  category: string;   // original casing from data source, trimmed
}

export type IntentType = 'sum' | 'compare' | 'average' | 'count';

export interface DateRange {
  start: string;  // YYYY-MM-DD
  end: string;    // YYYY-MM-DD
}

export interface ParsedIntent {
  intent_type: IntentType;
  categories: string[];   // 1–10 items; each ≤ 100 chars
  timeframe: DateRange;
}

export interface CompareValues {
  categoryA: string;
  categoryB: string;
  sumA: number;
  sumB: number;
  difference: number;   // sumA - sumB
}

export interface CalculationResult {
  intentType: IntentType;
  categories: string[];
  timeframe: DateRange;
  value: number | CompareValues;
  sourceTransactions: Transaction[];
  zeroMatch: boolean;
}

// ── CSV Upload ─────────────────────────────────────────────────────────────────

export type CsvError =
  | { type: 'missing_columns'; missingColumns: string[] }
  | { type: 'no_valid_rows' }
  | { type: 'file_too_large' };

export type CsvUploadResult =
  | { ok: true; rowsLoaded: number; rowsSkipped: number }
  | { ok: false; error: CsvError };

// ── Dataset Context ────────────────────────────────────────────────────────────

export interface DatasetContextValue {
  transactions: Transaction[];
  /** Distinct category names from the active dataset, sorted A-Z */
  categories: string[];
  loadSampleDataset: () => void;
  uploadCsv: (file: File) => Promise<CsvUploadResult>;
}

// ── Intent Service ─────────────────────────────────────────────────────────────

export type IntentError =
  | { type: 'api_timeout' }
  | { type: 'api_failure'; statusCode?: number }
  | { type: 'missing_fields'; missingFields: string[] }
  | { type: 'unsupported_intent_type'; received: string }
  | { type: 'unresolvable_fields'; fields: string[] };

export type IntentResult =
  | { ok: true; intent: ParsedIntent }
  | { ok: false; error: IntentError };
