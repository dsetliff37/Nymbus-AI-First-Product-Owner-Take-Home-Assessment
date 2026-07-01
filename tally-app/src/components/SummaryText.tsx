'use client';

import type { CalculationResult, CompareValues } from '../types/index';

interface SummaryTextProps {
  result: CalculationResult;
}

/**
 * Renders a plain-English answer sentence based on the CalculationResult.
 *
 * Validates: Requirements 6.1, 6.8
 */
export default function SummaryText({ result }: SummaryTextProps) {
  const sentence = buildSentence(result);

  return (
    <p className="text-lg font-medium text-gray-900" role="status" aria-live="polite">
      {sentence}
    </p>
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

  // Zero-match case
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

    default:
      return '';
  }
}
