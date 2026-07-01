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
      className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-4 py-2 text-sm text-indigo-700 border border-indigo-200"
      role="status"
      aria-live="polite"
    >
      <span className="font-medium">Calculating:</span>
      <span>{intentLabel} for {categoryLabel} from {start} to {end}</span>
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
    default:
      return intentType;
  }
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  return `${month}/${day}/${year}`;
}
