import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Shuffle, ArrowRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { GapItem } from '@/types';
import { getTopConfusionPairs } from '@/utils/confusionModel';

interface Props {
  gaps: GapItem[];
  limit?: number;
}

export default function ConfusionPairsSection({ gaps, limit = 3 }: Props) {
  const router = useRouter();
  const pairs = useMemo(() => getTopConfusionPairs(gaps, limit), [gaps, limit]);

  if (pairs.length === 0) return null;

  return (
    <View style={styles.container} testID="confusion-pairs">
      <View style={styles.header}>
        <Shuffle size={16} color={Colors.primary} />
        <Text style={styles.title}>Top confusions</Text>
      </View>
      <Text style={styles.subtitle}>You mix these up most often. One tap drills just this pair.</Text>

      {pairs.map((p, idx) => (
        <Pressable
          key={`${p.gapA.id}-${p.gapB.id}`}
          style={styles.card}
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push(`/gap-quiz?gapIds=${p.gapA.id},${p.gapB.id}&confusion=1` as any);
          }}
          testID={`confusion-pair-${idx}`}
        >
          <View style={styles.pairText}>
            <Text style={styles.word}>{p.gapA.frenchWord}</Text>
            <Text style={styles.vs}>vs</Text>
            <Text style={styles.word}>{p.gapB.frenchWord}</Text>
          </View>
          <View style={styles.meta}>
            <Text style={styles.metaText}>{p.wrongPicks} mix-ups</Text>
            <ArrowRight size={14} color={Colors.textMuted} />
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
    paddingHorizontal: 4,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  title: { fontSize: 15, fontWeight: '700' as const, color: Colors.text },
  subtitle: { fontSize: 12, color: Colors.textMuted, marginBottom: 10 },
  card: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  pairText: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  word: { fontSize: 15, fontWeight: '700' as const, color: Colors.text },
  vs: { fontSize: 11, color: Colors.textMuted, fontStyle: 'italic' as const },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 12, color: Colors.textMuted },
});
