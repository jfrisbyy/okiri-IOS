import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import type { ErrorInsight } from '@/utils/errorInsights';
import { buildInsightHeadline } from '@/utils/errorInsights';

interface Props {
  insight: ErrorInsight;
  onPress: () => void;
}

function ErrorPatternCardInner({ insight, onPress }: Props) {
  const headline = buildInsightHeadline(insight);

  return (
    <Pressable
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
      testID={`error-pattern-${insight.id}`}
    >
      <View style={[styles.stripe, { backgroundColor: insight.color }]} />
      <View style={styles.content}>
        <View style={styles.topRow}>
          <View style={[styles.catChip, { backgroundColor: insight.bg }]}>
            <Text style={[styles.catText, { color: insight.color }]}>
              {insight.category.toUpperCase()}
            </Text>
          </View>
          <Text style={styles.count}>{insight.count}×</Text>
        </View>
        <Text style={styles.headline}>{headline}</Text>
        <Text style={styles.subtitle} numberOfLines={2}>
          {insight.subtitle}
        </Text>
        {insight.examples[0] ? (
          <View style={styles.exampleRow}>
            <Text style={styles.exampleWrong} numberOfLines={1}>
              {insight.examples[0].wrong}
            </Text>
            <Text style={styles.arrow}>→</Text>
            <Text style={styles.exampleRight} numberOfLines={1}>
              {insight.examples[0].correct}
            </Text>
          </View>
        ) : null}
        <View style={styles.footer}>
          <Text style={[styles.cta, { color: insight.color }]}>Practice this pattern</Text>
          <ChevronRight size={14} color={insight.color} />
        </View>
      </View>
    </Pressable>
  );
}

export default React.memo(ErrorPatternCardInner);

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.backgroundCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    overflow: 'hidden',
    marginBottom: 10,
  },
  stripe: {
    width: 4,
  },
  content: {
    flex: 1,
    padding: 14,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  catChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  catText: {
    fontSize: 10,
    fontWeight: '700' as const,
    letterSpacing: 0.6,
  },
  count: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.textMuted,
  },
  headline: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.text,
    lineHeight: 19,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 16,
    marginBottom: 10,
  },
  exampleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 8,
    marginBottom: 10,
  },
  exampleWrong: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: '#EF4444',
    textDecorationLine: 'line-through' as const,
    flex: 1,
  },
  arrow: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  exampleRight: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#059669',
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cta: {
    fontSize: 12,
    fontWeight: '700' as const,
    letterSpacing: 0.2,
  },
});
