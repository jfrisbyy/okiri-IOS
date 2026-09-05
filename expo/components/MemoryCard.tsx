import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Brain, Clock, TrendingUp } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { GapItem } from '@/types';
import { getRetrievability, getForgettingCurvePoints } from '@/utils/fsrs';

interface Props {
  gap: GapItem;
}

function formatDays(days: number): string {
  if (days < 1) return '<1d';
  if (days < 30) return `${Math.round(days)}d`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  return `${(days / 365).toFixed(1)}y`;
}

export default function MemoryCard({ gap }: Props) {
  const state = gap.fsrs;
  const retrievability = useMemo(() => getRetrievability(state), [state]);
  const curve = useMemo(() => getForgettingCurvePoints(state, 30), [state]);

  const dueIn = useMemo(() => {
    if (!state?.dueAt) return null;
    const diff = (new Date(state.dueAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return diff;
  }, [state?.dueAt]);

  if (!state) {
    return (
      <View style={styles.card} testID="memory-card-empty">
        <View style={styles.header}>
          <Brain size={18} color={Colors.textMuted} />
          <Text style={styles.title}>Memory</Text>
        </View>
        <Text style={styles.emptyText}>Review once to start building a memory trace.</Text>
      </View>
    );
  }

  return (
    <View style={styles.card} testID="memory-card">
      <View style={styles.header}>
        <Brain size={18} color={Colors.primary} />
        <Text style={styles.title}>Memory</Text>
      </View>

      <View style={styles.row}>
        <Stat
          icon={<TrendingUp size={14} color={Colors.primary} />}
          label="Recall chance"
          value={`${Math.round(retrievability * 100)}%`}
        />
        <Stat
          icon={<Clock size={14} color={Colors.primary} />}
          label="Stability"
          value={formatDays(state.stability)}
        />
        <Stat
          icon={<Clock size={14} color={Colors.primary} />}
          label={dueIn !== null && dueIn < 0 ? 'Overdue' : 'Next review'}
          value={dueIn === null ? '—' : formatDays(Math.abs(dueIn))}
        />
      </View>

      <View style={styles.chart}>
        {curve.map((p, i) => {
          const h = Math.max(2, p.retrievability * 40);
          const isNow = i === 0;
          return (
            <View
              key={`pt-${i}`}
              style={[
                styles.bar,
                { height: h, backgroundColor: isNow ? Colors.primary : Colors.primary + '66' },
              ]}
            />
          );
        })}
      </View>
      <Text style={styles.caption}>Forgetting curve — next 30 days</Text>
    </View>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <View style={styles.statIcon}>{icon}</View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginVertical: 8,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  title: { fontSize: 15, fontWeight: '700' as const, color: Colors.text },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  stat: { flex: 1, alignItems: 'center' as const },
  statIcon: { marginBottom: 4 },
  statValue: { fontSize: 16, fontWeight: '700' as const, color: Colors.text },
  statLabel: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 44, gap: 2 },
  bar: { flex: 1, borderRadius: 2 },
  caption: { fontSize: 11, color: Colors.textMuted, textAlign: 'center' as const, marginTop: 6 },
  emptyText: { fontSize: 12, color: Colors.textMuted },
});
