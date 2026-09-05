import { useState, useRef, useCallback } from 'react';

const DEEPGRAM_API_KEY = process.env.EXPO_PUBLIC_DEEPGRAM_API_KEY || '';

interface DeepgramResult {
  channel: {
    alternatives: Array<{
      transcript: string;
      confidence: number;
    }>;
  };
  is_final: boolean;
  speech_final: boolean;
}

interface DeepgramMessage {
  type: string;
  channel?: DeepgramResult['channel'];
  is_final?: boolean;
  speech_final?: boolean;
}

interface UseStreamingSTTOptions {
  onSpeechFinal?: (transcript: string) => void;
  silenceTimeoutMs?: number;
}

export function useStreamingSTT(options?: UseStreamingSTTOptions) {
  const [partialTranscript, setPartialTranscript] = useState<string>('');
  const [finalTranscript, setFinalTranscript] = useState<string>('');
  const [isListening, setIsListening] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const accumulatedFinalRef = useRef<string>('');
  const onSpeechFinalRef = useRef(options?.onSpeechFinal);
  onSpeechFinalRef.current = options?.onSpeechFinal;

  const silenceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silenceMs = options?.silenceTimeoutMs ?? 1500;

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
  }, []);

  const startSilenceTimer = useCallback(() => {
    clearSilenceTimer();
    silenceTimeoutRef.current = setTimeout(() => {
      const transcript = accumulatedFinalRef.current.trim();
      if (transcript && onSpeechFinalRef.current) {
        console.log('[useStreamingSTT] Silence timeout fired, transcript:', transcript);
        onSpeechFinalRef.current(transcript);
      }
    }, silenceMs);
  }, [clearSilenceTimer, silenceMs]);

  const startListening = useCallback((language: string = 'fr') => {
    if (wsRef.current) {
      console.log('[useStreamingSTT] Already connected, closing existing connection');
      wsRef.current.close();
      wsRef.current = null;
    }

    if (!DEEPGRAM_API_KEY) {
      console.log('[useStreamingSTT] No Deepgram API key configured');
      setError('Deepgram API key not configured');
      return;
    }

    console.log('[useStreamingSTT] Opening WebSocket to Deepgram, language:', language);

    setPartialTranscript('');
    setFinalTranscript('');
    setError(null);
    accumulatedFinalRef.current = '';
    clearSilenceTimer();

    const wsUrl = `wss://api.deepgram.com/v1/listen?language=${language}&model=nova-2&punctuate=true&interim_results=true&endpointing=300&smart_format=true&encoding=linear16&sample_rate=16000`;

    try {
      const ws = new WebSocket(wsUrl, ['token', DEEPGRAM_API_KEY]);

      ws.onopen = () => {
        console.log('[useStreamingSTT] WebSocket connected');
        setIsListening(true);
        setError(null);
      };

      ws.onmessage = (event: WebSocketMessageEvent) => {
        try {
          const data: DeepgramMessage = JSON.parse(event.data);

          if (data.type === 'Results' && data.channel) {
            const transcript = data.channel.alternatives?.[0]?.transcript || '';

            if (data.is_final) {
              if (transcript) {
                accumulatedFinalRef.current += (accumulatedFinalRef.current ? ' ' : '') + transcript;
                setFinalTranscript(accumulatedFinalRef.current);
                console.log('[useStreamingSTT] Final segment:', transcript);
              }
              setPartialTranscript('');

              if (data.speech_final) {
                console.log('[useStreamingSTT] Speech final detected, accumulated:', accumulatedFinalRef.current);
                const fullText = accumulatedFinalRef.current.trim();
                if (fullText && onSpeechFinalRef.current) {
                  clearSilenceTimer();
                  onSpeechFinalRef.current(fullText);
                }
              } else if (accumulatedFinalRef.current.trim()) {
                startSilenceTimer();
              }
            } else {
              setPartialTranscript(transcript);
              if (transcript) {
                clearSilenceTimer();
              }
            }
          }
        } catch (parseError) {
          console.log('[useStreamingSTT] Error parsing message:', parseError);
        }
      };

      ws.onerror = (event: Event) => {
        console.log('[useStreamingSTT] WebSocket error:', event);
        setError('Connection error');
        setIsListening(false);
        clearSilenceTimer();
      };

      ws.onclose = (event: WebSocketCloseEvent) => {
        console.log('[useStreamingSTT] WebSocket closed, code:', event.code, 'reason:', event.reason);
        setIsListening(false);
        wsRef.current = null;
        clearSilenceTimer();
      };

      wsRef.current = ws;
    } catch (err) {
      console.log('[useStreamingSTT] Error creating WebSocket:', err);
      setError('Failed to connect');
      setIsListening(false);
    }
  }, [clearSilenceTimer, startSilenceTimer]);

  const stopListening = useCallback(() => {
    console.log('[useStreamingSTT] Stopping listening');
    clearSilenceTimer();

    if (wsRef.current) {
      try {
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'CloseStream' }));
        }
        wsRef.current.close();
      } catch (err) {
        console.log('[useStreamingSTT] Error closing WebSocket:', err);
      }
      wsRef.current = null;
    }

    setIsListening(false);
  }, [clearSilenceTimer]);

  const sendAudioChunk = useCallback((audioData: ArrayBuffer | Uint8Array) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      const buffer = audioData instanceof ArrayBuffer ? audioData : (audioData as Uint8Array).buffer;
      wsRef.current.send(buffer as ArrayBuffer);
    } catch (err) {
      console.log('[useStreamingSTT] Error sending audio chunk:', err);
    }
  }, []);

  const resetTranscript = useCallback(() => {
    setPartialTranscript('');
    setFinalTranscript('');
    accumulatedFinalRef.current = '';
    clearSilenceTimer();
  }, [clearSilenceTimer]);

  const getFullTranscript = useCallback((): string => {
    const final = accumulatedFinalRef.current;
    const partial = partialTranscript;
    return (final + (partial ? ' ' + partial : '')).trim();
  }, [partialTranscript]);

  return {
    startListening,
    stopListening,
    sendAudioChunk,
    resetTranscript,
    getFullTranscript,
    partialTranscript,
    finalTranscript,
    isListening,
    error,
  };
}
