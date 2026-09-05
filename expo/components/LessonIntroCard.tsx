import { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  ScrollView,
} from 'react-native';
import { Newspaper, Play, Mic, BookOpen, ArrowRight, Sparkles } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { USE_NATIVE_DRIVER } from '@/constants/animation';
import { GapItem } from '@/types';

interface GapSourceInfo {
  gapId: string;
  french: string;
  english: string;
  sourceType: GapItem['sourceType'];
  sourceContentId?: string;
}

interface LessonIntroCardProps {
  title: string;
  description: string;
  gapSources: GapSourceInfo[];
  onStart: () => void;
  adaptiveBadge?: string;
}

const SOURCE_CONFIG: Record<GapItem['sourceType'], {
  icon: typeof Newspaper;
  color: string;
  bg: string;
  label: string;
  message: string;
}> = {
  reading: {
    icon: Newspaper,
    color: '#0D9488',
    bg: '#F0FDFA',
    label: 'Reading',
    message: 'You encountered this while reading French news',
  },
  listening: {
    icon: Play,
    color: '#7C3AED',
    bg: '#F5F3FF',
    label: 'Watching',
    message: 'This came up in a YouTube video',
  },
  speech: {
    icon: Mic,
    color: '#E11D48',
    bg: '#FFF1F2',
    label: 'Speaking',
    message: 'This was flagged during a speaking session',
  },
  foundation: {
    icon: BookOpen,
    color: '#2563EB',
    bg: '#EFF6FF',
    label: 'Foundation',
    message: 'From your foundation lessons',
  },
};

export default function LessonIntroCard({ title, description, gapSources, onStart, adaptiveBadge }: LessonIntroCardProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const itemAnims = useRef(gapSources.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.spring(slideAnim, { toValue: 0, friction: 10, tension: 60, useNativeDriver: USE_NATIVE_DRIVER }),
    ]).start(() => {
      const staggered = itemAnims.map((anim, i) =>
        Animated.timing(anim, {
          toValue: 1,
          duration: 250,
          delay: i * 80,
          useNativeDriver: USE_NATIVE_DRIVER,
        })
      );
      Animated.stagger(80, staggered).start();
    });
  }, [fadeAnim, slideAnim, itemAnims]);

  const grouped = gapSources.reduce<Record<string, GapSourceInfo[]>>((acc, gap) => {
    const key = gap.sourceType;
    if (!acc[key]) acc[key] = [];
    acc[key].push(gap);
    return acc;
  }, {});

  const sourceEntries = Object.entries(grouped) as [GapItem['sourceType'], GapSourceInfo[]][];

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerBadge}>
          <Sparkles size={14} color="#F97316" />
          <Text style={styles.headerBadgeText}>Personalized Lesson</Text>
        </View>
        {adaptiveBadge ? (
          <View style={styles.adaptiveBadge} testID="adaptive-badge">
            <Text style={styles.adaptiveBadgeText}>{adaptiveBadge}</Text>
          </View>
        ) : null}

        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>

        <View style={styles.divider} />

        <Text style={styles.sectionLabel}>WHERE THESE GAPS CAME FROM</Text>

        {sourceEntries.map(([sourceType, gaps], groupIdx) => {
          const config = SOURCE_CONFIG[sourceType];
          const Icon = config.icon;

          return (
            <Animated.View
              key={sourceType}
              style={[
                styles.sourceGroup,
                {
                  opacity: itemAnims[Math.min(groupIdx, itemAnims.length - 1)] ?? fadeAnim,
                  transform: [{
                    translateX: (itemAnims[Math.min(groupIdx, itemAnims.length - 1)] ?? fadeAnim).interpolate({
                      inputRange: [0, 1],
                      outputRange: [40, 0],
                    }),
                  }],
                },
              ]}
            >
              <View style={[styles.sourceHeader, { backgroundColor: config.bg }]}>
                <View style={[styles.sourceIconCircle, { backgroundColor: config.color + '18' }]}>
                  <Icon size={18} color={config.color} />
                </View>
                <View style={styles.sourceHeaderText}>
                  <Text style={[styles.sourceLabel, { color: config.color }]}>{config.label}</Text>
                  <Text style={styles.sourceMessage}>{config.message}</Text>
                </View>
              </View>

              <View style={styles.gapChips}>
                {gaps.slice(0, 6).map((gap) => (
                  <View key={gap.gapId} style={styles.gapChip}>
                    <Text style={styles.gapChipFrench}>{gap.french}</Text>
                    <Text style={styles.gapChipArrow}>→</Text>
                    <Text style={styles.gapChipEnglish}>{gap.english}</Text>
                  </View>
                ))}
                {gaps.length > 6 && (
                  <View style={styles.moreChip}>
                    <Text style={styles.moreChipText}>+{gaps.length - 6} more</Text>
                  </View>
                )}
              </View>
            </Animated.View>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={styles.startBtn} onPress={onStart}>
          <Text style={styles.startBtnText}>Start Lesson</Text>
          <ArrowRight size={20} color="#fff" />
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingTop: 16,
    paddingBottom: 32,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
  },
  headerBadgeText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#F97316',
    letterSpacing: 0.3,
  },
  adaptiveBadge: {
    alignSelf: 'flex-start' as const,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    marginBottom: 12,
  },
  adaptiveBadgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#4338CA',
    letterSpacing: 0.3,
  },
  title: {
    fontSize: 26,
    fontWeight: '800' as const,
    color: Colors.text,
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  description: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: 4,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginVertical: 20,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.textMuted,
    letterSpacing: 1.2,
    marginBottom: 16,
  },
  sourceGroup: {
    marginBottom: 18,
  },
  sourceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    gap: 12,
  },
  sourceIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceHeaderText: {
    flex: 1,
  },
  sourceLabel: {
    fontSize: 14,
    fontWeight: '700' as const,
    marginBottom: 2,
  },
  sourceMessage: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 17,
  },
  gapChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 10,
    paddingLeft: 4,
  },
  gapChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 5,
  },
  gapChipFrench: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  gapChipArrow: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  gapChipEnglish: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  moreChip: {
    backgroundColor: Colors.borderLight,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  moreChipText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textMuted,
  },
  footer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  startBtn: {
    flexDirection: 'row',
    backgroundColor: '#F97316',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  startBtnText: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: '#fff',
  },
});
