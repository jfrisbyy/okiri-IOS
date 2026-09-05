import { useState, useRef, useCallback } from 'react';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

const TOKEN_ENDPOINT = 'https://ubclvjqvddglcsvgxlaz.supabase.co/functions/v1/gemini-live-token';
const ENV_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const FALLBACK_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InViY2x2anF2ZGRnbGNzdmd4bGF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwODIwMjUsImV4cCI6MjA4ODY1ODAyNX0.cTrafAYEUjXNPo_xwRXZr1Kj0IudkIaLQE4et6VVVc4';
const SUPABASE_ANON_KEY = (ENV_ANON_KEY && ENV_ANON_KEY.startsWith('eyJ')) ? ENV_ANON_KEY : FALLBACK_ANON_KEY;

const NATIVE_CHUNK_INTERVAL_MS = 500;
const INPUT_SAMPLE_RATE = 16000;
const OUTPUT_SAMPLE_RATE = 24000;
const TARGET_MODEL = 'gemini-2.5-flash-native-audio-preview-12-2025';

type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error';

interface GeminiLiveCallbacks {
  onInputTranscript?: (text: string) => void;
  onOutputTranscript?: (text: string) => void;
  onError?: (error: string) => void;
  onTurnComplete?: () => void;
}

function createWavHeader(pcmByteLength: number, sampleRate: number): Uint8Array {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + pcmByteLength, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, pcmByteLength, true);
  return new Uint8Array(header);
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function stripWavHeader(base64Wav: string): string {
  const binary = atob(base64Wav);
  const pcm = binary.substring(44);
  return btoa(pcm);
}

function pcmToWavBase64(pcmBase64: string, sampleRate: number): string {
  const pcmBytes = base64ToUint8(pcmBase64);
  const header = createWavHeader(pcmBytes.length, sampleRate);
  const wav = new Uint8Array(header.length + pcmBytes.length);
  wav.set(header, 0);
  wav.set(pcmBytes, header.length);
  return uint8ToBase64(wav);
}

function float32ToPcm16Base64(float32Array: Float32Array): string {
  const pcm16 = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  const bytes = new Uint8Array(pcm16.buffer);
  return uint8ToBase64(bytes);
}

function resampleFloat32(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return input;
  const ratio = fromRate / toRate;
  const outputLength = Math.round(input.length / ratio);
  const output = new Float32Array(outputLength);
  for (let i = 0; i < outputLength; i++) {
    const srcIndex = i * ratio;
    const low = Math.floor(srcIndex);
    const high = Math.min(low + 1, input.length - 1);
    const frac = srcIndex - low;
    output[i] = input[low] * (1 - frac) + input[high] * frac;
  }
  return output;
}

export function useGeminiLive(systemPrompt: string, callbacks?: GeminiLiveCallbacks) {
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [isAiSpeaking, setIsAiSpeaking] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [inputTranscript, setInputTranscript] = useState<string>('');
  const [outputTranscript, setOutputTranscript] = useState<string>('');
  const [debugLogs, setDebugLogs] = useState<string[]>([]);

  const addDebugLog = useCallback((msg: string) => {
    const ts = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const entry = `[${ts}] ${msg}`;
    console.log('[GeminiLive-DBG]', msg);
    setDebugLogs(prev => [...prev.slice(-49), entry]);
  }, []);

  const wsRef = useRef<WebSocket | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const chunkTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isStreamingRef = useRef<boolean>(false);
  const isMutedRef = useRef<boolean>(false);
  const audioBufferRef = useRef<string[]>([]);
  const soundRef = useRef<Audio.Sound | null>(null);
  const setupCompleteRef = useRef<boolean>(false);
  const systemPromptRef = useRef<string>(systemPrompt);
  systemPromptRef.current = systemPrompt;
  const callbacksRef = useRef<GeminiLiveCallbacks | undefined>(callbacks);
  callbacksRef.current = callbacks;
  const connectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const webMediaStreamRef = useRef<MediaStream | null>(null);
  const webAudioContextRef = useRef<AudioContext | null>(null);
  const webProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const webPlaybackCtxRef = useRef<AudioContext | null>(null);

  const sendAudioToWs = useCallback((pcmBase64: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    if (isMutedRef.current) return;
    if (pcmBase64.length === 0) return;

    wsRef.current.send(
      JSON.stringify({
        realtimeInput: {
          audio: {
            data: pcmBase64,
            mimeType: 'audio/pcm;rate=16000',
          },
        },
      })
    );
  }, []);

  const cleanupSound = useCallback(async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch (e) {
        console.log('[GeminiLive] Sound cleanup error:', e);
      }
      soundRef.current = null;
    }
  }, []);

  const cleanupWebAudio = useCallback(() => {
    console.log('[GeminiLive] Cleaning up web audio...');
    if (webProcessorRef.current) {
      try {
        webProcessorRef.current.disconnect();
      } catch (e) {
        console.log('[GeminiLive] Web processor disconnect error:', e);
      }
      webProcessorRef.current = null;
    }
    if (webAudioContextRef.current) {
      try {
        void webAudioContextRef.current.close();
      } catch (e) {
        console.log('[GeminiLive] Web audio context close error:', e);
      }
      webAudioContextRef.current = null;
    }
    if (webMediaStreamRef.current) {
      try {
        webMediaStreamRef.current.getTracks().forEach(track => track.stop());
      } catch (e) {
        console.log('[GeminiLive] Web media stream stop error:', e);
      }
      webMediaStreamRef.current = null;
    }
    if (webPlaybackCtxRef.current) {
      try {
        void webPlaybackCtxRef.current.close();
      } catch (e) {
        console.log('[GeminiLive] Web playback context close error:', e);
      }
      webPlaybackCtxRef.current = null;
    }
  }, []);

  const playAudioBufferWeb = useCallback(async () => {
    const chunks = audioBufferRef.current;
    if (chunks.length === 0) {
      console.log('[GeminiLive] No audio chunks to play (web)');
      setIsAiSpeaking(false);
      callbacksRef.current?.onTurnComplete?.();
      return;
    }

    console.log('[GeminiLive] Playing audio on web, chunks:', chunks.length);
    audioBufferRef.current = [];

    try {
      const decodedChunks = chunks.map(base64ToUint8);
      const totalLength = decodedChunks.reduce((sum, c) => sum + c.length, 0);
      const combinedBytes = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of decodedChunks) {
        combinedBytes.set(chunk, offset);
        offset += chunk.length;
      }

      const int16Array = new Int16Array(combinedBytes.buffer, combinedBytes.byteOffset, combinedBytes.byteLength / 2);
      const float32Array = new Float32Array(int16Array.length);
      for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768;
      }

      if (!webPlaybackCtxRef.current || webPlaybackCtxRef.current.state === 'closed') {
        webPlaybackCtxRef.current = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE });
      }
      const ctx = webPlaybackCtxRef.current;

      const audioBuffer = ctx.createBuffer(1, float32Array.length, OUTPUT_SAMPLE_RATE);
      audioBuffer.getChannelData(0).set(float32Array);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);

      setIsAiSpeaking(true);
      source.onended = () => {
        console.log('[GeminiLive] Web playback finished');
        setIsAiSpeaking(false);
        callbacksRef.current?.onTurnComplete?.();
      };
      source.start();
    } catch (err) {
      console.log('[GeminiLive] Web playback error:', err);
      setIsAiSpeaking(false);
      callbacksRef.current?.onTurnComplete?.();
    }
  }, []);

  const playAudioBufferNative = useCallback(async () => {
    const chunks = audioBufferRef.current;
    if (chunks.length === 0) {
      console.log('[GeminiLive] No audio chunks to play');
      setIsAiSpeaking(false);
      return;
    }

    console.log('[GeminiLive] Playing accumulated audio, chunks:', chunks.length);
    audioBufferRef.current = [];

    const decodedChunks = chunks.map(base64ToUint8);
    const totalLength = decodedChunks.reduce((sum, c) => sum + c.length, 0);
    const combinedBytes = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of decodedChunks) {
      combinedBytes.set(chunk, offset);
      offset += chunk.length;
    }
    const combinedPcm = uint8ToBase64(combinedBytes);

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const wavBase64 = pcmToWavBase64(combinedPcm, OUTPUT_SAMPLE_RATE);
      const filePath = `${FileSystem.cacheDirectory}gemini_live_${Date.now()}.wav`;
      await FileSystem.writeAsStringAsync(filePath, wavBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      await cleanupSound();
      const { sound } = await Audio.Sound.createAsync({ uri: filePath });
      soundRef.current = sound;

      sound.setOnPlaybackStatusUpdate((s) => {
        if (s.isLoaded && s.didJustFinish) {
          console.log('[GeminiLive] Playback finished');
          setIsAiSpeaking(false);
          soundRef.current = null;
          sound.unloadAsync().catch(() => {});
          FileSystem.deleteAsync(filePath, { idempotent: true }).catch(() => {});
          callbacksRef.current?.onTurnComplete?.();
        }
      });

      setIsAiSpeaking(true);
      await sound.playAsync();
    } catch (err) {
      console.log('[GeminiLive] Playback error:', err);
      setIsAiSpeaking(false);
      callbacksRef.current?.onTurnComplete?.();
    }
  }, [cleanupSound]);

  const playAudioBuffer = useCallback(async () => {
    if (Platform.OS === 'web') {
      await playAudioBufferWeb();
    } else {
      await playAudioBufferNative();
    }
  }, [playAudioBufferWeb, playAudioBufferNative]);

  const handleMessageRef = useRef<(event: MessageEvent) => void>(() => {});
  handleMessageRef.current = useCallback(
    (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);

        if (data.setupComplete) {
          console.log('[GeminiLive] Setup complete received!');
          addDebugLog('setupComplete RECEIVED');
          if (connectTimeoutRef.current) {
            clearTimeout(connectTimeoutRef.current);
            connectTimeoutRef.current = null;
          }
          setupCompleteRef.current = true;
          setStatus('connected');
          return;
        }

        if (data.toolCall || data.toolCallCancellation) {
          console.log('[GeminiLive] Tool call message (ignored):', JSON.stringify(data).substring(0, 200));
          return;
        }

        if (data.serverContent) {
          const sc = data.serverContent;
          const keys = Object.keys(sc).join(',');
          addDebugLog(`serverContent keys: ${keys}`);

          if (sc.modelTurn?.parts) {
            const partTypes = sc.modelTurn.parts.map((p: any) => p.inlineData ? 'audio' : p.text ? 'text' : 'other').join(',');
            addDebugLog(`modelTurn parts: ${partTypes}`);
            for (const part of sc.modelTurn.parts) {
              if (part.inlineData?.data) {
                audioBufferRef.current.push(part.inlineData.data);
              }
              if (part.text) {
                console.log('[GeminiLive] Model text:', part.text.substring(0, 80));
                setOutputTranscript(part.text);
                callbacksRef.current?.onOutputTranscript?.(part.text);
              }
            }
          }

          if (sc.inputTranscription?.text) {
            console.log('[GeminiLive] Input transcript:', sc.inputTranscription.text.substring(0, 80));
            setInputTranscript(sc.inputTranscription.text);
            callbacksRef.current?.onInputTranscript?.(sc.inputTranscription.text);
          }

          if (sc.outputTranscription?.text) {
            console.log('[GeminiLive] Output transcript:', sc.outputTranscription.text.substring(0, 80));
            setOutputTranscript(sc.outputTranscription.text);
            callbacksRef.current?.onOutputTranscript?.(sc.outputTranscription.text);
          }

          if (sc.interrupted) {
            console.log('[GeminiLive] Model interrupted by user');
            audioBufferRef.current = [];
            setIsAiSpeaking(false);
          }

          if (sc.turnComplete) {
            console.log('[GeminiLive] Turn complete, audio chunks buffered:', audioBufferRef.current.length);
            addDebugLog(`turnComplete, audioChunks: ${audioBufferRef.current.length}`);
            void playAudioBuffer();
          }
        }
      } catch (err) {
        console.log('[GeminiLive] Message parse error:', err);
        addDebugLog(`MSG PARSE ERROR: ${String(err)}`);
      }
    },
    [playAudioBuffer, addDebugLog]
  );

  const startWebStreaming = useCallback(async () => {
    console.log('[GeminiLive] Starting Web Audio streaming via ScriptProcessor...');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: { ideal: INPUT_SAMPLE_RATE },
          channelCount: { exact: 1 },
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      webMediaStreamRef.current = stream;

      const audioCtx = new AudioContext({ sampleRate: INPUT_SAMPLE_RATE });
      webAudioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const bufferSize = 4096;
      const processor = audioCtx.createScriptProcessor(bufferSize, 1, 1);
      webProcessorRef.current = processor;

      const nativeSampleRate = audioCtx.sampleRate;
      console.log('[GeminiLive] Web audio context sample rate:', nativeSampleRate, 'target:', INPUT_SAMPLE_RATE);
      void nativeSampleRate;

      processor.onaudioprocess = (e: AudioProcessingEvent) => {
        if (!isStreamingRef.current || isMutedRef.current) return;
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

        const inputData = e.inputBuffer.getChannelData(0);
        const resampled = resampleFloat32(inputData, nativeSampleRate, INPUT_SAMPLE_RATE);
        const pcmBase64 = float32ToPcm16Base64(resampled);
        sendAudioToWs(pcmBase64);
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);

      console.log('[GeminiLive] Web audio streaming started — true continuous stream, no chunks');
    } catch (err: any) {
      console.log('[GeminiLive] Web audio stream error:', err?.message || err);
      callbacksRef.current?.onError?.('Microphone access denied or unavailable');
      isStreamingRef.current = false;
    }
  }, [sendAudioToWs]);

  const stopStreamingAudio = useCallback(async () => {
    console.log('[GeminiLive] Stopping audio stream...');
    isStreamingRef.current = false;

    if (Platform.OS === 'web') {
      cleanupWebAudio();
      return;
    }

    if (chunkTimerRef.current) {
      clearInterval(chunkTimerRef.current);
      chunkTimerRef.current = null;
    }

    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
        const uri = recordingRef.current.getURI();
        if (uri) {
          FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
        }
      } catch (err) {
        console.log('[GeminiLive] Stop stream recording error:', err);
      }
      recordingRef.current = null;
    }
  }, [cleanupWebAudio]);

  const createAndStartRecording = useCallback(async (): Promise<Audio.Recording | null> => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
    } catch (e) {
      console.log('[GeminiLive] setAudioModeAsync error in chunk:', e);
    }

    try {
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync({
        isMeteringEnabled: false,
        android: {
          extension: '.wav',
          outputFormat: 2,
          audioEncoder: 1,
          sampleRate: INPUT_SAMPLE_RATE,
          numberOfChannels: 1,
          bitRate: INPUT_SAMPLE_RATE * 16,
        },
        ios: {
          extension: '.wav',
          audioQuality: 32,
          sampleRate: INPUT_SAMPLE_RATE,
          numberOfChannels: 1,
          bitRate: INPUT_SAMPLE_RATE * 16,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: 'audio/webm',
          bitsPerSecond: 128000,
        },
      });
      await rec.startAsync();
      return rec;
    } catch (e) {
      console.log('[GeminiLive] Failed to create recording:', e);
      return null;
    }
  }, []);

  const recordAndSendChunk = useCallback(async () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    if (!isStreamingRef.current) return;

    try {
      const currentRecording = recordingRef.current;
      if (!currentRecording) return;

      const newRecording = await createAndStartRecording();

      await currentRecording.stopAndUnloadAsync();
      const uri = currentRecording.getURI();

      recordingRef.current = newRecording;

      if (!isStreamingRef.current) {
        if (uri) FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
        return;
      }

      if (uri) {
        if (!isMutedRef.current) {
          const base64 = await FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          const pcmBase64 = stripWavHeader(base64);
          sendAudioToWs(pcmBase64);
        }
        FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
      }
    } catch (err) {
      console.log('[GeminiLive] Chunk recording error:', err);
    }
  }, [createAndStartRecording, sendAudioToWs]);

  const startStreamingAudio = useCallback(async () => {
    if (isStreamingRef.current) {
      console.log('[GeminiLive] Already streaming audio');
      return;
    }

    console.log('[GeminiLive] Starting continuous audio stream to Gemini...');
    isStreamingRef.current = true;

    if (Platform.OS === 'web') {
      await startWebStreaming();
      return;
    }

    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        console.log('[GeminiLive] Microphone permission denied');
        isStreamingRef.current = false;
        callbacksRef.current?.onError?.('Microphone permission denied');
        return;
      }

      const recording = await createAndStartRecording();
      if (!recording) {
        console.log('[GeminiLive] Failed to start initial recording');
        isStreamingRef.current = false;
        callbacksRef.current?.onError?.('Failed to start audio recording');
        return;
      }
      recordingRef.current = recording;

      chunkTimerRef.current = setInterval(() => {
        void recordAndSendChunk();
      }, NATIVE_CHUNK_INTERVAL_MS);

      console.log('[GeminiLive] Native audio stream started, overlap chunks every', NATIVE_CHUNK_INTERVAL_MS, 'ms');
    } catch (err) {
      console.log('[GeminiLive] Start streaming error:', err);
      isStreamingRef.current = false;
      callbacksRef.current?.onError?.('Failed to start audio stream');
    }
  }, [recordAndSendChunk, createAndStartRecording, startWebStreaming]);

  const connect = useCallback(async (overrideSystemPrompt?: string) => {
    if (wsRef.current) {
      console.log('[GeminiLive] Already connected, closing old connection first');
      wsRef.current.close();
      wsRef.current = null;
    }

    console.log('[GeminiLive] Connecting...');
    setStatus('connecting');
    audioBufferRef.current = [];
    setupCompleteRef.current = false;
    isMutedRef.current = false;
    setIsMuted(false);

    if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
    connectTimeoutRef.current = setTimeout(() => {
      if (!setupCompleteRef.current && wsRef.current) {
        console.log('[GeminiLive] CONNECTION TIMEOUT - no setupComplete after 15s, closing');
        wsRef.current.close();
        wsRef.current = null;
        setStatus('error');
        callbacksRef.current?.onError?.('Connection timed out. The Gemini Live model may be unavailable.');
      }
    }, 15000);

    try {
      if (Platform.OS !== 'web') {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
        });
      }

      console.log('[GeminiLive] Fetching WS token from:', TOKEN_ENDPOINT);
      const res = await fetch(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      });

      console.log('[GeminiLive] Token response status:', res.status);
      if (!res.ok) {
        const errText = await res.text();
        console.log('[GeminiLive] Token fetch failed:', res.status, errText);
        throw new Error(`Token fetch failed (${res.status}): ${errText}`);
      }

      const tokenData = await res.json();
      console.log('[GeminiLive] Token response keys:', Object.keys(tokenData));
      let wsUrl = tokenData?.wsUrl;
      if (!wsUrl) {
        console.log('[GeminiLive] No wsUrl in response:', JSON.stringify(tokenData).substring(0, 300));
        throw new Error('No wsUrl returned from token endpoint');
      }

      const redactedUrl = wsUrl.replace(/key=[^&]+/, 'key=REDACTED');
      console.log('[GeminiLive] WS URL (redacted):', redactedUrl);
      console.log('[GeminiLive] Using model:', TARGET_MODEL);
      addDebugLog(`WS URL: ${redactedUrl.substring(0, 80)}...`);
      addDebugLog(`Model: ${TARGET_MODEL}`);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[GeminiLive] WebSocket opened! readyState:', ws.readyState);
        addDebugLog('WS OPENED, sending setup...');
        const promptToUse = overrideSystemPrompt || systemPromptRef.current;
        const setupMsg = {
          setup: {
            model: `models/${TARGET_MODEL}`,
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: 'Aoede',
                  },
                },
              },
            },
            systemInstruction: {
              parts: [{ text: promptToUse }],
            },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
          },
        };
        console.log('[GeminiLive] Sending setup message, model:', setupMsg.setup.model);
        console.log('[GeminiLive] System prompt length:', promptToUse.length);
        ws.send(JSON.stringify(setupMsg));
        console.log('[GeminiLive] Setup message sent, waiting for setupComplete...');
        addDebugLog('Setup msg sent, waiting for setupComplete...');
      };

      ws.onmessage = async (event) => {
        try {
          let rawText: string;
          const dataType = typeof event.data === 'string' ? 'string' : event.data instanceof Blob ? 'Blob' : event.data instanceof ArrayBuffer ? 'ArrayBuffer' : typeof event.data;
          addDebugLog(`WS msg received (${dataType}, ${typeof event.data === 'string' ? event.data.length : '?'} chars)`);
          if (typeof event.data === 'string') {
            rawText = event.data;
          } else if (event.data instanceof Blob) {
            rawText = await new Response(event.data).text();
          } else if (event.data instanceof ArrayBuffer) {
            rawText = new TextDecoder().decode(event.data);
          } else {
            rawText = String(event.data);
          }
          handleMessageRef.current({ data: rawText } as MessageEvent);
        } catch (err) {
          console.log('[GeminiLive] onmessage read error:', err);
          addDebugLog(`WS msg read ERROR: ${String(err)}`);
        }
      };

      ws.onerror = (event: any) => {
        console.log('[GeminiLive] WebSocket error event:', JSON.stringify({
          message: event?.message,
          type: event?.type,
          readyState: ws.readyState,
        }));
        addDebugLog(`WS ERROR: ${event?.message || 'unknown'} (readyState=${ws.readyState})`);
        setStatus('error');
        callbacksRef.current?.onError?.('WebSocket connection error');
      };

      ws.onclose = (event) => {
        console.log('[GeminiLive] WebSocket closed, code:', event.code, 'reason:', event.reason);
        addDebugLog(`WS CLOSED code=${event.code} reason=${event.reason || 'none'}`);
        if (connectTimeoutRef.current) {
          clearTimeout(connectTimeoutRef.current);
          connectTimeoutRef.current = null;
        }
        wsRef.current = null;
        setupCompleteRef.current = false;
        void stopStreamingAudio();
        if (event.code !== 1000 && event.reason) {
          setStatus('error');
          callbacksRef.current?.onError?.(`Connection closed: ${event.reason}`);
        } else {
          setStatus('idle');
        }
      };
    } catch (err: any) {
      console.log('[GeminiLive] Connection error:', err?.message || err);
      addDebugLog(`CONNECT ERROR: ${String(err?.message || err)}`);
      if (connectTimeoutRef.current) {
        clearTimeout(connectTimeoutRef.current);
        connectTimeoutRef.current = null;
      }
      wsRef.current = null;
      setStatus('error');
      callbacksRef.current?.onError?.(err?.message || 'Connection failed');
    }
  }, [stopStreamingAudio, addDebugLog]);

  const toggleMute = useCallback(() => {
    const newMuted = !isMutedRef.current;
    isMutedRef.current = newMuted;
    setIsMuted(newMuted);
    console.log('[GeminiLive] Mute toggled:', newMuted ? 'MUTED' : 'UNMUTED');
  }, []);

  const sendText = useCallback(
    (text: string) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !setupCompleteRef.current) {
        console.log('[GeminiLive] Cannot send text - not connected');
        return;
      }

      console.log('[GeminiLive] Sending text:', text.substring(0, 80));
      wsRef.current.send(
        JSON.stringify({
          clientContent: {
            turns: [{ role: 'user', parts: [{ text }] }],
            turnComplete: true,
          },
        })
      );
    },
    []
  );

  const disconnect = useCallback(async () => {
    console.log('[GeminiLive] Disconnecting...');

    await stopStreamingAudio();
    await cleanupSound();
    cleanupWebAudio();

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    audioBufferRef.current = [];
    setupCompleteRef.current = false;
    isMutedRef.current = false;
    setStatus('idle');
    setIsAiSpeaking(false);
    setIsMuted(false);
    setInputTranscript('');
    setOutputTranscript('');
  }, [cleanupSound, stopStreamingAudio, cleanupWebAudio]);

  return {
    status,
    isAiSpeaking,
    isMuted,
    inputTranscript,
    outputTranscript,
    debugLogs,
    connect,
    disconnect,
    startStreamingAudio,
    stopStreamingAudio,
    toggleMute,
    sendText,
  };
}
