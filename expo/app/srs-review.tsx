import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Animated,
  Dimensions,
  TextInput,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { safeGoBack } from '@/utils/navigation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  X,
  Volume2,
  Award,
  Home,
  Layers,
  Brain,
  Clock,
  Flame,
  Zap,
  TrendingUp,
  CheckCircle,
  XCircle,
  ArrowRight,
  Timer,
  Shield,
  Star,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { USE_NATIVE_DRIVER } from '@/constants/animation';
import { useApp } from '@/contexts/AppContext';
import { GapItem, GapCategory, GapPromptType } from '@/types';
import {
  SrsQuality,
  SrsIntervalPreview,
  previewNextIntervals,
  getSrsSessionCards,
} from '@/utils/srs';
import { selectExerciseDistribution } from '@/utils/exerciseSelector';
import { audioService } from '@/utils/audioService';
import Kiri from '@/components/Kiri';

const _SCREEN_WIDTH = Dimensions.get('window').width;

type ReviewPhase = 'dashboard' | 'review' | 'complete';

type ExerciseMode = 'flashcard' | 'multiple_choice' | 'fill_blank' | 'translation';

interface QueueItem {
  gapId: string;
  againCount: number;
  isNew: boolean;
  exerciseMode: ExerciseMode;
}

interface SessionStats {
  totalReviewed: number;
  againCount: number;
  hardCount: number;
  goodCount: number;
  easyCount: number;
  masteredCount: number;
  leveledUpCount: number;
  needMorePractice: string[];
  startTime: number;
  correctStreak: number;
  bestStreak: number;
}

interface DashboardInfo {
  totalDue: number;
  newCount: number;
  reviewCount: number;
  estimatedMinutes: number;
  categories: { category: GapCategory; count: number; color: string }[];
}

const RATING_CONFIG: Record<string, { label: string; color: string; bgColor: string; quality: SrsQuality }> = {
  again: { label: 'Again', color: '#DC2626', bgColor: '#FEF2F2', quality: 1 },
  hard: { label: 'Hard', color: '#D97706', bgColor: '#FFFBEB', quality: 2 },
  good: { label: 'Good', color: '#059669', bgColor: '#ECFDF5', quality: 4 },
  easy: { label: 'Easy', color: '#2563EB', bgColor: '#EFF6FF', quality: 5 },
};

const MAX_AGAIN_PER_CARD = 3;

const CATEGORY_COLORS: Record<GapCategory, string> = {
  vocabulary: Colors.primary,
  grammar: Colors.secondary,
  pronunciation: '#7C3AED',
  phrasing: Colors.warning,
  register: '#10B981',
};

function pickExerciseMode(gap: GapItem, weights: { type: GapPromptType; weight: number }[]): ExerciseMode {
  if (gap.reviewCount === 0) return 'flashcard';

  const affinityMap: Record<GapCategory, ExerciseMode[]> = {
    vocabulary: ['multiple_choice', 'fill_blank', 'translation'],
    grammar: ['fill_blank', 'multiple_choice'],
    pronunciation: ['flashcard', 'multiple_choice'],
    phrasing: ['fill_blank', 'translation'],
    register: ['multiple_choice', 'translation'],
  };

  const candidates = affinityMap[gap.category] || ['flashcard'];

  const topWeights = weights.slice(0, 6);
  for (const w of topWeights) {
    if (w.type === 'multiple_choice' && candidates.includes('multiple_choice')) return 'multiple_choice';
    if (w.type === 'fill_blank' && candidates.includes('fill_blank')) return 'fill_blank';
    if (w.type === 'translation' && candidates.includes('translation')) return 'translation';
  }

  if (gap.consecutiveCorrect >= 3) {
    return candidates.includes('translation') ? 'translation' : candidates.includes('fill_blank') ? 'fill_blank' : 'flashcard';
  }

  return candidates[0] || 'flashcard';
}

function generateChoices(gap: GapItem, allGaps: GapItem[]): string[] {
  const correct = gap.englishTranslation;
  const sameCategory = allGaps
    .filter(g => g.id !== gap.id && g.category === gap.category && g.englishTranslation !== correct)
    .map(g => g.englishTranslation);

  const others = allGaps
    .filter(g => g.id !== gap.id && g.englishTranslation !== correct)
    .map(g => g.englishTranslation);

  const pool = [...new Set([...sameCategory, ...others])];
  const distractors: string[] = [];
  const shuffled = pool.sort(() => Math.random() - 0.5);
  for (const item of shuffled) {
    if (distractors.length >= 3) break;
    distractors.push(item);
  }

  while (distractors.length < 3) {
    distractors.push(`Option ${distractors.length + 1}`);
  }

  const all = [correct, ...distractors].sort(() => Math.random() - 0.5);
  return all;
}

function getMemoryStrength(gap: GapItem): { percent: number; label: string; color: string } {
  const interval = gap.currentInterval;
  if (interval <= 0) return { percent: 5, label: 'New', color: '#9CA3AF' };
  if (interval <= 1) return { percent: 15, label: 'Learning', color: '#DC2626' };
  if (interval <= 3) return { percent: 25, label: 'Short-term', color: '#F59E0B' };
  if (interval <= 7) return { percent: 40, label: 'Growing', color: '#D97706' };
  if (interval <= 14) return { percent: 55, label: 'Strengthening', color: '#10B981' };
  if (interval <= 30) return { percent: 75, label: 'Strong', color: '#059669' };
  if (interval <= 60) return { percent: 88, label: 'Very strong', color: '#0D9488' };
  return { percent: 96, label: 'Near mastery', color: '#2563EB' };
}

export default function SrsReviewScreen() {
  const router = useRouter();
  const { gaps, reviewGapAnki, exercisePerformance, trackExerciseResult, awardXP } = useApp();

  const [phase, setPhase] = useState<ReviewPhase>('dashboard');
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [fillAnswer, setFillAnswer] = useState('');
  const [exerciseSubmitted, setExerciseSubmitted] = useState(false);
  const [exerciseCorrect, setExerciseCorrect] = useState<boolean | null>(null);
  const [showMemoryBar, setShowMemoryBar] = useState(false);

  const [stats, setStats] = useState<SessionStats>({
    totalReviewed: 0,
    againCount: 0,
    hardCount: 0,
    goodCount: 0,
    easyCount: 0,
    masteredCount: 0,
    leveledUpCount: 0,
    needMorePractice: [],
    startTime: Date.now(),
    correctStreak: 0,
    bestStreak: 0,
  });

  const cardFade = useRef(new Animated.Value(1)).current;
  const cardSlide = useRef(new Animated.Value(0)).current;
  const answerOpacity = useRef(new Animated.Value(0)).current;
  const completeFade = useRef(new Animated.Value(0)).current;
  const completeScale = useRef(new Animated.Value(0.85)).current;
  const dashboardFade = useRef(new Animated.Value(0)).current;
  const memoryBarWidth = useRef(new Animated.Value(0)).current;
  const memoryBarOpacity = useRef(new Animated.Value(0)).current;

  const srsCards = useMemo(() => getSrsSessionCards(gaps), [gaps]);

  const dashboardInfo = useMemo((): DashboardInfo => {
    const { dueCards, newCards, total } = srsCards;
    const allCards = [...dueCards, ...newCards];

    const catCounts: Record<string, number> = {};
    for (const g of allCards) {
      catCounts[g.category] = (catCounts[g.category] || 0) + 1;
    }

    const categories = Object.entries(catCounts)
      .map(([cat, count]) => ({
        category: cat as GapCategory,
        count,
        color: CATEGORY_COLORS[cat as GapCategory] || Colors.primary,
      }))
      .sort((a, b) => b.count - a.count);

    const estimatedMinutes = Math.max(1, Math.ceil(total * 0.4));

    return {
      totalDue: total,
      newCount: newCards.length,
      reviewCount: dueCards.length,
      estimatedMinutes,
      categories,
    };
  }, [srsCards]);

  useEffect(() => {
    Animated.timing(dashboardFade, {
      toValue: 1,
      duration: 400,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [dashboardFade]);

  useEffect(() => {
    const unsub = audioService.onPlayingChange(setIsPlaying);
    return unsub;
  }, []);

  const exerciseDistribution = useMemo(() => {
    return selectExerciseDistribution(gaps, exercisePerformance, 'medium');
  }, [gaps, exercisePerformance]);

  const startReview = useCallback(() => {
    const { dueCards, newCards, total } = srsCards;

    if (total === 0) {
      safeGoBack();
      return;
    }

    const items: QueueItem[] = [
      ...dueCards.map(g => ({
        gapId: g.id,
        againCount: 0,
        isNew: false,
        exerciseMode: pickExerciseMode(g, exerciseDistribution.weights),
      })),
      ...newCards.map(g => ({
        gapId: g.id,
        againCount: 0,
        isNew: true,
        exerciseMode: 'flashcard' as ExerciseMode,
      })),
    ];

    setQueue(items);
    setStats(prev => ({ ...prev, startTime: Date.now() }));
    setPhase('review');
    console.log('[SRS] Starting review with', items.length, 'cards');
  }, [srsCards, exerciseDistribution]);

  const currentItem = queue[currentIdx];
  const currentGap = useMemo(() => {
    if (!currentItem) return null;
    return gaps.find(g => g.id === currentItem.gapId) ?? null;
  }, [currentItem, gaps]);

  const intervalPreviews = useMemo((): SrsIntervalPreview | null => {
    if (!currentGap) return null;
    return previewNextIntervals(currentGap);
  }, [currentGap]);

  const choices = useMemo(() => {
    if (!currentGap || !currentItem || currentItem.exerciseMode !== 'multiple_choice') return [];
    return generateChoices(currentGap, gaps);
  }, [currentGap, currentItem, gaps]);

  const totalInQueue = queue.length;
  const progressPercent = totalInQueue > 0 ? (currentIdx / totalInQueue) * 100 : 0;

  const playAudio = useCallback((text: string) => {
    if (!text) return;
    audioService.playFrenchAudio(text).catch(e => console.log('[SRS] Audio error:', e));
  }, []);

  const animateReveal = useCallback(() => {
    setShowAnswer(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.timing(answerOpacity, {
      toValue: 1,
      duration: 250,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [answerOpacity]);

  const showMemoryStrength = useCallback((gap: GapItem) => {
    const strength = getMemoryStrength(gap);
    setShowMemoryBar(true);
    memoryBarOpacity.setValue(0);
    memoryBarWidth.setValue(0);

    Animated.parallel([
      Animated.timing(memoryBarOpacity, { toValue: 1, duration: 200, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.timing(memoryBarWidth, { toValue: strength.percent, duration: 600, useNativeDriver: false }),
    ]).start();
  }, [memoryBarOpacity, memoryBarWidth]);

  const animateNextCard = useCallback((callback: () => void) => {
    Animated.parallel([
      Animated.timing(cardFade, { toValue: 0, duration: 150, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.timing(cardSlide, { toValue: -40, duration: 150, useNativeDriver: USE_NATIVE_DRIVER }),
    ]).start(() => {
      callback();
      setShowAnswer(false);
      setSelectedChoice(null);
      setFillAnswer('');
      setExerciseSubmitted(false);
      setExerciseCorrect(null);
      setShowMemoryBar(false);
      answerOpacity.setValue(0);
      memoryBarOpacity.setValue(0);
      memoryBarWidth.setValue(0);
      cardSlide.setValue(40);
      Animated.parallel([
        Animated.timing(cardFade, { toValue: 1, duration: 200, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(cardSlide, { toValue: 0, duration: 200, useNativeDriver: USE_NATIVE_DRIVER }),
      ]).start();
    });
  }, [cardFade, cardSlide, answerOpacity, memoryBarOpacity, memoryBarWidth]);

  const handleExerciseSubmit = useCallback(() => {
    if (!currentGap || !currentItem) return;
    const mode = currentItem.exerciseMode;
    let correct = false;

    if (mode === 'multiple_choice') {
      correct = selectedChoice === currentGap.englishTranslation;
    } else if (mode === 'fill_blank' || mode === 'translation') {
      const normalizedInput = fillAnswer.trim().toLowerCase();
      const normalizedAnswer = currentGap.frenchWord.toLowerCase();
      const normalizedEnglish = currentGap.englishTranslation.toLowerCase();
      correct = normalizedInput === normalizedAnswer || normalizedInput === normalizedEnglish;

      if (!correct && mode === 'fill_blank') {
        const stripped = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        correct = stripped(fillAnswer.trim()) === stripped(currentGap.frenchWord);
      }
    }

    setExerciseSubmitted(true);
    setExerciseCorrect(correct);
    trackExerciseResult(currentItem.exerciseMode, correct);

    void Haptics.impactAsync(correct ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Heavy);

    void audioService.playFrenchAudio(currentGap.frenchWord).catch(e => console.log('[SRS] Audio error:', e));
    showMemoryStrength(currentGap);

    Animated.timing(answerOpacity, {
      toValue: 1,
      duration: 250,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [currentGap, currentItem, selectedChoice, fillAnswer, trackExerciseResult, showMemoryStrength, answerOpacity]);

  const handleRate = useCallback(async (quality: SrsQuality) => {
    if (!currentItem || !currentGap) return;

    const feedbackMap: Record<number, Haptics.ImpactFeedbackStyle> = {
      1: Haptics.ImpactFeedbackStyle.Heavy,
      2: Haptics.ImpactFeedbackStyle.Medium,
      4: Haptics.ImpactFeedbackStyle.Light,
      5: Haptics.ImpactFeedbackStyle.Light,
    };
    void Haptics.impactAsync(feedbackMap[quality]);

    const result = await reviewGapAnki(currentItem.gapId, quality);
    const isCorrectResponse = quality >= 4;

    const statsKey = quality === 1 ? 'againCount' : quality === 2 ? 'hardCount' : quality === 4 ? 'goodCount' : 'easyCount';
    setStats(prev => {
      const newStreak = isCorrectResponse ? prev.correctStreak + 1 : 0;
      const needMore = quality === 1 ? [...prev.needMorePractice, currentGap.frenchWord] : prev.needMorePractice;

      return {
        ...prev,
        totalReviewed: prev.totalReviewed + 1,
        [statsKey]: prev[statsKey] + 1,
        masteredCount: prev.masteredCount + (result.newlyMastered ? 1 : 0),
        leveledUpCount: prev.leveledUpCount + (isCorrectResponse && currentGap.currentInterval > 0 ? 1 : 0),
        needMorePractice: [...new Set(needMore)],
        correctStreak: newStreak,
        bestStreak: Math.max(prev.bestStreak, newStreak),
      };
    });

    if (quality === 1 && currentItem.againCount < MAX_AGAIN_PER_CARD) {
      setQueue(prev => [...prev, { ...currentItem, againCount: currentItem.againCount + 1, exerciseMode: 'flashcard' }]);
    }

    const isLast = currentIdx >= queue.length - 1 && !(quality === 1 && currentItem.againCount < MAX_AGAIN_PER_CARD);

    if (isLast) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      awardXP(Math.max(5, stats.totalReviewed * 2));
      setPhase('complete');
      Animated.parallel([
        Animated.timing(completeFade, { toValue: 1, duration: 400, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.spring(completeScale, { toValue: 1, friction: 8, tension: 40, useNativeDriver: USE_NATIVE_DRIVER }),
      ]).start();
    } else {
      animateNextCard(() => {
        setCurrentIdx(prev => prev + 1);
      });
    }
  }, [currentItem, currentGap, currentIdx, queue.length, reviewGapAnki, animateNextCard, completeFade, completeScale, stats.totalReviewed, awardXP]);

  const handleExerciseRate = useCallback(() => {
    if (exerciseCorrect === null) return;
    const quality: SrsQuality = exerciseCorrect ? 4 : 1;
    void handleRate(quality);
  }, [exerciseCorrect, handleRate]);

  const handleClose = useCallback(() => {
    audioService.stopCurrent().catch(() => {});
    safeGoBack();
  }, []);

  if (phase === 'dashboard') {
    return <DashboardView
      info={dashboardInfo}
      fadeAnim={dashboardFade}
      onStart={startReview}
      onClose={handleClose}
      isEmpty={dashboardInfo.totalDue === 0}
    />;
  }

  if (phase === 'complete') {
    return <CompleteView
      stats={stats}
      fadeAnim={completeFade}
      scaleAnim={completeScale}
      onClose={handleClose}
      onViewDeck={() => router.replace('/(tabs)/deck' as any)}
    />;
  }

  if (!currentGap || !intervalPreviews || !currentItem) return null;

  const memoryStrength = getMemoryStrength(currentGap);
  const isExerciseMode = currentItem.exerciseMode !== 'flashcard';

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable style={styles.closeButton} onPress={handleClose}>
            <X size={20} color={Colors.textSecondary} />
          </Pressable>

          <View style={styles.progressArea}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
            </View>
            <View style={styles.queueInfo}>
              <Text style={styles.queueInfoText}>{currentIdx + 1} / {totalInQueue}</Text>
              {currentItem.isNew && (
                <View style={styles.newBadgeSmall}>
                  <Text style={styles.newBadgeSmallText}>NEW</Text>
                </View>
              )}
            </View>
          </View>

          <View style={[styles.modePill, { backgroundColor: `${CATEGORY_COLORS[currentGap.category]}15` }]}>
            <View style={[styles.modePillDot, { backgroundColor: CATEGORY_COLORS[currentGap.category] }]} />
            <Text style={[styles.modePillText, { color: CATEGORY_COLORS[currentGap.category] }]}>
              {currentGap.category}
            </Text>
          </View>
        </View>

        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View style={[
            styles.card,
            { opacity: cardFade, transform: [{ translateX: cardSlide }] },
          ]}>
            {isExerciseMode ? (
              <ExerciseCard
                gap={currentGap}
                mode={currentItem.exerciseMode}
                choices={choices}
                selectedChoice={selectedChoice}
                fillAnswer={fillAnswer}
                submitted={exerciseSubmitted}
                isCorrect={exerciseCorrect}
                onSelectChoice={setSelectedChoice}
                onFillChange={setFillAnswer}
                onSubmit={handleExerciseSubmit}
                onPlayAudio={playAudio}
                isPlaying={isPlaying}
              />
            ) : (
              <FlashcardView
                gap={currentGap}
                showAnswer={showAnswer}
                answerOpacity={answerOpacity}
                onPlayAudio={playAudio}
                isPlaying={isPlaying}
              />
            )}

            {showMemoryBar && (
              <Animated.View style={[styles.memorySection, { opacity: memoryBarOpacity }]}>
                <View style={styles.memorySectionHeader}>
                  <Shield size={12} color={memoryStrength.color} />
                  <Text style={styles.memorySectionTitle}>Memory Strength</Text>
                  <Text style={[styles.memorySectionLabel, { color: memoryStrength.color }]}>
                    {memoryStrength.label}
                  </Text>
                </View>
                <View style={styles.memoryBarTrack}>
                  <Animated.View style={[
                    styles.memoryBarFill,
                    {
                      backgroundColor: memoryStrength.color,
                      width: memoryBarWidth.interpolate({
                        inputRange: [0, 100],
                        outputRange: ['0%', '100%'],
                      }),
                    },
                  ]} />
                </View>
                <Text style={styles.memoryBarHint}>
                  {memoryStrength.percent >= 75
                    ? 'Almost permanently memorized!'
                    : memoryStrength.percent >= 40
                      ? 'Getting stronger with each review'
                      : 'Keep reviewing to build long-term memory'}
                </Text>
              </Animated.View>
            )}
          </Animated.View>
        </ScrollView>

        <View style={styles.bottomArea}>
          {isExerciseMode ? (
            exerciseSubmitted ? (
              <View style={styles.exerciseResultRow}>
                <View style={[
                  styles.exerciseResultBadge,
                  { backgroundColor: exerciseCorrect ? '#ECFDF5' : '#FEF2F2' },
                ]}>
                  {exerciseCorrect
                    ? <CheckCircle size={16} color="#059669" />
                    : <XCircle size={16} color="#DC2626" />}
                  <Text style={[
                    styles.exerciseResultText,
                    { color: exerciseCorrect ? '#059669' : '#DC2626' },
                  ]}>
                    {exerciseCorrect ? 'Correct!' : `Answer: ${currentGap.englishTranslation}`}
                  </Text>
                </View>
                <Pressable
                  style={({ pressed }) => [
                    styles.continueButton,
                    { backgroundColor: exerciseCorrect ? '#059669' : '#DC2626' },
                    pressed && { opacity: 0.9 },
                  ]}
                  onPress={handleExerciseRate}
                >
                  <Text style={styles.continueButtonText}>Continue</Text>
                  <ArrowRight size={16} color="#FFF" />
                </Pressable>
              </View>
            ) : (
              <Pressable
                style={({ pressed }) => [
                  styles.submitButton,
                  (!selectedChoice && !fillAnswer.trim()) && styles.submitButtonDisabled,
                  pressed && { opacity: 0.9 },
                ]}
                onPress={handleExerciseSubmit}
                disabled={!selectedChoice && !fillAnswer.trim()}
              >
                <Text style={styles.submitButtonText}>Check</Text>
              </Pressable>
            )
          ) : (
            !showAnswer ? (
              <Pressable
                style={({ pressed }) => [
                  styles.showAnswerButton,
                  pressed && styles.showAnswerPressed,
                ]}
                onPress={() => {
                  animateReveal();
                  playAudio(currentGap.frenchWord);
                  showMemoryStrength(currentGap);
                }}
              >
                <Text style={styles.showAnswerText}>Show Answer</Text>
              </Pressable>
            ) : (
              <View style={styles.ratingRow}>
                {(['again', 'hard', 'good', 'easy'] as const).map((key) => {
                  const config = RATING_CONFIG[key];
                  const preview = intervalPreviews[key];
                  return (
                    <Pressable
                      key={key}
                      style={({ pressed }) => [
                        styles.ratingButton,
                        { backgroundColor: config.bgColor, borderColor: `${config.color}30` },
                        pressed && { transform: [{ scale: 0.95 }], opacity: 0.9 },
                      ]}
                      onPress={() => handleRate(config.quality)}
                    >
                      <View style={[styles.ratingAccent, { backgroundColor: config.color }]} />
                      <Text style={[styles.ratingLabel, { color: config.color }]}>{config.label}</Text>
                      <Text style={[styles.ratingInterval, { color: config.color }]}>{preview.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

function DashboardView({ info, fadeAnim, onStart, onClose, isEmpty }: {
  info: DashboardInfo;
  fadeAnim: Animated.Value;
  onStart: () => void;
  onClose: () => void;
  isEmpty: boolean;
}) {
  if (isEmpty) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.emptyContainer}>
            <Kiri mood="idle" size={120} />
            <Text style={styles.emptyTitle}>All caught up!</Text>
            <Text style={styles.emptySubtitle}>
              No cards due for review right now. Keep learning and your deck will grow.
            </Text>
            <View style={styles.nextReviewHint}>
              <Clock size={14} color={Colors.textMuted} />
              <Text style={styles.nextReviewText}>Cards will appear as they become due</Text>
            </View>
            <Pressable style={styles.emptyButton} onPress={onClose}>
              <Home size={18} color={Colors.textLight} />
              <Text style={styles.emptyButtonText}>Back</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient
        colors={['#1E293B', '#334155']}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safeArea}>
        <Animated.View style={[styles.dashboardContent, { opacity: fadeAnim }]}>
          <Pressable style={styles.dashCloseButton} onPress={onClose}>
            <X size={20} color="rgba(255,255,255,0.7)" />
          </Pressable>

          <View style={styles.dashHeader}>
            <View style={styles.dashIconContainer}>
              <Brain size={32} color="#818CF8" />
            </View>
            <Text style={styles.dashTitle}>Review Session</Text>
            <Text style={styles.dashSubtitle}>Strengthen your memory</Text>
          </View>

          <View style={styles.dashStatsGrid}>
            <View style={styles.dashStatCard}>
              <View style={[styles.dashStatIconBg, { backgroundColor: '#FEF3C7' }]}>
                <Flame size={18} color="#D97706" />
              </View>
              <Text style={styles.dashStatNumber}>{info.reviewCount}</Text>
              <Text style={styles.dashStatLabel}>Due</Text>
            </View>
            <View style={styles.dashStatCard}>
              <View style={[styles.dashStatIconBg, { backgroundColor: '#EFF6FF' }]}>
                <Zap size={18} color="#2563EB" />
              </View>
              <Text style={styles.dashStatNumber}>{info.newCount}</Text>
              <Text style={styles.dashStatLabel}>New</Text>
            </View>
            <View style={styles.dashStatCard}>
              <View style={[styles.dashStatIconBg, { backgroundColor: '#F0FDF4' }]}>
                <Timer size={18} color="#16A34A" />
              </View>
              <Text style={styles.dashStatNumber}>~{info.estimatedMinutes}</Text>
              <Text style={styles.dashStatLabel}>Min</Text>
            </View>
          </View>

          {info.categories.length > 0 && (
            <View style={styles.dashCategoriesSection}>
              <Text style={styles.dashSectionTitle}>Categories</Text>
              <View style={styles.dashCategoriesList}>
                {info.categories.map((cat) => (
                  <View key={cat.category} style={styles.dashCategoryRow}>
                    <View style={[styles.dashCategoryDot, { backgroundColor: cat.color }]} />
                    <Text style={styles.dashCategoryName}>{cat.category}</Text>
                    <Text style={styles.dashCategoryCount}>{cat.count}</Text>
                    <View style={styles.dashCategoryBar}>
                      <View style={[
                        styles.dashCategoryBarFill,
                        {
                          backgroundColor: cat.color,
                          width: `${Math.min(100, (cat.count / info.totalDue) * 100)}%`,
                        },
                      ]} />
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          <Pressable
            style={({ pressed }) => [
              styles.dashStartButton,
              pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
            ]}
            onPress={onStart}
          >
            <LinearGradient
              colors={['#818CF8', '#6366F1']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.dashStartGradient}
            >
              <Text style={styles.dashStartText}>Start Review</Text>
              <Text style={styles.dashStartSubtext}>{info.totalDue} cards</Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

function CompleteView({ stats, fadeAnim, scaleAnim, onClose, onViewDeck }: {
  stats: SessionStats;
  fadeAnim: Animated.Value;
  scaleAnim: Animated.Value;
  onClose: () => void;
  onViewDeck: () => void;
}) {
  const elapsed = Math.round((Date.now() - stats.startTime) / 1000);
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const timeStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
  const retentionRate = stats.totalReviewed > 0
    ? Math.round(((stats.goodCount + stats.easyCount) / stats.totalReviewed) * 100)
    : 0;

  const uniqueNeedMore = [...new Set(stats.needMorePractice)];

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient
        colors={retentionRate >= 70 ? ['#0F172A', '#1E3A5F'] : ['#1E293B', '#44403C']}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.completeScrollContent} showsVerticalScrollIndicator={false}>
          <Animated.View style={[
            styles.completeContent,
            { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
          ]}>
            <Kiri mood={retentionRate >= 70 ? 'celebrating' : 'encouraging'} size={90} />

            <Text style={styles.completeTitle}>
              {retentionRate >= 80 ? 'Excellent session!' : retentionRate >= 50 ? 'Solid work!' : 'Keep going!'}
            </Text>

            <View style={styles.completeMainStat}>
              <Text style={styles.completeMainNumber}>{stats.totalReviewed}</Text>
              <Text style={styles.completeMainLabel}>cards reviewed</Text>
            </View>

            <View style={styles.completeMetricsRow}>
              <View style={styles.completeMetricCard}>
                <TrendingUp size={16} color="#818CF8" />
                <Text style={styles.completeMetricValue}>{retentionRate}%</Text>
                <Text style={styles.completeMetricLabel}>accuracy</Text>
              </View>
              <View style={styles.completeMetricCard}>
                <Clock size={16} color="#38BDF8" />
                <Text style={styles.completeMetricValue}>{timeStr}</Text>
                <Text style={styles.completeMetricLabel}>time</Text>
              </View>
              <View style={styles.completeMetricCard}>
                <Flame size={16} color="#FB923C" />
                <Text style={styles.completeMetricValue}>{stats.bestStreak}</Text>
                <Text style={styles.completeMetricLabel}>best streak</Text>
              </View>
            </View>

            <View style={styles.completeBreakdownCard}>
              <Text style={styles.completeBreakdownTitle}>Breakdown</Text>
              <View style={styles.completeBreakdownRow}>
                {[
                  { label: 'Again', value: stats.againCount, color: '#DC2626' },
                  { label: 'Hard', value: stats.hardCount, color: '#D97706' },
                  { label: 'Good', value: stats.goodCount, color: '#059669' },
                  { label: 'Easy', value: stats.easyCount, color: '#2563EB' },
                ].map((item) => (
                  <View key={item.label} style={styles.breakdownItem}>
                    <View style={[styles.breakdownDot, { backgroundColor: item.color }]} />
                    <Text style={styles.breakdownLabel}>{item.label}</Text>
                    <Text style={styles.breakdownValue}>{item.value}</Text>
                  </View>
                ))}
              </View>
            </View>

            {stats.masteredCount > 0 && (
              <View style={styles.completeMasteredBadge}>
                <Award size={18} color="#F59E0B" />
                <Text style={styles.completeMasteredText}>
                  {stats.masteredCount} card{stats.masteredCount > 1 ? 's' : ''} mastered!
                </Text>
              </View>
            )}

            {stats.leveledUpCount > 0 && (
              <View style={styles.completeLevelUpBadge}>
                <Star size={16} color="#818CF8" />
                <Text style={styles.completeLevelUpText}>
                  {stats.leveledUpCount} card{stats.leveledUpCount > 1 ? 's' : ''} leveled up
                </Text>
              </View>
            )}

            {uniqueNeedMore.length > 0 && (
              <View style={styles.completeNeedMoreCard}>
                <Text style={styles.completeNeedMoreTitle}>Needs more practice</Text>
                <View style={styles.completeNeedMoreList}>
                  {uniqueNeedMore.slice(0, 5).map((word, i) => (
                    <View key={i} style={styles.completeNeedMoreItem}>
                      <Text style={styles.completeNeedMoreWord}>{word}</Text>
                    </View>
                  ))}
                  {uniqueNeedMore.length > 5 && (
                    <Text style={styles.completeNeedMoreExtra}>+{uniqueNeedMore.length - 5} more</Text>
                  )}
                </View>
              </View>
            )}

            <View style={styles.completeActions}>
              <Pressable
                style={({ pressed }) => [styles.completePrimaryAction, pressed && { opacity: 0.9 }]}
                onPress={onClose}
              >
                <Home size={18} color="#FFF" />
                <Text style={styles.completePrimaryText}>Done</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.completeSecondaryAction, pressed && { opacity: 0.9 }]}
                onPress={onViewDeck}
              >
                <Layers size={18} color="#818CF8" />
                <Text style={styles.completeSecondaryText}>View Deck</Text>
              </Pressable>
            </View>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function FlashcardView({ gap, showAnswer, answerOpacity, onPlayAudio, isPlaying }: {
  gap: GapItem;
  showAnswer: boolean;
  answerOpacity: Animated.Value;
  onPlayAudio: (text: string) => void;
  isPlaying: boolean;
}) {
  return (
    <>
      <View style={styles.cardFront}>
        <Text style={styles.frenchWord}>{gap.frenchWord}</Text>
        {gap.pronunciation && (
          <Text style={styles.pronunciationText}>/{gap.pronunciation}/</Text>
        )}
        <Pressable
          style={[styles.audioButton, isPlaying && styles.audioButtonActive]}
          onPress={() => onPlayAudio(gap.frenchWord)}
        >
          <Volume2 size={22} color={isPlaying ? Colors.textLight : Colors.primary} />
        </Pressable>
      </View>

      {showAnswer && (
        <Animated.View style={[styles.cardBack, { opacity: answerOpacity }]}>
          <View style={styles.divider} />
          <Text style={styles.englishWord}>{gap.englishTranslation}</Text>

          {gap.explanation ? (
            <View style={styles.explanationBox}>
              <Text style={styles.explanationText}>{gap.explanation}</Text>
            </View>
          ) : null}

          <Pressable
            style={styles.exampleBox}
            onPress={() => onPlayAudio(gap.exampleSentence)}
          >
            <View style={styles.exampleHeader}>
              <Text style={styles.exampleLabel}>EXAMPLE</Text>
              <Volume2 size={13} color={Colors.textMuted} />
            </View>
            <Text style={styles.exampleFrench}>{gap.exampleSentence}</Text>
            {gap.exampleTranslation ? (
              <Text style={styles.exampleEnglish}>{gap.exampleTranslation}</Text>
            ) : null}
          </Pressable>
        </Animated.View>
      )}
    </>
  );
}

function ExerciseCard({ gap, mode, choices, selectedChoice, fillAnswer, submitted, isCorrect, onSelectChoice, onFillChange, onSubmit, onPlayAudio, isPlaying }: {
  gap: GapItem;
  mode: ExerciseMode;
  choices: string[];
  selectedChoice: string | null;
  fillAnswer: string;
  submitted: boolean;
  isCorrect: boolean | null;
  onSelectChoice: (choice: string) => void;
  onFillChange: (text: string) => void;
  onSubmit: () => void;
  onPlayAudio: (text: string) => void;
  isPlaying: boolean;
}) {
  return (
    <View style={styles.exerciseContainer}>
      <View style={styles.exercisePromptRow}>
        <Pressable
          style={[styles.exerciseAudioBtn, isPlaying && styles.exerciseAudioBtnActive]}
          onPress={() => onPlayAudio(gap.frenchWord)}
        >
          <Volume2 size={18} color={isPlaying ? '#FFF' : Colors.primary} />
        </Pressable>
        <Text style={styles.exerciseFrenchWord}>{gap.frenchWord}</Text>
      </View>

      {mode === 'multiple_choice' && (
        <View style={styles.exerciseSection}>
          <Text style={styles.exerciseInstruction}>What does this mean?</Text>
          <View style={styles.choicesList}>
            {choices.map((choice, idx) => {
              const isSelected = selectedChoice === choice;
              const isAnswer = choice === gap.englishTranslation;
              let choiceBg = '#FFFFFF';
              let choiceBorder = Colors.border;
              let choiceTextColor = Colors.text;

              if (submitted) {
                if (isAnswer) {
                  choiceBg = '#ECFDF5';
                  choiceBorder = '#059669';
                  choiceTextColor = '#059669';
                } else if (isSelected && !isAnswer) {
                  choiceBg = '#FEF2F2';
                  choiceBorder = '#DC2626';
                  choiceTextColor = '#DC2626';
                }
              } else if (isSelected) {
                choiceBg = Colors.primaryLight;
                choiceBorder = Colors.primary;
                choiceTextColor = Colors.primaryDark;
              }

              return (
                <Pressable
                  key={idx}
                  style={[
                    styles.choiceButton,
                    { backgroundColor: choiceBg, borderColor: choiceBorder },
                  ]}
                  onPress={() => !submitted && onSelectChoice(choice)}
                  disabled={submitted}
                >
                  <Text style={[styles.choiceText, { color: choiceTextColor }]}>{choice}</Text>
                  {submitted && isAnswer && <CheckCircle size={16} color="#059669" />}
                  {submitted && isSelected && !isAnswer && <XCircle size={16} color="#DC2626" />}
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {mode === 'fill_blank' && (
        <View style={styles.exerciseSection}>
          <Text style={styles.exerciseInstruction}>
            Type the French word for: <Text style={styles.exerciseHighlight}>{gap.englishTranslation}</Text>
          </Text>
          <View style={styles.fillInputContainer}>
            <TextInput
              style={[
                styles.fillInput,
                submitted && isCorrect === true && styles.fillInputCorrect,
                submitted && isCorrect === false && styles.fillInputWrong,
              ]}
              value={fillAnswer}
              onChangeText={onFillChange}
              placeholder="Type your answer..."
              placeholderTextColor={Colors.textMuted}
              editable={!submitted}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={() => {
                if (fillAnswer.trim() && !submitted) onSubmit();
              }}
            />
          </View>
          {submitted && isCorrect === false && (
            <View style={styles.correctAnswerRow}>
              <Text style={styles.correctAnswerLabel}>Correct:</Text>
              <Text style={styles.correctAnswerText}>{gap.frenchWord}</Text>
            </View>
          )}
        </View>
      )}

      {mode === 'translation' && (
        <View style={styles.exerciseSection}>
          <Text style={styles.exerciseInstruction}>
            Translate to English:
          </Text>
          <View style={styles.fillInputContainer}>
            <TextInput
              style={[
                styles.fillInput,
                submitted && isCorrect === true && styles.fillInputCorrect,
                submitted && isCorrect === false && styles.fillInputWrong,
              ]}
              value={fillAnswer}
              onChangeText={onFillChange}
              placeholder="Type the translation..."
              placeholderTextColor={Colors.textMuted}
              editable={!submitted}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={() => {
                if (fillAnswer.trim() && !submitted) onSubmit();
              }}
            />
          </View>
          {submitted && isCorrect === false && (
            <View style={styles.correctAnswerRow}>
              <Text style={styles.correctAnswerLabel}>Correct:</Text>
              <Text style={styles.correctAnswerText}>{gap.englishTranslation}</Text>
            </View>
          )}
        </View>
      )}

      {submitted && gap.explanation && (
        <View style={styles.exerciseExplanation}>
          <Text style={styles.exerciseExplanationText}>{gap.explanation}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFBF7',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressArea: {
    flex: 1,
    gap: 4,
  },
  progressBar: {
    height: 5,
    backgroundColor: Colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#818CF8',
    borderRadius: 3,
  },
  queueInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  queueInfoText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.textMuted,
  },
  newBadgeSmall: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  newBadgeSmallText: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: '#2563EB',
    letterSpacing: 0.5,
  },
  modePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  modePillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  modePillText: {
    fontSize: 11,
    fontWeight: '600' as const,
    textTransform: 'capitalize' as const,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 8,
    flexGrow: 1,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: 'rgba(0,0,0,0.08)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 4,
  },
  cardFront: {
    padding: 28,
    alignItems: 'center',
  },
  frenchWord: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: Colors.primary,
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  pronunciationText: {
    fontSize: 15,
    color: Colors.textMuted,
    fontStyle: 'italic',
    marginBottom: 20,
  },
  audioButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  audioButtonActive: {
    backgroundColor: Colors.primary,
  },
  cardBack: {
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginBottom: 20,
  },
  englishWord: {
    fontSize: 24,
    fontWeight: '600' as const,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 16,
  },
  explanationBox: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    width: '100%',
  },
  explanationText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    textAlign: 'center',
  },
  exampleBox: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 12,
    padding: 14,
    width: '100%',
    marginBottom: 14,
  },
  exampleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  exampleLabel: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: Colors.textMuted,
    letterSpacing: 0.8,
  },
  exampleFrench: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.text,
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 6,
    lineHeight: 22,
  },
  exampleEnglish: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 19,
  },
  memorySection: {
    marginHorizontal: 20,
    marginBottom: 20,
    marginTop: 4,
    padding: 14,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
  },
  memorySectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  memorySectionTitle: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    flex: 1,
  },
  memorySectionLabel: {
    fontSize: 12,
    fontWeight: '700' as const,
  },
  memoryBarTrack: {
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  memoryBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  memoryBarHint: {
    fontSize: 11,
    color: Colors.textMuted,
    lineHeight: 15,
  },
  bottomArea: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  showAnswerButton: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
  },
  showAnswerPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  showAnswerText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  ratingRow: {
    flexDirection: 'row',
    gap: 8,
  },
  ratingButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  ratingAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  ratingLabel: {
    fontSize: 13,
    fontWeight: '700' as const,
    marginBottom: 3,
  },
  ratingInterval: {
    fontSize: 11,
    fontWeight: '500' as const,
    opacity: 0.75,
  },
  submitButton: {
    backgroundColor: '#818CF8',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#CBD5E1',
  },
  submitButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  exerciseResultRow: {
    gap: 10,
  },
  exerciseResultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  exerciseResultText: {
    fontSize: 15,
    fontWeight: '600' as const,
    flex: 1,
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 16,
    paddingVertical: 16,
  },
  continueButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  exerciseContainer: {
    padding: 24,
  },
  exercisePromptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  exerciseAudioBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseAudioBtnActive: {
    backgroundColor: Colors.primary,
  },
  exerciseFrenchWord: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.primary,
    flex: 1,
  },
  exerciseSection: {
    marginBottom: 16,
  },
  exerciseInstruction: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginBottom: 14,
    lineHeight: 22,
  },
  exerciseHighlight: {
    fontWeight: '700' as const,
    color: Colors.text,
  },
  choicesList: {
    gap: 8,
  },
  choiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  choiceText: {
    fontSize: 15,
    fontWeight: '500' as const,
    flex: 1,
  },
  fillInputContainer: {
    marginBottom: 10,
  },
  fillInput: {
    fontSize: 16,
    color: Colors.text,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FAFAFA',
  },
  fillInputCorrect: {
    borderColor: '#059669',
    backgroundColor: '#F0FDF4',
  },
  fillInputWrong: {
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  correctAnswerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
  },
  correctAnswerLabel: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  correctAnswerText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#059669',
  },
  exerciseExplanation: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 10,
    padding: 12,
  },
  exerciseExplanationText: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.text,
    marginTop: 20,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  nextReviewHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 28,
  },
  nextReviewText: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
  },
  emptyButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.textLight,
  },
  dashboardContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  dashCloseButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  dashHeader: {
    alignItems: 'center',
    marginBottom: 28,
  },
  dashIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: 'rgba(129,140,248,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  dashTitle: {
    fontSize: 26,
    fontWeight: '700' as const,
    color: '#F1F5F9',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  dashSubtitle: {
    fontSize: 15,
    color: '#94A3B8',
  },
  dashStatsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  dashStatCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  dashStatIconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dashStatNumber: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: '#F1F5F9',
  },
  dashStatLabel: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500' as const,
  },
  dashCategoriesSection: {
    marginBottom: 28,
  },
  dashSectionTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#94A3B8',
    marginBottom: 12,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  dashCategoriesList: {
    gap: 10,
  },
  dashCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dashCategoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dashCategoryName: {
    fontSize: 14,
    color: '#CBD5E1',
    fontWeight: '500' as const,
    textTransform: 'capitalize' as const,
    width: 100,
  },
  dashCategoryCount: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#F1F5F9',
    width: 24,
    textAlign: 'right',
  },
  dashCategoryBar: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  dashCategoryBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  dashStartButton: {
    borderRadius: 18,
    overflow: 'hidden',
    marginTop: 'auto' as const,
    marginBottom: 20,
  },
  dashStartGradient: {
    paddingVertical: 18,
    alignItems: 'center',
    borderRadius: 18,
  },
  dashStartText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#FFF',
    letterSpacing: 0.2,
  },
  dashStartSubtext: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  completeScrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  completeContent: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  completeTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#F1F5F9',
    marginTop: 16,
    marginBottom: 4,
  },
  completeMainStat: {
    alignItems: 'center',
    marginVertical: 16,
  },
  completeMainNumber: {
    fontSize: 56,
    fontWeight: '800' as const,
    color: '#F1F5F9',
    letterSpacing: -1,
  },
  completeMainLabel: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 2,
  },
  completeMetricsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginBottom: 16,
  },
  completeMetricCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  completeMetricValue: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#F1F5F9',
  },
  completeMetricLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500' as const,
  },
  completeBreakdownCard: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  completeBreakdownTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#94A3B8',
    marginBottom: 14,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  completeBreakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  breakdownItem: {
    alignItems: 'center',
    gap: 4,
  },
  breakdownDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  breakdownLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500' as const,
  },
  breakdownValue: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#F1F5F9',
  },
  completeMasteredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(245,158,11,0.15)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 10,
    width: '100%',
  },
  completeMasteredText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#F59E0B',
  },
  completeLevelUpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(129,140,248,0.15)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 10,
    width: '100%',
  },
  completeLevelUpText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#818CF8',
  },
  completeNeedMoreCard: {
    width: '100%',
    backgroundColor: 'rgba(220,38,38,0.1)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(220,38,38,0.15)',
  },
  completeNeedMoreTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#FCA5A5',
    marginBottom: 8,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.3,
  },
  completeNeedMoreList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  completeNeedMoreItem: {
    backgroundColor: 'rgba(220,38,38,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  completeNeedMoreWord: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#FCA5A5',
  },
  completeNeedMoreExtra: {
    fontSize: 12,
    color: '#FCA5A5',
    alignSelf: 'center',
  },
  completeActions: {
    width: '100%',
    gap: 10,
    marginTop: 20,
  },
  completePrimaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#818CF8',
    paddingVertical: 16,
    borderRadius: 16,
  },
  completePrimaryText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFF',
  },
  completeSecondaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: 'rgba(129,140,248,0.15)',
    paddingVertical: 14,
    borderRadius: 16,
  },
  completeSecondaryText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#818CF8',
  },
});
