import React, { useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Trophy, Swords, Zap, ArrowUp } from 'lucide-react-native';
import { USE_NATIVE_DRIVER } from '@/constants/animation';
import Colors from '@/constants/colors';
import Kiri from '@/components/Kiri';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface PersonalBestChallengeProps {
  conceptName: string;
  previousBestAccuracy: number;
  previousBestStreak: number;
  onAccept: () => void;
}

function PersonalBestChallengeInner({
  conceptName,
  previousBestAccuracy,
  previousBestStreak,
  onAccept,
}: PersonalBestChallengeProps) {
  const containerOpacity = useRef(new Animated.Value(0)).current;
  const kiriScale = useRef(new Animated.Value(0.5)).current;
  const kiriOpacity = useRef(new Animated.Value(0)).current;
  const cardSlide = useRef(new Animated.Value(40)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const statsSlide = useRef(new Animated.Value(30)).current;
  const statsOpacity = useRef(new Animated.Value(0)).current;
  const btnScale = useRef(new Animated.Value(0.8)).current;
  const btnOpacity = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const swordsRotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(containerOpacity, {
      toValue: 1,
      duration: 300,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();

    Animated.sequence([
      Animated.delay(100),
      Animated.parallel([
        Animated.spring(kiriScale, { toValue: 1, friction: 5, tension: 60, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(kiriOpacity, { toValue: 1, duration: 300, useNativeDriver: USE_NATIVE_DRIVER }),
      ]),
    ]).start();

    Animated.sequence([
      Animated.delay(350),
      Animated.parallel([
        Animated.timing(cardOpacity, { toValue: 1, duration: 300, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(cardSlide, { toValue: 0, duration: 350, easing: Easing.out(Easing.back(1.2)), useNativeDriver: USE_NATIVE_DRIVER }),
      ]),
    ]).start();

    Animated.sequence([
      Animated.delay(550),
      Animated.parallel([
        Animated.timing(statsOpacity, { toValue: 1, duration: 250, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(statsSlide, { toValue: 0, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: USE_NATIVE_DRIVER }),
      ]),
    ]).start();

    Animated.sequence([
      Animated.delay(750),
      Animated.parallel([
        Animated.spring(btnScale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(btnOpacity, { toValue: 1, duration: 250, useNativeDriver: USE_NATIVE_DRIVER }),
      ]),
    ]).start();

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: USE_NATIVE_DRIVER }),
      ])
    );
    pulse.start();

    const swordsAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(swordsRotate, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(swordsRotate, { toValue: -1, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: USE_NATIVE_DRIVER }),
      ])
    );
    swordsAnim.start();

    return () => {
      pulse.stop();
      swordsAnim.stop();
    };
  }, []);

  const handleAccept = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Animated.sequence([
      Animated.timing(btnScale, { toValue: 0.92, duration: 80, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.timing(btnScale, { toValue: 1, duration: 80, useNativeDriver: USE_NATIVE_DRIVER }),
    ]).start(() => onAccept());
  }, [onAccept, btnScale]);

  const swordsInterpolate = swordsRotate.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-5deg', '0deg', '5deg'],
  });

  return (
    <Animated.View style={[styles.container, { opacity: containerOpacity }]}>
      <LinearGradient
        colors={['#FFF7ED', '#FFFBEB', '#FEF3C7']}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.content}>
        <Animated.View style={[styles.kiriWrap, { opacity: kiriOpacity, transform: [{ scale: kiriScale }] }]}>
          <Kiri mood="encouraging" size={110} />
        </Animated.View>

        <Animated.View style={[styles.swordsWrap, { transform: [{ rotate: swordsInterpolate }] }]}>
          <Swords size={28} color="#D97706" />
        </Animated.View>

        <Animated.View style={[styles.challengeCard, { opacity: cardOpacity, transform: [{ translateY: cardSlide }] }]}>
          <View style={styles.challengeBadge}>
            <Trophy size={14} color="#D97706" />
            <Text style={styles.challengeBadgeText}>PERSONAL BEST CHALLENGE</Text>
          </View>

          <Text style={styles.challengeTitle}>
            Can you beat your record?
          </Text>

          <Text style={styles.conceptLabel}>
            {conceptName}
          </Text>
        </Animated.View>

        <Animated.View style={[styles.statsRow, { opacity: statsOpacity, transform: [{ translateY: statsSlide }] }]}>
          <Animated.View style={[styles.statCard, { transform: [{ scale: pulseAnim }] }]}>
            <View style={styles.statIconWrap}>
              <Trophy size={18} color="#F59E0B" />
            </View>
            <Text style={styles.statValue}>{previousBestAccuracy}%</Text>
            <Text style={styles.statSubLabel}>Best Accuracy</Text>
          </Animated.View>

          <View style={styles.statCard}>
            <View style={[styles.statIconWrap, { backgroundColor: '#FEF2F2' }]}>
              <Zap size={18} color="#EF4444" />
            </View>
            <Text style={styles.statValue}>{previousBestStreak}</Text>
            <Text style={styles.statSubLabel}>Best Streak</Text>
          </View>
        </Animated.View>

        <Animated.View style={{ opacity: btnOpacity, transform: [{ scale: btnScale }], width: '100%' as const }}>
          <Pressable style={styles.acceptBtn} onPress={handleAccept} testID="challenge-accepted-btn">
            <LinearGradient
              colors={['#F59E0B', '#D97706']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.acceptBtnGradient}
            >
              <Swords size={20} color="#fff" />
              <Text style={styles.acceptBtnText}>Challenge Accepted!</Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

export interface PersonalBestResultProps {
  beaten: boolean;
  oldAccuracy: number;
  newAccuracy: number;
  bonusXP: number;
  onDismiss: () => void;
}

export function PersonalBestResult({
  beaten,
  oldAccuracy,
  newAccuracy,
  bonusXP,
  onDismiss,
}: PersonalBestResultProps) {
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const bannerScale = useRef(new Animated.Value(0.5)).current;
  const bannerOpacity = useRef(new Animated.Value(0)).current;
  const flashOpacity = useRef(new Animated.Value(0)).current;
  const arrowSlide = useRef(new Animated.Value(20)).current;
  const arrowOpacity = useRef(new Animated.Value(0)).current;
  const xpScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (beaten) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    if (beaten) {
      Animated.sequence([
        Animated.timing(flashOpacity, { toValue: 0.6, duration: 150, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(flashOpacity, { toValue: 0, duration: 400, useNativeDriver: USE_NATIVE_DRIVER }),
      ]).start();
    }

    Animated.timing(overlayOpacity, { toValue: 1, duration: 200, useNativeDriver: USE_NATIVE_DRIVER }).start();

    Animated.sequence([
      Animated.delay(beaten ? 300 : 100),
      Animated.parallel([
        Animated.spring(bannerScale, { toValue: 1, friction: 5, tension: 60, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(bannerOpacity, { toValue: 1, duration: 250, useNativeDriver: USE_NATIVE_DRIVER }),
      ]),
    ]).start();

    if (beaten) {
      Animated.sequence([
        Animated.delay(600),
        Animated.parallel([
          Animated.timing(arrowOpacity, { toValue: 1, duration: 200, useNativeDriver: USE_NATIVE_DRIVER }),
          Animated.spring(arrowSlide, { toValue: 0, friction: 6, tension: 80, useNativeDriver: USE_NATIVE_DRIVER }),
        ]),
      ]).start();

      Animated.sequence([
        Animated.delay(900),
        Animated.spring(xpScale, { toValue: 1, friction: 4, tension: 80, useNativeDriver: USE_NATIVE_DRIVER }),
      ]).start();
    }
  }, [beaten]);

  return (
    <Animated.View style={[styles.resultOverlay, { opacity: overlayOpacity }]}>
      {beaten && (
        <Animated.View style={[styles.goldFlash, { opacity: flashOpacity }]} pointerEvents="none" />
      )}

      <Animated.View style={[styles.resultBanner, { opacity: bannerOpacity, transform: [{ scale: bannerScale }] }]}>
        <LinearGradient
          colors={beaten ? ['#FEF3C7', '#FDE68A'] : ['#F3F4F6', '#E5E7EB']}
          style={styles.resultBannerBg}
        >
          {beaten ? (
            <>
              <View style={styles.resultTrophyRow}>
                <Trophy size={32} color="#D97706" />
              </View>
              <Text style={styles.resultTitle}>NEW PERSONAL BEST!</Text>

              <Animated.View style={[styles.resultArrowRow, { opacity: arrowOpacity, transform: [{ translateY: arrowSlide }] }]}>
                <Text style={styles.resultOldScore}>{oldAccuracy}%</Text>
                <ArrowUp size={20} color="#10B981" />
                <Text style={styles.resultNewScore}>{newAccuracy}%</Text>
              </Animated.View>

              {bonusXP > 0 && (
                <Animated.View style={[styles.resultBonusXP, { transform: [{ scale: xpScale }] }]}>
                  <Zap size={16} color="#D97706" />
                  <Text style={styles.resultBonusText}>+{bonusXP} Bonus XP!</Text>
                </Animated.View>
              )}
            </>
          ) : (
            <>
              <Text style={styles.resultTitleMiss}>Close one!</Text>
              <Text style={styles.resultSubMiss}>
                Your best is still {oldAccuracy}%. You got {newAccuracy}% this time.
              </Text>
            </>
          )}

          <Pressable style={[styles.resultDismissBtn, beaten && styles.resultDismissBtnGold]} onPress={onDismiss}>
            <Text style={[styles.resultDismissText, beaten && styles.resultDismissTextGold]}>Continue</Text>
          </Pressable>
        </LinearGradient>
      </Animated.View>
    </Animated.View>
  );
}

export default React.memo(PersonalBestChallengeInner);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  kiriWrap: {
    marginBottom: 8,
  },
  swordsWrap: {
    marginBottom: 20,
  },
  challengeCard: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 28,
  },
  challengeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 16,
  },
  challengeBadgeText: {
    fontSize: 11,
    fontWeight: '800' as const,
    color: '#D97706',
    letterSpacing: 1,
  },
  challengeTitle: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: Colors.text,
    textAlign: 'center' as const,
    marginBottom: 10,
  },
  conceptLabel: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 14,
    width: '100%',
    marginBottom: 32,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#FFFBEB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800' as const,
    color: Colors.text,
  },
  statSubLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  acceptBtn: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  acceptBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    borderRadius: 16,
  },
  acceptBtnText: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: '#fff',
  },
  resultOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  goldFlash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FDE68A',
  },
  resultBanner: {
    width: SCREEN_WIDTH - 48,
    borderRadius: 24,
    overflow: 'hidden',
  },
  resultBannerBg: {
    padding: 28,
    alignItems: 'center',
  },
  resultTrophyRow: {
    marginBottom: 12,
  },
  resultTitle: {
    fontSize: 22,
    fontWeight: '900' as const,
    color: '#92400E',
    letterSpacing: 1,
    marginBottom: 16,
    textAlign: 'center' as const,
  },
  resultArrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  resultOldScore: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: '#9CA3AF',
    textDecorationLine: 'line-through' as const,
  },
  resultNewScore: {
    fontSize: 28,
    fontWeight: '900' as const,
    color: '#059669',
  },
  resultBonusXP: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 16,
  },
  resultBonusText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#D97706',
  },
  resultTitleMiss: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  resultSubMiss: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    lineHeight: 20,
    marginBottom: 20,
  },
  resultDismissBtn: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  resultDismissBtnGold: {
    backgroundColor: '#92400E',
  },
  resultDismissText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  resultDismissTextGold: {
    color: '#fff',
  },
});
