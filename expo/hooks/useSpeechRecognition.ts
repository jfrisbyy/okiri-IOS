import { useState, useRef, useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';

const STT_URL = 'https://toolkit.rork.com/stt/transcribe/';
const SEGMENT_DURATION_MS = 3000;

interface UseSpeechRecognitionReturn {
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  startListening: () => void;
  stopListening: () => void;
  stopAndGetAudio: () => Promise<{ base64: string; mimeType: string } | null>;
  resetTranscript: () => void;
  isSupported: boolean;
  error: string | null;
  getRecordedAudioSegments: () => string[];
}

export function useSpeechRecognition(): UseSpeechRecognitionReturn {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  const isWeb = Platform.OS === 'web';

  // Web refs
  const recognitionRef = useRef<any>(null);
  const shouldRestartRef = useRef(false);

  // Native refs
  const nativeRecordingRef = useRef<Audio.Recording | null>(null);
  const segmentIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isProcessingSegmentRef = useRef(false);
  const isNativeListeningRef = useRef(false);
  const permissionGrantedRef = useRef(false);
  const segmentAudioRef = useRef<string[]>([]);

  useEffect(() => {
    if (isWeb) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      setIsSupported(!!SpeechRecognition);
    } else {
      setIsSupported(true);
    }
  }, [isWeb]);

  // ==================== WEB IMPLEMENTATION ====================

  const createRecognition = useCallback(() => {
    if (typeof window === 'undefined') return null;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return null;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'fr-FR';
    recognition.maxAlternatives = 3;

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interim = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript + ' ';
        } else {
          interim += result[0].transcript;
        }
      }

      if (finalTranscript) {
        setTranscript(prev => prev + finalTranscript);
      }
      setInterimTranscript(interim);
    };

    recognition.onerror = (event: any) => {
      console.log('Speech recognition error:', event.error);
      if (event.error === 'no-speech' || event.error === 'aborted') {
        return;
      }
      setError(event.error);
    };

    recognition.onend = () => {
      if (shouldRestartRef.current) {
        try {
          recognition.start();
        } catch (e) {
          console.log('Failed to restart recognition:', e);
          setIsListening(false);
        }
      } else {
        setIsListening(false);
      }
    };

    return recognition;
  }, []);

  const startWebListening = useCallback(() => {
    setError(null);

    if (!recognitionRef.current) {
      recognitionRef.current = createRecognition();
    }

    if (!recognitionRef.current) {
      setError('Speech recognition not supported in this browser');
      return;
    }

    shouldRestartRef.current = true;

    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch (e: any) {
      if (e.name === 'InvalidStateError') {
        recognitionRef.current.stop();
        setTimeout(() => {
          try {
            recognitionRef.current.start();
            setIsListening(true);
          } catch {
            setError('Failed to start speech recognition');
          }
        }, 100);
      } else {
        setError('Failed to start speech recognition');
      }
    }
  }, [createRecognition]);

  const stopWebListening = useCallback(() => {
    shouldRestartRef.current = false;

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.log('Error stopping recognition:', e);
      }
    }

    setIsListening(false);
    setInterimTranscript('');
  }, []);

  // ==================== NATIVE IMPLEMENTATION ====================

  const startNativeSegment = useCallback(async (): Promise<Audio.Recording | null> => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync({
        android: {
          extension: '.m4a',
          outputFormat: 2,
          audioEncoder: 3,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        ios: {
          extension: '.wav',
          outputFormat: 'lpcm' as any,
          audioQuality: 96,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {},
      });

      console.log('[STT] Started new native recording segment');
      return recording;
    } catch (e) {
      console.log('[STT] Failed to start native recording segment:', e);
      return null;
    }
  }, []);

  const transcribeSegment = useCallback(async (recording: Audio.Recording): Promise<string> => {
    try {
      const status = await recording.getStatusAsync();
      if (!status.isRecording && !status.isDoneRecording) {
        console.log('[STT] Recording not in valid state, skipping transcription');
        return '';
      }

      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();

      if (!uri) {
        console.log('[STT] No URI from recording');
        return '';
      }

      console.log('[STT] Transcribing segment from URI:', uri);

      if (Platform.OS !== 'web') {
        try {
          const base64 = await FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          const ext = uri.split('.').pop() || 'wav';
          const mimeType = ext === 'm4a' ? 'audio/mp4' : `audio/${ext}`;
          segmentAudioRef.current.push(`data:${mimeType};base64,${base64}`);
          if (segmentAudioRef.current.length > 30) {
            segmentAudioRef.current = segmentAudioRef.current.slice(-30);
          }
          console.log('[STT] Saved audio segment for playback, total segments:', segmentAudioRef.current.length);
        } catch (e) {
          console.log('[STT] Failed to save audio segment for playback:', e);
        }
      }

      const uriParts = uri.split('.');
      const fileType = uriParts[uriParts.length - 1];

      const formData = new FormData();
      formData.append('audio', {
        uri,
        name: `recording.${fileType}`,
        type: `audio/${fileType}`,
      } as any);
      formData.append('language', 'fr');

      const response = await fetch(STT_URL, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'unknown');
        console.log('[STT] API error:', response.status, errorText);
        return '';
      }

      const result = await response.json();
      console.log('[STT] Transcription result:', result.text);
      return result.text || '';
    } catch (e) {
      console.log('[STT] Transcription error:', e);
      return '';
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const processNativeSegment = useCallback(async () => {
    if (isProcessingSegmentRef.current || !isNativeListeningRef.current) {
      return;
    }
    isProcessingSegmentRef.current = true;

    try {
      const oldRecording = nativeRecordingRef.current;
      if (!oldRecording) {
        isProcessingSegmentRef.current = false;
        return;
      }

      nativeRecordingRef.current = null;

      const newRecording = await startNativeSegment();
      if (newRecording && isNativeListeningRef.current) {
        nativeRecordingRef.current = newRecording;
      } else if (newRecording && !isNativeListeningRef.current) {
        try {
          await newRecording.stopAndUnloadAsync();
        } catch {}
      }

      setInterimTranscript('Transcribing...');
      const text = await transcribeSegment(oldRecording);

      if (text.trim() && isNativeListeningRef.current) {
        setTranscript(prev => {
          const updated = prev + (prev ? ' ' : '') + text.trim();
          console.log('[STT] Updated transcript:', updated);
          return updated;
        });
      } else if (text.trim()) {
        setTranscript(prev => prev + (prev ? ' ' : '') + text.trim());
      }

      setInterimTranscript('');
    } catch (e) {
      console.log('[STT] Segment processing error:', e);
      setInterimTranscript('');
    } finally {
      isProcessingSegmentRef.current = false;
    }
  }, [startNativeSegment, transcribeSegment]);

  const startNativeListening = useCallback(async () => {
    setError(null);

    if (!permissionGrantedRef.current) {
      try {
        const permission = await Audio.requestPermissionsAsync();
        if (permission.status !== 'granted') {
          console.log('[STT] Microphone permission denied');
          setError('Microphone permission not granted');
          return;
        }
        permissionGrantedRef.current = true;
        console.log('[STT] Microphone permission granted');
      } catch (e) {
        console.log('[STT] Permission request error:', e);
        setError('Failed to request microphone permission');
        return;
      }
    }

    isNativeListeningRef.current = true;

    const recording = await startNativeSegment();
    if (!recording) {
      setError('Failed to start recording');
      isNativeListeningRef.current = false;
      return;
    }

    nativeRecordingRef.current = recording;
    setIsListening(true);
    console.log('[STT] Native listening started');

    segmentIntervalRef.current = setInterval(() => {
      void processNativeSegment();
    }, SEGMENT_DURATION_MS);
  }, [startNativeSegment, processNativeSegment]);

  const stopNativeListening = useCallback(async () => {
    console.log('[STT] Stopping native listening');
    isNativeListeningRef.current = false;

    if (segmentIntervalRef.current) {
      clearInterval(segmentIntervalRef.current);
      segmentIntervalRef.current = null;
    }

    const recording = nativeRecordingRef.current;
    nativeRecordingRef.current = null;

    if (recording) {
      try {
        setInterimTranscript('Transcribing...');
        const text = await transcribeSegment(recording);
        if (text.trim()) {
          setTranscript(prev => prev + (prev ? ' ' : '') + text.trim());
        }
        setInterimTranscript('');
      } catch (e) {
        console.log('[STT] Final segment transcription error:', e);
        setInterimTranscript('');
      }
    }

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });
    } catch {}

    setIsListening(false);
  }, [transcribeSegment]);

  const stopAndGetAudio = useCallback(async (): Promise<{ base64: string; mimeType: string } | null> => {
    if (isWeb) {
      stopWebListening();
      return null;
    }

    console.log('[STT] stopAndGetAudio: capturing audio for Gemini');
    isNativeListeningRef.current = false;

    if (segmentIntervalRef.current) {
      clearInterval(segmentIntervalRef.current);
      segmentIntervalRef.current = null;
    }

    const recording = nativeRecordingRef.current;
    nativeRecordingRef.current = null;

    if (!recording) {
      console.log('[STT] stopAndGetAudio: no active recording, checking saved segments');
      setIsListening(false);
      setInterimTranscript('');
      try {
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      } catch {}

      const segments = segmentAudioRef.current;
      if (segments.length > 0) {
        const lastSegment = segments[segments.length - 1];
        const match = lastSegment.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          console.log('[STT] stopAndGetAudio: returning last saved segment');
          return { base64: match[2], mimeType: match[1] };
        }
      }
      return null;
    }

    try {
      const status = await recording.getStatusAsync();
      if (status.isRecording) {
        await recording.stopAndUnloadAsync();
      }
      const uri = recording.getURI();

      if (!uri) {
        console.log('[STT] stopAndGetAudio: no URI from recording');
        setIsListening(false);
        setInterimTranscript('');
        try {
          await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
        } catch {}
        return null;
      }

      console.log('[STT] stopAndGetAudio: reading audio from', uri);
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const ext = uri.split('.').pop() || 'wav';
      const mimeType = ext === 'm4a' ? 'audio/mp4' : `audio/${ext}`;

      console.log('[STT] stopAndGetAudio: captured', base64.length, 'chars of base64 audio, mime:', mimeType);

      try {
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      } catch {}

      setIsListening(false);
      setInterimTranscript('');

      return { base64, mimeType };
    } catch (e) {
      console.log('[STT] stopAndGetAudio error:', e);
      setIsListening(false);
      setInterimTranscript('');
      try {
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      } catch {}
      return null;
    }
  }, [isWeb, stopWebListening]);

  // ==================== UNIFIED API ====================

  const startListening = useCallback(() => {
    if (isWeb) {
      startWebListening();
    } else {
      void startNativeListening();
    }
  }, [isWeb, startWebListening, startNativeListening]);

  const stopListening = useCallback(() => {
    if (isWeb) {
      stopWebListening();
    } else {
      void stopNativeListening();
    }
  }, [isWeb, stopWebListening, stopNativeListening]);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    segmentAudioRef.current = [];
  }, []);

  const getRecordedAudioSegments = useCallback((): string[] => {
    return [...segmentAudioRef.current];
  }, []);

  useEffect(() => {
    return () => {
      if (isWeb) {
        shouldRestartRef.current = false;
        if (recognitionRef.current) {
          try {
            recognitionRef.current.stop();
          } catch {}
        }
      } else {
        isNativeListeningRef.current = false;
        if (segmentIntervalRef.current) {
          clearInterval(segmentIntervalRef.current);
          segmentIntervalRef.current = null;
        }
        if (nativeRecordingRef.current) {
          nativeRecordingRef.current.stopAndUnloadAsync().catch(() => {});
          nativeRecordingRef.current = null;
        }
      }
    };
  }, [isWeb]);

  return {
    isListening,
    transcript,
    interimTranscript,
    startListening,
    stopListening,
    stopAndGetAudio,
    resetTranscript,
    isSupported,
    error,
    getRecordedAudioSegments,
  };
}
