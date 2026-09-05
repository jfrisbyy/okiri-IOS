import { useCallback, useMemo, useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  fetchMoreForCategory,
  searchNews,
  adaptArticleForLevel,
  RawNewsArticle,
  AdaptedNewsArticle,
  NewsCacheData,
  SearchNewsResult,
} from '@/utils/perplexity';
import { CEFRLevel } from '@/types';
import { useApp } from '@/contexts/AppContext';
import { getUserCEFRLevel } from '@/utils/progressiveDifficulty';
import { searchImagesForBatch } from '@/utils/imageSearch';

const NEWS_CACHE_KEY = 'okiri_news_cache_v2';
const CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000;

const _searchResultsCache = new Map<string, RawNewsArticle>();

function getTodayDateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isCacheTimestampStale(timestamp: string | undefined): boolean {
  if (!timestamp) return true;
  const fetchedAt = new Date(timestamp).getTime();
  if (isNaN(fetchedAt)) return true;
  return Date.now() - fetchedAt > CACHE_MAX_AGE_MS;
}

function getTimeSinceStr(timestamp: string | undefined): string {
  if (!timestamp) return '';
  const fetchedAt = new Date(timestamp).getTime();
  if (isNaN(fetchedAt)) return '';
  const diffMs = Date.now() - fetchedAt;
  const mins = Math.floor(diffMs / (1000 * 60));
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function createEmptyCache(): NewsCacheData {
  return {
    articles: [],
    fetchedAt: new Date().toISOString(),
    fetchDate: getTodayDateStr(),
    adaptedArticles: {},
    categoryFetchCounts: {},
    categoryArticles: {},
    categoryFetchDates: {},
  };
}

const OLD_CACHE_KEY = 'okiri_news_cache';

async function loadCache(): Promise<NewsCacheData | null> {
  try {
    try {
      await AsyncStorage.removeItem(OLD_CACHE_KEY);
    } catch {}

    const raw = await AsyncStorage.getItem(NEWS_CACHE_KEY);
    if (!raw) {
      console.log('[NewsHook] No cache in storage (key:', NEWS_CACHE_KEY, ')');
      return null;
    }
    const parsed = JSON.parse(raw) as NewsCacheData;
    if (!parsed.fetchedAt && !parsed.categoryArticles) {
      console.log('[NewsHook] Cache is malformed, clearing it');
      await AsyncStorage.removeItem(NEWS_CACHE_KEY);
      return null;
    }
    const totalCatArticles = Object.values(parsed.categoryArticles ?? {}).reduce((sum, arr) => sum + arr.length, 0);
    console.log(`[NewsHook] Loaded cache, date=${parsed.fetchDate}, categories=${Object.keys(parsed.categoryArticles ?? {}).join(',') || 'none'}, totalCatArticles=${totalCatArticles}`);
    return parsed;
  } catch (e) {
    console.log('[NewsHook] Cache read error:', e);
    try { await AsyncStorage.removeItem(NEWS_CACHE_KEY); } catch {}
    return null;
  }
}

async function saveCache(data: NewsCacheData): Promise<void> {
  try {
    await AsyncStorage.setItem(NEWS_CACHE_KEY, JSON.stringify(data));
    console.log('[NewsHook] Cache saved');
  } catch (e) {
    console.log('[NewsHook] Cache save error:', e);
  }
}

export function useNews() {
  const { proficiency } = useApp();
  const queryClient = useQueryClient();
  const userLevel = useMemo(() => getUserCEFRLevel(proficiency.certifiedLevels), [proficiency.certifiedLevels]);
  const [isBackgroundRefreshing, setIsBackgroundRefreshing] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState<Record<string, boolean>>({});
  const [categoryErrors, setCategoryErrors] = useState<Record<string, Error | null>>({});
  const categoryErrorCooldowns = useRef<Record<string, number>>({});
  const activeFetchRef = useRef<Record<string, boolean>>({});

  const cacheQuery = useQuery({
    queryKey: ['news', 'raw'],
    queryFn: async () => {
      console.log('[NewsHook] Loading cache from storage...');
      const cached = await loadCache();
      if (cached) {
        if (cached.categoryFetchDates) {
          const staleCats = Object.keys(cached.categoryFetchDates).filter(
            cat => {
              const fetchTimestamp = cached.categoryFetchTimestamps?.[cat];
              if (fetchTimestamp && isCacheTimestampStale(fetchTimestamp)) {
                return true;
              }
              const fetchDate = cached.categoryFetchDates?.[cat];
              return fetchDate !== getTodayDateStr();
            }
          );
          if (staleCats.length > 0) {
            console.log(`[NewsHook] Clearing stale category caches (>6h or different day): ${staleCats.join(', ')}`);
            const updatedCategoryArticles = { ...(cached.categoryArticles ?? {}) };
            const updatedCategoryFetchDates = { ...(cached.categoryFetchDates ?? {}) };
            const updatedCategoryFetchTimestamps = { ...(cached.categoryFetchTimestamps ?? {}) };
            staleCats.forEach(cat => {
              delete updatedCategoryArticles[cat];
              delete updatedCategoryFetchDates[cat];
              delete updatedCategoryFetchTimestamps[cat];
            });
            cached.categoryArticles = updatedCategoryArticles;
            cached.categoryFetchDates = updatedCategoryFetchDates;
            cached.categoryFetchTimestamps = updatedCategoryFetchTimestamps;
          }
        }
        return cached;
      }
      return createEmptyCache();
    },
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1000,
  });

  const fetchCategoryMutation = useMutation({
    mutationFn: async (category: string) => {
      const catKey = category.toLowerCase();
      const now = new Date();
      const nowISO = now.toISOString();

      if (activeFetchRef.current[catKey]) {
        console.log(`[NewsHook] Fetch already in progress for "${catKey}", skipping`);
        const existing = queryClient.getQueryData<NewsCacheData>(['news', 'raw']);
        return existing?.categoryArticles?.[catKey] ?? [];
      }

      const cooldownUntil = categoryErrorCooldowns.current[catKey] ?? 0;
      if (Date.now() < cooldownUntil) {
        console.log(`[NewsHook] Category "${catKey}" is in error cooldown (${Math.round((cooldownUntil - Date.now()) / 1000)}s remaining), bypassing`);
        delete categoryErrorCooldowns.current[catKey];
      }

      activeFetchRef.current[catKey] = true;
      setLoadingCategories(prev => ({ ...prev, [catKey]: true }));
      setCategoryErrors(prev => ({ ...prev, [catKey]: null }));

      try {
        const initialCache = queryClient.getQueryData<NewsCacheData>(['news', 'raw']) ?? createEmptyCache();

        const cachedTimestamp = initialCache.categoryFetchTimestamps?.[catKey];
        const isFresh = cachedTimestamp && !isCacheTimestampStale(cachedTimestamp);

        if (
          isFresh &&
          Array.isArray(initialCache.categoryArticles?.[catKey]) &&
          initialCache.categoryArticles![catKey].length > 0
        ) {
          console.log(`[NewsHook] Category "${catKey}" cache is fresh (${getTimeSinceStr(cachedTimestamp)}), ${initialCache.categoryArticles![catKey].length} articles`);
          return initialCache.categoryArticles![catKey];
        }

        console.log(`[NewsHook] Fetching 10 articles for category: ${catKey} (cache ${cachedTimestamp ? 'expired' : 'missing'})`);
        const articles = await fetchMoreForCategory(
          catKey !== 'all' ? catKey : undefined,
          undefined,
          []
        );

        if (articles.length === 0) {
          console.log(`[NewsHook] Fetch returned 0 articles for "${catKey}" — not caching as fetched`);
          const existingArticles = initialCache.categoryArticles?.[catKey];
          if (existingArticles && existingArticles.length > 0) {
            console.log(`[NewsHook] Keeping ${existingArticles.length} existing articles for "${catKey}"`);
            return existingArticles;
          }
          categoryErrorCooldowns.current[catKey] = Date.now() + 3_000;
          throw new Error(`No ${catKey !== 'all' ? catKey + ' ' : ''}articles found. Tap to retry.`);
        }

        delete categoryErrorCooldowns.current[catKey];

      const latestCache = queryClient.getQueryData<NewsCacheData>(['news', 'raw']) ?? createEmptyCache();

      const updatedCategoryArticles = { ...(latestCache.categoryArticles ?? {}), [catKey]: articles };
      const updatedCategoryFetchDates = { ...(latestCache.categoryFetchDates ?? {}), [catKey]: getTodayDateStr() };
      const updatedCategoryFetchTimestamps = { ...(latestCache.categoryFetchTimestamps ?? {}), [catKey]: nowISO };

      const existingIds = new Set(latestCache.articles.map(a => a.id));
      const newForFlat = articles.filter(a => !existingIds.has(a.id));

      const updatedCache: NewsCacheData = {
        ...latestCache,
        articles: [...latestCache.articles, ...newForFlat],
        fetchedAt: nowISO,
        fetchDate: latestCache.fetchDate || getTodayDateStr(),
        categoryArticles: updatedCategoryArticles,
        categoryFetchDates: updatedCategoryFetchDates,
        categoryFetchTimestamps: updatedCategoryFetchTimestamps,
      };

      await saveCache(updatedCache);
      queryClient.setQueryData(['news', 'raw'], updatedCache);
      console.log(`[NewsHook] Cached ${articles.length} articles for "${catKey}"`);
      return articles;
      } catch (err) {
        categoryErrorCooldowns.current[catKey] = Date.now() + 3_000;
        setCategoryErrors(prev => ({ ...prev, [catKey]: err as Error }));
        console.log(`[NewsHook] Fetch error for "${catKey}", cooldown set for 3s:`, (err as Error)?.message);
        throw err;
      } finally {
        activeFetchRef.current[catKey] = false;
        setLoadingCategories(prev => ({ ...prev, [catKey]: false }));
      }
    },
  });

  const loadMoreMutation = useMutation({
    mutationFn: async (category: string) => {
      const catKey = category.toLowerCase();
      const cache = queryClient.getQueryData<NewsCacheData>(['news', 'raw']);
      if (!cache) throw new Error('No cache available');

      const existingArticles = cache.categoryArticles?.[catKey] ?? [];
      const existingHeadlines = existingArticles.map(a => a.headline);

      console.log(`[NewsHook] Loading 15 more for "${catKey}", existing: ${existingArticles.length}`);
      const newArticles = await fetchMoreForCategory(
        catKey !== 'all' ? catKey : undefined,
        undefined,
        existingHeadlines.slice(0, 15)
      );

      const latestCache = queryClient.getQueryData<NewsCacheData>(['news', 'raw']) ?? cache;

      const currentCatArticles = latestCache.categoryArticles?.[catKey] ?? existingArticles;
      const existingIds = new Set(currentCatArticles.map(a => a.id));
      const uniqueNew = newArticles.filter(a => !existingIds.has(a.id));

      const updatedCatArticles = [...currentCatArticles, ...uniqueNew];
      const updatedCategoryArticles = { ...(latestCache.categoryArticles ?? {}), [catKey]: updatedCatArticles };

      const flatIds = new Set(latestCache.articles.map(a => a.id));
      const newForFlat = uniqueNew.filter(a => !flatIds.has(a.id));

      const updatedCache: NewsCacheData = {
        ...latestCache,
        articles: [...latestCache.articles, ...newForFlat],
        categoryArticles: updatedCategoryArticles,
      };

      await saveCache(updatedCache);
      queryClient.setQueryData(['news', 'raw'], updatedCache);
      console.log(`[NewsHook] Added ${uniqueNew.length} more for "${catKey}", total: ${updatedCatArticles.length}`);
      return uniqueNew;
    },
  });

  const searchMutation = useMutation({
    mutationFn: async (query: string): Promise<SearchNewsResult> => {
      console.log(`[NewsHook] Searching for: "${query}"`);
      const result = await searchNews(query);

      result.articles.forEach(a => _searchResultsCache.set(a.id, a));

      const cache = queryClient.getQueryData<NewsCacheData>(['news', 'raw']);
      if (cache) {
        const existingIds = new Set(cache.articles.map(a => a.id));
        const newArticles = result.articles.filter(a => !existingIds.has(a.id));
        if (newArticles.length > 0) {
          const updatedCache: NewsCacheData = {
            ...cache,
            articles: [...cache.articles, ...newArticles],
          };
          queryClient.setQueryData(['news', 'raw'], updatedCache);
          await saveCache(updatedCache);
        }
      }

      console.log(`[NewsHook] Search returned ${result.articles.length} results${result.translatedQuery ? ` (translated: "${result.translatedQuery}")` : ''}`);
      return result;
    },
  });

  const adaptMutation = useMutation({
    mutationFn: async ({ article, level }: { article: RawNewsArticle; level: CEFRLevel }) => {
      const cacheKey = `${article.id}_${level}`;

      const cachedData = queryClient.getQueryData<NewsCacheData>(['news', 'raw']);
      if (cachedData?.adaptedArticles[cacheKey]) {
        console.log(`[NewsHook] Using cached adaptation: ${cacheKey}`);
        return cachedData.adaptedArticles[cacheKey];
      }

      console.log(`[NewsHook] Adapting article: ${cacheKey}...`);
      const adapted = await adaptArticleForLevel(article, level);

      const freshCache = queryClient.getQueryData<NewsCacheData>(['news', 'raw']);
      if (freshCache) {
        const updatedCache: NewsCacheData = {
          ...freshCache,
          adaptedArticles: { ...freshCache.adaptedArticles, [cacheKey]: adapted },
        };
        await saveCache(updatedCache);
        queryClient.setQueryData(['news', 'raw'], updatedCache);
      }

      return adapted;
    },
  });

  const getAdaptedArticle = useCallback(
    (articleId: string, level?: CEFRLevel): AdaptedNewsArticle | null => {
      const lvl = level ?? userLevel;
      const cacheKey = `${articleId}_${lvl}`;
      return cacheQuery.data?.adaptedArticles[cacheKey] ?? null;
    },
    [cacheQuery.data, userLevel]
  );

  const getCategoryArticles = useCallback(
    (category: string): RawNewsArticle[] => {
      const catKey = category.toLowerCase();
      return cacheQuery.data?.categoryArticles?.[catKey] ?? [];
    },
    [cacheQuery.data]
  );

  const isCategoryFetched = useCallback(
    (category: string): boolean => {
      const catKey = category.toLowerCase();
      const timestamp = cacheQuery.data?.categoryFetchTimestamps?.[catKey];
      if (timestamp && !isCacheTimestampStale(timestamp)) {
        return true;
      }
      const hasArticles = (cacheQuery.data?.categoryArticles?.[catKey]?.length ?? 0) > 0;
      if (hasArticles && timestamp) {
        return true;
      }
      return false;
    },
    [cacheQuery.data]
  );

  const getCategoryLastRefreshed = useCallback(
    (category: string): string | null => {
      const catKey = category.toLowerCase();
      return cacheQuery.data?.categoryFetchTimestamps?.[catKey] ?? null;
    },
    [cacheQuery.data]
  );

  const forceRefreshCategory = useCallback(async (category: string) => {
    const catKey = category.toLowerCase();
    console.log(`[NewsHook] FORCE refreshing category: ${catKey} (bypassing all cache + cooldown)`);
    delete categoryErrorCooldowns.current[catKey];
    delete activeFetchRef.current[catKey];
    const cache = queryClient.getQueryData<NewsCacheData>(['news', 'raw']);
    if (cache) {
      const updatedCategoryArticles = { ...(cache.categoryArticles ?? {}) };
      const updatedCategoryFetchDates = { ...(cache.categoryFetchDates ?? {}) };
      const updatedCategoryFetchTimestamps = { ...(cache.categoryFetchTimestamps ?? {}) };
      delete updatedCategoryArticles[catKey];
      delete updatedCategoryFetchDates[catKey];
      delete updatedCategoryFetchTimestamps[catKey];
      const updatedCache: NewsCacheData = {
        ...cache,
        categoryArticles: updatedCategoryArticles,
        categoryFetchDates: updatedCategoryFetchDates,
        categoryFetchTimestamps: updatedCategoryFetchTimestamps,
      };
      queryClient.setQueryData(['news', 'raw'], updatedCache);
      await saveCache(updatedCache);
    }
    return fetchCategoryMutation.mutateAsync(category);
  }, [queryClient, fetchCategoryMutation]);

  const clearCooldown = useCallback((category: string) => {
    const catKey = category.toLowerCase();
    delete categoryErrorCooldowns.current[catKey];
    delete activeFetchRef.current[catKey];
    console.log(`[NewsHook] Cleared cooldown for "${catKey}"`);
  }, []);

  const refreshCategory = useCallback(async (category: string) => {
    clearCooldown(category);
    return forceRefreshCategory(category);
  }, [forceRefreshCategory, clearCooldown]);

  const backgroundRefreshCategory = useCallback(async (category: string) => {
    const catKey = category.toLowerCase();
    const timestamp = cacheQuery.data?.categoryFetchTimestamps?.[catKey];
    if (timestamp && !isCacheTimestampStale(timestamp)) {
      return;
    }
    const hasExisting = (cacheQuery.data?.categoryArticles?.[catKey]?.length ?? 0) > 0;
    if (!hasExisting) return;

    console.log(`[NewsHook] Background refresh for "${catKey}" (last: ${getTimeSinceStr(timestamp)})`);
    setIsBackgroundRefreshing(true);
    try {
      await forceRefreshCategory(category);
    } catch (e) {
      console.log(`[NewsHook] Background refresh failed for "${catKey}":`, e);
    } finally {
      setIsBackgroundRefreshing(false);
    }
  }, [cacheQuery.data, forceRefreshCategory]);

  const refreshNews = useCallback(async () => {
    console.log('[NewsHook] Force refreshing all cache...');
    try { await AsyncStorage.removeItem(NEWS_CACHE_KEY); } catch {}
    queryClient.removeQueries({ queryKey: ['news', 'raw'] });
    void queryClient.invalidateQueries({ queryKey: ['news', 'raw'] });
  }, [queryClient]);

  const findArticleById = useCallback(
    (id: string): RawNewsArticle | null => {
      const articles = cacheQuery.data?.articles ?? [];
      const found = articles.find(a => a.id === id);
      if (found) return found;

      if (cacheQuery.data?.categoryArticles) {
        for (const catArticles of Object.values(cacheQuery.data.categoryArticles)) {
          const catFound = catArticles.find(a => a.id === id);
          if (catFound) return catFound;
        }
      }

      return _searchResultsCache.get(id) ?? null;
    },
    [cacheQuery.data]
  );

  const searchedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const data = cacheQuery.data;
    if (!data?.categoryArticles) return;

    const allCatArticles = Object.values(data.categoryArticles).flat();
    const needsSearch = allCatArticles.filter(
      a => !a.imageUrl?.startsWith('http') && !searchedIdsRef.current.has(a.id)
    );

    if (needsSearch.length === 0) return;

    needsSearch.forEach(a => searchedIdsRef.current.add(a.id));

    console.log(`[NewsHook] Searching smart images for ${needsSearch.length} articles...`);

    searchImagesForBatch(
      needsSearch.map(a => ({ id: a.id, title: a.headline, region: a.region, category: a.category, sourceUrl: a.sourceUrl }))
    ).then(imageMap => {
      const found = Object.keys(imageMap).length;
      if (found === 0) return;

      console.log(`[NewsHook] Found ${found} smart images, updating cache...`);
      const current = queryClient.getQueryData<NewsCacheData>(['news', 'raw']);
      if (!current) return;

      const updatedCategoryArticles = { ...(current.categoryArticles ?? {}) };
      for (const [cat, catArts] of Object.entries(updatedCategoryArticles)) {
        updatedCategoryArticles[cat] = catArts.map(a =>
          imageMap[a.id] ? { ...a, imageUrl: imageMap[a.id] } : a
        );
      }

      const updatedArticles = current.articles.map(a =>
        imageMap[a.id] ? { ...a, imageUrl: imageMap[a.id] } : a
      );

      const updated: NewsCacheData = {
        ...current,
        articles: updatedArticles,
        categoryArticles: updatedCategoryArticles,
      };
      void saveCache(updated);
      queryClient.setQueryData(['news', 'raw'], updated);
    }).catch(e => console.log('[NewsHook] Smart image search error:', e));
  }, [cacheQuery.data, queryClient]);

  const autoFetchedRef = useRef(false);
  const autoFetchRetryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (cacheQuery.isLoading) return;
    if (autoFetchedRef.current) return;

    const data = cacheQuery.data;
    if (!data) {
      console.log('[NewsHook] No cache data yet, skipping auto-fetch');
      return;
    }

    const allArticles = data.categoryArticles?.['all'] ?? [];
    const allTimestamp = data.categoryFetchTimestamps?.['all'];
    const needsFetch = !allTimestamp || isCacheTimestampStale(allTimestamp) || allArticles.length === 0;

    if (!needsFetch) {
      console.log(`[NewsHook] "all" category is fresh with ${allArticles.length} articles, skipping auto-fetch`);
      autoFetchedRef.current = true;
      return;
    }

    autoFetchedRef.current = true;

    const doFetch = async () => {
      const hasExisting = allArticles.length > 0;
      if (hasExisting) {
        console.log('[NewsHook] Auto background-refreshing "all" category (stale cache)...');
        setIsBackgroundRefreshing(true);
        try {
          await forceRefreshCategory('all');
        } catch (e) {
          console.log('[NewsHook] Auto background refresh failed:', e);
          scheduleRetry();
        } finally {
          setIsBackgroundRefreshing(false);
        }
      } else {
        console.log('[NewsHook] Auto-fetching "all" category (no existing articles)...');
        try {
          await fetchCategoryMutation.mutateAsync('all');
          console.log('[NewsHook] Auto-fetch "all" succeeded');
        } catch (e) {
          console.log('[NewsHook] Auto-fetch "all" failed, will retry in 5s:', (e as Error)?.message);
          scheduleRetry();
        }
      }
    };

    const scheduleRetry = () => {
      if (autoFetchRetryTimer.current) clearTimeout(autoFetchRetryTimer.current);
      autoFetchRetryTimer.current = setTimeout(() => {
        console.log('[NewsHook] Retrying auto-fetch for "all"...');
        autoFetchedRef.current = false;
      }, 5000);
    };

    void doFetch();
  }, [cacheQuery.isLoading, cacheQuery.data, fetchCategoryMutation, forceRefreshCategory]);

  useEffect(() => {
    return () => {
      if (autoFetchRetryTimer.current) clearTimeout(autoFetchRetryTimer.current);
    };
  }, []);

  return {
    getCategoryArticles,
    isCategoryFetched,
    fetchCategory: fetchCategoryMutation.mutateAsync,
    isCategoryLoading: fetchCategoryMutation.isPending,
    categoryError: fetchCategoryMutation.error,
    isCategoryLoadingFor: (cat: string) => loadingCategories[cat.toLowerCase()] ?? false,
    categoryErrorFor: (cat: string) => categoryErrors[cat.toLowerCase()] ?? null,
    refreshCategory,
    forceRefreshCategory,
    clearCooldown,
    backgroundRefreshCategory,
    isBackgroundRefreshing,
    getCategoryLastRefreshed,
    getTimeSinceStr,

    loadMoreForCategory: loadMoreMutation.mutateAsync,
    isLoadingMore: loadMoreMutation.isPending,

    articles: cacheQuery.data?.articles ?? [],
    lastFetchedAt: cacheQuery.data?.fetchedAt ?? null,
    isLoading: cacheQuery.isLoading,
    isError: cacheQuery.isError,
    error: cacheQuery.error,
    refetch: refreshNews,

    adaptArticle: adaptMutation.mutateAsync,
    isAdapting: adaptMutation.isPending,
    getAdaptedArticle,
    userLevel,

    searchArticles: searchMutation.mutateAsync,
    findArticleById,
  };
}
