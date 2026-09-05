import { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  Pressable,
  Animated,
  Dimensions,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { 
  BookOpen, 
  Mic, 
  Globe,
  Table,
  Headphones,
  MessageSquare,
  Languages,
  ChevronRight,
  ChevronDown,
  Shield,
  X,
  Check,
  Lock,
  TrendingUp,
  Newspaper,
  MonitorPlay,
  Compass,
  GraduationCap,
  UserCircle,
  Heart,
  Zap,
  Star,
  Trophy,
  Flame,
  Map,
  AlertCircle,
  Clock,
  Target,
  Play,
  Sparkles,
  BarChart3,
  MessagesSquare,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { USE_NATIVE_DRIVER } from '@/constants/animation';
import { useApp } from '@/contexts/AppContext';
import { foundationLessons } from '@/mocks/content';
import { learningModules } from '@/mocks/modules';
import Kiri from '@/components/Kiri';
import StreakBadge from '@/components/StreakBadge';
import AnimatedProgressBar from '@/components/AnimatedProgressBar';
import { useNews } from '@/hooks/useNews';
import { getRegionFlag, NEWS_CATEGORY_COLORS } from '@/utils/perplexity';
import { useHeadlineTranslations } from '@/hooks/useHeadlineTranslations';
import { shouldShowWeeklyRecap } from '@/app/weekly-recap';
import CEFRProgressCard from '@/components/CEFRProgressCard';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { pronStages, PRON_PASS_SCORE } from '@/data/foundationPronunciation';
import {
  getCurrentCertifiedLevel,
  getNextTestableLevel,
  CEFR_LEVEL_NAMES,
  CEFR_LEVEL_COLORS,
  CEFR_LEVEL_DESCRIPTIONS,
  CEFR_LEVEL_ORDER,
  MODULE_TO_CEFR,
  getLevelProgressInfo,
} from '@/utils/proficiency';
import { CEFRLevel, GapCategory, GapItem } from '@/types';
import { getGapScheduleSummary } from '@/utils/gapScheduler';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MOBILE_WIDTH = Math.min(SCREEN_WIDTH, 430);
const CARD_WIDTH = MOBILE_WIDTH * 0.82;
const CARD_MARGIN = 12;

const HEART_REGEN_INTERVAL_MS = 30 * 60 * 1000;

const CATEGORY_ICONS: Record<GapCategory, { icon: string; color: string; bg: string }> = {
  vocabulary: { icon: 'book', color: '#10B981', bg: '#ECFDF5' },
  grammar: { icon: 'code', color: '#8B5CF6', bg: '#EDE9FE' },
  pronunciation: { icon: 'mic', color: '#F59E0B', bg: '#FFFBEB' },
  phrasing: { icon: 'message', color: '#06B6D4', bg: '#CFFAFE' },
  register: { icon: 'shield', color: '#EC4899', bg: '#FCE7F3' },
};

const CATEGORY_LABELS: Record<GapCategory, string> = {
  vocabulary: 'Vocabulary',
  grammar: 'Grammar',
  pronunciation: 'Pronunciation',
  phrasing: 'Phrasing',
  register: 'Register',
};

function getGreetingMessage(streakCount: number): { greeting: string; subtitle: string; mood: 'idle' | 'happy' | 'encouraging' | 'celebrating' } {
  const hour = new Date().getHours();
  let timeGreeting = 'Bonjour';
  if (hour < 6) timeGreeting = 'Bonne nuit';
  else if (hour < 12) timeGreeting = 'Bonjour';
  else if (hour < 18) timeGreeting = 'Bon après-midi';
  else timeGreeting = 'Bonsoir';

  if (streakCount >= 14) {
    return { greeting: `${timeGreeting}!`, subtitle: `${streakCount}-day streak! You're unstoppable!`, mood: 'celebrating' };
  } else if (streakCount >= 7) {
    return { greeting: `${timeGreeting}!`, subtitle: `Amazing ${streakCount}-day streak! Keep going!`, mood: 'happy' };
  } else if (streakCount >= 3) {
    return { greeting: `${timeGreeting}!`, subtitle: `${streakCount} days strong — nice momentum!`, mood: 'happy' };
  } else if (streakCount >= 1) {
    return { greeting: `${timeGreeting}!`, subtitle: 'Welcome back! Ready to learn?', mood: 'encouraging' };
  }
  return { greeting: `${timeGreeting}!`, subtitle: 'Start your streak today!', mood: 'idle' };
}

interface RecommendationCard {
  id: string;
  category: GapCategory;
  gapCount: number;
  urgency: 'overdue' | 'due_today' | 'upcoming';
  urgencyColor: string;
  urgencyLabel: string;
  gaps: GapItem[];
}

function buildRecommendations(gaps: GapItem[]): RecommendationCard[] {
  const schedule = getGapScheduleSummary(gaps);
  const categoryBuckets: Record<GapCategory, { overdue: GapItem[]; due: GapItem[]; upcoming: GapItem[] }> = {
    vocabulary: { overdue: [], due: [], upcoming: [] },
    grammar: { overdue: [], due: [], upcoming: [] },
    pronunciation: { overdue: [], due: [], upcoming: [] },
    phrasing: { overdue: [], due: [], upcoming: [] },
    register: { overdue: [], due: [], upcoming: [] },
  };

  for (const gap of schedule.critical) {
    categoryBuckets[gap.category].overdue.push(gap);
  }
  for (const gap of schedule.due) {
    categoryBuckets[gap.category].due.push(gap);
  }
  for (const gap of schedule.upcoming) {
    categoryBuckets[gap.category].upcoming.push(gap);
  }

  const cards: RecommendationCard[] = [];
  const categories = Object.keys(categoryBuckets) as GapCategory[];

  for (const cat of categories) {
    const bucket = categoryBuckets[cat];
    const totalDue = bucket.overdue.length + bucket.due.length;
    if (totalDue > 0) {
      const allGaps = [...bucket.overdue, ...bucket.due];
      const urgency = bucket.overdue.length > 0 ? 'overdue' as const : 'due_today' as const;
      cards.push({
        id: `rec-${cat}`,
        category: cat,
        gapCount: totalDue,
        urgency,
        urgencyColor: urgency === 'overdue' ? '#DC2626' : '#F59E0B',
        urgencyLabel: urgency === 'overdue' ? 'Overdue' : 'Due today',
        gaps: allGaps.slice(0, 10),
      });
    } else if (bucket.upcoming.length > 0) {
      cards.push({
        id: `rec-${cat}`,
        category: cat,
        gapCount: bucket.upcoming.length,
        urgency: 'upcoming',
        urgencyColor: '#10B981',
        urgencyLabel: 'Upcoming',
        gaps: bucket.upcoming.slice(0, 10),
      });
    }
  }

  cards.sort((a, b) => {
    const urgencyOrder = { overdue: 0, due_today: 1, upcoming: 2 };
    if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
      return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    }
    return b.gapCount - a.gapCount;
  });

  return cards.slice(0, 3);
}

type FeatureCard = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: React.ReactNode;
  iconBg: string;
  route: string;
  stats?: string;
};

const CEFR_DETAIL_TEXT: Record<CEFRLevel, { canDo: string[]; skills: string }> = {
  'A1': {
    canDo: [
      'Introduce yourself and others',
      'Ask and answer basic personal questions',
      'Handle simple interactions in shops and cafés',
    ],
    skills: 'Basic greetings, numbers, present tense être/avoir',
  },
  'A2': {
    canDo: [
      'Describe routines, family, and surroundings',
      'Communicate in simple everyday tasks',
      'Make plans using futur proche',
    ],
    skills: 'Reflexive verbs, connectors, comparisons, passé composé',
  },
  'B1': {
    canDo: [
      'Handle most travel situations in France',
      'Describe experiences, events, and ambitions',
      'Give reasons and explanations for opinions',
    ],
    skills: 'Imparfait vs passé composé, discourse markers, storytelling',
  },
  'B2': {
    canDo: [
      'Interact with fluency and spontaneity',
      'Produce clear, detailed text on complex subjects',
      'Understand the main ideas of complex texts',
    ],
    skills: 'Subjunctive, conditional, relative pronouns, idioms, register',
  },
  'C1': {
    canDo: [
      'Express ideas fluently without much searching',
      'Use language flexibly for social, academic, and professional purposes',
      'Produce well-structured, detailed text on complex subjects',
    ],
    skills: 'Literary tenses, advanced subjunctive, formal connectors, proverbs',
  },
  'C2': {
    canDo: [
      'Understand virtually everything heard or read',
      'Summarize information from different sources',
      'Express yourself spontaneously with precision in any context',
    ],
    skills: 'Literary style, slang/verlan, regional variations, academic register',
  },
};

function ExpandableStatsCard({
  gameState,
  nextRegenIn,
  weeklyStats,
  children,
}: {
  gameState: any;
  nextRegenIn: string | null;
  weeklyStats: { lessonsCompleted: number; streakDays: number; weeklyXP: number };
  children: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const expandAnim = useRef(new Animated.Value(0)).current;
  const chevronAnim = useRef(new Animated.Value(0)).current;

  const toggleExpand = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const toValue = expanded ? 0 : 1;
    Animated.parallel([
      Animated.spring(expandAnim, {
        toValue,
        useNativeDriver: false,
        tension: 80,
        friction: 12,
      }),
      Animated.timing(chevronAnim, {
        toValue,
        duration: 250,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start();
    setExpanded(!expanded);
  }, [expanded, expandAnim, chevronAnim]);

  const expandedHeight = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 340],
  });

  const expandedOpacity = expandAnim.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0, 0, 1],
  });

  const chevronRotate = chevronAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const dailyProgress = Math.min(gameState.dailyXP / gameState.dailyGoalXP, 1);
  const isGoalComplete = dailyProgress >= 1;

  return (
    <View style={expandStyles.card}>
      <Pressable
        style={expandStyles.collapsedRow}
        onPress={toggleExpand}
        testID="expand-stats-btn"
      >
        <View style={expandStyles.statChips}>
          <View style={expandStyles.statChip}>
            <Flame size={14} color={gameState.streakCount >= 4 ? '#F97316' : '#F59E0B'} fill={gameState.streakCount >= 4 ? '#F97316' : '#F59E0B'} />
            <Text style={expandStyles.statChipValue}>{gameState.streakCount}</Text>
          </View>
          <View style={expandStyles.chipDivider} />
          <View style={expandStyles.statChip}>
            <Zap size={14} color={Colors.primary} />
            <Text style={expandStyles.statChipValue}>{gameState.dailyXP}</Text>
            <Text style={expandStyles.statChipUnit}>XP</Text>
          </View>
          <View style={expandStyles.chipDivider} />
          <View style={expandStyles.statChip}>
            <BarChart3 size={14} color="#10B981" />
            <Text style={expandStyles.statChipValue}>{weeklyStats.lessonsCompleted}</Text>
            <Text style={expandStyles.statChipUnit}>today</Text>
          </View>
          <View style={expandStyles.chipDivider} />
          <View style={expandStyles.miniGoalRing}>
            <View style={[
              expandStyles.miniGoalTrack,
              isGoalComplete && { borderColor: '#10B981' },
            ]}>
              {isGoalComplete ? (
                <Check size={10} color="#10B981" />
              ) : (
                <Text style={expandStyles.miniGoalText}>{Math.round(dailyProgress * 100)}%</Text>
              )}
            </View>
          </View>
        </View>
        <Animated.View style={{ transform: [{ rotate: chevronRotate }] }}>
          <ChevronDown size={18} color={Colors.textMuted} />
        </Animated.View>
      </Pressable>

      <Animated.View style={[
        expandStyles.expandedContent,
        { maxHeight: expandedHeight, opacity: expandedOpacity },
      ]}>
        <View style={expandStyles.expandedInner}>
          <View style={expandStyles.fullStatsRow}>
            <View style={expandStyles.statsStripInner}>
              <View style={expandStyles.statsStripLeft}>
                <StreakBadge streakCount={gameState.streakCount} compact />
                <HeartsRow hearts={gameState.hearts} nextRegenIn={nextRegenIn} />
              </View>
              <DailyGoalRing dailyXP={gameState.dailyXP} goalXP={gameState.dailyGoalXP} size={52} />
            </View>
            <XPLevelDisplay totalXP={gameState.totalXP} />
            <View style={expandStyles.dailyXpRow}>
              <Zap size={14} color={Colors.primary} />
              <Text style={expandStyles.dailyXpText}>
                {gameState.dailyXP}/{gameState.dailyGoalXP} XP today
              </Text>
              {gameState.streakCount >= 3 && (
                <View style={expandStyles.bonusChip}>
                  <Flame size={10} color="#EF4444" fill="#EF4444" />
                  <Text style={expandStyles.bonusChipText}>2x XP</Text>
                </View>
              )}
            </View>
          </View>

          {children}

          <View style={expandStyles.weekRow}>
            <View style={expandStyles.weekCard}>
              <View style={[expandStyles.weekIconBg, { backgroundColor: '#ECFDF5' }]}>
                <BarChart3 size={14} color="#10B981" />
              </View>
              <Text style={expandStyles.weekValue}>{weeklyStats.lessonsCompleted}</Text>
              <Text style={expandStyles.weekLabel}>Lessons today</Text>
            </View>
            <View style={expandStyles.weekCard}>
              <View style={[expandStyles.weekIconBg, { backgroundColor: '#FEF3C7' }]}>
                <Flame size={14} color="#F59E0B" />
              </View>
              <Text style={expandStyles.weekValue}>{weeklyStats.streakDays}</Text>
              <Text style={expandStyles.weekLabel}>Day streak</Text>
            </View>
            <View style={expandStyles.weekCard}>
              <View style={[expandStyles.weekIconBg, { backgroundColor: '#FFF0E6' }]}>
                <Zap size={14} color={Colors.primary} />
              </View>
              <Text style={expandStyles.weekValue}>{weeklyStats.weeklyXP}</Text>
              <Text style={expandStyles.weekLabel}>XP today</Text>
            </View>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

function DailyGoalRing({ dailyXP, goalXP, size = 64 }: { dailyXP: number; goalXP: number; size?: number }) {
  const progress = Math.min(dailyXP / goalXP, 1);
  const percentage = Math.round(progress * 100);
  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2;
  const _circumference = 2 * Math.PI * radius;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const isComplete = progress >= 1;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 800,
      useNativeDriver: false,
    }).start();
  }, [progress, progressAnim]);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: size, height: size, position: 'relative' }}>
        <View style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: strokeWidth,
          borderColor: isComplete ? '#D1FAE5' : '#FEE2E2',
          position: 'absolute',
        }} />
        <View style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: strokeWidth,
          borderColor: isComplete ? '#10B981' : Colors.primary,
          position: 'absolute',
          borderTopColor: progress > 0.25 ? (isComplete ? '#10B981' : Colors.primary) : 'transparent',
          borderRightColor: progress > 0.5 ? (isComplete ? '#10B981' : Colors.primary) : 'transparent',
          borderBottomColor: progress > 0.75 ? (isComplete ? '#10B981' : Colors.primary) : 'transparent',
          borderLeftColor: progress > 0 ? (isComplete ? '#10B981' : Colors.primary) : 'transparent',
          transform: [{ rotate: '-90deg' }],
        }} />
        <View style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {isComplete ? (
            <Check size={18} color="#10B981" />
          ) : (
            <Text style={{ fontSize: 13, fontWeight: '800' as const, color: Colors.primary }}>
              {percentage}%
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

function XPLevelDisplay({ totalXP }: { totalXP: number }) {
  const level = Math.floor(totalXP / 500) + 1;
  const xpInLevel = totalXP % 500;
  const levelProgress = xpInLevel / 500;

  return (
    <View style={gamStyles.xpContainer}>
      <View style={gamStyles.levelBadge}>
        <Star size={12} color="#F59E0B" fill="#F59E0B" />
        <Text style={gamStyles.levelText}>Lv.{level}</Text>
      </View>
      <View style={gamStyles.xpBarContainer}>
        <View style={gamStyles.xpBarTrack}>
          <View style={[gamStyles.xpBarFill, { width: `${levelProgress * 100}%` as any }]} />
        </View>
        <Text style={gamStyles.xpText}>{totalXP.toLocaleString()} XP</Text>
      </View>
    </View>
  );
}

function HeartsRow({ hearts, nextRegenIn }: { hearts: number; nextRegenIn: string | null }) {
  return (
    <View style={gamStyles.heartsContainer}>
      <View style={gamStyles.heartsRow}>
        {[0, 1, 2, 3, 4].map(i => (
          <Heart
            key={i}
            size={16}
            color={i < hearts ? '#EF4444' : '#D1D5DB'}
            fill={i < hearts ? '#EF4444' : 'transparent'}
          />
        ))}
      </View>
      {hearts < 5 && nextRegenIn && (
        <Text style={gamStyles.regenText}>+1 in {nextRegenIn}</Text>
      )}
    </View>
  );
}

function MilestoneToast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  const slideAnim = useRef(new Animated.Value(-80)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: USE_NATIVE_DRIVER, tension: 60, friction: 10 }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 300, useNativeDriver: USE_NATIVE_DRIVER }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: -80, duration: 300, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(opacityAnim, { toValue: 0, duration: 300, useNativeDriver: USE_NATIVE_DRIVER }),
      ]).start(() => onDismiss());
    }, 4000);

    return () => clearTimeout(timer);
  }, [slideAnim, opacityAnim, onDismiss]);

  return (
    <Animated.View style={[gamStyles.toastContainer, {
      transform: [{ translateY: slideAnim }],
      opacity: opacityAnim,
    }]}>
      <SafeAreaView edges={['top']} style={gamStyles.toastSafeArea}>
        <View style={gamStyles.toastInner}>
          <Trophy size={20} color="#F59E0B" />
          <Text style={gamStyles.toastText}>{message}</Text>
        </View>
      </SafeAreaView>
    </Animated.View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { 
    progress, gaps, completedFoundationIds, moduleProgress, recordingLogs, proficiency, pronFoundation,
    gameState, updateStreak, acknowledgeStreakBroken, markMilestoneShown, regenerateHeart,
  } = useApp();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scrollX = useRef(new Animated.Value(0)).current;
  const resourceAnims = useRef([0, 1, 2, 3, 4].map(() => new Animated.Value(0))).current;
  const news = useNews();
  const allCategoryArticles = news.getCategoryArticles('all');
  const allFlatArticles = news.articles;
  const newsHeadlines = useMemo(() => {
    const source = allCategoryArticles.length > 0 ? allCategoryArticles : allFlatArticles;
    return [...source].sort((a, b) => 
      new Date(b.publishedDate).getTime() - new Date(a.publishedDate).getTime()
    );
  }, [allCategoryArticles, allFlatArticles]);
  const { getDisplayHeadline } = useHeadlineTranslations(newsHeadlines);
  const [cefrModalVisible, setCefrModalVisible] = useState(false);
  const [streakModalVisible, setStreakModalVisible] = useState(false);
  const [milestoneToast, setMilestoneToast] = useState<string | null>(null);
  const [nextRegenIn, setNextRegenIn] = useState<string | null>(null);
  const modalFade = useRef(new Animated.Value(0)).current;
  const modalSlide = useRef(new Animated.Value(300)).current;
  const streakModalFade = useRef(new Animated.Value(0)).current;
  const streakModalSlide = useRef(new Animated.Value(300)).current;
  const streakCheckedRef = useRef(false);
  const milestoneCheckedRef = useRef(false);
  const levelUpCheckedRef = useRef(false);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
    Animated.stagger(80, resourceAnims.map(anim =>
      Animated.timing(anim, { toValue: 1, duration: 400, useNativeDriver: USE_NATIVE_DRIVER })
    )).start();
  }, [fadeAnim, resourceAnims]);

  const recapCheckedRef = useRef(false);

  useEffect(() => {
    if (streakCheckedRef.current) return;
    streakCheckedRef.current = true;
    updateStreak();
    console.log('[Home] Called updateStreak on mount');
  }, [updateStreak]);

  useEffect(() => {
    if (levelUpCheckedRef.current) return;
    if (proficiency.certifiedLevels.length === 0) return;
    levelUpCheckedRef.current = true;

    void (async () => {
      try {
        const lastKnown = await AsyncStorage.getItem('okiri_last_cefr_level');
        const currentCert = getCurrentCertifiedLevel(proficiency.certifiedLevels);
        if (currentCert && lastKnown !== currentCert) {
          await AsyncStorage.setItem('okiri_last_cefr_level', currentCert);
          if (lastKnown !== null) {
            console.log('[Home] Level-up detected:', lastKnown, '->', currentCert);
            setTimeout(() => {
              router.push({ pathname: '/level-up', params: { level: currentCert, previousLevel: lastKnown } } as any);
            }, 1500);
          }
        } else if (currentCert && !lastKnown) {
          await AsyncStorage.setItem('okiri_last_cefr_level', currentCert);
        }
      } catch (e) {
        console.log('[Home] Level-up check error:', e);
      }
    })();
  }, [proficiency.certifiedLevels, router]);

  useEffect(() => {
    if (recapCheckedRef.current) return;
    recapCheckedRef.current = true;
    void shouldShowWeeklyRecap().then(shouldShow => {
      if (shouldShow) {
        console.log('[Home] Showing weekly recap');
        setTimeout(() => {
          router.push('/weekly-recap' as any);
        }, 1200);
      }
    });
  }, [router]);

  useEffect(() => {
    if (!gameState.streakBrokenAcknowledged && gameState.previousStreakCount > 0) {
      setTimeout(() => {
        setStreakModalVisible(true);
        Animated.parallel([
          Animated.timing(streakModalFade, { toValue: 1, duration: 250, useNativeDriver: USE_NATIVE_DRIVER }),
          Animated.spring(streakModalSlide, { toValue: 0, useNativeDriver: USE_NATIVE_DRIVER, tension: 65, friction: 11 }),
        ]).start();
      }, 800);
    }
  }, [gameState.streakBrokenAcknowledged, gameState.previousStreakCount, streakModalFade, streakModalSlide]);

  useEffect(() => {
    if (milestoneCheckedRef.current) return;
    if (gameState.streakCount <= 0) return;
    milestoneCheckedRef.current = true;

    const milestones: { day: number; key: string; message: string }[] = [
      { day: 3, key: 'streak_3', message: 'Double XP unlocked for today!' },
      { day: 7, key: 'streak_7', message: 'Bonus cultural lesson unlocked!' },
      { day: 14, key: 'streak_14', message: 'Proficiency test available!' },
    ];

    for (const m of milestones) {
      if (gameState.streakCount >= m.day && !gameState.milestonesShown?.[m.key]) {
        setTimeout(() => {
          setMilestoneToast(m.message);
          markMilestoneShown(m.key);
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }, 1500);
        break;
      }
    }
  }, [gameState.streakCount, gameState.milestonesShown, markMilestoneShown]);

  useEffect(() => {
    if (gameState.hearts >= 5) {
      setNextRegenIn(null);
      return;
    }

    const updateTimer = () => {
      if (!gameState.lastHeartLostAt) {
        setNextRegenIn(null);
        return;
      }
      const lostAt = new Date(gameState.lastHeartLostAt).getTime();
      const now = Date.now();
      const elapsed = now - lostAt;
      const remaining = HEART_REGEN_INTERVAL_MS - (elapsed % HEART_REGEN_INTERVAL_MS);

      if (elapsed >= HEART_REGEN_INTERVAL_MS) {
        const heartsToRegen = Math.min(Math.floor(elapsed / HEART_REGEN_INTERVAL_MS), 5 - gameState.hearts);
        for (let i = 0; i < heartsToRegen; i++) {
          regenerateHeart();
        }
      }

      const mins = Math.floor(remaining / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      setNextRegenIn(`${mins}:${secs.toString().padStart(2, '0')}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [gameState.hearts, gameState.lastHeartLostAt, regenerateHeart]);

  const closeStreakModal = useCallback(() => {
    Animated.parallel([
      Animated.timing(streakModalFade, { toValue: 0, duration: 200, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.timing(streakModalSlide, { toValue: 300, duration: 200, useNativeDriver: USE_NATIVE_DRIVER }),
    ]).start(() => {
      setStreakModalVisible(false);
      acknowledgeStreakBroken();
    });
  }, [streakModalFade, streakModalSlide, acknowledgeStreakBroken]);

  const currentModule = learningModules.find(m => m.id === moduleProgress.currentModuleId);

  const recommendations = useMemo(() => buildRecommendations(gaps), [gaps]);

  const greetingData = useMemo(() => getGreetingMessage(gameState.streakCount), [gameState.streakCount]);

  const weeklyStats = useMemo(() => {
    const lessonsThisWeek = gameState.lessonsCompletedToday;
    return {
      lessonsCompleted: lessonsThisWeek,
      streakDays: gameState.streakCount,
      weeklyXP: gameState.dailyXP,
    };
  }, [gameState]);

  const continueModule = useMemo(() => {
    if (!currentModule) return null;
    const moduleLessons = foundationLessons.filter(l => l.moduleId === currentModule.id);
    const completedInModule = moduleLessons.filter(l => completedFoundationIds.includes(l.id)).length;
    const totalInModule = moduleLessons.length;
    if (completedInModule >= totalInModule) return null;
    const nextLesson = moduleLessons.find(l => !completedFoundationIds.includes(l.id));
    return {
      module: currentModule,
      completedCount: completedInModule,
      totalCount: totalInModule,
      progress: totalInModule > 0 ? completedInModule / totalInModule : 0,
      nextLessonId: nextLesson?.id,
      nextLessonTitle: nextLesson?.title,
    };
  }, [currentModule, completedFoundationIds]);

  const handleRecommendationPress = useCallback((rec: RecommendationCard) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const gapIds = rec.gaps.map(g => g.id).join(',');
    router.push(`/dynamic-lesson?gapIds=${gapIds}&category=${rec.category}` as any);
  }, [router]);
  const totalLessons = foundationLessons.length;
  const activeGapCount = gaps.filter(g => !g.masteredAt).length;
  const masteredGapCount = gaps.filter(g => g.masteredAt).length;
  const totalSpeakingSessions = recordingLogs.length;

  const pronAllLessons = pronStages.flatMap(s => s.lessons);
  const pronCompletedCount = pronAllLessons.filter(l => (pronFoundation[l.id]?.score ?? 0) >= PRON_PASS_SCORE).length;
  const pronTotalCount = pronAllLessons.length;
  const isPronComplete = pronCompletedCount >= pronTotalCount;

  const featureCards: FeatureCard[] = [
    {
      id: 'learn',
      title: 'Learn',
      subtitle: `${pronCompletedCount + completedFoundationIds.length} of ${pronTotalCount + totalLessons} lessons`,
      description: isPronComplete ? 'Continue your foundation' : 'Master accent, lessons & gaps',
      icon: <GraduationCap size={36} color="#0D9488" />,
      iconBg: '#CCFBF1',
      route: '/learn',
      stats: activeGapCount > 0 ? `${activeGapCount} gaps to practice` : `${masteredGapCount} gaps mastered`,
    },
    {
      id: 'read',
      title: 'Read',
      subtitle: '100+ Articles',
      description: 'Immerse yourself in French content',
      icon: <BookOpen size={36} color="#10B981" />,
      iconBg: '#D1FAE5',
      route: '/(tabs)/read',
      stats: `${progress.weeklyStats.readingSessions} articles read`,
    },
    {
      id: 'speak',
      title: 'Speak',
      subtitle: 'Practice Sessions',
      description: 'Build fluency with speech recognition',
      icon: <Mic size={36} color="#F59E0B" />,
      iconBg: '#FEF3C7',
      route: '/(tabs)/speak',
      stats: `${totalSpeakingSessions} sessions recorded`,
    },
    {
      id: 'watch',
      title: 'Watch',
      subtitle: 'Video Lessons',
      description: 'Learn French with immersive video',
      icon: <MonitorPlay size={36} color="#F97316" />,
      iconBg: '#FFF7ED',
      route: '/(tabs)/watch',
      stats: 'Karaoke-style transcripts',
    },
    {
      id: 'scenarios',
      title: 'Scenarios',
      subtitle: 'Real-Life Help',
      description: 'Quick guide for any situation in France',
      icon: <Compass size={36} color="#0F766E" />,
      iconBg: '#CCFBF1',
      route: '/scenarios',
      stats: 'Phrases, tips & answers',
    },
    {
      id: 'listen',
      title: 'Listen',
      subtitle: 'Comprehension Practice',
      description: 'Train your ear with conversations',
      icon: <Headphones size={36} color="#8B5CF6" />,
      iconBg: '#EDE9FE',
      route: '/listen-session',
      stats: 'Tap to practice listening',
    },
    {
      id: 'converse',
      title: 'Converse',
      subtitle: 'Live Practice',
      description: 'Real-time French conversations with AI',
      icon: <MessagesSquare size={36} color="#E11D48" />,
      iconBg: '#FFE4E6',
      route: '/converse',
      stats: '8 conversation scenarios',
    },
    {
      id: 'text',
      title: 'Text',
      subtitle: 'AI French Chat',
      description: 'Chat with French AI personalities',
      icon: <MessageSquare size={36} color="#06B6D4" />,
      iconBg: '#CFFAFE',
      route: '/text-session',
      stats: '5 unique personalities',
    },
  ];

  const certifiedLevel = useMemo(() => getCurrentCertifiedLevel(proficiency.certifiedLevels), [proficiency.certifiedLevels]);
  const nextTestable = useMemo(() => getNextTestableLevel(moduleProgress.completedModules, proficiency.certifiedLevels), [moduleProgress.completedModules, proficiency.certifiedLevels]);
  const _levelProgress = useMemo(() => getLevelProgressInfo(moduleProgress.completedModules, moduleProgress.currentModuleId, proficiency.certifiedLevels), [moduleProgress, proficiency.certifiedLevels]);

  const getLevelStatus = (level: CEFRLevel): 'certified' | 'current' | 'available' | 'locked' => {
    if (proficiency.certifiedLevels.includes(level)) return 'certified';
    const workingLevel = MODULE_TO_CEFR[moduleProgress.currentModuleId];
    if (workingLevel === level) return 'current';
    const levelIndex = CEFR_LEVEL_ORDER.indexOf(level);
    const workingIndex = CEFR_LEVEL_ORDER.indexOf(workingLevel);
    if (levelIndex <= workingIndex) return 'available';
    return 'locked';
  };

  const getLevelScore = (level: CEFRLevel): number | null => {
    const record = proficiency.records.find(r => r.level === level);
    return record?.score ?? null;
  };

  const openCefrModal = () => {
    setCefrModalVisible(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.parallel([
      Animated.timing(modalFade, { toValue: 1, duration: 250, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.spring(modalSlide, { toValue: 0, useNativeDriver: USE_NATIVE_DRIVER, tension: 65, friction: 11 }),
    ]).start();
  };

  const closeCefrModal = () => {
    Animated.parallel([
      Animated.timing(modalFade, { toValue: 0, duration: 200, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.timing(modalSlide, { toValue: 300, duration: 200, useNativeDriver: USE_NATIVE_DRIVER }),
    ]).start(() => {
      setCefrModalVisible(false);
    });
  };

  const getLevelLabel = () => {
    if (certifiedLevel) return `${certifiedLevel} Certified`;
    if (!currentModule) return 'Beginner';
    return `Studying ${currentModule.cefrLevel}`;
  };

  return (
    <View style={styles.container}>
      <Animated.ScrollView style={[styles.animatedContainer, { opacity: fadeAnim }]} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={[Colors.primaryGradientStart, Colors.primaryGradientEnd]}
          style={styles.headerGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
            <View style={styles.decorativeShapes}>
              <View style={styles.curvedShape} />
              <View style={[styles.shape, styles.shapeCircle, { top: 20, right: 40 }]} />
              <View style={[styles.shape, styles.shapeX, { top: 60, right: 100 }]} />
              <View style={[styles.shape, styles.shapePlus, { top: 30, left: 60 }]} />
              <View style={[styles.shape, styles.shapeSquiggle, { bottom: 80, right: 20 }]} />
              <View style={[styles.shape, styles.shapeDot, { bottom: 100, left: 30 }]} />
              <View style={[styles.shape, styles.shapeDot, { top: 80, left: 120 }]} />
            </View>

            <View style={styles.headerContent}>
              <View style={styles.headerTop}>
                <View style={styles.headerTopLeft}>
                  <View style={styles.flagContainer}>
                    <Text style={styles.flagEmoji}>🇫🇷</Text>
                  </View>
                  <Pressable
                    style={styles.profileBtn}
                    onPress={() => {
                      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      router.push('/profile' as any);
                    }}
                    testID="profile-btn"
                  >
                    <UserCircle size={22} color="rgba(255,255,255,0.9)" />
                  </Pressable>
                </View>
                <Pressable
                  style={styles.levelBadge}
                  onPress={openCefrModal}
                  testID="cefr-badge"
                >
                  {certifiedLevel && <Shield size={14} color={Colors.textLight} />}
                  <Text style={styles.levelBadgeText}>{getLevelLabel()}</Text>
                  <ChevronRight size={12} color="rgba(255,255,255,0.7)" />
                </Pressable>
              </View>

              <Text style={styles.languageTitle}>{greetingData.greeting}</Text>
              <Text style={styles.languageStats}>
                {greetingData.subtitle}
              </Text>
            </View>
            
            <View style={styles.kiriContainer}>
              <Kiri mood={greetingData.mood} size={100} />
            </View>
          </SafeAreaView>
        </LinearGradient>

        <View style={expandStyles.cardWrap}>
          <ExpandableStatsCard
            gameState={gameState}
            nextRegenIn={nextRegenIn}
            weeklyStats={weeklyStats}
          >
            <View style={expandStyles.cefrInner}>
              <CEFRProgressCard compact />
            </View>
          </ExpandableStatsCard>
        </View>

        {recommendations.length > 0 && (
          <View style={recStyles.section}>
            <View style={recStyles.sectionHeader}>
              <View style={recStyles.sectionTitleRow}>
                <View style={recStyles.sectionIconBg}>
                  <Sparkles size={14} color={Colors.primary} />
                </View>
                <Text style={recStyles.sectionTitle}>Recommended For You</Text>
              </View>
            </View>
            {recommendations.map((rec) => {
              const catInfo = CATEGORY_ICONS[rec.category];
              return (
                <Pressable
                  key={rec.id}
                  style={({ pressed }) => [
                    recStyles.card,
                    pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                  ]}
                  onPress={() => handleRecommendationPress(rec)}
                  testID={`recommendation-${rec.category}`}
                >
                  <View style={[recStyles.cardIcon, { backgroundColor: catInfo.bg }]}>
                    {rec.category === 'vocabulary' && <BookOpen size={20} color={catInfo.color} />}
                    {rec.category === 'grammar' && <Table size={20} color={catInfo.color} />}
                    {rec.category === 'pronunciation' && <Mic size={20} color={catInfo.color} />}
                    {rec.category === 'phrasing' && <MessageSquare size={20} color={catInfo.color} />}
                    {rec.category === 'register' && <Shield size={20} color={catInfo.color} />}
                  </View>
                  <View style={recStyles.cardContent}>
                    <Text style={recStyles.cardTitle}>{CATEGORY_LABELS[rec.category]}</Text>
                    <Text style={recStyles.cardSubtitle}>
                      {rec.gapCount} gap{rec.gapCount !== 1 ? 's' : ''} to review
                    </Text>
                  </View>
                  <View style={[recStyles.urgencyBadge, { backgroundColor: rec.urgencyColor + '18' }]}>
                    {rec.urgency === 'overdue' && <AlertCircle size={12} color={rec.urgencyColor} />}
                    {rec.urgency === 'due_today' && <Clock size={12} color={rec.urgencyColor} />}
                    {rec.urgency === 'upcoming' && <Target size={12} color={rec.urgencyColor} />}
                    <Text style={[recStyles.urgencyText, { color: rec.urgencyColor }]}>{rec.urgencyLabel}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        {continueModule && (
          <Pressable
            style={({ pressed }) => [
              recStyles.continueCard,
              pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
            ]}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              if (continueModule.nextLessonId) {
                router.push(`/foundation/${continueModule.nextLessonId}` as any);
              } else {
                router.push('/learn' as any);
              }
            }}
            testID="continue-learning"
          >
            <View style={recStyles.continueLeft}>
              <View style={recStyles.continueIconBg}>
                <Play size={18} color="#fff" fill="#fff" />
              </View>
              <View style={recStyles.continueContent}>
                <Text style={recStyles.continueLabel}>Continue Learning</Text>
                <Text style={recStyles.continueTitle} numberOfLines={1}>
                  {continueModule.module.title}
                </Text>
                <View style={recStyles.continueProgressRow}>
                  <View style={recStyles.continueProgressTrack}>
                    <View style={[recStyles.continueProgressFill, { width: `${continueModule.progress * 100}%` as any }]} />
                  </View>
                  <Text style={recStyles.continueProgressText}>
                    {continueModule.completedCount}/{continueModule.totalCount}
                  </Text>
                </View>
              </View>
            </View>
            <ChevronRight size={18} color={Colors.textMuted} />
          </Pressable>
        )}

        <View style={styles.cardsContainer}>
          <Animated.ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.cardsScrollContent}
            snapToInterval={CARD_WIDTH + CARD_MARGIN}
            decelerationRate="fast"
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { x: scrollX } } }],
              { useNativeDriver: USE_NATIVE_DRIVER }
            )}
            scrollEventThrottle={16}
          >
            {featureCards.map((card, index) => {
              const inputRange = [
                (index - 1) * (CARD_WIDTH + CARD_MARGIN),
                index * (CARD_WIDTH + CARD_MARGIN),
                (index + 1) * (CARD_WIDTH + CARD_MARGIN),
              ];

              const scale = scrollX.interpolate({
                inputRange,
                outputRange: [0.95, 1, 0.95],
                extrapolate: 'clamp',
              });

              return (
                <Animated.View
                  key={card.id}
                  style={[
                    styles.featureCard,
                    { transform: [{ scale }] },
                  ]}
                >
                  <Pressable
                    style={({ pressed }) => [
                      styles.featureCardInner,
                      pressed && styles.cardPressed,
                    ]}
                    onPress={() => {
                      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      router.push(card.route as any);
                    }}
                  >
                    <View style={[styles.cardIconContainer, { backgroundColor: card.iconBg }]}>
                      {card.icon}
                    </View>

                    <Text style={styles.cardTitle}>{card.title}</Text>
                    <Text style={styles.cardSubtitle}>{card.subtitle}</Text>
                    <Text style={styles.cardDescription}>{card.description}</Text>

                    {card.id === 'learn' && (
                      <View style={styles.cardModuleSection}>
                        <View style={styles.learnCardStats}>
                          <View style={styles.learnStatItem}>
                            <Text style={styles.learnStatValue}>{pronCompletedCount}/{pronTotalCount}</Text>
                            <Text style={styles.learnStatLabel}>Accent</Text>
                          </View>
                          <View style={styles.learnStatDivider} />
                          <View style={styles.learnStatItem}>
                            <Text style={styles.learnStatValue}>{completedFoundationIds.length}/{totalLessons}</Text>
                            <Text style={styles.learnStatLabel}>Lessons</Text>
                          </View>
                          <View style={styles.learnStatDivider} />
                          <View style={styles.learnStatItem}>
                            <Text style={styles.learnStatValue}>{activeGapCount}</Text>
                            <Text style={styles.learnStatLabel}>Gaps</Text>
                          </View>
                        </View>
                        <View style={styles.cardModuleProgressRow}>
                          <AnimatedProgressBar
                            progress={pronTotalCount + totalLessons > 0
                              ? ((pronCompletedCount + completedFoundationIds.length) / (pronTotalCount + totalLessons)) * 100
                              : 0}
                            color="#0D9488"
                            trackColor={Colors.border}
                            height={6}
                            borderRadius={3}
                            style={{ flex: 1 }}
                            delay={300}
                          />
                        </View>
                      </View>
                    )}

                    {card.stats && card.id !== 'learn' && (
                      <View style={styles.cardStatsContainer}>
                        <Text style={styles.cardStats}>{card.stats}</Text>
                      </View>
                    )}
                  </Pressable>
                </Animated.View>
              );
            })}
          </Animated.ScrollView>

          <View style={styles.dotsContainer}>
            {featureCards.map((_, index) => {
              const inputRange = [
                (index - 1) * (CARD_WIDTH + CARD_MARGIN),
                index * (CARD_WIDTH + CARD_MARGIN),
                (index + 1) * (CARD_WIDTH + CARD_MARGIN),
              ];
              const dotOpacity = scrollX.interpolate({
                inputRange,
                outputRange: [0.3, 1, 0.3],
                extrapolate: 'clamp',
              });
              const dotScale = scrollX.interpolate({
                inputRange,
                outputRange: [1, 1.4, 1],
                extrapolate: 'clamp',
              });
              return (
                <Animated.View
                  key={index}
                  style={[
                    styles.dot,
                    { opacity: dotOpacity, transform: [{ scale: dotScale }] },
                  ]}
                />
              );
            })}
          </View>
        </View>

        {newsHeadlines.length > 0 && (
          <View style={styles.headlinesSection}>
            <View style={styles.headlinesHeader}>
              <View style={styles.headlinesTitleRow}>
                <View style={styles.headlinesIconBg}>
                  <Newspaper size={14} color="#047857" />
                </View>
                <Text style={styles.headlinesSectionTitle}>Today's Headlines</Text>
              </View>
              <Pressable
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push('/(tabs)/read' as any);
                }}
              >
                <Text style={styles.headlinesSeeAll}>See All</Text>
              </Pressable>
            </View>
            {newsHeadlines.slice(0, 3).map((article) => {
              const catColor = NEWS_CATEGORY_COLORS[article.category] ?? Colors.primary;
              return (
                <Pressable
                  key={article.id}
                  style={({ pressed }) => [
                    styles.headlineCard,
                    pressed && { opacity: 0.85 },
                  ]}
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push({ pathname: '/news-article', params: { articleId: article.id } } as any);
                  }}
                >
                  <View style={[styles.headlineDot, { backgroundColor: catColor }]} />
                  <View style={styles.headlineContent}>
                    <Text style={styles.headlineText} numberOfLines={2}>{getDisplayHeadline(article)}</Text>
                    <Text style={styles.headlineSource}>
                      {article.source} {getRegionFlag(article.region)}
                    </Text>
                  </View>
                  <ChevronRight size={16} color={Colors.textMuted} />
                </Pressable>
              );
            })}
          </View>
        )}

        <View style={styles.resourcesSection}>
          <Text style={styles.sectionTitle}>Resources</Text>
          <View style={styles.resourcesRow} pointerEvents="box-none">
            {[
              { icon: <Languages size={24} color={Colors.primary} />, label: 'Translator', route: '/translator' },
              { icon: <Table size={24} color={Colors.primary} />, label: 'Tenses', route: '/tenses-table' },
              { icon: <Mic size={24} color={Colors.primary} />, label: 'Accent', route: '/pronunciation-practice' },
              { icon: <Globe size={24} color={Colors.primary} />, label: 'Idioms', route: '/idioms' },
              { icon: <Map size={24} color={Colors.primary} />, label: 'Gaps', route: '/weakness-map' },
            ].map((resource, index) => (
              <Animated.View
                key={resource.label}
                style={{
                  opacity: resourceAnims[index],
                  transform: [{ translateY: resourceAnims[index].interpolate({
                    inputRange: [0, 1],
                    outputRange: [16, 0],
                  }) }],
                }}
              >
                <Pressable
                  style={styles.resourceBubble}
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push(resource.route as any);
                  }}
                >
                  <View style={styles.resourceIconContainer}>
                    {resource.icon}
                  </View>
                  <Text style={styles.resourceLabel}>{resource.label}</Text>
                </Pressable>
              </Animated.View>
            ))}
          </View>
        </View>
        <View style={{ height: 30 }} />
      </Animated.ScrollView>

      {milestoneToast && (
        <MilestoneToast
          message={milestoneToast}
          onDismiss={() => setMilestoneToast(null)}
        />
      )}

      <Modal
        visible={streakModalVisible}
        transparent
        animationType="none"
        onRequestClose={closeStreakModal}
        statusBarTranslucent
      >
        <Animated.View style={[cefrStyles.overlay, { opacity: streakModalFade }]}>
          <Pressable style={cefrStyles.overlayTouch} onPress={closeStreakModal} />
          <Animated.View style={[gamStyles.streakSheet, { transform: [{ translateY: streakModalSlide }] }]}>
            <View style={cefrStyles.handle} />
            <View style={gamStyles.streakSheetContent}>
              <Kiri mood="encouraging" size={100} />
              <Text style={gamStyles.streakSheetTitle}>Streak Lost!</Text>
              <Text style={gamStyles.streakSheetSubtitle}>
                Your streak was {gameState.previousStreakCount} {gameState.previousStreakCount === 1 ? 'day' : 'days'}!
              </Text>
              <Text style={gamStyles.streakSheetMessage}>
                Don't worry — every master was once a beginner. Start a new streak today!
              </Text>
              <Pressable
                style={({ pressed }) => [
                  gamStyles.streakSheetBtn,
                  pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
                ]}
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  closeStreakModal();
                }}
              >
                <Flame size={18} color="#fff" />
                <Text style={gamStyles.streakSheetBtnText}>Let's Go!</Text>
              </Pressable>
            </View>
          </Animated.View>
        </Animated.View>
      </Modal>

      <Modal
        visible={cefrModalVisible}
        transparent
        animationType="none"
        onRequestClose={closeCefrModal}
        statusBarTranslucent
      >
        <Animated.View style={[cefrStyles.overlay, { opacity: modalFade }]}>
          <Pressable style={cefrStyles.overlayTouch} onPress={closeCefrModal} />
          <Animated.View style={[cefrStyles.sheet, { transform: [{ translateY: modalSlide }] }]}>
            <View style={cefrStyles.handle} />
            <View style={cefrStyles.sheetHeader}>
              <View>
                <Text style={cefrStyles.sheetTitle}>CEFR Proficiency</Text>
                <Text style={cefrStyles.sheetSubtitle}>Your French language journey</Text>
              </View>
              <Pressable onPress={closeCefrModal} style={cefrStyles.closeBtn} testID="close-cefr-modal">
                <X size={20} color={Colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={cefrStyles.levelsList}
            >
              {CEFR_LEVEL_ORDER.map((level, index) => {
                const status = getLevelStatus(level);
                const score = getLevelScore(level);
                const colors = CEFR_LEVEL_COLORS[level];
                const detail = CEFR_DETAIL_TEXT[level];
                const isLocked = status === 'locked';

                return (
                  <View
                    key={level}
                    style={[
                      cefrStyles.levelCard,
                      status === 'certified' && { borderColor: colors.accent, borderWidth: 1.5 },
                      status === 'current' && { borderColor: Colors.primary, borderWidth: 1.5 },
                      isLocked && { opacity: 0.55 },
                    ]}
                  >
                    <View style={cefrStyles.levelCardTop}>
                      <View style={[cefrStyles.levelBadgeTag, { backgroundColor: colors.bg }]}>
                        <Text style={[cefrStyles.levelBadgeTagText, { color: colors.text }]}>{level}</Text>
                      </View>
                      <View style={cefrStyles.levelNameRow}>
                        <Text style={cefrStyles.levelName}>{CEFR_LEVEL_NAMES[level]}</Text>
                        {status === 'certified' && (
                          <View style={[cefrStyles.statusChip, { backgroundColor: '#ECFDF5' }]}>
                            <Check size={12} color="#059669" />
                            <Text style={[cefrStyles.statusChipText, { color: '#059669' }]}>Certified{score ? ` · ${score}%` : ''}</Text>
                          </View>
                        )}
                        {status === 'current' && (
                          <View style={[cefrStyles.statusChip, { backgroundColor: Colors.primaryLight }]}>
                            <TrendingUp size={12} color={Colors.primary} />
                            <Text style={[cefrStyles.statusChipText, { color: Colors.primary }]}>In Progress</Text>
                          </View>
                        )}
                        {isLocked && (
                          <View style={[cefrStyles.statusChip, { backgroundColor: '#F3F4F6' }]}>
                            <Lock size={12} color="#9CA3AF" />
                            <Text style={[cefrStyles.statusChipText, { color: '#9CA3AF' }]}>Locked</Text>
                          </View>
                        )}
                      </View>
                    </View>

                    <Text style={cefrStyles.levelDescription}>{CEFR_LEVEL_DESCRIPTIONS[level]}</Text>

                    {!isLocked && (
                      <View style={cefrStyles.canDoSection}>
                        <Text style={cefrStyles.canDoLabel}>What you can do:</Text>
                        {detail.canDo.map((item, i) => (
                          <View key={i} style={cefrStyles.canDoRow}>
                            <View style={[cefrStyles.canDoDot, { backgroundColor: colors.accent }]} />
                            <Text style={cefrStyles.canDoText}>{item}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {!isLocked && (
                      <View style={[cefrStyles.skillsRow, { backgroundColor: colors.bg }]}>
                        <Text style={[cefrStyles.skillsText, { color: colors.text }]}>{detail.skills}</Text>
                      </View>
                    )}

                    {status === 'current' && nextTestable === level && (
                      <Pressable
                        style={({ pressed }) => [
                          cefrStyles.takeTestBtn,
                          { backgroundColor: colors.accent },
                          pressed && { opacity: 0.85 },
                        ]}
                        onPress={() => {
                          closeCefrModal();
                          setTimeout(() => {
                            router.push(`/proficiency-test?level=${level}` as any);
                          }, 300);
                        }}
                      >
                        <Shield size={16} color="#fff" />
                        <Text style={cefrStyles.takeTestBtnText}>Take {level} Test</Text>
                      </Pressable>
                    )}

                    {index < CEFR_LEVEL_ORDER.length - 1 && !isLocked && (
                      <View style={cefrStyles.connector}>
                        <View style={[
                          cefrStyles.connectorLine,
                          status === 'certified' ? { backgroundColor: colors.accent } : { backgroundColor: Colors.border },
                        ]} />
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          </Animated.View>
        </Animated.View>
      </Modal>
    </View>
  );
}

const gamStyles = StyleSheet.create({
  statsStrip: {
    marginTop: -60,
    marginHorizontal: 16,
    backgroundColor: Colors.backgroundCard,
    borderRadius: 20,
    padding: 16,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 6,
    marginBottom: 16,
  },
  statsStripInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statsStripLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  xpContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  levelText: {
    fontSize: 13,
    fontWeight: '800' as const,
    color: '#D97706',
  },
  xpBarContainer: {
    flex: 1,
    gap: 3,
  },
  xpBarTrack: {
    height: 6,
    backgroundColor: '#FEF3C7',
    borderRadius: 3,
    overflow: 'hidden',
  },
  xpBarFill: {
    height: '100%',
    backgroundColor: '#F59E0B',
    borderRadius: 3,
  },
  xpText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.textMuted,
  },
  heartsContainer: {
    alignItems: 'center',
    gap: 2,
  },
  heartsRow: {
    flexDirection: 'row',
    gap: 3,
  },
  regenText: {
    fontSize: 9,
    color: Colors.textMuted,
    fontWeight: '500' as const,
  },
  dailyXpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  dailyXpText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  bonusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  bonusChipText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#EF4444',
  },
  streakSheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
  },
  streakSheetContent: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
    gap: 12,
  },
  streakSheetTitle: {
    fontSize: 26,
    fontWeight: '800' as const,
    color: Colors.text,
    letterSpacing: -0.5,
  },
  streakSheetSubtitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  streakSheetMessage: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    lineHeight: 22,
    paddingHorizontal: 16,
  },
  streakSheetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderRadius: 14,
    marginTop: 8,
  },
  streakSheetBtnText: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: '#fff',
  },
  toastContainer: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    zIndex: 999,
  },
  toastSafeArea: {
    backgroundColor: 'transparent',
  },
  toastInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  toastText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#92400E',
    flex: 1,
  },
});

const cefrStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  overlayTouch: {
    flex: 1,
  },
  sheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingBottom: 32,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.text,
    letterSpacing: -0.3,
  },
  sheetSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelsList: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  levelCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  levelCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  levelBadgeTag: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  levelBadgeTagText: {
    fontSize: 14,
    fontWeight: '700' as const,
  },
  levelNameRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  levelName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '600' as const,
  },
  levelDescription: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: 10,
  },
  canDoSection: {
    marginBottom: 10,
  },
  canDoLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  canDoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 4,
  },
  canDoDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 5,
  },
  canDoText: {
    fontSize: 13,
    color: Colors.text,
    flex: 1,
    lineHeight: 18,
  },
  skillsRow: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 4,
  },
  skillsText: {
    fontSize: 12,
    fontWeight: '500' as const,
    lineHeight: 17,
  },
  takeTestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 10,
  },
  takeTestBtnText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#fff',
  },
  connector: {
    alignItems: 'center',
    position: 'absolute',
    bottom: -14,
    left: 0,
    right: 0,
  },
  connectorLine: {
    width: 2,
    height: 14,
    borderRadius: 1,
  },
});

const recStyles = StyleSheet.create({
  section: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionIconBg: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.text,
    letterSpacing: -0.2,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  cardSubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  urgencyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  urgencyText: {
    fontSize: 11,
    fontWeight: '600' as const,
  },
  continueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.backgroundCard,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: Colors.primaryLight,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 4,
  },
  continueLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  continueIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueContent: {
    flex: 1,
  },
  continueLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.primary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  continueTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 6,
  },
  continueProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  continueProgressTrack: {
    flex: 1,
    height: 5,
    backgroundColor: Colors.borderLight,
    borderRadius: 3,
    overflow: 'hidden',
  },
  continueProgressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
  continueProgressText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.textMuted,
  },
  weekRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 16,
  },
  weekCard: {
    flex: 1,
    backgroundColor: Colors.backgroundCard,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  weekIconBg: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  weekValue: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  weekLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '500' as const,
    textAlign: 'center' as const,
  },
  cefrCardWrap: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
});

const expandStyles = StyleSheet.create({
  cardWrap: {
    marginTop: -60,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  card: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 20,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 6,
    overflow: 'hidden',
  },
  collapsedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  statChips: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statChipValue: {
    fontSize: 15,
    fontWeight: '800' as const,
    color: Colors.text,
  },
  statChipUnit: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: Colors.textMuted,
  },
  chipDivider: {
    width: 1,
    height: 16,
    backgroundColor: Colors.borderLight,
  },
  miniGoalRing: {
    marginLeft: 2,
  },
  miniGoalTrack: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 3,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniGoalText: {
    fontSize: 8,
    fontWeight: '800' as const,
    color: Colors.primary,
  },
  expandedContent: {
    overflow: 'hidden',
  },
  expandedInner: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingTop: 14,
    gap: 14,
  },
  fullStatsRow: {
    gap: 10,
  },
  statsStripInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  statsStripLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  dailyXpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  dailyXpText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  bonusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  bonusChipText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#EF4444',
  },
  cefrInner: {
    marginTop: 2,
  },
  weekRow: {
    flexDirection: 'row',
    gap: 8,
  },
  weekCard: {
    flex: 1,
    backgroundColor: Colors.borderLight,
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
  },
  weekIconBg: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  weekValue: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: Colors.text,
    marginBottom: 1,
  },
  weekLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: '500' as const,
    textAlign: 'center' as const,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  animatedContainer: {
    flex: 1,
  } as any,
  headerGradient: {
    paddingBottom: 100,
  },
  headerSafeArea: {
    position: 'relative',
  },
  decorativeShapes: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  curvedShape: {
    position: 'absolute',
    right: -40,
    top: -20,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  shape: {
    position: 'absolute',
  },
  shapeCircle: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  shapeX: {
    width: 10,
    height: 10,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    transform: [{ rotate: '45deg' }],
  },
  shapePlus: {
    width: 14,
    height: 14,
    backgroundColor: 'transparent',
  },
  shapeSquiggle: {
    width: 20,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    transform: [{ rotate: '-15deg' }],
  },
  shapeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  headerContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
  },
  kiriContainer: {
    position: 'absolute',
    right: 16,
    bottom: -40,
    zIndex: 10,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 28,
  },
  headerTopLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  profileBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flagContainer: {
    width: 56,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
  },
  flagEmoji: {
    fontSize: 24,
  },
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  levelBadgeText: {
    color: Colors.textLight,
    fontSize: 13,
    fontWeight: '600' as const,
  },
  languageTitle: {
    fontSize: 40,
    fontWeight: '700' as const,
    color: Colors.textLight,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  languageStats: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  cardsContainer: {
    marginTop: 0,
  },
  cardsScrollContent: {
    paddingLeft: 20,
    paddingRight: 20,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 8,
    gap: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
  },
  featureCard: {
    width: CARD_WIDTH,
    marginRight: CARD_MARGIN,
  },
  featureCardInner: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 20,
    padding: 20,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 8,
    minHeight: 320,
  },
  cardPressed: {
    opacity: 0.95,
    transform: [{ scale: 0.98 }],
  },
  cardIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  cardDescription: {
    fontSize: 14,
    color: Colors.textMuted,
    lineHeight: 20,
    marginBottom: 16,
  },
  cardStatsContainer: {
    marginTop: 'auto',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  cardStats: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '500' as const,
  },
  cardModuleSection: {
    marginTop: 'auto',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  cardModuleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 8,
  },
  cardModuleBadgeText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  cardModuleTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  cardModuleProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardModuleProgressBar: {
    flex: 1,
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  cardModuleProgressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
  cardModuleProgressText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '500' as const,
  },
  resourcesSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 16,
  },
  resourcesRow: {
    flexDirection: 'row',
    gap: 20,
  },
  resourceBubble: {
    alignItems: 'center',
  },
  resourceIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  resourceLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
  },
  headlinesSection: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 8,
  },
  headlinesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  headlinesTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headlinesIconBg: {
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headlinesSectionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  headlinesSeeAll: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#047857',
  },
  headlineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.backgroundCard,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 6,
  },
  headlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  headlineContent: {
    flex: 1,
  },
  headlineText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.text,
    lineHeight: 19,
  },
  headlineSource: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  learnCardStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  learnStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  learnStatValue: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  learnStatLabel: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  learnStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: Colors.border,
  },
});
