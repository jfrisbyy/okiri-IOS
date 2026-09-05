import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, ChevronRight, Sparkles, Clock, AlertCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useApp } from '@/contexts/AppContext';
import { computeRetentionStats, getRetentionLabel } from '@/utils/retentionAnalytics';
import type { GapItem } from '@/types';

type TabKey = 'at_risk' | 'fading' | 'fresh' | 'mastered';

const TAB_META: Record<TabKey, { label: string; color: string; bg: string }> = {
  at_risk: { label: 'At risk', color: '#EF4444', bg: '#FEF2F2' },
  fading: { label: 'Fading', color: '#F59E0B', bg: '#FFFBEB' },
  fresh: { label: 'Fresh', color: '#10B981', bg: '#ECFDF5' },
  mastered: { label: 'Mastered', color: '#059669', bg: '#D1FAE5' },
};

export default function RetentionScreen() {
  const router = useRouter();
  const { gaps } = useApp();
  const [tab, setTab] = useState<TabKey>('at_risk');

  const stats = useMemo(() => computeRetentionStats(gaps), [gaps]);
  const label = getRetentionLabel(stats.retentionPercent);

  const currentList: GapItem[] = useMemo(() => {
    if (tab === 'at_risk') return stats.atRisk;
    if (tab === 'fading') return stats.fading;
    if (tab === 'fresh') return stats.fresh;
    return stats.mastered;
  }, [tab, stats]);

  const handleReview = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/srs-review' as any);
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
            testID="retention-back"
          >
            <ArrowLeft size={22} color={Colors.text} />
          </Pressable>
          <Text style={styles.navTitle}>Retention</Text>
          <View style={styles.navSpacer} />
        </View>
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Your overall retention</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryValue}>{stats.retentionPercent}%</Text>
            <View style={[styles.summaryChip, { backgroundColor: label.color + '15' }]}>
              <Text style={[styles.summaryChipText, { color: label.color }]}>{label.label}</Text>
            </View>
          </View>
          <Text style={styles.summaryHint}>
            Based on how recently and consistently you got each word right.
          </Text>
        </View>

        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <Sparkles size={14} color="#059669" />
            <Text style={styles.kpiValue}>{stats.masteredThisWeek}</Text>
            <Text style={styles.kpiLabel}>mastered this week</Text>
          </View>
          <View style={styles.kpiCard}>
            <Clock size={14} color={Colors.primary} />
            <Text style={styles.kpiValue}>{stats.dueToday.length}</Text>
            <Text style={styles.kpiLabel}>due today</Text>
          </View>
          <View style={styles.kpiCard}>
            <AlertCircle size={14} color="#EF4444" />
            <Text style={styles.kpiValue}>{stats.atRisk.length}</Text>
            <Text style={styles.kpiLabel}>slipping back</Text>
          </View>
        </View>

        <View style={styles.tabsRow}>
          {(Object.keys(TAB_META) as TabKey[]).map(key => {
            const meta = TAB_META[key];
            const count =
              key === 'at_risk' ? stats.atRisk.length :
              key === 'fading' ? stats.fading.length :
              key === 'fresh' ? stats.fresh.length : stats.mastered.length;
            const active = tab === key;
            return (
              <Pressable
                key={key}
                onPress={() => {
                  void Haptics.selectionAsync();
                  setTab(key);
                }}
                style={[styles.tab, active && { backgroundColor: meta.bg, borderColor: meta.color }]}
                testID={`retention-tab-${key}`}
              >
                <Text style={[styles.tabLabel, active && { color: meta.color }]}>{meta.label}</Text>
                <Text style={[styles.tabCount, active && { color: meta.color }]}>{count}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.list}>
          {currentList.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Nothing here</Text>
              <Text style={styles.emptyText}>
                {tab === 'at_risk'
                  ? 'Great — nothing is slipping right now.'
                  : tab === 'mastered'
                  ? 'Keep reviewing to start mastering words.'
                  : 'Words will land here as you learn.'}
              </Text>
            </View>
          ) : (
            currentList.slice(0, 100).map(gap => (
              <View key={gap.id} style={styles.itemRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemFrench} numberOfLines={1}>{gap.frenchWord}</Text>
                  <Text style={styles.itemEnglish} numberOfLines={1}>{gap.englishTranslation}</Text>
                </View>
                <View style={styles.itemMeta}>
                  <Text style={styles.itemMetaText}>
                    {gap.consecutiveCorrect}/5
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        {stats.dueToday.length > 0 ? (
          <Pressable
            style={({ pressed }) => [styles.reviewCta, pressed && { opacity: 0.9 }]}
            onPress={handleReview}
            testID="retention-review-now"
          >
            <Text style={styles.reviewCtaText}>Review {stats.dueToday.length} due now</Text>
            <ChevronRight size={18} color="#fff" />
          </Pressable>
        ) : null}

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
  scroll: { padding: 20, paddingBottom: 40 },
  summaryCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginBottom: 14,
  },
  summaryLabel: { fontSize: 12, color: Colors.textMuted, marginBottom: 6, fontWeight: '500' as const },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  summaryValue: { fontSize: 44, fontWeight: '800' as const, color: Colors.text, letterSpacing: -1 },
  summaryChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  summaryChipText: { fontSize: 12, fontWeight: '700' as const, letterSpacing: 0.3 },
  summaryHint: { fontSize: 12, color: Colors.textSecondary, marginTop: 6, lineHeight: 17 },
  kpiRow: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  kpiCard: {
    flex: 1,
    backgroundColor: Colors.backgroundCard,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    alignItems: 'flex-start',
    gap: 4,
  },
  kpiValue: { fontSize: 20, fontWeight: '700' as const, color: Colors.text, marginTop: 4 },
  kpiLabel: { fontSize: 11, color: Colors.textMuted, lineHeight: 14 },
  tabsRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  tab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    alignItems: 'center',
    gap: 2,
  },
  tabLabel: { fontSize: 11, fontWeight: '600' as const, color: Colors.textSecondary },
  tabCount: { fontSize: 14, fontWeight: '800' as const, color: Colors.text },
  list: { gap: 8, marginBottom: 18 },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: Colors.backgroundCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  itemFrench: { fontSize: 14, fontWeight: '600' as const, color: Colors.text },
  itemEnglish: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  itemMeta: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 8,
  },
  itemMetaText: { fontSize: 11, fontWeight: '700' as const, color: Colors.textSecondary },
  emptyCard: {
    padding: 24,
    backgroundColor: Colors.backgroundCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    alignItems: 'center',
  },
  emptyTitle: { fontSize: 14, fontWeight: '700' as const, color: Colors.text, marginBottom: 4 },
  emptyText: { fontSize: 12, color: Colors.textMuted, textAlign: 'center' as const, lineHeight: 17 },
  reviewCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: Colors.primary,
  },
  reviewCtaText: { fontSize: 15, fontWeight: '700' as const, color: '#fff', letterSpacing: 0.2 },
});
