import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Animated,
  ActivityIndicator,
  Platform,
  Modal,
} from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { safeGoBack } from '@/utils/navigation';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  X,
  Mic,
  Square,
  Volume2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Info,
  Check,
  AlertTriangle,
  Trophy,
  Star,
  Headphones,
  EyeOff,
  Zap,
  Coffee,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { USE_NATIVE_DRIVER } from '@/constants/animation';
import { useApp } from '@/contexts/AppContext';
import { useAzurePronunciation } from '@/hooks/useAzurePronunciation';
import { useFrenchAudio } from '@/hooks/useFrenchAudio';
import {
  pronStages,
  PRON_PASS_SCORE,
  generateSuggestions,
} from '@/data/foundationPronunciation';
import type { PronItem } from '@/data/foundationPronunciation';
import Kiri from '@/components/Kiri';
import PronunciationFeedback from '@/components/PronunciationFeedback';
import { useAccent } from '@/contexts/AccentContext';

type InteractionMode = 'standard' | 'listen_identify' | 'shadowing';
type LessonPhase = 'initial' | 'review' | 'complete';
type ItemMasteryData = Record<string, { attempts: number; bestScore: number; passed: boolean; needsExtraPractice: boolean }>;

const MAX_ITEM_ATTEMPTS = 5;
const BREAK_INTERVAL = 10;

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function getInteractionMode(index: number, phase: LessonPhase): InteractionMode {
  if (phase === 'review') return 'standard';
  const mod = index % 3;
  if (mod === 0) return 'standard';
  if (mod === 1) return 'listen_identify';
  return 'shadowing';
}

function getMasteryStorageKey(lessonId: string): string {
  return `pron-mastery-${lessonId}`;
}

export default function PronunciationLessonScreen() {
  const _router = useRouter();
  const { stageId, lessonId } = useLocalSearchParams<{ stageId: string; lessonId: string }>();
  const { pronFoundation: _pronFoundation, completePronLesson } = useApp();
  const { accentLocale } = useAccent();

  const stage = pronStages.find(s => s.id === stageId);
  const lesson = stage?.lessons.find(l => l.id === lessonId);

  const [practiceQueue, setPracticeQueue] = useState<PronItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [itemMastery, setItemMastery] = useState<ItemMasteryData>({});
  const [lessonPhase, setLessonPhase] = useState<LessonPhase>('initial');
  const [showSummary, setShowSummary] = useState(false);
  const [totalAttempted, setTotalAttempted] = useState(0);
  const [sessionBreakVisible, setSessionBreakVisible] = useState(false);
  const [_expandedWord, setExpandedWord] = useState<string | null>(null);

  const [interactionMode, setInteractionMode] = useState<InteractionMode>('standard');
  const [listenIdChoices, setListenIdChoices] = useState<PronItem[]>([]);
  const [listenIdSelected, setListenIdSelected] = useState<string | null>(null);
  const [listenIdRevealed, setListenIdRevealed] = useState(false);
  const [shadowingActive, setShadowingActive] = useState(false);
  const [textHidden, setTextHidden] = useState(false);

  const {
    isRecording,
    isAnalyzing,
    result,
    error: assessmentError,
    startRecording,
    stopAndAssess,
    reset: resetAssessment,
  } = useAzurePronunciation(accentLocale);

  const { speak, isSpeaking } = useFrenchAudio();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const summaryScale = useRef(new Animated.Value(0)).current;
  const summaryOpacity = useRef(new Animated.Value(0)).current;

  const items = useMemo(() => lesson?.items ?? [], [lesson]);

  useEffect(() => {
    if (!lesson) return;
    console.log('[PronLesson] Initializing lesson:', lesson.id);
    void loadSavedMastery(lesson.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson]);

  const loadSavedMastery = async (lid: string) => {
    try {
      const stored = await AsyncStorage.getItem(getMasteryStorageKey(lid));
      if (stored) {
        const parsed = JSON.parse(stored) as ItemMasteryData;
        const unpassedIds = items.filter(item => !parsed[item.id]?.passed && !parsed[item.id]?.needsExtraPractice).map(i => i.id);
        if (unpassedIds.length > 0 && unpassedIds.length < items.length) {
          console.log('[PronLesson] Resuming with', unpassedIds.length, 'unpassed items');
          setItemMastery(parsed);
          const unpassed = items.filter(i => unpassedIds.includes(i.id));
          setPracticeQueue(shuffleArray(unpassed));
          setLessonPhase('review');
          setCurrentIndex(0);
          return;
        }
      }
    } catch (e) {
      console.log('[PronLesson] Error loading saved mastery:', e);
    }
    const shuffled = shuffleArray(items);
    setPracticeQueue(shuffled);
    const initialMastery: ItemMasteryData = {};
    for (const item of items) {
      initialMastery[item.id] = { attempts: 0, bestScore: 0, passed: false, needsExtraPractice: false };
    }
    setItemMastery(initialMastery);
    setLessonPhase('initial');
    setCurrentIndex(0);
  };

  const saveMastery = useCallback(async (mastery: ItemMasteryData) => {
    if (!lesson) return;
    try {
      await AsyncStorage.setItem(getMasteryStorageKey(lesson.id), JSON.stringify(mastery));
    } catch (e) {
      console.log('[PronLesson] Error saving mastery:', e);
    }
  }, [lesson]);

  const currentItem = practiceQueue[currentIndex] ?? null;

  useEffect(() => {
    if (currentItem && practiceQueue.length > 0) {
      const mode = getInteractionMode(currentIndex, lessonPhase);
      setInteractionMode(mode);
      setListenIdSelected(null);
      setListenIdRevealed(false);
      setShadowingActive(false);
      setTextHidden(mode === 'listen_identify');

      if (mode === 'listen_identify') {
        const others = items.filter(i => i.id !== currentItem.id);
        const distractors = shuffleArray(others).slice(0, Math.min(2, others.length));
        setListenIdChoices(shuffleArray([currentItem, ...distractors]));
      }
    }
  }, [currentIndex, currentItem, lessonPhase, items, practiceQueue.length]);

  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 600, useNativeDriver: USE_NATIVE_DRIVER }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: USE_NATIVE_DRIVER }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording, pulseAnim]);

  useEffect(() => {
    if (result && currentItem) {
      const score = result.pronunciationScore;
      setItemMastery(prev => {
        const existing = prev[currentItem.id] ?? { attempts: 0, bestScore: 0, passed: false, needsExtraPractice: false };
        const newAttempts = existing.attempts + 1;
        const newBest = Math.max(score, existing.bestScore);
        const newPassed = newBest >= PRON_PASS_SCORE;
        const needsExtra = !newPassed && newAttempts >= MAX_ITEM_ATTEMPTS;

        const updated = {
          ...prev,
          [currentItem.id]: {
            attempts: newAttempts,
            bestScore: newBest,
            passed: newPassed,
            needsExtraPractice: needsExtra,
          },
        };
        void saveMastery(updated);
        return updated;
      });
      setTotalAttempted(prev => prev + 1);

      if (score >= 70) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }
  }, [result, currentItem, saveMastery]);

  const handleStartRecording = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    void startRecording();
  }, [startRecording]);

  const handleStopRecording = useCallback(() => {
    if (!currentItem) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    void stopAndAssess(currentItem.text);
  }, [currentItem, stopAndAssess]);

  const checkAndAdvance = useCallback(() => {
    if (totalAttempted > 0 && totalAttempted % BREAK_INTERVAL === 0) {
      const hasUnpassed = items.some(item => {
        const m = itemMastery[item.id];
        return !m?.passed && !m?.needsExtraPractice;
      });
      if (hasUnpassed) {
        setSessionBreakVisible(true);
        return;
      }
    }

    if (currentIndex < practiceQueue.length - 1) {
      setCurrentIndex(prev => prev + 1);
      resetAssessment();
      setExpandedWord(null);
    } else {
      handlePhaseEnd();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, practiceQueue.length, resetAssessment, totalAttempted, items, itemMastery]);

  const handlePhaseEnd = useCallback(() => {
    const unpassed = items.filter(item => {
      const m = itemMastery[item.id];
      return !m?.passed && !m?.needsExtraPractice;
    });

    if (unpassed.length > 0 && lessonPhase === 'initial') {
      console.log('[PronLesson] Entering review phase with', unpassed.length, 'items');
      setLessonPhase('review');
      setPracticeQueue(shuffleArray(unpassed));
      setCurrentIndex(0);
      resetAssessment();
      setExpandedWord(null);
    } else if (unpassed.length > 0 && lessonPhase === 'review') {
      setPracticeQueue(shuffleArray(unpassed));
      setCurrentIndex(0);
      resetAssessment();
      setExpandedWord(null);
    } else {
      showLessonSummary();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, itemMastery, lessonPhase, resetAssessment]);

  const goNext = useCallback(() => {
    checkAndAdvance();
  }, [checkAndAdvance]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      resetAssessment();
      setExpandedWord(null);
    }
  }, [currentIndex, resetAssessment]);

  const showLessonSummary = useCallback(() => {
    setShowSummary(true);
    Animated.parallel([
      Animated.spring(summaryScale, { toValue: 1, useNativeDriver: USE_NATIVE_DRIVER, tension: 50, friction: 8 }),
      Animated.timing(summaryOpacity, { toValue: 1, duration: 300, useNativeDriver: USE_NATIVE_DRIVER }),
    ]).start();
  }, [summaryScale, summaryOpacity]);

  const masteredCount = useMemo(() => {
    return items.filter(item => itemMastery[item.id]?.passed).length;
  }, [items, itemMastery]);

  const extraPracticeCount = useMemo(() => {
    return items.filter(item => itemMastery[item.id]?.needsExtraPractice).length;
  }, [items, itemMastery]);

  const masteryPercentage = useMemo(() => {
    if (items.length === 0) return 0;
    return Math.round(((masteredCount + extraPracticeCount) / items.length) * 100);
  }, [masteredCount, extraPracticeCount, items.length]);

  const allItemsDone = useMemo(() => {
    return items.every(item => {
      const m = itemMastery[item.id];
      return m?.passed || m?.needsExtraPractice;
    });
  }, [items, itemMastery]);

  const handleCompleteLesson = useCallback(async () => {
    if (lesson && allItemsDone) {
      const avgScore = items.length > 0
        ? Math.round(items.reduce((sum, item) => sum + (itemMastery[item.id]?.bestScore ?? 0), 0) / items.length)
        : 0;
      await completePronLesson(lesson.id, avgScore);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      try {
        await AsyncStorage.removeItem(getMasteryStorageKey(lesson.id));
      } catch { /* ignore */ }
    }
    safeGoBack();
  }, [lesson, allItemsDone, items, itemMastery, completePronLesson]);

  const handleContinueLater = useCallback(() => {
    safeGoBack();
  }, []);

  const handleRetry = useCallback(() => {
    setShowSummary(false);
    const shuffled = shuffleArray(items);
    setPracticeQueue(shuffled);
    const initialMastery: ItemMasteryData = {};
    for (const item of items) {
      initialMastery[item.id] = { attempts: 0, bestScore: 0, passed: false, needsExtraPractice: false };
    }
    setItemMastery(initialMastery);
    setLessonPhase('initial');
    setCurrentIndex(0);
    setTotalAttempted(0);
    resetAssessment();
    summaryScale.setValue(0);
    summaryOpacity.setValue(0);
  }, [items, resetAssessment, summaryScale, summaryOpacity]);

  const suggestions = useMemo(() => {
    if (!result || !currentItem) return [];
    return generateSuggestions(result, currentItem.type);
  }, [result, currentItem]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#10B981';
    if (score >= 60) return '#F59E0B';
    return '#EF4444';
  };

  const getDotColor = (itemId: string): string => {
    const m = itemMastery[itemId];
    if (!m || m.attempts === 0) return '#E5E7EB';
    if (m.passed) return '#10B981';
    if (m.needsExtraPractice) return '#F59E0B';
    if (m.bestScore > 0 && m.bestScore < PRON_PASS_SCORE) return '#EF4444';
    return '#E5E7EB';
  };

  const handleListenIdSelect = useCallback((itemId: string) => {
    setListenIdSelected(itemId);
    const isCorrect = itemId === currentItem?.id;
    if (isCorrect) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
    setTimeout(() => {
      setListenIdRevealed(true);
      setTextHidden(false);
    }, 600);
  }, [currentItem]);

  const handleShadowingStart = useCallback(() => {
    if (!currentItem) return;
    setShadowingActive(true);
    void Promise.resolve(speak(currentItem.text)).then(() => {
      setTimeout(() => {
        void startRecording();
      }, 1200);
    });
  }, [currentItem, speak, startRecording]);

  if (!stage || !lesson) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.errorContainer}>
          <Text style={styles.errorText}>Lesson not found</Text>
          <Pressable onPress={() => safeGoBack()} style={styles.errorButton}>
            <Text style={styles.errorButtonText}>Go Back</Text>
          </Pressable>
        </SafeAreaView>
      </View>
    );
  }

  if (practiceQueue.length === 0) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.errorContainer}>
          <ActivityIndicator size="large" color={stage.color} />
          <Text style={styles.errorText}>Loading lesson...</Text>
        </SafeAreaView>
      </View>
    );
  }

  if (showSummary) {
    const kiriMood = masteryPercentage >= 100 ? 'celebrating' : masteryPercentage >= 70 ? 'encouraging' : 'thinking';
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.summaryContainer}>
          <Animated.View
            style={[
              styles.summaryContent,
              { opacity: summaryOpacity, transform: [{ scale: summaryScale }] },
            ]}
          >
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.summaryScroll}>
              <View style={styles.summaryHeader}>
                <Kiri mood={kiriMood} size={90} />
                <View style={styles.summaryMasteryCircle}>
                  <Text style={[styles.summaryMasteryNum, { color: stage.color }]}>
                    {masteredCount}/{items.length}
                  </Text>
                  <Text style={styles.summaryMasteryLabel}>Mastered</Text>
                </View>
              </View>

              <Text style={styles.summaryTitle}>
                {masteryPercentage >= 100 ? 'All Sounds Mastered!' : masteryPercentage >= 70 ? 'Great Progress!' : 'Keep Practicing!'}
              </Text>
              <Text style={styles.summarySubtitle}>
                {masteredCount} of {items.length} sounds scored ≥{PRON_PASS_SCORE}%
              </Text>

              {extraPracticeCount > 0 && (
                <View style={styles.warningBox}>
                  <AlertTriangle size={16} color="#F59E0B" />
                  <Text style={styles.warningText}>
                    {extraPracticeCount} item{extraPracticeCount > 1 ? 's' : ''} flagged for extra practice (reached {MAX_ITEM_ATTEMPTS} attempts without passing)
                  </Text>
                </View>
              )}

              <View style={styles.summaryItems}>
                <Text style={styles.summaryItemsTitle}>Item Breakdown</Text>
                {items.map((item) => {
                  const m = itemMastery[item.id];
                  const score = m?.bestScore ?? 0;
                  const attempts = m?.attempts ?? 0;
                  return (
                    <View key={item.id} style={styles.summaryItemRow}>
                      <View
                        style={[
                          styles.summaryItemDot,
                          {
                            backgroundColor: m?.passed
                              ? '#10B981'
                              : m?.needsExtraPractice
                              ? '#F59E0B'
                              : attempts > 0
                              ? '#EF4444'
                              : '#E5E7EB',
                          },
                        ]}
                      >
                        {m?.passed ? (
                          <Check size={10} color="#FFFFFF" />
                        ) : m?.needsExtraPractice ? (
                          <AlertTriangle size={8} color="#FFFFFF" />
                        ) : attempts > 0 ? (
                          <Text style={styles.summaryItemDotText}>!</Text>
                        ) : (
                          <Text style={styles.summaryItemDotText}>—</Text>
                        )}
                      </View>
                      <Text style={styles.summaryItemText} numberOfLines={1}>
                        {item.text}
                      </Text>
                      <View style={styles.summaryItemMeta}>
                        {attempts > 0 && (
                          <Text style={styles.summaryItemAttempts}>×{attempts}</Text>
                        )}
                        <Text
                          style={[
                            styles.summaryItemScore,
                            { color: attempts > 0 ? getScoreColor(score) : '#9CA3AF' },
                          ]}
                        >
                          {attempts > 0 ? `${Math.round(score)}%` : '—'}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>

              {extraPracticeCount > 0 && (
                <View style={styles.extraPracticeSection}>
                  <Text style={styles.extraPracticeTitle}>Needs Extra Practice</Text>
                  {items.filter(i => itemMastery[i.id]?.needsExtraPractice).map(item => (
                    <View key={item.id} style={styles.extraPracticeRow}>
                      <Zap size={14} color="#F59E0B" />
                      <Text style={styles.extraPracticeText}>{item.text}</Text>
                      <Text style={styles.extraPracticeScore}>Best: {itemMastery[item.id]?.bestScore ?? 0}%</Text>
                    </View>
                  ))}
                </View>
              )}

              <View style={styles.summaryActions}>
                {allItemsDone ? (
                  <Pressable
                    style={[styles.summaryButton, { backgroundColor: stage.color }]}
                    onPress={handleCompleteLesson}
                  >
                    <Trophy size={20} color="#FFFFFF" />
                    <Text style={styles.summaryButtonText}>Complete Lesson</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    style={[styles.summaryButton, { backgroundColor: stage.color }]}
                    onPress={handleContinueLater}
                  >
                    <Text style={styles.summaryButtonText}>Continue Later</Text>
                  </Pressable>
                )}
                <Pressable
                  style={styles.summarySecondaryButton}
                  onPress={handleRetry}
                >
                  <RefreshCw size={16} color={stage.color} />
                  <Text style={[styles.summarySecondaryText, { color: stage.color }]}>
                    Start Over
                  </Text>
                </Pressable>
                <Pressable style={styles.summarySecondaryButton} onPress={() => safeGoBack()}>
                  <Text style={styles.summarySecondaryText}>Exit Without Saving</Text>
                </Pressable>
              </View>
            </ScrollView>
          </Animated.View>
        </SafeAreaView>
      </View>
    );
  }

  if (!currentItem) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.errorContainer}>
          <Text style={styles.errorText}>No items available</Text>
          <Pressable onPress={() => safeGoBack()} style={styles.errorButton}>
            <Text style={styles.errorButtonText}>Go Back</Text>
          </Pressable>
        </SafeAreaView>
      </View>
    );
  }

  const currentItemMastery = itemMastery[currentItem.id];
  const currentAttempts = currentItemMastery?.attempts ?? 0;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.topBar}>
        <View style={styles.topBarInner}>
          <Pressable onPress={() => safeGoBack()} style={styles.closeButton}>
            <X size={22} color={Colors.text} />
          </Pressable>
          <View style={styles.topBarCenter}>
            <Text style={styles.topBarTitle} numberOfLines={1}>
              {lesson.title}
            </Text>
            <Text style={styles.topBarSub}>
              {lessonPhase === 'review' ? 'Review' : ''} {currentIndex + 1} of {practiceQueue.length}
              {currentAttempts > 0 ? ` · Attempt ${currentAttempts + 1}` : ''}
            </Text>
          </View>
          <View style={styles.topBarRight}>
            <Text style={styles.masteryBadge}>{masteredCount}/{items.length}</Text>
          </View>
        </View>
        <View style={styles.progressBarContainer}>
          <View
            style={[
              styles.progressBarFill,
              {
                width: `${((currentIndex + 1) / practiceQueue.length) * 100}%`,
                backgroundColor: stage.color,
              },
            ]}
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dotsRow}>
          {practiceQueue.map((item, idx) => {
            const isCurrent = idx === currentIndex;
            return (
              <Pressable
                key={`${item.id}-${idx}`}
                style={[
                  styles.dot,
                  { backgroundColor: getDotColor(item.id) },
                  isCurrent && { borderWidth: 2, borderColor: stage.color },
                ]}
                onPress={() => {
                  setCurrentIndex(idx);
                  resetAssessment();
                  setExpandedWord(null);
                }}
              />
            );
          })}
        </ScrollView>
      </SafeAreaView>

      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollInner}
        showsVerticalScrollIndicator={false}
      >
        {interactionMode === 'listen_identify' && !listenIdRevealed && (
          <View style={styles.modeCard}>
            <Headphones size={18} color={stage.color} />
            <Text style={[styles.modeCardText, { color: stage.color }]}>Listen & Identify</Text>
          </View>
        )}
        {interactionMode === 'shadowing' && (
          <View style={styles.modeCard}>
            <Zap size={18} color={stage.color} />
            <Text style={[styles.modeCardText, { color: stage.color }]}>Shadowing Mode</Text>
          </View>
        )}
        {interactionMode === 'standard' && lessonPhase === 'review' && (
          <View style={[styles.modeCard, { backgroundColor: '#FEF2F2' }]}>
            <RefreshCw size={18} color="#EF4444" />
            <Text style={[styles.modeCardText, { color: '#EF4444' }]}>Review — Focus on this sound</Text>
          </View>
        )}

        {interactionMode === 'listen_identify' && !listenIdRevealed ? (
          <View style={styles.listenIdSection}>
            <Pressable
              style={[styles.listenIdPlayBtn, { backgroundColor: stage.color }]}
              onPress={() => speak(currentItem.text)}
              disabled={isSpeaking}
            >
              <Volume2 size={28} color="#FFFFFF" />
              <Text style={styles.listenIdPlayText}>{isSpeaking ? 'Playing...' : 'Tap to Listen'}</Text>
            </Pressable>

            <Text style={styles.listenIdPrompt}>Which word did you hear?</Text>
            {listenIdChoices.map(choice => {
              const isSelected = listenIdSelected === choice.id;
              const isCorrect = choice.id === currentItem.id;
              const showResult = listenIdSelected !== null;
              return (
                <Pressable
                  key={choice.id}
                  style={[
                    styles.listenIdChoice,
                    isSelected && !showResult && { borderColor: stage.color, backgroundColor: `${stage.color}15` },
                    showResult && isCorrect && styles.listenIdChoiceCorrect,
                    showResult && isSelected && !isCorrect && styles.listenIdChoiceWrong,
                  ]}
                  onPress={() => !listenIdSelected && handleListenIdSelect(choice.id)}
                  disabled={listenIdSelected !== null}
                >
                  <Text style={[
                    styles.listenIdChoiceText,
                    showResult && isCorrect && { color: '#059669', fontWeight: '600' as const },
                    showResult && isSelected && !isCorrect && { color: '#DC2626' },
                  ]}>
                    {choice.text}
                  </Text>
                  {choice.meaning && (
                    <Text style={styles.listenIdChoiceMeaning}>{choice.meaning}</Text>
                  )}
                  {showResult && isCorrect && <Check size={18} color="#059669" />}
                  {showResult && isSelected && !isCorrect && <X size={18} color="#DC2626" />}
                </Pressable>
              );
            })}
          </View>
        ) : (
          <>
            <View style={styles.itemCard}>
              <View style={[styles.itemCardAccent, { backgroundColor: stage.color }]} />
              <View style={styles.itemCardBody}>
                {textHidden ? (
                  <Pressable onPress={() => setTextHidden(false)} style={styles.hiddenTextBtn}>
                    <EyeOff size={24} color={Colors.textMuted} />
                    <Text style={styles.hiddenTextLabel}>Tap to reveal text</Text>
                  </Pressable>
                ) : (
                  <>
                    <Text
                      style={[
                        styles.itemText,
                        currentItem.type === 'paragraph' && styles.itemTextSmall,
                        currentItem.type === 'sentence' && styles.itemTextMedium,
                      ]}
                    >
                      {currentItem.text}
                    </Text>
                    {currentItem.ipa ? (
                      <Text style={styles.itemIpa}>{currentItem.ipa}</Text>
                    ) : null}
                    {currentItem.meaning ? (
                      <Text style={styles.itemMeaning}>{currentItem.meaning}</Text>
                    ) : null}
                  </>
                )}
              </View>
            </View>

            <View style={styles.hintBox}>
              <Info size={14} color={stage.color} />
              <Text style={[styles.hintText, { color: stage.color }]}>{currentItem.hint}</Text>
            </View>

            <View style={styles.controlsRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.listenButton,
                  { backgroundColor: stage.color },
                  pressed && { opacity: 0.8 },
                  isSpeaking && { opacity: 0.6 },
                ]}
                onPress={() => speak(currentItem.text)}
                disabled={isSpeaking}
              >
                <Volume2 size={20} color="#FFFFFF" />
                <Text style={styles.listenButtonText}>
                  {isSpeaking ? 'Playing...' : 'Listen'}
                </Text>
              </Pressable>
            </View>

            <View style={styles.recordSection}>
              {interactionMode === 'shadowing' && !shadowingActive && !result ? (
                <Pressable
                  style={({ pressed }) => [
                    styles.shadowingBtn,
                    { backgroundColor: stage.color },
                    pressed && { opacity: 0.9 },
                  ]}
                  onPress={handleShadowingStart}
                  disabled={isSpeaking || isRecording}
                >
                  <Zap size={24} color="#FFFFFF" />
                  <Text style={styles.shadowingBtnText}>Shadow & Record</Text>
                  <Text style={styles.shadowingBtnSub}>Listen, then speak along</Text>
                </Pressable>
              ) : isAnalyzing ? (
                <View style={styles.analyzingContainer}>
                  <ActivityIndicator size="large" color={stage.color} />
                  <Text style={styles.analyzingText}>Analyzing pronunciation...</Text>
                </View>
              ) : isRecording ? (
                <View style={styles.recordingContainer}>
                  <Animated.View style={[styles.recordingPulse, { transform: [{ scale: pulseAnim }] }]}>
                    <Pressable style={styles.stopButton} onPress={handleStopRecording}>
                      <Square size={28} color="#FFFFFF" fill="#FFFFFF" />
                    </Pressable>
                  </Animated.View>
                  <Text style={styles.recordingText}>Recording... Tap to stop</Text>
                </View>
              ) : (
                <Pressable
                  style={({ pressed }) => [
                    styles.recordButton,
                    pressed && { transform: [{ scale: 0.95 }] },
                  ]}
                  onPress={handleStartRecording}
                >
                  <View style={[styles.recordButtonInner, { backgroundColor: stage.color }]}>
                    <Mic size={28} color="#FFFFFF" />
                    <Text style={styles.recordButtonText}>Record</Text>
                  </View>
                </Pressable>
              )}
            </View>
          </>
        )}

        {assessmentError && !result && (
          <View style={styles.errorBox}>
            <AlertTriangle size={16} color="#EF4444" />
            <Text style={styles.errorBoxText}>{assessmentError}</Text>
            <Pressable
              onPress={() => {
                resetAssessment();
              }}
              style={styles.errorRetryButton}
            >
              <Text style={[styles.errorRetryText, { color: stage.color }]}>Dismiss</Text>
            </Pressable>
          </View>
        )}

        {result && (
          <View style={styles.resultSection}>
            <View style={styles.resultHeader}>
              <Kiri
                mood={result.pronunciationScore >= 70 ? 'celebrating' : result.pronunciationScore >= 50 ? 'encouraging' : 'thinking'}
                size={70}
              />
            </View>

            <PronunciationFeedback
              result={result}
              targetText={currentItem.text}
              onTryAgain={() => {
                resetAssessment();
                setExpandedWord(null);
                if (interactionMode === 'shadowing') setShadowingActive(false);
              }}
              accentColor={stage.color}
            />

            {suggestions.length > 0 && (
              <View style={[styles.suggestionsBox, { borderLeftColor: stage.color }]}>
                <Text style={styles.suggestionsTitle}>Suggestions</Text>
                {suggestions.map((s, i) => (
                  <View key={i} style={styles.suggestionRow}>
                    <Star size={12} color={stage.color} />
                    <Text style={styles.suggestionText}>{s}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        <View style={styles.navRow}>
          <Pressable
            style={[styles.navButton, currentIndex === 0 && styles.navButtonDisabled]}
            onPress={goPrev}
            disabled={currentIndex === 0}
          >
            <ChevronLeft size={20} color={currentIndex === 0 ? '#D1D5DB' : stage.color} />
            <Text style={[styles.navButtonText, { color: currentIndex === 0 ? '#D1D5DB' : stage.color }]}>
              Previous
            </Text>
          </Pressable>

          <Pressable
            style={[styles.navButton, styles.navButtonNext]}
            onPress={goNext}
          >
            <Text style={[styles.navButtonText, { color: stage.color }]}>
              {currentIndex === practiceQueue.length - 1 ? 'Finish' : 'Next'}
            </Text>
            <ChevronRight size={20} color={stage.color} />
          </Pressable>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal
        visible={sessionBreakVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSessionBreakVisible(false)}
      >
        <View style={styles.breakOverlay}>
          <View style={styles.breakCard}>
            <View style={styles.breakIconWrap}>
              <Coffee size={28} color={stage.color} />
            </View>
            <Text style={styles.breakTitle}>Great Work!</Text>
            <Text style={styles.breakSub}>
              You've mastered {masteredCount}/{items.length} sounds. Take a breather?
            </Text>
            <View style={styles.breakBarTrack}>
              <View style={[styles.breakBarFill, { width: `${(masteredCount / items.length) * 100}%`, backgroundColor: stage.color }]} />
            </View>
            <Pressable
              style={[styles.breakKeepBtn, { backgroundColor: stage.color }]}
              onPress={() => {
                setSessionBreakVisible(false);
                if (currentIndex < practiceQueue.length - 1) {
                  setCurrentIndex(prev => prev + 1);
                  resetAssessment();
                  setExpandedWord(null);
                } else {
                  handlePhaseEnd();
                }
              }}
            >
              <Text style={styles.breakKeepText}>Keep Going</Text>
            </Pressable>
            <Pressable
              style={styles.breakPauseBtn}
              onPress={() => {
                setSessionBreakVisible(false);
                safeGoBack();
              }}
            >
              <Text style={styles.breakPauseText}>Take a Break</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFBF7',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    gap: 16,
  },
  errorText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  errorButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: Colors.primary,
    borderRadius: 10,
  },
  errorButtonText: {
    color: '#FFFFFF',
    fontWeight: '600' as const,
  },
  topBar: {
    backgroundColor: '#FFFBF7',
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  topBarInner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.backgroundSecondary,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  topBarCenter: {
    flex: 1,
    alignItems: 'center' as const,
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  topBarSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  topBarRight: {
    width: 44,
    alignItems: 'flex-end' as const,
  },
  masteryBadge: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#10B981',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: 'hidden' as const,
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 16,
    borderRadius: 2,
    overflow: 'hidden' as const,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  dotsRow: {
    flexDirection: 'row' as const,
    justifyContent: 'center' as const,
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E5E7EB',
  },
  scrollContent: {
    flex: 1,
  },
  scrollInner: {
    padding: 20,
  },
  modeCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    backgroundColor: '#F0FDFA',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 14,
    alignSelf: 'flex-start' as const,
  },
  modeCardText: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  listenIdSection: {
    gap: 12,
    marginBottom: 20,
  },
  listenIdPlayBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 10,
    paddingVertical: 24,
    borderRadius: 20,
  },
  listenIdPlayText: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  listenIdPrompt: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    textAlign: 'center' as const,
    marginTop: 4,
  },
  listenIdChoice: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  listenIdChoiceCorrect: {
    borderColor: '#10B981',
    backgroundColor: '#ECFDF5',
  },
  listenIdChoiceWrong: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  listenIdChoiceText: {
    flex: 1,
    fontSize: 17,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  listenIdChoiceMeaning: {
    fontSize: 13,
    color: Colors.textMuted,
    marginRight: 8,
  },
  hiddenTextBtn: {
    alignItems: 'center' as const,
    gap: 8,
    paddingVertical: 20,
  },
  hiddenTextLabel: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  itemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden' as const,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  itemCardAccent: {
    height: 4,
  },
  itemCardBody: {
    padding: 24,
    alignItems: 'center' as const,
  },
  itemText: {
    fontSize: 36,
    fontWeight: '700' as const,
    color: Colors.text,
    textAlign: 'center' as const,
    marginBottom: 8,
  },
  itemTextSmall: {
    fontSize: 20,
    lineHeight: 30,
    fontWeight: '500' as const,
    textAlign: 'left' as const,
    alignSelf: 'stretch' as const,
  },
  itemTextMedium: {
    fontSize: 24,
    lineHeight: 34,
    fontWeight: '600' as const,
  },
  itemIpa: {
    fontSize: 22,
    color: Colors.primary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 6,
  },
  itemMeaning: {
    fontSize: 14,
    color: Colors.textMuted,
    fontStyle: 'italic' as const,
  },
  hintBox: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 8,
    backgroundColor: '#F0FDFA',
    padding: 14,
    borderRadius: 12,
    marginBottom: 20,
  },
  hintText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  controlsRow: {
    alignItems: 'center' as const,
    marginBottom: 20,
  },
  listenButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 24,
  },
  listenButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  recordSection: {
    alignItems: 'center' as const,
    marginBottom: 24,
  },
  recordButton: {
    borderRadius: 60,
  },
  recordButtonInner: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  recordButtonText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    marginTop: 4,
  },
  shadowingBtn: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 24,
    paddingHorizontal: 32,
    borderRadius: 20,
    gap: 6,
  },
  shadowingBtnText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  shadowingBtnSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  recordingContainer: {
    alignItems: 'center' as const,
  },
  recordingPulse: {
    marginBottom: 12,
  },
  stopButton: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#EF4444',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  recordingText: {
    fontSize: 14,
    color: '#EF4444',
    fontWeight: '500' as const,
  },
  analyzingContainer: {
    alignItems: 'center' as const,
    padding: 32,
  },
  analyzingText: {
    marginTop: 14,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  resultSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  resultHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 14,
    marginBottom: 20,
  },
  suggestionsBox: {
    backgroundColor: '#F0FDFA',
    padding: 14,
    borderRadius: 12,
    borderLeftWidth: 3,
    marginBottom: 16,
  },
  suggestionsTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  suggestionRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 8,
    marginBottom: 6,
  },
  suggestionText: {
    flex: 1,
    fontSize: 13,
    color: Colors.text,
    lineHeight: 18,
  },
  navRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    paddingTop: 8,
  },
  navButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  navButtonDisabled: {
    opacity: 0.4,
  },
  navButtonNext: {},
  navButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
    flexWrap: 'wrap' as const,
  },
  errorBoxText: {
    flex: 1,
    fontSize: 13,
    color: '#991B1B',
    lineHeight: 18,
  },
  errorRetryButton: {
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  errorRetryText: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  summaryContainer: {
    flex: 1,
    justifyContent: 'center' as const,
    padding: 20,
  },
  summaryContent: {
    flex: 1,
  },
  summaryScroll: {
    paddingTop: 20,
    paddingBottom: 40,
  },
  summaryHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 16,
    marginBottom: 20,
  },
  summaryMasteryCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 6,
    borderColor: '#10B981',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  summaryMasteryNum: {
    fontSize: 28,
    fontWeight: '700' as const,
  },
  summaryMasteryLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: -2,
  },
  summaryTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.text,
    textAlign: 'center' as const,
    marginBottom: 6,
  },
  summarySubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    marginBottom: 24,
    lineHeight: 21,
  },
  warningBox: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    backgroundColor: '#FFFBEB',
    padding: 14,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: '#92400E',
    lineHeight: 18,
  },
  summaryItems: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  summaryItemsTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 12,
  },
  summaryItemRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  summaryItemDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  summaryItemDotText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  summaryItemText: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
  },
  summaryItemMeta: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  summaryItemAttempts: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  summaryItemScore: {
    fontSize: 14,
    fontWeight: '700' as const,
  },
  extraPracticeSection: {
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  extraPracticeTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#92400E',
    marginBottom: 10,
  },
  extraPracticeRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    paddingVertical: 6,
  },
  extraPracticeText: {
    flex: 1,
    fontSize: 14,
    color: '#92400E',
  },
  extraPracticeScore: {
    fontSize: 12,
    color: '#B45309',
    fontWeight: '600' as const,
  },
  summaryActions: {
    gap: 12,
    alignItems: 'center' as const,
  },
  summaryButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 14,
    width: '100%',
  },
  summaryButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  summarySecondaryButton: {
    paddingVertical: 10,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  summarySecondaryText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
  },
  breakOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  breakCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 28,
    marginHorizontal: 24,
    alignItems: 'center' as const,
    width: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 32,
    elevation: 15,
  },
  breakIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFF7ED',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 16,
  },
  breakTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 6,
  },
  breakSub: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    marginBottom: 16,
    lineHeight: 21,
  },
  breakBarTrack: {
    width: '100%',
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden' as const,
    marginBottom: 20,
  },
  breakBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  breakKeepBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center' as const,
    width: '100%',
    marginBottom: 10,
  },
  breakKeepText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  breakPauseBtn: {
    paddingVertical: 12,
    alignItems: 'center' as const,
    width: '100%',
  },
  breakPauseText: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
  },
});
