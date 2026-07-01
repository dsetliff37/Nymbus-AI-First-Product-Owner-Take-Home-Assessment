/**
 * Integration test: End-to-end query flow with mocked LLM.
 *
 * Validates: Requirements 2.1, 4.1, 5.1, 6.1
 *
 * Renders the Home page inside DatasetProvider, mocks the LLM fetch call,
 * submits a query, and asserts the full answer pipeline renders correctly.
 */

import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DatasetProvider } from '@/src/context/DatasetProvider';
import Home from '@/app/page';
import { sampleTransactions } from '@/src/data/sampleTransactions';

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Mock speechSynthesis as a stub object and SpeechRecognition as unsupported
beforeAll(() => {
  Object.defineProperty(window, 'speechSynthesis', {
    value: {
      speaking: false,
      cancel: jest.fn(),
      speak: jest.fn(),
    },
    writable: true,
    configurable: true,
  });
  Object.defineProperty(window, 'SpeechRecognition', {
    value: undefined,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(window, 'webkitSpeechRecognition', {
    value: undefined,
    writable: true,
    configurable: true,
  });
});

// Mock Recharts components to avoid jsdom rendering issues
jest.mock('recharts', () => ({
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
  Cell: () => <div />,
  PieChart: ({ children }: { children: React.ReactNode }) => <div data-testid="pie-chart">{children}</div>,
  Pie: () => <div />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderHome() {
  return render(
    <DatasetProvider>
      <Home />
    </DatasetProvider>,
  );
}

/**
 * Builds a mock fetch response that simulates the OpenAI API returning
 * a valid ParsedIntent JSON.
 */
function buildMockLlmResponse(intent: {
  intent_type: string;
  categories: string[];
  timeframe: { start: string; end: string };
}) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      choices: [
        {
          message: {
            content: JSON.stringify(intent),
          },
        },
      ],
    }),
  } as unknown as Response;
}

/**
 * Escape a string for use inside a RegExp.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Compute the expected Groceries sum from sample data in the given range.
 */
function computeExpectedGroceriesSum(): number {
  const matched = sampleTransactions.filter(
    (tx) =>
      tx.category.toLowerCase() === 'groceries' &&
      tx.date >= '2024-01-01' &&
      tx.date <= '2024-04-30',
  );
  const raw = matched.reduce((acc, tx) => acc + tx.amount, 0);
  return Math.round(raw * 100) / 100;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('End-to-end query flow', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue(
      buildMockLlmResponse({
        intent_type: 'sum',
        categories: ['Groceries'],
        timeframe: { start: '2024-01-01', end: '2024-04-30' },
      }),
    );
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('displays interpreted badge, summary text with computed sum, and source transactions after query submission', async () => {
    const user = userEvent.setup();

    await act(async () => {
      renderHome();
    });

    // Wait for sample data to load (DatasetProvider useEffect)
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/ask about your spending/i)).toBeInTheDocument();
    });

    // Type a query
    const input = screen.getByLabelText(/query input/i);
    await user.type(input, 'How much did I spend on groceries?');

    // Submit the query
    const submitButton = screen.getByLabelText(/submit query/i);
    await user.click(submitButton);

    // Wait for the answer to appear
    await waitFor(() => {
      // InterpretedQueryBadge should be visible
      expect(screen.getByText(/Calculating:/)).toBeInTheDocument();
    });

    // Assert: InterpretedQueryBadge shows intent details
    expect(screen.getByText(/total for Groceries/)).toBeInTheDocument();

    // Assert: SummaryText contains the computed sum
    const expectedSum = computeExpectedGroceriesSum();
    const formattedAmount = `$${Math.abs(expectedSum).toFixed(2)}`;
    const matchingElements = screen.getAllByText(new RegExp(escapeRegex(formattedAmount)));
    expect(matchingElements.length).toBeGreaterThan(0);
    // The SummaryText <p> should be one of the matching elements
    const summaryEl = matchingElements.find((el) => el.tagName === 'P');
    expect(summaryEl).toBeDefined();

    // Assert: SourceTransactionList is visible with rows
    const table = screen.getByRole('table');
    expect(table).toBeInTheDocument();
    // Table should have at least some grocery rows
    const rows = table.querySelectorAll('tbody tr');
    expect(rows.length).toBeGreaterThan(0);
  });

  it('clears previous answer when a new query is submitted', async () => {
    const user = userEvent.setup();

    await act(async () => {
      renderHome();
    });

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/ask about your spending/i)).toBeInTheDocument();
    });

    // First query
    const input = screen.getByLabelText(/query input/i);
    await user.type(input, 'How much did I spend on groceries?');
    await user.click(screen.getByLabelText(/submit query/i));

    // Wait for first answer
    await waitFor(() => {
      expect(screen.getByText(/Calculating:/)).toBeInTheDocument();
    });

    const expectedSum = computeExpectedGroceriesSum();
    const formattedAmount = `$${Math.abs(expectedSum).toFixed(2)}`;
    await waitFor(() => {
      const els = screen.getAllByText(new RegExp(escapeRegex(formattedAmount)));
      expect(els.length).toBeGreaterThan(0);
    });

    // Now set up the mock to delay so we can catch the "cleared" state
    let resolveSecondFetch: (value: Response) => void;
    const secondFetchPromise = new Promise<Response>((resolve) => {
      resolveSecondFetch = resolve;
    });
    (global.fetch as jest.Mock).mockReturnValueOnce(secondFetchPromise);

    // Submit a second query
    await user.clear(input);
    await user.type(input, 'Average entertainment spending');
    await user.click(screen.getByLabelText(/submit query/i));

    // Previous answer should be cleared (SummaryText gone while submitting)
    await waitFor(() => {
      expect(screen.queryAllByText(new RegExp(escapeRegex(formattedAmount)))).toHaveLength(0);
    });

    // Resolve the second fetch to complete the flow
    await act(async () => {
      resolveSecondFetch!(
        buildMockLlmResponse({
          intent_type: 'average',
          categories: ['Entertainment'],
          timeframe: { start: '2024-01-01', end: '2024-04-30' },
        }),
      );
    });

    // Wait for new answer
    await waitFor(() => {
      expect(screen.getByText(/Average spending on Entertainment/i)).toBeInTheDocument();
    });
  });
});
