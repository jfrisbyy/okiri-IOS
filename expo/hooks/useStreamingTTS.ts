import { useState, useRef, useCallback } from 'react';
import { Audio } from 'expo-av';
import { Platform } from 'react-native';

const ELEVENLABS_API_KEY = process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY || '';

// NOTE: In production, proxy TTS requests through a Supabase Edge Function
// to avoid exposing the API key on the client.

const DEFAULT_VOICE_ID = 'pFZP5JQG7iQjIQuC4Bku'; // Lily - French female
const MODEL_ID = 'eleven_multilingual_v2';

interface QueueItem {
  text: string;
  id: string;
}

export function useStreamingTTS() {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentText, setCurrentText] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const queueRef = useRef<QueueItem[]>([]);
  const isProcessingRef = useRef<boolean>(false);
  const currentSoundRef = useRef<Audio.Sound | null>(null);
  const shouldStopRef = useRef<boolean>(false);
  const voiceIdRef = useRef<string>(DEFAULT_VOICE_ID);

  const processQueue = useCallback(async () => {
    if (isProcessingRef.current || shouldStopRef.current) {
      return;
    }

    if (queueRef.current.length === 0) {
      console.log('[useStreamingTTS] Queue empty, stopping playback');
      setIsPlaying(false);
      setCurrentText('');
      isProcessingRef.current = false;
      return;
    }

    isProcessingRef.current = true;
    setIsPlaying(true);

    const item = queueRef.current.shift();
    if (!item) {
      isProcessingRef.current = false;
      void processQueue();
      return;
    }

    console.log('[useStreamingTTS] Processing:', item.text.substring(0, 40), '...');
    setCurrentText(item.text);

    try {
      const audioUri = await fetchTTSAudio(item.text, voiceIdRef.current);

      if (shouldStopRef.current) {
        console.log('[useStreamingTTS] Stop requested, skipping playback');
        isProcessingRef.current = false;
        return;
      }

      if (!audioUri) {
        console.log('[useStreamingTTS] No audio URI returned, skipping');
        isProcessingRef.current = false;
        void processQueue();
        return;
      }

      await playAudio(audioUri);
    } catch (err) {
      console.log('[useStreamingTTS] Error processing item:', err);
      setError(err instanceof Error ? err.message : 'TTS error');
    }

    isProcessingRef.current = false;

    if (!shouldStopRef.current) {
      void processQueue();
    }
  }, []);

  const fetchTTSAudio = async (text: string, voiceId: string): Promise<string | null> => {
    if (!ELEVENLABS_API_KEY) {
      console.log('[useStreamingTTS] No ElevenLabs API key configured');
      setError('ElevenLabs API key not configured');
      return null;
    }

    console.log('[useStreamingTTS] Fetching TTS for:', text.substring(0, 30));

    try {
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': ELEVENLABS_API_KEY,
            'Content-Type': 'application/json',
            'Accept': 'audio/mpeg',
          },
          body: JSON.stringify({
            text,
            model_id: MODEL_ID,
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
              style: 0.0,
              use_speaker_boost: true,
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.log('[useStreamingTTS] ElevenLabs API error:', response.status, errorText);
        throw new Error(`ElevenLabs API error: ${response.status}`);
      }

      const blob = await response.blob();

      if (Platform.OS === 'web') {
        const url = URL.createObjectURL(blob);
        return url;
      }

      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(blob);
      const base64Uri = await base64Promise;

      return base64Uri;
    } catch (err) {
      console.log('[useStreamingTTS] fetchTTSAudio error:', err);
      throw err;
    }
  };

  const playAudio = async (uri: string): Promise<void> => {
    console.log('[useStreamingTTS] Playing audio');

    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });

      if (currentSoundRef.current) {
        try {
          await currentSoundRef.current.unloadAsync();
        } catch {
          // ignore cleanup errors
        }
        currentSoundRef.current = null;
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true, volume: 1.0 }
      );

      currentSoundRef.current = sound;

      return new Promise<void>((resolve) => {
        sound.setOnPlaybackStatusUpdate((status) => {
          if (!status.isLoaded) return;

          if (status.didJustFinish) {
            console.log('[useStreamingTTS] Playback finished');
            sound.unloadAsync().catch(() => {});
            currentSoundRef.current = null;

            if (Platform.OS === 'web' && uri.startsWith('blob:')) {
              URL.revokeObjectURL(uri);
            }

            resolve();
          }
        });
      });
    } catch (err) {
      console.log('[useStreamingTTS] playAudio error:', err);
      currentSoundRef.current = null;
      throw err;
    }
  };

  const queueSentence = useCallback((text: string) => {
    if (!text.trim()) return;

    const id = Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    console.log('[useStreamingTTS] Queuing sentence:', text.substring(0, 40));

    queueRef.current.push({ text: text.trim(), id });

    if (!isProcessingRef.current && !shouldStopRef.current) {
      void processQueue();
    }
  }, [processQueue]);

  const stopPlayback = useCallback(async () => {
    console.log('[useStreamingTTS] Stopping playback');
    shouldStopRef.current = true;

    if (currentSoundRef.current) {
      try {
        await currentSoundRef.current.stopAsync();
        await currentSoundRef.current.unloadAsync();
      } catch {
        // ignore cleanup errors
      }
      currentSoundRef.current = null;
    }

    queueRef.current = [];
    isProcessingRef.current = false;
    setIsPlaying(false);
    setCurrentText('');

    setTimeout(() => {
      shouldStopRef.current = false;
    }, 100);
  }, []);

  const clearQueue = useCallback(() => {
    console.log('[useStreamingTTS] Clearing queue, items:', queueRef.current.length);
    queueRef.current = [];
  }, []);

  const setVoiceId = useCallback((voiceId: string) => {
    console.log('[useStreamingTTS] Setting voice ID:', voiceId);
    voiceIdRef.current = voiceId;
  }, []);

  return {
    queueSentence,
    stopPlayback,
    clearQueue,
    setVoiceId,
    isPlaying,
    currentText,
    error,
  };
}
