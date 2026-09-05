import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Animated,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  X,
  BookOpen,
  Flame,
  Zap,
  Clock,
  TrendingUp,
  Trophy,
  Eye,
  Mic,
  MonitorPlay,
  Layers,
  Target,
  ChevronRight,
  Sparkles,
  CheckCircle,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { USE_NATIVE_DRIVER } from '@/constants/animation';
import { useApp } from '@/contexts/AppContext';
import { getEncounterStats, SourceTab } from '@/utils/crossTabTracker';
import { generateText } from '@rork-ai/toolkit-sdk';
import { GapCategory, GapItem } from '@/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const WEEKLY_RECAP_KEY = 'okiri_last_weekly_recap';

export async function shouldShowWeeklyRecap(): Promise<boolean> {
  try {
    const lastRecap = await AsyncStorage.getItem(WEEKLY_RECAP_KEY);
    if (!lastRecap) return true;
    const lastDate = new Date(lastRecap);
    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayThisWeek = new Date(now);
    mondayThisWeek.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
    mondayThisWeek.setHours(0, 0, 0, 0);
    return lastDate < mondayThisWeek;
  } catch {
    return false;
  }
}

export async function markRecapShown(): Promise<void> {
  await AsyncStorage.setItem(WEEKLY_RECAP_KEY, new Date().toISOString());
}

const CATEGORY_LABELS: Record<GapCategory, string> = {
  vocabulary: 'Vocabulary',
  grammar: 'Grammar',
  pronunciation: 'Pronunciation',
  phrasing: 'Phrasing',
  register: 'Register',
};

const CATEGORY_COLORS: Record<GapCategory, string> = {
  vocabulary: '#10B981',
  grammar: '#8B5CF6',
  pronunciation: '#F59E0B',
  phrasing: '#06B6D4',
  register: '#EC4899',
};

const TAB_ICONS: Record<SourceTab, { label: string; color: string }> = {
  read: { label: 'Read', color: '#10B981' },
  watch: { label: 'Watch', color: '#F97316' },
  speak: { label: 'Speak', color: '#F59E0B' },
  deck: { label: 'Deck', color: '#8B5CF6' },
  foundation: { label: 'Learn', color: '#0D9488' },
};

interface WeeklyData {
  lessonsCompleted: number;
  xpEarned: number;
  streakDays: number;
  minutesLearned: number;
  wordsMastered: GapItem[];
  biggestImprovement: { category: GapCategory; count: number } | null;
  tabBreakdown: Record<SourceTab, number>;
  totalEncounters: number;
}

function AnimatedCounter({ value, duration = 1200, style }: { value: number; duration?: number; style?: any }) {
  const animValue = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    animValue.setValue(0);
    const listener = animValue.addListener(({ value: v }) => {
      setDisplay(Math.round(v));
    });
    Animated.timing(animValue, {
      toValue: value,
      duration,
      useNativeDriver: false,
    }).start();
    return () => animValue.removeListener(listener);
  }, [value, duration, animValue]);

  return <Text style={style}>{display.toLocaleString()}</Text>;
}

function CircularProgress({ progress, size = 80, strokeWidth = 6, color }: {
  progress: number;
  size?: number;
  strokeWidth?: number;
  color: string;
}) {
  const animProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animProgress, {
      toValue: Math.min(progress, 1),
      duration: 1000,
      useNativeDriver: false,
    }).start();
  }, [progress, animProgress]);

  const percentage = Math.round(Math.min(progress, 1) * 100);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{
        width: size, height: size, borderRadius: size / 2,
        borderWidth: strokeWidth, borderColor: color + '20',
        position: 'absolute',
      }} />
      <View style={{
        width: size, height: size, borderRadius: size / 2,
        borderWidth: strokeWidth, borderColor: color,
        position: 'absolute',
        borderTopColor: progress > 0.25 ? color : 'transparent',
        borderRightColor: progress > 0.5 ? color : 'transparent',
        borderBottomColor: progress > 0.75 ? color : 'transparent',
        borderLeftColor: progress > 0 ? color : 'transparent',
        transform: [{ rotate: '-90deg' }],
      }} />
      <Text style={{ fontSize: 18, fontWeight: '800' as const, color }}>{percentage}%</Text>
    </View>
  );
}

export default function WeeklyRecapScreen() {
  const router = useRouter();
  const { gaps, gameState, progress } = useApp();

  const [currentSection, setCurrentSection] = useState(0);
  const [weeklyData, setWeeklyData] = useState<WeeklyData | null>(null);
  const [challenge, setChallenge] = useState<string>('');
  const [challengeLoading, setChallengeLoading] = useState(false);

  const sectionAnims = useRef(
    Array.from({ length: 5 }, () => ({
      opacity: new Animated.Value(0),
      translateY: new Animated.Value(40),
    }))
  ).current;

  const headerAnim = useRef(new Animated.Value(0)).current;
  const confettiAnims = useRef(
    Array.from({ length: 12 }, () => ({
      x: new Animated.Value(Math.random() * SCREEN_WIDTH),
      y: new Animated.Value(-20),
      rotate: new Animated.Value(0),
      opacity: new Animated.Value(1),
    }))
  ).current;

  const animateSection = useCallback((index: number) => {
    if (index >= sectionAnims.length) return;
    const anim = sectionAnims[index];
    Animated.parallel([
      Animated.timing(anim.opacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.spring(anim.translateY, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start();
    setCurrentSection(index);
  }, [sectionAnims]);

  const computeWeeklyData = useCallback(async () => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const wordsMastered = gaps.filter(g => {
      if (!g.masteredAt) return false;
      return new Date(g.masteredAt) >= sevenDaysAgo;
    });

    const categoryProgress: Record<GapCategory, number> = {
      vocabulary: 0, grammar: 0, pronunciation: 0, phrasing: 0, register: 0,
    };

    gaps.forEach(g => {
      if (g.lastReviewedAt && new Date(g.lastReviewedAt) >= sevenDaysAgo) {
        if (g.consecutiveCorrect > 0) {
          categoryProgress[g.category] += g.consecutiveCorrect;
        }
      }
    });

    let biggestImprovement: { category: GapCategory; count: number } | null = null;
    const categories = Object.keys(categoryProgress) as GapCategory[];
    for (const cat of categories) {
      if (categoryProgress[cat] > 0) {
        if (!biggestImprovement || categoryProgress[cat] > biggestImprovement.count) {
          biggestImprovement = { category: cat, count: categoryProgress[cat] };
        }
      }
    }

    let tabBreakdown: Record<SourceTab, number> = {
      read: 0, watch: 0, speak: 0, deck: 0, foundation: 0,
    };
    let totalEncounters = 0;

    try {
      const stats = await getEncounterStats();
      tabBreakdown = stats.bySource;
      totalEncounters = stats.totalEncounters;
    } catch (e) {
      console.log('[WeeklyRecap] Failed to load encounter stats:', e);
    }

    const minutesLearned = progress.totalSpeakingMinutes +
      (progress.readingSessions * 5) +
      (gameState.lessonsCompletedToday * 8);

    return {
      lessonsCompleted: gameState.lessonsCompletedToday,
      xpEarned: gameState.totalXP,
      streakDays: gameState.streakCount,
      minutesLearned,
      wordsMastered,
      biggestImprovement,
      tabBreakdown,
      totalEncounters,
    } as WeeklyData;
  }, [gaps, gameState, progress]);

  useEffect(() => {
    void computeWeeklyData().then(data => {
      setWeeklyData(data);
      console.log('[WeeklyRecap] Computed data:', {
        lessons: data.lessonsCompleted,
        xp: data.xpEarned,
        mastered: data.wordsMastered.length,
        improvement: data.biggestImprovement?.category,
      });
    });
  }, [computeWeeklyData]);

  useEffect(() => {
    Animated.timing(headerAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();

    setTimeout(() => animateSection(0), 600);
  }, [headerAnim, animateSection]);

  useEffect(() => {
    if (currentSection > 0) return;
    confettiAnims.forEach((c, i) => {
      const delay = i * 120;
      Animated.sequence([
        Animated.delay(delay + 400),
        Animated.parallel([
          Animated.timing(c.y, {
            toValue: Dimensions.get('window').height + 50,
            duration: 2500 + Math.random() * 1000,
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.timing(c.rotate, {
            toValue: 360 * (Math.random() > 0.5 ? 1 : -1),
            duration: 2500,
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.sequence([
            Animated.delay(1800),
            Animated.timing(c.opacity, {
              toValue: 0,
              duration: 700,
              useNativeDriver: USE_NATIVE_DRIVER,
            }),
          ]),
        ]),
      ]).start();
    });
  }, [confettiAnims, currentSection]);

  const generateChallenge = useCallback(async () => {
    if (!weeklyData) return;
    setChallengeLoading(true);
    try {
      const weakArea = weeklyData.biggestImprovement
        ? `Their strongest area is ${weeklyData.biggestImprovement.category}.`
        : 'They have not shown major progress in any area yet.';

      const lowestTab = Object.entries(weeklyData.tabBreakdown)
        .sort(([, a], [, b]) => a - b)[0];

      const result = await generateText({
        messages: [{
          role: 'user',
          content: `You are a French language tutor. Generate a short, motivating personal challenge for next week (1-2 sentences max). The student has mastered ${weeklyData.wordsMastered.length} words this week, earned ${weeklyData.xpEarned} XP, and has a ${weeklyData.streakDays}-day streak. ${weakArea} Their least-used learning mode is "${lowestTab[0]}". Suggest a specific, achievable goal that targets their weakness. Be encouraging and specific. Don't use emojis.`,
        }],
      });
      setChallenge(result);
    } catch (e) {
      console.log('[WeeklyRecap] Challenge generation failed:', e);
      setChallenge('Try to complete 3 lessons focusing on your weakest area this week!');
    } finally {
      setChallengeLoading(false);
    }
  }, [weeklyData]);

  useEffect(() => {
    if (weeklyData && !challenge && !challengeLoading) {
      void generateChallenge();
    }
  }, [weeklyData, challenge, challengeLoading, generateChallenge]);

  const handleClose = useCallback(async () => {
    await markRecapShown();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, [router]);

  const handleScrollEnd = useCallback((e: any) => {
    const y = e.nativeEvent.contentOffset.y;
    const sectionHeight = 280;
    const newSection = Math.min(Math.floor(y / sectionHeight) + 1, 4);
    if (newSection > currentSection) {
      for (let i = currentSection + 1; i <= newSection; i++) {
        setTimeout(() => animateSection(i), (i - currentSection - 1) * 200);
      }
    }
  }, [currentSection, animateSection]);

  const confettiColors = ['#F97316', '#10B981', '#8B5CF6', '#F59E0B', '#EC4899', '#06B6D4'];

  const tabTotal = useMemo(() => {
    if (!weeklyData) return 1;
    return Math.max(Object.values(weeklyData.tabBreakdown).reduce((a, b) => a + b, 0), 1);
  }, [weeklyData]);

  if (!weeklyData) return null;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1A1A2E', '#16213E', '#0F3460']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.3, y: 1 }}
      />

      {confettiAnims.map((c, i) => (
        <Animated.View
          key={`confetti-${i}`}
          style={[styles.confetti, {
            backgroundColor: confettiColors[i % confettiColors.length],
            width: 8 + Math.random() * 6,
            height: 8 + Math.random() * 6,
            borderRadius: Math.random() > 0.5 ? 20 : 2,
            transform: [
              { translateX: c.x },
              { translateY: c.y },
              { rotate: c.rotate.interpolate({
                inputRange: [0, 360],
                outputRange: ['0deg', '360deg'],
              }) },
            ],
            opacity: c.opacity,
          }]}
        />
      ))}

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Animated.View style={{
            opacity: headerAnim,
            transform: [{ translateY: headerAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [-20, 0],
            }) }],
          }}>
            <Text style={styles.headerTitle}>Your Week</Text>
            <Text style={styles.headerSubtitle}>Weekly Progress Recap</Text>
          </Animated.View>
          <Pressable style={styles.closeBtn} onPress={handleClose} testID="close-recap">
            <X size={22} color="rgba(255,255,255,0.7)" />
          </Pressable>
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={handleScrollEnd}
        scrollEventThrottle={60}
      >
        <Animated.View style={[styles.section, {
          opacity: sectionAnims[0].opacity,
          transform: [{ translateY: sectionAnims[0].translateY }],
        }]}>
          <View style={styles.sectionHeaderRow}>
            <Zap size={18} color="#F59E0B" />
            <Text style={styles.sectionLabel}>This Week in Numbers</Text>
          </View>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <LinearGradient colors={['#F97316', '#FB923C']} style={styles.statIconBg} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <BookOpen size={20} color="#fff" />
              </LinearGradient>
              <AnimatedCounter value={weeklyData.lessonsCompleted} style={styles.statValue} />
              <Text style={styles.statLabel}>Lessons</Text>
            </View>
            <View style={styles.statCard}>
              <LinearGradient colors={['#8B5CF6', '#A78BFA']} style={styles.statIconBg} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <Zap size={20} color="#fff" />
              </LinearGradient>
              <AnimatedCounter value={weeklyData.xpEarned} style={styles.statValue} />
              <Text style={styles.statLabel}>XP Earned</Text>
            </View>
            <View style={styles.statCard}>
              <LinearGradient colors={['#F59E0B', '#FBBF24']} style={styles.statIconBg} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <Flame size={20} color="#fff" />
              </LinearGradient>
              <AnimatedCounter value={weeklyData.streakDays} style={styles.statValue} />
              <Text style={styles.statLabel}>Day Streak</Text>
            </View>
            <View style={styles.statCard}>
              <LinearGradient colors={['#06B6D4', '#22D3EE']} style={styles.statIconBg} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <Clock size={20} color="#fff" />
              </LinearGradient>
              <AnimatedCounter value={weeklyData.minutesLearned} style={styles.statValue} />
              <Text style={styles.statLabel}>Minutes</Text>
            </View>
          </View>
        </Animated.View>

        <Animated.View style={[styles.section, {
          opacity: sectionAnims[1].opacity,
          transform: [{ translateY: sectionAnims[1].translateY }],
        }]}>
          <View style={styles.sectionHeaderRow}>
            <CheckCircle size={18} color="#10B981" />
            <Text style={styles.sectionLabel}>Words Mastered</Text>
          </View>
          {weeklyData.wordsMastered.length > 0 ? (
            <View style={styles.masteredContainer}>
              <View style={styles.masteredCountRow}>
                <Text style={styles.masteredBigNumber}>{weeklyData.wordsMastered.length}</Text>
                <Text style={styles.masteredCountLabel}>words moved to mastered</Text>
              </View>
              <View style={styles.masteredWordsWrap}>
                {weeklyData.wordsMastered.slice(0, 12).map((gap) => (
                  <View key={gap.id} style={[styles.masteredChip, {
                    backgroundColor: CATEGORY_COLORS[gap.category] + '25',
                    borderColor: CATEGORY_COLORS[gap.category] + '40',
                  }]}>
                    <Text style={[styles.masteredChipText, { color: CATEGORY_COLORS[gap.category] }]}>
                      {gap.frenchWord}
                    </Text>
                  </View>
                ))}
                {weeklyData.wordsMastered.length > 12 && (
                  <View style={styles.masteredMore}>
                    <Text style={styles.masteredMoreText}>+{weeklyData.wordsMastered.length - 12} more</Text>
                  </View>
                )}
              </View>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No words mastered this week — keep practicing!</Text>
            </View>
          )}
        </Animated.View>

        <Animated.View style={[styles.section, {
          opacity: sectionAnims[2].opacity,
          transform: [{ translateY: sectionAnims[2].translateY }],
        }]}>
          <View style={styles.sectionHeaderRow}>
            <TrendingUp size={18} color="#8B5CF6" />
            <Text style={styles.sectionLabel}>Your Biggest Improvement</Text>
          </View>
          {weeklyData.biggestImprovement ? (
            <View style={styles.improvementCard}>
              <CircularProgress
                progress={Math.min(weeklyData.biggestImprovement.count / 20, 1)}
                size={72}
                color={CATEGORY_COLORS[weeklyData.biggestImprovement.category]}
              />
              <View style={styles.improvementInfo}>
                <Text style={styles.improvementCategory}>
                  {CATEGORY_LABELS[weeklyData.biggestImprovement.category]}
                </Text>
                <Text style={styles.improvementDetail}>
                  {weeklyData.biggestImprovement.count} correct answers this week
                </Text>
                <View style={[styles.improvementBadge, {
                  backgroundColor: CATEGORY_COLORS[weeklyData.biggestImprovement.category] + '20',
                }]}>
                  <Trophy size={12} color={CATEGORY_COLORS[weeklyData.biggestImprovement.category]} />
                  <Text style={[styles.improvementBadgeText, {
                    color: CATEGORY_COLORS[weeklyData.biggestImprovement.category],
                  }]}>Top Category</Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>Complete some reviews to see your strongest area!</Text>
            </View>
          )}
        </Animated.View>

        <Animated.View style={[styles.section, {
          opacity: sectionAnims[3].opacity,
          transform: [{ translateY: sectionAnims[3].translateY }],
        }]}>
          <View style={styles.sectionHeaderRow}>
            <Layers size={18} color="#06B6D4" />
            <Text style={styles.sectionLabel}>Across Your Learning</Text>
          </View>
          <View style={styles.tabBreakdown}>
            {(Object.entries(weeklyData.tabBreakdown) as [SourceTab, number][])
              .filter(([, count]) => count > 0)
              .sort(([, a], [, b]) => b - a)
              .map(([tab, count]) => {
                const info = TAB_ICONS[tab];
                const pct = (count / tabTotal) * 100;
                return (
                  <View key={tab} style={styles.tabRow}>
                    <View style={styles.tabLabelRow}>
                      {tab === 'read' && <BookOpen size={14} color={info.color} />}
                      {tab === 'watch' && <MonitorPlay size={14} color={info.color} />}
                      {tab === 'speak' && <Mic size={14} color={info.color} />}
                      {tab === 'deck' && <Layers size={14} color={info.color} />}
                      {tab === 'foundation' && <BookOpen size={14} color={info.color} />}
                      <Text style={styles.tabLabel}>{info.label}</Text>
                      <Text style={styles.tabCount}>{count}</Text>
                    </View>
                    <View style={styles.tabBarTrack}>
                      <View style={[styles.tabBarFill, {
                        width: `${Math.max(pct, 4)}%` as any,
                        backgroundColor: info.color,
                      }]} />
                    </View>
                  </View>
                );
              })}
            {tabTotal <= 1 && Object.values(weeklyData.tabBreakdown).every(v => v === 0) && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>Start using different tabs to see your learning distribution!</Text>
              </View>
            )}
          </View>
          <View style={styles.encounterSummary}>
            <Eye size={14} color="rgba(255,255,255,0.5)" />
            <Text style={styles.encounterText}>
              {weeklyData.totalEncounters} total word encounters tracked
            </Text>
          </View>
        </Animated.View>

        <Animated.View style={[styles.section, {
          opacity: sectionAnims[4].opacity,
          transform: [{ translateY: sectionAnims[4].translateY }],
        }]}>
          <View style={styles.sectionHeaderRow}>
            <Target size={18} color="#F97316" />
            <Text style={styles.sectionLabel}>Next Week Challenge</Text>
          </View>
          <View style={styles.challengeCard}>
            <LinearGradient
              colors={['rgba(249,115,22,0.15)', 'rgba(249,115,22,0.05)']}
              style={styles.challengeGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Sparkles size={24} color="#F97316" />
              {challengeLoading ? (
                <Text style={styles.challengeText}>Crafting your personal challenge...</Text>
              ) : (
                <Text style={styles.challengeText}>{challenge}</Text>
              )}
            </LinearGradient>
          </View>
        </Animated.View>

        <Pressable
          style={({ pressed }) => [
            styles.continueBtn,
            pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
          ]}
          onPress={handleClose}
          testID="recap-continue"
        >
          <LinearGradient
            colors={[Colors.primaryGradientStart, Colors.primaryGradientEnd]}
            style={styles.continueBtnGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={styles.continueBtnText}>Let's Go!</Text>
            <ChevronRight size={20} color="#fff" />
          </LinearGradient>
        </Pressable>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1A2E',
  },
  confetti: {
    position: 'absolute',
    zIndex: 10,
  },
  safeArea: {
    zIndex: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800' as const,
    color: '#fff',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  sectionLabel: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: '#fff',
    letterSpacing: -0.3,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    width: (SCREEN_WIDTH - 52) / 2,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  statIconBg: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  statValue: {
    fontSize: 26,
    fontWeight: '800' as const,
    color: '#fff',
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
    fontWeight: '600' as const,
    marginTop: 2,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  masteredContainer: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  masteredCountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 14,
  },
  masteredBigNumber: {
    fontSize: 36,
    fontWeight: '800' as const,
    color: '#10B981',
  },
  masteredCountLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '500' as const,
  },
  masteredWordsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  masteredChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  masteredChipText: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  masteredMore: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  masteredMoreText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '500' as const,
  },
  emptyState: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center' as const,
    lineHeight: 20,
  },
  improvementCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 16,
    padding: 18,
    gap: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  improvementInfo: {
    flex: 1,
  },
  improvementCategory: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#fff',
    marginBottom: 4,
  },
  improvementDetail: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 10,
  },
  improvementBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  improvementBadgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.3,
  },
  tabBreakdown: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 16,
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  tabRow: {
    gap: 6,
  },
  tabLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tabLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600' as const,
    flex: 1,
  },
  tabCount: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '600' as const,
  },
  tabBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden' as const,
  },
  tabBarFill: {
    height: 6,
    borderRadius: 3,
  },
  encounterSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingLeft: 4,
  },
  encounterText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
  },
  challengeCard: {
    borderRadius: 16,
    overflow: 'hidden' as const,
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.2)',
  },
  challengeGradient: {
    padding: 20,
    gap: 12,
  },
  challengeText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 22,
    fontWeight: '500' as const,
  },
  continueBtn: {
    marginTop: 8,
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden' as const,
  },
  continueBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 6,
  },
  continueBtnText: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: '#fff',
  },
});
