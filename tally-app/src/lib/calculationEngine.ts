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
  TrendValues,
  BreakdownValues,
  MaxMinValues,
  TopMerchantsValues,
  MonthlyAverageValues,
  PercentOfTotalValues,
  FrequencyValues,
  TopCategoryValues,
  MonthOverMonthValues,
  DailyAverageValues,
  RecurringValues,
  DayOfWeekValues,
  RefundsValues,
  WeekOverWeekValues,
  SavingsRateValues,
  LargestCategoryTransactionValues,
  SpendingVelocityValues,
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

  // For these intent types, match ALL transactions in time range (ignore categories filter)
  const allCategoryIntents: ReadonlySet<string> = new Set([
    'breakdown', 'top_category', 'month_over_month', 'day_of_week',
    'refunds', 'savings_rate', 'largest_category_transaction', 'spending_velocity',
    'week_over_week',
  ]);

  // If all available categories are included, treat as "all transactions" query
  const isAllCategories = allCategoryIntents.has(intent_type) || categories.length >= 6;

  const matched = isAllCategories
    ? transactions.filter((tx) => tx.date >= start && tx.date <= end)
    : transactions.filter((tx) => matchesFilter(tx, categories, start, end));

  // 7. Zero-match guard
  const zeroMatch = matched.length === 0;

  // 8. Sort and cap source transactions
  const sourceTransactions = [...matched]
    .sort(sortTransactions)
    .slice(0, 100);

  // Compute the value based on intent type
  let value: number | CompareValues | TrendValues | BreakdownValues | MaxMinValues | TopMerchantsValues | MonthlyAverageValues | PercentOfTotalValues | FrequencyValues | TopCategoryValues | MonthOverMonthValues | DailyAverageValues | RecurringValues | DayOfWeekValues | RefundsValues | WeekOverWeekValues | SavingsRateValues | LargestCategoryTransactionValues | SpendingVelocityValues;

  if (zeroMatch) {
    if (intent_type === 'compare') {
      const catA = categories[0] ?? '';
      const catB = categories[1] ?? '';
      value = { categoryA: catA, categoryB: catB, sumA: 0, sumB: 0, difference: 0 } satisfies CompareValues;
    } else if (intent_type === 'trend') {
      value = { periods: [], direction: 'flat', changePercent: 0 } satisfies TrendValues;
    } else if (intent_type === 'breakdown') {
      value = { segments: [], grandTotal: 0 } satisfies BreakdownValues;
    } else if (intent_type === 'max' || intent_type === 'min') {
      value = { transaction: { date: '', amount: 0, description: '', category: '' }, amount: 0 } satisfies MaxMinValues;
    } else if (intent_type === 'top_merchants') {
      value = { merchants: [] } satisfies TopMerchantsValues;
    } else if (intent_type === 'monthly_average') {
      value = { monthlyAverage: 0, months: 0, totalSpent: 0 } satisfies MonthlyAverageValues;
    } else if (intent_type === 'percent_of_total') {
      value = { categoryTotal: 0, grandTotal: 0, percent: 0 } satisfies PercentOfTotalValues;
    } else if (intent_type === 'frequency') {
      value = { perWeek: 0, perMonth: 0, totalCount: 0, totalDays: 0 } satisfies FrequencyValues;
    } else if (intent_type === 'top_category') {
      value = { category: '', total: 0, allCategories: [] } satisfies TopCategoryValues;
    } else if (intent_type === 'month_over_month') {
      value = { currentMonth: '', previousMonth: '', currentTotal: 0, previousTotal: 0, change: 0, changePercent: 0 } satisfies MonthOverMonthValues;
    } else if (intent_type === 'daily_average') {
      value = { dailyAverage: 0, totalSpent: 0, totalDays: 0 } satisfies DailyAverageValues;
    } else if (intent_type === 'recurring') {
      value = { items: [], totalMonthly: 0 } satisfies RecurringValues;
    } else if (intent_type === 'day_of_week') {
      value = { days: [], highestDay: '', highestTotal: 0 } satisfies DayOfWeekValues;
    } else if (intent_type === 'refunds') {
      value = { totalRefunds: 0, count: 0, transactions: [] } satisfies RefundsValues;
    } else if (intent_type === 'week_over_week') {
      value = { currentWeekTotal: 0, previousWeekTotal: 0, change: 0, changePercent: 0 } satisfies WeekOverWeekValues;
    } else if (intent_type === 'savings_rate') {
      value = { income: 0, spending: 0, refunds: 0, netSpending: 0 } satisfies SavingsRateValues;
    } else if (intent_type === 'largest_category_transaction') {
      value = { category: '', transaction: { date: '', amount: 0, description: '', category: '' }, amount: 0 } satisfies LargestCategoryTransactionValues;
    } else if (intent_type === 'spending_velocity') {
      value = { dailyRate: 0, projectedMonthly: 0, daysElapsed: 0 } satisfies SpendingVelocityValues;
    } else {
      value = 0;
    }
  } else {
    switch (intent_type) {
      case 'sum': {
        const total = matched.reduce((acc, tx) => acc + tx.amount, 0);
        value = roundHalfUp(total);
        break;
      }

      case 'compare': {
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
        const total = matched.reduce((acc, tx) => acc + tx.amount, 0);
        value = roundHalfUp(total / matched.length);
        break;
      }

      case 'count': {
        value = matched.length;
        break;
      }

      case 'max': {
        const maxTx = matched.reduce((best, tx) => tx.amount > best.amount ? tx : best, matched[0]);
        value = { transaction: maxTx, amount: roundHalfUp(maxTx.amount) } satisfies MaxMinValues;
        break;
      }

      case 'min': {
        const minTx = matched.reduce((best, tx) => tx.amount < best.amount ? tx : best, matched[0]);
        value = { transaction: minTx, amount: roundHalfUp(minTx.amount) } satisfies MaxMinValues;
        break;
      }

      case 'trend': {
        // Group by month (YYYY-MM) and calculate totals
        const monthMap = new Map<string, number>();
        for (const tx of matched) {
          const month = tx.date.substring(0, 7); // YYYY-MM
          monthMap.set(month, (monthMap.get(month) ?? 0) + tx.amount);
        }
        const periods = Array.from(monthMap.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([label, total]) => ({ label, total: roundHalfUp(total) }));

        let direction: 'up' | 'down' | 'flat' = 'flat';
        let changePercent = 0;
        if (periods.length >= 2) {
          const first = periods[0].total;
          const last = periods[periods.length - 1].total;
          if (first !== 0) {
            changePercent = roundHalfUp(((last - first) / Math.abs(first)) * 100);
          }
          if (changePercent > 5) direction = 'up';
          else if (changePercent < -5) direction = 'down';
        }

        value = { periods, direction, changePercent } satisfies TrendValues;
        break;
      }

      case 'breakdown': {
        // Group all transactions by category
        const catMap = new Map<string, number>();
        for (const tx of matched) {
          catMap.set(tx.category, (catMap.get(tx.category) ?? 0) + tx.amount);
        }
        const grandTotal = roundHalfUp(matched.reduce((acc, tx) => acc + tx.amount, 0));
        const segments = Array.from(catMap.entries())
          .map(([category, total]) => ({
            category,
            total: roundHalfUp(total),
            percent: grandTotal !== 0 ? roundHalfUp((total / grandTotal) * 100) : 0,
          }))
          .sort((a, b) => b.total - a.total);

        value = { segments, grandTotal } satisfies BreakdownValues;
        break;
      }

      case 'top_merchants': {
        // Group by description (merchant) and rank by total spend
        const merchantMap = new Map<string, { total: number; count: number }>();
        for (const tx of matched) {
          const entry = merchantMap.get(tx.description) ?? { total: 0, count: 0 };
          entry.total += tx.amount;
          entry.count += 1;
          merchantMap.set(tx.description, entry);
        }
        const merchants = Array.from(merchantMap.entries())
          .map(([name, { total, count }]) => ({ name, total: roundHalfUp(total), count }))
          .sort((a, b) => b.total - a.total)
          .slice(0, 10);

        value = { merchants } satisfies TopMerchantsValues;
        break;
      }

      case 'monthly_average': {
        // Average spending per month in the category
        const monthSet = new Set<string>();
        let totalSpent = 0;
        for (const tx of matched) {
          monthSet.add(tx.date.substring(0, 7));
          totalSpent += tx.amount;
        }
        const months = monthSet.size || 1;
        value = {
          monthlyAverage: roundHalfUp(totalSpent / months),
          months,
          totalSpent: roundHalfUp(totalSpent),
        } satisfies MonthlyAverageValues;
        break;
      }

      case 'percent_of_total': {
        // What percent of total spending is this category?
        const categoryTotal = matched.reduce((acc, tx) => acc + tx.amount, 0);
        const allInRange = transactions.filter((tx) => tx.date >= start && tx.date <= end);
        const grandTotalAll = allInRange.reduce((acc, tx) => acc + tx.amount, 0);
        const percent = grandTotalAll !== 0 ? roundHalfUp((categoryTotal / grandTotalAll) * 100) : 0;
        value = {
          categoryTotal: roundHalfUp(categoryTotal),
          grandTotal: roundHalfUp(grandTotalAll),
          percent,
        } satisfies PercentOfTotalValues;
        break;
      }

      case 'frequency': {
        // How often do transactions occur (per week, per month)
        const totalCount = matched.length;
        const startDate = new Date(start);
        const endDate = new Date(end);
        const totalDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
        const perWeek = roundHalfUp((totalCount / totalDays) * 7);
        const perMonth = roundHalfUp((totalCount / totalDays) * 30.44);
        value = { perWeek, perMonth, totalCount, totalDays } satisfies FrequencyValues;
        break;
      }

      case 'top_category': {
        // Which category has the highest spend in the time range
        const allInRange = transactions.filter((tx) => tx.date >= start && tx.date <= end);
        const catTotals = new Map<string, number>();
        for (const tx of allInRange) {
          catTotals.set(tx.category, (catTotals.get(tx.category) ?? 0) + tx.amount);
        }
        const allCategories = Array.from(catTotals.entries())
          .map(([category, total]) => ({ category, total: roundHalfUp(total) }))
          .sort((a, b) => b.total - a.total);
        const topCat = allCategories[0] ?? { category: '', total: 0 };
        value = { category: topCat.category, total: topCat.total, allCategories } satisfies TopCategoryValues;
        break;
      }

      case 'month_over_month': {
        // Compare most recent two months of spending
        const allInRange = transactions.filter((tx) => tx.date >= start && tx.date <= end);
        const monthTotals = new Map<string, number>();
        for (const tx of allInRange) {
          const m = tx.date.substring(0, 7);
          monthTotals.set(m, (monthTotals.get(m) ?? 0) + tx.amount);
        }
        const sortedMonths = Array.from(monthTotals.entries()).sort(([a], [b]) => b.localeCompare(a));
        const currentMonth = sortedMonths[0]?.[0] ?? '';
        const previousMonth = sortedMonths[1]?.[0] ?? '';
        const currentTotal = roundHalfUp(sortedMonths[0]?.[1] ?? 0);
        const previousTotal = roundHalfUp(sortedMonths[1]?.[1] ?? 0);
        const change = roundHalfUp(currentTotal - previousTotal);
        const changePercent = previousTotal !== 0 ? roundHalfUp((change / Math.abs(previousTotal)) * 100) : 0;
        value = { currentMonth, previousMonth, currentTotal, previousTotal, change, changePercent } satisfies MonthOverMonthValues;
        break;
      }

      case 'daily_average': {
        // Average spend per day
        const totalSpent = matched.reduce((acc, tx) => acc + tx.amount, 0);
        const startDate2 = new Date(start);
        const endDate2 = new Date(end);
        const totalDays2 = Math.max(1, Math.round((endDate2.getTime() - startDate2.getTime()) / (1000 * 60 * 60 * 24)));
        value = { dailyAverage: roundHalfUp(totalSpent / totalDays2), totalSpent: roundHalfUp(totalSpent), totalDays: totalDays2 } satisfies DailyAverageValues;
        break;
      }

      case 'recurring': {
        // Find transactions that repeat (same description appears 2+ times)
        const descMap = new Map<string, { amount: number; count: number; category: string }>();
        for (const tx of matched) {
          const existing = descMap.get(tx.description);
          if (existing) {
            existing.count += 1;
          } else {
            descMap.set(tx.description, { amount: tx.amount, count: 1, category: tx.category });
          }
        }
        const items = Array.from(descMap.entries())
          .filter(([, v]) => v.count >= 2)
          .map(([description, v]) => ({ description, amount: roundHalfUp(v.amount), occurrences: v.count, category: v.category }))
          .sort((a, b) => b.occurrences - a.occurrences);
        const totalMonthly = roundHalfUp(items.reduce((acc, item) => acc + item.amount, 0));
        value = { items, totalMonthly } satisfies RecurringValues;
        break;
      }

      case 'day_of_week': {
        // Spending grouped by day of week
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayTotals = new Array(7).fill(0) as number[];
        const dayCounts = new Array(7).fill(0) as number[];
        for (const tx of matched) {
          const d = new Date(tx.date + 'T12:00:00').getDay();
          dayTotals[d] += tx.amount;
          dayCounts[d] += 1;
        }
        const days = dayNames.map((day, i) => ({ day, total: roundHalfUp(dayTotals[i]), count: dayCounts[i] }));
        const highest = days.reduce((best, d) => d.total > best.total ? d : best, days[0]);
        value = { days, highestDay: highest.day, highestTotal: highest.total } satisfies DayOfWeekValues;
        break;
      }

      case 'refunds': {
        // Sum up all negative-amount transactions (refunds)
        const allInRange = transactions.filter((tx) => tx.date >= start && tx.date <= end && tx.amount < 0);
        const totalRefunds = roundHalfUp(allInRange.reduce((acc, tx) => acc + tx.amount, 0));
        value = { totalRefunds, count: allInRange.length, transactions: allInRange.slice(0, 50) } satisfies RefundsValues;
        break;
      }

      case 'week_over_week': {
        // Compare most recent 7 days to the 7 days before that
        const endD = new Date(end);
        const currentWeekStart = new Date(endD);
        currentWeekStart.setDate(currentWeekStart.getDate() - 6);
        const prevWeekEnd = new Date(currentWeekStart);
        prevWeekEnd.setDate(prevWeekEnd.getDate() - 1);
        const prevWeekStart = new Date(prevWeekEnd);
        prevWeekStart.setDate(prevWeekStart.getDate() - 6);

        const toStr = (d: Date) => d.toISOString().substring(0, 10);
        const currentWeekTxs = matched.filter(tx => tx.date >= toStr(currentWeekStart) && tx.date <= end);
        const prevWeekTxs = matched.filter(tx => tx.date >= toStr(prevWeekStart) && tx.date <= toStr(prevWeekEnd));

        const currentWeekTotal = roundHalfUp(currentWeekTxs.reduce((acc, tx) => acc + tx.amount, 0));
        const previousWeekTotal = roundHalfUp(prevWeekTxs.reduce((acc, tx) => acc + tx.amount, 0));
        const wowChange = roundHalfUp(currentWeekTotal - previousWeekTotal);
        const wowPercent = previousWeekTotal !== 0 ? roundHalfUp((wowChange / Math.abs(previousWeekTotal)) * 100) : 0;
        value = { currentWeekTotal, previousWeekTotal, change: wowChange, changePercent: wowPercent } satisfies WeekOverWeekValues;
        break;
      }

      case 'savings_rate': {
        // Show total spending vs refunds
        const allInRange = transactions.filter((tx) => tx.date >= start && tx.date <= end);
        const spending = roundHalfUp(allInRange.filter(tx => tx.amount > 0).reduce((acc, tx) => acc + tx.amount, 0));
        const refunds = roundHalfUp(Math.abs(allInRange.filter(tx => tx.amount < 0).reduce((acc, tx) => acc + tx.amount, 0)));
        const netSpending = roundHalfUp(spending - refunds);
        value = { income: 0, spending, refunds, netSpending } satisfies SavingsRateValues;
        break;
      }

      case 'largest_category_transaction': {
        // Find the single largest transaction across all categories
        const allInRange = transactions.filter((tx) => tx.date >= start && tx.date <= end);
        if (allInRange.length === 0) {
          value = { category: '', transaction: { date: '', amount: 0, description: '', category: '' }, amount: 0 } satisfies LargestCategoryTransactionValues;
        } else {
          const largest = allInRange.reduce((best, tx) => tx.amount > best.amount ? tx : best, allInRange[0]);
          value = { category: largest.category, transaction: largest, amount: roundHalfUp(largest.amount) } satisfies LargestCategoryTransactionValues;
        }
        break;
      }

      case 'spending_velocity': {
        // Current spending rate projected to full month
        const totalSpent = matched.reduce((acc, tx) => acc + tx.amount, 0);
        const startDate3 = new Date(start);
        const endDate3 = new Date(end);
        const daysElapsed = Math.max(1, Math.round((endDate3.getTime() - startDate3.getTime()) / (1000 * 60 * 60 * 24)));
        const dailyRate = roundHalfUp(totalSpent / daysElapsed);
        const projectedMonthly = roundHalfUp(dailyRate * 30.44);
        value = { dailyRate, projectedMonthly, daysElapsed } satisfies SpendingVelocityValues;
        break;
      }

      default: {
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
