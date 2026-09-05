import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateObject } from '@rork-ai/toolkit-sdk';
import { z } from 'zod';
import { useApp } from '@/contexts/AppContext';
import { isUserBelowB2 } from '@/utils/proficiency';
import { RawNewsArticle } from '@/utils/perplexity';

const TRANSLATION_CACHE_KEY = 'okiri_headline_translations_v1';
const BATCH_SIZE = 10;
const MAX_CACHE_SIZE = 500;

interface TranslationCache {
  [articleId: string]: string;
}

export function useHeadlineTranslations(articles: RawNewsArticle[]) {
  const { proficiency } = useApp();
  const belowB2 = useMemo(() => isUserBelowB2(proficiency.certifiedLevels), [proficiency.certifiedLevels]);
  const [translations, setTranslations] = useState<TranslationCache>({});
  const [isTranslating, setIsTranslating] = useState(false);
  const pendingRef = useRef<Set<string>>(new Set());
  const translatingRef = useRef(false);
  const cacheLoadedRef = useRef(false);

  useEffect(() => {
    if (!belowB2) return;
    AsyncStorage.getItem(TRANSLATION_CACHE_KEY)
      .then((raw) => {
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as TranslationCache;
            setTranslations(parsed);
            console.log(`[HeadlineTranslations] Loaded ${Object.keys(parsed).length} cached translations`);
          } catch {
            console.log('[HeadlineTranslations] Failed to parse cache');
          }
        }
        cacheLoadedRef.current = true;
      })
      .catch(() => {
        cacheLoadedRef.current = true;
      });
  }, [belowB2]);

  const saveCache = useCallback(async (cache: TranslationCache) => {
    try {
      const keys = Object.keys(cache);
      if (keys.length > MAX_CACHE_SIZE) {
        const trimmed: TranslationCache = {};
        keys.slice(-MAX_CACHE_SIZE).forEach((k) => {
          trimmed[k] = cache[k];
        });
        await AsyncStorage.setItem(TRANSLATION_CACHE_KEY, JSON.stringify(trimmed));
      } else {
        await AsyncStorage.setItem(TRANSLATION_CACHE_KEY, JSON.stringify(cache));
      }
    } catch (e) {
      console.log('[HeadlineTranslations] Save error:', e);
    }
  }, []);

  const translateBatch = useCallback(async (batch: { id: string; headline: string }[]) => {
    if (batch.length === 0) return;
    console.log(`[HeadlineTranslations] Translating batch of ${batch.length} headlines`);

    try {
      const headlinesText = batch.map((b, i) => `${i + 1}. ${b.headline}`).join('\n');

      const result = await generateObject({
        messages: [
          {
            role: 'user',
            content: `Translate these French news headlines to natural English. Return an array of translations in the same order.\n\n${headlinesText}`,
          },
        ],
        schema: z.object({
          translations: z.array(z.string()),
        }),
      });

      if (result?.translations && result.translations.length === batch.length) {
        setTranslations((prev) => {
          const updated = { ...prev };
          batch.forEach((b, i) => {
            updated[b.id] = result.translations[i];
          });
          void saveCache(updated);
          return updated;
        });
        console.log(`[HeadlineTranslations] Successfully translated ${batch.length} headlines`);
      } else {
        console.log('[HeadlineTranslations] Mismatch in translation count, got:', result?.translations?.length, 'expected:', batch.length);
      }
    } catch (e) {
      console.log('[HeadlineTranslations] Translation error:', (e as Error)?.message);
    }
  }, [saveCache]);

  useEffect(() => {
    try {
      if (!belowB2 || !cacheLoadedRef.current || translatingRef.current) return;
      if (!articles || articles.length === 0) return;

      const untranslated = articles.filter(
        (a) => a?.id && !translations[a.id] && !pendingRef.current.has(a.id)
      );

      if (untranslated.length === 0) return;

      const batch = untranslated.slice(0, BATCH_SIZE);
      batch.forEach((a) => pendingRef.current.add(a.id));

      translatingRef.current = true;
      setIsTranslating(true);

      void translateBatch(batch.map((a) => ({ id: a.id, headline: a.headline })))
        .catch((e) => {
          console.log('[HeadlineTranslations] Batch processing error:', (e as Error)?.message);
        })
        .finally(() => {
          batch.forEach((a) => pendingRef.current.delete(a.id));
          translatingRef.current = false;
          setIsTranslating(false);
        });
    } catch (e) {
      console.log('[HeadlineTranslations] Effect error:', (e as Error)?.message);
      translatingRef.current = false;
      setIsTranslating(false);
    }
  }, [belowB2, articles, translations, translateBatch]);

  const getDisplayHeadline = useCallback(
    (article: RawNewsArticle): string => {
      if (!belowB2) return article.headline;
      return translations[article.id] || article.headline;
    },
    [belowB2, translations]
  );

  const showingEnglish = belowB2;

  return { getDisplayHeadline, isTranslating, showingEnglish, belowB2 };
}
