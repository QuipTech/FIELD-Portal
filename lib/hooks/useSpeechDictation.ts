"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// The parts of the Web Speech API used here; TypeScript's DOM types
// don't include SpeechRecognition.
interface SpeechRecognitionResultEvent {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}

interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

const findRecognition = (): SpeechRecognitionConstructor | null => {
  if (typeof window === "undefined") return null;
  const speechWindow = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
};

// Browser dictation (Chrome, Edge, Safari). Each finished phrase is passed
// to onText; isSupported is false where the browser has no speech API.
export const useSpeechDictation = (onText: (text: string) => void) => {
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  useEffect(() => {
    setIsSupported(findRecognition() !== null);
    return () => recognitionRef.current?.stop();
  }, []);

  const stop = useCallback(() => recognitionRef.current?.stop(), []);

  const start = useCallback(() => {
    const Recognition = findRecognition();
    if (!Recognition || recognitionRef.current) return;
    const recognition = new Recognition();
    recognition.lang = navigator.language || "en-AU";
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (result.isFinal) onTextRef.current(result[0].transcript.trim());
      }
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setIsListening(false);
    };
    recognition.onerror = () => recognition.stop();
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, []);

  return { isSupported, isListening, start, stop };
};
