'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  PieChart,
  Pie,
  ResponsiveContainer,
} from 'recharts';
import type { CalculationResult, CompareValues } from '../types/index';

interface ChartPanelProps {
  result: CalculationResult;
}

const COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899'];

/**
 * Renders a bar chart for `compare` intent or a donut/pie chart for
 * `sum`, `average`, and `count` intents using Recharts.
 *
 * Includes ARIA description listing each category + value for screen readers.
 *
 * Validates: Requirements 6.2, 6.3, 11.4
 */
export default function ChartPanel({ result }: ChartPanelProps) {
  if (result.zeroMatch) {
    return null;
  }

  const ariaDescription = buildAriaDescription(result);

  return (
    <div
      role="img"
      aria-label="Spending chart"
      aria-description={ariaDescription}
      className="w-full mt-4"
    >
      {/* Visually hidden text summary for screen readers */}
      <span className="sr-only">{ariaDescription}</span>

      {result.intentType === 'compare' ? (
        <CompareBarChart result={result} />
      ) : (
        <DonutChart result={result} />
      )}
    </div>
  );
}

function CompareBarChart({ result }: { result: CalculationResult }) {
  const cv = result.value as CompareValues;
  const data = [
    { name: cv.categoryA, value: cv.sumA },
    { name: cv.categoryB, value: cv.sumB },
  ];

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip formatter={(val) => `$${Number(val).toFixed(2)}`} />
        <Bar dataKey="value" name="Amount">
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function DonutChart({ result }: { result: CalculationResult }) {
  const numericValue = result.value as number;
  const data = result.categories.map((cat, i) => ({
    name: cat,
    value: i === 0 ? Math.abs(numericValue) : 0,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          dataKey="value"
          nameKey="name"
          label={({ name, value }) => `${name}: $${value.toFixed(2)}`}
        >
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(val) => `$${Number(val).toFixed(2)}`} />
      </PieChart>
    </ResponsiveContainer>
  );
}

function buildAriaDescription(result: CalculationResult): string {
  if (result.intentType === 'compare') {
    const cv = result.value as CompareValues;
    return `Bar chart comparing ${cv.categoryA}: $${cv.sumA.toFixed(2)} and ${cv.categoryB}: $${cv.sumB.toFixed(2)}. Difference: $${cv.difference.toFixed(2)}.`;
  }

  const numericValue = result.value as number;
  const categoryLabel = result.categories.join(', ');
  const typeLabel = result.intentType === 'sum'
    ? 'Total'
    : result.intentType === 'average'
      ? 'Average'
      : 'Count';

  return `Donut chart showing ${typeLabel} for ${categoryLabel}: $${numericValue.toFixed(2)}.`;
}
