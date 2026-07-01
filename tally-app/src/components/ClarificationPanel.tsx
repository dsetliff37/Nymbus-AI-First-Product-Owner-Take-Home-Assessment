'use client';

import { useState, useCallback, type FormEvent, type KeyboardEvent } from 'react';

export interface ClarificationPanelProps {
  /** The unresolved fields (e.g., 'intent_type', 'categories', 'timeframe') */
  fields: string[];
  /** Available category names from the active dataset */
  categories: string[];
  /** Current clarification round (0-based: 0 = first prompt, 1 = second prompt, >=2 = terminal) */
  round: number;
  /** Called with the user's clarification text */
  onRespond: (text: string) => void;
  /** Called when the user cancels the clarification flow */
  onCancel: () => void;
}

/**
 * ClarificationPanel — prompts the user for more information when the query
 * couldn't be fully understood. Supports up to 2 clarification rounds;
 * on round >= 2 failure, shows a terminal error message.
 *
 * Validates: Requirements 8.1–8.5
 */
export default function ClarificationPanel({
  fields,
  categories,
  round,
  onRespond,
  onCancel,
}: ClarificationPanelProps) {
  const [inputValue, setInputValue] = useState('');

  const isTerminal = round >= 2;

  const handleSubmit = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const trimmed = inputValue.trim();
      if (trimmed.length === 0 || isTerminal) return;
      onRespond(trimmed);
      setInputValue('');
    },
    [inputValue, isTerminal, onRespond]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        // Allow form's native submit behavior
      }
    },
    []
  );

  // Terminal state: round >= 2 means both clarifications failed
  if (isTerminal) {
    return (
      <div
        role="alert"
        aria-live="assertive"
        className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950"
      >
        <p className="text-sm font-medium text-red-800 dark:text-red-200">
          Sorry, I couldn&apos;t understand your question. Please try submitting a new query.
        </p>
        <button
          type="button"
          onClick={onCancel}
          className="mt-3 rounded-md bg-red-100 px-3 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:bg-red-900 dark:text-red-100 dark:hover:bg-red-800 dark:focus:ring-offset-red-950"
        >
          Start new query
        </button>
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-label="Clarification needed"
      className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950"
    >
      {/* Prompt message */}
      <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
        I need a bit more information to answer your question.
        {round === 1 && (
          <span className="ml-1 text-amber-600 dark:text-amber-400">
            (second attempt)
          </span>
        )}
      </p>

      {/* Unresolved fields */}
      {fields.length > 0 && (
        <div className="mt-2">
          <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
            Unresolved fields:
          </p>
          <ul className="mt-1 flex flex-wrap gap-1.5" aria-label="Unresolved fields">
            {fields.map((field) => (
              <li
                key={field}
                className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900 dark:text-amber-200"
              >
                {field}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Available categories */}
      {categories.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
            Available categories:
          </p>
          <ul className="mt-1 flex flex-wrap gap-1.5" aria-label="Available categories">
            {categories.map((category) => (
              <li
                key={category}
                className="rounded-full bg-white/70 px-2 py-0.5 text-xs text-amber-900 dark:bg-amber-800/50 dark:text-amber-100"
              >
                {category}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* No categories available */}
      {categories.length === 0 && (
        <p className="mt-3 text-xs italic text-amber-600 dark:text-amber-400">
          No dataset loaded — no categories available.
        </p>
      )}

      {/* Input form */}
      <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
        <label htmlFor="clarification-input" className="sr-only">
          Your clarification
        </label>
        <input
          id="clarification-input"
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your clarification here…"
          className="flex-1 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:border-amber-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-amber-500"
          aria-describedby="clarification-help"
        />
        <button
          type="submit"
          disabled={inputValue.trim().length === 0}
          className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-amber-500 dark:hover:bg-amber-600 dark:focus:ring-offset-zinc-900"
          aria-label="Submit clarification"
        >
          Submit
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium text-amber-700 transition-colors hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 dark:border-amber-700 dark:bg-zinc-900 dark:text-amber-300 dark:hover:bg-zinc-800 dark:focus:ring-offset-zinc-900"
          aria-label="Cancel clarification"
        >
          Cancel
        </button>
      </form>
      <p id="clarification-help" className="sr-only">
        Please provide additional details to help clarify your question.
      </p>
    </div>
  );
}
