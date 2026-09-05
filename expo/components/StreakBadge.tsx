import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Flame } from 'lucide-react-native';
import { USE_NATIVE_DRIVER } from '@/constants/animation';

interface StreakBadgeProps {
  streakCount: number;
  compact?: boolean;
}

function StreakBadgeInner({ streakCount, compact = false }: StreakBadgeProps) {
  const flameScale = useRef(new Animated.Value(1)).current;
  const badgePulse = useRef(new Animated.Value(1)).current;

  const flameSize = streakCount >= 8 ? 22 : streakCount >= 4 ? 18 : 14;
  const flameColor = streakCount >= 8 ? '#EF4444' : streakCount >= 4 ? '#F97316' : '#F59E0B';
  const bgColor = streakCount >= 8 ? '#FEF2F2' : streakCount >= 4 ? '#FFF7ED' : '#FFFBEB';
  const borderColor = streakCount >= 8 ? '#FECACA' : streakCount >= 4 ? '#FFEDD5' : '#FDE68A';
  const textColor = streakCount >= 8 ? '#DC2626' : streakCount >= 4 ? '#EA580C' : '#D97706';

  useEffect(() => {
    if (streakCount <= 0) return;

    const baseSpeed = streakCount >= 8 ? 500 : streakCount >= 4 ? 700 : 1000;
    const scaleMax = streakCount >= 8 ? 1.25 : streakCount >= 4 ? 1.15 : 1.08;

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(flameScale, {
          toValue: scaleMax,
          duration: baseSpeed,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(flameScale, {
          toValue: 0.92,
          duration: baseSpeed,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ])
    );
    animation.start();

    return () => animation.stop();
  }, [streakCount, flameScale]);

  useEffect(() => {
    if (streakCount >= 8) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(badgePulse, {
            toValue: 1.05,
            duration: 1200,
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.timing(badgePulse, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      badgePulse.setValue(1);
    }
  }, [streakCount, badgePulse]);

  if (streakCount <= 0) return null;

  if (compact) {
    return (
      <View style={[styles.compactBadge, { backgroundColor: bgColor, borderColor }]}>
        <Animated.View style={{ transform: [{ scale: flameScale }] }}>
          <Flame size={flameSize} color={flameColor} fill={flameColor} />
        </Animated.View>
        <Text style={[styles.compactText, { color: textColor }]}>{streakCount}</Text>
      </View>
    );
  }

  return (
    <Animated.View
      style={[
        styles.badge,
        { backgroundColor: bgColor, borderColor },
        { transform: [{ scale: badgePulse }] },
      ]}
    >
      <View style={styles.flameWrap}>
        <Animated.View style={{ transform: [{ scale: flameScale }] }}>
          <Flame size={flameSize} color={flameColor} fill={flameColor} />
        </Animated.View>
      </View>
      <View style={styles.textWrap}>
        <Text style={[styles.countText, { color: textColor }]}>{streakCount}</Text>
        <Text style={[styles.labelText, { color: textColor }]}>
          {streakCount === 1 ? 'day' : 'days'}
        </Text>
      </View>
    </Animated.View>
  );
}

export default React.memo(StreakBadgeInner);

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1.5,
    gap: 8,
  },
  flameWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    alignItems: 'flex-start',
  },
  countText: {
    fontSize: 20,
    fontWeight: '800' as const,
    lineHeight: 22,
  },
  labelText: {
    fontSize: 11,
    fontWeight: '600' as const,
    opacity: 0.8,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  compactBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
  },
  compactText: {
    fontSize: 14,
    fontWeight: '800' as const,
  },
});
