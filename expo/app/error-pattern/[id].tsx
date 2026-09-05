import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Lightbulb, Play } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { getErrorPatterns, getRecentErrors, type ErrorEntry, type ErrorType } from '@/utils/errorHistoryStore';
import { buildErrorInsights, buildInsightHeadline, type ErrorInsight } from '@/utils/errorInsights';

export default function ErrorPatternScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [insight, setInsight] = useState<ErrorInsight | null>(null);
  const [allErrors, setAllErrors] = useState<ErrorEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    void (async () => {
      try {
        const [patterns, recent] = await Promise.all([
          getErrorPatterns(20),
          getRecentErrors(200),
        ]);
        const insights = buildErrorInsights(patterns);
        const found = insights.find(i => i.id === (id as ErrorType));
        setInsight(found || null);
        setAllErrors(recent.filter(e => e.errorType === (id as ErrorType)));
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const headline = useMemo(() => (insight ? buildInsightHeadline(insight) : ''), [insight]);

  const handlePractice = () => {
    if (!insight) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/gap-lesson?category=mixed' as any);
  };

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
            testID="error-pattern-back"
          >
            <ArrowLeft size={22} color={Colors.text} />
          </Pressable>
          <Text style={styles.navTitle}>Your pattern</Text>
          <View style={styles.navSpacer} />
        </View>
      </SafeAreaView>

      {loading ? (
        <View style={styles.loadingView}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : !insight ? (
        <View style={styles.loadingView}>
          <Text style={styles.emptyText}>Pattern not found.</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <View style={[styles.heroCard, { backgroundColor: insight.bg }]}>
            <View style={[styles.catChip, { backgroundColor: insight.color + '20' }]}>
              <Text style={[styles.catText, { color: insight.color }]}>
                {insight.category.toUpperCase()}
              </Text>
            </View>
            <Text style={styles.heroTitle}>{insight.title}</Text>
            <Text style={[styles.heroHeadline, { color: insight.color }]}>{headline}</Text>
            <View style={styles.heroStats}>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatValue}>{insight.count}</Text>
                <Text style={styles.heroStatLabel}>times</Text>
              </View>
              <View style={styles.heroStatDivider} />
              <View style={styles.heroStat}>
                <Text style={styles.heroStatValue}>{insight.percentage}%</Text>
                <Text style={styles.heroStatLabel}>of your errors</Text>
              </View>
            </View>
          </View>

          <View style={styles.explainCard}>
            <View style={styles.explainHead}>
              <Lightbulb size={15} color={insight.color} />
              <Text style={styles.explainTitle}>Here&apos;s why</Text>
            </View>
            <Text style={styles.explainBody}>{insight.explanation}</Text>
          </View>

          <Text style={styles.sectionLabel}>Your actual mistakes</Text>
          <View style={styles.errorList}>
            {allErrors.slice(0, 20).map((err, i) => (
              <View key={`${err.timestamp}-${i}`} style={styles.errorRow}>
                <Text style={styles.errorWrong} numberOfLines={1}>{err.wrongAnswer}</Text>
                <Text style={styles.errorArrow}>→</Text>
                <Text style={styles.errorCorrect} numberOfLines={1}>{err.correctAnswer}</Text>
              </View>
            ))}
            {allErrors.length === 0 && (
              <View style={styles.errorEmpty}>
                <Text style={styles.emptyText}>No individual examples stored yet.</Text>
              </View>
            )}
          </View>

          <Pressable
            onPress={handlePractice}
            style={({ pressed }) => [
              styles.practiceBtn,
              { backgroundColor: insight.color },
              pressed && { opacity: 0.9 },
            ]}
            testID="error-pattern-practice"
          >
            <Play size={16} color="#fff" fill="#fff" />
            <Text style={styles.practiceBtnText}>Practice this pattern</Text>
          </Pressable>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  safeTop: { backgroundColor: Colors.background },
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
  navTitle: { fontSize: 17, fontWeight: '600' as const, color: Colors.text },
  navSpacer: { width: 40 },
  loadingView: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 13, color: Colors.textMuted },
  scroll: { padding: 20, paddingBottom: 40 },
  heroCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  catChip: {
    alignSelf: 'flex-start' as const,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 10,
  },
  catText: { fontSize: 10, fontWeight: '700' as const, letterSpacing: 0.6 },
  heroTitle: { fontSize: 24, fontWeight: '800' as const, color: Colors.text, letterSpacing: -0.3 },
  heroHeadline: { fontSize: 14, fontWeight: '600' as const, marginTop: 6, lineHeight: 20 },
  heroStats: { flexDirection: 'row', alignItems: 'center', marginTop: 14, gap: 14 },
  heroStat: { gap: 2 },
  heroStatValue: { fontSize: 20, fontWeight: '800' as const, color: Colors.text },
  heroStatLabel: { fontSize: 11, color: Colors.textSecondary, fontWeight: '500' as const },
  heroStatDivider: { width: 1, height: 30, backgroundColor: 'rgba(0,0,0,0.1)' },
  explainCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginBottom: 18,
  },
  explainHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  explainTitle: { fontSize: 13, fontWeight: '700' as const, color: Colors.text, letterSpacing: 0.2 },
  explainBody: { fontSize: 13, color: Colors.textSecondary, lineHeight: 20 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 10,
    letterSpacing: -0.1,
  },
  errorList: { gap: 6, marginBottom: 20 },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: Colors.backgroundCard,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  errorWrong: {
    flex: 1,
    fontSize: 13,
    color: '#EF4444',
    textDecorationLine: 'line-through' as const,
    fontWeight: '500' as const,
  },
  errorArrow: { fontSize: 13, color: Colors.textMuted },
  errorCorrect: { flex: 1, fontSize: 13, color: '#059669', fontWeight: '600' as const },
  errorEmpty: {
    padding: 20,
    backgroundColor: Colors.backgroundCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    alignItems: 'center',
  },
  practiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: 14,
  },
  practiceBtnText: { fontSize: 15, fontWeight: '700' as const, color: '#fff', letterSpacing: 0.3 },
});
