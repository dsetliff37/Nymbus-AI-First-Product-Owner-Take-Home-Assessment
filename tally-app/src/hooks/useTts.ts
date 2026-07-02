'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

export type TtsState = 'idle' | 'playing' | 'played' | 'error';

export interface UseTtsReturn {
  supported: boolean;
  state: TtsState;
  speak: (text: string) => void;
  replay: () => void;
  stop: () => void;
}

/**
 * React hook wrapping `window.speechSynthesis` for text-to-speech playback.
 *
 * - Degrades gracefully: if SpeechSynthesis is unavailable, `supported` is false.
 * - Prevents concurrent playback (speak is a no-op while already playing).
 * - Stores the last spoken text for replay.
 */
export function useTts(): UseTtsReturn {
  const [supported, setSupported] = useState(false);

  const [state, setState] = useState<TtsState>('idle');
  const lastTextRef = useRef<string | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Detect support after mount to avoid hydration mismatch
  useEffect(() => {
    setSupported('speechSynthesis' in window);
  }, []);

  // Cleanup on unmount: cancel any active speech
  useEffect(() => {
    return () => {
      if (supported && window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
      }
    };
  }, [supported]);

  const speak = useCallback(
    (text: string) => {
      if (!supported) return;
      // Prevent concurrent playback
      if (state === 'playing') return;

      // Cancel any lingering speech
      window.speechSynthesis.cancel();

      lastTextRef.current = text;

      const utterance = new SpeechSynthesisUtterance(text);
      utteranceRef.current = utterance;

      utterance.onend = () => {
        setState('played');
      };

      utterance.onerror = (event) => {
        // 'canceled' is not a real error — it happens when we call cancel() intentionally
        if (event.error === 'canceled') return;
        setState('error');
      };

      setState('playing');
      window.speechSynthesis.speak(utterance);
    },
    [supported, state]
  );

  const replay = useCallback(() => {
    if (!supported) return;
    if (!lastTextRef.current) return;
    // Only allow replay when in 'played' or 'error' state
    if (state !== 'played' && state !== 'error') return;

    speak(lastTextRef.current);
  }, [supported, state, speak]);

  const stop = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    // If we were playing, move to played so the replay button enables
    if (state === 'playing') {
      setState('played');
    }
  }, [supported, state]);

  return { supported, state, speak, replay, stop };
}
