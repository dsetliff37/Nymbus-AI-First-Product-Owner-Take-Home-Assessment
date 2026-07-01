/**
 * Unit tests for the Calculation Engine
 *
 * Validates: Requirements 5.1–5.8
 */

import { calculate } from '../calculationEngine';
import type { Transaction, ParsedIntent } from '../../types/index';

// ---------------------------------------------------------------------------
// Shared test data
// ---------------------------------------------------------------------------

const baseTransactions: Transaction[] = [
  { date: '2024-03-15', amount: 45.50, description: 'Weekly groceries', category: 'Groceries' },
  { date: '2024-03-10', amount: 12.99, description: 'Coffee shop', category: 'Dining Out' },
  { date: '2024-03-08', amount: 78.20, description: 'Gas station', category: 'Transport' },
  { date: '2024-03-15', amount: 22.00, description: 'Bus pass', category: 'Transport' },
  { date: '2024-03-01', amount: 150.00, description: 'Big grocery haul', category: 'Groceries' },
  { date: '2024-03-20', amount: 9.99, description: 'Streaming service', category: 'Entertainment' },
  { date: '2024-03-12', amount: 33.50, description: 'Lunch meeting', category: 'Dining Out' },
];

const defaultTimeframe = { start: '2024-03-01', end: '2024-03-31' };

// ---------------------------------------------------------------------------
// Test cases
// ---------------------------------------------------------------------------

describe('Calculation Engine — unit tests', () => {
  describe('sum intent', () => {
    it('returns the correct sum of matching transactions', () => {
      const intent: ParsedIntent = {
        intent_type: 'sum',
        categories: ['Groceries'],
        timeframe: defaultTimeframe,
      };

      const result = calculate(intent, baseTransactions);

      // 45.50 + 150.00 = 195.50
      expect(result.value).toBe(195.50);
      expect(result.intentType).toBe('sum');
      expect(result.zeroMatch).toBe(false);
    });
  });

  describe('average intent', () => {
    it('returns the correct mean rounded to 2 decimal places', () => {
      const intent: ParsedIntent = {
        intent_type: 'average',
        categories: ['Dining Out'],
        timeframe: defaultTimeframe,
      };

      const result = calculate(intent, baseTransactions);

      // (12.99 + 33.50) / 2 = 23.245 → rounded half-up = 23.25
      expect(result.value).toBe(23.25);
      expect(result.intentType).toBe('average');
      expect(result.zeroMatch).toBe(false);
    });
  });

  describe('compare intent', () => {
    it('returns correct sumA, sumB, and difference', () => {
      const intent: ParsedIntent = {
        intent_type: 'compare',
        categories: ['Groceries', 'Transport'],
        timeframe: defaultTimeframe,
      };

      const result = calculate(intent, baseTransactions);

      // Groceries: 45.50 + 150.00 = 195.50
      // Transport: 78.20 + 22.00 = 100.20
      // Difference: 195.50 - 100.20 = 95.30
      expect(result.value).toEqual({
        categoryA: 'Groceries',
        categoryB: 'Transport',
        sumA: 195.50,
        sumB: 100.20,
        difference: 95.30,
      });
      expect(result.intentType).toBe('compare');
      expect(result.zeroMatch).toBe(false);
    });
  });

  describe('count intent', () => {
    it('returns the exact count of matching transactions', () => {
      const intent: ParsedIntent = {
        intent_type: 'count',
        categories: ['Transport'],
        timeframe: defaultTimeframe,
      };

      const result = calculate(intent, baseTransactions);

      // Two transport transactions
      expect(result.value).toBe(2);
      expect(result.intentType).toBe('count');
      expect(result.zeroMatch).toBe(false);
    });
  });

  describe('zero-match', () => {
    it('returns 0 and sets zeroMatch true when no transactions match', () => {
      const intent: ParsedIntent = {
        intent_type: 'sum',
        categories: ['NonExistentCategory'],
        timeframe: defaultTimeframe,
      };

      const result = calculate(intent, baseTransactions);

      expect(result.value).toBe(0);
      expect(result.zeroMatch).toBe(true);
      expect(result.sourceTransactions).toHaveLength(0);
    });
  });

  describe('source transaction cap', () => {
    it('caps sourceTransactions at 100 even when more match', () => {
      // Create 150 matching transactions
      const manyTransactions: Transaction[] = Array.from({ length: 150 }, (_, i) => ({
        date: '2024-03-15',
        amount: 10 + i,
        description: `Item ${String(i).padStart(3, '0')}`,
        category: 'Groceries',
      }));

      const intent: ParsedIntent = {
        intent_type: 'count',
        categories: ['Groceries'],
        timeframe: defaultTimeframe,
      };

      const result = calculate(intent, manyTransactions);

      expect(result.value).toBe(150); // count is all matches
      expect(result.sourceTransactions).toHaveLength(100);
    });
  });

  describe('sorting', () => {
    it('sorts source transactions most-recent first, with alphabetical tiebreaker on same date', () => {
      const transactions: Transaction[] = [
        { date: '2024-03-10', amount: 5.00, description: 'Zebra store', category: 'Shopping' },
        { date: '2024-03-15', amount: 20.00, description: 'Banana shop', category: 'Shopping' },
        { date: '2024-03-15', amount: 15.00, description: 'Apple market', category: 'Shopping' },
        { date: '2024-03-01', amount: 8.00, description: 'Corner shop', category: 'Shopping' },
      ];

      const intent: ParsedIntent = {
        intent_type: 'sum',
        categories: ['Shopping'],
        timeframe: defaultTimeframe,
      };

      const result = calculate(intent, transactions);

      // Most recent first (2024-03-15), then alpha tiebreaker: Apple < Banana
      // Then 2024-03-10, then 2024-03-01
      expect(result.sourceTransactions.map((t) => t.description)).toEqual([
        'Apple market',
        'Banana shop',
        'Zebra store',
        'Corner shop',
      ]);
    });
  });
});
