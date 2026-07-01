'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

export type SpeechInputState =
  | 'idle'
  | 'requesting_permission'
  | 'recording'
  | 'finalizing'
  | 'error';

export type SpeechInputError =
  | 'permission_denied'
  | 'not_supported'
  | 'no_speech'
  | 'init_failed';

export interface UseSpeechInputReturn {
  supported: boolean;
  state: SpeechInputState;
  transcript: string;
  start: () => void;
  stop: () => void;
  error: SpeechInputError | null;
}

const SILENCE_TIMEOUT_MS = 1500;
const NO_SPEECH_TIMEOUT_MS = 10000;

function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(
    (window as unknown as Record<string, unknown>).SpeechRecognition ||
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition
  );
}

function createSpeechRecognition(): SpeechRecognition | null {
  if (typeof window === 'undefined') return null;
  const SpeechRecognitionCtor =
    (window as unknown as { SpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition ||
    (window as unknown as { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition;
  if (!SpeechRecognitionCtor) return null;
  return new SpeechRecognitionCtor();
}

export function useSpeechInput(): UseSpeechInputReturn {
  const [supported] = useState<boolean>(() => isSpeechRecognitionSupported());
  const [state, setState] = useState<SpeechInputState>('idle');
  const [transcript, setTranscript] = useState<string>('');
  const [error, setError] = useState<SpeechInputError | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noSpeechTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasReceivedResultRef = useRef<boolean>(false);

  const clearTimers = useCallback(() => {
    if (silenceTimerRef.current !== null) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (noSpeechTimerRef.current !== null) {
      clearTimeout(noSpeechTimerRef.current);
      noSpeechTimerRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    clearTimers();
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, [clearTimers]);

  const start = useCallback(() => {
    if (!supported) {
      setError('not_supported');
      setState('error');
      return;
    }

    // Reset state
    setError(null);
    setTranscript('');
    hasReceivedResultRef.current = false;
    setState('requesting_permission');

    const recognition = createSpeechRecognition();
    if (!recognition) {
      setError('init_failed');
      setState('error');
      return;
    }

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setState('recording');
      // Start no-speech timeout
      noSpeechTimerRef.current = setTimeout(() => {
        if (!hasReceivedResultRef.current) {
          setError('no_speech');
          setState('error');
          recognition.stop();
        }
      }, NO_SPEECH_TIMEOUT_MS);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      hasReceivedResultRef.current = true;

      // Clear no-speech timer since we got a result
      if (noSpeechTimerRef.current !== null) {
        clearTimeout(noSpeechTimerRef.current);
        noSpeechTimerRef.current = null;
      }

      // Build transcript from all results
      let finalTranscript = '';
      let interimTranscript = '';
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }
      setTranscript(finalTranscript || interimTranscript);

      // Reset silence timer on each result
      if (silenceTimerRef.current !== null) {
        clearTimeout(silenceTimerRef.current);
      }
      silenceTimerRef.current = setTimeout(() => {
        setState('finalizing');
        recognition.stop();
      }, SILENCE_TIMEOUT_MS);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      clearTimers();
      if (event.error === 'not-allowed') {
        setError('permission_denied');
      } else if (event.error === 'no-speech') {
        setError('no_speech');
      } else {
        setError('init_failed');
      }
      setState('error');
    };

    recognition.onend = () => {
      clearTimers();
      // Only transition to idle if not already in error state
      setState((prev) => (prev === 'error' ? prev : 'idle'));
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch {
      setError('init_failed');
      setState('error');
      recognitionRef.current = null;
    }
  }, [supported, clearTimers]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimers();
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [clearTimers]);

  return {
    supported,
    state,
    transcript,
    start,
    stop,
    error,
  };
}
