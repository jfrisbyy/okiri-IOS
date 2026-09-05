import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import {
  Shield,
  Sparkles,
  ChevronRight,
  Share2,
  ArrowRight,
  Check,
} from 'lucide-react-native';
import { USE_NATIVE_DRIVER } from '@/constants/animation';
import Kiri from '@/components/Kiri';
import ShareableStatCard from '@/components/ShareableStatCard';
import { useApp } from '@/contexts/AppContext';
import {
  CEFR_LEVEL_NAMES,
  CEFR_LEVEL_COLORS,
  CEFR_LEVEL_DESCRIPTIONS,
  LEVEL_UNLOCKS,
} from '@/utils/proficiency';
import { CEFRLevel } from '@/types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ConfettiPiece {
  x: Animated.Value;
  y: Animated.Value;
  rotate: Animated.Value;
  scale: Animated.Value;
  opacity: Animated.Value;
  color: string;
  size: number;
}

function useConfetti(count: number = 30): ConfettiPiece[] {
  const pieces = useRef<ConfettiPiece[]>([]).current;

  if (pieces.length === 0) {
    const confettiColors = ['#F59E0B', '#10B981', '#3B82F6', '#EC4899', '#8B5CF6', '#EF4444', '#06B6D4'];
    for (let i = 0; i < count; i++) {
      pieces.push({
        x: new Animated.Value(SCREEN_WIDTH / 2),
        y: new Animated.Value(-20),
        rotate: new Animated.Value(0),
        scale: new Animated.Value(0),
        opacity: new Animated.Value(1),
        color: confettiColors[i % confettiColors.length],
        size: 6 + Math.random() * 6,
      });
    }
  }

  return pieces;
}

function ConfettiLayer({ pieces }: { pieces: ConfettiPiece[] }) {
  useEffect(() => {
    const animations = pieces.map((piece, i) => {
      const targetX = Math.random() * SCREEN_WIDTH;
      const targetY = SCREEN_HEIGHT * 0.4 + Math.random() * SCREEN_HEIGHT * 0.5;
      const delay = i * 40 + Math.random() * 200;

      return Animated.parallel([
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(piece.scale, {
            toValue: 1,
            duration: 200,
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
        ]),
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(piece.x, {
            toValue: targetX,
            duration: 1500 + Math.random() * 1000,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
        ]),
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(piece.y, {
            toValue: targetY,
            duration: 1500 + Math.random() * 1000,
            easing: Easing.in(Easing.quad),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
        ]),
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(piece.rotate, {
            toValue: 360 * (Math.random() > 0.5 ? 1 : -1),
            duration: 2000,
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
        ]),
        Animated.sequence([
          Animated.delay(delay + 1500),
          Animated.timing(piece.opacity, {
            toValue: 0,
            duration: 800,
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
        ]),
      ]);
    });

    Animated.parallel(animations).start();
  }, [pieces]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {pieces.map((piece, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            width: piece.size,
            height: piece.size,
            borderRadius: Math.random() > 0.5 ? piece.size / 2 : 2,
            backgroundColor: piece.color,
            transform: [
              { translateX: piece.x },
              { translateY: piece.y },
              { scale: piece.scale },
              {
                rotate: piece.rotate.interpolate({
                  inputRange: [-360, 0, 360],
                  outputRange: ['-360deg', '0deg', '360deg'],
                }),
              },
            ],
            opacity: piece.opacity,
          }}
        />
      ))}
    </View>
  );
}

export default function LevelUpScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ level?: string; previousLevel?: string }>();
  const { gameState, user } = useApp();

  const newLevel = (params.level as CEFRLevel) || 'A1';
  const previousLevel = (params.previousLevel as CEFRLevel) || null;

  const levelColors = CEFR_LEVEL_COLORS[newLevel];
  const unlocks = LEVEL_UNLOCKS[newLevel] || [];

  const confetti = useConfetti(35);
  const [showShare, setShowShare] = useState(false);

  const heroScale = useRef(new Animated.Value(0)).current;
  const heroOpacity = useRef(new Animated.Value(0)).current;
  const levelTextScale = useRef(new Animated.Value(0.3)).current;
  const levelTextOpacity = useRef(new Animated.Value(0)).current;
  const badgeSlide = useRef(new Animated.Value(50)).current;
  const badgeOpacity = useRef(new Animated.Value(0)).current;
  const descSlide = useRef(new Animated.Value(40)).current;
  const descOpacity = useRef(new Animated.Value(0)).current;
  const unlockAnims = useRef(unlocks.map(() => ({
    slide: new Animated.Value(30),
    opacity: new Animated.Value(0),
  }))).current;
  const buttonsSlide = useRef(new Animated.Value(60)).current;
  const buttonsOpacity = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    Animated.sequence([
      Animated.parallel([
        Animated.spring(heroScale, {
          toValue: 1,
          tension: 40,
          friction: 6,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(heroOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]),
      Animated.delay(200),
      Animated.parallel([
        Animated.spring(levelTextScale, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(levelTextOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]),
      Animated.delay(100),
      Animated.parallel([
        Animated.spring(badgeSlide, {
          toValue: 0,
          tension: 60,
          friction: 10,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(badgeOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]),
      Animated.parallel([
        Animated.spring(descSlide, {
          toValue: 0,
          tension: 60,
          friction: 10,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(descOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]),
      Animated.stagger(
        120,
        unlockAnims.map(anim =>
          Animated.parallel([
            Animated.spring(anim.slide, {
              toValue: 0,
              tension: 60,
              friction: 10,
              useNativeDriver: USE_NATIVE_DRIVER,
            }),
            Animated.timing(anim.opacity, {
              toValue: 1,
              duration: 250,
              useNativeDriver: USE_NATIVE_DRIVER,
            }),
          ])
        )
      ),
      Animated.parallel([
        Animated.spring(buttonsSlide, {
          toValue: 0,
          tension: 50,
          friction: 10,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(buttonsOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]),
    ]).start();

    const glow = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 0.7,
          duration: 1500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.3,
          duration: 1500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ])
    );
    glow.start();

    return () => glow.stop();
  }, [heroScale, heroOpacity, levelTextScale, levelTextOpacity, badgeSlide, badgeOpacity, descSlide, descOpacity, unlockAnims, buttonsSlide, buttonsOpacity, glowAnim]);

  const handleContinue = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.back();
  }, [router]);

  const handleShare = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowShare(true);
  }, []);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[levelColors.gradient[0], levelColors.gradient[1], '#1A1A2E']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      <ConfettiLayer pieces={confetti} />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.content}>
          <Animated.View
            style={[
              styles.heroSection,
              {
                transform: [{ scale: heroScale }],
                opacity: heroOpacity,
              },
            ]}
          >
            <Animated.View
              style={[
                styles.glowCircle,
                {
                  opacity: glowAnim,
                  backgroundColor: levelColors.accent,
                },
              ]}
            />
            <Kiri mood="celebrating" size={140} />
          </Animated.View>

          <Animated.View
            style={{
              transform: [{ scale: levelTextScale }],
              opacity: levelTextOpacity,
              alignItems: 'center',
            }}
          >
            <View style={styles.starRow}>
              <Sparkles size={20} color="#F59E0B" />
              <Text style={styles.levelUpLabel}>LEVEL UP!</Text>
              <Sparkles size={20} color="#F59E0B" />
            </View>
          </Animated.View>

          <Animated.View
            style={{
              transform: [{ translateY: badgeSlide }],
              opacity: badgeOpacity,
              alignItems: 'center',
            }}
          >
            <View style={[styles.newLevelBadge, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
              <Shield size={28} color="#fff" />
              <Text style={styles.newLevelText}>{newLevel}</Text>
            </View>
            <Text style={styles.levelName}>{CEFR_LEVEL_NAMES[newLevel]}</Text>
            {previousLevel && (
              <View style={styles.fromRow}>
                <Text style={styles.fromText}>From {previousLevel}</Text>
                <ArrowRight size={14} color="rgba(255,255,255,0.6)" />
                <Text style={styles.toText}>{newLevel}</Text>
              </View>
            )}
          </Animated.View>

          <Animated.View
            style={{
              transform: [{ translateY: descSlide }],
              opacity: descOpacity,
              alignItems: 'center',
            }}
          >
            <Text style={styles.description}>
              {CEFR_LEVEL_DESCRIPTIONS[newLevel]}
            </Text>
          </Animated.View>

          <View style={styles.unlocksSection}>
            <Text style={styles.unlocksTitle}>Skills Unlocked</Text>
            {unlocks.map((skill, i) => (
              <Animated.View
                key={skill}
                style={[
                  styles.unlockRow,
                  {
                    transform: [{ translateY: unlockAnims[i]?.slide ?? 0 }],
                    opacity: unlockAnims[i]?.opacity ?? 0,
                  },
                ]}
              >
                <View style={styles.unlockCheck}>
                  <Check size={14} color="#10B981" />
                </View>
                <Text style={styles.unlockText}>{skill}</Text>
              </Animated.View>
            ))}
          </View>

          <Animated.View
            style={[
              styles.buttonsSection,
              {
                transform: [{ translateY: buttonsSlide }],
                opacity: buttonsOpacity,
              },
            ]}
          >
            <Pressable
              style={({ pressed }) => [
                styles.continueBtn,
                { backgroundColor: '#fff' },
                pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] },
              ]}
              onPress={handleContinue}
              testID="level-up-continue"
            >
              <Text style={[styles.continueBtnText, { color: levelColors.gradient[1] }]}>
                Continue Learning
              </Text>
              <ChevronRight size={18} color={levelColors.gradient[1]} />
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.shareBtn,
                pressed && { opacity: 0.7 },
              ]}
              onPress={handleShare}
              testID="level-up-share"
            >
              <Share2 size={16} color="rgba(255,255,255,0.9)" />
              <Text style={styles.shareBtnText}>Share Achievement</Text>
            </Pressable>
          </Animated.View>
        </View>
      </SafeAreaView>

      <ShareableStatCard
        userName={user?.name || 'French Learner'}
        streakCount={gameState?.streakCount ?? 0}
        totalXP={gameState?.totalXP ?? 0}
        cefrLevel={newLevel}
        wordsLearned={0}
        visible={showShare}
        onClose={() => setShowShare(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  heroSection: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  glowCircle: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
  },
  starRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  levelUpLabel: {
    fontSize: 16,
    fontWeight: '900' as const,
    color: '#F59E0B',
    letterSpacing: 3,
  },
  newLevelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    marginBottom: 8,
  },
  newLevelText: {
    fontSize: 48,
    fontWeight: '900' as const,
    color: '#fff',
    letterSpacing: -1,
  },
  levelName: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: 'rgba(255,255,255,0.95)',
    marginBottom: 4,
  },
  fromRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  fromText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: 'rgba(255,255,255,0.5)',
  },
  toText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: 'rgba(255,255,255,0.8)',
  },
  description: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center' as const,
    lineHeight: 22,
    maxWidth: 280,
  },
  unlocksSection: {
    width: '100%',
    maxWidth: 300,
    marginTop: 8,
  },
  unlocksTitle: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
    marginBottom: 10,
    textAlign: 'center' as const,
  },
  unlockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    marginBottom: 6,
  },
  unlockCheck: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(16,185,129,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unlockText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.9)',
  },
  buttonsSection: {
    width: '100%',
    maxWidth: 300,
    gap: 12,
    marginTop: 12,
  },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  continueBtnText: {
    fontSize: 16,
    fontWeight: '700' as const,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  shareBtnText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.9)',
  },
});
