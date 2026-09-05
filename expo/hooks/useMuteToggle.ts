import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MUTE_KEY = 'lesson_audio_muted';

export function useMuteToggle() {
  const [isMuted, setIsMuted] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(MUTE_KEY)
      .then((val) => {
        if (val === 'true') setIsMuted(true);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      AsyncStorage.setItem(MUTE_KEY, String(next)).catch(() => {});
      return next;
    });
  }, []);

  return { isMuted, toggleMute, loaded };
}
