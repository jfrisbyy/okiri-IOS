import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import type { FrenchRegionId, FrenchRegion } from '@/data/regionalAccents';
import { frenchRegions, getRegionById } from '@/data/regionalAccents';

const ACCENT_STORAGE_KEY = 'okiri_selected_accent';

export const [AccentProvider, useAccent] = createContextHook(() => {
  const [selectedAccentId, setSelectedAccentId] = useState<FrenchRegionId | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(ACCENT_STORAGE_KEY).then((stored) => {
      if (stored) {
        const parsed = stored as FrenchRegionId;
        if (frenchRegions.some(r => r.id === parsed)) {
          setSelectedAccentId(parsed);
          console.log('[Accent] Loaded saved accent:', parsed);
        }
      }
      setIsLoaded(true);
    }).catch((err) => {
      console.log('[Accent] Error loading accent:', err);
      setIsLoaded(true);
    });
  }, []);

  const selectAccent = useCallback(async (regionId: FrenchRegionId) => {
    setSelectedAccentId(regionId);
    await AsyncStorage.setItem(ACCENT_STORAGE_KEY, regionId);
    console.log('[Accent] Saved accent:', regionId);
  }, []);

  const clearAccent = useCallback(async () => {
    setSelectedAccentId(null);
    await AsyncStorage.removeItem(ACCENT_STORAGE_KEY);
    console.log('[Accent] Cleared accent');
  }, []);

  const selectedRegion: FrenchRegion | null = selectedAccentId
    ? getRegionById(selectedAccentId) ?? null
    : null;

  const hasSelectedAccent = selectedAccentId !== null;

  const accentLocale = selectedRegion?.azureLocale ?? 'fr-FR';

  return {
    selectedAccentId,
    selectedRegion,
    hasSelectedAccent,
    accentLocale,
    isLoaded,
    selectAccent,
    clearAccent,
  };
});
