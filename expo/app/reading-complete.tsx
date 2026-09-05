import { useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import ImageCardBackground from '@/components/ImageCardBackground';
import {
  Check,
  BookOpen,
  ArrowRight,
  Sparkles,
  Zap,
  Target,
  Layers,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { USE_NATIVE_DRIVER } from '@/constants/animation';
import { useApp } from '@/contexts/AppContext';
import { frenchContent } from '@/mocks/content';
import { getLibraryImageResult, getRegionFlag } from '@/utils/perplexity';
import Kiri from '@/components/Kiri';
import { Difficulty, ContentCategory } from '@/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const categoryAccents: Record<string, string> = {
  dialogue: '#3B82F6',
  article: '#6366F1',
  story: '#8B5CF6',
  fiction: '#A855F7',
  news: '#DC2626',
  culture: '#EC4899',
  history: '#D97706',
  literature: '#0EA5E9',
  science: '#2563EB',
  travel: '#059669',
  food: '#EA580C',
  music: '#7C3AED',
  sports: '#10B981',
};

const categoryLabels: Record<ContentCategory, string> = {
  dialogue: 'Dialogue',
  article: 'Article',
  story: 'Story',
  fiction: 'Fiction',
  news: 'News',
  culture: 'Culture',
  history: 'History',
  literature: 'Literature',
  science: 'Science',
  travel: 'Travel',
  food: 'Food',
  music: 'Music',
  sports: 'Sports',
};

const difficultyLabels: Record<Difficulty, string> = {
  beginner: 'Beginner',
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  university: 'University',
};

const encouragementMessages = [
  'Fantastic work! Every article brings you closer to fluency.',
  "You're doing amazing! Keep up the great reading habit.",
  'Bravo! Your French is getting stronger with each article.',
  'Excellent progress! Reading is the key to mastering French.',
  'Magnifique! You are building a solid foundation.',
  'Great job! Your vocabulary is expanding beautifully.',
  'Superb! Consistency is what makes a language learner succeed.',
  "Well done! You're one step closer to thinking in French.",
];

const getEncouragementMessage = () => {
  return encouragementMessages[
    Math.floor(Math.random() * encouragementMessages.length)
  ];
};

const getPerformanceEmoji = (percent: number) => {
  if (percent >= 90) return '🔥';
  if (percent >= 75) return '⭐';
  if (percent >= 50) return '💪';
  return '🌱';
};

const getPerformanceLabel = (percent: number) => {
  if (percent >= 90) return 'Outstanding';
  if (percent >= 75) return 'Great job';
  if (percent >= 50) return 'Good progress';
  return 'Keep going';
};

export default function ReadingCompleteScreen() {
  const { id, gapsCreated, percentWithoutHelp } = useLocalSearchParams<{
    id: string;
    gapsCreated: string;
    percentWithoutHelp: string;
  }>();
  const router = useRouter();
  const { completedContentIds, gaps } = useApp();

  const content = frenchContent.find((c) => c.id === id);
  const gapsCount = parseInt(gapsCreated || '0', 10);
  const percentHelp = parseInt(percentWithoutHelp || '0', 10);

  const accentColor = useMemo(
    () => (content ? categoryAccents[content.category] ?? '#6366F1' : '#6366F1'),
    [content]
  );

  const imgResult = useMemo(
    () =>
      content
        ? getLibraryImageResult(content.title, content.region, content.category, content.id)
        : { primary: '', fallback: '', gradient: ['#1C1C2E', '#2D1B4E', '#1a1a2e'] as [string, string, string] },
    [content]
  );

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const checkAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 7,
          tension: 50,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 450,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]),
      Animated.spring(checkAnim, {
        toValue: 1,
        friction: 6,
        tension: 80,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start();
  }, [fadeAnim, scaleAnim, slideAnim, checkAnim]);

  const recentGaps = gaps
    .filter((g) => g.sourceType === 'reading')
    .slice(-3)
    .reverse();

  const handleContinue = () => {
    router.replace('/(tabs)/read' as any);
  };

  const handleGoHome = () => {
    router.replace('/(tabs)/home' as any);
  };

  const handlePracticeGaps = () => {
    router.replace(`/gap-quiz?source=reading&sourceId=${id}` as any);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <ImageCardBackground
        uri={imgResult.primary}
        fallbackUri={imgResult.fallback}
        gradientColors={imgResult.gradient}
        style={styles.heroBg}
      >
        <LinearGradient
          colors={[
            'rgba(0,0,0,0.4)',
            'rgba(0,0,0,0.2)',
            'rgba(0,0,0,0.6)',
            '#F8F5F2',
          ]}
          locations={[0, 0.3, 0.65, 1]}
          style={styles.heroGradient}
        >
          <SafeAreaView edges={['top']}>
            <View style={styles.heroContent}>
              <Animated.View
                style={[
                  styles.checkCircle,
                  {
                    transform: [{ scale: checkAnim }],
                    backgroundColor: accentColor,
                  },
                ]}
              >
                <Check size={32} color="white" strokeWidth={3} />
              </Animated.View>
              <View style={styles.kiriFloat}>
                <Kiri mood="celebrating" size={80} />
              </View>
            </View>
          </SafeAreaView>
        </LinearGradient>
      </ImageCardBackground>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            styles.mainCard,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }, { translateY: slideAnim }],
            },
          ]}
        >
          <Text style={styles.completeTitle}>Article Complete</Text>

          {content && (
            <View style={styles.articleInfoRow}>
              <View
                style={[
                  styles.articleCatBadge,
                  { backgroundColor: `${accentColor}15` },
                ]}
              >
                <Text style={[styles.articleCatText, { color: accentColor }]}>
                  {categoryLabels[content.category]}
                </Text>
              </View>
              {content.region !== 'general' && (
                <Text style={styles.articleFlag}>
                  {getRegionFlag(content.region)}
                </Text>
              )}
              <Text style={styles.articleDiff}>
                {difficultyLabels[content.difficulty]}
              </Text>
            </View>
          )}

          {content && (
            <Text style={styles.articleTitle}>"{content.title}"</Text>
          )}

          <Text style={styles.encouragement}>{getEncouragementMessage()}</Text>

          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statEmoji}>
                {getPerformanceEmoji(percentHelp)}
              </Text>
              <Text style={[styles.statValue, { color: accentColor }]}>
                {percentHelp}%
              </Text>
              <Text style={styles.statLabel}>
                {getPerformanceLabel(percentHelp)}
              </Text>
            </View>
            <View style={styles.statBox}>
              <View style={[styles.statIconCircle, { backgroundColor: `${Colors.success}15` }]}>
                <Sparkles size={16} color={Colors.success} />
              </View>
              <Text style={[styles.statValue, { color: Colors.success }]}>
                {gapsCount}
              </Text>
              <Text style={styles.statLabel}>Words saved</Text>
            </View>
            <View style={styles.statBox}>
              <View style={[styles.statIconCircle, { backgroundColor: `${Colors.warning}15` }]}>
                <Layers size={16} color={Colors.warning} />
              </View>
              <Text style={[styles.statValue, { color: Colors.warning }]}>
                {completedContentIds.length}
              </Text>
              <Text style={styles.statLabel}>Total read</Text>
            </View>
          </View>
        </Animated.View>

        {recentGaps.length > 0 && (
          <Animated.View
            style={[
              styles.gapsCard,
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
            ]}
          >
            <View style={styles.gapsHeader}>
              <View
                style={[
                  styles.gapsIconCircle,
                  { backgroundColor: `${accentColor}15` },
                ]}
              >
                <Sparkles size={16} color={accentColor} />
              </View>
              <Text style={styles.gapsTitle}>New Words Added</Text>
            </View>
            {recentGaps.map((gap) => (
              <View key={gap.id} style={styles.gapItem}>
                <Text style={[styles.gapFrench, { color: accentColor }]}>
                  {gap.frenchWord}
                </Text>
                <Text style={styles.gapEnglish}>{gap.englishTranslation}</Text>
              </View>
            ))}
            {gapsCount > 3 && (
              <View style={styles.moreGapsRow}>
                <Text style={[styles.moreGapsText, { color: accentColor }]}>
                  +{gapsCount - 3} more words saved
                </Text>
              </View>
            )}
          </Animated.View>
        )}

        <Animated.View
          style={[
            styles.actionsContainer,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: accentColor },
              pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
            ]}
            onPress={handleContinue}
            testID="read-another-btn"
          >
            <BookOpen size={20} color="white" />
            <Text style={styles.primaryButtonText}>Read Another Article</Text>
            <ArrowRight size={18} color="white" />
          </Pressable>

          {gapsCount > 0 && (
            <Pressable
              style={({ pressed }) => [
                styles.secondaryButton,
                { backgroundColor: `${accentColor}12`, borderColor: `${accentColor}30` },
                pressed && { opacity: 0.85 },
              ]}
              onPress={handlePracticeGaps}
              testID="practice-gaps-btn"
            >
              <Target size={18} color={accentColor} />
              <Text style={[styles.secondaryButtonText, { color: accentColor }]}>
                Practice Your Gaps
              </Text>
            </Pressable>
          )}

          <Pressable
            style={({ pressed }) => [
              styles.tertiaryButton,
              pressed && { opacity: 0.6 },
            ]}
            onPress={handleGoHome}
          >
            <Text style={styles.tertiaryButtonText}>Back to Home</Text>
          </Pressable>
        </Animated.View>

        <View style={styles.tipCard}>
          <View style={styles.tipLeft}>
            <Zap size={16} color={Colors.warning} />
          </View>
          <Text style={styles.tipText}>
            Reading daily builds your French skills faster than anything else.
            Keep the streak going!
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F5F2',
  },
  heroBg: {
    width: SCREEN_WIDTH,
    height: 220,
  },
  heroGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroContent: {
    alignItems: 'center',
    paddingTop: 12,
  },
  checkCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  kiriFloat: {
    position: 'absolute',
    right: -60,
    top: -10,
    opacity: 0.9,
  },
  scrollView: {
    flex: 1,
    marginTop: -24,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  mainCard: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 6,
    marginBottom: 16,
  },
  completeTitle: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.text,
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  articleInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  articleCatBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  articleCatText: {
    fontSize: 12,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.3,
  },
  articleFlag: {
    fontSize: 16,
  },
  articleDiff: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: Colors.textMuted,
  },
  articleTitle: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    marginBottom: 14,
    fontStyle: 'italic' as const,
    lineHeight: 22,
    paddingHorizontal: 8,
  },
  encouragement: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    lineHeight: 21,
    marginBottom: 22,
    paddingHorizontal: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#FAFAF9',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  statEmoji: {
    fontSize: 20,
    marginBottom: 6,
  },
  statIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700' as const,
  },
  statLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
    fontWeight: '500' as const,
    textAlign: 'center' as const,
  },
  gapsCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  gapsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  gapsIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gapsTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  gapItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.04)',
  },
  gapFrench: {
    fontSize: 15,
    fontWeight: '600' as const,
  },
  gapEnglish: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'right' as const,
    flex: 1,
    marginLeft: 12,
  },
  moreGapsRow: {
    paddingTop: 12,
    alignItems: 'center',
  },
  moreGapsText: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  actionsContainer: {
    gap: 12,
    marginBottom: 16,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: 'white',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  tertiaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  tertiaryButtonText: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.textMuted,
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  tipLeft: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFBEB',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -2,
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 21,
  },
});
