export interface Transaction {
  date: string;       // normalized to YYYY-MM-DD after parsing
  amount: number;     // parsed float; negative = refund
  description: string;
  category: string;   // original casing from data source, trimmed
}

export type IntentType = 'sum' | 'compare' | 'average' | 'count' | 'max' | 'min' | 'trend' | 'breakdown' | 'top_merchants' | 'monthly_average' | 'percent_of_total' | 'frequency' | 'top_category' | 'month_over_month' | 'daily_average' | 'recurring' | 'day_of_week' | 'refunds' | 'week_over_week' | 'savings_rate' | 'largest_category_transaction' | 'spending_velocity';

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

export interface TrendValues {
  periods: { label: string; total: number }[];
  direction: 'up' | 'down' | 'flat';
  changePercent: number;
}

export interface BreakdownValues {
  segments: { category: string; total: number; percent: number }[];
  grandTotal: number;
}

export interface MaxMinValues {
  transaction: Transaction;
  amount: number;
}

export interface TopMerchantsValues {
  merchants: { name: string; total: number; count: number }[];
}

export interface MonthlyAverageValues {
  monthlyAverage: number;
  months: number;
  totalSpent: number;
}

export interface PercentOfTotalValues {
  categoryTotal: number;
  grandTotal: number;
  percent: number;
}

export interface FrequencyValues {
  perWeek: number;
  perMonth: number;
  totalCount: number;
  totalDays: number;
}

export interface TopCategoryValues {
  category: string;
  total: number;
  allCategories: { category: string; total: number }[];
}

export interface MonthOverMonthValues {
  currentMonth: string;
  previousMonth: string;
  currentTotal: number;
  previousTotal: number;
  change: number;
  changePercent: number;
}

export interface DailyAverageValues {
  dailyAverage: number;
  totalSpent: number;
  totalDays: number;
}

export interface RecurringValues {
  items: { description: string; amount: number; occurrences: number; category: string }[];
  totalMonthly: number;
}

export interface DayOfWeekValues {
  days: { day: string; total: number; count: number }[];
  highestDay: string;
  highestTotal: number;
}

export interface RefundsValues {
  totalRefunds: number;
  count: number;
  transactions: Transaction[];
}

export interface WeekOverWeekValues {
  currentWeekTotal: number;
  previousWeekTotal: number;
  change: number;
  changePercent: number;
}

export interface SavingsRateValues {
  income: number;
  spending: number;
  refunds: number;
  netSpending: number;
}

export interface LargestCategoryTransactionValues {
  category: string;
  transaction: Transaction;
  amount: number;
}

export interface SpendingVelocityValues {
  dailyRate: number;
  projectedMonthly: number;
  daysElapsed: number;
}

export interface CalculationResult {
  intentType: IntentType;
  categories: string[];
  timeframe: DateRange;
  value: number | CompareValues | TrendValues | BreakdownValues | MaxMinValues | TopMerchantsValues | MonthlyAverageValues | PercentOfTotalValues | FrequencyValues | TopCategoryValues | MonthOverMonthValues | DailyAverageValues | RecurringValues | DayOfWeekValues | RefundsValues | WeekOverWeekValues | SavingsRateValues | LargestCategoryTransactionValues | SpendingVelocityValues;
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
