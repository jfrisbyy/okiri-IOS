import React, { useRef, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,

} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  ArrowLeft,
  BookOpen,
  Mic,
  Headphones,
  GraduationCap,
  AlertTriangle,
  Clock,
  Brain,
  MessageCircle,
  Volume2,
  Layers,
  Shield,
  Play,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { USE_NATIVE_DRIVER } from '@/constants/animation';
import { useApp } from '@/contexts/AppContext';
import { GapItem, GapCategory, GapDifficulty } from '@/types';
import {
  classifyGapUrgency,
  getGapHealthScore,
  GapUrgencyInfo,
} from '@/utils/gapScheduler';

const CATEGORY_META: Record<GapCategory, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  vocabulary: {
    label: 'Vocabulary',
    color: '#3B82F6',
    bg: '#EFF6FF',
    icon: <BookOpen size={18} color="#3B82F6" />,
  },
  grammar: {
    label: 'Grammar',
    color: '#8B5CF6',
    bg: '#F5F3FF',
    icon: <Layers size={18} color="#8B5CF6" />,
  },
  pronunciation: {
    label: 'Pronunciation',
    color: '#EC4899',
    bg: '#FDF2F8',
    icon: <Volume2 size={18} color="#EC4899" />,
  },
  phrasing: {
    label: 'Phrasing',
    color: '#0D9488',
    bg: '#F0FDFA',
    icon: <MessageCircle size={18} color="#0D9488" />,
  },
  register: {
    label: 'Register',
    color: '#F59E0B',
    bg: '#FFFBEB',
    icon: <Shield size={18} color="#F59E0B" />,
  },
};

const DIFFICULTY_CONFIG: Record<GapDifficulty, { label: string; color: string; bg: string }> = {
  hard: { label: 'Hard', color: '#EF4444', bg: '#FEF2F2' },
  okay: { label: 'Okay', color: '#F59E0B', bg: '#FFFBEB' },
  easy: { label: 'Easy', color: '#10B981', bg: '#ECFDF5' },
};

const SOURCE_ICON_MAP: Record<string, { icon: React.ReactNode; label: string }> = {
  reading: { icon: <BookOpen size={12} color={Colors.textMuted} />, label: 'Reading' },
  speech: { icon: <Mic size={12} color={Colors.textMuted} />, label: 'Speaking' },
  foundation: { icon: <GraduationCap size={12} color={Colors.textMuted} />, label: 'Foundation' },
  listening: { icon: <Headphones size={12} color={Colors.textMuted} />, label: 'Listening' },
};

interface CategoryGroup {
  category: GapCategory;
  gaps: GapItem[];
  urgencyMap: Map<string, GapUrgencyInfo>;
  healthColor: string;
  healthLabel: string;
  easyCount: number;
  okayCount: number;
  hardCount: number;
}

function PulsingBorder({ children, active }: { children: React.ReactNode; active: boolean }) {
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 800, useNativeDriver: USE_NATIVE_DRIVER }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [active, pulseAnim]);

  const borderOpacity = active
    ? pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] })
    : 0;

  return (
    <View style={{ position: 'relative' }}>
      {active && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: 14,
              borderWidth: 2,
              borderColor: '#EF4444',
              opacity: borderOpacity,
            },
          ]}
        />
      )}
      {children}
    </View>
  );
}

function GapCard({
  gap,
  urgencyInfo,
  onPractice,
  index,
}: {
  gap: GapItem;
  urgencyInfo: GapUrgencyInfo;
  onPractice: (gap: GapItem) => void;
  index: number;
}) {
  const slideAnim = useRef(new Animated.Value(40)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const diffConfig = DIFFICULTY_CONFIG[gap.difficulty];
  const source = SOURCE_ICON_MAP[gap.sourceType] ?? SOURCE_ICON_MAP.foundation;
  const isUrgent = urgencyInfo.urgency === 'critical';

  const daysSinceReview = useMemo(() => {
    if (!gap.lastReviewedAt) return null;
    const days = Math.floor(
      (Date.now() - new Date(gap.lastReviewedAt).getTime()) / (1000 * 60 * 60 * 24)
    );
    return days;
  }, [gap.lastReviewedAt]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 350,
        delay: index * 40,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 300,
        delay: index * 40,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start();
  }, [slideAnim, opacityAnim, index]);

  return (
    <Animated.View
      style={{
        opacity: opacityAnim,
        transform: [{ translateY: slideAnim }],
      }}
    >
      <PulsingBorder active={isUrgent}>
        <View style={styles.gapCard}>
          <View style={styles.gapCardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.gapFrench}>{gap.frenchWord}</Text>
              <Text style={styles.gapEnglish}>{gap.englishTranslation}</Text>
            </View>
            <View style={[styles.diffBadge, { backgroundColor: diffConfig.bg }]}>
              <Text style={[styles.diffBadgeText, { color: diffConfig.color }]}>
                {diffConfig.label}
              </Text>
            </View>
          </View>

          <View style={styles.gapMeta}>
            <View style={styles.gapMetaItem}>
              {source.icon}
              <Text style={styles.gapMetaText}>{source.label}</Text>
            </View>
            {daysSinceReview !== null && (
              <View style={styles.gapMetaItem}>
                <Clock size={12} color={Colors.textMuted} />
                <Text style={styles.gapMetaText}>
                  {daysSinceReview === 0 ? 'Today' : `${daysSinceReview}d ago`}
                </Text>
              </View>
            )}
            {!gap.lastReviewedAt && (
              <View style={styles.gapMetaItem}>
                <AlertTriangle size={12} color="#EF4444" />
                <Text style={[styles.gapMetaText, { color: '#EF4444' }]}>Never reviewed</Text>
              </View>
            )}
            <View style={[styles.urgencyChip, { backgroundColor: urgencyInfo.color + '18' }]}>
              <Text style={[styles.urgencyChipText, { color: urgencyInfo.color }]}>
                {urgencyInfo.label}
              </Text>
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.practiceBtn,
              pressed && styles.practiceBtnPressed,
            ]}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onPractice(gap);
            }}
            testID={`practice-gap-${gap.id}`}
          >
            <Play size={14} color="#fff" />
            <Text style={styles.practiceBtnText}>Practice Now</Text>
          </Pressable>
        </View>
      </PulsingBorder>
    </Animated.View>
  );
}

function CategorySection({
  group,
  onPracticeGap,
  sectionIndex,
}: {
  group: CategoryGroup;
  onPracticeGap: (gap: GapItem) => void;
  sectionIndex: number;
}) {
  const meta = CATEGORY_META[group.category];
  const totalGaps = group.gaps.length;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        delay: sectionIndex * 100,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 350,
        delay: sectionIndex * 100,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start();
  }, [slideAnim, opacityAnim, sectionIndex]);

  const easyPct = totalGaps > 0 ? (group.easyCount / totalGaps) * 100 : 0;
  const okayPct = totalGaps > 0 ? (group.okayCount / totalGaps) * 100 : 0;
  const hardPct = totalGaps > 0 ? (group.hardCount / totalGaps) * 100 : 0;

  const sortedGaps = useMemo(() => {
    return [...group.gaps].sort((a, b) => {
      const aInfo = group.urgencyMap.get(a.id);
      const bInfo = group.urgencyMap.get(b.id);
      return (bInfo?.priority ?? 0) - (aInfo?.priority ?? 0);
    });
  }, [group.gaps, group.urgencyMap]);

  return (
    <Animated.View
      style={[
        styles.categorySection,
        {
          opacity: opacityAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={styles.categoryHeader}>
        <View style={[styles.categoryIconBg, { backgroundColor: meta.bg }]}>
          {meta.icon}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.categoryLabel}>{meta.label}</Text>
          <Text style={styles.categoryCount}>
            {totalGaps} gap{totalGaps !== 1 ? 's' : ''}
          </Text>
        </View>
        <View style={[styles.healthDot, { backgroundColor: group.healthColor }]} />
        <Text style={[styles.healthLabel, { color: group.healthColor }]}>
          {group.healthLabel}
        </Text>
      </View>

      <View style={styles.healthBar}>
        {easyPct > 0 && (
          <View style={[styles.healthBarSegment, { width: `${easyPct}%` as any, backgroundColor: '#10B981' }]} />
        )}
        {okayPct > 0 && (
          <View style={[styles.healthBarSegment, { width: `${okayPct}%` as any, backgroundColor: '#F59E0B' }]} />
        )}
        {hardPct > 0 && (
          <View style={[styles.healthBarSegment, { width: `${hardPct}%` as any, backgroundColor: '#EF4444' }]} />
        )}
      </View>

      <View style={styles.healthBarLegend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
          <Text style={styles.legendText}>{group.easyCount} easy</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
          <Text style={styles.legendText}>{group.okayCount} okay</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
          <Text style={styles.legendText}>{group.hardCount} hard</Text>
        </View>
      </View>

      {sortedGaps.map((gap, idx) => (
        <GapCard
          key={gap.id}
          gap={gap}
          urgencyInfo={group.urgencyMap.get(gap.id)!}
          onPractice={onPracticeGap}
          index={idx}
        />
      ))}
    </Animated.View>
  );
}

export default function WeaknessMapScreen() {
  const router = useRouter();
  const { gaps } = useApp();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(headerSlide, {
        toValue: 0,
        duration: 400,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start();
  }, [fadeAnim, headerSlide]);

  const activeGaps = useMemo(() => gaps.filter((g) => !g.masteredAt), [gaps]);

  const healthScore = useMemo(() => getGapHealthScore(gaps), [gaps]);

  const totalGaps = gaps.length;
  const masteredCount = useMemo(() => gaps.filter((g) => g.masteredAt).length, [gaps]);
  const masteredPct = totalGaps > 0 ? Math.round((masteredCount / totalGaps) * 100) : 0;

  const categoryGroups = useMemo(() => {
    const categories: GapCategory[] = ['vocabulary', 'grammar', 'pronunciation', 'phrasing', 'register'];
    const groups: CategoryGroup[] = [];

    for (const cat of categories) {
      const catGaps = activeGaps.filter((g) => g.category === cat);
      if (catGaps.length === 0) continue;

      const urgencyMap = new Map<string, GapUrgencyInfo>();
      let easyCount = 0;
      let okayCount = 0;
      let hardCount = 0;

      for (const gap of catGaps) {
        urgencyMap.set(gap.id, classifyGapUrgency(gap));
        if (gap.difficulty === 'easy') easyCount++;
        else if (gap.difficulty === 'okay') okayCount++;
        else hardCount++;
      }

      let healthColor: string;
      let healthLabel: string;
      const hardRatio = hardCount / catGaps.length;
      const easyRatio = easyCount / catGaps.length;

      if (easyRatio > 0.6) {
        healthColor = '#10B981';
        healthLabel = 'Strong';
      } else if (hardRatio > 0.5) {
        healthColor = '#EF4444';
        healthLabel = 'Weak';
      } else {
        healthColor = '#F59E0B';
        healthLabel = 'Mixed';
      }

      groups.push({
        category: cat,
        gaps: catGaps,
        urgencyMap,
        healthColor,
        healthLabel,
        easyCount,
        okayCount,
        hardCount,
      });
    }

    groups.sort((a, b) => {
      const order = { Weak: 0, Mixed: 1, Strong: 2 };
      return (order[a.healthLabel as keyof typeof order] ?? 1) - (order[b.healthLabel as keyof typeof order] ?? 1);
    });

    return groups;
  }, [activeGaps]);

  const weakestCategory = useMemo(() => {
    if (categoryGroups.length === 0) return null;
    return categoryGroups[0];
  }, [categoryGroups]);

  const handlePracticeGap = useCallback(
    (gap: GapItem) => {
      console.log('[WeaknessMap] Practice gap:', gap.id, gap.frenchWord);
      router.push({
        pathname: '/gap-quiz',
        params: { gapIds: gap.id },
      });
    },
    [router]
  );

  const scoreColor = healthScore.score >= 70 ? '#10B981' : healthScore.score >= 50 ? '#F59E0B' : '#EF4444';

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeTop}>
        <View style={styles.navBar}>
          <Pressable
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }}
            style={styles.backBtn}
            testID="weakness-map-back"
          >
            <ArrowLeft size={22} color={Colors.text} />
          </Pressable>
          <Text style={styles.navTitle}>Weakness Map</Text>
          <View style={styles.navSpacer} />
        </View>
      </SafeAreaView>

      <Animated.ScrollView
        style={[styles.scrollView, { opacity: fadeAnim }]}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <Animated.View style={{ transform: [{ translateY: headerSlide }] }}>
          <View style={styles.summaryCard}>
            <View style={styles.summaryTop}>
              <View style={styles.scoreRing}>
                <View style={[styles.scoreRingInner, { borderColor: scoreColor }]}>
                  <Text style={[styles.scoreValue, { color: scoreColor }]}>
                    {healthScore.score}
                  </Text>
                </View>
              </View>
              <View style={styles.summaryInfo}>
                <Text style={styles.summaryLabel}>{healthScore.label}</Text>
                <Text style={styles.summaryDesc}>{healthScore.description}</Text>
              </View>
            </View>

            <View style={styles.summaryStats}>
              <View style={styles.summaryStat}>
                <Text style={styles.summaryStatValue}>{totalGaps}</Text>
                <Text style={styles.summaryStatLabel}>Total</Text>
              </View>
              <View style={styles.summaryStatDivider} />
              <View style={styles.summaryStat}>
                <Text style={[styles.summaryStatValue, { color: '#10B981' }]}>{masteredPct}%</Text>
                <Text style={styles.summaryStatLabel}>Mastered</Text>
              </View>
              <View style={styles.summaryStatDivider} />
              <View style={styles.summaryStat}>
                <Text style={[styles.summaryStatValue, { color: weakestCategory?.healthColor ?? Colors.textMuted }]}>
                  {weakestCategory ? CATEGORY_META[weakestCategory.category].label : '—'}
                </Text>
                <Text style={styles.summaryStatLabel}>Weakest</Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {activeGaps.length === 0 ? (
          <View style={styles.emptyState}>
            <Brain size={48} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>No active gaps</Text>
            <Text style={styles.emptyDesc}>
              Start reading, speaking, or completing lessons to discover your learning gaps.
            </Text>
          </View>
        ) : (
          categoryGroups.map((group, idx) => (
            <CategorySection
              key={group.category}
              group={group}
              onPracticeGap={handlePracticeGap}
              sectionIndex={idx}
            />
          ))
        )}

        <View style={{ height: 40 }} />
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  safeTop: {
    backgroundColor: Colors.background,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  navSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  summaryCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  summaryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 20,
  },
  scoreRing: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreRingInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  scoreValue: {
    fontSize: 24,
    fontWeight: '800' as const,
    letterSpacing: -0.5,
  },
  summaryInfo: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
    letterSpacing: -0.3,
  },
  summaryDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  summaryStats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 14,
    padding: 14,
  },
  summaryStat: {
    flex: 1,
    alignItems: 'center',
  },
  summaryStatValue: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
    letterSpacing: -0.3,
  },
  summaryStatLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
    fontWeight: '500' as const,
  },
  summaryStatDivider: {
    width: 1,
    height: 28,
    backgroundColor: Colors.borderLight,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  emptyDesc: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  categorySection: {
    marginBottom: 24,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  categoryIconBg: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryLabel: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    letterSpacing: -0.2,
  },
  categoryCount: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 1,
  },
  healthDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  healthLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  healthBar: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
    marginBottom: 8,
  },
  healthBarSegment: {
    height: '100%',
  },
  healthBarLegend: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '500' as const,
  },
  gapCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  gapCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 10,
  },
  gapFrench: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.text,
    letterSpacing: -0.2,
  },
  gapEnglish: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  diffBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  diffBadgeText: {
    fontSize: 11,
    fontWeight: '600' as const,
  },
  gapMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  gapMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  gapMetaText: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '500' as const,
  },
  urgencyChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  urgencyChipText: {
    fontSize: 10,
    fontWeight: '600' as const,
  },
  practiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
  },
  practiceBtnPressed: {
    opacity: 0.85,
  },
  practiceBtnText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#fff',
  },
});
