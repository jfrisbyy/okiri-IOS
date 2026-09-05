import { useEffect, useRef, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  Pressable,
  Animated,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { safeGoBack } from '@/utils/navigation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, MessageCircle, Check, Lock, AlertTriangle, Target, ChevronRight, BookOpen, Headphones, Mic, PenLine, Trophy, Sparkles, Shield } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { USE_NATIVE_DRIVER } from '@/constants/animation';
import AnimatedProgressBar from '@/components/AnimatedProgressBar';
import { useApp } from '@/contexts/AppContext';
import { foundationLessons } from '@/mocks/content';
import { learningModules } from '@/mocks/modules';
import { ModuleId, LessonPhase } from '@/types';
import { getProgressivePhases, getNewlyUnlockedPhase, getPhaseDisplayName, getJourneyStatus } from '@/utils/lessonPhases';
import {
  getGateAfterModule,
  isModuleGatedByProficiency,
  CEFR_LEVEL_NAMES,
  CEFR_LEVEL_COLORS,
  CEFR_LEVEL_DESCRIPTIONS,
  getCurrentCertifiedLevel,
  getNextTestableLevel,
} from '@/utils/proficiency';

export default function FoundationOverviewScreen() {
  const router = useRouter();
  const { completedFoundationIds, moduleProgress, isModuleUnlocked, gapSchedule, getLessonInjection, proficiency } = useApp();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [fadeAnim]);

  const currentModule = learningModules.find(m => m.id === moduleProgress.currentModuleId);
  const totalLessons = foundationLessons.length;
  const completedCount = completedFoundationIds.length;
  const totalHours = Math.round(foundationLessons.reduce((sum, l) => sum + l.estimatedMinutes, 0) / 60);

  const getLessonStatus = (lessonId: string, moduleId: ModuleId) => {
    if (completedFoundationIds.includes(lessonId)) return 'completed';
    if (!isModuleUnlocked(moduleId)) return 'locked';
    
    const moduleLessons = foundationLessons.filter(l => l.moduleId === moduleId);
    const lessonIndex = moduleLessons.findIndex(l => l.id === lessonId);
    const previousLessons = moduleLessons.slice(0, lessonIndex);
    const allPreviousCompleted = previousLessons.every(l => completedFoundationIds.includes(l.id));
    
    return allPreviousCompleted ? 'available' : 'locked';
  };

  const getNextLesson = () => {
    for (const module of learningModules) {
      if (!isModuleUnlocked(module.id)) continue;
      const moduleLessons = foundationLessons.filter(l => l.moduleId === module.id);
      for (const lesson of moduleLessons) {
        if (!completedFoundationIds.includes(lesson.id)) {
          return lesson;
        }
      }
    }
    return null;
  };

  const nextLesson = getNextLesson();

  const injection = useMemo(() => {
    return getLessonInjection(moduleProgress.currentModuleId);
  }, [moduleProgress.currentModuleId, getLessonInjection]);

  const hasCriticalGaps = gapSchedule.critical.length > 0;
  const hasGapInjection = injection.totalInjected > 0;
  const activeGapCount = useApp().gaps.filter(g => !g.masteredAt).length;
  const masteredGapCount = useApp().gaps.filter(g => g.masteredAt).length;

  const certifiedLevel = useMemo(() => getCurrentCertifiedLevel(proficiency.certifiedLevels), [proficiency.certifiedLevels]);
  const nextTestable = useMemo(() => getNextTestableLevel(moduleProgress.completedModules, proficiency.certifiedLevels), [moduleProgress.completedModules, proficiency.certifiedLevels]);

  const journeyStatus = useMemo(() => {
    return getJourneyStatus(completedCount, totalLessons, activeGapCount, masteredGapCount);
  }, [completedCount, totalLessons, activeGapCount, masteredGapCount]);

  const getLessonProgressivePhases = (lesson: typeof foundationLessons[0]): LessonPhase[] => {
    return getProgressivePhases(lesson.order, lesson.phases);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      <LinearGradient
        colors={[Colors.primaryGradientStart, Colors.primaryGradientEnd]}
        style={styles.headerGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
          <View style={styles.decorativeShapes}>
            <View style={[styles.shape, styles.shapeCircle, { top: 20, right: 60 }]} />
            <View style={[styles.shape, styles.shapeSquiggle, { top: 40, left: 80 }]} />
            <View style={[styles.shape, styles.shapeDot, { bottom: 60, right: 30 }]} />
          </View>

          <View style={styles.headerNav}>
            <Pressable style={styles.backButton} onPress={() => safeGoBack()}>
              <ChevronLeft size={24} color={Colors.textLight} />
            </Pressable>
            <Text style={styles.headerTitle}>Lessons</Text>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.headerContent}>
            <View style={styles.levelBadge}>
              <Text style={styles.levelBadgeText}>{currentModule?.cefrLevel || 'A1'}</Text>
            </View>

            <View style={styles.iconContainer}>
              <MessageCircle size={48} color={Colors.primary} />
            </View>

            <Text style={styles.title}>Foundation</Text>
            <Text style={styles.stats}>{totalLessons} Lessons · ~{totalHours} hrs</Text>
            {journeyStatus.phase !== 'learning' && (
              <View style={styles.journeyBadge}>
                <Text style={styles.journeyBadgeText}>{journeyStatus.label}</Text>
              </View>
            )}
          </View>
        </SafeAreaView>
      </LinearGradient>

      <Animated.View style={[styles.contentContainer, { opacity: fadeAnim }]}>
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {hasCriticalGaps && (
            <Pressable
              style={({ pressed }) => [
                styles.gapWarningBanner,
                pressed && styles.gapWarningBannerPressed,
              ]}
              onPress={() => router.push('/gap-quiz?source=due' as any)}
            >
              <View style={styles.gapWarningIcon}>
                <AlertTriangle size={18} color="#DC2626" />
              </View>
              <View style={styles.gapWarningContent}>
                <Text style={styles.gapWarningTitle}>
                  {gapSchedule.critical.length} gap{gapSchedule.critical.length !== 1 ? 's' : ''} need attention
                </Text>
                <Text style={styles.gapWarningDesc}>
                  Review critical gaps to keep your learning solid
                </Text>
              </View>
              <ChevronRight size={18} color="#DC2626" />
            </Pressable>
          )}

          {!hasCriticalGaps && hasGapInjection && (
            <View style={styles.gapInjectionNotice}>
              <Target size={16} color={Colors.primary} />
              <Text style={styles.gapInjectionText}>
                {injection.injectionReason}
              </Text>
            </View>
          )}

          {journeyStatus.phase === 'complete' && (
            <View style={styles.masteryBanner}>
              <View style={styles.masteryIcon}>
                <Trophy size={22} color="#D97706" />
              </View>
              <View style={styles.masteryContent}>
                <Text style={styles.masteryTitle}>Fluency Achieved</Text>
                <Text style={styles.masteryDesc}>{journeyStatus.description}</Text>
              </View>
            </View>
          )}

          {journeyStatus.phase === 'gap_mastery' && (
            <Pressable
              style={({ pressed }) => [
                styles.gapMasteryBanner,
                pressed && styles.gapMasteryBannerPressed,
              ]}
              onPress={() => router.push('/gap-quiz?source=due' as any)}
            >
              <View style={styles.gapMasteryIcon}>
                <Sparkles size={20} color="#7C3AED" />
              </View>
              <View style={styles.gapMasteryContent}>
                <Text style={styles.gapMasteryTitle}>Gap Mastery Phase</Text>
                <Text style={styles.gapMasteryDesc}>{activeGapCount} gap{activeGapCount !== 1 ? 's' : ''} remaining to master</Text>
              </View>
              <ChevronRight size={18} color="#7C3AED" />
            </Pressable>
          )}

          {learningModules.map((module, moduleIndex) => {
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
              <View key={module.id}>
                {showGateCard && (
                  <Pressable
                    style={({ pressed }) => [
                      styles.proficiencyGateCard,
                      gatePassed && styles.proficiencyGateCardPassed,
                      !gatePassed && !gateAvailable && styles.proficiencyGateCardLocked,
                      pressed && gateAvailable && styles.proficiencyGateCardPressed,
                    ]}
                    onPress={() => {
                      if (gateAvailable) {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
                        <Check size={20} color={CEFR_LEVEL_COLORS[gate!.testLevel].accent} />
                      ) : (
                        <Shield size={20} color={gateAvailable ? CEFR_LEVEL_COLORS[gate!.testLevel].accent : Colors.textMuted} />
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
                      <ChevronRight size={18} color={CEFR_LEVEL_COLORS[gate!.testLevel].accent} />
                    )}
                    {gatePassed && (
                      <View style={[styles.gateBadge, { backgroundColor: CEFR_LEVEL_COLORS[gate!.testLevel].bg }]}>
                        <Text style={[styles.gateBadgeText, { color: CEFR_LEVEL_COLORS[gate!.testLevel].text }]}>
                          {proficiency.records.find(r => r.level === gate!.testLevel)?.score ?? 0}%
                        </Text>
                      </View>
                    )}
                  </Pressable>
                )}

                <View style={styles.moduleSection}>
                  <View style={styles.moduleTitleRow}>
                    <View style={styles.moduleTitleLeft}>
                      <Text style={styles.moduleTitle}>{module.title}</Text>
                      {isCertified && (
                        <Shield size={14} color={CEFR_LEVEL_COLORS[module.cefrLevel].accent} />
                      )}
                    </View>
                    <View style={[
                      styles.moduleLevelBadge,
                      !moduleUnlocked && styles.moduleLevelBadgeLocked,
                      gatedByProficiency && styles.moduleLevelBadgeGated,
                    ]}>
                      {gatedByProficiency && <Lock size={10} color={Colors.textMuted} />}
                      <Text style={[
                        styles.moduleLevelText,
                        !moduleUnlocked && styles.moduleLevelTextLocked,
                      ]}>{module.cefrLevel}</Text>
                    </View>
                  </View>

                {moduleLessons.map((lesson, index) => {
                  const status = getLessonStatus(lesson.id, module.id);
                  const isNext = nextLesson?.id === lesson.id;
                  const progress = status === 'completed' ? 100 : (isNext ? 0 : 0);

                  return (
                    <Pressable
                      key={lesson.id}
                      style={({ pressed }) => [
                        styles.lessonCard,
                        status === 'locked' && styles.lessonCardLocked,
                        isNext && styles.lessonCardNext,
                        pressed && status !== 'locked' && styles.lessonCardPressed,
                      ]}
                      onPress={() => {
                        if (status !== 'locked') {
                          router.push(`/foundation/${lesson.id}`);
                        }
                      }}
                      disabled={status === 'locked'}
                    >
                      <View style={[
                        styles.lessonIcon,
                        status === 'completed' && styles.lessonIconCompleted,
                        status === 'locked' && styles.lessonIconLocked,
                        isNext && styles.lessonIconNext,
                      ]}>
                        {status === 'completed' ? (
                          <Check size={20} color={Colors.textLight} />
                        ) : status === 'locked' ? (
                          <Lock size={18} color={Colors.textMuted} />
                        ) : (
                          <MessageCircle size={20} color={isNext ? Colors.primary : Colors.textMuted} />
                        )}
                      </View>

                      <View style={styles.lessonInfo}>
                        <Text style={[
                          styles.lessonTitle,
                          status === 'locked' && styles.lessonTitleLocked,
                        ]}>
                          {String(index + 1).padStart(2, '0')} - {lesson.title}
                        </Text>
                        <Text style={styles.lessonSubtitle}>
                          ~{lesson.estimatedMinutes} min
                        </Text>
                        <View style={styles.lessonPhases}>
                          {getLessonProgressivePhases(lesson).map((phase) => {
                            const phaseIcons: Record<string, React.ReactNode> = {
                              learn: <BookOpen size={10} color={Colors.primary} />,
                              listen: <Headphones size={10} color="#8B5CF6" />,
                              read: <BookOpen size={10} color="#10B981" />,
                              speak: <Mic size={10} color="#F59E0B" />,
                              write: <PenLine size={10} color="#06B6D4" />,
                            };
                            return (
                              <View key={phase} style={styles.lessonPhasePill}>
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
                        
                        <View style={styles.progressBarContainer}>
                          <AnimatedProgressBar
                            progress={progress}
                            color={Colors.primary}
                            trackColor={Colors.border}
                            height={4}
                            borderRadius={2}
                            delay={100 + 60 * index}
                            duration={500}
                          />
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
                </View>
              </View>
            );
          })}
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
    position: 'relative',
  },
  decorativeShapes: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
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
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.textLight,
  },
  headerSpacer: {
    width: 40,
  },
  headerContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    alignItems: 'flex-start',
  },
  levelBadge: {
    position: 'absolute',
    top: 16,
    right: 24,
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
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: Colors.textLight,
    marginBottom: 6,
  },
  stats: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.8)',
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
    padding: 24,
    paddingTop: 32,
  },
  moduleSection: {
    marginBottom: 28,
  },
  moduleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  moduleTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  moduleLevelBadge: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  moduleLevelBadgeLocked: {
    backgroundColor: Colors.border,
  },
  moduleLevelText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  moduleLevelTextLocked: {
    color: Colors.textMuted,
  },
  lessonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  lessonCardLocked: {
    backgroundColor: Colors.backgroundSecondary,
    opacity: 0.7,
  },
  lessonCardNext: {
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  lessonCardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  lessonIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  lessonIconCompleted: {
    backgroundColor: Colors.success,
  },
  lessonIconLocked: {
    backgroundColor: Colors.border,
  },
  lessonIconNext: {
    backgroundColor: Colors.primaryLight,
  },
  lessonInfo: {
    flex: 1,
  },
  lessonTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  lessonTitleLocked: {
    color: Colors.textMuted,
  },
  lessonSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  progressBarContainer: {
    marginTop: 4,
  },
  lessonProgressBar: {
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  lessonProgressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  lessonProgressFillNext: {
    backgroundColor: Colors.primary,
  },
  lessonPhases: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  lessonPhasePill: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gapWarningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  gapWarningBannerPressed: {
    opacity: 0.85,
  },
  gapWarningIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  gapWarningContent: {
    flex: 1,
  },
  gapWarningTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#991B1B',
  },
  gapWarningDesc: {
    fontSize: 12,
    color: '#B91C1C',
    marginTop: 2,
  },
  gapInjectionNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.primaryLight,
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
  },
  gapInjectionText: {
    flex: 1,
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '500' as const,
  },
  journeyBadge: {
    marginTop: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  journeyBadgeText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textLight,
  },
  masteryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  masteryIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  masteryContent: {
    flex: 1,
  },
  masteryTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#92400E',
  },
  masteryDesc: {
    fontSize: 12,
    color: '#B45309',
    marginTop: 2,
    lineHeight: 16,
  },
  gapMasteryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F3FF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  gapMasteryBannerPressed: {
    opacity: 0.85,
  },
  gapMasteryIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  gapMasteryContent: {
    flex: 1,
  },
  gapMasteryTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#5B21B6',
  },
  gapMasteryDesc: {
    fontSize: 12,
    color: '#7C3AED',
    marginTop: 1,
  },
  newPhaseBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 4,
  },
  newPhaseBadgeText: {
    fontSize: 9,
    fontWeight: '600' as const,
    color: '#2563EB',
  },
  moduleTitleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  moduleLevelBadgeGated: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
  },
  proficiencyGateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: '#DBEAFE',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  proficiencyGateCardPassed: {
    borderColor: '#A7F3D0',
    backgroundColor: '#F0FDF4',
  },
  proficiencyGateCardLocked: {
    borderColor: Colors.border,
    opacity: 0.6,
  },
  proficiencyGateCardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  gateIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  gateContent: {
    flex: 1,
  },
  gateTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  gateSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  gateBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 8,
  },
  gateBadgeText: {
    fontSize: 12,
    fontWeight: '700' as const,
  },
});
