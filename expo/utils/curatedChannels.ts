import AsyncStorage from '@react-native-async-storage/async-storage';

const YOUTUBE_API_KEY = process.env.EXPO_PUBLIC_YOUTUBE_API_KEY || '';
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

export interface CuratedChannel {
  channelId: string;
  name: string;
  category: string;
  thumbnailUrl: string;
}

export const CURATED_CHANNELS: CuratedChannel[] = [
  {
    channelId: 'UCGXrzaStMdCaRLsBnJBFkuQ',
    name: 'Squeezie',
    category: 'Comedy',
    thumbnailUrl: 'https://yt3.googleusercontent.com/DfBMsJFAAOaMGVJaEJTk1HLSMsd_JlAl3p3S7blsTDWpci5bTad1hJCXQq2XCKbsjZ0gyno-mg=s176-c-k-c0x00ffffff-no-rj',
  },
  {
    channelId: 'UCyWqModMQlbIo8274Wh_ZsQ',
    name: 'Cyprien',
    category: 'Comedy',
    thumbnailUrl: 'https://yt3.googleusercontent.com/user_avatar/UCyWqModMQlbIo8274Wh_ZsQ/176',
  },
  {
    channelId: 'UCQfwfsi5VrQ8yKZ-UWmAEFg',
    name: 'France 24',
    category: 'News',
    thumbnailUrl: 'https://yt3.googleusercontent.com/9kLPHTfgM4fMG_FTRSykHAGMqAx9lFCHNhuOxrTm-gg63VFX2BKQOIDQ3VKIWP60fN8F0XYxYQ=s176-c-k-c0x00ffffff-no-rj',
  },
  {
    channelId: 'UCP46_MXP_WG_auH88FnfS1A',
    name: 'Nota Bene',
    category: 'Education',
    thumbnailUrl: 'https://yt3.googleusercontent.com/ytc/AIdro_lDbrpRjtY9t1aGag-dDC91x3MxDVFDP9YeSaEOXJFExg=s176-c-k-c0x00ffffff-no-rj',
  },
  {
    channelId: 'UCWnfDPdZw6A23UtuBpYBbAg',
    name: 'Dr Nozman',
    category: 'Science',
    thumbnailUrl: 'https://yt3.googleusercontent.com/ytc/AIdro_nL8z5v3ZEhB45xmpSPDM6maRxMSJuYMR24D3PYdSoYPA=s176-c-k-c0x00ffffff-no-rj',
  },
  {
    channelId: 'UCJGMf9eKBc8PEaHDzMIIBKg',
    name: "L'Equipe",
    category: 'Sports',
    thumbnailUrl: 'https://yt3.googleusercontent.com/ytc/AIdro_kW0H9t_sYm6Y6jl3jVH9GV3mdNxLm2_7P2N-dkhP-d4Q=s176-c-k-c0x00ffffff-no-rj',
  },
];

export interface ChannelVideo {
  videoId: string;
  title: string;
  thumbnailUrl: string;
  publishedAt: string;
}

export interface ChannelWithVideos {
  channel: CuratedChannel;
  videos: ChannelVideo[];
  isLoading: boolean;
}

const CHANNEL_CACHE_PREFIX = 'channel_';
const CHANNEL_TTL_MS = 6 * 60 * 60 * 1000;

interface ChannelCacheEntry {
  videos: ChannelVideo[];
  cachedAt: number;
}

async function getCachedChannelVideos(channelId: string): Promise<ChannelVideo[] | null> {
  try {
    const raw = await AsyncStorage.getItem(`${CHANNEL_CACHE_PREFIX}${channelId}`);
    if (!raw) return null;
    const entry: ChannelCacheEntry = JSON.parse(raw);
    if (Date.now() - entry.cachedAt > CHANNEL_TTL_MS) {
      console.log(`[CuratedChannels] Cache expired for ${channelId}`);
      return null;
    }
    console.log(`[CuratedChannels] Cache hit for ${channelId} (${entry.videos.length} videos)`);
    return entry.videos;
  } catch (err: any) {
    console.log(`[CuratedChannels] Cache read error: ${err?.message}`);
    return null;
  }
}

async function setCachedChannelVideos(channelId: string, videos: ChannelVideo[]): Promise<void> {
  try {
    const entry: ChannelCacheEntry = { videos, cachedAt: Date.now() };
    await AsyncStorage.setItem(`${CHANNEL_CACHE_PREFIX}${channelId}`, JSON.stringify(entry));
    console.log(`[CuratedChannels] Cached ${videos.length} videos for ${channelId}`);
  } catch (err: any) {
    console.log(`[CuratedChannels] Cache write error: ${err?.message}`);
  }
}

export async function fetchChannelLatestVideos(
  channelId: string,
  maxResults: number = 5,
  ignoreCache = false,
): Promise<ChannelVideo[]> {
  if (!ignoreCache) {
    const cached = await getCachedChannelVideos(channelId);
    if (cached) return cached;
  }

  if (!YOUTUBE_API_KEY) {
    console.warn('[CuratedChannels] No YouTube API key configured');
    return [];
  }

  try {
    const url = `${YOUTUBE_API_BASE}/search?part=snippet&channelId=${channelId}&order=date&type=video&maxResults=${maxResults}&key=${YOUTUBE_API_KEY}`;
    console.log(`[CuratedChannels] Fetching latest videos for channel ${channelId}`);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      console.error(`[CuratedChannels] API error ${res.status}: ${errBody.substring(0, 200)}`);
      return [];
    }

    const data = await res.json();
    const items: any[] = data.items || [];

    const videos: ChannelVideo[] = items.map((item: any) => ({
      videoId: item.id?.videoId || '',
      title: item.snippet?.title || 'Untitled',
      thumbnailUrl:
        item.snippet?.thumbnails?.medium?.url ||
        item.snippet?.thumbnails?.default?.url ||
        `https://img.youtube.com/vi/${item.id?.videoId}/mqdefault.jpg`,
      publishedAt: item.snippet?.publishedAt || '',
    })).filter((v) => v.videoId);

    console.log(`[CuratedChannels] Got ${videos.length} videos for channel ${channelId}`);
    void setCachedChannelVideos(channelId, videos);
    return videos;
  } catch (err: any) {
    console.error(`[CuratedChannels] Fetch error for ${channelId}: ${err?.message}`);
    return [];
  }
}

export function pickRandomChannels(count: number = 4): CuratedChannel[] {
  const shuffled = [...CURATED_CHANNELS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}
