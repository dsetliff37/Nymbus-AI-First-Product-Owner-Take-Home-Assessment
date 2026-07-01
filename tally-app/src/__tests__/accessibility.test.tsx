/**
 * Accessibility audit tests using jest-axe (axe-core).
 *
 * Tests rendered component states for WCAG violations:
 * 1. Idle state — QueryInput + DatasetUpload
 * 2. Loading state — submitting indicator visible
 * 3. Answered state — SummaryText + ChartPanel + SourceTransactionList
 * 4. Error state — error message displayed
 * 5. Clarification state — ClarificationPanel visible
 */

import { render } from '@testing-library/react';
import { axe } from 'jest-axe';

// ── Mock recharts to avoid complex SVG DOM issues ──────────────────────────────
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  BarChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="bar-chart">{children}</div>
  ),
  Bar: () => <div data-testid="bar" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Cell: () => <div data-testid="cell" />,
  PieChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="pie-chart">{children}</div>
  ),
  Pie: () => <div data-testid="pie" />,
}));

// ── Mock the DatasetProvider context ───────────────────────────────────────────
const mockDatasetValue = {
  transactions: [
    { date: '2024-01-15', amount: -45.0, description: 'Grocery Store', category: 'Groceries' },
    { date: '2024-01-20', amount: -12.5, description: 'Coffee Shop', category: 'Dining Out' },
  ],
  categories: ['Dining Out', 'Groceries'],
  loadSampleDataset: jest.fn(),
  uploadCsv: jest.fn(),
};

jest.mock('@/src/context/DatasetProvider', () => ({
  useDataset: () => mockDatasetValue,
  DatasetProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// ── Mock useSpeechInput hook ───────────────────────────────────────────────────
jest.mock('@/src/hooks/useSpeechInput', () => ({
  useSpeechInput: () => ({
    supported: false,
    state: 'idle',
    transcript: '',
    start: jest.fn(),
    stop: jest.fn(),
    error: null,
  }),
}));

// ── Mock useTts hook ───────────────────────────────────────────────────────────
jest.mock('@/src/hooks/useTts', () => ({
  useTts: () => ({
    supported: false,
    state: 'idle' as const,
    speak: jest.fn(),
    replay: jest.fn(),
    stop: jest.fn(),
  }),
}));

// ── Import components after mocks ──────────────────────────────────────────────
import React from 'react';
import { QueryInput } from '@/src/components/QueryInput';
import { DatasetUpload } from '@/src/components/DatasetUpload';
import SummaryText from '@/src/components/SummaryText';
import ChartPanel from '@/src/components/ChartPanel';
import SourceTransactionList from '@/src/components/SourceTransactionList';
import ClarificationPanel from '@/src/components/ClarificationPanel';
import type { CalculationResult } from '@/src/types';

// ── Test data ──────────────────────────────────────────────────────────────────

const mockCalculationResult: CalculationResult = {
  intentType: 'sum',
  categories: ['Groceries'],
  timeframe: { start: '2024-01-01', end: '2024-01-31' },
  value: -45.0,
  sourceTransactions: [
    { date: '2024-01-15', amount: -45.0, description: 'Grocery Store', category: 'Groceries' },
  ],
  zeroMatch: false,
};

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('Accessibility audit (jest-axe)', () => {
  it('1. Idle state — QueryInput + DatasetUpload have no violations', async () => {
    const { container } = render(
      <div>
        <QueryInput onSubmit={jest.fn()} isLoading={false} />
        <DatasetUpload />
      </div>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('2. Loading state — submitting indicator has no violations', async () => {
    const { container } = render(
      <div>
        <QueryInput onSubmit={jest.fn()} isLoading={true} />
        <div role="status" aria-live="polite">
          Analyzing your question…
        </div>
      </div>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('3. Answered state — SummaryText + ChartPanel + SourceTransactionList have no violations', async () => {
    const { container } = render(
      <div>
        <SummaryText result={mockCalculationResult} />
        <ChartPanel result={mockCalculationResult} />
        <SourceTransactionList transactions={mockCalculationResult.sourceTransactions} />
      </div>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('4. Error state — error message has no violations', async () => {
    const { container } = render(
      <div>
        <QueryInput onSubmit={jest.fn()} isLoading={false} />
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4"
        >
          <p className="text-sm text-red-700">
            Something went wrong. Please try again.
          </p>
        </div>
      </div>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('5. Clarification state — ClarificationPanel has no violations', async () => {
    const { container } = render(
      <ClarificationPanel
        fields={['categories', 'timeframe']}
        categories={['Groceries', 'Dining Out', 'Transport']}
        round={0}
        onRespond={jest.fn()}
        onCancel={jest.fn()}
      />
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
