import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Flame, Trophy } from 'lucide-react-native';
import Colors from '@/constants/colors';
import type { MasteryStreakInfo } from '@/utils/masteryStreak';

interface Props {
  info: MasteryStreakInfo;
}

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function MasteryStreakCardInner({ info }: Props) {
  const todayLabel = useMemo(() => {
    if (info.masteredToday > 0) {
      return `${info.masteredToday} mastered today`;
    }
    return 'Master one word to extend your streak';
  }, [info.masteredToday]);

  const startDayIndex = useMemo(() => {
    const first = info.last7[0]?.date;
    if (!first) return 0;
    return new Date(first).getDay();
  }, [info.last7]);

  return (
    <View style={styles.card} testID="mastery-streak-card">
      <View style={styles.topRow}>
        <View style={styles.badge}>
          <Flame size={18} color="#D97706" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Mastery streak</Text>
          <Text style={styles.subtitle}>One new word mastered = one day</Text>
        </View>
        <View style={styles.longestChip}>
          <Trophy size={11} color={Colors.textMuted} />
          <Text style={styles.longestText}>Best {info.longest}</Text>
        </View>
      </View>

      <View style={styles.countRow}>
        <Text style={styles.count}>{info.current}</Text>
        <Text style={styles.countUnit}>{info.current === 1 ? 'day' : 'days'}</Text>
      </View>

      <Text style={styles.todayText}>{todayLabel}</Text>

      <View style={styles.weekGrid}>
        {info.last7.map((day, i) => {
          const dayLabel = DAY_LABELS[(startDayIndex + i) % 7];
          const isToday = i === info.last7.length - 1;
          return (
            <View key={day.date} style={styles.dayCol}>
              <View
                style={[
                  styles.dayDot,
                  day.mastered && styles.dayDotActive,
                  isToday && !day.mastered && styles.dayDotToday,
                ]}
              >
                {day.mastered ? (
                  <Text style={styles.dayDotCount}>{day.count}</Text>
                ) : null}
              </View>
              <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>
                {dayLabel}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export default React.memo(MasteryStreakCardInner);

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  badge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  subtitle: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
  longestChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: Colors.backgroundSecondary,
  },
  longestText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  count: {
    fontSize: 44,
    fontWeight: '800' as const,
    color: '#D97706',
    letterSpacing: -1,
  },
  countUnit: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  todayText: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
    marginBottom: 14,
  },
  weekGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  dayCol: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  dayDot: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: Colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  dayDotActive: {
    backgroundColor: '#FBBF24',
    borderColor: '#F59E0B',
  },
  dayDotToday: {
    borderColor: '#F59E0B',
    borderStyle: 'dashed' as const,
  },
  dayDotCount: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#78350F',
  },
  dayLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: '500' as const,
  },
  dayLabelToday: {
    color: '#D97706',
    fontWeight: '700' as const,
  },
});
