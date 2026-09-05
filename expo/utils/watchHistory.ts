import AsyncStorage from '@react-native-async-storage/async-storage';

const WATCH_HISTORY_KEY = 'watch_history';
const MAX_HISTORY_SIZE = 100;

export interface WatchedVideo {
  videoId: string;
  title: string;
  channelId: string;
  channelTitle: string;
  categoryId: string;
  thumbnailUrl: string;
  duration: number;
  timestamp: number;
  lastPosition: number;
}

export async function recordWatchedVideo(video: Omit<WatchedVideo, 'lastPosition'> & { lastPosition?: number }): Promise<void> {
  try {
    const history = await getWatchHistory();
    const existingIndex = history.findIndex((v) => v.videoId === video.videoId);

    const entry: WatchedVideo = {
      ...video,
      lastPosition: video.lastPosition ?? 0,
      timestamp: Date.now(),
    };

    if (existingIndex >= 0) {
      history.splice(existingIndex, 1);
    }

    history.unshift(entry);

    const trimmed = history.slice(0, MAX_HISTORY_SIZE);
    await AsyncStorage.setItem(WATCH_HISTORY_KEY, JSON.stringify(trimmed));
    console.log(`[WatchHistory] Recorded video: ${video.videoId} (${video.title})`);
  } catch (err: any) {
    console.error(`[WatchHistory] Failed to record video: ${err?.message}`);
  }
}

export async function updateWatchPosition(videoId: string, position: number): Promise<void> {
  try {
    const history = await getWatchHistory();
    const entry = history.find((v) => v.videoId === videoId);
    if (entry) {
      entry.lastPosition = position;
      entry.timestamp = Date.now();
      await AsyncStorage.setItem(WATCH_HISTORY_KEY, JSON.stringify(history));
    }
  } catch (err: any) {
    console.error(`[WatchHistory] Failed to update position: ${err?.message}`);
  }
}

export async function getWatchHistory(): Promise<WatchedVideo[]> {
  try {
    const raw = await AsyncStorage.getItem(WATCH_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as WatchedVideo[];
  } catch (err: any) {
    console.error(`[WatchHistory] Failed to read history: ${err?.message}`);
    return [];
  }
}

export async function getRecentlyWatchedVideoIds(count: number): Promise<string[]> {
  const history = await getWatchHistory();
  const seen = new Set<string>();
  const result: string[] = [];
  for (const v of history) {
    if (!seen.has(v.videoId)) {
      seen.add(v.videoId);
      result.push(v.videoId);
      if (result.length >= count) break;
    }
  }
  return result;
}

interface ChannelFrequency {
  channelId: string;
  channelTitle: string;
  count: number;
}

export async function getMostWatchedChannels(): Promise<ChannelFrequency[]> {
  const history = await getWatchHistory();
  const channelMap = new Map<string, { channelTitle: string; count: number }>();

  for (const v of history) {
    if (!v.channelId) continue;
    const existing = channelMap.get(v.channelId);
    if (existing) {
      existing.count += 1;
    } else {
      channelMap.set(v.channelId, { channelTitle: v.channelTitle, count: 1 });
    }
  }

  const result: ChannelFrequency[] = [];
  for (const [channelId, data] of channelMap) {
    result.push({ channelId, channelTitle: data.channelTitle, count: data.count });
  }

  result.sort((a, b) => b.count - a.count);
  return result;
}

interface CategoryFrequency {
  categoryId: string;
  count: number;
}

export async function getCategoryPreferences(): Promise<CategoryFrequency[]> {
  const history = await getWatchHistory();
  const catMap = new Map<string, number>();

  for (const v of history) {
    if (!v.categoryId) continue;
    catMap.set(v.categoryId, (catMap.get(v.categoryId) ?? 0) + 1);
  }

  const result: CategoryFrequency[] = [];
  for (const [categoryId, count] of catMap) {
    result.push({ categoryId, count });
  }

  result.sort((a, b) => b.count - a.count);
  return result;
}

export function getContinueWatchingVideos(history: WatchedVideo[]): WatchedVideo[] {
  return history.filter((v) => {
    if (v.duration <= 0) return false;
    const progress = v.lastPosition / v.duration;
    return progress > 0.02 && progress < 0.8;
  });
}

export async function clearWatchHistory(): Promise<void> {
  try {
    await AsyncStorage.removeItem(WATCH_HISTORY_KEY);
    console.log('[WatchHistory] History cleared');
  } catch (err: any) {
    console.error(`[WatchHistory] Failed to clear history: ${err?.message}`);
  }
}
