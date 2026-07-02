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

  const [queryState, setQueryState] = useState<QueryState>('idle');
  const [currentQuery, setCurrentQuery] = useState('');
  const [parsedIntent, setParsedIntent] = useState<ParsedIntent | null>(null);
  const [calculationResult, setCalculationResult] = useState<CalculationResult | null>(null);
  const [clarificationRound, setClarificationRound] = useState<0 | 1 | 2>(0);
  const [querySource, setQuerySource] = useState<'text' | 'voice'>('text');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [unresolvedFields, setUnresolvedFields] = useState<string[]>([]);

  const shouldAutoPlayRef = useRef(false);

  useEffect(() => {
    if (queryState === 'answered' && querySource === 'voice' && calculationResult) {
      shouldAutoPlayRef.current = true;
    }
  }, [queryState, querySource, calculationResult]);

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

  const processIntent = useCallback(
    (intent: ParsedIntent) => {
      const mismatches = detectCategoryMismatches(intent.categories, categories);

      if (mismatches.length > 0) {
        setParsedIntent(intent);
        setUnresolvedFields(mismatches);
        setQueryState('clarifying');
        return;
      }

      const result = calculate(intent, transactions);
      setParsedIntent(intent);
      setCalculationResult(result);
      setQueryState('answered');
    },
    [categories, transactions]
  );

  const handleQuerySubmit = useCallback(
    async (query: string, source: 'text' | 'voice') => {
      if (!query.trim()) return;

      // Build previous context for follow-up questions
      const previousContext = calculationResult ? buildFollowUpContext(calculationResult) : undefined;

      setCalculationResult(null);
      setParsedIntent(null);
      setErrorMessage(null);
      setUnresolvedFields([]);
      setClarificationRound(0);
      shouldAutoPlayRef.current = false;

      setCurrentQuery(query);
      setQuerySource(source);
      setQueryState('submitting');

      try {
        const result = await interpretQuery(query, categories, previousContext);

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
    [categories, getErrorMessage, processIntent]
  );

  const handleClarificationRespond = useCallback(
    async (clarificationText: string) => {
      const nextRound = (clarificationRound + 1) as 0 | 1 | 2;
      setClarificationRound(nextRound);

      if (nextRound >= 2) {
        setQueryState('clarifying');
        return;
      }

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

  const handleClarificationCancel = useCallback(() => {
    setQueryState('idle');
    setUnresolvedFields([]);
    setClarificationRound(0);
  }, []);

  const summaryTextForTts = calculationResult
    ? buildTtsSummary(calculationResult)
    : '';

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-900">
      {/* Fake phone frame */}
      <div className="w-full max-w-[430px] min-h-screen relative overflow-hidden" style={{ background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 100%)' }}>

        {/* Fake banking app status bar */}
        <div className="flex items-center justify-between px-6 pt-3 pb-2">
          <span className="text-xs font-medium text-white/60">9:41</span>
          <div className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-white/60" fill="currentColor" viewBox="0 0 24 24"><path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z"/></svg>
            <svg className="w-3.5 h-3.5 text-white/60" fill="currentColor" viewBox="0 0 24 24"><path d="M15.67 4H14V2h-4v2H8.33C7.6 4 7 4.6 7 5.33v15.33C7 21.4 7.6 22 8.33 22h7.33c.74 0 1.34-.6 1.34-1.33V5.33C17 4.6 16.4 4 15.67 4z"/></svg>
          </div>
        </div>

        {/* Fake banking app nav bar */}
        <div className="flex items-center justify-between px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-[#6c5ce7] to-[#a29bfe] flex items-center justify-center">
              <span className="text-white text-sm font-bold">N</span>
            </div>
            <div>
              <p className="text-white text-sm font-semibold">Nymbus Bank</p>
              <p className="text-white/50 text-xs">Personal • Checking ****4821</p>
            </div>
          </div>
          <button className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center" aria-label="Notifications">
            <svg className="w-4 h-4 text-white/70" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
          </button>
        </div>

        {/* Fake account balance card */}
        <div className="mx-5 mb-4 rounded-2xl p-5" style={{ background: 'linear-gradient(135deg, #6c5ce7 0%, #a29bfe 50%, #00cec9 100%)' }}>
          <p className="text-white/70 text-xs font-medium uppercase tracking-wider">Available Balance</p>
          <p className="text-white text-3xl font-bold mt-1">$4,287.53</p>
          <div className="flex items-center gap-4 mt-3">
            <button className="flex items-center gap-1.5 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1.5 text-xs font-medium text-white">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M2 20h20v-4H2v4zm2-3h2v2H4v-2zM2 4v4h20V4H2zm4 3H4V5h2v2zm-4 7h20v-4H2v4zm2-3h2v2H4v-2z"/></svg>
              Activity
            </button>
            <button className="flex items-center gap-1.5 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1.5 text-xs font-medium text-white">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
              Transfer
            </button>
          </div>
        </div>

        {/* Tally feature section */}
        <div className="mx-5 mb-3">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-[#6c5ce7] to-[#00cec9] flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"/><path d="M7 9h2v2H7zm4 0h2v2h-2zm4 0h2v2h-2z"/></svg>
            </div>
            <h2 className="text-white text-sm font-semibold">Spending Insights</h2>
            <span className="ml-auto text-[10px] font-medium text-[#00cec9] bg-[#00cec9]/10 px-2 py-0.5 rounded-full">AI</span>
          </div>
        </div>

        {/* Scrollable Tally content */}
        <div className="flex-1 overflow-y-auto px-4 pb-24 flex flex-col gap-3">
          {/* Query card */}
          <div className="rounded-2xl bg-white/95 backdrop-blur-sm p-4 card-shadow">
            <QueryInput
              onSubmit={handleQuerySubmit}
              isLoading={queryState === 'submitting'}
              disabled={false}
            />
          </div>

          {/* Loading indicator */}
          {queryState === 'submitting' && (
            <div className="rounded-2xl bg-white/95 backdrop-blur-sm p-4 card-shadow flex items-center gap-3" role="status" aria-live="polite">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#6c5ce7] to-[#00cec9] flex items-center justify-center">
                <svg className="h-4 w-4 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
              <span className="text-sm font-medium text-gray-700">Analyzing your question…</span>
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
            <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 card-shadow">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-red-600 text-sm font-bold">!</span>
                </div>
                <p className="text-sm text-red-700 font-medium">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Answer display */}
          {queryState === 'answered' && calculationResult && (
            <>
              <div className="rounded-2xl bg-white/95 backdrop-blur-sm p-5 card-shadow-lg">
                <SummaryText result={calculationResult} />
              </div>
              <div className="rounded-2xl bg-white/95 backdrop-blur-sm p-5 card-shadow">
                <ChartPanel result={calculationResult} />
              </div>
              <div className="rounded-2xl bg-white/95 backdrop-blur-sm p-5 card-shadow">
                <SourceTransactionList transactions={calculationResult.sourceTransactions} />
              </div>
              <div className="rounded-2xl bg-white/95 backdrop-blur-sm p-4 card-shadow">
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
            </>
          )}

          {/* Dataset upload - collapsed at bottom */}
          <details className="rounded-2xl bg-white/95 backdrop-blur-sm card-shadow">
            <summary className="px-5 py-4 text-sm font-medium text-gray-600 cursor-pointer hover:text-[#6c5ce7] transition-colors">
              📊 Manage dataset
            </summary>
            <div className="px-5 pb-5">
              <DatasetUpload />
            </div>
          </details>
        </div>

        {/* Fake bottom tab bar */}
        <div className="absolute bottom-0 left-0 right-0 bg-[#1a1a2e]/95 backdrop-blur-lg border-t border-white/10 px-6 py-3">
          <div className="flex items-center justify-around">
            <div className="flex flex-col items-center gap-0.5">
              <svg className="w-5 h-5 text-white/40" fill="currentColor" viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
              <span className="text-[10px] text-white/40">Home</span>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <svg className="w-5 h-5 text-white/40" fill="currentColor" viewBox="0 0 24 24"><path d="M21 18v1c0 1.1-.9 2-2 2H5c-1.11 0-2-.9-2-2V5c0-1.1.89-2 2-2h14c1.1 0 2 .9 2 2v1h-9c-1.11 0-2 .9-2 2v8c0 1.1.89 2 2 2h9zm-9-2h10V8H12v8zm4-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>
              <span className="text-[10px] text-white/40">Wallet</span>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <div className="h-5 w-5 rounded-lg bg-gradient-to-br from-[#6c5ce7] to-[#00cec9] flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
              </div>
              <span className="text-[10px] text-[#6c5ce7] font-medium">Insights</span>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <svg className="w-5 h-5 text-white/40" fill="currentColor" viewBox="0 0 24 24"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>
              <span className="text-[10px] text-white/40">Settings</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function buildTtsSummary(result: CalculationResult): string {
  const { intentType, categories: cats, value, zeroMatch } = result;
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
    case 'max': {
      const mv = value as { transaction: { description: string }; amount: number };
      return `Your largest ${categoryLabel} purchase was $${Math.abs(mv.amount).toFixed(2)} at ${mv.transaction.description}.`;
    }
    case 'min': {
      const mv = value as { transaction: { description: string }; amount: number };
      return `Your smallest ${categoryLabel} purchase was $${Math.abs(mv.amount).toFixed(2)} at ${mv.transaction.description}.`;
    }
    case 'trend': {
      const tv = value as { direction: string; changePercent: number };
      return `Your ${categoryLabel} spending is trending ${tv.direction}, ${tv.changePercent > 0 ? 'up' : 'down'} ${Math.abs(tv.changePercent)} percent.`;
    }
    case 'breakdown': {
      const bv = value as { grandTotal: number; segments: { category: string; percent: number }[] };
      const top3 = bv.segments.slice(0, 3).map(s => `${s.category} at ${s.percent}%`).join(', ');
      return `Total spending: $${Math.abs(bv.grandTotal).toFixed(2)}. Top categories: ${top3}.`;
    }
    case 'top_merchants': {
      const tv = value as { merchants: { name: string; total: number; count: number }[] };
      if (tv.merchants.length === 0) return 'No merchants found.';
      const top = tv.merchants[0];
      return `Your top merchant for ${categoryLabel} is ${top.name} at $${Math.abs(top.total).toFixed(2)} across ${top.count} visits.`;
    }
    case 'monthly_average': {
      const ma = value as { monthlyAverage: number };
      return `You spend an average of $${Math.abs(ma.monthlyAverage).toFixed(2)} per month on ${categoryLabel}.`;
    }
    case 'percent_of_total': {
      const pt = value as { percent: number; categoryTotal: number };
      return `${categoryLabel} is ${pt.percent}% of your total spending at $${Math.abs(pt.categoryTotal).toFixed(2)}.`;
    }
    case 'frequency': {
      const fv = value as { perWeek: number; perMonth: number };
      return `You spend on ${categoryLabel} about ${fv.perWeek} times per week, or ${fv.perMonth} times per month.`;
    }
    case 'top_category': {
      const tc = value as { category: string; total: number };
      return `Your biggest expense category is ${tc.category} at $${Math.abs(tc.total).toFixed(2)}.`;
    }
    case 'month_over_month': {
      const mom = value as { change: number; changePercent: number; currentMonth: string; previousMonth: string };
      return `You spent $${Math.abs(mom.change).toFixed(2)} ${mom.change >= 0 ? 'more' : 'less'} in ${mom.currentMonth} vs ${mom.previousMonth}.`;
    }
    case 'daily_average': {
      const da = value as { dailyAverage: number };
      return `Your daily average spending is $${Math.abs(da.dailyAverage).toFixed(2)}.`;
    }
    case 'recurring': {
      const rc = value as { items: { description: string }[]; totalMonthly: number };
      return `You have ${rc.items.length} recurring charges totaling about $${Math.abs(rc.totalMonthly).toFixed(2)} per month.`;
    }
    case 'day_of_week': {
      const dow = value as { highestDay: string; highestTotal: number };
      return `You spend the most on ${dow.highestDay}s at $${Math.abs(dow.highestTotal).toFixed(2)}.`;
    }
    case 'refunds': {
      const rf = value as { totalRefunds: number; count: number };
      return `You received ${rf.count} refunds totaling $${Math.abs(rf.totalRefunds).toFixed(2)}.`;
    }
    case 'week_over_week': {
      const wow = value as { currentWeekTotal: number; previousWeekTotal: number; change: number };
      return `This week $${Math.abs(wow.currentWeekTotal).toFixed(2)} vs last week $${Math.abs(wow.previousWeekTotal).toFixed(2)}. ${wow.change >= 0 ? 'Up' : 'Down'} $${Math.abs(wow.change).toFixed(2)}.`;
    }
    case 'savings_rate': {
      const sr = value as { netSpending: number; refunds: number };
      return `Net spending: $${Math.abs(sr.netSpending).toFixed(2)} after $${sr.refunds.toFixed(2)} in refunds.`;
    }
    case 'largest_category_transaction': {
      const lct = value as { transaction: { description: string }; amount: number; category: string };
      return `Your biggest purchase was $${Math.abs(lct.amount).toFixed(2)} at ${lct.transaction.description} in ${lct.category}.`;
    }
    case 'spending_velocity': {
      const sv = value as { dailyRate: number; projectedMonthly: number };
      return `You're spending $${Math.abs(sv.dailyRate).toFixed(2)} per day, on pace for $${Math.abs(sv.projectedMonthly).toFixed(2)} this month.`;
    }
    default:
      return '';
  }
}

function buildFollowUpContext(result: CalculationResult): string {
  const parts: string[] = [];
  parts.push(`Previous query type: ${result.intentType}`);
  parts.push(`Categories involved: ${result.categories.join(', ')}`);
  parts.push(`Time range: ${result.timeframe.start} to ${result.timeframe.end}`);

  if (result.zeroMatch) {
    parts.push('Result: no matching transactions found');
  } else if (typeof result.value === 'number') {
    parts.push(`Result value: ${result.value}`);
  } else if ('sumA' in result.value) {
    const cv = result.value as { categoryA: string; categoryB: string; sumA: number; sumB: number };
    parts.push(`Result: ${cv.categoryA}=$${cv.sumA}, ${cv.categoryB}=$${cv.sumB}`);
  } else if ('grandTotal' in result.value && 'segments' in result.value) {
    const bv = result.value as { grandTotal: number; segments: { category: string; total: number }[] };
    parts.push(`Total: $${bv.grandTotal}. Categories: ${bv.segments.slice(0, 5).map(s => `${s.category}=$${s.total}`).join(', ')}`);
  } else if ('direction' in result.value) {
    const tv = result.value as { direction: string; changePercent: number };
    parts.push(`Trend: ${tv.direction}, change: ${tv.changePercent}%`);
  }

  parts.push(`Transactions shown: ${result.sourceTransactions.length}`);
  return parts.join('\n');
}
