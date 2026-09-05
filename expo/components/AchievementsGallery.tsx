import React, { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Lock } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { ACHIEVEMENTS, ACHIEVEMENT_CATEGORIES, AchievementCategory } from '@/data/achievements';
import { EarnedAchievement } from '@/data/achievements';

interface Props {
  achievements: EarnedAchievement[];
  selectedCategory: AchievementCategory | 'all';
  onCategoryChange: (cat: AchievementCategory | 'all') => void;
}

export default function AchievementsGallery({ achievements, selectedCategory, onCategoryChange }: Props) {
  const earnedIds = useMemo(() => new Set(achievements.map(a => a.id)), [achievements]);

  const filteredAchievements = useMemo(() => {
    if (selectedCategory === 'all') return ACHIEVEMENTS;
    return ACHIEVEMENTS.filter(a => a.category === selectedCategory);
  }, [selectedCategory]);

  const earnedCount = useMemo(() => {
    return ACHIEVEMENTS.filter(a => earnedIds.has(a.id)).length;
  }, [earnedIds]);

  const handleCategoryPress = useCallback((cat: AchievementCategory | 'all') => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onCategoryChange(cat);
  }, [onCategoryChange]);

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Achievements</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{earnedCount}/{ACHIEVEMENTS.length}</Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
        style={styles.filterScroll}
      >
        <Pressable
          style={[
            styles.filterChip,
            selectedCategory === 'all' && styles.filterChipActive,
          ]}
          onPress={() => handleCategoryPress('all')}
        >
          <Text style={[
            styles.filterChipText,
            selectedCategory === 'all' && styles.filterChipTextActive,
          ]}>All</Text>
        </Pressable>
        {ACHIEVEMENT_CATEGORIES.map(cat => (
          <Pressable
            key={cat.id}
            style={[
              styles.filterChip,
              selectedCategory === cat.id && [styles.filterChipActive, { backgroundColor: cat.color + '18', borderColor: cat.color + '40' }],
            ]}
            onPress={() => handleCategoryPress(cat.id)}
          >
            <Text style={[
              styles.filterChipText,
              selectedCategory === cat.id && { color: cat.color },
            ]}>{cat.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.grid}>
        {filteredAchievements.map(achievement => {
          const isEarned = earnedIds.has(achievement.id);
          const earned = achievements.find(a => a.id === achievement.id);
          const catColor = ACHIEVEMENT_CATEGORIES.find(c => c.id === achievement.category)?.color ?? Colors.primary;

          return (
            <View
              key={achievement.id}
              style={[
                styles.achievementCard,
                !isEarned && styles.achievementCardLocked,
              ]}
            >
              <View style={[
                styles.iconWrap,
                isEarned
                  ? { backgroundColor: catColor + '15', borderColor: catColor + '30' }
                  : { backgroundColor: '#F3F4F6', borderColor: '#E5E7EB' },
              ]}>
                {isEarned ? (
                  <Text style={styles.achievementIcon}>{achievement.icon}</Text>
                ) : (
                  <Lock size={18} color="#D1D5DB" />
                )}
              </View>
              <Text
                style={[
                  styles.achievementTitle,
                  !isEarned && styles.lockedText,
                ]}
                numberOfLines={1}
              >
                {achievement.title}
              </Text>
              {isEarned ? (
                <Text style={[styles.achievementDesc, { color: catColor }]} numberOfLines={1}>
                  +{achievement.xpReward} XP
                </Text>
              ) : (
                <Text style={styles.hintText} numberOfLines={2}>
                  {achievement.hint}
                </Text>
              )}
              {isEarned && earned && (
                <Text style={styles.earnedDate}>
                  {new Date(earned.earnedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </Text>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    letterSpacing: -0.2,
  },
  countBadge: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  countText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  filterScroll: {
    marginBottom: 12,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  filterChipActive: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary + '40',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
  },
  filterChipTextActive: {
    color: Colors.primary,
    fontWeight: '600' as const,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  achievementCard: {
    width: '47%' as any,
    flexGrow: 1,
    backgroundColor: Colors.backgroundCard,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    alignItems: 'center',
    minHeight: 130,
  },
  achievementCardLocked: {
    opacity: 0.55,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    marginBottom: 8,
  },
  achievementIcon: {
    fontSize: 24,
  },
  achievementTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.text,
    textAlign: 'center' as const,
    marginBottom: 2,
  },
  lockedText: {
    color: Colors.textMuted,
  },
  achievementDesc: {
    fontSize: 12,
    fontWeight: '700' as const,
    textAlign: 'center' as const,
  },
  hintText: {
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center' as const,
    lineHeight: 15,
  },
  earnedDate: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 4,
  },
});
