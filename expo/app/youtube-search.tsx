import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  Pressable,
  Animated,
  ActivityIndicator,
  Dimensions,
  Keyboard,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { safeGoBack } from '@/utils/navigation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { USE_NATIVE_DRIVER } from '@/constants/animation';
import {
  Search,
  ChevronLeft,
  Play,
  Clock,
  Languages,
  X,
  AlertCircle,
  MonitorPlay,
  RotateCcw,
  Captions,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import {
  translateSearchQuery,
  searchYouTube,
  checkTranscriptsBatch,
  formatSearchDuration,
  formatViews,
  YouTubeSearchResult,
} from '@/utils/youtubeSearch';

const { width: _SCREEN_WIDTH } = Dimensions.get('window');
const THUMB_WIDTH = 148;
const THUMB_HEIGHT = Math.round(THUMB_WIDTH * (9 / 16));

const SUGGESTED_SEARCHES = [
  'Cooking recipes',
  'Daily life in Paris',
  'French music',
  'News report',
  'Street interviews',
  'Travel vlogs France',
  'Science documentaries',
  'Comedy sketches',
];

export default function YouTubeSearchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ nativeMode?: string; mode?: string }>();
  const [query, setQuery] = useState('');
  const [translatedQuery, setTranslatedQuery] = useState('');
  const [results, setResults] = useState<YouTubeSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nativeMode, setNativeMode] = useState(
    params.mode === 'subtitles' ? true : params.nativeMode === '1'
  );
  const [isCheckingTranscripts, setIsCheckingTranscripts] = useState(false);

  const inputRef = useRef<TextInput>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const resultAnims = useRef<Animated.Value[]>([]);
  const mountedRef = useRef(true);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 350,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();

    setTimeout(() => inputRef.current?.focus(), 400);

    return () => {
      mountedRef.current = false;
    };
  }, [fadeAnim]);

  const animateResults = useCallback((count: number) => {
    resultAnims.current = Array.from({ length: count }, () => new Animated.Value(0));
    Animated.stagger(
      60,
      resultAnims.current.map((anim) =>
        Animated.timing(anim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ),
    ).start();
  }, []);

  const chipScaleFR = useRef(new Animated.Value(1)).current;
  const chipScaleCC = useRef(new Animated.Value(1)).current;

  const handleSearchWithMode = useCallback(async (searchQuery: string, isNative: boolean) => {
    const q = searchQuery.trim();
    if (!q) return;

    Keyboard.dismiss();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsSearching(true);
    setError(null);
    setResults([]);
    setHasSearched(true);
    setTranslatedQuery('');

    try {
      let searchTerm: string;

      if (isNative) {
        console.log(`[YouTubeSearch] Subtitles mode: searching directly for "${q}"`);
        searchTerm = q;
      } else {
        console.log(`[YouTubeSearch] French content mode: searching for "${q}"`);
        const translated = await translateSearchQuery(q);
        if (!mountedRef.current) return;
        setTranslatedQuery(translated);
        searchTerm = translated;
      }

      const searchResults = await searchYouTube(searchTerm, !isNative);
      if (!mountedRef.current) return;

      const needsCheck = searchResults.filter((r) => r.hasTranscript === null);
      if (needsCheck.length > 0) {
        setResults(searchResults.filter((r) => r.hasTranscript === true));
        setIsSearching(false);
        setIsCheckingTranscripts(true);

        const ids = needsCheck.map((r) => r.videoId);
        console.log(`[YouTubeSearch] Checking transcripts for ${ids.length} videos via Supadata`);
        const transcriptMap = await checkTranscriptsBatch(ids);
        if (!mountedRef.current) return;

        const verified = searchResults.filter((r) => {
          if (r.hasTranscript === true) return true;
          return transcriptMap.get(r.videoId) === true;
        });
        setResults(verified);
        setIsCheckingTranscripts(false);
        animateResults(verified.length);
      } else {
        setResults(searchResults);
        setIsSearching(false);
        animateResults(searchResults.length);
      }
    } catch (err: any) {
      console.error('[YouTubeSearch] Error:', err);
      if (mountedRef.current) {
        setError(err?.message || 'Search failed. Please try again.');
        setIsSearching(false);
      }
    }
  }, [animateResults]);

  const toggleNativeMode = useCallback((value: boolean) => {
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
    setError(null);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const q = query.trim();
    if (q) {
      void handleSearchWithMode(q, value);
    } else {
      setResults([]);
      setHasSearched(false);
      setTranslatedQuery('');
    }
  }, [nativeMode, query, chipScaleCC, chipScaleFR, handleSearchWithMode]);

  const handleSearch = useCallback(async (searchQuery?: string) => {
    const q = (searchQuery ?? query).trim();
    if (!q) return;
    await handleSearchWithMode(q, nativeMode);
  }, [query, nativeMode, handleSearchWithMode]);

  const clearSearch = useCallback(() => {
    setQuery('');
    setResults([]);
    setTranslatedQuery('');
    setHasSearched(false);
    setError(null);
    inputRef.current?.focus();
  }, []);

  const handleVideoPress = useCallback(
    (item: YouTubeSearchResult) => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const nativeParam = nativeMode ? '&nativeMode=1' : '';
      router.push(
        `/watch-session?videoId=${item.videoId}&title=${encodeURIComponent(item.title)}&channel=${encodeURIComponent(item.channel)}${nativeParam}` as never,
      );
    },
    [router, nativeMode],
  );

  const handleSuggestionPress = useCallback(
    (suggestion: string) => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setQuery(suggestion);
      void handleSearch(suggestion);
    },
    [handleSearch],
  );

  const filteredResults = results;

  const renderResult = useCallback(
    ({ item, index }: { item: YouTubeSearchResult; index: number }) => {
      const anim = resultAnims.current[index];
      const animStyle = anim
        ? {
            opacity: anim,
            transform: [
              {
                translateY: anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }),
              },
            ],
          }
        : {};

      return (
        <Animated.View style={animStyle}>
          <Pressable
            style={({ pressed }) => [
              styles.resultCard,
              pressed && styles.resultCardPressed,
            ]}
            onPress={() => handleVideoPress(item)}
            testID={`search-result-${index}`}
          >
            <View style={styles.thumbWrap}>
              <Image
                source={{ uri: item.thumbnailUrl }}
                style={styles.thumb}
                contentFit="cover"
                transition={200}
              />
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.6)']}
                style={styles.thumbGradient}
              />
              <View style={styles.durationBadge}>
                <Clock size={9} color="#fff" />
                <Text style={styles.durationText}>
                  {formatSearchDuration(item.durationSeconds)}
                </Text>
              </View>
              {!nativeMode ? (
                <View style={styles.modeBadge}>
                  <Text style={styles.modeBadgeFR}>FR</Text>
                </View>
              ) : (
                <View style={styles.modeBadgeCC}>
                  <Captions size={10} color="#fff" />
                </View>
              )}
              <View style={styles.playOverlay}>
                <View style={styles.playCircle}>
                  <Play size={14} color="#fff" fill="#fff" />
                </View>
              </View>
            </View>

            <View style={styles.resultInfo}>
              <Text
                style={styles.resultTitle}
                numberOfLines={2}
              >
                {item.title}
              </Text>
              <Text style={styles.resultChannel} numberOfLines={1}>
                {item.channel}
              </Text>
              <Text style={styles.resultMeta}>
                {formatViews(item.views)}
                {item.uploadedDate ? ` · ${item.uploadedDate}` : ''}
              </Text>


            </View>
          </Pressable>
        </Animated.View>
      );
    },
    [handleVideoPress, nativeMode],
  );

  const keyExtractor = useCallback(
    (item: YouTubeSearchResult) => item.videoId,
    [],
  );



  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1A0F0A', '#2D1810', Colors.background]}
        style={styles.headerGradient}
      >
        <SafeAreaView edges={['top']}>
          <View style={styles.headerRow}>
            <Pressable
              onPress={() => safeGoBack()}
              style={styles.backBtn}
              hitSlop={12}
            >
              <ChevronLeft size={22} color="#fff" />
            </Pressable>
            <View style={styles.headerTitleWrap}>
              <Text style={styles.headerTitle}>Search YouTube</Text>
              <Text style={styles.headerSubtitle}>
                {nativeMode
                  ? 'Search directly — transcripts auto-translate'
                  : 'Type in English — we search in French'}
              </Text>
            </View>
          </View>

          <View style={styles.searchBarWrap}>
            <View style={styles.searchBar}>
              <Search size={18} color={Colors.textMuted} />
              <TextInput
                ref={inputRef}
                style={styles.searchInput}
                placeholder={nativeMode ? 'Search in any language...' : 'What do you want to watch?'}
                placeholderTextColor={Colors.textMuted}
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={() => handleSearch()}
                returnKeyType="search"
                autoCapitalize="none"
                autoCorrect={false}
                testID="youtube-search-input"
              />
              {query.length > 0 && (
                <Pressable onPress={clearSearch} hitSlop={8}>
                  <X size={18} color={Colors.textMuted} />
                </Pressable>
              )}
            </View>
            <Pressable
              onPress={() => handleSearch()}
              style={[
                styles.searchBtn,
                !query.trim() && styles.searchBtnDisabled,
              ]}
              disabled={!query.trim() || isSearching}
            >
              {isSearching ? (
                <ActivityIndicator size={16} color="#fff" />
              ) : (
                <Search size={18} color="#fff" />
              )}
            </Pressable>
          </View>

          <View style={styles.chipBar}>
            <Animated.View style={{ transform: [{ scale: chipScaleFR }] }}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => toggleNativeMode(false)}
                style={[
                  styles.filterChip,
                  !nativeMode ? styles.filterChipActive : styles.filterChipInactive,
                ]}
                testID="chip-french-content"
              >
                <Text style={styles.chipEmoji}>🇫🇷</Text>
                <Text
                  style={[
                    styles.filterChipText,
                    !nativeMode ? styles.filterChipTextActive : styles.filterChipTextInactive,
                  ]}
                >
                  French Content
                </Text>
              </TouchableOpacity>
            </Animated.View>
            <Animated.View style={{ transform: [{ scale: chipScaleCC }] }}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => toggleNativeMode(true)}
                style={[
                  styles.filterChip,
                  nativeMode ? styles.filterChipActive : styles.filterChipInactive,
                ]}
                testID="chip-learn-subtitles"
              >
                <Captions size={14} color={nativeMode ? '#fff' : 'rgba(255,255,255,0.5)'} />
                <Text
                  style={[
                    styles.filterChipText,
                    nativeMode ? styles.filterChipTextActive : styles.filterChipTextInactive,
                  ]}
                >
                  Learn with Subtitles
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </View>

          {translatedQuery && !nativeMode ? (
            <View style={styles.translationRow}>
              <Languages size={14} color={Colors.primary} />
              <Text style={styles.translationLabel}>Searching:</Text>
              <Text style={styles.translationText} numberOfLines={1}>
                {translatedQuery}
              </Text>
            </View>
          ) : null}
        </SafeAreaView>
      </LinearGradient>

      {isSearching && results.length === 0 && (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>
            {translatedQuery
              ? 'Searching YouTube…'
              : 'Translating your query…'}
          </Text>
        </View>
      )}

      {error && (
        <View style={styles.errorWrap}>
          <AlertCircle size={40} color={Colors.error} />
          <Text style={styles.errorTitle}>Search Failed</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable
            style={styles.retryBtn}
            onPress={() => handleSearch()}
          >
            <RotateCcw size={16} color="#fff" />
            <Text style={styles.retryBtnText}>Try Again</Text>
          </Pressable>
        </View>
      )}

      {!isSearching && !error && !hasSearched && (
        <Animated.View style={[styles.emptyWrap, { opacity: fadeAnim }]}>
          <View style={styles.emptyIconWrap}>
            <MonitorPlay size={48} color={Colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>
            {nativeMode ? 'Watch in Any Language' : 'Find French Videos'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {nativeMode
              ? 'Search for videos in your language — the transcript will auto-translate to French so you can follow along and learn.'
              : 'Search in English — we\'ll translate and find videos with subtitles so you can learn with karaoke-style transcripts.'}
          </Text>
          <Text style={styles.suggestionsTitle}>Try searching for</Text>
          <View style={styles.suggestionsGrid}>
            {SUGGESTED_SEARCHES.map((s) => (
              <Pressable
                key={s}
                style={styles.suggestionChip}
                onPress={() => handleSuggestionPress(s)}
              >
                <Text style={styles.suggestionText}>{s}</Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>
      )}

      {!isSearching && hasSearched && results.length === 0 && !error && (
        <View style={styles.noResultsWrap}>
          <Search size={40} color={Colors.textMuted} />
          <Text style={styles.noResultsTitle}>No Videos Found</Text>
          <Text style={styles.noResultsText}>
            Try different keywords or a broader search.
          </Text>
        </View>
      )}

      {filteredResults.length > 0 && (
        <>
          <View style={styles.resultsHeader}>
            <Text style={styles.resultsCount}>
              {filteredResults.length} video{filteredResults.length !== 1 ? 's' : ''} with subtitles
            </Text>
            {isCheckingTranscripts && (
              <View style={styles.checkingRow}>
                <ActivityIndicator size={12} color={Colors.primary} />
                <Text style={styles.checkingText}>Verifying more…</Text>
              </View>
            )}
          </View>
          <FlatList
            data={filteredResults}
            keyExtractor={keyExtractor}
            renderItem={renderResult}
            contentContainerStyle={styles.resultsList}
            showsVerticalScrollIndicator={false}
            keyboardDismissMode="on-drag"
            testID="search-results-list"
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerGradient: {
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: '#fff',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
    marginTop: 1,
  },
  chipBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
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
  searchBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 16,
    gap: 10,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
    gap: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: { elevation: 3 },
      web: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
    }),
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    height: 48,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}),
  },
  searchBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBtnDisabled: {
    backgroundColor: 'rgba(249,115,22,0.35)',
  },
  translationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 12,
    gap: 6,
  },
  translationLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.5)',
  },
  translationText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.primary,
    flex: 1,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  loadingText: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  errorWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 10,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
    marginTop: 4,
  },
  errorText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    lineHeight: 20,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  retryBtnText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#fff',
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingTop: 40,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    lineHeight: 21,
    marginBottom: 28,
  },
  suggestionsTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  suggestionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  suggestionChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  suggestionText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
  },
  noResultsWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  noResultsTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  noResultsText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 6,
  },
  resultsCount: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  checkingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  checkingText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  resultsList: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  resultCard: {
    flexDirection: 'row',
    backgroundColor: Colors.backgroundCard,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Platform.select({
      ios: {
        shadowColor: Colors.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.8,
        shadowRadius: 6,
      },
      android: { elevation: 2 },
      web: {
        shadowColor: Colors.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.8,
        shadowRadius: 6,
      },
    }),
  },
  resultCardPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  resultCardDisabled: {
    opacity: 0.45,
  },
  thumbWrap: {
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
    position: 'relative',
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  thumbGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 30,
  },
  durationBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  durationText: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: '#fff',
  },
  playOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(249,115,22,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultInfo: {
    flex: 1,
    padding: 10,
    justifyContent: 'center',
    gap: 2,
  },
  resultTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.text,
    lineHeight: 18,
    marginBottom: 2,
  },
  resultTitleDisabled: {
    color: Colors.textMuted,
  },
  resultChannel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  resultMeta: {
    fontSize: 11,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  modeBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: '#1D4ED8',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  modeBadgeFR: {
    fontSize: 9,
    fontWeight: '800' as const,
    color: '#fff',
    letterSpacing: 0.5,
  },
  modeBadgeCC: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 5,
    paddingVertical: 3,
    borderRadius: 4,
  },
});
