import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Animated,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Play,
  Search,
  ChevronLeft,
  Captions,
  MonitorPlay,
  TrendingUp,
  Eye,
  ChevronRight,
  Flame,
  History,
  Sparkles,
  User,
  X,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { USE_NATIVE_DRIVER } from '@/constants/animation';
import AnimatedPressable from '@/components/AnimatedPressable';
import {
  fetchTrendingInFrance,
  TrendingVideo,
  TRENDING_CATEGORIES,
  formatViews,
  formatSearchDuration,
} from '@/utils/youtubeSearch';
import {
  pickRandomChannels,
  fetchChannelLatestVideos,
  ChannelWithVideos,
  CuratedChannel,
} from '@/utils/curatedChannels';
import {
  getWatchHistory,
  getContinueWatchingVideos,
  getMostWatchedChannels,
  getCategoryPreferences,
  WatchedVideo,
} from '@/utils/watchHistory';

const YOUTUBE_API_KEY = process.env.EXPO_PUBLIC_YOUTUBE_API_KEY || '';
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CAROUSEL_CARD_WIDTH = SCREEN_WIDTH * 0.72;
const CAROUSEL_CARD_GAP = 12;
const CONTINUE_CARD_WIDTH = SCREEN_WIDTH * 0.42;
const CREATOR_THUMB_SIZE = 110;
const CREATOR_THUMB_GAP = 10;

const SUBTITLES_BANNER_DISMISSED_KEY = 'subtitles_banner_dismissed';

const SUGGESTED_SEARCHES = [
  { query: 'apprendre le français', label: 'Learn French' },
  { query: 'film français complet', label: 'French Films' },
  { query: 'podcast français facile', label: 'Easy Podcasts' },
  { query: 'actualités france', label: 'French News' },
  { query: 'cuisine française recette', label: 'French Recipes' },
  { query: 'musique française 2025', label: 'French Music' },
];

interface TrendingSection {
  categoryId: string;
  categoryName: string;
  emoji: string;
  videos: TrendingVideo[];
  isLoading: boolean;
}

interface RelatedVideo {
  videoId: string;
  title: string;
  channel: string;
  thumbnailUrl: string;
}

interface ChannelUploads {
  channelId: string;
  channelTitle: string;
  videos: RelatedVideo[];
  isLoading: boolean;
}

async function fetchRelatedVideos(videoId: string): Promise<RelatedVideo[]> {
  if (!YOUTUBE_API_KEY) return [];
  try {
    const url = `${YOUTUBE_API_BASE}/search?part=snippet&relatedToVideoId=${videoId}&type=video&maxResults=8&key=${YOUTUBE_API_KEY}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return [];
    const data = await res.json();
    const items: any[] = data.items || [];
    return items
      .filter((item: any) => item.id?.videoId)
      .map((item: any) => ({
        videoId: item.id.videoId,
        title: item.snippet?.title || 'Untitled',
        channel: item.snippet?.channelTitle || '',
        thumbnailUrl:
          item.snippet?.thumbnails?.medium?.url ||
          `https://img.youtube.com/vi/${item.id.videoId}/mqdefault.jpg`,
      }));
  } catch (err: any) {
    console.log(`[WatchHome] Related videos fetch failed: ${err?.message}`);
    return [];
  }
}

async function fetchChannelUploads(channelId: string, maxResults = 6): Promise<RelatedVideo[]> {
  if (!YOUTUBE_API_KEY) return [];
  try {
    const url = `${YOUTUBE_API_BASE}/search?part=snippet&channelId=${channelId}&order=date&type=video&maxResults=${maxResults}&key=${YOUTUBE_API_KEY}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return [];
    const data = await res.json();
    const items: any[] = data.items || [];
    return items
      .filter((item: any) => item.id?.videoId)
      .map((item: any) => ({
        videoId: item.id.videoId,
        title: item.snippet?.title || 'Untitled',
        channel: item.snippet?.channelTitle || '',
        thumbnailUrl:
          item.snippet?.thumbnails?.medium?.url ||
          `https://img.youtube.com/vi/${item.id.videoId}/mqdefault.jpg`,
      }));
  } catch (err: any) {
    console.log(`[WatchHome] Channel uploads fetch failed: ${err?.message}`);
    return [];
  }
}

export default function WatchBrowseScreen() {
  const router = useRouter();
  const [nativeMode, setNativeMode] = useState(false);
  const [trendingSections, setTrendingSections] = useState<TrendingSection[]>(
    TRENDING_CATEGORIES.map((c) => ({
      categoryId: c.id,
      categoryName: c.name,
      emoji: c.emoji,
      videos: [],
      isLoading: true,
    }))
  );
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [featuredCreators, setFeaturedCreators] = useState<ChannelWithVideos[]>([]);
  const [creatorsLoading, setCreatorsLoading] = useState(true);
  const selectedChannelsRef = useRef<CuratedChannel[]>(pickRandomChannels(4));

  const [continueWatching, setContinueWatching] = useState<WatchedVideo[]>([]);
  const [relatedVideos, setRelatedVideos] = useState<RelatedVideo[]>([]);
  const [relatedSourceTitle, setRelatedSourceTitle] = useState('');
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [channelUploads, setChannelUploads] = useState<ChannelUploads | null>(null);
  const [categoryOrder, setCategoryOrder] = useState<string[]>([]);
  const [showSubtitlesBanner, setShowSubtitlesBanner] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const headerAnim = useRef(new Animated.Value(0)).current;
  const chipScaleFR = useRef(new Animated.Value(1)).current;
  const chipScaleCC = useRef(new Animated.Value(1)).current;

  const checkSubtitlesBanner = useCallback(async () => {
    try {
      const dismissed = await AsyncStorage.getItem(SUBTITLES_BANNER_DISMISSED_KEY);
      if (dismissed === 'true') {
        setShowSubtitlesBanner(false);
        return;
      }
      const history = await getWatchHistory();
      const frenchContentCount = history.filter((v) => v.videoId).length;
      console.log(`[WatchHome] Watch history count for banner check: ${frenchContentCount}`);
      setShowSubtitlesBanner(frenchContentCount >= 2);
    } catch (err: any) {
      console.error('[WatchHome] Banner check error:', err?.message);
    }
  }, []);

  const dismissSubtitlesBanner = useCallback(async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowSubtitlesBanner(false);
    try {
      await AsyncStorage.setItem(SUBTITLES_BANNER_DISMISSED_KEY, 'true');
      console.log('[WatchHome] Subtitles banner dismissed');
    } catch (err: any) {
      console.error('[WatchHome] Failed to persist banner dismiss:', err?.message);
    }
  }, []);

  const handleSubtitlesBannerCTA = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/youtube-search?mode=subtitles' as never);
  }, [router]);

  const loadWatchHistory = useCallback(async () => {
    console.log('[WatchHome] Loading watch history...');
    try {
      const history = await getWatchHistory();
      const continueList = getContinueWatchingVideos(history);
      setContinueWatching(continueList.slice(0, 10));

      if (history.length > 0) {
        const mostRecent = history[0];
        setRelatedSourceTitle(mostRecent.title);
        setRelatedLoading(true);
        void fetchRelatedVideos(mostRecent.videoId).then((videos) => {
          setRelatedVideos(videos);
          setRelatedLoading(false);
          console.log(`[WatchHome] Got ${videos.length} related videos for "${mostRecent.title}"`);
        });
      }

      const topChannels = await getMostWatchedChannels();
      const frequentChannel = topChannels.find((ch) => ch.count >= 2);
      if (frequentChannel) {
        setChannelUploads({
          channelId: frequentChannel.channelId,
          channelTitle: frequentChannel.channelTitle,
          videos: [],
          isLoading: true,
        });
        void fetchChannelUploads(frequentChannel.channelId).then((videos) => {
          setChannelUploads((prev) =>
            prev ? { ...prev, videos, isLoading: false } : null
          );
          console.log(`[WatchHome] Got ${videos.length} uploads for "${frequentChannel.channelTitle}"`);
        });
      } else {
        setChannelUploads(null);
      }

      const catPrefs = await getCategoryPreferences();
      if (catPrefs.length > 0) {
        setCategoryOrder(catPrefs.map((c) => c.categoryId));
        console.log('[WatchHome] Category order:', catPrefs.map((c) => c.categoryId).join(', '));
      }
    } catch (err: any) {
      console.error('[WatchHome] Watch history load error:', err?.message);
    }
  }, []);

  const fetchFeaturedCreators = useCallback(async (ignoreCache = false) => {
    console.log('[WatchHome] Fetching featured creators, ignoreCache:', ignoreCache);
    setCreatorsLoading(true);

    const channels = ignoreCache
      ? pickRandomChannels(4)
      : selectedChannelsRef.current;

    if (ignoreCache) {
      selectedChannelsRef.current = channels;
    }

    setFeaturedCreators(
      channels.map((ch) => ({ channel: ch, videos: [], isLoading: true }))
    );

    const promises = channels.map(async (ch) => {
      try {
        const videos = await fetchChannelLatestVideos(ch.channelId, 5, ignoreCache);
        return { channel: ch, videos, isLoading: false };
      } catch (err: any) {
        console.error(`[WatchHome] Failed to fetch channel ${ch.name}:`, err?.message);
        return { channel: ch, videos: [], isLoading: false };
      }
    });

    const results = await Promise.all(promises);
    setFeaturedCreators(results);
    setCreatorsLoading(false);
  }, []);

  const fetchAllTrending = useCallback(async (ignoreCache = false) => {
    console.log('[WatchHome] Fetching trending for all categories, ignoreCache:', ignoreCache);

    const categories = TRENDING_CATEGORIES;
    const promises = categories.map(async (cat) => {
      try {
        const videos = await fetchTrendingInFrance(cat.id, ignoreCache);
        return { categoryId: cat.id, videos };
      } catch (err: any) {
        console.error(`[WatchHome] Failed to fetch trending for ${cat.name}:`, err?.message);
        return { categoryId: cat.id, videos: [] as TrendingVideo[] };
      }
    });

    const results = await Promise.all(promises);

    setTrendingSections((prev) =>
      prev.map((section) => {
        const result = results.find((r) => r.categoryId === section.categoryId);
        return {
          ...section,
          videos: result?.videos ?? [],
          isLoading: false,
        };
      })
    );
  }, []);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.spring(headerAnim, {
        toValue: 1,
        tension: 40,
        friction: 8,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start();

    void Promise.all([
      loadWatchHistory(),
      fetchFeaturedCreators(false),
      fetchAllTrending(false),
      checkSubtitlesBanner(),
    ]).then(() => setInitialLoad(false));
  }, [fadeAnim, headerAnim, fetchAllTrending, fetchFeaturedCreators, loadWatchHistory, checkSubtitlesBanner]);

  useFocusEffect(
    useCallback(() => {
      void loadWatchHistory();
      void checkSubtitlesBanner();
    }, [loadWatchHistory, checkSubtitlesBanner])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTrendingSections((prev) =>
      prev.map((s) => ({ ...s, isLoading: true }))
    );
    await Promise.all([
      loadWatchHistory(),
      fetchFeaturedCreators(true),
      fetchAllTrending(true),
      checkSubtitlesBanner(),
    ]);
    setRefreshing(false);
  }, [fetchAllTrending, fetchFeaturedCreators, loadWatchHistory, checkSubtitlesBanner]);

  const toggleNativeMode = useCallback(
    (value: boolean) => {
      if (value === nativeMode) return;
      const chipScale = value ? chipScaleCC : chipScaleFR;
      Animated.sequence([
        Animated.spring(chipScale, {
          toValue: 0.92,
          useNativeDriver: USE_NATIVE_DRIVER,
          speed: 50,
          bounciness: 4,
        }),
        Animated.spring(chipScale, {
          toValue: 1,
          useNativeDriver: USE_NATIVE_DRIVER,
          speed: 12,
          bounciness: 8,
        }),
      ]).start();
      setNativeMode(value);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [nativeMode, chipScaleCC, chipScaleFR]
  );

  const handleVideoPress = useCallback(
    (videoId: string, title: string, extra?: { channelId?: string; thumbnailUrl?: string }) => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const nativeParam = nativeMode ? '&nativeMode=1' : '';
      const channelParam = extra?.channelId ? `&channelId=${encodeURIComponent(extra.channelId)}` : '';
      const thumbParam = extra?.thumbnailUrl ? `&thumbnailUrl=${encodeURIComponent(extra.thumbnailUrl)}` : '';
      router.push(
        `/watch-session?videoId=${videoId}&title=${encodeURIComponent(title)}${nativeParam}${channelParam}${thumbParam}` as never
      );
    },
    [router, nativeMode]
  );

  const handleSearchPress = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(
      `/youtube-search${nativeMode ? '?nativeMode=1' : ''}` as never
    );
  }, [router, nativeMode]);

  const handleSuggestedSearch = useCallback(
    (query: string) => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      router.push(
        `/youtube-search?q=${encodeURIComponent(query)}${nativeMode ? '&nativeMode=1' : ''}` as never
      );
    },
    [router, nativeMode]
  );

  const sortedTrendingSections = useMemo(() => {
    if (categoryOrder.length === 0) return trendingSections;
    const sorted = [...trendingSections];
    sorted.sort((a, b) => {
      const aIdx = categoryOrder.indexOf(a.categoryId);
      const bIdx = categoryOrder.indexOf(b.categoryId);
      const aPriority = aIdx >= 0 ? aIdx : 999;
      const bPriority = bIdx >= 0 ? bIdx : 999;
      return aPriority - bPriority;
    });
    return sorted;
  }, [trendingSections, categoryOrder]);

  const renderContinueCard = useCallback(
    (video: WatchedVideo) => {
      const progress = video.duration > 0 ? Math.min(1, video.lastPosition / video.duration) : 0;
      return (
        <AnimatedPressable
          key={video.videoId}
          onPress={() => handleVideoPress(video.videoId, video.title, {
            channelId: video.channelId,
            thumbnailUrl: video.thumbnailUrl,
          })}
          style={styles.continueCard}
        >
          <View style={styles.continueThumbWrap}>
            <Image
              source={{ uri: video.thumbnailUrl }}
              style={styles.continueThumb}
              contentFit="cover"
              transition={200}
            />
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.5)']}
              style={styles.continueThumbGradient}
            />
            <View style={styles.continuePlayIcon}>
              <Play size={14} color="#fff" fill="#fff" />
            </View>
            <View style={styles.progressBarWrap}>
              <View style={styles.progressBarBg} />
              <View style={[styles.progressBarFill, { width: `${progress * 100}%` as any }]} />
            </View>
          </View>
          <Text style={styles.continueTitle} numberOfLines={2}>
            {video.title}
          </Text>
          <Text style={styles.continueChannel} numberOfLines={1}>
            {video.channelTitle}
          </Text>
        </AnimatedPressable>
      );
    },
    [handleVideoPress]
  );

  const renderRelatedCard = useCallback(
    (video: RelatedVideo) => (
      <AnimatedPressable
        key={video.videoId}
        onPress={() => handleVideoPress(video.videoId, video.title)}
        style={styles.relatedCard}
      >
        <View style={styles.relatedThumbWrap}>
          <Image
            source={{ uri: video.thumbnailUrl }}
            style={styles.relatedThumb}
            contentFit="cover"
            transition={200}
          />
          <View style={styles.relatedPlayIcon}>
            <Play size={14} color="#fff" fill="#fff" />
          </View>
        </View>
        <Text style={styles.relatedTitle} numberOfLines={2}>
          {video.title}
        </Text>
        <Text style={styles.relatedChannel} numberOfLines={1}>
          {video.channel}
        </Text>
      </AnimatedPressable>
    ),
    [handleVideoPress]
  );

  const renderTrendingCard = useCallback(
    (video: TrendingVideo) => (
      <AnimatedPressable
        key={video.videoId}
        onPress={() => handleVideoPress(video.videoId, video.title)}
        style={styles.carouselCard}
      >
        <View style={styles.carouselThumbWrap}>
          <Image
            source={{ uri: video.thumbnailUrl }}
            style={styles.carouselThumb}
            contentFit="cover"
            transition={250}
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.6)']}
            style={styles.carouselThumbGradient}
          />
          <View style={styles.carouselDuration}>
            <Text style={styles.carouselDurationText}>
              {formatSearchDuration(video.durationSeconds)}
            </Text>
          </View>
          <View style={styles.carouselPlayBtn}>
            <Play size={18} color="#fff" fill="#fff" />
          </View>
        </View>
        <View style={styles.carouselInfo}>
          <Text style={styles.carouselTitle} numberOfLines={2}>
            {video.title}
          </Text>
          <View style={styles.carouselMeta}>
            <Text style={styles.carouselChannel} numberOfLines={1}>
              {video.channel}
            </Text>
            {video.views > 0 && (
              <View style={styles.carouselViewsRow}>
                <Eye size={10} color={Colors.textMuted} />
                <Text style={styles.carouselViews}>
                  {formatViews(video.views)}
                </Text>
              </View>
            )}
          </View>
        </View>
      </AnimatedPressable>
    ),
    [handleVideoPress]
  );

  const renderSection = useCallback(
    (section: TrendingSection, index: number) => {
      const sectionDelay = index * 80;

      return (
        <Animated.View
          key={section.categoryId}
          style={[
            styles.trendingSection,
            {
              opacity: fadeAnim,
              transform: [
                {
                  translateY: fadeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20 + sectionDelay / 10, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.sectionEmojiWrap}>
                <Text style={styles.sectionEmoji}>{section.emoji}</Text>
              </View>
              <View>
                <Text style={styles.sectionTitle}>
                  Trending {section.categoryName}
                </Text>
                <Text style={styles.sectionSubtitle}>Popular in France</Text>
              </View>
            </View>
            {section.videos.length > 0 && (
              <View style={styles.sectionBadge}>
                <Flame size={11} color={Colors.primary} />
                <Text style={styles.sectionBadgeText}>
                  {section.videos.length}
                </Text>
              </View>
            )}
          </View>

          {section.isLoading ? (
            <View style={styles.sectionLoading}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.sectionLoadingText}>Loading...</Text>
            </View>
          ) : section.videos.length === 0 ? (
            <View style={styles.sectionEmpty}>
              <Text style={styles.sectionEmptyText}>
                No trending videos available
              </Text>
            </View>
          ) : (
            <FlatList
              data={section.videos}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.videoId}
              renderItem={({ item }) => renderTrendingCard(item)}
              contentContainerStyle={styles.carouselScroll}
              ItemSeparatorComponent={() => <View style={{ width: CAROUSEL_CARD_GAP }} />}
              snapToInterval={CAROUSEL_CARD_WIDTH + CAROUSEL_CARD_GAP}
              decelerationRate="fast"
            />
          )}
        </Animated.View>
      );
    },
    [fadeAnim, renderTrendingCard]
  );

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
      >
        <LinearGradient
          colors={['#1A0F0A', '#2D1810', '#1A0F0A']}
          style={styles.header}
        >
          <SafeAreaView edges={['top']}>
            <View style={styles.headerContent}>
              <View style={styles.headerTop}>
                <Pressable
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push('/(tabs)/home' as never);
                  }}
                  style={styles.backButton}
                  hitSlop={12}
                  testID="watch-back-btn"
                >
                  <ChevronLeft size={22} color="#fff" />
                </Pressable>
                <View style={styles.headerTitleWrap}>
                  <Text style={styles.headerTitle}>Watch & Learn</Text>
                  <Text style={styles.headerSubtitle}>
                    Immerse yourself in French video
                  </Text>
                </View>
                <View style={styles.headerIcon}>
                  <MonitorPlay size={28} color={Colors.primary} />
                </View>
              </View>

              <View style={styles.chipBar}>
                <Animated.View style={{ transform: [{ scale: chipScaleFR }] }}>
                  <Pressable
                    onPress={() => toggleNativeMode(false)}
                    style={[
                      styles.filterChip,
                      !nativeMode
                        ? styles.filterChipActive
                        : styles.filterChipInactive,
                    ]}
                    testID="chip-french-content"
                  >
                    <Text style={styles.chipEmoji}>🇫🇷</Text>
                    <Text
                      style={[
                        styles.filterChipText,
                        !nativeMode
                          ? styles.filterChipTextActive
                          : styles.filterChipTextInactive,
                      ]}
                    >
                      French Content
                    </Text>
                  </Pressable>
                </Animated.View>
                <Animated.View style={{ transform: [{ scale: chipScaleCC }] }}>
                  <Pressable
                    onPress={() => toggleNativeMode(true)}
                    style={[
                      styles.filterChip,
                      nativeMode
                        ? styles.filterChipActive
                        : styles.filterChipInactive,
                    ]}
                    testID="chip-learn-subtitles"
                  >
                    <Captions
                      size={14}
                      color={nativeMode ? '#fff' : 'rgba(255,255,255,0.5)'}
                    />
                    <Text
                      style={[
                        styles.filterChipText,
                        nativeMode
                          ? styles.filterChipTextActive
                          : styles.filterChipTextInactive,
                      ]}
                    >
                      Learn with Subtitles
                    </Text>
                  </Pressable>
                </Animated.View>
              </View>

              <Pressable
                style={styles.searchBarFake}
                onPress={handleSearchPress}
                testID="watch-search-bar"
              >
                <Search size={18} color="rgba(255,255,255,0.4)" />
                <Text style={styles.searchBarPlaceholder}>
                  {nativeMode
                    ? 'Search in any language…'
                    : 'Search YouTube in French…'}
                </Text>
                <ChevronRight size={16} color="rgba(255,255,255,0.25)" />
              </Pressable>
            </View>
          </SafeAreaView>
        </LinearGradient>

        {initialLoad && (
          <View style={styles.initialLoader}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.initialLoaderText}>
              Loading trending videos...
            </Text>
          </View>
        )}

        {continueWatching.length > 0 && (
          <Animated.View
            style={[
              styles.historySection,
              {
                opacity: fadeAnim,
                transform: [
                  {
                    translateY: fadeAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [14, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <View style={styles.continueEmojiWrap}>
                  <History size={18} color={Colors.primary} />
                </View>
                <View>
                  <Text style={styles.sectionTitle}>Continue Watching</Text>
                  <Text style={styles.sectionSubtitle}>Pick up where you left off</Text>
                </View>
              </View>
            </View>
            <FlatList
              data={continueWatching}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => `continue-${item.videoId}`}
              renderItem={({ item }) => renderContinueCard(item)}
              contentContainerStyle={styles.carouselScroll}
              ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
            />
          </Animated.View>
        )}

        {relatedSourceTitle && (relatedLoading || relatedVideos.length > 0) && (
          <Animated.View
            style={[
              styles.historySection,
              {
                opacity: fadeAnim,
                transform: [
                  {
                    translateY: fadeAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [14, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <View style={styles.relatedEmojiWrap}>
                  <Sparkles size={18} color="#E67E22" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle} numberOfLines={1}>
                    Because You Watched
                  </Text>
                  <Text style={styles.sectionSubtitle} numberOfLines={1}>
                    {relatedSourceTitle}
                  </Text>
                </View>
              </View>
            </View>
            {relatedLoading ? (
              <View style={styles.sectionLoading}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.sectionLoadingText}>Finding related videos...</Text>
              </View>
            ) : (
              <FlatList
                data={relatedVideos}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => `related-${item.videoId}`}
                renderItem={({ item }) => renderRelatedCard(item)}
                contentContainerStyle={styles.carouselScroll}
                ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
              />
            )}
          </Animated.View>
        )}

        {channelUploads && (channelUploads.isLoading || channelUploads.videos.length > 0) && (
          <Animated.View
            style={[
              styles.historySection,
              {
                opacity: fadeAnim,
                transform: [
                  {
                    translateY: fadeAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [14, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <View style={styles.channelEmojiWrap}>
                  <User size={18} color={Colors.secondary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle} numberOfLines={1}>
                    More from {channelUploads.channelTitle}
                  </Text>
                  <Text style={styles.sectionSubtitle}>Latest uploads</Text>
                </View>
              </View>
            </View>
            {channelUploads.isLoading ? (
              <View style={styles.sectionLoading}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.sectionLoadingText}>Loading...</Text>
              </View>
            ) : (
              <FlatList
                data={channelUploads.videos}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => `channel-${item.videoId}`}
                renderItem={({ item }) => renderRelatedCard(item)}
                contentContainerStyle={styles.carouselScroll}
                ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
              />
            )}
          </Animated.View>
        )}

        {featuredCreators.length > 0 && (
          <Animated.View
            style={[
              styles.creatorsSection,
              {
                opacity: fadeAnim,
                transform: [
                  {
                    translateY: fadeAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [18, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <View style={styles.creatorsEmojiWrap}>
                  <Text style={styles.sectionEmoji}>🎬</Text>
                </View>
                <View>
                  <Text style={styles.sectionTitle}>Featured French Creators</Text>
                  <Text style={styles.sectionSubtitle}>Popular channels to explore</Text>
                </View>
              </View>
            </View>

            {creatorsLoading && featuredCreators.every((c) => c.isLoading) ? (
              <View style={styles.sectionLoading}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.sectionLoadingText}>Loading creators...</Text>
              </View>
            ) : (
              <FlatList
                data={featuredCreators.filter((c) => c.videos.length > 0)}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => item.channel.channelId}
                contentContainerStyle={styles.creatorsScroll}
                ItemSeparatorComponent={() => <View style={{ width: 16 }} />}
                renderItem={({ item }) => (
                  <View style={styles.creatorCard}>
                    <View style={styles.creatorHeader}>
                      <Image
                        source={{ uri: item.channel.thumbnailUrl }}
                        style={styles.creatorAvatar}
                        contentFit="cover"
                        transition={200}
                      />
                      <View style={styles.creatorNameWrap}>
                        <Text style={styles.creatorName} numberOfLines={1}>
                          {item.channel.name}
                        </Text>
                        <View style={styles.creatorCategoryBadge}>
                          <Text style={styles.creatorCategoryText}>
                            {item.channel.category}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.creatorVideosScroll}
                    >
                      {item.videos.map((video) => (
                        <AnimatedPressable
                          key={video.videoId}
                          onPress={() => handleVideoPress(video.videoId, video.title)}
                          style={styles.creatorVideoCard}
                        >
                          <Image
                            source={{ uri: video.thumbnailUrl }}
                            style={styles.creatorVideoThumb}
                            contentFit="cover"
                            transition={200}
                          />
                          <View style={styles.creatorVideoPlayIcon}>
                            <Play size={12} color="#fff" fill="#fff" />
                          </View>
                          <Text style={styles.creatorVideoTitle} numberOfLines={2}>
                            {video.title}
                          </Text>
                        </AnimatedPressable>
                      ))}
                    </ScrollView>
                  </View>
                )}
              />
            )}
          </Animated.View>
        )}

        {sortedTrendingSections.map((section, idx) => renderSection(section, idx))}

        {showSubtitlesBanner && (
          <Animated.View
            style={[
              styles.subtitlesBanner,
              {
                opacity: fadeAnim,
                transform: [
                  {
                    translateY: fadeAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [20, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <LinearGradient
              colors={['#0F172A', '#1E3A5F', '#0C4A6E']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.subtitlesBannerGradient}
            >
              <Pressable
                onPress={dismissSubtitlesBanner}
                style={styles.subtitlesBannerClose}
                hitSlop={12}
                testID="subtitles-banner-close"
              >
                <X size={16} color="rgba(255,255,255,0.6)" />
              </Pressable>
              <View style={styles.subtitlesBannerIconRow}>
                <View style={styles.subtitlesBannerIconWrap}>
                  <Captions size={24} color="#38BDF8" />
                </View>
                <View style={styles.subtitlesBannerBadge}>
                  <Text style={styles.subtitlesBannerBadgeText}>NEW</Text>
                </View>
              </View>
              <Text style={styles.subtitlesBannerHeadline}>
                Watch Your Favorites in French
              </Text>
              <Text style={styles.subtitlesBannerDesc}>
                Search for any YouTube video and we'll add French subtitles — learn while watching content you already love
              </Text>
              <AnimatedPressable
                onPress={handleSubtitlesBannerCTA}
                style={styles.subtitlesBannerCTA}
                testID="subtitles-banner-cta"
              >
                <Captions size={16} color="#0F172A" />
                <Text style={styles.subtitlesBannerCTAText}>Try It</Text>
                <ChevronRight size={16} color="#0F172A" />
              </AnimatedPressable>
            </LinearGradient>
          </Animated.View>
        )}

        <View style={styles.suggestedSection}>
          <View style={styles.suggestedHeader}>
            <TrendingUp size={18} color={Colors.primary} />
            <Text style={styles.suggestedTitle}>Suggested Searches</Text>
          </View>
          <View style={styles.suggestedGrid}>
            {SUGGESTED_SEARCHES.map((s) => (
              <AnimatedPressable
                key={s.query}
                onPress={() => handleSuggestedSearch(s.query)}
                style={styles.suggestedChip}
              >
                <Search size={13} color={Colors.primary} />
                <Text style={styles.suggestedChipText}>{s.label}</Text>
              </AnimatedPressable>
            ))}
          </View>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    paddingBottom: 20,
  },
  headerContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800' as const,
    color: '#fff',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  headerIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(249,115,22,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipBar: {
    flexDirection: 'row',
    marginTop: 14,
    gap: 10,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    gap: 6,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
  },
  filterChipInactive: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  filterChipTextActive: {
    color: '#fff',
  },
  filterChipTextInactive: {
    color: 'rgba(255,255,255,0.5)',
  },
  chipEmoji: {
    fontSize: 14,
  },
  searchBarFake: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 13,
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  searchBarPlaceholder: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
    flex: 1,
  },
  initialLoader: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  initialLoaderText: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  historySection: {
    marginTop: 24,
  },
  continueEmojiWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  relatedEmojiWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FFF4E6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  channelEmojiWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.secondaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueCard: {
    width: CONTINUE_CARD_WIDTH,
  },
  continueThumbWrap: {
    width: CONTINUE_CARD_WIDTH,
    height: CONTINUE_CARD_WIDTH * 0.56,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: Colors.backgroundSecondary,
  },
  continueThumb: {
    width: '100%',
    height: '100%',
  },
  continueThumbGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 30,
  },
  continuePlayIcon: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -14,
    marginLeft: -14,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(249,115,22,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressBarWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  progressBarBg: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  progressBarFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: Colors.primary,
  },
  continueTitle: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.text,
    marginTop: 6,
    lineHeight: 16,
  },
  continueChannel: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  relatedCard: {
    width: CONTINUE_CARD_WIDTH,
  },
  relatedThumbWrap: {
    width: CONTINUE_CARD_WIDTH,
    height: CONTINUE_CARD_WIDTH * 0.56,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: Colors.backgroundSecondary,
  },
  relatedThumb: {
    width: '100%',
    height: '100%',
  },
  relatedPlayIcon: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -14,
    marginLeft: -14,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(249,115,22,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  relatedTitle: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.text,
    marginTop: 6,
    lineHeight: 16,
  },
  relatedChannel: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  trendingSection: {
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  sectionEmojiWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionEmoji: {
    fontSize: 18,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.text,
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 1,
  },
  sectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  sectionBadgeText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  sectionLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 32,
  },
  sectionLoadingText: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  sectionEmpty: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  sectionEmptyText: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  carouselScroll: {
    paddingHorizontal: 20,
  },
  carouselCard: {
    width: CAROUSEL_CARD_WIDTH,
    borderRadius: 16,
    backgroundColor: Colors.backgroundCard,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
  },
  carouselThumbWrap: {
    width: '100%',
    height: CAROUSEL_CARD_WIDTH * 0.56,
    position: 'relative',
  },
  carouselThumb: {
    width: '100%',
    height: '100%',
  },
  carouselThumbGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 50,
  },
  carouselDuration: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.78)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
  },
  carouselDurationText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#fff',
  },
  carouselPlayBtn: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -20,
    marginLeft: -20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(249,115,22,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  carouselInfo: {
    padding: 12,
  },
  carouselTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
    lineHeight: 19,
    marginBottom: 6,
  },
  carouselMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  carouselChannel: {
    fontSize: 12,
    color: Colors.textSecondary,
    flex: 1,
    marginRight: 8,
  },
  carouselViewsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  carouselViews: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  suggestedSection: {
    marginTop: 32,
    paddingHorizontal: 20,
  },
  suggestedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  suggestedTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.text,
    letterSpacing: -0.2,
  },
  suggestedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  suggestedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: Colors.backgroundSecondary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  suggestedChipText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  bottomSpacer: {
    height: 40,
  },
  subtitlesBanner: {
    marginTop: 28,
    marginHorizontal: 20,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: '#0C4A6E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
  },
  subtitlesBannerGradient: {
    padding: 22,
    paddingTop: 18,
  },
  subtitlesBannerClose: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  subtitlesBannerIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  subtitlesBannerIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(56,189,248,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitlesBannerBadge: {
    backgroundColor: '#38BDF8',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  subtitlesBannerBadgeText: {
    fontSize: 10,
    fontWeight: '800' as const,
    color: '#0F172A',
    letterSpacing: 1,
  },
  subtitlesBannerHeadline: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: '#fff',
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  subtitlesBannerDesc: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 20,
    marginBottom: 18,
  },
  subtitlesBannerCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    backgroundColor: '#38BDF8',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
  },
  subtitlesBannerCTAText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#0F172A',
  },
  creatorsSection: {
    marginTop: 24,
  },
  creatorsEmojiWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FFF0E6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  creatorsScroll: {
    paddingHorizontal: 20,
  },
  creatorCard: {
    width: SCREEN_WIDTH * 0.82,
    backgroundColor: Colors.backgroundCard,
    borderRadius: 16,
    padding: 14,
    elevation: 3,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  creatorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  creatorAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.backgroundSecondary,
  },
  creatorNameWrap: {
    flex: 1,
    gap: 4,
  },
  creatorName: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.text,
    letterSpacing: -0.2,
  },
  creatorCategoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  creatorCategoryText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  creatorVideosScroll: {
    gap: CREATOR_THUMB_GAP,
  },
  creatorVideoCard: {
    width: CREATOR_THUMB_SIZE,
  },
  creatorVideoThumb: {
    width: CREATOR_THUMB_SIZE,
    height: CREATOR_THUMB_SIZE * 0.56,
    borderRadius: 10,
    backgroundColor: Colors.backgroundSecondary,
  },
  creatorVideoPlayIcon: {
    position: 'absolute',
    top: (CREATOR_THUMB_SIZE * 0.56) / 2 - 12,
    left: CREATOR_THUMB_SIZE / 2 - 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(249,115,22,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  creatorVideoTitle: {
    fontSize: 11,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
    marginTop: 5,
    lineHeight: 14,
  },
});
