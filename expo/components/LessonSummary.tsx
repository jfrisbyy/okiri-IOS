import React, { useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Easing,
  ScrollView,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import {
  Check,
  X,
  Flame,
  Target,
  ArrowRight,
  RotateCcw,
  Sparkles,
  Trophy,
  ArrowUp,
  Zap,
  Link2,
} from 'lucide-react-native';
import { USE_NATIVE_DRIVER } from '@/constants/animation';
import Colors from '@/constants/colors';
import Kiri from '@/components/Kiri';
import ShareableStatCard, { ShareProgressButton } from '@/components/ShareableStatCard';
import { useApp } from '@/contexts/AppContext';
import { getCurrentCertifiedLevel } from '@/utils/proficiency';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface PersonalBestInfo {
  beaten: boolean;
  oldAccuracy: number;
  newAccuracy: number;
  bonusXP: number;
}

interface LessonSummaryProps {
  correctAnswers: number;
  totalQuestions: number;
  maxStreak: number;
  conceptsPracticed: { label: string; mastered: boolean }[];
  onContinue: () => void;
  onOneMore: () => void;
  sessionXP?: number;
  personalBest?: PersonalBestInfo;
  connectedWordsCount?: number;
}

function useSharableStats() {
  const { user, gaps, gameState, proficiency } = useApp();
  const certifiedLevel = getCurrentCertifiedLevel(proficiency.certifiedLevels);
  const wordsLearned = gaps.filter((g) => g.masteredAt).length;
  return {
    userName: user?.name || 'French Learner',
    streakCount: gameState.streakCount,
    totalXP: gameState.totalXP,
    cefrLevel: certifiedLevel,
    wordsLearned,
  };
}

const CONFETTI_COLORS = ['#F97316', '#10B981', '#3B82F6', '#F59E0B', '#EC4899', '#8B5CF6'];
const CONFETTI_COUNT = 24;

interface ConfettiPiece {
  x: Animated.Value;
  y: Animated.Value;
  rotate: Animated.Value;
  scale: Animated.Value;
  opacity: Animated.Value;
  color: string;
  startX: number;
  size: number;
}

function LessonSummaryInner({
  correctAnswers,
  totalQuestions,
  maxStreak,
  conceptsPracticed,
  onContinue,
  onOneMore,
  sessionXP = 0,
  personalBest,
  connectedWordsCount = 0,
}: LessonSummaryProps) {
  const percentage = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
  const isGreat = percentage >= 80;
  const isGood = percentage >= 60;

  const containerFade = useRef(new Animated.Value(0)).current;
  const kiriScale = useRef(new Animated.Value(0.3)).current;
  const kiriOpacity = useRef(new Animated.Value(0)).current;
  const titleSlide = useRef(new Animated.Value(30)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;

  const accuracyAnim = useRef(new Animated.Value(0)).current;
  const correctAnim = useRef(new Animated.Value(0)).current;
  const streakAnim = useRef(new Animated.Value(0)).current;

  const stat1Opacity = useRef(new Animated.Value(0)).current;
  const stat1Slide = useRef(new Animated.Value(20)).current;
  const stat2Opacity = useRef(new Animated.Value(0)).current;
  const stat2Slide = useRef(new Animated.Value(20)).current;
  const stat3Opacity = useRef(new Animated.Value(0)).current;
  const stat3Slide = useRef(new Animated.Value(20)).current;
  const stat4Opacity = useRef(new Animated.Value(0)).current;
  const stat4Slide = useRef(new Animated.Value(20)).current;
  const xpAnim = useRef(new Animated.Value(0)).current;

  const conceptsOpacity = useRef(new Animated.Value(0)).current;
  const conceptsSlide = useRef(new Animated.Value(20)).current;
  const buttonsOpacity = useRef(new Animated.Value(0)).current;
  const buttonsSlide = useRef(new Animated.Value(20)).current;

  const pbOpacity = useRef(new Animated.Value(0)).current;
  const pbSlide = useRef(new Animated.Value(20)).current;
  const pbFlashOpacity = useRef(new Animated.Value(0)).current;
  const pbArrowSlide = useRef(new Animated.Value(15)).current;

  const continueScale = useRef(new Animated.Value(1)).current;
  const oneMoreScale = useRef(new Animated.Value(1)).current;

  const [showShareCard, setShowShareCard] = React.useState(false);
  const stats = useSharableStats();

  const confettiPieces = useRef<ConfettiPiece[]>(
    Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      rotate: new Animated.Value(0),
      scale: new Animated.Value(0),
      opacity: new Animated.Value(0),
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      startX: (Math.random() - 0.5) * SCREEN_WIDTH * 0.8,
      size: 6 + Math.random() * 6,
    }))
  ).current;

  const [displayAccuracy, setDisplayAccuracy] = React.useState(0);
  const [displayCorrect, setDisplayCorrect] = React.useState(0);
  const [displayStreak, setDisplayStreak] = React.useState(0);
  const [displayXP, setDisplayXP] = React.useState(0);

  useEffect(() => {
    const listenerId = accuracyAnim.addListener(({ value }) => {
      setDisplayAccuracy(Math.round(value));
    });
    return () => accuracyAnim.removeListener(listenerId);
  }, [accuracyAnim]);

  useEffect(() => {
    const listenerId = correctAnim.addListener(({ value }) => {
      setDisplayCorrect(Math.round(value));
    });
    return () => correctAnim.removeListener(listenerId);
  }, [correctAnim]);

  useEffect(() => {
    const listenerId = streakAnim.addListener(({ value }) => {
      setDisplayStreak(Math.round(value));
    });
    return () => streakAnim.removeListener(listenerId);
  }, [streakAnim]);

  useEffect(() => {
    const listenerId = xpAnim.addListener(({ value }) => {
      setDisplayXP(Math.round(value));
    });
    return () => xpAnim.removeListener(listenerId);
  }, [xpAnim]);

  useEffect(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    Animated.timing(containerFade, {
      toValue: 1,
      duration: 300,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();

    if (isGreat) {
      confettiPieces.forEach((piece, i) => {
        const delay = i * 30;
        Animated.sequence([
          Animated.delay(delay + 200),
          Animated.parallel([
            Animated.timing(piece.opacity, {
              toValue: 1,
              duration: 100,
              useNativeDriver: USE_NATIVE_DRIVER,
            }),
            Animated.timing(piece.scale, {
              toValue: 1,
              duration: 100,
              useNativeDriver: USE_NATIVE_DRIVER,
            }),
            Animated.timing(piece.y, {
              toValue: 400 + Math.random() * 200,
              duration: 1800 + Math.random() * 600,
              easing: Easing.out(Easing.quad),
              useNativeDriver: USE_NATIVE_DRIVER,
            }),
            Animated.timing(piece.x, {
              toValue: piece.startX + (Math.random() - 0.5) * 60,
              duration: 1800 + Math.random() * 600,
              easing: Easing.out(Easing.quad),
              useNativeDriver: USE_NATIVE_DRIVER,
            }),
            Animated.timing(piece.rotate, {
              toValue: (Math.random() - 0.5) * 720,
              duration: 2000,
              useNativeDriver: USE_NATIVE_DRIVER,
            }),
          ]),
          Animated.timing(piece.opacity, {
            toValue: 0,
            duration: 400,
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
        ]).start();
      });
    }

    Animated.sequence([
      Animated.delay(100),
      Animated.parallel([
        Animated.spring(kiriScale, {
          toValue: 1,
          friction: 5,
          tension: 60,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(kiriOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]),
    ]).start();

    Animated.sequence([
      Animated.delay(400),
      Animated.parallel([
        Animated.timing(titleOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(titleSlide, {
          toValue: 0,
          duration: 300,
          easing: Easing.out(Easing.back(1.5)),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]),
    ]).start();

    const animateStat = (
      opacity: Animated.Value,
      slide: Animated.Value,
      counter: Animated.Value,
      targetValue: number,
      delay: number,
    ) => {
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 1,
            duration: 250,
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.timing(slide, {
            toValue: 0,
            duration: 250,
            easing: Easing.out(Easing.back(1.2)),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
        ]),
      ]).start();

      setTimeout(() => {
        Animated.timing(counter, {
          toValue: targetValue,
          duration: 800,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }).start();
      }, delay);
    };

    animateStat(stat1Opacity, stat1Slide, accuracyAnim, percentage, 700);
    animateStat(stat2Opacity, stat2Slide, correctAnim, correctAnswers, 900);
    animateStat(stat3Opacity, stat3Slide, streakAnim, maxStreak, 1100);
    if (sessionXP > 0) {
      animateStat(stat4Opacity, stat4Slide, xpAnim, sessionXP, 1300);
    }

    Animated.sequence([
      Animated.delay(1400),
      Animated.parallel([
        Animated.timing(conceptsOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(conceptsSlide, {
          toValue: 0,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]),
    ]).start();

    if (personalBest) {
      const pbDelay = 1500;
      Animated.sequence([
        Animated.delay(pbDelay),
        Animated.parallel([
          Animated.timing(pbOpacity, { toValue: 1, duration: 300, useNativeDriver: USE_NATIVE_DRIVER }),
          Animated.timing(pbSlide, { toValue: 0, duration: 350, easing: Easing.out(Easing.back(1.2)), useNativeDriver: USE_NATIVE_DRIVER }),
        ]),
      ]).start();

      if (personalBest.beaten) {
        Animated.sequence([
          Animated.delay(pbDelay + 200),
          Animated.timing(pbFlashOpacity, { toValue: 0.5, duration: 150, useNativeDriver: USE_NATIVE_DRIVER }),
          Animated.timing(pbFlashOpacity, { toValue: 0, duration: 400, useNativeDriver: USE_NATIVE_DRIVER }),
        ]).start();

        Animated.sequence([
          Animated.delay(pbDelay + 400),
          Animated.spring(pbArrowSlide, { toValue: 0, friction: 6, tension: 80, useNativeDriver: USE_NATIVE_DRIVER }),
        ]).start();
      }
    }

    Animated.sequence([
      Animated.delay(personalBest ? 2000 : 1700),
      Animated.parallel([
        Animated.timing(buttonsOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(buttonsSlide, {
          toValue: 0,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleContinuePress = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.sequence([
      Animated.timing(continueScale, { toValue: 0.95, duration: 80, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.timing(continueScale, { toValue: 1, duration: 80, useNativeDriver: USE_NATIVE_DRIVER }),
    ]).start(() => onContinue());
  }, [onContinue, continueScale]);

  const handleOneMorePress = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.sequence([
      Animated.timing(oneMoreScale, { toValue: 0.95, duration: 80, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.timing(oneMoreScale, { toValue: 1, duration: 80, useNativeDriver: USE_NATIVE_DRIVER }),
    ]).start(() => onOneMore());
  }, [onOneMore, oneMoreScale]);

  const kiriMood = isGreat ? 'celebrating' : isGood ? 'happy' : 'encouraging';
  const titleText = isGreat ? 'Lesson Complete!' : isGood ? 'Good Progress!' : 'Keep Going!';
  const subtitleText = isGreat
    ? 'Outstanding work! You crushed it!'
    : isGood
    ? 'Nice effort! Keep building momentum.'
    : 'Every attempt makes you stronger.';

  const getAccuracyColor = () => {
    if (percentage >= 80) return '#10B981';
    if (percentage >= 60) return '#F59E0B';
    return '#EF4444';
  };

  const getAccuracyBg = () => {
    if (percentage >= 80) return '#ECFDF5';
    if (percentage >= 60) return '#FFFBEB';
    return '#FEF2F2';
  };

  return (
    <Animated.View style={[styles.container, { opacity: containerFade }]}>
      <LinearGradient
        colors={isGreat ? ['#FFF7ED', '#FEF3C7', '#FFEDD5'] : ['#FAFBFF', '#F0F1FF', '#FAFBFF']}
        style={StyleSheet.absoluteFill}
      />

      {isGreat && (
        <View style={styles.confettiContainer} pointerEvents="none">
          {confettiPieces.map((piece, i) => {
            const rotateStr = piece.rotate.interpolate({
              inputRange: [-720, 0, 720],
              outputRange: ['-720deg', '0deg', '720deg'],
            });
            return (
              <Animated.View
                key={i}
                style={[
                  styles.confettiPiece,
                  {
                    width: piece.size,
                    height: piece.size * 1.5,
                    backgroundColor: piece.color,
                    borderRadius: piece.size * 0.2,
                    opacity: piece.opacity,
                    transform: [
                      { translateX: piece.x },
                      { translateY: piece.y },
                      { rotate: rotateStr },
                      { scale: piece.scale },
                    ],
                  },
                ]}
              />
            );
          })}
        </View>
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            styles.kiriWrap,
            {
              opacity: kiriOpacity,
              transform: [{ scale: kiriScale }],
            },
          ]}
        >
          <Kiri mood={kiriMood} size={100} />
        </Animated.View>

        <Animated.View
          style={{
            opacity: titleOpacity,
            transform: [{ translateY: titleSlide }],
            alignItems: 'center' as const,
          }}
        >
          <Text style={styles.title}>{titleText}</Text>
          <Text style={styles.subtitle}>{subtitleText}</Text>
        </Animated.View>

        <View style={styles.statsRow}>
          <Animated.View
            style={[
              styles.statCard,
              styles.statCardAccuracy,
              { backgroundColor: getAccuracyBg() },
              { opacity: stat1Opacity, transform: [{ translateY: stat1Slide }] },
            ]}
          >
            <Target size={20} color={getAccuracyColor()} />
            <Text style={[styles.statValue, { color: getAccuracyColor() }]}>{displayAccuracy}%</Text>
            <Text style={styles.statLabel}>Accuracy</Text>
          </Animated.View>

          <Animated.View
            style={[
              styles.statCard,
              { opacity: stat2Opacity, transform: [{ translateY: stat2Slide }] },
            ]}
          >
            <Check size={20} color="#10B981" />
            <Text style={styles.statValue}>
              {displayCorrect}
              <Text style={styles.statValueSmall}>/{totalQuestions}</Text>
            </Text>
            <Text style={styles.statLabel}>Correct</Text>
          </Animated.View>

          <Animated.View
            style={[
              styles.statCard,
              { opacity: stat3Opacity, transform: [{ translateY: stat3Slide }] },
            ]}
          >
            <Flame size={20} color="#F59E0B" />
            <Text style={styles.statValue}>{displayStreak}</Text>
            <Text style={styles.statLabel}>Best Streak</Text>
          </Animated.View>
        </View>

        {sessionXP > 0 && (
          <Animated.View
            style={[
              styles.xpEarnedCard,
              { opacity: stat4Opacity, transform: [{ translateY: stat4Slide }] },
            ]}
          >
            <Sparkles size={20} color="#F59E0B" />
            <Text style={styles.xpEarnedValue}>+{displayXP}</Text>
            <Text style={styles.xpEarnedLabel}>XP Earned</Text>
          </Animated.View>
        )}

        {personalBest && (
          <Animated.View
            style={[
              styles.pbCard,
              personalBest.beaten && styles.pbCardBeaten,
              { opacity: pbOpacity, transform: [{ translateY: pbSlide }] },
            ]}
          >
            <Animated.View
              style={[styles.pbFlash, { opacity: pbFlashOpacity }]}
              pointerEvents="none"
            />
            <View style={styles.pbHeader}>
              <Trophy size={18} color={personalBest.beaten ? '#D97706' : '#9CA3AF'} />
              <Text style={[styles.pbTitle, personalBest.beaten && styles.pbTitleBeaten]}>
                {personalBest.beaten ? 'NEW PERSONAL BEST!' : 'Personal Best'}
              </Text>
            </View>

            <Animated.View style={[styles.pbScoreRow, { transform: [{ translateY: pbArrowSlide }] }]}>
              <Text style={styles.pbOldScore}>{personalBest.oldAccuracy}%</Text>
              {personalBest.beaten ? (
                <>
                  <ArrowUp size={18} color="#10B981" />
                  <Text style={styles.pbNewScore}>{personalBest.newAccuracy}%</Text>
                </>
              ) : (
                <Text style={styles.pbCurrentScore}>{personalBest.newAccuracy}%</Text>
              )}
            </Animated.View>

            {personalBest.beaten && personalBest.bonusXP > 0 && (
              <View style={styles.pbBonusRow}>
                <Zap size={14} color="#D97706" />
                <Text style={styles.pbBonusText}>+{personalBest.bonusXP} Bonus XP</Text>
              </View>
            )}
          </Animated.View>
        )}

        {connectedWordsCount > 0 && (
          <Animated.View
            style={[
              styles.connectedCard,
              { opacity: conceptsOpacity, transform: [{ translateY: conceptsSlide }] },
            ]}
          >
            <View style={styles.connectedHeader}>
              <Link2 size={16} color="#0D9488" />
              <Text style={styles.connectedTitle}>Connected Learning</Text>
            </View>
            <Text style={styles.connectedValue}>
              {connectedWordsCount} {connectedWordsCount === 1 ? 'word' : 'words'}
            </Text>
            <Text style={styles.connectedDesc}>
              appeared in this lesson that you also encountered in other tabs
            </Text>
          </Animated.View>
        )}

        {conceptsPracticed.length > 0 && (
          <Animated.View
            style={[
              styles.conceptsCard,
              { opacity: conceptsOpacity, transform: [{ translateY: conceptsSlide }] },
            ]}
          >
            <View style={styles.conceptsHeader}>
              <Sparkles size={16} color="#F97316" />
              <Text style={styles.conceptsTitle}>Concepts Practiced</Text>
            </View>
            {conceptsPracticed.map((concept, i) => (
              <View key={i} style={styles.conceptRow}>
                <View
                  style={[
                    styles.conceptIcon,
                    concept.mastered ? styles.conceptIconMastered : styles.conceptIconNotMastered,
                  ]}
                >
                  {concept.mastered ? (
                    <Check size={12} color="#fff" />
                  ) : (
                    <X size={12} color="#fff" />
                  )}
                </View>
                <Text
                  style={[
                    styles.conceptLabel,
                    concept.mastered && styles.conceptLabelMastered,
                  ]}
                  numberOfLines={1}
                >
                  {concept.label}
                </Text>
              </View>
            ))}
          </Animated.View>
        )}

        <Animated.View
          style={[
            styles.buttonsWrap,
            { opacity: buttonsOpacity, transform: [{ translateY: buttonsSlide }] },
          ]}
        >
          <Animated.View style={{ transform: [{ scale: continueScale }] }}>
            <Pressable style={styles.continueBtn} onPress={handleContinuePress} testID="lesson-summary-continue">
              <Text style={styles.continueBtnText}>Continue</Text>
              <ArrowRight size={20} color="#fff" />
            </Pressable>
          </Animated.View>

          <Animated.View style={{ transform: [{ scale: oneMoreScale }] }}>
            <Pressable style={styles.oneMoreBtn} onPress={handleOneMorePress} testID="lesson-summary-one-more">
              <RotateCcw size={18} color="#F97316" />
              <Text style={styles.oneMoreBtnText}>One More Lesson?</Text>
            </Pressable>
          </Animated.View>

          <ShareProgressButton onPress={() => setShowShareCard(true)} />
        </Animated.View>
      </ScrollView>

      <ShareableStatCard
        userName={stats.userName}
        streakCount={stats.streakCount}
        totalXP={stats.totalXP}
        cefrLevel={stats.cefrLevel}
        wordsLearned={stats.wordsLearned}
        visible={showShareCard}
        onClose={() => setShowShareCard(false)}
      />
    </Animated.View>
  );
}

export default React.memo(LessonSummaryInner);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  confettiContainer: {
    position: 'absolute',
    top: -20,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  confettiPiece: {
    position: 'absolute',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
    alignItems: 'center',
  },
  kiriWrap: {
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '800' as const,
    color: Colors.text,
    textAlign: 'center' as const,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    marginBottom: 28,
    lineHeight: 21,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statCardAccuracy: {},
  statValue: {
    fontSize: 26,
    fontWeight: '800' as const,
    color: Colors.text,
  },
  statValueSmall: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: Colors.textMuted,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  conceptsCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  conceptsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  conceptsTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  connectedCard: {
    width: '100%',
    backgroundColor: '#F0FDFA',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#99F6E4',
    alignItems: 'center' as const,
  },
  connectedHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginBottom: 8,
  },
  connectedTitle: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#0D9488',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
  },
  connectedValue: {
    fontSize: 28,
    fontWeight: '800' as const,
    color: '#0F766E',
    marginBottom: 2,
  },
  connectedDesc: {
    fontSize: 13,
    color: '#5EEAD4',
    textAlign: 'center' as const,
    fontWeight: '500' as const,
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  conceptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 7,
  },
  conceptIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  conceptIconMastered: {
    backgroundColor: '#10B981',
  },
  conceptIconNotMastered: {
    backgroundColor: '#D1D5DB',
  },
  conceptLabel: {
    fontSize: 15,
    color: Colors.textSecondary,
    flex: 1,
  },
  conceptLabelMastered: {
    color: '#059669',
    fontWeight: '600' as const,
  },
  buttonsWrap: {
    width: '100%',
    gap: 10,
  },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#F97316',
    paddingVertical: 16,
    borderRadius: 14,
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  continueBtnText: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: '#fff',
  },
  oneMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#FFF7ED',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FFEDD5',
  },
  oneMoreBtnText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#F97316',
  },
  xpEarnedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    width: '100%',
    backgroundColor: '#FFFBEB',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FDE68A',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  xpEarnedValue: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: '#D97706',
  },
  xpEarnedLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#D97706',
    opacity: 0.8,
  },
  pbCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  pbCardBeaten: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  pbFlash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FDE68A',
    borderRadius: 16,
  },
  pbHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  pbTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#9CA3AF',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
  },
  pbTitleBeaten: {
    color: '#92400E',
    fontWeight: '900' as const,
  },
  pbScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  pbOldScore: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: '#9CA3AF',
    textDecorationLine: 'line-through' as const,
  },
  pbNewScore: {
    fontSize: 26,
    fontWeight: '900' as const,
    color: '#059669',
  },
  pbCurrentScore: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  pbBonusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 4,
  },
  pbBonusText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#D97706',
  },
});
