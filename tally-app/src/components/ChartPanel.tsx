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
  LineChart,
  Line,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type {
  CalculationResult,
  CompareValues,
  TrendValues,
  BreakdownValues,
  TopMerchantsValues,
  MonthlyAverageValues,
  PercentOfTotalValues,
  FrequencyValues,
  DayOfWeekValues,
  MonthOverMonthValues,
  TopCategoryValues,
} from '../types/index';

interface ChartPanelProps {
  result: CalculationResult;
}

const COLORS = [
  '#6c5ce7', '#00cec9', '#fd79a8', '#fdcb6e',
  '#00b894', '#e17055', '#0984e3', '#a29bfe',
  '#55efc4', '#fab1a0',
];

export default function ChartPanel({ result }: ChartPanelProps) {
  if (result.zeroMatch) return null;

  return (
    <div role="img" aria-label="Spending chart" className="w-full">
      {renderChart(result)}
    </div>
  );
}

function renderChart(result: CalculationResult) {
  switch (result.intentType) {
    case 'compare':
      return <CompareBarChart value={result.value as CompareValues} />;
    case 'trend':
      return <TrendLineChart value={result.value as TrendValues} />;
    case 'breakdown':
      return <BreakdownPieChart value={result.value as BreakdownValues} />;
    case 'top_merchants':
      return <MerchantBarChart value={result.value as TopMerchantsValues} />;
    case 'top_category':
      return <TopCategoryBarChart value={result.value as TopCategoryValues} />;
    case 'day_of_week':
      return <DayOfWeekChart value={result.value as DayOfWeekValues} />;
    case 'month_over_month':
      return <MonthOverMonthChart value={result.value as MonthOverMonthValues} />;
    case 'sum':
    case 'average':
    case 'monthly_average':
    case 'count':
    case 'max':
    case 'min':
    case 'percent_of_total':
    case 'frequency':
    case 'daily_average':
    case 'recurring':
    case 'refunds':
    case 'week_over_week':
    case 'savings_rate':
    case 'largest_category_transaction':
    case 'spending_velocity':
      return <SourceMonthlyChart transactions={result.sourceTransactions} />;
    default:
      return null;
  }
}

function CompareBarChart({ value }: { value: CompareValues }) {
  const data = [
    { name: value.categoryA, amount: Math.abs(value.sumA) },
    { name: value.categoryB, amount: Math.abs(value.sumB) },
  ];

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#666' }} />
        <YAxis tick={{ fontSize: 11, fill: '#999' }} tickFormatter={(v) => `$${v}`} />
        <Tooltip formatter={(val) => `$${Number(val).toFixed(2)}`} />
        <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function TrendLineChart({ value }: { value: TrendValues }) {
  const data = value.periods.map((p) => ({
    month: p.label.substring(5), // "MM" from "YYYY-MM"
    amount: Math.abs(p.total),
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#666' }} />
        <YAxis tick={{ fontSize: 11, fill: '#999' }} tickFormatter={(v) => `$${v}`} />
        <Tooltip formatter={(val) => `$${Number(val).toFixed(2)}`} />
        <Line
          type="monotone"
          dataKey="amount"
          stroke="#6c5ce7"
          strokeWidth={3}
          dot={{ fill: '#6c5ce7', r: 5 }}
          activeDot={{ r: 7, fill: '#00cec9' }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function BreakdownPieChart({ value }: { value: BreakdownValues }) {
  const data = value.segments.map((s) => ({
    name: s.category,
    value: Math.abs(s.total),
  }));

  return (
    <ResponsiveContainer width="100%" height={250}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={90}
          dataKey="value"
          nameKey="name"
          label
          labelLine={{ stroke: '#ccc' }}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(val) => `$${Number(val).toFixed(2)}`} />
        <Legend
          wrapperStyle={{ fontSize: '12px' }}
          iconType="circle"
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

function MerchantBarChart({ value }: { value: TopMerchantsValues }) {
  const data = value.merchants.slice(0, 7).map((m) => ({
    name: m.name.length > 18 ? m.name.substring(0, 16) + '…' : m.name,
    amount: Math.abs(m.total),
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11, fill: '#999' }} tickFormatter={(v) => `$${v}`} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#666' }} width={120} />
        <Tooltip formatter={(val) => `$${Number(val).toFixed(2)}`} />
        <Bar dataKey="amount" radius={[0, 6, 6, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function SourceMonthlyChart({ transactions }: { transactions: { date: string; amount: number; category?: string }[] }) {
  // If few transactions, show a category breakdown instead of monthly
  if (transactions.length <= 1) return null;

  // Group by category for a meaningful breakdown
  const catMap = new Map<string, number>();
  for (const tx of transactions) {
    const cat = (tx as { category?: string }).category || 'Other';
    catMap.set(cat, (catMap.get(cat) ?? 0) + Math.abs(tx.amount));
  }

  // If multiple categories exist, show category bars
  if (catMap.size > 1) {
    const data = Array.from(catMap.entries())
      .map(([name, amount]) => ({ name, amount: Math.round(amount * 100) / 100 }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6);

    return (
      <ResponsiveContainer width="100%" height={data.length * 36 + 30}>
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11, fill: '#999' }} tickFormatter={(v) => `$${v}`} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#666' }} width={100} />
          <Tooltip formatter={(val) => `$${Number(val).toFixed(2)}`} />
          <Bar dataKey="amount" radius={[0, 6, 6, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }

  // Otherwise group by month
  const monthMap = new Map<string, number>();
  for (const tx of transactions) {
    const month = tx.date.substring(0, 7);
    monthMap.set(month, (monthMap.get(month) ?? 0) + tx.amount);
  }

  const data = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, total]) => {
      const [y, m] = month.split('-');
      const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return { month: monthNames[parseInt(m) - 1] || m, amount: Math.abs(Math.round(total * 100) / 100) };
    });

  if (data.length <= 1) return null;

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#666' }} />
        <YAxis tick={{ fontSize: 11, fill: '#999' }} tickFormatter={(v) => `$${v}`} />
        <Tooltip formatter={(val) => `$${Number(val).toFixed(2)}`} />
        <Bar dataKey="amount" radius={[6, 6, 0, 0]} fill="url(#barGradient)">
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function TopCategoryBarChart({ value }: { value: TopCategoryValues }) {
  const data = value.allCategories.slice(0, 6).map((c) => ({
    name: c.category,
    amount: Math.abs(c.total),
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11, fill: '#999' }} tickFormatter={(v) => `$${v}`} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#666' }} width={100} />
        <Tooltip formatter={(val) => `$${Number(val).toFixed(2)}`} />
        <Bar dataKey="amount" radius={[0, 6, 6, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function DayOfWeekChart({ value }: { value: DayOfWeekValues }) {
  const data = value.days.map((d) => ({
    name: d.day.substring(0, 3),
    amount: Math.abs(d.total),
  }));

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#666' }} />
        <YAxis tick={{ fontSize: 11, fill: '#999' }} tickFormatter={(v) => `$${v}`} />
        <Tooltip formatter={(val) => `$${Number(val).toFixed(2)}`} />
        <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function MonthOverMonthChart({ value }: { value: MonthOverMonthValues }) {
  const data = [
    { name: value.previousMonth.substring(5) || 'Previous', amount: Math.abs(value.previousTotal) },
    { name: value.currentMonth.substring(5) || 'Current', amount: Math.abs(value.currentTotal) },
  ];

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#666' }} />
        <YAxis tick={{ fontSize: 11, fill: '#999' }} tickFormatter={(v) => `$${v}`} />
        <Tooltip formatter={(val) => `$${Number(val).toFixed(2)}`} />
        <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
