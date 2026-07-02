'use client';

import type { ParsedIntent } from '../types/index';

interface InterpretedQueryBadgeProps {
  intent: ParsedIntent;
}

/**
 * Shows what Tally will calculate:
 * "Calculating: [intent_type] for [categories] from [start] to [end]"
 *
 * Validates: Requirements 4.3, 6.6
 */
export default function InterpretedQueryBadge({ intent }: InterpretedQueryBadgeProps) {
  const { intent_type, categories, timeframe } = intent;
  const categoryLabel = categories.join(', ');
  const start = formatDate(timeframe.start);
  const end = formatDate(timeframe.end);

  const intentLabel = getIntentLabel(intent_type);

  return (
    <div
      className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#6c5ce7]/10 to-[#00cec9]/10 px-4 py-2.5 text-sm text-[#6c5ce7] border border-[#6c5ce7]/15"
      role="status"
      aria-live="polite"
    >
      <span className="font-semibold">Calculating:</span>
      <span className="text-gray-700">{intentLabel} for {categoryLabel} from {start} to {end}</span>
    </div>
  );
}

function getIntentLabel(intentType: string): string {
  switch (intentType) {
    case 'sum':
      return 'total';
    case 'compare':
      return 'comparison';
    case 'average':
      return 'average';
    case 'count':
      return 'count';
    case 'max':
      return 'largest';
    case 'min':
      return 'smallest';
    case 'trend':
      return 'trend';
    case 'breakdown':
      return 'breakdown';
    case 'top_merchants':
      return 'top merchants';
    case 'monthly_average':
      return 'monthly average';
    case 'percent_of_total':
      return '% of total';
    case 'frequency':
      return 'frequency';
    case 'top_category':
      return 'top category';
    case 'month_over_month':
      return 'month vs month';
    case 'daily_average':
      return 'daily average';
    case 'recurring':
      return 'recurring';
    case 'day_of_week':
      return 'by weekday';
    case 'refunds':
      return 'refunds';
    case 'week_over_week':
      return 'week vs week';
    case 'savings_rate':
      return 'net spending';
    case 'largest_category_transaction':
      return 'biggest purchase';
    case 'spending_velocity':
      return 'spending pace';
    default:
      return intentType;
  }
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  return `${month}/${day}/${year}`;
}
