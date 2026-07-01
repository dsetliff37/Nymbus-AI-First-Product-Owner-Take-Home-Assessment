'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useDataset } from '@/src/context/DatasetProvider';
import { useTts } from '@/src/hooks/useTts';
import { interpretQuery, detectCategoryMismatches } from '@/src/services/intentService';
import { calculate } from '@/src/lib/calculationEngine';
import { QueryInput } from '@/src/components/QueryInput';
import { DatasetUpload } from '@/src/components/DatasetUpload';
import ClarificationPanel from '@/src/components/ClarificationPanel';
import InterpretedQueryBadge from '@/src/components/InterpretedQueryBadge';
import SummaryText from '@/src/components/SummaryText';
import ChartPanel from '@/src/components/ChartPanel';
import SourceTransactionList from '@/src/components/SourceTransactionList';
import { TtsControls } from '@/src/components/TtsControls';
import type { ParsedIntent, CalculationResult } from '@/src/types';

type QueryState = 'idle' | 'submitting' | 'clarifying' | 'answered' | 'error';

export default function Home() {
  const { transactions, categories } = useDataset();
  const tts = useTts();

  // ── Page-level state ───────────────────────────────────────────────────────
  const [queryState, setQueryState] = useState<QueryState>('idle');
  const [currentQuery, setCurrentQuery] = useState('');
  const [parsedIntent, setParsedIntent] = useState<ParsedIntent | null>(null);
  const [calculationResult, setCalculationResult] = useState<CalculationResult | null>(null);
  const [clarificationRound, setClarificationRound] = useState<0 | 1 | 2>(0);
  const [querySource, setQuerySource] = useState<'text' | 'voice'>('text');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [unresolvedFields, setUnresolvedFields] = useState<string[]>([]);

  // Track whether auto-play should fire for TTS
  const shouldAutoPlayRef = useRef(false);

  // ── Auto-play TTS when answered via voice ─────────────────────────────────
  useEffect(() => {
    if (queryState === 'answered' && querySource === 'voice' && calculationResult) {
      shouldAutoPlayRef.current = true;
    }
  }, [queryState, querySource, calculationResult]);

  // ── Error message builder ──────────────────────────────────────────────────
  const getErrorMessage = useCallback((error: { type: string; statusCode?: number; received?: string; missingFields?: string[]; fields?: string[] }): string => {
    switch (error.type) {
      case 'api_timeout':
        return "Couldn't reach the analysis service. Please try again.";
      case 'api_failure':
        return 'The analysis service returned an error. Please try again.';
      case 'unsupported_intent_type':
        return "That question type isn't supported yet. Try asking for a total, average, or comparison.";
      case 'missing_fields':
      case 'unresolvable_fields':
        return "I couldn't understand that question. Could you rephrase it?";
      default:
        return 'Something went wrong. Please try again.';
    }
  }, []);

  // ── Process intent after successful LLM parse ──────────────────────────────
  const processIntent = useCallback(
    (intent: ParsedIntent) => {
      const mismatches = detectCategoryMismatches(intent.categories, categories);

      if (mismatches.length > 0) {
        setParsedIntent(intent);
        setUnresolvedFields(mismatches);
        setQueryState('clarifying');
        return;
      }

      // No mismatches — calculate the result
      const result = calculate(intent, transactions);
      setParsedIntent(intent);
      setCalculationResult(result);
      setQueryState('answered');
    },
    [categories, transactions]
  );

  // ── Submit query to LLM ────────────────────────────────────────────────────
  const handleQuerySubmit = useCallback(
    async (query: string, source: 'text' | 'voice') => {
      // Reject empty/whitespace (QueryInput handles this too, but double-check)
      if (!query.trim()) return;

      // Clear previous answer (Req 6.7)
      setCalculationResult(null);
      setParsedIntent(null);
      setErrorMessage(null);
      setUnresolvedFields([]);
      setClarificationRound(0);
      shouldAutoPlayRef.current = false;

      // Set state
      setCurrentQuery(query);
      setQuerySource(source);
      setQueryState('submitting');

      try {
        const result = await interpretQuery(query, categories);

        if (!result.ok) {
          // For missing/unresolvable fields, go to clarification
          if (
            result.error.type === 'missing_fields' ||
            result.error.type === 'unresolvable_fields'
          ) {
            const fields =
              result.error.type === 'missing_fields'
                ? result.error.missingFields
                : result.error.fields;
            setUnresolvedFields(fields);
            setQueryState('clarifying');
            return;
          }

          // Other errors — show error message
          setErrorMessage(getErrorMessage(result.error));
          setQueryState('error');
          return;
        }

        // Success — process the intent
        processIntent(result.intent);
      } catch {
        setErrorMessage('Something went wrong. Please try again.');
        setQueryState('error');
      }
    },
    [categories, getErrorMessage, processIntent]
  );

  // ── Handle clarification response ─────────────────────────────────────────
  const handleClarificationRespond = useCallback(
    async (clarificationText: string) => {
      const nextRound = (clarificationRound + 1) as 0 | 1 | 2;
      setClarificationRound(nextRound);

      if (nextRound >= 2) {
        // Terminal — ClarificationPanel will show the error state
        setQueryState('clarifying');
        return;
      }

      // Re-submit combined query to LLM
      const combinedQuery = `${currentQuery}. ${clarificationText}`;
      setQueryState('submitting');

      try {
        const result = await interpretQuery(combinedQuery, categories);

        if (!result.ok) {
          if (
            result.error.type === 'missing_fields' ||
            result.error.type === 'unresolvable_fields'
          ) {
            const fields =
              result.error.type === 'missing_fields'
                ? result.error.missingFields
                : result.error.fields;
            setUnresolvedFields(fields);
            setQueryState('clarifying');
            return;
          }

          setErrorMessage(getErrorMessage(result.error));
          setQueryState('error');
          return;
        }

        processIntent(result.intent);
      } catch {
        setErrorMessage('Something went wrong. Please try again.');
        setQueryState('error');
      }
    },
    [clarificationRound, currentQuery, categories, getErrorMessage, processIntent]
  );

  // ── Handle clarification cancel ────────────────────────────────────────────
  const handleClarificationCancel = useCallback(() => {
    setQueryState('idle');
    setUnresolvedFields([]);
    setClarificationRound(0);
  }, []);

  // ── Build summary text for TTS ─────────────────────────────────────────────
  const summaryTextForTts = calculationResult
    ? buildTtsSummary(calculationResult)
    : '';

  return (
    <div className="flex flex-col flex-1 items-center bg-zinc-50 dark:bg-zinc-950 font-sans min-h-screen">
      {/* Header */}
      <header className="w-full border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
            Tally
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Ask about your spending
          </p>
        </div>
      </header>

      {/* Main content */}
      <main className="w-full max-w-3xl mx-auto px-4 py-6 flex flex-col gap-6">
        {/* Dataset upload section */}
        <DatasetUpload />

        {/* Query input */}
        <QueryInput
          onSubmit={handleQuerySubmit}
          isLoading={queryState === 'submitting'}
          disabled={false}
        />

        {/* Loading indicator */}
        {queryState === 'submitting' && (
          <div className="flex items-center gap-2 text-sm text-zinc-500" role="status" aria-live="polite">
            <svg
              className="h-4 w-4 animate-spin text-blue-600"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Analyzing your question…
          </div>
        )}

        {/* Interpreted query badge */}
        {parsedIntent && queryState !== 'submitting' && (
          <InterpretedQueryBadge intent={parsedIntent} />
        )}

        {/* Clarification panel */}
        {queryState === 'clarifying' && (
          <ClarificationPanel
            fields={unresolvedFields}
            categories={categories}
            round={clarificationRound}
            onRespond={handleClarificationRespond}
            onCancel={handleClarificationCancel}
          />
        )}

        {/* Error message */}
        {queryState === 'error' && errorMessage && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950"
          >
            <p className="text-sm text-red-700 dark:text-red-300">
              {errorMessage}
            </p>
          </div>
        )}

        {/* Answer display */}
        {queryState === 'answered' && calculationResult && (
          <div className="flex flex-col gap-4">
            <SummaryText result={calculationResult} />
            <ChartPanel result={calculationResult} />
            <SourceTransactionList transactions={calculationResult.sourceTransactions} />

            {/* TTS controls */}
            <TtsControls
              text={summaryTextForTts}
              autoPlay={shouldAutoPlayRef.current}
              supported={tts.supported}
              state={tts.state}
              speak={tts.speak}
              replay={tts.replay}
              stop={tts.stop}
            />
          </div>
        )}
      </main>
    </div>
  );
}

// ── Helper: build plain-text summary for TTS ──────────────────────────────────

function buildTtsSummary(result: CalculationResult): string {
  const { intentType, categories: cats, timeframe, value, zeroMatch } = result;
  const categoryLabel = cats.join(', ');

  if (zeroMatch) {
    return `No transactions found for ${categoryLabel}.`;
  }

  switch (intentType) {
    case 'sum': {
      const amount = value as number;
      return `You spent $${Math.abs(amount).toFixed(2)} on ${categoryLabel}.`;
    }
    case 'compare': {
      const cv = value as { categoryA: string; categoryB: string; sumA: number; sumB: number; difference: number };
      return `${cv.categoryA}: $${cv.sumA.toFixed(2)}, ${cv.categoryB}: $${cv.sumB.toFixed(2)}. Difference: $${cv.difference.toFixed(2)}.`;
    }
    case 'average': {
      const amount = value as number;
      return `Average spending on ${categoryLabel}: $${Math.abs(amount).toFixed(2)} per transaction.`;
    }
    case 'count': {
      const count = value as number;
      return `You had ${count} transactions in ${categoryLabel}.`;
    }
    default:
      return '';
  }
}
