import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { TrendingUp, ChevronRight, Clock, AlertCircle, Sparkles } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import type { RetentionStats } from '@/utils/retentionAnalytics';
import { getRetentionLabel } from '@/utils/retentionAnalytics';

interface Props {
  stats: RetentionStats;
  onPress: () => void;
  onReviewDue?: () => void;
}

function RetentionCardInner({ stats, onPress, onReviewDue }: Props) {
  const { retentionPercent, fresh, fading, atRisk, mastered, dueToday, masteredThisWeek } = stats;
  const label = getRetentionLabel(retentionPercent);
  const total = Math.max(1, fresh.length + fading.length + atRisk.length + mastered.length);

  const freshPct = ((fresh.length + mastered.length) / total) * 100;
  const fadingPct = (fading.length / total) * 100;
  const atRiskPct = (atRisk.length / total) * 100;

  return (
    <Pressable
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.95 }]}
      testID="retention-card"
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconBg}>
            <TrendingUp size={16} color="#059669" />
          </View>
          <View>
            <Text style={styles.title}>Retention</Text>
            <Text style={styles.subtitle}>How well your words are holding</Text>
          </View>
        </View>
        <ChevronRight size={16} color={Colors.textMuted} />
      </View>

      <View style={styles.percentRow}>
        <Text style={styles.percent}>{retentionPercent}%</Text>
        <View style={[styles.labelChip, { backgroundColor: label.color + '15' }]}>
          <Text style={[styles.labelText, { color: label.color }]}>{label.label}</Text>
        </View>
      </View>

      <View style={styles.curveTrack}>
        {freshPct > 0 && (
          <View style={[styles.curveSeg, { flex: freshPct, backgroundColor: '#10B981' }]} />
        )}
        {fadingPct > 0 && (
          <View style={[styles.curveSeg, { flex: fadingPct, backgroundColor: '#F59E0B' }]} />
        )}
        {atRiskPct > 0 && (
          <View style={[styles.curveSeg, { flex: atRiskPct, backgroundColor: '#EF4444' }]} />
        )}
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
          <Text style={styles.legendLabel}>Fresh</Text>
          <Text style={styles.legendValue}>{fresh.length + mastered.length}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
          <Text style={styles.legendLabel}>Fading</Text>
          <Text style={styles.legendValue}>{fading.length}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
          <Text style={styles.legendLabel}>At risk</Text>
          <Text style={styles.legendValue}>{atRisk.length}</Text>
        </View>
      </View>

      <View style={styles.statsStrip}>
        <View style={styles.statCell}>
          <Sparkles size={13} color="#059669" />
          <Text style={styles.statCellValue}>{masteredThisWeek}</Text>
          <Text style={styles.statCellLabel}>mastered{'\n'}this week</Text>
        </View>
        <View style={styles.statCellDivider} />
        <View style={styles.statCell}>
          <Clock size={13} color={Colors.primary} />
          <Text style={styles.statCellValue}>{dueToday.length}</Text>
          <Text style={styles.statCellLabel}>due{'\n'}today</Text>
        </View>
        <View style={styles.statCellDivider} />
        <View style={styles.statCell}>
          <AlertCircle size={13} color="#EF4444" />
          <Text style={styles.statCellValue}>{atRisk.length}</Text>
          <Text style={styles.statCellLabel}>slipping{'\n'}back</Text>
        </View>
      </View>

      {dueToday.length > 0 && onReviewDue ? (
        <Pressable
          style={({ pressed }) => [styles.reviewBtn, pressed && { opacity: 0.85 }]}
          onPress={(e) => {
            e.stopPropagation?.();
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onReviewDue();
          }}
          testID="retention-review-due"
        >
          <Text style={styles.reviewBtnText}>Review {dueToday.length} due now</Text>
        </Pressable>
      ) : null}
    </Pressable>
  );
}

export default React.memo(RetentionCardInner);

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBg: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  subtitle: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
  percentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  percent: {
    fontSize: 40,
    fontWeight: '800' as const,
    color: Colors.text,
    letterSpacing: -1,
  },
  labelChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  labelText: {
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 0.3,
  },
  curveTrack: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: Colors.borderLight,
    marginBottom: 12,
  },
  curveSeg: {
    height: '100%',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  legendValue: {
    fontSize: 12,
    color: Colors.text,
    fontWeight: '700' as const,
  },
  statsStrip: {
    flexDirection: 'row',
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  statCellDivider: {
    width: 1,
    backgroundColor: Colors.border,
    marginVertical: 4,
  },
  statCellValue: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.text,
    marginTop: 2,
  },
  statCellLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    textAlign: 'center' as const,
    lineHeight: 12,
  },
  reviewBtn: {
    marginTop: 14,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  reviewBtnText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#fff',
    letterSpacing: 0.2,
  },
});
