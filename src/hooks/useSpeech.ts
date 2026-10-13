import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * useSpeechRecognition — browser Web Speech API wrapper for voice dictation.
 * Falls back gracefully where the API is unavailable (Firefox, older Safari).
 * Also exposes a device speechSynthesis speaker for reading AI replies aloud.
 */

// Minimal typings for the non-standard Web Speech API.
type SpeechRecognitionEventLike = {
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
  resultIndex: number;
};
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function isSpeechRecognitionSupported(): boolean {
  return typeof window !== 'undefined' && getRecognitionCtor() !== null;
}

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function useSpeechRecognition(opts?: { lang?: string; onFinal?: (text: string) => void }) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const onFinalRef = useRef(opts?.onFinal);
  onFinalRef.current = opts?.onFinal;

  useEffect(() => {
    setSupported(isSpeechRecognitionSupported());
  }, []);

  const stop = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      /* noop */
    }
    setListening(false);
    setInterim('');
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    try {
      const rec = new Ctor();
      rec.lang = opts?.lang || navigator.language || 'en-US';
      rec.continuous = false;
      rec.interimResults = true;
      rec.onresult = (e) => {
        let text = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          text += r[0].transcript;
          if (r.isFinal) {
            onFinalRef.current?.(r[0].transcript.trim());
            setInterim('');
            setListening(false);
            return;
          }
        }
        setInterim(text);
      };
      rec.onerror = () => {
        setListening(false);
        setInterim('');
      };
      rec.onend = () => {
        setListening(false);
        setInterim('');
      };
      recRef.current = rec;
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }, [opts?.lang]);

  useEffect(() => () => {
    try {
      recRef.current?.abort();
    } catch {
      /* noop */
    }
  }, []);

  return { supported, listening, interim, start, stop };
}

/** Device text-to-speech via the browser. Returns a controller. */
export function useDeviceSpeaker() {
  const [speaking, setSpeaking] = useState(false);

  const speak = useCallback((text: string) => {
    if (!isSpeechSynthesisSupported() || !text.trim()) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text.slice(0, 4000));
      u.onend = () => setSpeaking(false);
      u.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(u);
      setSpeaking(true);
    } catch {
      setSpeaking(false);
    }
  }, []);

  const stop = useCallback(() => {
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* noop */
    }
    setSpeaking(false);
  }, []);

  useEffect(() => () => stop(), [stop]);

  return { speaking, speak, stop };
}
