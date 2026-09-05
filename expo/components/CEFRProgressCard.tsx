import React, { useEffect, useRef, useMemo, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  BookOpen,
  PenLine,
  Headphones,
  Mic,
  ChevronRight,
  ChevronDown,
  Shield,
  Lock,
  Check,
  Star,
  ArrowRight,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { USE_NATIVE_DRIVER } from '@/constants/animation';
import { useApp } from '@/contexts/AppContext';
import { CEFRLevel } from '@/types';
import {
  calculateContinuousCEFR,
  ContinuousCEFRScore,
  CEFRCalculationInput,
  CEFR_LEVEL_ORDER,
  CEFR_LEVEL_NAMES,
  CEFR_LEVEL_COLORS,
  CEFR_LEVEL_DESCRIPTIONS,
  LEVEL_UNLOCKS,
  getScorePositionPercent,
} from '@/utils/proficiency';
import { getPhonemeStats } from '@/utils/pronunciationTracker';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BAR_HORIZONTAL_PADDING = 16;
const BAR_WIDTH = Math.min(SCREEN_WIDTH - 40, 380) - BAR_HORIZONTAL_PADDING * 2;

interface CEFRProgressCardProps {
  compact?: boolean;
}

const SKILL_ITEMS: { key: keyof ContinuousCEFRScore['skillScores']; label: string; icon: React.ReactNode; color: string }[] = [
  { key: 'reading', label: 'Reading', icon: <BookOpen size={14} color="#10B981" />, color: '#10B981' },
  { key: 'writing', label: 'Writing', icon: <PenLine size={14} color="#8B5CF6" />, color: '#8B5CF6' },
  { key: 'listening', label: 'Listening', icon: <Headphones size={14} color="#F59E0B" />, color: '#F59E0B' },
  { key: 'speaking', label: 'Speaking', icon: <Mic size={14} color="#EF4444" />, color: '#EF4444' },
];

const CEFR_LEVEL_DETAIL_DESCRIPTIONS: Record<CEFRLevel, string> = {
  'A1': 'You can understand and use familiar everyday expressions and very basic phrases. You can introduce yourself and ask/answer simple personal questions.',
  'A2': 'You can understand sentences related to areas of immediate relevance (personal info, shopping, local geography). You can communicate in simple, routine tasks.',
  'B1': 'You can deal with most situations likely to arise while traveling. You can produce simple connected text on familiar topics and describe experiences, events, and ambitions.',
  'B2': 'You can understand the main ideas of complex text on both concrete and abstract topics. You can interact with a degree of fluency and spontaneity with native speakers.',
  'C1': 'You can understand a wide range of demanding, longer texts and recognize implicit meaning. You can express ideas fluently and spontaneously for social, academic, and professional purposes.',
  'C2': 'You can understand with ease virtually everything heard or read. You can summarize information from different sources, reconstructing arguments and accounts in a coherent presentation.',
};

function SkillBar({ label, icon, score, color, delay }: {
  label: string;
  icon: React.ReactNode;
  score: number;
  color: string;
  delay: number;
}) {
  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: score,
      duration: 800,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [score, widthAnim, delay]);

  const animatedWidth = widthAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  return (
    <View style={skillStyles.row}>
      <View style={skillStyles.labelRow}>
        {icon}
        <Text style={skillStyles.label}>{label}</Text>
      </View>
      <View style={skillStyles.barTrack}>
        <Animated.View
          style={[
            skillStyles.barFill,
            { width: animatedWidth as any, backgroundColor: color },
          ]}
        />
      </View>
      <Text style={[skillStyles.score, { color }]}>{score}%</Text>
    </View>
  );
}

function PulsingDot({ color, left }: { color: string; left: number }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.6,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ])
    );
    pulse.start();

    const glow = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 0.8,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.4,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ])
    );
    glow.start();

    return () => {
      pulse.stop();
      glow.stop();
    };
  }, [pulseAnim, glowAnim]);

  return (
    <View style={[dotStyles.container, { left: left - 8 }]}>
      <Animated.View
        style={[
          dotStyles.glow,
          {
            backgroundColor: color,
            opacity: glowAnim,
            transform: [{ scale: pulseAnim }],
          },
        ]}
      />
      <View style={[dotStyles.dot, { backgroundColor: color, borderColor: '#fff' }]} />
    </View>
  );
}

type LevelStatus = 'certified' | 'current' | 'attempted' | 'locked';

function LevelDetailRow({ level, status, isCurrent, bestScore, attempts, progressInLevel, onTakeTest }: {
  level: CEFRLevel;
  status: LevelStatus;
  isCurrent: boolean;
  bestScore: number | null;
  attempts: number;
  progressInLevel: number;
  onTakeTest: (level: CEFRLevel) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const expandAnim = useRef(new Animated.Value(0)).current;
  const colors = CEFR_LEVEL_COLORS[level];

  const toggleExpand = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const toValue = expanded ? 0 : 1;
    Animated.timing(expandAnim, {
      toValue,
      duration: 250,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    setExpanded(!expanded);
  }, [expanded, expandAnim]);

  const expandHeight = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 180],
    extrapolate: 'clamp',
  });

  const rotateChevron = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const statusIcon = useMemo(() => {
    switch (status) {
      case 'certified':
        return <Check size={14} color="#fff" />;
      case 'current':
        return <Star size={14} color={colors.accent} />;
      case 'attempted':
        return <ArrowRight size={14} color={colors.accent} />;
      case 'locked':
        return <Lock size={12} color={Colors.textMuted} />;
    }
  }, [status, colors.accent]);

  const statusBgColor = useMemo(() => {
    switch (status) {
      case 'certified': return colors.accent;
      case 'current': return colors.bg;
      case 'attempted': return colors.bg;
      case 'locked': return '#F3F4F6';
    }
  }, [status, colors]);

  const statusLabel = useMemo(() => {
    switch (status) {
      case 'certified': return 'Certified';
      case 'current': return 'Current Level';
      case 'attempted': return `Attempted${attempts > 0 ? ` (${attempts}×)` : ''}`;
      case 'locked': return 'Not yet reached';
    }
  }, [status, attempts]);

  const isLocked = status === 'locked';

  return (
    <Pressable
      onPress={toggleExpand}
      style={({ pressed }) => [
        levelRowStyles.container,
        isCurrent && { borderColor: colors.accent, borderWidth: 1.5 },
        pressed && { opacity: 0.95 },
      ]}
      testID={`cefr-level-${level}`}
    >
      <View style={levelRowStyles.header}>
        <View style={[levelRowStyles.badge, { backgroundColor: isLocked ? '#F3F4F6' : colors.bg }]}>
          <Text style={[levelRowStyles.badgeText, { color: isLocked ? Colors.textMuted : colors.text }]}>
            {level}
          </Text>
        </View>

        <View style={levelRowStyles.info}>
          <View style={levelRowStyles.nameRow}>
            <Text style={[levelRowStyles.name, isLocked && { color: Colors.textMuted }]}>
              {CEFR_LEVEL_NAMES[level]}
            </Text>
            <View style={[levelRowStyles.statusPill, { backgroundColor: statusBgColor }]}>
              {statusIcon}
              <Text style={[
                levelRowStyles.statusText,
                { color: status === 'certified' ? '#fff' : status === 'locked' ? Colors.textMuted : colors.text },
              ]}>
                {statusLabel}
              </Text>
            </View>
          </View>
          <Text style={[levelRowStyles.desc, isLocked && { color: Colors.textMuted }]} numberOfLines={expanded ? undefined : 1}>
            {CEFR_LEVEL_DESCRIPTIONS[level]}
          </Text>
        </View>

        <Animated.View style={{ transform: [{ rotate: rotateChevron }] }}>
          <ChevronDown size={16} color={Colors.textMuted} />
        </Animated.View>
      </View>

      <Animated.View style={[levelRowStyles.expandedContent, { maxHeight: expandHeight, opacity: expandAnim }]}>
        <View style={levelRowStyles.expandedInner}>
          <Text style={levelRowStyles.detailDesc}>
            {CEFR_LEVEL_DETAIL_DESCRIPTIONS[level]}
          </Text>

          {bestScore !== null && (
            <View style={levelRowStyles.scoreRow}>
              <Text style={levelRowStyles.scoreLabel}>Best Score</Text>
              <View style={levelRowStyles.scoreBarTrack}>
                <View style={[levelRowStyles.scoreBarFill, { width: `${bestScore}%`, backgroundColor: bestScore >= 70 ? '#10B981' : '#F59E0B' }]} />
              </View>
              <Text style={[levelRowStyles.scoreValue, { color: bestScore >= 70 ? '#10B981' : '#F59E0B' }]}>
                {bestScore}%
              </Text>
            </View>
          )}

          {isCurrent && (
            <View style={levelRowStyles.scoreRow}>
              <Text style={levelRowStyles.scoreLabel}>Progress</Text>
              <View style={levelRowStyles.scoreBarTrack}>
                <View style={[levelRowStyles.scoreBarFill, { width: `${progressInLevel}%`, backgroundColor: colors.accent }]} />
              </View>
              <Text style={[levelRowStyles.scoreValue, { color: colors.accent }]}>
                {progressInLevel}%
              </Text>
            </View>
          )}

          <View style={levelRowStyles.unlockSection}>
            <Text style={levelRowStyles.unlockTitle}>Skills at this level</Text>
            <View style={levelRowStyles.unlockTags}>
              {LEVEL_UNLOCKS[level].map((skill) => (
                <View key={skill} style={[levelRowStyles.unlockTag, { backgroundColor: isLocked ? '#F3F4F6' : colors.bg }]}>
                  <Text style={[levelRowStyles.unlockTagText, { color: isLocked ? Colors.textMuted : colors.text }]}>
                    {skill}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {(status === 'current' || status === 'attempted') && (
            <Pressable
              style={({ pressed }) => [
                levelRowStyles.takeTestBtn,
                { backgroundColor: colors.accent },
                pressed && { opacity: 0.85 },
              ]}
              onPress={() => onTakeTest(level)}
            >
              <Shield size={14} color="#fff" />
              <Text style={levelRowStyles.takeTestText}>Take {level} Test</Text>
            </Pressable>
          )}
        </View>
      </Animated.View>
    </Pressable>
  );
}

export default React.memo(function CEFRProgressCard({ compact = false }: CEFRProgressCardProps) {
  const router = useRouter();
  const {
    gaps,
    progress,
    proficiency,
    moduleProgress,
  } = useApp();

  const [pronAvg, setPronAvg] = React.useState(50);

  useEffect(() => {
    void getPhonemeStats().then(stats => {
      if (stats.averageOverall > 0) {
        setPronAvg(stats.averageOverall);
      }
    });
  }, []);

  const cefrScore = useMemo((): ContinuousCEFRScore => {
    const vocabMastered = gaps.filter(g => g.masteredAt && g.category === 'vocabulary').length;
    const grammarGaps = gaps.filter(g => g.category === 'grammar');
    const grammarResolved = grammarGaps.filter(g => g.masteredAt).length;

    const input: CEFRCalculationInput = {
      vocabMasteredCount: vocabMastered,
      totalGaps: gaps.length,
      grammarGapsResolved: grammarResolved,
      totalGrammarGaps: grammarGaps.length,
      pronunciationAvgScore: pronAvg,
      readingAccuracy: progress.averageReadingWithoutHelp,
      readingSessions: progress.readingSessions,
      listeningComprehension: Math.min(100, progress.weeklyStats.readingSessions * 10 + 20),
      speakingMinutes: progress.totalSpeakingMinutes,
      certifiedLevels: proficiency.certifiedLevels,
      currentModuleId: moduleProgress.currentModuleId,
      completedModules: moduleProgress.completedModules,
    };

    return calculateContinuousCEFR(input);
  }, [gaps, progress, proficiency, moduleProgress, pronAvg]);

  const positionPercent = useMemo(
    () => getScorePositionPercent(cefrScore.overallScore),
    [cefrScore.overallScore]
  );

  const dotLeft = useMemo(
    () => Math.max(6, Math.min(BAR_WIDTH - 6, (positionPercent / 100) * BAR_WIDTH)),
    [positionPercent]
  );

  const levelColors = CEFR_LEVEL_COLORS[cefrScore.level];

  const handleTakeTest = useCallback((level: CEFRLevel) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push(`/proficiency-test?level=${level}` as any);
  }, [router]);

  const handlePress = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/proficiency-test' as any);
  }, [router]);

  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: positionPercent,
      duration: 1000,
      delay: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [positionPercent, progressAnim]);

  const animatedFillWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  const levelStatuses = useMemo(() => {
    const currentLevelIndex = CEFR_LEVEL_ORDER.indexOf(cefrScore.level);
    return CEFR_LEVEL_ORDER.map((level) => {
      const levelIndex = CEFR_LEVEL_ORDER.indexOf(level);
      const isCertified = proficiency.certifiedLevels.includes(level);
      const record = proficiency.records.find(r => r.level === level);
      const isCurrent = cefrScore.level === level;

      let status: LevelStatus;
      if (isCertified) {
        status = 'certified';
      } else if (isCurrent) {
        status = 'current';
      } else if (record && record.attempts > 0) {
        status = 'attempted';
      } else if (levelIndex <= currentLevelIndex) {
        status = 'current';
      } else {
        status = 'locked';
      }

      return {
        level,
        status,
        isCurrent,
        bestScore: record?.score ?? null,
        attempts: record?.attempts ?? 0,
      };
    });
  }, [cefrScore.level, proficiency]);

  if (compact) {
    return (
      <Pressable
        style={({ pressed }) => [
          compactStyles.card,
          pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
        ]}
        onPress={handlePress}
        testID="cefr-progress-compact"
      >
        <View style={compactStyles.header}>
          <View style={[compactStyles.levelBadge, { backgroundColor: levelColors.bg }]}>
            <Shield size={12} color={levelColors.accent} />
            <Text style={[compactStyles.levelText, { color: levelColors.text }]}>
              {cefrScore.level}
            </Text>
          </View>
          <Text style={compactStyles.levelName}>
            {CEFR_LEVEL_NAMES[cefrScore.level]}
          </Text>
          <ChevronRight size={14} color={Colors.textMuted} />
        </View>

        <View style={compactStyles.barContainer}>
          <View style={compactStyles.barBackground}>
            {CEFR_LEVEL_ORDER.map((level, i) => {
              const segmentWidth = 100 / CEFR_LEVEL_ORDER.length;
              return (
                <View
                  key={level}
                  style={[
                    compactStyles.barSegment,
                    {
                      width: `${segmentWidth}%` as any,
                      backgroundColor: CEFR_LEVEL_COLORS[level].bg,
                      borderTopLeftRadius: i === 0 ? 6 : 0,
                      borderBottomLeftRadius: i === 0 ? 6 : 0,
                      borderTopRightRadius: i === CEFR_LEVEL_ORDER.length - 1 ? 6 : 0,
                      borderBottomRightRadius: i === CEFR_LEVEL_ORDER.length - 1 ? 6 : 0,
                    },
                  ]}
                />
              );
            })}
            <Animated.View
              style={[
                compactStyles.barFill,
                {
                  width: animatedFillWidth as any,
                  backgroundColor: levelColors.accent,
                },
              ]}
            />
          </View>
          <View style={compactStyles.levelLabels}>
            {CEFR_LEVEL_ORDER.map(level => (
              <Text
                key={level}
                style={[
                  compactStyles.levelLabel,
                  cefrScore.level === level && { color: levelColors.accent, fontWeight: '700' as const },
                ]}
              >
                {level}
              </Text>
            ))}
          </View>
        </View>
      </Pressable>
    );
  }

  return (
    <View testID="cefr-progress-card">
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={[styles.levelBadge, { backgroundColor: levelColors.bg }]}>
              <Shield size={14} color={levelColors.accent} />
              <Text style={[styles.levelBadgeText, { color: levelColors.text }]}>
                {cefrScore.level}
              </Text>
            </View>
            <View>
              <Text style={styles.title}>CEFR Level</Text>
              <Text style={styles.subtitle}>{CEFR_LEVEL_NAMES[cefrScore.level]}</Text>
            </View>
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.testBtn,
              pressed && { opacity: 0.8 },
            ]}
            onPress={handlePress}
          >
            <Text style={styles.testBtnText}>Take Test</Text>
          </Pressable>
        </View>

        <View style={styles.barSection}>
          <View style={styles.barBackground}>
            {CEFR_LEVEL_ORDER.map((level, i) => {
              const segmentWidth = 100 / CEFR_LEVEL_ORDER.length;
              const isActive = CEFR_LEVEL_ORDER.indexOf(cefrScore.level) >= i;
              return (
                <View
                  key={level}
                  style={[
                    styles.barSegment,
                    {
                      width: `${segmentWidth}%` as any,
                      backgroundColor: isActive
                        ? CEFR_LEVEL_COLORS[level].bg
                        : '#F3F4F6',
                      borderTopLeftRadius: i === 0 ? 8 : 0,
                      borderBottomLeftRadius: i === 0 ? 8 : 0,
                      borderTopRightRadius: i === CEFR_LEVEL_ORDER.length - 1 ? 8 : 0,
                      borderBottomRightRadius: i === CEFR_LEVEL_ORDER.length - 1 ? 8 : 0,
                    },
                  ]}
                />
              );
            })}
            <Animated.View
              style={[
                styles.barFill,
                {
                  width: animatedFillWidth as any,
                  backgroundColor: levelColors.accent,
                },
              ]}
            />
            <PulsingDot color={levelColors.accent} left={dotLeft} />
          </View>

          <View style={styles.levelLabels}>
            {CEFR_LEVEL_ORDER.map(level => {
              const isCurrent = cefrScore.level === level;
              const isCertified = proficiency.certifiedLevels.includes(level);
              return (
                <View key={level} style={styles.levelLabelItem}>
                  <Text
                    style={[
                      styles.levelLabel,
                      isCurrent && { color: levelColors.accent, fontWeight: '800' as const },
                      isCertified && { color: CEFR_LEVEL_COLORS[level].accent },
                    ]}
                  >
                    {level}
                  </Text>
                  {isCertified && (
                    <View style={[styles.certDot, { backgroundColor: CEFR_LEVEL_COLORS[level].accent }]} />
                  )}
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.progressLabel}>
          <Text style={styles.progressText}>
            Progress in {cefrScore.level}
          </Text>
          <Text style={[styles.progressPercent, { color: levelColors.accent }]}>
            {cefrScore.progressInLevel}%
          </Text>
        </View>

        <View style={styles.skillsSection}>
          {SKILL_ITEMS.map((skill, i) => (
            <SkillBar
              key={skill.key}
              label={skill.label}
              icon={skill.icon}
              score={cefrScore.skillScores[skill.key]}
              color={skill.color}
              delay={300 + i * 100}
            />
          ))}
        </View>
      </View>

      <View style={styles.levelsBreakdown}>
        <Text style={styles.levelsBreakdownTitle}>All CEFR Levels</Text>
        <Text style={styles.levelsBreakdownSubtitle}>Tap any level to learn more</Text>
        <View style={styles.levelsList}>
          {levelStatuses.map(({ level, status, isCurrent, bestScore, attempts }) => (
            <LevelDetailRow
              key={level}
              level={level}
              status={status}
              isCurrent={isCurrent}
              bestScore={bestScore}
              attempts={attempts}
              progressInLevel={isCurrent ? cefrScore.progressInLevel : 0}
              onTakeTest={handleTakeTest}
            />
          ))}
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  levelBadgeText: {
    fontSize: 14,
    fontWeight: '800' as const,
  },
  title: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.text,
    marginTop: 1,
  },
  testBtn: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
  },
  testBtnText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  barSection: {
    marginBottom: 16,
  },
  barBackground: {
    flexDirection: 'row',
    height: 14,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  barSegment: {
    height: '100%',
  },
  barFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    borderRadius: 8,
    opacity: 0.35,
  },
  levelLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingHorizontal: 2,
  },
  levelLabelItem: {
    alignItems: 'center',
    gap: 3,
  },
  levelLabel: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: Colors.textMuted,
  },
  certDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  progressLabel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  progressText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
  },
  progressPercent: {
    fontSize: 15,
    fontWeight: '800' as const,
  },
  skillsSection: {
    gap: 10,
  },
  levelsBreakdown: {
    marginTop: 16,
  },
  levelsBreakdownTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  levelsBreakdownSubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 12,
  },
  levelsList: {
    gap: 8,
  },
});

const levelRowStyles = StyleSheet.create({
  container: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  badge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 14,
    fontWeight: '800' as const,
  },
  info: {
    flex: 1,
    gap: 3,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600' as const,
  },
  desc: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  expandedContent: {
    overflow: 'hidden',
  },
  expandedInner: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 10,
  },
  detailDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scoreLabel: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: Colors.textMuted,
    width: 68,
  },
  scoreBarTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F3F4F6',
    overflow: 'hidden',
  },
  scoreBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  scoreValue: {
    fontSize: 12,
    fontWeight: '700' as const,
    width: 36,
    textAlign: 'right' as const,
  },
  unlockSection: {
    gap: 6,
  },
  unlockTitle: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.4,
  },
  unlockTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  unlockTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  unlockTagText: {
    fontSize: 11,
    fontWeight: '500' as const,
  },
  takeTestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 4,
  },
  takeTestText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#fff',
  },
});

const skillStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    width: 82,
  },
  label: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  barTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F3F4F6',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  score: {
    fontSize: 12,
    fontWeight: '700' as const,
    width: 36,
    textAlign: 'right' as const,
  },
});

const dotStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: -1,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
  },
});

const compactStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  levelText: {
    fontSize: 12,
    fontWeight: '800' as const,
  },
  levelName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  barContainer: {},
  barBackground: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 6,
    overflow: 'hidden',
    position: 'relative',
  },
  barSegment: {
    height: '100%',
  },
  barFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    borderRadius: 6,
    opacity: 0.4,
  },
  levelLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingHorizontal: 2,
  },
  levelLabel: {
    fontSize: 9,
    fontWeight: '600' as const,
    color: Colors.textMuted,
  },
});
