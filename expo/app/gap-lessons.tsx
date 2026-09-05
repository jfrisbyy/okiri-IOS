import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
import * as Haptics from 'expo-haptics';
import {
  ArrowLeft,
  Brain,
  Sparkles,
  ChevronRight,
  Target,
  Layers,
  BookOpen,
  Mic,
  Volume2,
  MessageCircle,
  Shield,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { USE_NATIVE_DRIVER } from '@/constants/animation';
import { useApp } from '@/contexts/AppContext';
import { GapCategory, ConceptCluster } from '@/types';
import { analyzeGapConcepts } from '@/utils/gapAnalyzer';
import Kiri from '@/components/Kiri';

const CATEGORY_COLORS: Record<GapCategory, string> = {
  vocabulary: '#F97316',
  grammar: '#0D9488',
  pronunciation: '#7C3AED',
  phrasing: '#F59E0B',
  register: '#10B981',
};

const CATEGORY_BG: Record<GapCategory, string> = {
  vocabulary: '#FFF7ED',
  grammar: '#F0FDFA',
  pronunciation: '#F5F3FF',
  phrasing: '#FFFBEB',
  register: '#ECFDF5',
};

const CATEGORY_ICONS: Record<GapCategory, (props: { size: number; color: string }) => React.ReactNode> = {
  vocabulary: (p) => <BookOpen {...p} />,
  grammar: (p) => <MessageCircle {...p} />,
  pronunciation: (p) => <Volume2 {...p} />,
  phrasing: (p) => <Mic {...p} />,
  register: (p) => <Shield {...p} />,
};

export default function GapLessonsScreen() {
  const router = useRouter();
  const { gaps } = useApp();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const staggerAnims = useRef(Array.from({ length: 30 }, () => new Animated.Value(0))).current;

  const clusters = useMemo(() => analyzeGapConcepts(gaps), [gaps]);
  const totalGaps = useMemo(() => clusters.reduce((sum, c) => sum + c.gapCount, 0), [clusters]);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1, duration: 400, useNativeDriver: USE_NATIVE_DRIVER,
    }).start();

    Animated.stagger(50, staggerAnims.slice(0, Math.min(clusters.length, 20)).map(anim =>
      Animated.timing(anim, { toValue: 1, duration: 300, useNativeDriver: USE_NATIVE_DRIVER })
    )).start();
  }, [fadeAnim, staggerAnims, clusters.length]);

  const handleStartLesson = useCallback((cluster: ConceptCluster) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: '/dynamic-lesson',
      params: { clusterIndex: clusters.indexOf(cluster).toString() },
    } as any);
  }, [router, clusters]);

  const getWeaknessLabel = (score: number): string => {
    if (score >= 75) return 'Needs focus';
    if (score >= 50) return 'Building';
    if (score >= 25) return 'Improving';
    return 'Strong';
  };

  const getWeaknessColor = (score: number): string => {
    if (score >= 75) return '#DC2626';
    if (score >= 50) return '#D97706';
    if (score >= 25) return '#2563EB';
    return '#059669';
  };

  if (clusters.length === 0) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.safeArea}>
          <Pressable style={styles.backButtonEmpty} onPress={() => safeGoBack()}>
            <ArrowLeft size={24} color={Colors.text} />
          </Pressable>
          <View style={styles.emptyContainer}>
            <Kiri mood="idle" size={110} />
            <Text style={styles.emptyTitle}>No concepts yet</Text>
            <Text style={styles.emptySubtitle}>
              Add gaps by reading, speaking, or doing lessons. Smart lessons will appear here as you learn.
            </Text>
            <Pressable
              style={styles.emptyButton}
              onPress={() => router.push('/(tabs)/home' as any)}
            >
              <Text style={styles.emptyButtonText}>Back to Home</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <Animated.View style={[styles.flex1, { opacity: fadeAnim }]}>
        <LinearGradient
          colors={['#312E81', '#4338CA']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <SafeAreaView edges={['top']}>
            <View style={styles.headerDecorations}>
              <View style={styles.headerCircle1} />
              <View style={styles.headerCircle2} />
              <View style={styles.headerDot1} />
              <View style={styles.headerDot2} />
            </View>

            <Pressable style={styles.backButton} onPress={() => safeGoBack()}>
              <ArrowLeft size={22} color="#E0E7FF" />
            </Pressable>

            <View style={styles.headerContent}>
              <View style={styles.titleRow}>
                <View style={styles.titleIconBg}>
                  <Brain size={22} color="#A5B4FC" />
                </View>
                <Text style={styles.title}>Smart Lessons</Text>
              </View>
              <Text style={styles.subtitle}>
                Lessons built from your gaps & the concepts they expose
              </Text>

              <View style={styles.statsRow}>
                <View style={styles.statPill}>
                  <Sparkles size={13} color="#C7D2FE" />
                  <Text style={styles.statText}>{clusters.length} concepts</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statPill}>
                  <Layers size={13} color="#C7D2FE" />
                  <Text style={styles.statText}>{totalGaps} gaps</Text>
                </View>
              </View>
            </View>
          </SafeAreaView>
        </LinearGradient>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sectionLabel}>RECOMMENDED FOR YOU</Text>

          {clusters.map((cluster, index) => {
            const anim = staggerAnims[index] || new Animated.Value(1);
            const color = CATEGORY_COLORS[cluster.category];
            const bgColor = CATEGORY_BG[cluster.category];
            const weaknessColor = getWeaknessColor(cluster.weaknessScore);
            const weaknessLabel = getWeaknessLabel(cluster.weaknessScore);
            const IconComponent = CATEGORY_ICONS[cluster.category];

            return (
              <Animated.View
                key={cluster.id}
                style={{
                  opacity: anim,
                  transform: [{
                    translateY: anim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [16, 0],
                    }),
                  }],
                }}
              >
                <Pressable
                  style={({ pressed }) => [
                    styles.clusterCard,
                    pressed && styles.clusterCardPressed,
                  ]}
                  onPress={() => handleStartLesson(cluster)}
                  testID={`cluster-card-${index}`}
                >
                  <View style={[styles.clusterStrip, { backgroundColor: color }]} />

                  <View style={styles.clusterBody}>
                    <View style={styles.clusterTopRow}>
                      <View style={[styles.clusterIconBg, { backgroundColor: bgColor }]}>
                        {IconComponent({ size: 18, color })}
                      </View>
                      <View style={styles.clusterNameArea}>
                        <Text style={styles.clusterName} numberOfLines={2}>
                          {cluster.name}
                        </Text>
                        <View style={styles.clusterBadges}>
                          {cluster.cefrLevel && (
                            <View style={[styles.cefrTag, { backgroundColor: bgColor }]}>
                              <Text style={[styles.cefrTagText, { color }]}>
                                {cluster.cefrLevel}
                              </Text>
                            </View>
                          )}
                          <View style={styles.gapTag}>
                            <Target size={10} color={Colors.textMuted} />
                            <Text style={styles.gapTagText}>
                              {cluster.gapCount} gap{cluster.gapCount !== 1 ? 's' : ''}
                            </Text>
                          </View>
                        </View>
                      </View>
                      <ChevronRight size={18} color={Colors.textMuted} />
                    </View>

                    <Text style={styles.clusterDesc} numberOfLines={2}>
                      {cluster.description}
                    </Text>

                    <View style={styles.clusterBottomRow}>
                      <View style={styles.weaknessRow}>
                        <View style={styles.weaknessTrack}>
                          <View
                            style={[
                              styles.weaknessFill,
                              { width: `${Math.min(cluster.weaknessScore, 100)}%`, backgroundColor: weaknessColor },
                            ]}
                          />
                        </View>
                        <Text style={[styles.weaknessText, { color: weaknessColor }]}>
                          {weaknessLabel}
                        </Text>
                      </View>

                      {cluster.sampleItems.length > 0 && (
                        <View style={styles.samplePills}>
                          {cluster.sampleItems.slice(0, 2).map((item, i) => (
                            <View key={i} style={[styles.samplePill, { backgroundColor: bgColor }]}>
                              <Text style={[styles.samplePillText, { color }]} numberOfLines={1}>
                                {item.french}
                              </Text>
                            </View>
                          ))}
                          {cluster.gapCount > 2 && (
                            <Text style={styles.morePills}>+{cluster.gapCount - 2}</Text>
                          )}
                        </View>
                      )}
                    </View>
                  </View>
                </Pressable>
              </Animated.View>
            );
          })}

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Lessons expand beyond your specific gaps to cover the full concept
            </Text>
          </View>
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
  flex1: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  headerGradient: {
    paddingBottom: 24,
  },
  headerDecorations: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  headerCircle1: {
    position: 'absolute',
    right: -50,
    top: -30,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(165, 180, 252, 0.1)',
  },
  headerCircle2: {
    position: 'absolute',
    left: -30,
    bottom: -20,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(165, 180, 252, 0.08)',
  },
  headerDot1: {
    position: 'absolute',
    right: 60,
    top: 50,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(199, 210, 254, 0.3)',
  },
  headerDot2: {
    position: 'absolute',
    left: 80,
    top: 70,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(199, 210, 254, 0.25)',
  },
  backButton: {
    position: 'absolute',
    top: 8,
    left: 16,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonEmpty: {
    position: 'absolute',
    top: 16,
    left: 16,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerContent: {
    paddingHorizontal: 24,
    paddingTop: 52,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  titleIconBg: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(165, 180, 252, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: '700' as const,
    color: '#E0E7FF',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(199, 210, 254, 0.75)',
    lineHeight: 20,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 12,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statDivider: {
    width: 1,
    height: 16,
    backgroundColor: 'rgba(199, 210, 254, 0.25)',
  },
  statText: {
    fontSize: 13,
    color: '#C7D2FE',
    fontWeight: '500' as const,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.textMuted,
    letterSpacing: 1,
    marginBottom: 14,
  },
  clusterCard: {
    flexDirection: 'row',
    backgroundColor: Colors.backgroundCard,
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  clusterCardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  clusterStrip: {
    width: 5,
  },
  clusterBody: {
    flex: 1,
    padding: 14,
    paddingLeft: 12,
  },
  clusterTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  clusterIconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clusterNameArea: {
    flex: 1,
  },
  clusterName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    lineHeight: 20,
  },
  clusterBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
  },
  cefrTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  cefrTagText: {
    fontSize: 10,
    fontWeight: '700' as const,
  },
  gapTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  gapTagText: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  clusterDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: 10,
  },
  clusterBottomRow: {
    gap: 8,
  },
  weaknessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  weaknessTrack: {
    flex: 1,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  weaknessFill: {
    height: '100%',
    borderRadius: 2,
  },
  weaknessText: {
    fontSize: 11,
    fontWeight: '600' as const,
    minWidth: 70,
    textAlign: 'right' as const,
  },
  samplePills: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  samplePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    maxWidth: 120,
  },
  samplePillText: {
    fontSize: 12,
    fontWeight: '500' as const,
  },
  morePills: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.text,
    marginTop: 20,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    lineHeight: 22,
    marginBottom: 28,
  },
  emptyButton: {
    backgroundColor: '#4338CA',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
  },
  emptyButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#fff',
  },
  footer: {
    marginTop: 8,
    paddingVertical: 16,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center' as const,
    lineHeight: 18,
    paddingHorizontal: 20,
  },
});
