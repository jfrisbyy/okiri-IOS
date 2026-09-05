import { generateText } from '@rork-ai/toolkit-sdk';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TranscriptSegment } from '@/types';

const YOUTUBE_API_KEY = process.env.EXPO_PUBLIC_YOUTUBE_API_KEY || '';
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

const getBackendUrl = () => {
  const url = process.env.EXPO_PUBLIC_RORK_API_BASE_URL;
  if (!url) {
    console.error('[YouTubeSearch] EXPO_PUBLIC_RORK_API_BASE_URL not set');
    return '';
  }
  return `${url}/api`;
};

export interface YouTubeSearchResult {
  videoId: string;
  title: string;
  channel: string;
  thumbnailUrl: string;
  durationSeconds: number;
  views: number;
  uploadedDate: string;
  hasTranscript: boolean | null;
}

export async function translateSearchQuery(query: string): Promise<string> {
  console.log(`[YouTubeSearch] Using query as-is with relevanceLanguage=fr bias: "${query}"`);
  return query;
}

function parseISO8601Duration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);
  return hours * 3600 + minutes * 60 + seconds;
}

function parseViewCount(viewCount: string | undefined): number {
  if (!viewCount) return 0;
  return parseInt(viewCount, 10) || 0;
}

function formatRelativeDate(publishedAt: string): string {
  try {
    const published = new Date(publishedAt);
    const now = new Date();
    const diffMs = now.getTime() - published.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return '1 day ago';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? 's' : ''} ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} month${Math.floor(diffDays / 30) > 1 ? 's' : ''} ago`;
    return `${Math.floor(diffDays / 365)} year${Math.floor(diffDays / 365) > 1 ? 's' : ''} ago`;
  } catch {
    return '';
  }
}

async function searchYouTubeOfficial(query: string, frenchBias = true): Promise<YouTubeSearchResult[]> {
  const langParams = frenchBias ? '&relevanceLanguage=fr&regionCode=FR' : '';
  const searchUrl = `${YOUTUBE_API_BASE}/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=50${langParams}&key=${YOUTUBE_API_KEY}`;
  console.log('[YouTubeSearch] Using YouTube Data API v3');

  const searchRes = await fetch(searchUrl);
  if (!searchRes.ok) {
    const errBody = await searchRes.text();
    console.error('[YouTubeSearch] YouTube API search error:', searchRes.status, errBody);
    throw new Error(`YouTube API error: ${searchRes.status}`);
  }
  const searchData = await searchRes.json();
  const items: any[] = searchData.items || [];

  if (items.length === 0) {
    console.log('[YouTubeSearch] No results from YouTube API');
    return [];
  }

  const videoIds = items.map((item: any) => item.id?.videoId).filter(Boolean).join(',');
  const detailsUrl = `${YOUTUBE_API_BASE}/videos?part=contentDetails,statistics&id=${videoIds}&key=${YOUTUBE_API_KEY}`;
  const detailsRes = await fetch(detailsUrl);
  const detailsData = detailsRes.ok ? await detailsRes.json() : { items: [] };

  const detailsMap = new Map<string, any>();
  for (const d of (detailsData.items || [])) {
    detailsMap.set(d.id, d);
  }

  const results: YouTubeSearchResult[] = items
    .reduce<YouTubeSearchResult[]>((acc, item: any) => {
      const videoId = item.id?.videoId;
      if (!videoId) return acc;
      const details = detailsMap.get(videoId);
      const durationSeconds = details ? parseISO8601Duration(details.contentDetails?.duration || '') : 0;
      const views = details ? parseViewCount(details.statistics?.viewCount) : 0;
      const hasCaptions = details?.contentDetails?.caption === 'true';

      if (durationSeconds <= 30 || !hasCaptions) return acc;

      acc.push({
        videoId,
        title: item.snippet?.title || 'Untitled',
        channel: item.snippet?.channelTitle || 'Unknown',
        thumbnailUrl:
          item.snippet?.thumbnails?.medium?.url ||
          item.snippet?.thumbnails?.default?.url ||
          `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
        durationSeconds,
        views,
        uploadedDate: formatRelativeDate(item.snippet?.publishedAt || ''),
        hasTranscript: true,
      });
      return acc;
    }, [])
    .slice(0, 30);

  console.log(`[YouTubeSearch] Found ${results.length} results via YouTube API for "${query}"`);  
  return results;
}

const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.adminforge.de',
  'https://pipedapi-libre.kavin.rocks',
  'https://pipedapi.r4fo.com',
];

async function pipedFetch(path: string, timeout = 10000): Promise<any> {
  for (const instance of PIPED_INSTANCES) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);
      const response = await fetch(`${instance}${path}`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timer);
      if (response.ok) {
        const data = await response.json();
        console.log(`[YouTubeSearch] OK ${instance}${path}`);
        return data;
      }
      console.log(`[YouTubeSearch] ${instance} → ${response.status}`);
    } catch (error: any) {
      console.log(`[YouTubeSearch] ${instance} failed: ${error?.message ?? error}`);
    }
  }
  throw new Error('All API instances unavailable. Please try again.');
}

async function searchYouTubePiped(query: string): Promise<YouTubeSearchResult[]> {
  const data = await pipedFetch(
    `/search?q=${encodeURIComponent(query)}&filter=videos`,
  );

  const items: any[] = data.items || data || [];

  const results: YouTubeSearchResult[] = items
    .filter((item: any) => item.type === 'stream' && !item.isShort && (item.duration ?? 0) > 30)
    .slice(0, 20)
    .map((item: any) => {
      const videoId = (item.url || '').replace('/watch?v=', '');
      return {
        videoId,
        title: item.title || 'Untitled',
        channel: item.uploaderName || 'Unknown',
        thumbnailUrl:
          item.thumbnail || `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
        durationSeconds: item.duration || 0,
        views: item.views || 0,
        uploadedDate: item.uploadedDate || '',
        hasTranscript: null,
      };
    });

  console.log(`[YouTubeSearch] Found ${results.length} results via Piped for "${query}"`);
  return results;
}

export async function searchYouTube(query: string, frenchBias = true): Promise<YouTubeSearchResult[]> {
  if (YOUTUBE_API_KEY) {
    try {
      return await searchYouTubeOfficial(query, frenchBias);
    } catch (err: any) {
      console.warn('[YouTubeSearch] YouTube API failed, falling back to Piped:', err?.message);
    }
  }

  return await searchYouTubePiped(query);
}

export async function checkVideoTranscript(_videoId: string): Promise<boolean> {
  return true;
}

export async function checkTranscriptsBatch(
  videoIds: string[],
  onProgress?: (videoId: string, hasTranscript: boolean) => void,
): Promise<Map<string, boolean>> {
  const results = new Map<string, boolean>();
  for (const id of videoIds) {
    results.set(id, true);
    onProgress?.(id, true);
  }
  console.log(`[YouTubeSearch] Batch transcript check: marking all ${videoIds.length} as available (Supadata handles availability)`);
  return results;
}

export async function fetchYouTubeTranscript(
  videoId: string,
  preferOriginalLanguage = false,
  onMethodChange?: (method: string, step: number, total: number) => void,
): Promise<TranscriptSegment[]> {
  console.log(`[YouTubeSearch] Fetching transcript for ${videoId} (preferOriginal=${preferOriginalLanguage})`);

  const backendUrl = getBackendUrl();

  if (!backendUrl) {
    console.error('[YouTubeSearch] No backend URL configured — transcripts require server');
    onMethodChange?.('No server available', 1, 1);
    return [];
  }

  onMethodChange?.('Fetching transcript via Supadata', 1, 1);

  const lang = preferOriginalLanguage ? 'en' : 'fr';

  try {
    const url = `${backendUrl}/youtube-transcript?videoId=${encodeURIComponent(videoId)}&lang=${lang}`;
    console.log(`[YouTubeSearch] Requesting transcript: ${url}`);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      const segments: TranscriptSegment[] = data.segments || [];
      const source = data.source || 'unknown';
      console.log(`[YouTubeSearch] Got ${segments.length} segments (source: ${source})`);
      if (segments.length > 0) {
        onMethodChange?.(`Loaded (${source})`, 1, 1);
        return segments;
      }
    } else {
      const errText = await res.text().catch(() => '');
      console.log(`[YouTubeSearch] Backend returned ${res.status}: ${errText.substring(0, 200)}`);
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      console.log('[YouTubeSearch] Request timed out after 30s');
    } else {
      console.log(`[YouTubeSearch] Transcript error: ${err?.message}`);
    }
  }

  onMethodChange?.('No transcript available', 1, 1);
  console.log('[YouTubeSearch] No transcript found');
  return [];
}

export async function translateTranscriptToFrench(
  segments: TranscriptSegment[],
): Promise<TranscriptSegment[]> {
  if (segments.length === 0) return segments;

  const BATCH_SIZE = 10;
  const result: TranscriptSegment[] = [...segments];

  for (let i = 0; i < segments.length; i += BATCH_SIZE) {
    const batch = segments.slice(i, Math.min(i + BATCH_SIZE, segments.length));
    const numbered = batch.map((s, idx) => `[${i + idx}] ${s.text}`).join('\n');

    try {
      const response = await generateText({
        messages: [
          {
            role: 'user',
            content: `Translate each numbered subtitle line below into French. Return ONLY the translated lines in the exact same [number] format. Keep translations natural and conversational. Do not add any extra text.\n\n${numbered}`,
          },
        ],
      });

      const lines = response.trim().split('\n');
      for (const line of lines) {
        const match = line.match(/^\[(\d+)\]\s*(.+)/);
        if (match) {
          const idx = parseInt(match[1], 10);
          const text = match[2].trim();
          if (idx >= 0 && idx < result.length && text) {
            result[idx] = { ...result[idx], text };
          }
        }
      }

      console.log(
        `[YouTubeSearch] Translated batch ${i}-${Math.min(i + BATCH_SIZE, segments.length)} of ${segments.length}`,
      );
    } catch (error) {
      console.error(`[YouTubeSearch] Translation batch ${i} failed:`, error);
    }
  }

  return result;
}

export type TranscriptSource = 'native_french' | 'youtube_auto_translate' | 'ai_translated';

export interface FrenchTranscriptResult {
  segments: TranscriptSegment[];
  transcriptSource: TranscriptSource;
}

async function fetchNativeFrenchTranscript(
  videoId: string,
): Promise<TranscriptSegment[] | null> {
  const backendUrl = getBackendUrl();
  if (!backendUrl) return null;

  try {
    const url = `${backendUrl}/youtube-transcript?videoId=${encodeURIComponent(videoId)}&lang=fr`;
    console.log('[FrenchTranscript] Step 1: Trying native French subs via Supadata');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) {
      console.log(`[FrenchTranscript] Native French: backend returned ${res.status}`);
      return null;
    }

    const data = await res.json();
    const segments: TranscriptSegment[] = data.segments || [];
    const source: string = data.source || '';

    if (segments.length > 0 && source.includes('fr')) {
      console.log(`[FrenchTranscript] Native French found: ${segments.length} segments (source: ${source})`);
      return segments;
    }

    console.log(`[FrenchTranscript] Native French: no French segments (source: ${source}, count: ${segments.length})`);
    return null;
  } catch (err: any) {
    console.log(`[FrenchTranscript] Native French error: ${err?.message}`);
    return null;
  }
}

async function fetchAutoTranslatedFrench(
  videoId: string,
): Promise<TranscriptSegment[] | null> {
  const backendUrl = getBackendUrl();
  if (!backendUrl) return null;

  try {
    const url = `${backendUrl}/youtube-transcript-translate?videoId=${encodeURIComponent(videoId)}&lang=fr`;
    console.log('[FrenchTranscript] Step 2: Trying Supadata auto-translate to French');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) {
      console.log(`[FrenchTranscript] Auto-translate: backend returned ${res.status}`);
      return null;
    }

    const data = await res.json();
    const segments: TranscriptSegment[] = data.segments || [];

    if (segments.length > 0) {
      console.log(`[FrenchTranscript] Auto-translate success: ${segments.length} segments`);
      return segments;
    }

    console.log('[FrenchTranscript] Auto-translate: no segments returned');
    return null;
  } catch (err: any) {
    console.log(`[FrenchTranscript] Auto-translate error: ${err?.message}`);
    return null;
  }
}

async function fetchEnglishAndTranslateWithAI(
  videoId: string,
  onProgress?: (translated: number, total: number, partialSegments: TranscriptSegment[]) => void,
): Promise<TranscriptSegment[] | null> {
  const backendUrl = getBackendUrl();
  if (!backendUrl) return null;

  try {
    const url = `${backendUrl}/youtube-transcript?videoId=${encodeURIComponent(videoId)}&lang=en`;
    console.log('[FrenchTranscript] Step 3: Fetching English transcript for AI translation');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) {
      console.log(`[FrenchTranscript] English fetch: backend returned ${res.status}`);
      return null;
    }

    const data = await res.json();
    const englishSegments: TranscriptSegment[] = data.segments || [];

    if (englishSegments.length === 0) {
      console.log('[FrenchTranscript] English fetch: no segments');
      return null;
    }

    console.log(`[FrenchTranscript] Got ${englishSegments.length} English segments, starting AI translation`);

    const BATCH_SIZE = 10;
    const result: TranscriptSegment[] = [...englishSegments];
    let translatedCount = 0;

    for (let i = 0; i < englishSegments.length; i += BATCH_SIZE) {
      const batch = englishSegments.slice(i, Math.min(i + BATCH_SIZE, englishSegments.length));
      const numbered = batch.map((s, idx) => `[${i + idx}] ${s.text}`).join('\n');

      try {
        const response = await generateText({
          messages: [
            {
              role: 'user',
              content: `Translate each numbered subtitle line below into French. Return ONLY the translated lines in the exact same [number] format. Keep translations natural and conversational. Do not add any extra text.\n\n${numbered}`,
            },
          ],
        });

        const lines = response.trim().split('\n');
        for (const line of lines) {
          const match = line.match(/^\[(\d+)\]\s*(.+)/);
          if (match) {
            const idx = parseInt(match[1], 10);
            const text = match[2].trim();
            if (idx >= 0 && idx < result.length && text) {
              result[idx] = { ...result[idx], text };
            }
          }
        }

        translatedCount = Math.min(i + BATCH_SIZE, englishSegments.length);
        console.log(`[FrenchTranscript] AI translated batch ${i}-${translatedCount} of ${englishSegments.length}`);

        onProgress?.(translatedCount, englishSegments.length, [...result]);
      } catch (error) {
        console.error(`[FrenchTranscript] AI translation batch ${i} failed:`, error);
      }
    }

    return result;
  } catch (err: any) {
    console.log(`[FrenchTranscript] English+AI error: ${err?.message}`);
    return null;
  }
}

const CACHE_KEY_PREFIX = 'transcript_fr_';

interface CachedTranscript {
  segments: TranscriptSegment[];
  transcriptSource: TranscriptSource;
  cachedAt: number;
  videoId: string;
}

async function getCachedTranscript(videoId: string): Promise<FrenchTranscriptResult | null> {
  try {
    const raw = await AsyncStorage.getItem(`${CACHE_KEY_PREFIX}${videoId}`);
    if (!raw) return null;
    const cached: CachedTranscript = JSON.parse(raw);
    if (cached.segments && cached.segments.length > 0) {
      console.log(`[TranslationCache] Cache hit for ${videoId} (source: ${cached.transcriptSource}, cached: ${new Date(cached.cachedAt).toISOString()})`);
      return { segments: cached.segments, transcriptSource: cached.transcriptSource };
    }
    return null;
  } catch (err: any) {
    console.log(`[TranslationCache] Cache read error for ${videoId}: ${err?.message}`);
    return null;
  }
}

async function setCachedTranscript(videoId: string, result: FrenchTranscriptResult): Promise<void> {
  try {
    const entry: CachedTranscript = {
      segments: result.segments,
      transcriptSource: result.transcriptSource,
      cachedAt: Date.now(),
      videoId,
    };
    await AsyncStorage.setItem(`${CACHE_KEY_PREFIX}${videoId}`, JSON.stringify(entry));
    console.log(`[TranslationCache] Cached ${result.segments.length} segments for ${videoId} (source: ${result.transcriptSource})`);
  } catch (err: any) {
    console.log(`[TranslationCache] Cache write error for ${videoId}: ${err?.message}`);
  }
}

export async function clearTranslationCache(): Promise<void> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const cacheKeys = allKeys.filter((k) => k.startsWith(CACHE_KEY_PREFIX));
    if (cacheKeys.length > 0) {
      await AsyncStorage.multiRemove(cacheKeys);
      console.log(`[TranslationCache] Cleared ${cacheKeys.length} cached transcripts`);
    } else {
      console.log('[TranslationCache] No cached transcripts to clear');
    }
  } catch (err: any) {
    console.log(`[TranslationCache] Clear error: ${err?.message}`);
  }
}

export async function fetchFrenchTranscriptForEnglishVideo(
  videoId: string,
  onMethodChange?: (method: string, step: number, total: number) => void,
  onProgressiveUpdate?: (translated: number, total: number, partialSegments: TranscriptSegment[]) => void,
): Promise<FrenchTranscriptResult> {
  console.log(`[FrenchTranscript] Starting waterfall for video: ${videoId}`);

  const cached = await getCachedTranscript(videoId);
  if (cached) {
    onMethodChange?.(`Loaded from cache (${cached.transcriptSource})`, 1, 1);
    return cached;
  }

  onMethodChange?.('Checking for French subtitles...', 1, 3);
  const nativeFrench = await fetchNativeFrenchTranscript(videoId);
  if (nativeFrench && nativeFrench.length > 0) {
    onMethodChange?.('Found native French subtitles', 1, 3);
    const result: FrenchTranscriptResult = { segments: nativeFrench, transcriptSource: 'native_french' };
    void setCachedTranscript(videoId, result);
    return result;
  }

  onMethodChange?.('Trying auto-translated French...', 2, 3);
  const autoTranslated = await fetchAutoTranslatedFrench(videoId);
  if (autoTranslated && autoTranslated.length > 0) {
    onMethodChange?.('Loaded auto-translated French subtitles', 2, 3);
    const result: FrenchTranscriptResult = { segments: autoTranslated, transcriptSource: 'youtube_auto_translate' };
    void setCachedTranscript(videoId, result);
    return result;
  }

  onMethodChange?.('Translating English subtitles to French...', 3, 3);
  const aiTranslated = await fetchEnglishAndTranslateWithAI(videoId, onProgressiveUpdate);
  if (aiTranslated && aiTranslated.length > 0) {
    onMethodChange?.('AI translation complete', 3, 3);
    const result: FrenchTranscriptResult = { segments: aiTranslated, transcriptSource: 'ai_translated' };
    void setCachedTranscript(videoId, result);
    return result;
  }

  onMethodChange?.('No subtitles available', 3, 3);
  console.log('[FrenchTranscript] All methods failed for video:', videoId);
  return { segments: [], transcriptSource: 'ai_translated' };
}

export function formatSearchDuration(seconds: number): string {
  if (seconds <= 0) return '0:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0)
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function formatViews(views: number): string {
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M views`;
  if (views >= 1_000) return `${Math.floor(views / 1_000)}K views`;
  if (views > 0) return `${views} views`;
  return '';
}

export const TRENDING_CATEGORIES: { id: string; name: string; emoji: string }[] = [
  { id: '10', name: 'Music', emoji: '🎵' },
  { id: '24', name: 'Entertainment', emoji: '🎬' },
  { id: '17', name: 'Sports', emoji: '⚽' },
  { id: '27', name: 'Education', emoji: '📚' },
];

export interface TrendingVideo {
  videoId: string;
  title: string;
  channel: string;
  thumbnailUrl: string;
  views: number;
  publishedAt: string;
  durationSeconds: number;
}

const TRENDING_CACHE_PREFIX = 'trending_fr_';
const TRENDING_TTL_MS = 3 * 60 * 60 * 1000;

interface TrendingCacheEntry {
  videos: TrendingVideo[];
  cachedAt: number;
}

async function getCachedTrending(categoryId: string): Promise<TrendingVideo[] | null> {
  try {
    const raw = await AsyncStorage.getItem(`${TRENDING_CACHE_PREFIX}${categoryId}`);
    if (!raw) return null;
    const entry: TrendingCacheEntry = JSON.parse(raw);
    if (Date.now() - entry.cachedAt > TRENDING_TTL_MS) {
      console.log(`[Trending] Cache expired for category ${categoryId}`);
      return null;
    }
    console.log(`[Trending] Cache hit for category ${categoryId} (${entry.videos.length} videos)`);
    return entry.videos;
  } catch (err: any) {
    console.log(`[Trending] Cache read error: ${err?.message}`);
    return null;
  }
}

async function setCachedTrending(categoryId: string, videos: TrendingVideo[]): Promise<void> {
  try {
    const entry: TrendingCacheEntry = { videos, cachedAt: Date.now() };
    await AsyncStorage.setItem(`${TRENDING_CACHE_PREFIX}${categoryId}`, JSON.stringify(entry));
    console.log(`[Trending] Cached ${videos.length} videos for category ${categoryId}`);
  } catch (err: any) {
    console.log(`[Trending] Cache write error: ${err?.message}`);
  }
}

export async function fetchTrendingInFrance(
  categoryId?: string,
  ignoreCache = false,
): Promise<TrendingVideo[]> {
  const cacheKey = categoryId || 'all';

  if (!ignoreCache) {
    const cached = await getCachedTrending(cacheKey);
    if (cached) return cached;
  }

  if (!YOUTUBE_API_KEY) {
    console.warn('[Trending] No YouTube API key configured');
    return [];
  }

  try {
    const catParam = categoryId ? `&videoCategoryId=${categoryId}` : '';
    const url = `${YOUTUBE_API_BASE}/videos?part=snippet,contentDetails,statistics&chart=mostPopular&regionCode=FR&maxResults=20${catParam}&key=${YOUTUBE_API_KEY}`;
    console.log(`[Trending] Fetching trending for category ${cacheKey}`);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      console.error(`[Trending] API error ${res.status}: ${errBody.substring(0, 200)}`);
      return [];
    }

    const data = await res.json();
    const items: any[] = data.items || [];

    const videos: TrendingVideo[] = items.map((item: any) => ({
      videoId: item.id,
      title: item.snippet?.title || 'Untitled',
      channel: item.snippet?.channelTitle || 'Unknown',
      thumbnailUrl:
        item.snippet?.thumbnails?.medium?.url ||
        item.snippet?.thumbnails?.default?.url ||
        `https://img.youtube.com/vi/${item.id}/mqdefault.jpg`,
      views: parseViewCount(item.statistics?.viewCount),
      publishedAt: formatRelativeDate(item.snippet?.publishedAt || ''),
      durationSeconds: parseISO8601Duration(item.contentDetails?.duration || ''),
    }));

    console.log(`[Trending] Got ${videos.length} trending videos for category ${cacheKey}`);
    void setCachedTrending(cacheKey, videos);
    return videos;
  } catch (err: any) {
    console.error(`[Trending] Fetch error: ${err?.message}`);
    return [];
  }
}
