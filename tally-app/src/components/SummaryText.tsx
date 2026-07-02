'use client';

import type { CalculationResult, CompareValues, TrendValues, BreakdownValues, MaxMinValues, TopMerchantsValues, MonthlyAverageValues, PercentOfTotalValues, FrequencyValues, TopCategoryValues, MonthOverMonthValues, DailyAverageValues, RecurringValues, DayOfWeekValues, RefundsValues, WeekOverWeekValues, SavingsRateValues, LargestCategoryTransactionValues, SpendingVelocityValues } from '../types/index';

interface SummaryTextProps {
  result: CalculationResult;
}

/**
 * Renders a plain-English answer sentence based on the CalculationResult.
 */
export default function SummaryText({ result }: SummaryTextProps) {
  const sentence = buildSentence(result);

  return (
    <div role="status" aria-live="polite">
      <p className="text-xs font-medium uppercase tracking-wider text-[#6c5ce7] mb-2">Answer</p>
      <p className="text-lg font-semibold text-gray-800 leading-relaxed">
        {sentence}
      </p>
      {result.intentType === 'trend' && !result.zeroMatch && (
        <TrendDetail value={result.value as TrendValues} />
      )}
      {result.intentType === 'breakdown' && !result.zeroMatch && (
        <BreakdownDetail value={result.value as BreakdownValues} />
      )}
      {result.intentType === 'recurring' && !result.zeroMatch && (
        <RecurringDetail value={result.value as RecurringValues} />
      )}
      {result.intentType === 'day_of_week' && !result.zeroMatch && (
        <DayOfWeekDetail value={result.value as DayOfWeekValues} />
      )}
      {result.intentType === 'top_category' && !result.zeroMatch && (
        <TopCategoryDetail value={result.value as TopCategoryValues} />
      )}
    </div>
  );
}

function TrendDetail({ value }: { value: TrendValues }) {
  return (
    <div className="mt-3 space-y-1.5">
      {value.periods.map((p) => (
        <div key={p.label} className="flex items-center justify-between text-sm">
          <span className="text-gray-500">{p.label}</span>
          <span className="font-medium text-gray-800">{formatCurrency(p.total)}</span>
        </div>
      ))}
    </div>
  );
}

function BreakdownDetail({ value }: { value: BreakdownValues }) {
  return (
    <div className="mt-3 space-y-2">
      {value.segments.map((s) => (
        <div key={s.category} className="flex items-center gap-2">
          <div className="flex-1">
            <div className="flex justify-between text-sm mb-0.5">
              <span className="text-gray-700 font-medium">{s.category}</span>
              <span className="text-gray-500">{s.percent}%</span>
            </div>
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#6c5ce7] to-[#00cec9]"
                style={{ width: `${Math.min(s.percent, 100)}%` }}
              />
            </div>
          </div>
          <span className="text-sm font-medium text-gray-800 w-16 text-right">{formatCurrency(s.total)}</span>
        </div>
      ))}
    </div>
  );
}

function formatCurrency(amount: number): string {
  return `$${Math.abs(amount).toFixed(2)}`;
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  return `${month}/${day}/${year}`;
}

function buildSentence(result: CalculationResult): string {
  const { intentType, categories, timeframe, value, zeroMatch } = result;
  const start = formatDate(timeframe.start);
  const end = formatDate(timeframe.end);
  const categoryLabel = categories.join(', ');

  if (zeroMatch) {
    return `No transactions found for ${categoryLabel} in ${start} to ${end}.`;
  }

  switch (intentType) {
    case 'sum': {
      const amount = value as number;
      return `You spent ${formatCurrency(amount)} on ${categoryLabel} from ${start} to ${end}.`;
    }

    case 'compare': {
      const cv = value as CompareValues;
      return `${cv.categoryA} (${formatCurrency(cv.sumA)}) vs ${cv.categoryB} (${formatCurrency(cv.sumB)}) — difference: ${formatCurrency(cv.difference)}`;
    }

    case 'average': {
      const amount = value as number;
      return `Average spending on ${categoryLabel}: ${formatCurrency(amount)} per transaction.`;
    }

    case 'count': {
      const count = value as number;
      return `You had ${count} transactions in ${categoryLabel} from ${start} to ${end}.`;
    }

    case 'max': {
      const mv = value as MaxMinValues;
      return `Your largest ${categoryLabel} purchase was ${formatCurrency(mv.amount)} at ${mv.transaction.description} on ${formatDate(mv.transaction.date)}.`;
    }

    case 'min': {
      const mv = value as MaxMinValues;
      return `Your smallest ${categoryLabel} purchase was ${formatCurrency(mv.amount)} at ${mv.transaction.description} on ${formatDate(mv.transaction.date)}.`;
    }

    case 'trend': {
      const tv = value as TrendValues;
      const arrow = tv.direction === 'up' ? '↑' : tv.direction === 'down' ? '↓' : '→';
      return `${categoryLabel} spending is trending ${tv.direction} ${arrow} (${tv.changePercent > 0 ? '+' : ''}${tv.changePercent}% over the period).`;
    }

    case 'breakdown': {
      const bv = value as BreakdownValues;
      return `Total spending: ${formatCurrency(bv.grandTotal)} across ${bv.segments.length} categories.`;
    }

    case 'top_merchants': {
      const tv = value as TopMerchantsValues;
      if (tv.merchants.length === 0) return 'No merchants found.';
      const top = tv.merchants[0];
      return `Your top merchant for ${categoryLabel} is ${top.name} at ${formatCurrency(top.total)} (${top.count} visits).`;
    }

    case 'monthly_average': {
      const ma = value as MonthlyAverageValues;
      return `You spend an average of ${formatCurrency(ma.monthlyAverage)} per month on ${categoryLabel} (${ma.months} months, ${formatCurrency(ma.totalSpent)} total).`;
    }

    case 'percent_of_total': {
      const pt = value as PercentOfTotalValues;
      return `${categoryLabel} makes up ${pt.percent}% of your total spending (${formatCurrency(pt.categoryTotal)} of ${formatCurrency(pt.grandTotal)}).`;
    }

    case 'frequency': {
      const fv = value as FrequencyValues;
      return `You spend on ${categoryLabel} about ${fv.perWeek}x per week (${fv.perMonth}x per month, ${fv.totalCount} transactions total).`;
    }

    case 'top_category': {
      const tc = value as TopCategoryValues;
      return `Your biggest expense category is ${tc.category} at ${formatCurrency(tc.total)}.`;
    }

    case 'month_over_month': {
      const mom = value as MonthOverMonthValues;
      const direction = mom.change >= 0 ? 'more' : 'less';
      return `You spent ${formatCurrency(Math.abs(mom.change))} ${direction} in ${mom.currentMonth} vs ${mom.previousMonth} (${mom.changePercent > 0 ? '+' : ''}${mom.changePercent}%).`;
    }

    case 'daily_average': {
      const da = value as DailyAverageValues;
      return `Your daily average spending is ${formatCurrency(da.dailyAverage)} (${formatCurrency(da.totalSpent)} over ${da.totalDays} days).`;
    }

    case 'recurring': {
      const rc = value as RecurringValues;
      if (rc.items.length === 0) return 'No recurring charges found in this period.';
      return `You have ${rc.items.length} recurring charges totaling ~${formatCurrency(rc.totalMonthly)}/month.`;
    }

    case 'day_of_week': {
      const dow = value as DayOfWeekValues;
      return `You spend the most on ${dow.highestDay}s (${formatCurrency(dow.highestTotal)}).`;
    }

    case 'refunds': {
      const rf = value as RefundsValues;
      return `You received ${rf.count} refund${rf.count !== 1 ? 's' : ''} totaling ${formatCurrency(Math.abs(rf.totalRefunds))}.`;
    }

    case 'week_over_week': {
      const wow = value as WeekOverWeekValues;
      const dir = wow.change >= 0 ? 'more' : 'less';
      return `This week: ${formatCurrency(wow.currentWeekTotal)} vs last week: ${formatCurrency(wow.previousWeekTotal)} — ${formatCurrency(Math.abs(wow.change))} ${dir} (${wow.changePercent > 0 ? '+' : ''}${wow.changePercent}%).`;
    }

    case 'savings_rate': {
      const sr = value as SavingsRateValues;
      return `Gross spending: ${formatCurrency(sr.spending)}, refunds received: ${formatCurrency(sr.refunds)}, net spending: ${formatCurrency(sr.netSpending)}.`;
    }

    case 'largest_category_transaction': {
      const lct = value as LargestCategoryTransactionValues;
      return `Your biggest purchase was ${formatCurrency(lct.amount)} at ${lct.transaction.description} (${lct.category}) on ${formatDate(lct.transaction.date)}.`;
    }

    case 'spending_velocity': {
      const sv = value as SpendingVelocityValues;
      return `You're spending ${formatCurrency(sv.dailyRate)}/day. At this pace you'll spend ~${formatCurrency(sv.projectedMonthly)} this month.`;
    }

    default:
      return '';
  }
}

function RecurringDetail({ value }: { value: RecurringValues }) {
  return (
    <div className="mt-3 space-y-2">
      {value.items.slice(0, 8).map((item) => (
        <div key={item.description} className="flex items-center justify-between text-sm">
          <div>
            <span className="font-medium text-gray-700">{item.description}</span>
            <span className="text-gray-400 ml-2 text-xs">{item.category} • {item.occurrences}x</span>
          </div>
          <span className="font-medium text-gray-800">{formatCurrency(item.amount)}</span>
        </div>
      ))}
    </div>
  );
}

function DayOfWeekDetail({ value }: { value: DayOfWeekValues }) {
  const maxTotal = Math.max(...value.days.map(d => d.total));
  return (
    <div className="mt-3 space-y-1.5">
      {value.days.map((d) => (
        <div key={d.day} className="flex items-center gap-2 text-sm">
          <span className="w-12 text-gray-500 text-xs">{d.day.substring(0, 3)}</span>
          <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#6c5ce7] to-[#00cec9]"
              style={{ width: `${maxTotal > 0 ? (d.total / maxTotal) * 100 : 0}%` }}
            />
          </div>
          <span className="text-xs text-gray-600 w-14 text-right">{formatCurrency(d.total)}</span>
        </div>
      ))}
    </div>
  );
}

function TopCategoryDetail({ value }: { value: TopCategoryValues }) {
  const maxTotal = value.allCategories[0]?.total ?? 1;
  return (
    <div className="mt-3 space-y-2">
      {value.allCategories.slice(0, 6).map((c) => (
        <div key={c.category} className="flex items-center gap-2">
          <div className="flex-1">
            <div className="flex justify-between text-sm mb-0.5">
              <span className="text-gray-700 font-medium">{c.category}</span>
              <span className="text-gray-600">{formatCurrency(c.total)}</span>
            </div>
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#6c5ce7] to-[#00cec9]"
                style={{ width: `${(c.total / maxTotal) * 100}%` }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
