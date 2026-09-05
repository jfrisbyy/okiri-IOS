import React, { useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { USE_NATIVE_DRIVER } from '@/constants/animation';
import { ACHIEVEMENTS } from '@/data/achievements';
import { EarnedAchievement } from '@/data/achievements';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Props {
  achievement: EarnedAchievement | null;
  onDismiss: () => void;
}

const CONFETTI_COLORS = ['#F59E0B', '#10B981', '#3B82F6', '#EF4444', '#8B5CF6', '#EC4899', '#F97316'];
const CONFETTI_COUNT = 24;

function ConfettiPiece({ index, containerHeight }: { index: number; containerHeight: number }) {
  const animY = useRef(new Animated.Value(0)).current;
  const animX = useRef(new Animated.Value(0)).current;
  const animRotate = useRef(new Animated.Value(0)).current;
  const animOpacity = useRef(new Animated.Value(1)).current;

  const startX = Math.random() * SCREEN_WIDTH;
  const endX = startX + (Math.random() - 0.5) * 120;
  const color = CONFETTI_COLORS[index % CONFETTI_COLORS.length];
  const size = 6 + Math.random() * 6;
  const isCircle = index % 3 === 0;
  const delay = Math.random() * 400;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(animY, {
        toValue: containerHeight + 40,
        duration: 1800 + Math.random() * 800,
        delay,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(animX, {
        toValue: endX - startX,
        duration: 1800 + Math.random() * 800,
        delay,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(animRotate, {
        toValue: 1,
        duration: 2000,
        delay,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(animOpacity, {
        toValue: 0,
        duration: 2200,
        delay: delay + 600,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rotate = animRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', `${360 + Math.random() * 360}deg`],
  });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: -10,
        left: startX,
        width: size,
        height: isCircle ? size : size * 2.5,
        backgroundColor: color,
        borderRadius: isCircle ? size / 2 : 2,
        opacity: animOpacity,
        transform: [
          { translateY: animY },
          { translateX: animX },
          { rotate },
        ],
      }}
    />
  );
}

export default function AchievementUnlockedModal({ achievement, onDismiss }: Props) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const iconScale = useRef(new Animated.Value(0)).current;
  const titleSlide = useRef(new Animated.Value(30)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const xpScale = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  const definition = achievement ? ACHIEVEMENTS.find(a => a.id === achievement.id) : null;

  useEffect(() => {
    if (!achievement || !definition) return;

    scaleAnim.setValue(0);
    overlayAnim.setValue(0);
    iconScale.setValue(0);
    titleSlide.setValue(30);
    titleOpacity.setValue(0);
    xpScale.setValue(0);
    glowAnim.setValue(0);

    if (Platform.OS !== 'web') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    Animated.sequence([
      Animated.parallel([
        Animated.timing(overlayAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 6,
          tension: 80,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]),
      Animated.parallel([
        Animated.spring(iconScale, {
          toValue: 1,
          friction: 4,
          tension: 100,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]),
      Animated.parallel([
        Animated.timing(titleSlide, {
          toValue: 0,
          duration: 300,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(titleOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]),
      Animated.spring(xpScale, {
        toValue: 1,
        friction: 5,
        tension: 90,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [achievement?.id]);

  const handleDismiss = useCallback(() => {
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(overlayAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start(() => {
      onDismiss();
    });
  }, [onDismiss, scaleAnim, overlayAnim]);

  if (!achievement || !definition) return null;

  const categoryColor = getCategoryColor(definition.category);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.overlay,
          { opacity: overlayAnim },
        ]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={handleDismiss} />
      </Animated.View>

      {Array.from({ length: CONFETTI_COUNT }).map((_, i) => (
        <ConfettiPiece key={i} index={i} containerHeight={Dimensions.get('window').height} />
      ))}

      <View style={styles.centerWrap} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.card,
            {
              transform: [{ scale: scaleAnim }],
              opacity: overlayAnim,
            },
          ]}
        >
          <View style={styles.topStrip}>
            <Text style={styles.unlockLabel}>ACHIEVEMENT UNLOCKED</Text>
          </View>

          <Animated.View
            style={[
              styles.iconContainer,
              {
                transform: [{ scale: iconScale }],
                borderColor: categoryColor,
              },
            ]}
          >
            <Animated.View
              style={[
                styles.iconGlow,
                {
                  backgroundColor: categoryColor,
                  opacity: glowAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 0.15],
                  }),
                  transform: [{
                    scale: glowAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.5, 1.6],
                    }),
                  }],
                },
              ]}
            />
            <Text style={styles.icon}>{definition.icon}</Text>
          </Animated.View>

          <Animated.View
            style={{
              opacity: titleOpacity,
              transform: [{ translateY: titleSlide }],
              alignItems: 'center' as const,
            }}
          >
            <Text style={styles.title}>{definition.title}</Text>
            <Text style={styles.description}>{definition.description}</Text>
          </Animated.View>

          <Animated.View
            style={[
              styles.xpBadge,
              {
                backgroundColor: categoryColor + '18',
                borderColor: categoryColor + '40',
                transform: [{ scale: xpScale }],
              },
            ]}
          >
            <Text style={[styles.xpText, { color: categoryColor }]}>
              +{definition.xpReward} XP
            </Text>
          </Animated.View>

          <Pressable
            style={({ pressed }) => [
              styles.dismissBtn,
              { backgroundColor: categoryColor },
              pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
            ]}
            onPress={handleDismiss}
            testID="achievement-dismiss"
          >
            <Text style={styles.dismissText}>Awesome!</Text>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

function getCategoryColor(category: string): string {
  switch (category) {
    case 'streak': return '#F59E0B';
    case 'mastery': return '#10B981';
    case 'exploration': return '#3B82F6';
    case 'milestone': return '#8B5CF6';
    case 'special': return '#EF4444';
    default: return Colors.primary;
  }
}

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  centerWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#fff',
    borderRadius: 24,
    alignItems: 'center',
    paddingBottom: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
  topStrip: {
    width: '100%',
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    marginBottom: 20,
  },
  unlockLabel: {
    fontSize: 11,
    fontWeight: '800' as const,
    color: Colors.textMuted,
    letterSpacing: 2,
  },
  iconContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    marginBottom: 16,
    position: 'relative',
  },
  iconGlow: {
    position: 'absolute',
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  icon: {
    fontSize: 42,
  },
  title: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.text,
    letterSpacing: -0.3,
    textAlign: 'center' as const,
  },
  description: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    marginTop: 4,
    paddingHorizontal: 24,
  },
  xpBadge: {
    marginTop: 16,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  xpText: {
    fontSize: 16,
    fontWeight: '800' as const,
    letterSpacing: 0.5,
  },
  dismissBtn: {
    marginTop: 20,
    paddingHorizontal: 48,
    paddingVertical: 14,
    borderRadius: 14,
  },
  dismissText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
  },
});
