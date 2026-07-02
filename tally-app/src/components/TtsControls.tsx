'use client';

import React, { useEffect, useRef } from 'react';
import type { TtsState } from '../hooks/useTts';

export interface TtsControlsProps {
  /** The text to speak */
  text: string;
  /** Whether to auto-play the text on mount / text change */
  autoPlay: boolean;
  /** Whether TTS is supported in this browser */
  supported: boolean;
  /** Current TTS state */
  state: TtsState;
  /** Speak the given text */
  speak: (text: string) => void;
  /** Replay the last spoken text */
  replay: () => void;
  /** Stop current speech */
  stop: () => void;
}

/**
 * TTS playback controls: audio indicator + replay button.
 *
 * - Hidden entirely when TTS is not supported (Req 7.8).
 * - Auto-plays on voice queries when `autoPlay` is true (Req 7.1).
 * - Replay button is disabled during playback to prevent concurrent speech (Req 7.5).
 * - Replay button is enabled when state is 'played' or 'error' (Req 7.6, 7.7).
 * - Keyboard accessible (Req 11.5).
 */
export function TtsControls({
  text,
  autoPlay,
  supported,
  state,
  speak,
  replay,
  stop,
}: TtsControlsProps) {
  const hasAutoPlayedRef = useRef(false);

  // Auto-play when text arrives and autoPlay is true
  useEffect(() => {
    if (autoPlay && supported && text && !hasAutoPlayedRef.current) {
      hasAutoPlayedRef.current = true;
      speak(text);
    }
  }, [autoPlay, supported, text, speak]);

  // Reset auto-play flag when text changes
  useEffect(() => {
    hasAutoPlayedRef.current = false;
  }, [text]);

  // Don't render anything if TTS is not supported (Req 7.8)
  if (!supported) {
    return null;
  }

  const showIndicator = state === 'playing' || state === 'played';
  const replayEnabled = state === 'played' || state === 'error';

  return (
    <div className="flex items-center gap-3" role="group" aria-label="Audio playback controls">
      {/* Audio indicator */}
      {showIndicator && (
        <span
          className={`inline-flex items-center gap-1.5 text-sm ${
            state === 'playing'
              ? 'text-[#6c5ce7] animate-pulse'
              : 'text-gray-400'
          }`}
          aria-live="polite"
          aria-atomic="true"
        >
          {/* Speaker icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-4 h-4"
            aria-hidden="true"
          >
            <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 001.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06z" />
            {state === 'playing' && (
              <>
                <path d="M15.932 7.757a.75.75 0 011.061 0 6 6 0 010 8.486.75.75 0 01-1.06-1.061 4.5 4.5 0 000-6.364.75.75 0 010-1.06z" />
                <path d="M18.348 5.34a.75.75 0 011.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 11-1.06-1.061 8.25 8.25 0 000-11.668.75.75 0 010-1.06z" />
              </>
            )}
          </svg>
          <span className="sr-only">
            {state === 'playing' ? 'Audio playing' : 'Audio played'}
          </span>
        </span>
      )}

      {/* Replay button */}
      <button
        type="button"
        onClick={() => replay()}
        disabled={!replayEnabled}
        aria-label="Replay answer"
        className={`inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-[#6c5ce7] focus:ring-offset-2 ${
          replayEnabled
            ? 'bg-[#6c5ce7]/10 text-[#6c5ce7] hover:bg-[#6c5ce7]/20 cursor-pointer'
            : 'bg-gray-100 text-gray-300 cursor-not-allowed'
        }`}
      >
        {/* Replay icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="w-4 h-4 mr-1"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H4.598a.75.75 0 00-.75.75v3.634a.75.75 0 001.5 0v-2.033l.312.311a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm-1.375-5.848a7 7 0 00-11.712 3.138.75.75 0 001.449.39 5.5 5.5 0 019.201-2.466l.312.311H10.754a.75.75 0 000 1.5h3.634a.75.75 0 00.75-.75V4.065a.75.75 0 00-1.5 0v2.033l-.312-.311.001-.002z"
            clipRule="evenodd"
          />
        </svg>
        Replay
      </button>
    </div>
  );
}
