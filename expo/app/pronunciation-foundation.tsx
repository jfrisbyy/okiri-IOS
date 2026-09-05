import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Animated,
  Dimensions,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { safeGoBack } from '@/utils/navigation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Lock,
  Play,
  Trophy,
  AudioLines,
  Star,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { USE_NATIVE_DRIVER } from '@/constants/animation';
import AnimatedProgressBar from '@/components/AnimatedProgressBar';
import { useApp } from '@/contexts/AppContext';
import { pronStages, PRON_PASS_SCORE, PronStage, PronLesson } from '@/data/foundationPronunciation';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function PronunciationFoundationScreen() {
  const router = useRouter();
  const { pronFoundation } = useApp();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [expandedStage, setExpandedStage] = useState<string | null>(null);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [fadeAnim]);

  useEffect(() => {
    const firstIncomplete = pronStages.find((stage, idx) => {
      if (!isStageUnlocked(idx)) return false;
      const progress = getStageProgress(stage);
      return progress.completed < progress.total;
    });
    if (firstIncomplete) {
      setExpandedStage(firstIncomplete.id);
    }
  }, []);

  const isStageUnlocked = useCallback((stageIndex: number): boolean => {
    if (stageIndex === 0) return true;
    const prevStage = pronStages[stageIndex - 1];
    return prevStage.lessons.every(
      l => (pronFoundation[l.id]?.score ?? 0) >= l.passScore
    );
  }, [pronFoundation]);

  const getStageProgress = useCallback((stage: PronStage) => {
    const completed = stage.lessons.filter(
      l => (pronFoundation[l.id]?.score ?? 0) >= l.passScore
    ).length;
    return { completed, total: stage.lessons.length };
  }, [pronFoundation]);

  const isLessonPassed = useCallback((lesson: PronLesson): boolean => {
    return (pronFoundation[lesson.id]?.score ?? 0) >= lesson.passScore;
  }, [pronFoundation]);

  const isLessonAvailable = useCallback((stageIndex: number, lessonIndex: number): boolean => {
    if (!isStageUnlocked(stageIndex)) return false;
    if (lessonIndex === 0) return true;
    const prevLesson = pronStages[stageIndex].lessons[lessonIndex - 1];
    return isLessonPassed(prevLesson);
  }, [isStageUnlocked, isLessonPassed]);

  const overallProgress = useMemo(() => {
    const allLessons = pronStages.flatMap(s => s.lessons);
    const passed = allLessons.filter(l => (pronFoundation[l.id]?.score ?? 0) >= l.passScore).length;
    return { passed, total: allLessons.length };
  }, [pronFoundation]);

  const isComplete = overallProgress.passed >= overallProgress.total;

  const handleLessonPress = useCallback((stageId: string, lessonId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push(`/pronunciation-lesson?stageId=${stageId}&lessonId=${lessonId}` as any);
  }, [router]);

  const toggleStage = useCallback((stageId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedStage(prev => prev === stageId ? null : stageId);
  }, []);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <LinearGradient
        colors={['#0D9488', '#14B8A6']}
        style={styles.headerGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
          <View style={styles.headerNav}>
            <Pressable style={styles.backButton} onPress={() => safeGoBack()}>
              <ChevronLeft size={24} color="#FFFFFF" />
            </Pressable>
            <Text style={styles.headerTitle}>Accent Foundation</Text>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.headerContent}>
            <View style={styles.headerIconRow}>
              <View style={styles.headerIcon}>
                <AudioLines size={32} color="#0D9488" />
              </View>
              {isComplete && (
                <View style={styles.completeBadge}>
                  <Trophy size={14} color="#D97706" />
                  <Text style={styles.completeBadgeText}>Complete</Text>
                </View>
              )}
            </View>
            <Text style={styles.headerSubtitle}>
              Master every French sound before your first word
            </Text>
            <View style={styles.progressRow}>
              <AnimatedProgressBar
                progress={(overallProgress.passed / overallProgress.total) * 100}
                color="#FFFFFF"
                trackColor="rgba(255,255,255,0.25)"
                height={6}
                borderRadius={3}
                style={{ flex: 1 }}
                delay={200}
              />
              <Text style={styles.progressText}>
                {overallProgress.passed}/{overallProgress.total}
              </Text>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <Animated.View style={[styles.contentContainer, { opacity: fadeAnim }]}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {pronStages.map((stage, stageIndex) => {
            const unlocked = isStageUnlocked(stageIndex);
            const progress = getStageProgress(stage);
            const isExpanded = expandedStage === stage.id;
            const stageComplete = progress.completed >= progress.total;

            return (
              <View key={stage.id}>
                {stageIndex > 0 && (
                  <View style={styles.connector}>
                    <View
                      style={[
                        styles.connectorLine,
                        unlocked
                          ? { backgroundColor: pronStages[stageIndex - 1].color }
                          : { backgroundColor: '#E5E7EB' },
                      ]}
                    />
                  </View>
                )}

                <Pressable
                  style={({ pressed }) => [
                    styles.stageCard,
                    !unlocked && styles.stageCardLocked,
                    isExpanded && styles.stageCardExpanded,
                    pressed && unlocked && { opacity: 0.92 },
                  ]}
                  onPress={() => unlocked && toggleStage(stage.id)}
                  disabled={!unlocked}
                >
                  <View style={styles.stageHeader}>
                    <View
                      style={[
                        styles.stageNumber,
                        { backgroundColor: unlocked ? stage.color : '#D1D5DB' },
                      ]}
                    >
                      {stageComplete ? (
                        <Check size={18} color="#FFFFFF" />
                      ) : unlocked ? (
                        <Text style={styles.stageNumberText}>{stage.order}</Text>
                      ) : (
                        <Lock size={14} color="#FFFFFF" />
                      )}
                    </View>

                    <View style={styles.stageInfo}>
                      <View style={styles.stageTitleRow}>
                        <Text
                          style={[
                            styles.stageTitle,
                            !unlocked && styles.stageTitleLocked,
                          ]}
                        >
                          {stage.title}
                        </Text>
                        <Text style={styles.stageIcon}>{stage.icon}</Text>
                      </View>
                      <Text
                        style={[
                          styles.stageSubtitle,
                          !unlocked && styles.stageSubtitleLocked,
                        ]}
                      >
                        {stage.subtitle}
                      </Text>

                      {unlocked && (
                        <View style={styles.stageProgressRow}>
                          <AnimatedProgressBar
                            progress={(progress.completed / progress.total) * 100}
                            color={stage.color}
                            trackColor="#E5E7EB"
                            height={4}
                            borderRadius={2}
                            style={{ flex: 1 }}
                            delay={100 + stageIndex * 80}
                          />
                          <Text style={[styles.stageProgressText, { color: stage.color }]}>
                            {progress.completed}/{progress.total}
                          </Text>
                        </View>
                      )}
                    </View>

                    {unlocked && (
                      <ChevronRight
                        size={18}
                        color={Colors.textMuted}
                        style={{
                          transform: [{ rotate: isExpanded ? '90deg' : '0deg' }],
                        }}
                      />
                    )}
                  </View>

                  {!unlocked && (
                    <Text style={styles.lockedText}>
                      Complete {pronStages[stageIndex - 1].title} to unlock
                    </Text>
                  )}
                </Pressable>

                {isExpanded && unlocked && (
                  <View style={styles.lessonsContainer}>
                    <Text style={styles.stageDescription}>{stage.description}</Text>
                    {stage.lessons.map((lesson, lessonIndex) => {
                      const passed = isLessonPassed(lesson);
                      const available = isLessonAvailable(stageIndex, lessonIndex);
                      const score = pronFoundation[lesson.id]?.score;
                      const attempts = pronFoundation[lesson.id]?.attempts ?? 0;

                      return (
                        <Pressable
                          key={lesson.id}
                          style={({ pressed }) => [
                            styles.lessonRow,
                            !available && styles.lessonRowLocked,
                            pressed && available && { opacity: 0.85 },
                          ]}
                          onPress={() =>
                            available && handleLessonPress(stage.id, lesson.id)
                          }
                          disabled={!available}
                        >
                          <View
                            style={[
                              styles.lessonDot,
                              passed
                                ? { backgroundColor: stage.color }
                                : available
                                ? { borderColor: stage.color, borderWidth: 2 }
                                : { backgroundColor: '#E5E7EB' },
                            ]}
                          >
                            {passed && <Check size={12} color="#FFFFFF" />}
                            {!passed && available && (
                              <Play size={10} color={stage.color} />
                            )}
                            {!available && <Lock size={10} color="#9CA3AF" />}
                          </View>

                          <View style={styles.lessonInfo}>
                            <Text
                              style={[
                                styles.lessonTitle,
                                !available && styles.lessonTitleLocked,
                              ]}
                            >
                              {lesson.title}
                            </Text>
                            <Text style={styles.lessonSubtitle}>
                              {lesson.subtitle} · {lesson.items.length} items
                            </Text>
                          </View>

                          {score !== undefined && (
                            <View style={styles.scoreContainer}>
                              <Text
                                style={[
                                  styles.scoreValue,
                                  {
                                    color: score >= 80
                                      ? '#10B981'
                                      : score >= 70
                                      ? '#F59E0B'
                                      : '#EF4444',
                                  },
                                ]}
                              >
                                {Math.round(score)}%
                              </Text>
                              {attempts > 1 && (
                                <Text style={styles.attemptsText}>
                                  {attempts}x
                                </Text>
                              )}
                            </View>
                          )}

                          {score === undefined && available && (
                            <ChevronRight size={16} color={stage.color} />
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })}

          <View style={{ height: 40 }} />
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerGradient: {
    paddingBottom: 24,
  },
  headerSafeArea: {
    position: 'relative' as const,
  },
  headerNav: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  headerSpacer: {
    width: 40,
  },
  headerContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  headerIconRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    marginBottom: 12,
  },
  headerIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  completeBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  completeBadgeText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 20,
    marginBottom: 16,
  },
  progressRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  contentContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -16,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 28,
  },
  connector: {
    alignItems: 'center' as const,
    height: 24,
  },
  connectorLine: {
    width: 3,
    height: 24,
    borderRadius: 1.5,
  },
  stageCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  stageCardLocked: {
    opacity: 0.55,
  },
  stageCardExpanded: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  stageHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 14,
  },
  stageNumber: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  stageNumberText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  stageInfo: {
    flex: 1,
  },
  stageTitleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  stageTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  stageTitleLocked: {
    color: Colors.textMuted,
  },
  stageIcon: {
    fontSize: 16,
  },
  stageSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  stageSubtitleLocked: {
    color: Colors.textMuted,
  },
  stageProgressRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    marginTop: 8,
  },
  stageProgressText: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  lockedText: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 8,
    marginLeft: 54,
  },
  lessonsContainer: {
    backgroundColor: Colors.backgroundCard,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  stageDescription: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginVertical: 12,
    marginLeft: 4,
  },
  lessonRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    gap: 12,
  },
  lessonRowLocked: {
    opacity: 0.5,
  },
  lessonDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    backgroundColor: 'transparent',
  },
  lessonInfo: {
    flex: 1,
  },
  lessonTitle: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  lessonTitleLocked: {
    color: Colors.textMuted,
  },
  lessonSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  scoreContainer: {
    alignItems: 'flex-end' as const,
  },
  scoreValue: {
    fontSize: 15,
    fontWeight: '700' as const,
  },
  attemptsText: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 1,
  },
});
