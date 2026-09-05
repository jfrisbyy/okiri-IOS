import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { safeGoBack } from '@/utils/navigation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import {
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Check,
  Lock,
  AlertTriangle,
  Target,
  BookOpen,
  Headphones,
  Mic,
  PenLine,
  Sparkles,
  Shield,
  AudioLines,
  Layers,
  Award,
  Volume2,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Zap,
  Brain,
  GraduationCap,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { USE_NATIVE_DRIVER } from '@/constants/animation';
import AnimatedProgressBar from '@/components/AnimatedProgressBar';
import { useApp } from '@/contexts/AppContext';
import { foundationLessons } from '@/mocks/content';
import { learningModules } from '@/mocks/modules';
import { ModuleId, GapCategory, GapItem, CEFRLevel } from '@/types';
import { getProgressivePhases, getNewlyUnlockedPhase, getPhaseDisplayName } from '@/utils/lessonPhases';
import {
  getGateAfterModule,
  isModuleGatedByProficiency,
  CEFR_LEVEL_NAMES,
  CEFR_LEVEL_COLORS,
  getCurrentCertifiedLevel,
  getNextTestableLevel,
} from '@/utils/proficiency';
import { pronStages, PRON_PASS_SCORE } from '@/data/foundationPronunciation';
import { useFrenchAudio } from '@/hooks/useFrenchAudio';
import { getCategoryStats, categoryLabels } from '@/utils/gapLessonGenerator';
import { classifyGapUrgency, formatUrgencyBadge } from '@/utils/gapScheduler';



const categoryColors: Record<GapCategory, string> = {
  vocabulary: Colors.primary,
  grammar: Colors.secondary,
  pronunciation: '#7C3AED',
  phrasing: Colors.warning,
  register: '#10B981',
};

const categoryOrder: GapCategory[] = ['vocabulary', 'grammar', 'pronunciation', 'phrasing', 'register'];

type QueueItemType = 'critical_review' | 'accent' | 'srs_review' | 'foundation' | 'proficiency_gate' | 'smart_lesson' | 'accent_upcoming' | 'review_checkpoint';

interface QueueItem {
  id: string;
  type: QueueItemType;
  title: string;
  description: string;
  color: string;
  badge?: string;
  badgeColor?: string;
  onPress: () => void;
}

function buildLessonQueue(
  pronFoundation: Record<string, { score?: number }>,
  completedFoundationIds: string[],
  isModuleUnlocked: (id: ModuleId) => boolean,
  proficiency: { certifiedLevels: CEFRLevel[] },
  gapSchedule: { critical: any[]; due: any[] },
  activeGaps: any[],
  moduleProgress: { completedModules: ModuleId[] },
  router: any,
): QueueItem[] {
  const queue: QueueItem[] = [];

  if (gapSchedule.critical.length > 0) {
    queue.push({
      id: 'critical-gaps',
      type: 'critical_review',
      title: 'Review Critical Gaps',
      description: `${gapSchedule.critical.length} gap${gapSchedule.critical.length !== 1 ? 's' : ''} falling behind`,
      color: '#DC2626',
      badge: 'Critical',
      badgeColor: '#DC2626',
      onPress: () => router.push('/gap-lesson?category=mixed' as any),
    });
  }

  type AccentLessonInfo = { stageId: string; lessonId: string; title: string; subtitle: string; stageColor: string };
  let nextAccentLesson: AccentLessonInfo | null = null;
  const upcomingAccentLessons: AccentLessonInfo[] = [];

  for (const stage of pronStages) {
    for (let i = 0; i < stage.lessons.length; i++) {
      const lesson = stage.lessons[i];
      const score = pronFoundation[lesson.id]?.score ?? 0;
      const passed = score >= PRON_PASS_SCORE;
      if (passed) continue;

      const prevPassed = i === 0 || (pronFoundation[stage.lessons[i - 1].id]?.score ?? 0) >= PRON_PASS_SCORE;
      if (i > 0 && !prevPassed) continue;

      const item = { stageId: stage.id, lessonId: lesson.id, title: lesson.title, subtitle: lesson.subtitle, stageColor: stage.color };
      if (!nextAccentLesson) {
        nextAccentLesson = item;
      } else if (upcomingAccentLessons.length < 2) {
        upcomingAccentLessons.push(item);
      }
    }
  }

  if (nextAccentLesson) {
    queue.push({
      id: `accent-${nextAccentLesson.lessonId}`,
      type: 'accent',
      title: nextAccentLesson.title,
      description: nextAccentLesson.subtitle,
      color: nextAccentLesson.stageColor,
      badge: 'New',
      badgeColor: nextAccentLesson.stageColor,
      onPress: () => router.push(`/pronunciation-lesson?lessonId=${nextAccentLesson!.lessonId}` as any),
    });
  }

  if (gapSchedule.due.length > 0) {
    queue.push({
      id: 'srs-review',
      type: 'srs_review',
      title: 'SRS Review',
      description: `${gapSchedule.due.length} item${gapSchedule.due.length !== 1 ? 's' : ''} due for review`,
      color: '#7C3AED',
      badge: 'Due',
      badgeColor: '#D97706',
      onPress: () => router.push('/gap-lesson' as any),
    });
  }

  const nextTestable = getNextTestableLevel(moduleProgress.completedModules, proficiency.certifiedLevels);
  let foundNextFoundation = false;
  for (const module of learningModules) {
    if (foundNextFoundation) break;
    const gatedByProficiency = isModuleGatedByProficiency(module.id, proficiency.certifiedLevels);
    if (gatedByProficiency) {
      queue.push({
        id: `gate-${module.id}`,
        type: 'proficiency_gate',
        title: `${module.cefrLevel} Proficiency Test`,
        description: `Pass to unlock ${module.title}`,
        color: CEFR_LEVEL_COLORS[module.cefrLevel]?.accent ?? Colors.primary,
        badge: 'Locked',
        badgeColor: '#D97706',
        onPress: () => {
          if (nextTestable) {
            router.push(`/proficiency-test?level=${nextTestable}` as any);
          }
        },
      });
      foundNextFoundation = true;
      break;
    }
    if (!isModuleUnlocked(module.id)) continue;
    const moduleLessons = foundationLessons.filter(l => l.moduleId === module.id);
    for (const lesson of moduleLessons) {
      if (completedFoundationIds.includes(lesson.id)) continue;
      const lessonIndex = moduleLessons.findIndex(l => l.id === lesson.id);
      const previousLessons = moduleLessons.slice(0, lessonIndex);
      const allPreviousCompleted = previousLessons.every(l => completedFoundationIds.includes(l.id));
      if (!allPreviousCompleted) continue;
      queue.push({
        id: `foundation-${lesson.id}`,
        type: 'foundation',
        title: lesson.title,
        description: `~${lesson.estimatedMinutes} min · ${module.cefrLevel}`,
        color: Colors.primary,
        badge: 'New',
        badgeColor: Colors.primary,
        onPress: () => router.push(`/foundation/${lesson.id}` as any),
      });
      foundNextFoundation = true;
      break;
    }
  }

  if (activeGaps.length >= 3) {
    queue.push({
      id: 'smart-lesson',
      type: 'smart_lesson',
      title: 'Smart Lesson',
      description: 'AI-powered lesson from your gaps',
      color: '#4338CA',
      onPress: () => router.push('/gap-lessons' as any),
    });
  }

  for (const upcoming of upcomingAccentLessons) {
    if (!upcoming) continue;
    queue.push({
      id: `accent-upcoming-${upcoming.lessonId}`,
      type: 'accent_upcoming',
      title: upcoming.title,
      description: upcoming.subtitle,
      color: upcoming.stageColor,
      onPress: () => router.push(`/pronunciation-lesson?lessonId=${upcoming.lessonId}` as any),
    });
  }

  return queue;
}

export default function LearnScreen() {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [showGapInsights, setShowGapInsights] = useState(false);
  const [selectedCategory, _setSelectedCategory] = useState<GapCategory | 'all'>('all');
  const [showMastered, setShowMastered] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const { speak } = useFrenchAudio();

  const {
    completedFoundationIds, moduleProgress, isModuleUnlocked,
    gapSchedule, proficiency, pronFoundation,
    gaps, activeGaps, masteredGaps, gapsByCategory, refreshGapConcepts, gapHealth,
  } = useApp();

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1, duration: 400, useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [fadeAnim]);

  const pronAllLessons = pronStages.flatMap(s => s.lessons);
  const pronCompletedCount = pronAllLessons.filter(l => (pronFoundation[l.id]?.score ?? 0) >= PRON_PASS_SCORE).length;
  const pronTotalCount = pronAllLessons.length;
  const totalLessons = foundationLessons.length;
  const completedCount = completedFoundationIds.length;
  const totalCompleted = pronCompletedCount + completedCount;
  const totalAll = pronTotalCount + totalLessons;

  const certifiedLevel = useMemo(() => getCurrentCertifiedLevel(proficiency.certifiedLevels), [proficiency.certifiedLevels]);
  const nextTestable = useMemo(() => getNextTestableLevel(moduleProgress.completedModules, proficiency.certifiedLevels), [moduleProgress.completedModules, proficiency.certifiedLevels]);

  const categoryStats = useMemo(() => getCategoryStats(gaps), [gaps]);

  const lessonQueue = useMemo(() => buildLessonQueue(
    pronFoundation, completedFoundationIds, isModuleUnlocked, proficiency,
    gapSchedule, activeGaps, moduleProgress, router,
  ), [pronFoundation, completedFoundationIds, isModuleUnlocked, proficiency, gapSchedule, activeGaps, moduleProgress, router]);

  const displayedGaps = useMemo(() => {
    if (selectedCategory === 'all') return activeGaps;
    return gapsByCategory[selectedCategory];
  }, [selectedCategory, activeGaps, gapsByCategory]);

  const handleRefreshConcepts = async () => {
    setIsRefreshing(true);
    setRefreshMessage(null);
    try {
      const count = await refreshGapConcepts(true);
      setRefreshMessage(`Refreshed ${count} gap${count !== 1 ? 's' : ''} with new content`);
      setTimeout(() => setRefreshMessage(null), 4000);
    } catch {
      setRefreshMessage('Failed to refresh. Please try again.');
      setTimeout(() => setRefreshMessage(null), 4000);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleStartLesson = useCallback((category: GapCategory | 'mixed') => {
    router.push(`/gap-lesson?category=${category}` as any);
  }, [router]);

  const getSourceIcon = useCallback((sourceType: string) => {
    if (sourceType === 'reading') return <BookOpen size={12} color={Colors.textMuted} />;
    if (sourceType === 'speech') return <Mic size={12} color={Colors.textMuted} />;
    return <Layers size={12} color={Colors.textMuted} />;
  }, []);

  const getQueueIcon = useCallback((type: QueueItemType, color: string) => {
    switch (type) {
      case 'critical_review': return <AlertTriangle size={22} color="#fff" />;
      case 'accent': return <AudioLines size={22} color="#fff" />;
      case 'accent_upcoming': return <AudioLines size={18} color={color} />;
      case 'srs_review': return <Brain size={22} color="#fff" />;
      case 'foundation': return <BookOpen size={22} color="#fff" />;
      case 'proficiency_gate': return <Shield size={22} color="#fff" />;
      case 'smart_lesson': return <Sparkles size={22} color="#fff" />;
      case 'review_checkpoint': return <RefreshCw size={16} color={color} />;
      default: return <Zap size={22} color="#fff" />;
    }
  }, []);

  const interleaved = useMemo(() => {
    const result: any[] = [];
    const maxPairs = Math.max(pronStages.length, learningModules.length);

    for (let i = 0; i < maxPairs; i++) {
      if (i < pronStages.length) {
        result.push({ type: 'stage' as const, data: pronStages[i] });
      }
      if (i < learningModules.length) {
        result.push({ type: 'module' as const, data: learningModules[i], moduleIndex: i });
      }
    }
    return result;
  }, []);

  const getLessonStatus = useCallback((lessonId: string, moduleId: ModuleId) => {
    if (completedFoundationIds.includes(lessonId)) return 'completed' as const;
    if (!isModuleUnlocked(moduleId)) return 'locked' as const;
    const moduleLessons = foundationLessons.filter(l => l.moduleId === moduleId);
    const lessonIndex = moduleLessons.findIndex(l => l.id === lessonId);
    const previousLessons = moduleLessons.slice(0, lessonIndex);
    const allPreviousCompleted = previousLessons.every(l => completedFoundationIds.includes(l.id));
    return allPreviousCompleted ? 'available' as const : 'locked' as const;
  }, [completedFoundationIds, isModuleUnlocked]);

  const criticalCount = gapSchedule.critical.length;
  const dueCount = gapSchedule.due.length;
  const healthScore = gapHealth.score ?? 0;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <LinearGradient
        colors={['#1B1B1B', '#111111']}
        style={styles.headerGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
          <View style={styles.headerNav}>
            <Pressable style={styles.backButton} onPress={() => safeGoBack()}>
              <ChevronLeft size={24} color="#fff" />
            </Pressable>
            <Text style={styles.headerTitle}>Your Path</Text>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.progressRow}>
            <View style={styles.progressStat}>
              {certifiedLevel ? (
                <View style={[styles.cefrBadge, { backgroundColor: CEFR_LEVEL_COLORS[certifiedLevel]?.bg ?? '#1a1a1a' }]}>
                  <Text style={[styles.cefrBadgeText, { color: CEFR_LEVEL_COLORS[certifiedLevel]?.accent ?? Colors.primary }]}>{certifiedLevel}</Text>
                </View>
              ) : (
                <View style={[styles.cefrBadge, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
                  <Text style={[styles.cefrBadgeText, { color: 'rgba(255,255,255,0.5)' }]}>--</Text>
                </View>
              )}
              <Text style={styles.progressStatLabel}>Level</Text>
            </View>

            <View style={styles.progressDivider} />

            <View style={styles.progressStat}>
              <Text style={styles.progressStatValue}>{totalCompleted}</Text>
              <Text style={styles.progressStatLabel}>Completed</Text>
            </View>

            <View style={styles.progressDivider} />

            <View style={styles.progressStat}>
              <Text style={[styles.progressStatValue, {
                color: healthScore >= 70 ? '#34D399' : healthScore >= 50 ? '#FBBF24' : healthScore > 0 ? '#F87171' : 'rgba(255,255,255,0.3)',
              }]}>{activeGaps.length > 0 ? `${healthScore}%` : '—'}</Text>
              <Text style={styles.progressStatLabel}>Health</Text>
            </View>
          </View>

          <View style={styles.progressBarRow}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${totalAll > 0 ? (totalCompleted / totalAll) * 100 : 0}%` }]} />
            </View>
            <Text style={styles.progressPercent}>{totalAll > 0 ? Math.round((totalCompleted / totalAll) * 100) : 0}%</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <Animated.View style={[styles.contentContainer, { opacity: fadeAnim }]}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {lessonQueue.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Zap size={16} color={Colors.primary} />
                <Text style={styles.sectionTitle}>Up Next</Text>
              </View>

              {lessonQueue.map((item, index) => {
                const isUpcoming = item.type === 'accent_upcoming';
                return (
                  <Pressable
                    key={item.id}
                    style={({ pressed }) => [
                      isUpcoming ? styles.queueCardSmall : styles.queueCard,
                      pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                    ]}
                    onPress={() => {
                      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      item.onPress();
                    }}
                    testID={`queue-item-${index}`}
                  >
                    <View style={[
                      isUpcoming ? styles.queueIconSmall : styles.queueIcon,
                      { backgroundColor: isUpcoming ? `${item.color}18` : item.color },
                    ]}>
                      {getQueueIcon(item.type, item.color)}
                    </View>
                    <View style={styles.queueContent}>
                      <View style={styles.queueTitleRow}>
                        <Text style={[
                          isUpcoming ? styles.queueTitleSmall : styles.queueTitle,
                        ]} numberOfLines={1}>{item.title}</Text>
                        {item.badge && (
                          <View style={[styles.queueBadge, { backgroundColor: `${item.badgeColor ?? item.color}18` }]}>
                            <Text style={[styles.queueBadgeText, { color: item.badgeColor ?? item.color }]}>{item.badge}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.queueDesc} numberOfLines={1}>{item.description}</Text>
                    </View>
                    <ChevronRight size={16} color={isUpcoming ? Colors.textMuted : Colors.textSecondary} />
                  </Pressable>
                );
              })}
            </View>
          )}

          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <GraduationCap size={16} color={Colors.secondary} />
              <Text style={styles.sectionTitle}>Your Journey</Text>
            </View>

            <Pressable
              style={({ pressed }) => [styles.accentIntroBanner, pressed && { opacity: 0.9 }]}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/accent-intro' as any);
              }}
            >
              <View style={styles.accentIntroIcon}>
                <AudioLines size={18} color="#0D9488" />
              </View>
              <View style={styles.accentIntroContent}>
                <Text style={styles.accentIntroTitle}>Why Accent First?</Text>
                <Text style={styles.accentIntroSub}>Understand the philosophy</Text>
              </View>
              <ChevronRight size={16} color="#0D9488" />
            </Pressable>

            {interleaved.map((entry, _entryIndex) => {
              if (entry.type === 'stage') {
                const stage = entry.data as typeof pronStages[0];
                const stageCompleted = stage.lessons.filter(
                  l => (pronFoundation[l.id]?.score ?? 0) >= PRON_PASS_SCORE
                ).length;
                const stageTotal = stage.lessons.length;
                const isStageComplete = stageCompleted >= stageTotal;

                return (
                  <View key={`stage-${stage.id}`} style={styles.journeyBlock}>
                    <View style={styles.journeyBlockHeader}>
                      <Text style={styles.journeyBlockEmoji}>{stage.icon}</Text>
                      <View style={styles.journeyBlockTitleContent}>
                        <Text style={styles.journeyBlockTitle}>{stage.title}</Text>
                        <Text style={styles.journeyBlockSubtitle}>{stage.subtitle}</Text>
                      </View>
                      <View style={[styles.journeyBadge, isStageComplete && styles.journeyBadgeComplete]}>
                        <Text style={[styles.journeyBadgeText, isStageComplete && styles.journeyBadgeTextComplete]}>
                          {stageCompleted}/{stageTotal}
                        </Text>
                      </View>
                    </View>
                    {stage.lessons.map((lesson, index) => {
                      const score = pronFoundation[lesson.id]?.score ?? 0;
                      const passed = score >= PRON_PASS_SCORE;
                      const prevPassed = index === 0 || (pronFoundation[stage.lessons[index - 1].id]?.score ?? 0) >= PRON_PASS_SCORE;
                      const isLocked = index > 0 && !prevPassed;

                      return (
                        <Pressable
                          key={lesson.id}
                          style={({ pressed }) => [
                            styles.journeyLessonCard,
                            passed && styles.journeyLessonPassed,
                            isLocked && styles.journeyLessonLocked,
                            pressed && !isLocked && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                          ]}
                          onPress={() => {
                            if (!isLocked) {
                              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                              router.push(`/pronunciation-lesson?lessonId=${lesson.id}` as any);
                            }
                          }}
                          disabled={isLocked}
                        >
                          <View style={[
                            styles.journeyLessonIcon,
                            passed && styles.journeyLessonIconPassed,
                            isLocked && styles.journeyLessonIconLocked,
                          ]}>
                            {passed ? (
                              <Check size={16} color="#fff" />
                            ) : isLocked ? (
                              <Lock size={14} color={Colors.textMuted} />
                            ) : (
                              <AudioLines size={16} color={stage.color} />
                            )}
                          </View>
                          <View style={styles.journeyLessonInfo}>
                            <Text style={[styles.journeyLessonTitle, isLocked && { color: Colors.textMuted }]}>{lesson.title}</Text>
                            <Text style={styles.journeyLessonSub}>{lesson.subtitle}</Text>
                            {score > 0 && !passed && (
                              <View style={styles.journeyScoreRow}>
                                <AnimatedProgressBar
                                  progress={score}
                                  color={stage.color}
                                  trackColor={Colors.border}
                                  height={3}
                                  borderRadius={1.5}
                                />
                                <Text style={[styles.journeyScoreText, { color: stage.color }]}>{score}%</Text>
                              </View>
                            )}
                          </View>
                          {!isLocked && <ChevronRight size={14} color={Colors.textMuted} />}
                        </Pressable>
                      );
                    })}
                  </View>
                );
              }

              if (entry.type === 'module') {
                const module = entry.data as typeof learningModules[0];
                const moduleIndex = (entry as any).moduleIndex as number;
                const moduleLessons = foundationLessons.filter(l => l.moduleId === module.id);
                const moduleUnlocked = isModuleUnlocked(module.id);
                const gatedByProficiency = isModuleGatedByProficiency(module.id, proficiency.certifiedLevels);
                const isCertified = proficiency.certifiedLevels.includes(module.cefrLevel);

                const prevModule = moduleIndex > 0 ? learningModules[moduleIndex - 1] : null;
                const gate = prevModule ? getGateAfterModule(prevModule.id) : null;
                const showGateCard = gate && gate.nextModule === module.id;
                const gatePassed = showGateCard && proficiency.certifiedLevels.includes(gate!.testLevel);
                const gateAvailable = showGateCard && nextTestable === gate!.testLevel;

                return (
                  <View key={`module-${module.id}`}>
                    {showGateCard && (
                      <Pressable
                        style={({ pressed }) => [
                          styles.proficiencyGateCard,
                          gatePassed && styles.proficiencyGateCardPassed,
                          !gatePassed && !gateAvailable && styles.proficiencyGateCardLocked,
                          pressed && gateAvailable && { opacity: 0.9 },
                        ]}
                        onPress={() => {
                          if (gateAvailable) {
                            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            router.push(`/proficiency-test?level=${gate!.testLevel}` as any);
                          }
                        }}
                        disabled={!gateAvailable && !gatePassed}
                      >
                        <View style={[
                          styles.gateIconContainer,
                          gatePassed && { backgroundColor: CEFR_LEVEL_COLORS[gate!.testLevel].bg },
                          gateAvailable && !gatePassed && { backgroundColor: CEFR_LEVEL_COLORS[gate!.testLevel].bg },
                        ]}>
                          {gatePassed ? (
                            <Check size={18} color={CEFR_LEVEL_COLORS[gate!.testLevel].accent} />
                          ) : (
                            <Shield size={18} color={gateAvailable ? CEFR_LEVEL_COLORS[gate!.testLevel].accent : Colors.textMuted} />
                          )}
                        </View>
                        <View style={styles.gateContent}>
                          <Text style={[
                            styles.gateTitle,
                            gatePassed && { color: CEFR_LEVEL_COLORS[gate!.testLevel].text },
                            gateAvailable && !gatePassed && { color: CEFR_LEVEL_COLORS[gate!.testLevel].text },
                          ]}>
                            {gate!.testLevel} Proficiency Test
                          </Text>
                          <Text style={styles.gateSubtitle}>
                            {gatePassed
                              ? `${CEFR_LEVEL_NAMES[gate!.testLevel]} certified ✓`
                              : gateAvailable
                              ? `Pass to unlock ${module.cefrLevel} content`
                              : `Complete previous modules first`}
                          </Text>
                        </View>
                        {gateAvailable && !gatePassed && (
                          <ChevronRight size={16} color={CEFR_LEVEL_COLORS[gate!.testLevel].accent} />
                        )}
                      </Pressable>
                    )}

                    {(dueCount > 0 || criticalCount > 0) && moduleIndex > 0 && moduleIndex % 2 === 0 && (
                      <Pressable
                        style={({ pressed }) => [styles.reviewCheckpoint, pressed && { opacity: 0.9 }]}
                        onPress={() => router.push('/gap-lesson' as any)}
                      >
                        <RefreshCw size={14} color={Colors.primary} />
                        <Text style={styles.reviewCheckpointText}>Review checkpoint — {criticalCount > 0 ? `${criticalCount} critical` : `${dueCount} due`}</Text>
                        <ChevronRight size={14} color={Colors.textMuted} />
                      </Pressable>
                    )}

                    <View style={styles.journeyBlock}>
                      <View style={styles.journeyBlockHeader}>
                        <View style={[styles.journeyModuleLevelBadge, gatedByProficiency && { backgroundColor: '#FEF3C7' }]}>
                          {gatedByProficiency && <Lock size={10} color={Colors.textMuted} />}
                          <Text style={[styles.journeyModuleLevelText, !moduleUnlocked && { color: Colors.textMuted }]}>{module.cefrLevel}</Text>
                        </View>
                        <View style={styles.journeyBlockTitleContent}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={styles.journeyBlockTitle}>{module.title}</Text>
                            {isCertified && <Shield size={12} color={CEFR_LEVEL_COLORS[module.cefrLevel].accent} />}
                          </View>
                          <Text style={styles.journeyBlockSubtitle}>{module.subtitle}</Text>
                        </View>
                      </View>

                      {moduleLessons.map((lesson, index) => {
                        const status = getLessonStatus(lesson.id, module.id);
                        const phases = getProgressivePhases(lesson.order, lesson.phases);

                        return (
                          <Pressable
                            key={lesson.id}
                            style={({ pressed }) => [
                              styles.journeyLessonCard,
                              status === 'completed' && styles.journeyLessonPassed,
                              status === 'locked' && styles.journeyLessonLocked,
                              pressed && status !== 'locked' && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                            ]}
                            onPress={() => {
                              if (status !== 'locked') {
                                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                router.push(`/foundation/${lesson.id}` as any);
                              }
                            }}
                            disabled={status === 'locked'}
                          >
                            <View style={[
                              styles.journeyLessonIcon,
                              status === 'completed' && styles.journeyLessonIconPassed,
                              status === 'locked' && styles.journeyLessonIconLocked,
                            ]}>
                              {status === 'completed' ? (
                                <Check size={16} color="#fff" />
                              ) : status === 'locked' ? (
                                <Lock size={14} color={Colors.textMuted} />
                              ) : (
                                <MessageCircle size={16} color={Colors.primary} />
                              )}
                            </View>
                            <View style={styles.journeyLessonInfo}>
                              <Text style={[styles.journeyLessonTitle, status === 'locked' && { color: Colors.textMuted }]}>
                                {String(index + 1).padStart(2, '0')} – {lesson.title}
                              </Text>
                              <Text style={styles.journeyLessonSub}>~{lesson.estimatedMinutes} min</Text>
                              <View style={styles.journeyPhaseRow}>
                                {phases.map((phase) => {
                                  const phaseIcons: Record<string, React.ReactNode> = {
                                    learn: <BookOpen size={9} color={Colors.primary} />,
                                    listen: <Headphones size={9} color="#8B5CF6" />,
                                    read: <BookOpen size={9} color="#10B981" />,
                                    speak: <Mic size={9} color="#F59E0B" />,
                                    write: <PenLine size={9} color="#06B6D4" />,
                                  };
                                  return (
                                    <View key={phase} style={styles.journeyPhasePill}>
                                      {phaseIcons[phase] || null}
                                    </View>
                                  );
                                })}
                                {getNewlyUnlockedPhase(lesson.order) && status !== 'completed' && status !== 'locked' && (
                                  <View style={styles.newPhaseBadge}>
                                    <Text style={styles.newPhaseBadgeText}>New: {getPhaseDisplayName(getNewlyUnlockedPhase(lesson.order)!)}</Text>
                                  </View>
                                )}
                              </View>
                            </View>
                            {status !== 'locked' && <ChevronRight size={14} color={Colors.textMuted} />}
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                );
              }

              return null;
            })}
          </View>

          <View style={styles.section}>
            <Pressable
              style={styles.sectionHeaderPressable}
              onPress={() => setShowGapInsights(!showGapInsights)}
            >
              <View style={styles.sectionHeaderRow}>
                <Layers size={16} color="#7C3AED" />
                <Text style={styles.sectionTitle}>Gap Insights</Text>
              </View>
              <View style={styles.gapInsightsBadge}>
                <Text style={styles.gapInsightsBadgeText}>{activeGaps.length} active</Text>
              </View>
              {showGapInsights ? <ChevronUp size={16} color={Colors.textMuted} /> : <ChevronDown size={16} color={Colors.textMuted} />}
            </Pressable>

            {showGapInsights && (
              <View style={styles.gapInsightsBody}>
                <View style={styles.gapStatsRow}>
                  <View style={styles.gapStatBox}>
                    <Target size={14} color={Colors.primary} />
                    <Text style={styles.gapStatValue}>{activeGaps.length}</Text>
                    <Text style={styles.gapStatLabel}>Active</Text>
                  </View>
                  <View style={styles.gapStatDivider} />
                  <View style={styles.gapStatBox}>
                    <Award size={14} color={Colors.success} />
                    <Text style={styles.gapStatValue}>{masteredGaps.length}</Text>
                    <Text style={styles.gapStatLabel}>Mastered</Text>
                  </View>
                  <View style={styles.gapStatDivider} />
                  <View style={styles.gapStatBox}>
                    <View style={[
                      styles.gapHealthDotInline,
                      { backgroundColor: healthScore >= 70 ? Colors.success : healthScore >= 50 ? '#D97706' : healthScore > 0 ? '#DC2626' : Colors.border },
                    ]} />
                    <Text style={styles.gapStatValue}>{activeGaps.length > 0 ? `${healthScore}%` : '—'}</Text>
                    <Text style={styles.gapStatLabel}>Health</Text>
                  </View>
                </View>

                <View style={styles.categoriesRow}>
                  {categoryOrder.map((category) => {
                    const stats = categoryStats[category];
                    const hasGaps = stats.active > 0;
                    return (
                      <Pressable
                        key={category}
                        style={[
                          styles.categoryChip,
                          !hasGaps && { opacity: 0.4 },
                        ]}
                        onPress={() => {
                          if (hasGaps) {
                            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            handleStartLesson(category);
                          }
                        }}
                        disabled={!hasGaps}
                      >
                        <View style={[styles.categoryChipDot, { backgroundColor: categoryColors[category] }]} />
                        <Text style={styles.categoryChipLabel}>{categoryLabels[category]}</Text>
                        <Text style={styles.categoryChipCount}>{stats.active}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                {activeGaps.length > 0 && (
                  <Pressable
                    style={[styles.refreshButton, isRefreshing && { opacity: 0.6 }]}
                    onPress={handleRefreshConcepts}
                    disabled={isRefreshing}
                  >
                    {isRefreshing ? (
                      <ActivityIndicator size="small" color={Colors.primary} />
                    ) : (
                      <RefreshCw size={13} color={Colors.primary} />
                    )}
                    <Text style={styles.refreshButtonText}>
                      {isRefreshing ? 'Generating...' : 'Refresh Questions'}
                    </Text>
                  </Pressable>
                )}

                {refreshMessage && (
                  <View style={styles.refreshMessageContainer}>
                    <Text style={styles.refreshMessage}>{refreshMessage}</Text>
                  </View>
                )}

                {displayedGaps.length > 0 && (
                  <View style={styles.gapListSection}>
                    <Text style={styles.gapListTitle}>Recent Gaps</Text>
                    {displayedGaps.slice(0, 5).map((gap) => (
                      <GapCardItem key={gap.id} gap={gap} onSpeak={speak} getSourceIcon={getSourceIcon} />
                    ))}
                    {displayedGaps.length > 5 && (
                      <Text style={styles.moreGapsText}>+{displayedGaps.length - 5} more gaps</Text>
                    )}
                  </View>
                )}

                {masteredGaps.length > 0 && (
                  <View style={styles.masteredSection}>
                    <Pressable style={styles.masteredHeader} onPress={() => setShowMastered(!showMastered)}>
                      <View style={styles.masteredHeaderLeft}>
                        <Award size={14} color={Colors.success} />
                        <Text style={styles.masteredTitle}>Mastered ({masteredGaps.length})</Text>
                      </View>
                      {showMastered ? <ChevronUp size={16} color={Colors.textMuted} /> : <ChevronDown size={16} color={Colors.textMuted} />}
                    </Pressable>
                    {showMastered && (
                      <View style={styles.masteredList}>
                        {masteredGaps.map((gap) => (
                          <View key={gap.id} style={styles.masteredItem}>
                            <Text style={styles.masteredFrench}>{gap.frenchWord}</Text>
                            <Text style={styles.masteredEnglish}>{gap.englishTranslation}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}
          </View>

          <View style={{ height: 50 }} />
        </ScrollView>
      </Animated.View>
    </View>
  );
}

function GapCardItem({
  gap,
  onSpeak,
  getSourceIcon,
}: {
  gap: GapItem;
  onSpeak: (text: string) => void;
  getSourceIcon: (type: string) => React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const streakDisplay = `${gap.consecutiveCorrect}/5`;
  const streakProgress = gap.consecutiveCorrect / 5;
  const streakColor = gap.consecutiveCorrect >= 3 ? Colors.success :
                      gap.consecutiveCorrect >= 1 ? Colors.warning : Colors.border;

  const urgencyInfo = useMemo(() => classifyGapUrgency(gap), [gap]);
  const urgencyBadgeText = formatUrgencyBadge(urgencyInfo.urgency, urgencyInfo.daysOverdue);
  const showUrgencyBadge = urgencyInfo.urgency === 'critical' || urgencyInfo.urgency === 'due';

  const canonicalExamples = gap.conceptData?.canonicalExamples || [];
  const hasMoreContent = gap.explanation || gap.exampleTranslation || canonicalExamples.length > 0;

  return (
    <View style={styles.gapCard}>
      <Pressable onPress={() => setExpanded(!expanded)} style={styles.gapCardMain}>
        <View style={styles.gapTop}>
          <View style={[styles.gapCategoryDot, { backgroundColor: categoryColors[gap.category] }]} />
          <Text style={styles.gapFrench}>{gap.frenchWord}</Text>
          <View style={styles.gapActions}>
            <Pressable
              style={styles.audioButton}
              onPress={(e) => { e.stopPropagation(); onSpeak(gap.frenchWord); }}
            >
              <Volume2 size={14} color={Colors.primary} />
            </Pressable>
            {hasMoreContent && (expanded ? <ChevronUp size={14} color={Colors.textMuted} /> : <ChevronDown size={14} color={Colors.textMuted} />)}
          </View>
        </View>
        <Text style={styles.gapEnglish}>{gap.englishTranslation}</Text>
        <Pressable
          style={styles.exampleRow}
          onPress={(e) => { e.stopPropagation(); onSpeak(gap.exampleSentence); }}
        >
          <Text style={styles.gapExample} numberOfLines={expanded ? undefined : 2}>{gap.exampleSentence}</Text>
          <Volume2 size={12} color={Colors.textMuted} />
        </Pressable>
        <View style={styles.gapBottom}>
          <View style={styles.gapBottomLeft}>
            <View style={styles.sourceTag}>
              {getSourceIcon(gap.sourceType)}
              <Text style={styles.sourceText}>{gap.sourceType}</Text>
            </View>
            {showUrgencyBadge && (
              <View style={[styles.urgencyTag, { backgroundColor: `${urgencyInfo.color}15` }]}>
                <View style={[styles.urgencyTagDot, { backgroundColor: urgencyInfo.color }]} />
                <Text style={[styles.urgencyTagText, { color: urgencyInfo.color }]}>{urgencyBadgeText}</Text>
              </View>
            )}
          </View>
          <View style={styles.streakContainer}>
            <View style={styles.streakBar}>
              <View style={[styles.streakFill, { width: `${streakProgress * 100}%`, backgroundColor: streakColor }]} />
            </View>
            <Text style={[styles.streakText, { color: streakColor }]}>{streakDisplay}</Text>
          </View>
        </View>
      </Pressable>
      {expanded && (
        <View style={styles.expandedContent}>
          {gap.exampleTranslation && (
            <View style={styles.infoBox}>
              <Text style={styles.infoLabel}>Translation</Text>
              <Text style={styles.infoText}>{gap.exampleTranslation}</Text>
            </View>
          )}
          {gap.explanation && (
            <View style={styles.infoBox}>
              <Text style={styles.infoLabel}>Explanation</Text>
              <Text style={styles.infoText}>{gap.explanation}</Text>
            </View>
          )}
          {gap.conceptData?.teachingFocus && (
            <View style={[styles.infoBox, { backgroundColor: Colors.primaryLight }]}>
              <Text style={styles.infoLabel}>Key concept</Text>
              <Text style={styles.infoText}>{gap.conceptData.teachingFocus}</Text>
            </View>
          )}
          {canonicalExamples.length > 0 && (
            <View style={styles.examplesSection}>
              <Text style={styles.infoLabel}>More examples</Text>
              {canonicalExamples.map((example, index) => (
                <Pressable key={index} style={styles.exampleItem} onPress={() => onSpeak(example.french)}>
                  <View style={styles.exampleItemRow}>
                    <Text style={styles.exampleFrench}>{example.french}</Text>
                    <Volume2 size={12} color={Colors.primary} />
                  </View>
                  <Text style={styles.exampleEnglish}>{example.english}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F0F',
  },
  headerGradient: {
    paddingBottom: 0,
  },
  headerSafeArea: {},
  headerNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  headerSpacer: {
    width: 40,
  },

  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 12,
    gap: 16,
  },
  progressStat: {
    alignItems: 'center',
    gap: 4,
  },
  progressStatValue: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  progressStatLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.45)',
    fontWeight: '500' as const,
  },
  progressDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  cefrBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  cefrBadgeText: {
    fontSize: 14,
    fontWeight: '700' as const,
  },
  progressBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 18,
    gap: 10,
  },
  progressTrack: {
    flex: 1,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2.5,
    backgroundColor: Colors.primary,
  },
  progressPercent: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.5)',
    minWidth: 32,
    textAlign: 'right',
  },

  contentContainer: {
    flex: 1,
    backgroundColor: '#0F0F0F',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 20,
  },

  section: {
    marginBottom: 28,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#EBEBEB',
  },
  sectionHeaderPressable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  gapInsightsBadge: {
    backgroundColor: 'rgba(124,58,237,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginLeft: 'auto',
    marginRight: 6,
  },
  gapInsightsBadgeText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#A78BFA',
  },
  gapInsightsBody: {
    marginTop: 10,
    gap: 14,
  },

  queueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#252525',
  },
  queueCardSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141414',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1E1E1E',
  },
  queueIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  queueIconSmall: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  queueContent: {
    flex: 1,
  },
  queueTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  queueTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#F0F0F0',
    flex: 1,
  },
  queueTitleSmall: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: 'rgba(240,240,240,0.6)',
    flex: 1,
  },
  queueBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  queueBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  queueDesc: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
  },

  accentIntroBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#132220',
    borderRadius: 12,
    padding: 12,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#1A3330',
  },
  accentIntroIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#1A3330',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  accentIntroContent: {
    flex: 1,
  },
  accentIntroTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#5EEAD4',
  },
  accentIntroSub: {
    fontSize: 11,
    color: '#2DD4BF',
    marginTop: 1,
  },

  journeyBlock: {
    marginBottom: 22,
  },
  journeyBlockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  journeyBlockEmoji: {
    fontSize: 18,
  },
  journeyBlockTitleContent: {
    flex: 1,
  },
  journeyBlockTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#E5E5E5',
  },
  journeyBlockSubtitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
    marginTop: 1,
  },
  journeyBadge: {
    backgroundColor: '#1E1E1E',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  journeyBadgeComplete: {
    backgroundColor: '#064E3B',
  },
  journeyBadgeText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.4)',
  },
  journeyBadgeTextComplete: {
    color: '#34D399',
  },
  journeyModuleLevelBadge: {
    backgroundColor: '#1E1E1E',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  journeyModuleLevelText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.primary,
  },

  journeyLessonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161616',
    borderRadius: 12,
    padding: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#1E1E1E',
  },
  journeyLessonPassed: {
    borderColor: '#064E3B',
    backgroundColor: '#0A1F1A',
  },
  journeyLessonLocked: {
    opacity: 0.45,
  },
  journeyLessonIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#1E1E1E',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  journeyLessonIconPassed: {
    backgroundColor: Colors.success,
  },
  journeyLessonIconLocked: {
    backgroundColor: '#1A1A1A',
  },
  journeyLessonInfo: {
    flex: 1,
  },
  journeyLessonTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#D4D4D4',
    marginBottom: 1,
  },
  journeyLessonSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.3)',
  },
  journeyScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 5,
  },
  journeyScoreText: {
    fontSize: 10,
    fontWeight: '600' as const,
    minWidth: 26,
  },
  journeyPhaseRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 4,
  },
  journeyPhasePill: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#1E1E1E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  newPhaseBadge: {
    backgroundColor: '#1E3A5F',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 4,
  },
  newPhaseBadgeText: {
    fontSize: 8,
    fontWeight: '600' as const,
    color: '#60A5FA',
  },

  proficiencyGateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161616',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#1E3A5F',
  },
  proficiencyGateCardPassed: {
    borderColor: '#064E3B',
    backgroundColor: '#0A1F1A',
  },
  proficiencyGateCardLocked: {
    borderColor: '#252525',
    opacity: 0.5,
  },
  gateIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#1E1E1E',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  gateContent: {
    flex: 1,
  },
  gateTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#D4D4D4',
    marginBottom: 2,
  },
  gateSubtitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
  },

  reviewCheckpoint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1A1510',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#2A2010',
  },
  reviewCheckpointText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500' as const,
    color: Colors.primary,
  },

  gapStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161616',
    borderRadius: 12,
    padding: 14,
    gap: 14,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#1E1E1E',
  },
  gapStatBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  gapStatValue: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: '#E5E5E5',
  },
  gapStatLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
  },
  gapStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#252525',
  },
  gapHealthDotInline: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  categoriesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#161616',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#1E1E1E',
  },
  categoryChipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  categoryChipLabel: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: '#C4C4C4',
  },
  categoryChipCount: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.35)',
  },

  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#161616',
    borderRadius: 8,
    paddingVertical: 9,
    gap: 6,
    borderWidth: 1,
    borderColor: '#1E1E1E',
  },
  refreshButtonText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '500' as const,
  },
  refreshMessageContainer: {
    padding: 10,
    backgroundColor: '#0A1F1A',
    borderRadius: 8,
  },
  refreshMessage: {
    color: '#34D399',
    fontSize: 12,
    textAlign: 'center',
  },

  gapListSection: {
    gap: 8,
  },
  gapListTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 4,
  },
  gapCard: {
    backgroundColor: '#161616',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1E1E1E',
  },
  gapCardMain: {
    padding: 12,
  },
  gapTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  gapCategoryDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 8,
  },
  gapFrench: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  gapActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  audioButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#2A1A10',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gapEnglish: {
    fontSize: 13,
    color: '#C4C4C4',
    marginBottom: 8,
    marginLeft: 15,
  },
  exampleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#0F0F0F',
    borderRadius: 6,
    padding: 8,
    marginBottom: 8,
  },
  gapExample: {
    flex: 1,
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
    fontStyle: 'italic',
    lineHeight: 17,
  },
  gapBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gapBottomLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  sourceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  sourceText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.3)',
    textTransform: 'capitalize',
  },
  urgencyTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  urgencyTagDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  urgencyTagText: {
    fontSize: 9,
    fontWeight: '600' as const,
  },
  streakContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  streakBar: {
    width: 36,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#252525',
    overflow: 'hidden',
  },
  streakFill: {
    height: '100%',
    borderRadius: 1.5,
  },
  streakText: {
    fontSize: 10,
    fontWeight: '600' as const,
  },
  expandedContent: {
    padding: 12,
    paddingTop: 0,
    gap: 8,
  },
  infoBox: {
    backgroundColor: '#0F0F0F',
    borderRadius: 6,
    padding: 8,
  },
  infoLabel: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.35)',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 3,
  },
  infoText: {
    fontSize: 12,
    color: '#C4C4C4',
    lineHeight: 17,
  },
  examplesSection: {
    gap: 6,
  },
  exampleItem: {
    backgroundColor: '#0F0F0F',
    borderRadius: 6,
    padding: 8,
  },
  exampleItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  exampleFrench: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.primary,
  },
  exampleEnglish: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
  },
  moreGapsText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
    textAlign: 'center',
    paddingVertical: 8,
  },
  masteredSection: {
    backgroundColor: '#161616',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1E1E1E',
  },
  masteredHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  masteredHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  masteredTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#D4D4D4',
  },
  masteredList: {
    padding: 12,
    paddingTop: 0,
    gap: 6,
  },
  masteredItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#1E1E1E',
  },
  masteredFrench: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: '#34D399',
  },
  masteredEnglish: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
  },
});
