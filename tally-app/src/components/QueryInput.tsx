'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useSpeechInput } from '../hooks/useSpeechInput';

const MAX_QUERY_LENGTH = 500;

export interface QueryInputProps {
  onSubmit: (query: string, source: 'text' | 'voice') => void;
  isLoading: boolean;
  disabled?: boolean;
}

export function QueryInput({ onSubmit, isLoading, disabled = false }: QueryInputProps) {
  const [query, setQuery] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [querySource, setQuerySource] = useState<'text' | 'voice'>('text');
  const inputRef = useRef<HTMLInputElement>(null);

  const speech = useSpeechInput();

  // When voice transcript finalizes, pre-populate text field but DON'T auto-submit
  useEffect(() => {
    if (speech.state === 'idle' && speech.transcript) {
      setQuery(speech.transcript);
      setQuerySource('voice');
      setValidationError(null);
      // Focus the input so user can review
      inputRef.current?.focus();
    }
  }, [speech.state, speech.transcript]);

  const validate = useCallback((text: string): string | null => {
    const trimmed = text.trim();
    if (!trimmed) {
      return 'Please enter a question before submitting.';
    }
    if (text.length > MAX_QUERY_LENGTH) {
      return `Query must be ${MAX_QUERY_LENGTH} characters or fewer (currently ${text.length}).`;
    }
    return null;
  }, []);

  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      const error = validate(query);
      if (error) {
        setValidationError(error);
        return;
      }
      setValidationError(null);
      onSubmit(query.trim(), querySource);
    },
    [query, querySource, validate, onSubmit]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setQuery(e.target.value);
      setQuerySource('text');
      if (validationError) {
        setValidationError(null);
      }
    },
    [validationError]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const handleMicClick = useCallback(() => {
    if (speech.state === 'recording' || speech.state === 'requesting_permission') {
      speech.stop();
    } else {
      speech.start();
    }
  }, [speech]);

  // Determine if mic button should be hidden
  const hideMic =
    !speech.supported || speech.error === 'permission_denied' || speech.error === 'not_supported';

  // ARIA live region text for STT state changes
  const sttAnnouncement = (() => {
    switch (speech.state) {
      case 'recording':
        return 'Voice recording started. Speak your question.';
      case 'finalizing':
        return 'Processing your speech...';
      case 'error':
        if (speech.error === 'no_speech') return 'No speech detected. Please try again.';
        if (speech.error === 'permission_denied')
          return 'Microphone access was denied. You can still type your question.';
        return 'Voice input error. You can still type your question.';
      default:
        return '';
    }
  })();

  const isRecording = speech.state === 'recording';

  return (
    <form onSubmit={handleSubmit} className="w-full" noValidate>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your spending..."
            maxLength={MAX_QUERY_LENGTH + 50} // Allow typing over to show error
            disabled={disabled || isLoading}
            aria-label="Query input"
            aria-invalid={!!validationError}
            aria-describedby={validationError ? 'query-validation-error' : undefined}
            className={`w-full rounded-lg border px-4 py-3 text-sm outline-none transition-colors
              ${validationError ? 'border-red-500 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'}
              ${disabled || isLoading ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}
            `}
          />
        </div>

        {!hideMic && (
          <button
            type="button"
            onClick={handleMicClick}
            disabled={disabled || isLoading}
            aria-label="Start voice input"
            className={`relative flex h-10 w-10 items-center justify-center rounded-full transition-colors
              ${isRecording ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}
              ${disabled || isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            {/* Mic icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-5 w-5"
            >
              <path d="M12 14a3 3 0 003-3V5a3 3 0 00-6 0v6a3 3 0 003 3z" />
              <path d="M19 11a1 1 0 10-2 0 5 5 0 01-10 0 1 1 0 10-2 0 7 7 0 006 6.93V20H8a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07A7 7 0 0019 11z" />
            </svg>

            {/* Animated recording indicator */}
            {isRecording && (
              <span className="absolute inset-0 animate-ping rounded-full bg-red-400 opacity-30" />
            )}
          </button>
        )}

        <button
          type="submit"
          disabled={disabled || isLoading}
          aria-label="Submit query"
          className={`flex h-10 items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition-colors
            ${disabled || isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700 cursor-pointer'}
          `}
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <svg
                className="h-4 w-4 animate-spin"
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
              Processing
            </span>
          ) : (
            'Ask'
          )}
        </button>
      </div>

      {/* Validation error message */}
      {validationError && (
        <p id="query-validation-error" className="mt-2 text-sm text-red-600" role="alert">
          {validationError}
        </p>
      )}

      {/* ARIA live region for STT state announcements */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {sttAnnouncement}
      </div>
    </form>
  );
}
