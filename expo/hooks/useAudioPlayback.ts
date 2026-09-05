import { useState, useCallback, useEffect, useRef } from 'react';
import { audioService, type PlaybackSpeed } from '@/utils/audioService';

interface UseAudioPlaybackReturn {
  play: (audioSource: string, speed?: PlaybackSpeed) => Promise<void>;
  stop: () => Promise<void>;
  isPlaying: boolean;
  cleanup: () => void;
}

function tryParseSegments(audioSource: string): string[] | null {
  try {
    if (audioSource.startsWith('[')) {
      const parsed = JSON.parse(audioSource);
      if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'string') {
        return parsed;
      }
    }
  } catch {}
  return null;
}

export function useAudioPlayback(): UseAudioPlaybackReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const unsub = audioService.onPlayingChange((playing) => {
      if (mountedRef.current) setIsPlaying(playing);
    });
    return () => {
      mountedRef.current = false;
      unsub();
    };
  }, []);

  const stop = useCallback(async () => {
    await audioService.stopCurrent();
  }, []);

  const play = useCallback(async (audioSource: string, speed?: PlaybackSpeed) => {
    await audioService.stopCurrent();

    const segments = tryParseSegments(audioSource);

    if (segments) {
      setIsPlaying(true);
      for (let i = 0; i < segments.length; i++) {
        if (!mountedRef.current) break;
        try {
          await audioService.playFromUri(segments[i], speed ?? 1.0);
        } catch (err) {
          console.log('[AudioPlayback] Segment playback error:', err);
        }
      }
      if (mountedRef.current) setIsPlaying(false);
    } else {
      try {
        await audioService.playFromUri(audioSource, speed ?? 1.0);
      } catch (err) {
        console.log('[AudioPlayback] Playback error:', err);
      }
    }
  }, []);

  const cleanup = useCallback(() => {
    void audioService.stopCurrent();
  }, []);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    play,
    stop,
    isPlaying,
    cleanup,
  };
}
