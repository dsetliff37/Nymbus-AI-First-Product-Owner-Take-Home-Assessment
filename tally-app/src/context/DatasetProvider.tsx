'use client';

/**
 * DatasetProvider
 *
 * Holds the active Transaction[] in React state and exposes it — along with
 * derived category names — via the DatasetContext.
 *
 * Privacy guarantees (Requirements 9.2, 9.4):
 *  - Transaction data is NEVER written to localStorage, sessionStorage, or
 *    any server-side store.  It lives exclusively in React component state and
 *    is discarded when the tab/session ends.
 *
 * Loads the built-in sample dataset automatically on mount (Requirement 1.1).
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { sampleTransactions } from '../data/sampleTransactions';
import { parseCsv } from '../lib/csvParser';
import { DatasetContextValue, Transaction } from '../types';

// ── Context ────────────────────────────────────────────────────────────────────

const DatasetContext = createContext<DatasetContextValue | null>(null);

// ── Provider ───────────────────────────────────────────────────────────────────

export function DatasetProvider({ children }: { children: React.ReactNode }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // ── Load sample dataset on mount (Requirement 1.1) ───────────────────────
  useEffect(() => {
    setTransactions(sampleTransactions);
  }, []);

  // ── Derived: distinct sorted category names (Requirement 1.4 / design) ───
  const categories = useMemo<string[]>(() => {
    const seen = new Set<string>();
    for (const tx of transactions) {
      seen.add(tx.category);
    }
    return Array.from(seen).sort((a, b) => a.localeCompare(b));
  }, [transactions]);

  // ── loadSampleDataset ────────────────────────────────────────────────────
  const loadSampleDataset = useCallback(() => {
    setTransactions(sampleTransactions);
  }, []);

  // ── uploadCsv ────────────────────────────────────────────────────────────
  // Privacy: we only update in-memory React state; nothing is persisted
  // (Requirements 9.2, 9.4).
  const uploadCsv = useCallback(async (file: File) => {
    const { result, transactions: parsed } = await parseCsv(file);
    if (result.ok) {
      // Replace the active dataset only on a fully successful parse
      // (Requirement 1.4).  On error the existing dataset is retained
      // (Requirements 1.5, 1.6).
      setTransactions(parsed);
    }
    return result;
  }, []);

  const value: DatasetContextValue = useMemo(
    () => ({ transactions, categories, loadSampleDataset, uploadCsv }),
    [transactions, categories, loadSampleDataset, uploadCsv],
  );

  return (
    <DatasetContext.Provider value={value}>{children}</DatasetContext.Provider>
  );
}

// ── Consumer hook ──────────────────────────────────────────────────────────────

/**
 * useDataset — consume the DatasetContext.
 *
 * Must be called inside a <DatasetProvider> subtree.
 *
 * @throws if called outside of a DatasetProvider
 */
export function useDataset(): DatasetContextValue {
  const ctx = useContext(DatasetContext);
  if (ctx === null) {
    throw new Error('useDataset must be used within a <DatasetProvider>');
  }
  return ctx;
}
