/**
 * Unit tests for DatasetProvider and useDataset hook.
 *
 * Covers:
 *  - Sample dataset loaded on mount (Requirement 1.1)
 *  - `categories` is distinct, sorted, and derived from transactions (Req 1.4)
 *  - `loadSampleDataset` resets to the built-in data
 *  - `uploadCsv` updates state only on a successful parse result
 *  - `uploadCsv` retains the active dataset when the file is invalid
 *  - No data is written to localStorage / sessionStorage (Req 9.2, 9.4)
 *  - `useDataset` throws when called outside a provider
 */

import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { DatasetProvider, useDataset } from './DatasetProvider';
import { sampleTransactions } from '../data/sampleTransactions';
import * as csvParserModule from '../lib/csvParser';
import { Transaction } from '../types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function wrapper({ children }: { children: React.ReactNode }) {
  return <DatasetProvider>{children}</DatasetProvider>;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('DatasetProvider', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  // 1. Sample dataset loaded on mount
  it('loads the sample dataset on mount', async () => {
    const { result } = renderHook(() => useDataset(), { wrapper });

    await waitFor(() => {
      expect(result.current.transactions).toHaveLength(sampleTransactions.length);
    });

    expect(result.current.transactions[0]).toEqual(sampleTransactions[0]);
  });

  // 2. categories are distinct and sorted A-Z
  it('derives categories as distinct, sorted strings', async () => {
    const { result } = renderHook(() => useDataset(), { wrapper });

    await waitFor(() => {
      expect(result.current.categories.length).toBeGreaterThan(0);
    });

    const cats = result.current.categories;

    // Distinct
    expect(new Set(cats).size).toBe(cats.length);

    // Sorted ascending
    const sorted = [...cats].sort((a, b) => a.localeCompare(b));
    expect(cats).toEqual(sorted);

    // Contains the six expected categories from the sample dataset
    ['Dining Out', 'Entertainment', 'Groceries', 'Shopping', 'Transport', 'Utilities'].forEach(
      (c) => expect(cats).toContain(c),
    );
  });

  // 3. loadSampleDataset resets to the built-in data
  it('loadSampleDataset replaces current transactions with the sample set', async () => {
    const customTx: Transaction[] = [
      { date: '2024-05-01', amount: 10, description: 'Test', category: 'X' },
    ];

    // Simulate a successful upload first so we have non-sample data
    jest.spyOn(csvParserModule, 'parseCsv').mockResolvedValue({
      result: { ok: true, rowsLoaded: 1, rowsSkipped: 0 },
      transactions: customTx,
    });

    const { result } = renderHook(() => useDataset(), { wrapper });

    await act(async () => {
      await result.current.uploadCsv(new File([''], 'test.csv'));
    });

    expect(result.current.transactions).toEqual(customTx);

    // Now reset
    act(() => {
      result.current.loadSampleDataset();
    });

    expect(result.current.transactions).toEqual(sampleTransactions);
  });

  // 4. uploadCsv replaces dataset on success
  it('uploadCsv replaces the active dataset when the parse succeeds', async () => {
    const uploaded: Transaction[] = [
      { date: '2024-06-01', amount: 99.99, description: 'Uploaded tx', category: 'Groceries' },
    ];

    jest.spyOn(csvParserModule, 'parseCsv').mockResolvedValue({
      result: { ok: true, rowsLoaded: 1, rowsSkipped: 0 },
      transactions: uploaded,
    });

    const { result } = renderHook(() => useDataset(), { wrapper });

    await waitFor(() => expect(result.current.transactions.length).toBeGreaterThan(0));

    let uploadResult: Awaited<ReturnType<typeof result.current.uploadCsv>> | undefined;
    await act(async () => {
      uploadResult = await result.current.uploadCsv(new File([''], 'data.csv'));
    });

    expect(uploadResult).toEqual({ ok: true, rowsLoaded: 1, rowsSkipped: 0 });
    expect(result.current.transactions).toEqual(uploaded);
  });

  // 5. uploadCsv retains existing dataset on error
  it('uploadCsv retains the existing dataset when the parse fails', async () => {
    jest.spyOn(csvParserModule, 'parseCsv').mockResolvedValue({
      result: { ok: false, error: { type: 'no_valid_rows' } },
      transactions: [],
    });

    const { result } = renderHook(() => useDataset(), { wrapper });

    await waitFor(() => expect(result.current.transactions.length).toBeGreaterThan(0));

    const before = result.current.transactions;

    let uploadResult: Awaited<ReturnType<typeof result.current.uploadCsv>> | undefined;
    await act(async () => {
      uploadResult = await result.current.uploadCsv(new File([''], 'bad.csv'));
    });

    expect(uploadResult).toEqual({ ok: false, error: { type: 'no_valid_rows' } });
    // Dataset must remain unchanged
    expect(result.current.transactions).toEqual(before);
  });

  // 6. uploadCsv retains dataset on missing-columns error
  it('uploadCsv retains the existing dataset when columns are missing', async () => {
    jest.spyOn(csvParserModule, 'parseCsv').mockResolvedValue({
      result: { ok: false, error: { type: 'missing_columns', missingColumns: ['amount'] } },
      transactions: [],
    });

    const { result } = renderHook(() => useDataset(), { wrapper });
    await waitFor(() => expect(result.current.transactions.length).toBeGreaterThan(0));

    const before = result.current.transactions;

    await act(async () => {
      await result.current.uploadCsv(new File([''], 'missing.csv'));
    });

    expect(result.current.transactions).toEqual(before);
  });

  // 7. No data written to localStorage or sessionStorage (Req 9.2, 9.4)
  it('never writes transaction data to localStorage or sessionStorage', async () => {
    const setItemSpy = jest.spyOn(Storage.prototype, 'setItem');

    const { result } = renderHook(() => useDataset(), { wrapper });
    await waitFor(() => expect(result.current.transactions.length).toBeGreaterThan(0));

    act(() => {
      result.current.loadSampleDataset();
    });

    expect(setItemSpy).not.toHaveBeenCalled();
  });
});

// ── useDataset outside provider ────────────────────────────────────────────────

describe('useDataset outside provider', () => {
  it('throws an error when used outside a DatasetProvider', () => {
    // Suppress the expected React error boundary console output
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => renderHook(() => useDataset())).toThrow(
      'useDataset must be used within a <DatasetProvider>',
    );

    consoleSpy.mockRestore();
  });
});
