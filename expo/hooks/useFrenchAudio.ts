import { useCallback, useState, useEffect, useRef } from 'react';
import * as Haptics from 'expo-haptics';
import { useAccent } from '@/contexts/AccentContext';
import { playRegionalAudio, stopRegionalAudio } from '@/utils/azureRegionalTTS';
import { audioService, type PlaybackSpeed } from '@/utils/audioService';
import type { FrenchRegionId } from '@/data/regionalAccents';

export function useFrenchAudio() {
  const { selectedAccentId, hasSelectedAccent } = useAccent();
  const [isSpeaking, setIsSpeaking] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const unsub = audioService.onPlayingChange((playing) => {
      if (mountedRef.current) setIsSpeaking(playing);
    });
    return () => {
      mountedRef.current = false;
      unsub();
    };
  }, []);

  const speak = useCallback(async (text: string, speed?: PlaybackSpeed) => {
    if (!text || text.trim().length === 0) {
      console.log('No text to speak');
      return;
    }

    if (hasSelectedAccent && selectedAccentId) {
      try {
        await audioService.stopCurrent();
        await stopRegionalAudio();
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setIsSpeaking(true);
        console.log('[FrenchAudio] Using regional accent:', selectedAccentId, 'for:', text);
        await playRegionalAudio(
          { regionId: selectedAccentId as FrenchRegionId, text, voiceGender: 'female', rate: '-5%' },
          undefined,
          () => {
            if (mountedRef.current) setIsSpeaking(false);
          },
        );
        return;
      } catch (err) {
        console.log('[FrenchAudio] Regional TTS failed, falling back to ElevenLabs:', err);
        if (mountedRef.current) setIsSpeaking(false);
      }
    }

    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await audioService.playFrenchAudio(text, speed ?? 1.0);
    } catch (err) {
      console.log('[FrenchAudio] AudioService playback error:', err);
    }
  }, [hasSelectedAccent, selectedAccentId]);

  const stop = useCallback(async () => {
    await audioService.stopCurrent();
    await stopRegionalAudio();
  }, []);

  const voiceName = hasSelectedAccent ? `Regional (${selectedAccentId})` : 'Lily (ElevenLabs)';

  return { speak, stop, isSpeaking, voiceName };
}
