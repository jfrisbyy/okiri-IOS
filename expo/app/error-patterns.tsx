import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { getErrorPatterns } from '@/utils/errorHistoryStore';
import { buildErrorInsights, type ErrorInsight } from '@/utils/errorInsights';
import ErrorPatternCard from '@/components/ErrorPatternCard';
import ConfusionPairsSection from '@/components/ConfusionPairsSection';
import { useApp } from '@/contexts/AppContext';

export default function ErrorPatternsScreen() {
  const router = useRouter();
  const { gaps } = useApp();
  const [insights, setInsights] = useState<ErrorInsight[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    void (async () => {
      const patterns = await getErrorPatterns(20);
      setInsights(buildErrorInsights(patterns));
      setLoading(false);
    })();
  }, []);

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
            testID="error-patterns-back"
          >
            <ArrowLeft size={22} color={Colors.text} />
          </Pressable>
          <Text style={styles.navTitle}>Your patterns</Text>
          <View style={styles.navSpacer} />
        </View>
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <ConfusionPairsSection gaps={gaps} />
        <Text style={styles.intro}>
          These are the mistakes you make most often. Tap any pattern to see why it happens and practice it directly.
        </Text>
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        ) : insights.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No patterns yet</Text>
            <Text style={styles.emptyText}>
              Keep practicing — we&apos;ll surface your recurring mistakes here once we&apos;ve seen enough.
            </Text>
          </View>
        ) : (
          insights.map(insight => (
            <ErrorPatternCard
              key={insight.id}
              insight={insight}
              onPress={() => router.push(`/error-pattern/${insight.id}` as any)}
            />
          ))
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
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
  scroll: { padding: 20 },
  intro: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
    marginBottom: 16,
  },
  loading: { padding: 40, alignItems: 'center' },
  empty: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    alignItems: 'center',
  },
  emptyTitle: { fontSize: 15, fontWeight: '700' as const, color: Colors.text, marginBottom: 6 },
  emptyText: { fontSize: 12, color: Colors.textMuted, textAlign: 'center' as const, lineHeight: 17 },
});
