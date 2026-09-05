import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Animated,
  Dimensions,
  RefreshControl,
  Modal,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import ImageCardBackground from '@/components/ImageCardBackground';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  ArrowLeft,
  BookOpen,
  Newspaper,
  RefreshCw,
  AlertCircle,
  Clock,
  Filter,
  X,
  ChevronDown,
  ChevronRight,
  Zap,
  Check,
  Search,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { USE_NATIVE_DRIVER } from '@/constants/animation';
import { useApp } from '@/contexts/AppContext';
import { useNews } from '@/hooks/useNews';
import { getRegionFlag, NEWS_CATEGORY_COLORS, getArticleImageResult, getLibraryImageResult, RawNewsArticle } from '@/utils/perplexity';
import { frenchContent } from '@/mocks/content';
import { cefrToDifficulty } from '@/utils/progressiveDifficulty';
import { Difficulty, Region, ContentCategory } from '@/types';
import { useSmartLibraryImages } from '@/hooks/useSmartLibraryImages';
import { useHeadlineTranslations } from '@/hooks/useHeadlineTranslations';

const { width: _SCREEN_WIDTH } = Dimensions.get('window');
const HERO_HEIGHT = 340;
const CARD_HEIGHT = 230;
const LIB_CARD_HEIGHT = 200;

type ActiveView = 'feed' | 'library';
type FilterType = 'difficulty' | 'region' | 'type' | 'status' | null;
type ReadStatus = 'all' | 'read' | 'unread';
type RegionGroup = 'all' | 'europe' | 'africa' | 'caribbean' | 'canada';

const FEED_CATEGORIES = [
  { key: 'all', label: 'All', color: '#6B7280' },
  { key: 'politics', label: 'Politics', color: '#DC2626' },
  { key: 'culture', label: 'Culture', color: '#8B5CF6' },
  { key: 'sports', label: 'Sports', color: '#059669' },
  { key: 'science', label: 'Science', color: '#2563EB' },
  { key: 'economy', label: 'Economy', color: '#D97706' },
  { key: 'society', label: 'Society', color: '#EC4899' },
  { key: 'environment', label: 'Environ.', color: '#10B981' },
  { key: 'technology', label: 'Tech', color: '#6366F1' },
];

const REGION_GROUPS: { key: RegionGroup; label: string; emoji: string }[] = [
  { key: 'all', label: 'All', emoji: '🌍' },
  { key: 'europe', label: 'Europe', emoji: '🇪🇺' },
  { key: 'africa', label: 'Africa', emoji: '🌍' },
  { key: 'caribbean', label: 'Caribbean', emoji: '🏝️' },
  { key: 'canada', label: 'Canada', emoji: '🇨🇦' },
];

const REGION_GROUP_MEMBERS: Record<RegionGroup, string[]> = {
  all: [],
  europe: ['france', 'belgium', 'belgi', 'switzerland', 'suisse'],
  africa: ['africa', 'afrique', 'senegal', 'sénégal', 'morocco', 'maroc', 'ivory', 'côte', 'cameroon', 'cameroun', 'congo', 'tunisia', 'tunis', 'algeria', 'algér', 'mali', 'burkina', 'madagascar', 'guinea', 'guinée', 'niger', 'chad', 'tchad', 'gabon', 'togo', 'benin', 'bénin'],
  caribbean: ['haiti', 'haïti', 'martinique', 'guadeloupe', 'french guiana', 'guyane', 'antilles', 'carib'],
  canada: ['canada', 'quebec', 'québec', 'montreal', 'montréal'],
};

const LIBRARY_REGION_MAP: Record<string, RegionGroup> = {
  france: 'europe',
  belgium: 'europe',
  switzerland: 'europe',
  senegal: 'africa',
  morocco: 'africa',
  'ivory-coast': 'africa',
  cameroon: 'africa',
  drc: 'africa',
  quebec: 'canada',
  haiti: 'caribbean',
  martinique: 'caribbean',
  guadeloupe: 'caribbean',
  general: 'all',
};

const difficultyColors: Record<Difficulty, string> = {
  beginner: Colors.success,
  easy: Colors.primary,
  medium: Colors.warning,
  hard: Colors.secondary,
  university: '#7C3AED',
};

const difficultyLabels: Record<Difficulty, string> = {
  beginner: 'Beginner',
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  university: 'University',
};

const regionLabels: Record<Region, string> = {
  france: 'France',
  martinique: 'Martinique',
  guadeloupe: 'Guadeloupe',
  senegal: 'Senegal',
  morocco: 'Morocco',
  quebec: 'Quebec',
  belgium: 'Belgium',
  switzerland: 'Switzerland',
  'ivory-coast': 'Ivory Coast',
  cameroon: 'Cameroon',
  haiti: 'Haiti',
  drc: 'DR Congo',
  general: 'General',
};

const categoryLabels: Record<ContentCategory, string> = {
  dialogue: 'Dialogue',
  article: 'Article',
  story: 'Story',
  fiction: 'Fiction',
  news: 'News',
  culture: 'Culture',
  history: 'History',
  literature: 'Literature',
  science: 'Science',
  travel: 'Travel',
  food: 'Food',
  music: 'Music',
  sports: 'Sports',
};

const difficulties: Difficulty[] = ['beginner', 'easy', 'medium', 'hard', 'university'];
const regions: { value: Region | 'all'; label: string }[] = [
  { value: 'all', label: 'All Regions' },
  { value: 'france', label: 'France' },
  { value: 'senegal', label: 'Senegal' },
  { value: 'morocco', label: 'Morocco' },
  { value: 'quebec', label: 'Quebec' },
  { value: 'haiti', label: 'Haiti' },
  { value: 'martinique', label: 'Martinique' },
  { value: 'guadeloupe', label: 'Guadeloupe' },
  { value: 'ivory-coast', label: 'Ivory Coast' },
  { value: 'cameroon', label: 'Cameroon' },
  { value: 'belgium', label: 'Belgium' },
  { value: 'switzerland', label: 'Switzerland' },
  { value: 'drc', label: 'DR Congo' },
];
const libraryCategories: { value: ContentCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All Types' },
  { value: 'dialogue', label: 'Dialogue' },
  { value: 'article', label: 'Article' },
  { value: 'story', label: 'Story' },
  { value: 'fiction', label: 'Fiction' },
  { value: 'culture', label: 'Culture' },
  { value: 'history', label: 'History' },
  { value: 'literature', label: 'Literature' },
  { value: 'food', label: 'Food' },
  { value: 'music', label: 'Music' },
  { value: 'travel', label: 'Travel' },
  { value: 'science', label: 'Science' },
  { value: 'sports', label: 'Sports' },
  { value: 'news', label: 'News' },
];

const statusLabels: Record<ReadStatus, string> = {
  all: 'All',
  read: 'Read',
  unread: 'Unread',
};

function matchesRegionGroup(regionStr: string, group: RegionGroup): boolean {
  if (group === 'all') return true;
  const lower = regionStr.toLowerCase();
  return REGION_GROUP_MEMBERS[group].some((term) => lower.includes(term));
}

export default function ReadScreen() {
  const router = useRouter();
  const { completedContentIds, proficiency } = useApp();
  const news = useNews();

  const allFeedArticles = useMemo(() => {
    return news.getCategoryArticles('all');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [news]);

  const [searchResults, setSearchResults] = useState<RawNewsArticle[]>([]);

  const allArticlesForTranslation = useMemo(() => {
    if (searchResults.length === 0) return allFeedArticles;
    const feedIds = new Set(allFeedArticles.map(a => a.id));
    const unique = searchResults.filter(a => !feedIds.has(a.id));
    return [...allFeedArticles, ...unique];
  }, [allFeedArticles, searchResults]);
  const { getDisplayHeadline } = useHeadlineTranslations(allArticlesForTranslation);

  const [activeView, setActiveView] = useState<ActiveView>('feed');
  const [selectedFeedCategory, setSelectedFeedCategory] = useState('all');
  const [selectedRegionGroup, setSelectedRegionGroup] = useState<RegionGroup>('all');
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty | 'all'>('all');
  const [selectedRegion, setSelectedRegion] = useState<Region | 'all'>('all');
  const [selectedCategory, setSelectedCategory] = useState<ContentCategory | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = useState<ReadStatus>('all');
  const [selectedLibRegionGroup, setSelectedLibRegionGroup] = useState<RegionGroup>('all');
  const [activeFilter, setActiveFilter] = useState<FilterType>(null);
  const initialFilterApplied = useRef(false);
  const [displayLimit, setDisplayLimit] = useState<number>(10);

  const [isSearchMode, setIsSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [translatedQuery, setTranslatedQuery] = useState<string | null>(null);
  const [categoryRetrying, setCategoryRetrying] = useState(false);

  const libSmartImages = useSmartLibraryImages(frenchContent as Array<{ id: string; title: string; region: string; category: string }>);

  useEffect(() => {
    if (!initialFilterApplied.current && proficiency.certifiedLevels.length > 0) {
      initialFilterApplied.current = true;
      setSelectedDifficulty(cefrToDifficulty(proficiency.certifiedLevels));
    }
  }, [proficiency.certifiedLevels]);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [fadeAnim]);

  useEffect(() => {
    setDisplayLimit(10);
  }, [selectedFeedCategory, selectedRegionGroup]);

  const categoryFetched = news.isCategoryFetched(selectedFeedCategory);
  const categoryArticlesCount = news.getCategoryArticles(selectedFeedCategory).length;

  const fetchCategoryRef = useRef(news.fetchCategory);
  fetchCategoryRef.current = news.fetchCategory;
  const forceRefreshRef = useRef(news.forceRefreshCategory);
  forceRefreshRef.current = news.forceRefreshCategory;
  const isLoadingRef = useRef(news.isLoading);
  isLoadingRef.current = news.isLoading;
  const isCatLoadingRef = useRef(false);
  isCatLoadingRef.current = news.isCategoryLoadingFor(selectedFeedCategory);

  useEffect(() => {
    if (isLoadingRef.current || isCatLoadingRef.current) {
      console.log(`[Read] Skipping fetch for "${selectedFeedCategory}" - already loading`);
      return;
    }
    if (!categoryFetched || categoryArticlesCount === 0) {
      console.log(`[Read] Fetching articles for category: ${selectedFeedCategory} (fetched=${categoryFetched}, count=${categoryArticlesCount})`);
      void fetchCategoryRef.current(selectedFeedCategory).catch(e => {
        console.log('[Read] Category fetch failed:', (e as Error)?.message);
      });
    }
  }, [selectedFeedCategory, categoryFetched, categoryArticlesCount]);

  useEffect(() => {
    if (!news.isLoading && categoryFetched && !news.isCategoryLoading && categoryArticlesCount > 0) {
      void news.backgroundRefreshCategory(selectedFeedCategory).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFeedCategory]);

  const categoryArticles = useMemo(() => {
    return news.getCategoryArticles(selectedFeedCategory);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [news.getCategoryArticles, selectedFeedCategory]);

  const isCatLoading = news.isCategoryLoadingFor(selectedFeedCategory);
  const catError = news.categoryErrorFor(selectedFeedCategory);
  const lastRefreshed = news.getCategoryLastRefreshed(selectedFeedCategory);
  const lastRefreshedStr = lastRefreshed ? news.getTimeSinceStr(lastRefreshed) : null;

  const filteredArticles = useMemo(() => {
    if (selectedRegionGroup === 'all') return categoryArticles;
    return categoryArticles.filter((a) => matchesRegionGroup(a.region, selectedRegionGroup));
  }, [categoryArticles, selectedRegionGroup]);

  const displayedArticles = useMemo(() => {
    return filteredArticles.slice(0, displayLimit);
  }, [filteredArticles, displayLimit]);

  const filteredContent = useMemo(() => {
    return frenchContent.filter((item) => {
      const difficultyMatch = selectedDifficulty === 'all' || item.difficulty === selectedDifficulty;
      const regionMatch = selectedRegion === 'all' || item.region === selectedRegion;
      const categoryMatch = selectedCategory === 'all' || item.category === selectedCategory;
      const isRead = completedContentIds.includes(item.id);
      const statusMatch =
        selectedStatus === 'all' ||
        (selectedStatus === 'read' && isRead) ||
        (selectedStatus === 'unread' && !isRead);
      const libRegionGroupMatch =
        selectedLibRegionGroup === 'all' ||
        LIBRARY_REGION_MAP[item.region] === selectedLibRegionGroup;
      return difficultyMatch && regionMatch && categoryMatch && statusMatch && libRegionGroupMatch;
    });
  }, [selectedDifficulty, selectedRegion, selectedCategory, selectedStatus, selectedLibRegionGroup, completedContentIds]);

  const handleNewsPress = useCallback(
    (articleId: string) => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      router.push({ pathname: '/news-article', params: { articleId } } as any);
    },
    [router]
  );

  const handleContentPress = useCallback(
    (contentId: string) => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      router.push(`/reading/${contentId}` as any);
    },
    [router]
  );

  const switchView = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveView((v) => (v === 'feed' ? 'library' : 'feed'));
    setIsSearchMode(false);
    setSearchQuery('');
    setSearchResults([]);
    setHasSearched(false);
  }, []);

  const openSearch = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsSearchMode(true);
    setHasSearched(false);
    setSearchResults([]);
    setSearchQuery('');
  }, []);

  const clearSearch = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsSearchMode(false);
    setSearchQuery('');
    setSearchResults([]);
    setHasSearched(false);
    setTranslatedQuery(null);
  }, []);

  const handleSearch = useCallback(async () => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsSearching(true);
    setHasSearched(true);
    setTranslatedQuery(null);
    try {
      const result = await news.searchArticles(trimmed);
      setSearchResults(result.articles);
      setTranslatedQuery(result.translatedQuery);
      console.log(`[Read] Search returned ${result.articles.length} results for "${trimmed}"${result.translatedQuery ? ` (translated: "${result.translatedQuery}")` : ''}`);
    } catch (e) {
      console.log('[Read] Search failed:', e);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, news]);

  const handleManualLoadMore = useCallback(async () => {
    if (news.isLoadingMore) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (filteredArticles.length > displayLimit) {
      setDisplayLimit(prev => prev + 10);
    } else {
      try {
        await news.loadMoreForCategory(selectedFeedCategory);
        setDisplayLimit(prev => prev + 10);
      } catch (e) {
        console.log('[Read] Load more failed:', e);
      }
    }
  }, [displayLimit, filteredArticles.length, news, selectedFeedCategory]);

  const getTimeAgo = useCallback((dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    return dateStr;
  }, []);

  const getFilterLabel = (type: FilterType): string => {
    switch (type) {
      case 'difficulty':
        return selectedDifficulty === 'all' ? 'Level' : difficultyLabels[selectedDifficulty];
      case 'region':
        return selectedRegion === 'all' ? 'Region' : regionLabels[selectedRegion];
      case 'type':
        return selectedCategory === 'all' ? 'Type' : categoryLabels[selectedCategory];
      case 'status':
        return selectedStatus === 'all' ? 'Status' : statusLabels[selectedStatus];
      default:
        return '';
    }
  };

  const isFilterActive = (type: FilterType): boolean => {
    switch (type) {
      case 'difficulty': return selectedDifficulty !== 'all';
      case 'region': return selectedRegion !== 'all';
      case 'type': return selectedCategory !== 'all';
      case 'status': return selectedStatus !== 'all';
      default: return false;
    }
  };

  const clearFilter = (type: FilterType) => {
    switch (type) {
      case 'difficulty': setSelectedDifficulty('all'); break;
      case 'region': setSelectedRegion('all'); break;
      case 'type': setSelectedCategory('all'); break;
      case 'status': setSelectedStatus('all'); break;
    }
  };

  const activeFiltersCount = [
    selectedDifficulty !== 'all',
    selectedRegion !== 'all',
    selectedCategory !== 'all',
    selectedStatus !== 'all',
    selectedLibRegionGroup !== 'all',
  ].filter(Boolean).length;

  const regionGroupCounts = useMemo(() => {
    const counts: Record<RegionGroup, number> = { all: categoryArticles.length, europe: 0, africa: 0, caribbean: 0, canada: 0 };
    categoryArticles.forEach((a) => {
      const groups: RegionGroup[] = ['europe', 'africa', 'caribbean', 'canada'];
      for (const g of groups) {
        if (matchesRegionGroup(a.region, g)) {
          counts[g]++;
          break;
        }
      }
    });
    return counts;
  }, [categoryArticles]);

  const renderFeedCard = useCallback(
    (article: typeof news.articles[0], index: number) => {
      const isHero = index === 0;
      const catColor = NEWS_CATEGORY_COLORS[article.category] ?? '#6366F1';
      const imgResult = getArticleImageResult(article);
      const flag = getRegionFlag(article.region);

      return (
        <Pressable
          key={article.id}
          onPress={() => handleNewsPress(article.id)}
          style={({ pressed }) => [
            styles.feedCard,
            isHero && styles.feedCardHero,
            pressed && styles.feedCardPressed,
          ]}
          testID={`feed-card-${index}`}
        >
          <ImageCardBackground
            uri={imgResult.primary}
            fallbackUri={imgResult.fallback}
            gradientColors={imgResult.gradient}
            style={[styles.feedCardImage, isHero && styles.feedCardImageHero]}
            imageStyle={styles.feedCardImageInner}
          >
            <LinearGradient
              colors={
                isHero
                  ? ['rgba(0,0,0,0.25)', 'transparent', 'rgba(0,0,0,0.8)', 'rgba(0,0,0,0.95)']
                  : ['rgba(0,0,0,0.2)', 'transparent', 'rgba(0,0,0,0.75)', 'rgba(0,0,0,0.92)']
              }
              locations={isHero ? [0, 0.3, 0.7, 1] : [0, 0.25, 0.65, 1]}
              style={styles.feedCardGradient}
            >
              <View style={styles.feedCardTop}>
                <View style={[styles.feedCategoryBadge, { backgroundColor: catColor }]}>
                  <Text style={styles.feedCategoryText}>
                    {article.category.charAt(0).toUpperCase() + article.category.slice(1)}
                  </Text>
                </View>
                <View style={styles.feedRegionBadge}>
                  <Text style={styles.feedRegionFlag}>{flag}</Text>
                  <Text style={styles.feedRegionText}>{article.region}</Text>
                </View>
              </View>

              <View style={styles.feedCardBottom}>
                <Text
                  style={[styles.feedHeadline, isHero && styles.feedHeadlineHero]}
                  numberOfLines={isHero ? 3 : 2}
                >
                  {getDisplayHeadline(article)}
                </Text>
                {isHero && (
                  <Text style={styles.feedSummary} numberOfLines={2}>
                    {article.summary}
                  </Text>
                )}
                <View style={styles.feedMetaRow}>
                  <Text style={styles.feedSource}>{article.source}</Text>
                  <View style={styles.feedMetaDot} />
                  <Text style={styles.feedTime}>{getTimeAgo(article.publishedDate)}</Text>
                </View>
              </View>
            </LinearGradient>
          </ImageCardBackground>
        </Pressable>
      );
    },
    [handleNewsPress, getTimeAgo, getDisplayHeadline]
  );

  const renderRegionGroupPills = (
    selected: RegionGroup,
    onSelect: (g: RegionGroup) => void,
    counts?: Record<RegionGroup, number>
  ) => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.regionGroupContainer}
      style={styles.regionGroupScroll}
    >
      {REGION_GROUPS.map((g) => {
        const isActive = selected === g.key;
        const count = counts?.[g.key];
        return (
          <Pressable
            key={g.key}
            style={[styles.regionGroupPill, isActive && styles.regionGroupPillActive]}
            onPress={() => {
              void Haptics.selectionAsync();
              onSelect(g.key);
            }}
          >
            <Text style={styles.regionGroupEmoji}>{g.emoji}</Text>
            <Text style={[styles.regionGroupLabel, isActive && styles.regionGroupLabelActive]}>
              {g.label}
            </Text>
            {count !== undefined && count > 0 && (
              <View style={[styles.regionGroupCount, isActive && styles.regionGroupCountActive]}>
                <Text style={[styles.regionGroupCountText, isActive && styles.regionGroupCountTextActive]}>
                  {count}
                </Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );

  const renderSearchView = () => {
    if (isSearching) {
      return (
        <View style={styles.feedStateContainer}>
          <View style={styles.loadingCard}>
            <View style={styles.loadingPulse}>
              <Search size={32} color={Colors.primary} />
            </View>
            <Text style={styles.loadingTitle}>Searching articles...</Text>
            <Text style={styles.loadingSub}>
              Translating & searching for "{searchQuery}"
            </Text>
          </View>
        </View>
      );
    }

    if (!hasSearched) {
      return (
        <View style={styles.searchPromptContainer}>
          <View style={styles.searchPromptIcon}>
            <Search size={36} color={Colors.textMuted} />
          </View>
          <Text style={styles.searchPromptTitle}>Search for any topic</Text>
          <Text style={styles.searchPromptSub}>
            Search anything — recipes, sports, tech, travel{'\n'}Results adapt to your learning level
          </Text>
        </View>
      );
    }

    if (searchResults.length === 0) {
      return (
        <View style={styles.feedStateContainer}>
          <View style={styles.emptyCard}>
            <Search size={28} color={Colors.border} />
            <Text style={styles.emptyTitle}>No articles found</Text>
            <Text style={styles.emptySub}>Try different keywords or phrasing</Text>
          </View>
        </View>
      );
    }

    return (
      <ScrollView
        style={styles.feedScroll}
        contentContainerStyle={styles.feedScrollContent}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.searchResultsHeader}>
          <Text style={styles.searchResultsCount}>
            {searchResults.length} article{searchResults.length !== 1 ? 's' : ''} found
          </Text>
          <View style={styles.searchResultsBadge}>
            <Zap size={11} color={Colors.primary} />
            <Text style={styles.searchResultsLevel}>Adapts to {news.userLevel}</Text>
          </View>
        </View>
        {translatedQuery && (
          <View style={styles.translatedQueryBanner}>
            <Text style={styles.translatedQueryLabel}>Searched in French:</Text>
            <Text style={styles.translatedQueryText}>"{translatedQuery}"</Text>
          </View>
        )}
        {searchResults.map((article, index) => renderFeedCard(article, index))}
      </ScrollView>
    );
  };

  const renderFeedView = () => {
    const showFullLoading = (news.isLoading || isCatLoading) && categoryArticles.length === 0;
    const regionLabel = REGION_GROUPS.find(g => g.key === selectedRegionGroup)?.label;

    if (showFullLoading) {
      const catLabel = selectedFeedCategory !== 'all'
        ? selectedFeedCategory.charAt(0).toUpperCase() + selectedFeedCategory.slice(1)
        : null;
      const regionSuffix = selectedRegionGroup !== 'all' ? ` from ${regionLabel}` : '';
      return (
        <View style={styles.feedStateContainer}>
          <View style={styles.loadingCard}>
            <View style={styles.loadingPulse}>
              <Newspaper size={32} color={Colors.primary} />
            </View>
            <Text style={styles.loadingTitle}>
              {catLabel ? `Fetching ${catLabel} stories${regionSuffix}` : `Fetching stories${regionSuffix}`}
            </Text>
            <Text style={styles.loadingSub}>
              Real news from French-speaking countries
            </Text>
            <ActivityIndicator size="small" color={Colors.primary} style={{ marginTop: 12 }} />
          </View>
        </View>
      );
    }

    if (catError && categoryArticles.length === 0) {
      return (
        <View style={styles.feedStateContainer}>
          <View style={styles.errorCard}>
            <View style={styles.errorIconWrap}>
              <AlertCircle size={28} color={Colors.error} />
            </View>
            <Text style={styles.errorTitle}>Couldn't load articles</Text>
            <Text style={styles.errorSub}>
              {catError?.message || 'Check your connection and try again'}
            </Text>
            <Pressable
              style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.85 }]}
              onPress={() => {
                console.log('[Read] Manual retry for category:', selectedFeedCategory);
                news.clearCooldown(selectedFeedCategory);
                setCategoryRetrying(true);
                void news.forceRefreshCategory(selectedFeedCategory)
                  .catch(e => console.log('[Read] Manual retry failed:', e))
                  .finally(() => setCategoryRetrying(false));
              }}
              disabled={categoryRetrying}
            >
              {categoryRetrying ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <RefreshCw size={15} color="white" />
              )}
              <Text style={styles.retryBtnText}>{categoryRetrying ? 'Retrying...' : 'Try Again'}</Text>
            </Pressable>
          </View>
        </View>
      );
    }

    if (filteredArticles.length === 0 && categoryArticles.length > 0) {
      if (isCatLoading || news.isLoading) {
        return (
          <View style={styles.feedStateContainer}>
            <View style={styles.loadingCard}>
              <View style={styles.loadingPulse}>
                <Newspaper size={32} color={Colors.primary} />
              </View>
              <Text style={styles.loadingTitle}>
                Loading {regionLabel} stories...
              </Text>
              <Text style={styles.loadingSub}>
                Searching French-speaking sources
              </Text>
              <ActivityIndicator size="small" color={Colors.primary} style={{ marginTop: 12 }} />
            </View>
          </View>
        );
      }
      return (
        <View style={styles.feedStateContainer}>
          <View style={styles.emptyCard}>
            <Filter size={28} color={Colors.border} />
            <Text style={styles.emptyTitle}>No {regionLabel} stories yet</Text>
            <Text style={styles.emptySub}>Try refreshing or check back later</Text>
            <View style={styles.emptyActions}>
              <Pressable
                style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.85 }]}
                onPress={() => {
                  console.log('[Read] Force refresh for region:', selectedRegionGroup);
                  news.clearCooldown(selectedFeedCategory);
                  setCategoryRetrying(true);
                  void news.forceRefreshCategory(selectedFeedCategory)
                    .catch(e => console.log('[Read] Region retry failed:', e))
                    .finally(() => setCategoryRetrying(false));
                }}
                disabled={categoryRetrying}
              >
                {categoryRetrying ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <RefreshCw size={15} color="white" />
                )}
                <Text style={styles.retryBtnText}>{categoryRetrying ? 'Refreshing...' : 'Refresh Articles'}</Text>
              </Pressable>
              <Pressable onPress={() => { setSelectedRegionGroup('all'); }} style={styles.clearFilterBtn}>
                <Text style={styles.emptyLink}>Show all regions</Text>
              </Pressable>
            </View>
          </View>
        </View>
      );
    }

    if (filteredArticles.length === 0) {
      return (
        <View style={styles.feedStateContainer}>
          <View style={styles.errorCard}>
            <View style={styles.errorIconWrap}>
              <AlertCircle size={28} color={Colors.error} />
            </View>
            <Text style={styles.errorTitle}>No articles loaded</Text>
            <Text style={styles.errorSub}>Tap below to fetch articles</Text>
            <Pressable
              style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.85 }]}
              onPress={() => {
                console.log('[Read] Retry fetch for category:', selectedFeedCategory);
                news.clearCooldown(selectedFeedCategory);
                setCategoryRetrying(true);
                void news.forceRefreshCategory(selectedFeedCategory)
                  .catch(e => console.log('[Read] Retry failed:', e))
                  .finally(() => setCategoryRetrying(false));
              }}
              disabled={categoryRetrying}
            >
              {categoryRetrying ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <RefreshCw size={15} color="white" />
              )}
              <Text style={styles.retryBtnText}>{categoryRetrying ? 'Fetching...' : 'Fetch Articles'}</Text>
            </Pressable>
          </View>
        </View>
      );
    }

    return (
      <ScrollView
        style={styles.feedScroll}
        contentContainerStyle={styles.feedScrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isCatLoading}
            onRefresh={() => {
              console.log('[Read] Pull-to-refresh: force refreshing', selectedFeedCategory);
              news.forceRefreshCategory(selectedFeedCategory).catch(e => {
                console.log('[Read] Force refresh failed:', e);
              });
            }}
            tintColor={Colors.primary}
          />
        }
      >
        {news.isBackgroundRefreshing && (
          <View style={styles.backgroundRefreshBanner}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={styles.backgroundRefreshText}>Updating headlines…</Text>
          </View>
        )}

        <View style={styles.levelIndicatorRow}>
          <Zap size={13} color={Colors.primary} />
          <Text style={styles.levelIndicatorText}>
            Articles adapt to <Text style={styles.levelIndicatorBold}>{news.userLevel}</Text>
          </Text>
          <View style={styles.levelIndicatorRight}>
            {lastRefreshedStr && (
              <Text style={styles.lastRefreshedText}>
                Updated {lastRefreshedStr}
              </Text>
            )}
            <Text style={styles.articleCount}>
              {displayedArticles.length} of {filteredArticles.length}
            </Text>
          </View>
        </View>

        {displayedArticles.map((article, index) => renderFeedCard(article, index))}

        {displayedArticles.length > 0 && (
          <Pressable
            style={({ pressed }) => [
              styles.loadMoreBtn,
              pressed && { opacity: 0.85 },
              news.isLoadingMore && styles.loadMoreBtnDisabled,
            ]}
            onPress={handleManualLoadMore}
            disabled={news.isLoadingMore}
            testID="load-more-btn"
          >
            <View style={styles.loadMoreBtnInner}>
              {news.isLoadingMore ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <RefreshCw size={16} color="white" />
              )}
              <Text style={styles.loadMoreBtnText}>
                {news.isLoadingMore ? 'Loading...' : 'Load More Articles'}
              </Text>
            </View>
            <Text style={styles.loadMoreCount}>
              Showing {displayedArticles.length} of {filteredArticles.length}
            </Text>
          </Pressable>
        )}

        <Pressable
          style={({ pressed }) => [styles.libraryPromo, pressed && { opacity: 0.85 }]}
          onPress={switchView}
        >
          <View style={styles.libraryPromoLeft}>
            <View style={styles.libraryPromoIcon}>
              <BookOpen size={18} color={Colors.primary} />
            </View>
            <View>
              <Text style={styles.libraryPromoTitle}>Curated Library</Text>
              <Text style={styles.libraryPromoSub}>
                {frenchContent.length} stories, dialogues & articles
              </Text>
            </View>
          </View>
          <ChevronRight size={18} color={Colors.textMuted} />
        </Pressable>
      </ScrollView>
    );
  };

  const renderLibraryCard = useCallback(
    (item: typeof frenchContent[0]) => {
      const isCompleted = completedContentIds.includes(item.id);
      const imgResult = getLibraryImageResult(item.title, item.region, item.category, item.id, libSmartImages);
      const flag = getRegionFlag(item.region);
      const diffColor = difficultyColors[item.difficulty];

      return (
        <Pressable
          key={item.id}
          onPress={() => handleContentPress(item.id)}
          style={({ pressed }) => [styles.libImageCard, pressed && styles.feedCardPressed]}
          testID={`lib-card-${item.id}`}
        >
          <ImageCardBackground
            uri={imgResult.primary}
            fallbackUri={imgResult.fallback}
            gradientColors={imgResult.gradient}
            style={styles.libImageCardBg}
            imageStyle={styles.libImageCardBgInner}
          >
            <LinearGradient
              colors={['rgba(0,0,0,0.15)', 'transparent', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0.92)']}
              locations={[0, 0.2, 0.6, 1]}
              style={styles.libImageCardGradient}
            >
              <View style={styles.libImageCardTop}>
                <View style={[styles.libDiffBadge, { backgroundColor: diffColor }]}>
                  <Text style={styles.libDiffText}>{difficultyLabels[item.difficulty]}</Text>
                </View>
                <View style={styles.libImageTopRight}>
                  {isCompleted && (
                    <View style={styles.libCompletedCircle}>
                      <Check size={10} color="white" />
                    </View>
                  )}
                  <View style={styles.feedRegionBadge}>
                    <Text style={styles.feedRegionFlag}>{flag}</Text>
                    <Text style={styles.feedRegionText}>{regionLabels[item.region]}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.libImageCardBottom}>
                <View style={styles.libTypeBadge}>
                  <Text style={styles.libTypeText}>{categoryLabels[item.category]}</Text>
                </View>
                <Text style={styles.libImageTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                {item.subtitle && (
                  <Text style={styles.libImageSubtitle} numberOfLines={1}>
                    {item.subtitle}
                  </Text>
                )}
                <View style={styles.libImageMeta}>
                  <Clock size={11} color="rgba(255,255,255,0.6)" />
                  <Text style={styles.libImageMetaText}>{item.estimatedMinutes} min read</Text>
                </View>
              </View>
            </LinearGradient>
          </ImageCardBackground>
        </Pressable>
      );
    },
    [completedContentIds, handleContentPress, libSmartImages]
  );

  const renderLibraryView = () => (
    <>
      {renderRegionGroupPills(selectedLibRegionGroup, setSelectedLibRegionGroup)}

      <View style={styles.libFilters}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.libFiltersScroll}>
          {(['difficulty', 'region', 'type', 'status'] as FilterType[]).map((filterType) => (
            <Pressable
              key={filterType}
              style={[
                styles.libFilterChip,
                isFilterActive(filterType) && styles.libFilterChipActive,
              ]}
              onPress={() => setActiveFilter(filterType)}
            >
              <Text
                style={[
                  styles.libFilterChipText,
                  isFilterActive(filterType) && styles.libFilterChipTextActive,
                ]}
              >
                {getFilterLabel(filterType)}
              </Text>
              {isFilterActive(filterType) ? (
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    clearFilter(filterType);
                  }}
                  hitSlop={8}
                >
                  <X size={11} color={Colors.primary} />
                </Pressable>
              ) : (
                <ChevronDown size={11} color={Colors.textMuted} />
              )}
            </Pressable>
          ))}
        </ScrollView>
        {activeFiltersCount > 0 && (
          <Text style={styles.libResultCount}>{filteredContent.length} results</Text>
        )}
      </View>

      <ScrollView
        style={styles.libScroll}
        contentContainerStyle={styles.libScrollContent}
        showsVerticalScrollIndicator={false}
      >
        {filteredContent.map((item) => renderLibraryCard(item))}
        {filteredContent.length === 0 && (
          <View style={styles.libEmpty}>
            <Filter size={36} color={Colors.border} />
            <Text style={styles.libEmptyTitle}>No articles found</Text>
            <Text style={styles.libEmptyText}>Try adjusting your filters</Text>
          </View>
        )}
      </ScrollView>
    </>
  );

  const renderFilterModal = () => (
    <Modal
      visible={activeFilter !== null}
      transparent
      animationType="fade"
      onRequestClose={() => setActiveFilter(null)}
    >
      <Pressable style={styles.modalOverlay} onPress={() => setActiveFilter(null)}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {activeFilter === 'difficulty' && 'Select Level'}
              {activeFilter === 'region' && 'Select Region'}
              {activeFilter === 'type' && 'Select Type'}
              {activeFilter === 'status' && 'Filter by Status'}
            </Text>
            <Pressable onPress={() => setActiveFilter(null)} style={styles.modalClose}>
              <X size={20} color={Colors.textSecondary} />
            </Pressable>
          </View>
          <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
            {activeFilter === 'difficulty' && (
              <>
                <Pressable
                  style={[styles.modalOption, selectedDifficulty === 'all' && styles.modalOptionActive]}
                  onPress={() => { setSelectedDifficulty('all'); setActiveFilter(null); }}
                >
                  <Text style={[styles.modalOptionText, selectedDifficulty === 'all' && styles.modalOptionTextActive]}>
                    All Levels
                  </Text>
                </Pressable>
                {difficulties.map((d) => (
                  <Pressable
                    key={d}
                    style={[styles.modalOption, selectedDifficulty === d && styles.modalOptionActive]}
                    onPress={() => { setSelectedDifficulty(d); setActiveFilter(null); }}
                  >
                    <View style={[styles.diffDot, { backgroundColor: difficultyColors[d] }]} />
                    <Text style={[styles.modalOptionText, selectedDifficulty === d && styles.modalOptionTextActive]}>
                      {difficultyLabels[d]}
                    </Text>
                  </Pressable>
                ))}
              </>
            )}
            {activeFilter === 'region' && regions.map((r) => (
              <Pressable
                key={r.value}
                style={[styles.modalOption, selectedRegion === r.value && styles.modalOptionActive]}
                onPress={() => { setSelectedRegion(r.value); setActiveFilter(null); }}
              >
                {r.value !== 'all' && (
                  <Text style={styles.modalRegionFlag}>{getRegionFlag(r.value)}</Text>
                )}
                <Text style={[styles.modalOptionText, selectedRegion === r.value && styles.modalOptionTextActive]}>
                  {r.label}
                </Text>
              </Pressable>
            ))}
            {activeFilter === 'type' && libraryCategories.map((c) => (
              <Pressable
                key={c.value}
                style={[styles.modalOption, selectedCategory === c.value && styles.modalOptionActive]}
                onPress={() => { setSelectedCategory(c.value); setActiveFilter(null); }}
              >
                <Text style={[styles.modalOptionText, selectedCategory === c.value && styles.modalOptionTextActive]}>
                  {c.label}
                </Text>
              </Pressable>
            ))}
            {activeFilter === 'status' && (['all', 'read', 'unread'] as ReadStatus[]).map((s) => (
              <Pressable
                key={s}
                style={[styles.modalOption, selectedStatus === s && styles.modalOptionActive]}
                onPress={() => { setSelectedStatus(s); setActiveFilter(null); }}
              >
                <Text style={[styles.modalOptionText, selectedStatus === s && styles.modalOptionTextActive]}>
                  {statusLabels[s]}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Pressable>
    </Modal>
  );

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <Animated.View style={[styles.animatedWrap, { opacity: fadeAnim }]}>
          {isSearchMode ? (
            <View style={styles.header}>
              <Pressable
                style={styles.headerBackBtn}
                onPress={clearSearch}
                testID="search-back-btn"
              >
                <ArrowLeft size={22} color={Colors.text} />
              </Pressable>
              <View style={styles.searchInputWrapper}>
                <Search size={16} color={Colors.textMuted} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search in English or French..."
                  placeholderTextColor={Colors.textMuted}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  onSubmitEditing={handleSearch}
                  returnKeyType="search"
                  autoFocus
                  testID="search-input"
                />
                {searchQuery.length > 0 && (
                  <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                    <X size={16} color={Colors.textMuted} />
                  </Pressable>
                )}
              </View>
            </View>
          ) : (
            <View style={styles.header}>
              <Pressable
                style={styles.headerBackBtn}
                onPress={() => router.push('/(tabs)/home' as any)}
                testID="read-back-btn"
              >
                <ArrowLeft size={22} color={Colors.text} />
              </Pressable>
              <View style={styles.headerCenter}>
                <Text style={styles.headerTitle}>
                  {activeView === 'feed' ? 'Explore' : 'Library'}
                </Text>
              </View>
              {activeView === 'feed' && (
                <Pressable
                  style={styles.headerToggleBtn}
                  onPress={openSearch}
                  testID="search-btn"
                >
                  <Search size={18} color={Colors.textSecondary} />
                </Pressable>
              )}
              <Pressable
                style={[styles.headerToggleBtn, activeView === 'library' && styles.headerToggleBtnActive]}
                onPress={switchView}
                testID="view-toggle"
              >
                {activeView === 'feed' ? (
                  <BookOpen size={18} color={Colors.textSecondary} />
                ) : (
                  <Newspaper size={18} color={Colors.primary} />
                )}
              </Pressable>
            </View>
          )}

          {isSearchMode ? renderSearchView() : (
            <>
              {activeView === 'feed' && (
                <>
                  {renderRegionGroupPills(selectedRegionGroup, setSelectedRegionGroup, regionGroupCounts)}
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.categoryPillsContainer}
                    style={styles.categoryPillsScroll}
                  >
                    {FEED_CATEGORIES.map((cat) => {
                      const isActive = selectedFeedCategory === cat.key;
                      return (
                        <Pressable
                          key={cat.key}
                          style={[
                            styles.categoryPill,
                            isActive && { backgroundColor: cat.color },
                          ]}
                          onPress={() => {
                            void Haptics.selectionAsync();
                            setSelectedFeedCategory(cat.key);
                          }}
                        >
                          <Text
                            style={[
                              styles.categoryPillText,
                              isActive
                                ? styles.categoryPillTextActive
                                : { color: cat.key === 'all' ? Colors.textSecondary : cat.color },
                            ]}
                          >
                            {cat.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </>
              )}
              {activeView === 'feed' ? renderFeedView() : renderLibraryView()}
            </>
          )}
        </Animated.View>
      </SafeAreaView>
      {renderFilterModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F5F2',
  },
  safeArea: {
    flex: 1,
  },
  animatedWrap: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  headerBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700' as const,
    color: Colors.text,
    letterSpacing: -0.5,
  },
  headerToggleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerToggleBtnActive: {
    backgroundColor: Colors.primaryLight,
  },
  regionGroupScroll: {
    flexGrow: 0,
    marginBottom: 6,
  },
  regionGroupContainer: {
    paddingHorizontal: 16,
    gap: 8,
  },
  regionGroupPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 22,
    backgroundColor: 'white',
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  regionGroupPillActive: {
    backgroundColor: '#1C1C2E',
    borderColor: '#1C1C2E',
  },
  regionGroupEmoji: {
    fontSize: 15,
  },
  regionGroupLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  regionGroupLabelActive: {
    color: 'white',
  },
  regionGroupCount: {
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    minWidth: 22,
    alignItems: 'center',
  },
  regionGroupCountActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  regionGroupCountText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.textMuted,
  },
  regionGroupCountTextActive: {
    color: 'rgba(255,255,255,0.85)',
  },
  categoryPillsScroll: {
    flexGrow: 0,
    marginBottom: 4,
  },
  categoryPillsContainer: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.08)',
    backgroundColor: 'white',
  },
  categoryPillText: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  categoryPillTextActive: {
    color: 'white',
  },
  feedScroll: {
    flex: 1,
  },
  feedScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
  },
  levelIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
    paddingHorizontal: 2,
  },
  levelIndicatorText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  levelIndicatorBold: {
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  articleCount: {
    fontSize: 11,
    color: Colors.textMuted,
    marginLeft: 'auto',
    marginRight: 4,
  },
  lastUpdated: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  feedCard: {
    marginBottom: 16,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#1a1a2e',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  feedCardHero: {
    marginBottom: 20,
  },
  feedCardPressed: {
    opacity: 0.95,
    transform: [{ scale: 0.98 }],
  },
  feedCardImage: {
    height: CARD_HEIGHT,
    width: '100%',
    justifyContent: 'space-between',
  },
  feedCardImageHero: {
    height: HERO_HEIGHT,
  },
  feedCardImageInner: {
    borderRadius: 20,
  },
  feedCardGradient: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 18,
    borderRadius: 20,
  },
  feedCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  feedCategoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  feedCategoryText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: 'white',
    letterSpacing: 0.3,
    textTransform: 'uppercase' as const,
  },
  feedRegionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  feedRegionFlag: {
    fontSize: 14,
  },
  feedRegionText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.85)',
  },
  feedCardBottom: {
    gap: 6,
  },
  feedHeadline: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: 'white',
    lineHeight: 24,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  feedHeadlineHero: {
    fontSize: 22,
    lineHeight: 29,
  },
  feedSummary: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 20,
  },
  feedMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  feedSource: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.65)',
  },
  feedMetaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  feedTime: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
  },
  feedStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  loadingCard: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 40,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
  },
  loadingPulse: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  loadingTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  loadingSub: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center' as const,
  },
  errorCard: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 36,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
  },
  errorIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.errorLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  errorSub: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center' as const,
    marginBottom: 20,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
  },
  retryBtnText: {
    color: 'white',
    fontWeight: '600' as const,
    fontSize: 14,
  },
  emptyCard: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 40,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
    marginTop: 14,
  },
  emptySub: {
    fontSize: 14,
    color: Colors.textMuted,
    marginTop: 4,
  },
  emptyLink: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.primary,
    marginTop: 12,
  },
  emptyActions: {
    alignItems: 'center' as const,
    gap: 8,
    marginTop: 16,
  },
  clearFilterBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  libraryPromo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    borderRadius: 18,
    padding: 16,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  libraryPromoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  libraryPromoIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  libraryPromoTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  libraryPromoSub: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 1,
  },
  libImageCard: {
    marginBottom: 14,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#1a1a2e',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  libImageCardBg: {
    height: LIB_CARD_HEIGHT,
    width: '100%',
    justifyContent: 'space-between',
  },
  libImageCardBgInner: {
    borderRadius: 18,
  },
  libImageCardGradient: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 18,
  },
  libImageCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  libDiffBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  libDiffText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: 'white',
    letterSpacing: 0.3,
    textTransform: 'uppercase' as const,
  },
  libImageTopRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  libCompletedCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  libTypeBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'flex-start' as const,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  libTypeText: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.75)',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  libImageCardBottom: {
    gap: 2,
  },
  libImageTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: 'white',
    lineHeight: 22,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  libImageSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.65)',
    lineHeight: 18,
  },
  libImageMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  libImageMetaText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
  },
  libFilters: {
    paddingVertical: 10,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  libFiltersScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  libFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: '#F8F5F2',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  libFilterChipActive: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
  },
  libFilterChipText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
  },
  libFilterChipTextActive: {
    color: Colors.primary,
    fontWeight: '600' as const,
  },
  libResultCount: {
    fontSize: 12,
    color: Colors.textMuted,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  libScroll: {
    flex: 1,
  },
  libScrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  libEmpty: {
    padding: 60,
    alignItems: 'center',
  },
  libEmptyTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
    marginTop: 14,
    marginBottom: 4,
  },
  libEmptyText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  modalClose: {
    padding: 4,
  },
  modalScroll: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    marginVertical: 2,
  },
  modalOptionActive: {
    backgroundColor: Colors.primaryLight,
  },
  modalOptionText: {
    fontSize: 16,
    color: Colors.text,
  },
  modalOptionTextActive: {
    color: Colors.primary,
    fontWeight: '600' as const,
  },
  modalRegionFlag: {
    fontSize: 18,
  },
  diffDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  autoLoadingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  autoLoadingText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  loadMoreBtn: {
    backgroundColor: '#1C1C2E',
    borderRadius: 18,
    padding: 18,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  loadMoreBtnDisabled: {
    opacity: 0.6,
  },
  loadMoreBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  loadMoreBtnText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: 'white',
  },
  loadMoreCount: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },
  dailyCapWrap: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    marginTop: 4,
  },
  dailyCapText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  dailyCapSub: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 4,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
    padding: 0,
  },
  searchPromptContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  searchPromptIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0,0,0,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  searchPromptTitle: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  searchPromptSub: {
    fontSize: 15,
    color: Colors.textMuted,
    textAlign: 'center' as const,
    lineHeight: 22,
  },
  searchResultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 2,
  },
  searchResultsCount: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  searchResultsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  searchResultsLevel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  backgroundRefreshBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: Colors.primaryLight,
    borderRadius: 12,
    marginBottom: 10,
  },
  backgroundRefreshText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.primary,
  },
  levelIndicatorRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 'auto',
  },
  lastRefreshedText: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  translatedQueryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 16,
  },
  translatedQueryLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  translatedQueryText: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '600' as const,
    fontStyle: 'italic' as const,
  },
});
