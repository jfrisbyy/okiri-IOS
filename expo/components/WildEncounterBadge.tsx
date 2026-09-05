import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { Newspaper, Video, Mic, BookOpen, Layers } from 'lucide-react-native';
import { USE_NATIVE_DRIVER } from '@/constants/animation';
import type { WildEncounterInfo } from '@/types';

interface WildEncounterBadgeProps {
  encounter: WildEncounterInfo;
}

const SOURCE_CONFIG: Record<string, { icon: typeof Newspaper; label: string; color: string; bg: string }> = {
  read: { icon: Newspaper, label: 'a news article', color: '#0369A1', bg: '#F0F9FF' },
  watch: { icon: Video, label: 'a YouTube video', color: '#7C3AED', bg: '#F5F3FF' },
  speak: { icon: Mic, label: 'a speaking session', color: '#DC2626', bg: '#FEF2F2' },
  deck: { icon: Layers, label: 'your flashcard deck', color: '#D97706', bg: '#FFFBEB' },
  foundation: { icon: BookOpen, label: 'a foundation lesson', color: '#059669', bg: '#ECFDF5' },
};

function getTimeLabel(daysAgo: number): string {
  if (daysAgo === 0) return 'today';
  if (daysAgo === 1) return 'yesterday';
  return `${daysAgo} days ago`;
}

function WildEncounterBadgeInner({ encounter }: WildEncounterBadgeProps) {
  const slideX = useRef(new Animated.Value(120)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;

  const config = SOURCE_CONFIG[encounter.sourceTab] || SOURCE_CONFIG.read;
  const Icon = config.icon;

  const contextSnippet = encounter.context
    ? encounter.context.length > 60
      ? encounter.context.slice(0, 57) + '...'
      : encounter.context
    : '';

  const message = contextSnippet
    ? `You saw this in ${config.label}: "${contextSnippet}" — ${getTimeLabel(encounter.daysAgo)}`
    : `You encountered this in ${config.label} ${getTimeLabel(encounter.daysAgo)}`;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(400),
      Animated.parallel([
        Animated.spring(slideX, {
          toValue: 0,
          friction: 10,
          tension: 60,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]),
      Animated.sequence([
        Animated.timing(glowOpacity, {
          toValue: 0.6,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(glowOpacity, {
          toValue: 0,
          duration: 600,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]),
    ]).start();
  }, [slideX, opacity, glowOpacity]);

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: config.bg, borderColor: config.color + '30' },
        {
          opacity,
          transform: [{ translateX: slideX }],
        },
      ]}
    >
      <Animated.View
        style={[
          styles.glow,
          { backgroundColor: config.color, opacity: glowOpacity },
        ]}
        pointerEvents="none"
      />
      <View style={[styles.iconWrap, { backgroundColor: config.color + '18' }]}>
        <Icon size={14} color={config.color} />
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.titleText}>
          Seen In The Wild
        </Text>
        <Text style={[styles.messageText, { color: config.color }]} numberOfLines={2}>
          {message}
        </Text>
      </View>
    </Animated.View>
  );
}

export default React.memo(WildEncounterBadgeInner);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 10,
    marginHorizontal: 4,
    overflow: 'hidden',
    gap: 10,
  },
  glow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 12,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  textWrap: {
    flex: 1,
    gap: 2,
  },
  titleText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#6B7280',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.6,
  },
  messageText: {
    fontSize: 12,
    fontWeight: '500' as const,
    lineHeight: 17,
  },
});
