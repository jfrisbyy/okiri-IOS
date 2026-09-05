import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
} from 'react-native';
import { Check, ArrowRight, Link } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import colors from '@/constants/colors';
import { USE_NATIVE_DRIVER } from '@/constants/animation';
import AnimatedPressable from '@/components/AnimatedPressable';
import AudioSpeakerButton from '@/components/AudioSpeakerButton';

interface Pair {
  left: string;
  right: string;
}

interface MatchPairsExerciseProps {
  pairs: Pair[];
  onComplete: (allCorrect: boolean) => void;
  muted?: boolean;
}

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function MatchPairsExerciseInner({
  pairs,
  onComplete,
  muted = false,
}: MatchPairsExerciseProps) {
  const shuffledRight = useMemo(() => shuffleArray(pairs.map(p => p.right)), [pairs]);

  const [selectedLeft, setSelectedLeft] = useState<number | null>(null);
  const [selectedRight, setSelectedRight] = useState<number | null>(null);
  const [matchedPairs, setMatchedPairs] = useState<Set<number>>(new Set());
  const [matchedRight, setMatchedRight] = useState<Set<number>>(new Set());
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [flashWrong, setFlashWrong] = useState<{ left: number; right: number } | null>(null);

  const matchAnims = useRef<Animated.Value[]>(pairs.map(() => new Animated.Value(0))).current;
  const shakeAnims = useRef<{ left: Animated.Value[]; right: Animated.Value[] }>({
    left: pairs.map(() => new Animated.Value(0)),
    right: shuffledRight.map(() => new Animated.Value(0)),
  }).current;
  const resultFade = useRef(new Animated.Value(0)).current;

  const allMatched = matchedPairs.size === pairs.length;

  const tryMatch = useCallback((leftIdx: number, rightIdx: number) => {
    const rightWord = shuffledRight[rightIdx];
    const correctRight = pairs[leftIdx].right;
    const isMatch = rightWord === correctRight;

    if (isMatch) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const newMatched = new Set(matchedPairs);
      newMatched.add(leftIdx);
      setMatchedPairs(newMatched);

      const newMatchedRight = new Set(matchedRight);
      newMatchedRight.add(rightIdx);
      setMatchedRight(newMatchedRight);

      Animated.spring(matchAnims[leftIdx], {
        toValue: 1,
        useNativeDriver: USE_NATIVE_DRIVER,
        speed: 12,
        bounciness: 10,
      }).start();

      setSelectedLeft(null);
      setSelectedRight(null);

      if (newMatched.size === pairs.length) {
        setTimeout(() => {
          Animated.timing(resultFade, {
            toValue: 1,
            duration: 400,
            useNativeDriver: USE_NATIVE_DRIVER,
          }).start();
        }, 300);
      }
    } else {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setWrongAttempts(prev => prev + 1);
      setFlashWrong({ left: leftIdx, right: rightIdx });

      const leftShake = shakeAnims.left[leftIdx];
      const rightShake = shakeAnims.right[rightIdx];

      Animated.parallel([
        Animated.sequence([
          Animated.timing(leftShake, { toValue: 8, duration: 50, useNativeDriver: USE_NATIVE_DRIVER }),
          Animated.timing(leftShake, { toValue: -8, duration: 50, useNativeDriver: USE_NATIVE_DRIVER }),
          Animated.timing(leftShake, { toValue: 6, duration: 50, useNativeDriver: USE_NATIVE_DRIVER }),
          Animated.timing(leftShake, { toValue: -6, duration: 50, useNativeDriver: USE_NATIVE_DRIVER }),
          Animated.timing(leftShake, { toValue: 0, duration: 50, useNativeDriver: USE_NATIVE_DRIVER }),
        ]),
        Animated.sequence([
          Animated.timing(rightShake, { toValue: 8, duration: 50, useNativeDriver: USE_NATIVE_DRIVER }),
          Animated.timing(rightShake, { toValue: -8, duration: 50, useNativeDriver: USE_NATIVE_DRIVER }),
          Animated.timing(rightShake, { toValue: 6, duration: 50, useNativeDriver: USE_NATIVE_DRIVER }),
          Animated.timing(rightShake, { toValue: -6, duration: 50, useNativeDriver: USE_NATIVE_DRIVER }),
          Animated.timing(rightShake, { toValue: 0, duration: 50, useNativeDriver: USE_NATIVE_DRIVER }),
        ]),
      ]).start(() => {
        setFlashWrong(null);
        setSelectedLeft(null);
        setSelectedRight(null);
      });
    }
  }, [pairs, shuffledRight, matchedPairs, matchedRight, matchAnims, shakeAnims, resultFade]);

  const handleLeftPress = useCallback((index: number) => {
    if (matchedPairs.has(index) || flashWrong) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (selectedLeft === index) {
      setSelectedLeft(null);
      return;
    }

    setSelectedLeft(index);

    if (selectedRight !== null) {
      tryMatch(index, selectedRight);
    }
  }, [matchedPairs, flashWrong, selectedLeft, selectedRight, tryMatch]);

  const handleRightPress = useCallback((index: number) => {
    if (matchedRight.has(index) || flashWrong) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (selectedRight === index) {
      setSelectedRight(null);
      return;
    }

    setSelectedRight(index);

    if (selectedLeft !== null) {
      tryMatch(selectedLeft, index);
    }
  }, [matchedRight, flashWrong, selectedRight, selectedLeft, tryMatch]);

  const handleContinue = useCallback(() => {
    onComplete(wrongAttempts === 0);
  }, [wrongAttempts, onComplete]);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Link size={16} color={colors.secondary} />
        <Text style={styles.label}>Match the pairs</Text>
      </View>
      <Text style={styles.instruction}>Tap one from each column to match</Text>

      <View style={styles.columnsContainer}>
        <View style={styles.column}>
          <Text style={styles.columnHeader}>Français</Text>
          {pairs.map((pair, i) => {
            const isMatched = matchedPairs.has(i);
            const isSelected = selectedLeft === i;
            const isWrong = flashWrong?.left === i;

            return (
              <Animated.View
                key={`left-${i}`}
                style={{
                  transform: [{ translateX: shakeAnims.left[i] }],
                  opacity: matchAnims[i].interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1],
                  }),
                }}
              >
                <AnimatedPressable
                  onPress={() => handleLeftPress(i)}
                  style={[
                    styles.pairItem,
                    isSelected && styles.pairItemSelected,
                    isMatched && styles.pairItemMatched,
                    isWrong && styles.pairItemWrong,
                  ]}
                  haptic="none"
                  disabled={isMatched || !!flashWrong}
                >
                  {isMatched && (
                    <View style={styles.matchDot}>
                      <Check size={10} color="#fff" strokeWidth={3} />
                    </View>
                  )}
                  <Text
                    style={[
                      styles.pairText,
                      isSelected && styles.pairTextSelected,
                      isMatched && styles.pairTextMatched,
                      isWrong && styles.pairTextWrong,
                    ]}
                    numberOfLines={2}
                  >
                    {pair.left}
                  </Text>
                  {!isMatched && (
                    <AudioSpeakerButton
                      text={pair.left}
                      size={14}
                      color={colors.textMuted}
                      muted={muted}
                    />
                  )}
                </AnimatedPressable>
              </Animated.View>
            );
          })}
        </View>

        <View style={styles.dividerVertical} />

        <View style={styles.column}>
          <Text style={styles.columnHeader}>English</Text>
          {shuffledRight.map((word, i) => {
            const isMatched = matchedRight.has(i);
            const isSelected = selectedRight === i;
            const isWrong = flashWrong?.right === i;

            return (
              <Animated.View
                key={`right-${i}`}
                style={{
                  transform: [{ translateX: shakeAnims.right[i] }],
                }}
              >
                <AnimatedPressable
                  onPress={() => handleRightPress(i)}
                  style={[
                    styles.pairItem,
                    isSelected && styles.pairItemSelected,
                    isMatched && styles.pairItemMatched,
                    isWrong && styles.pairItemWrong,
                  ]}
                  haptic="none"
                  disabled={isMatched || !!flashWrong}
                >
                  {isMatched && (
                    <View style={styles.matchDot}>
                      <Check size={10} color="#fff" strokeWidth={3} />
                    </View>
                  )}
                  <Text
                    style={[
                      styles.pairText,
                      isSelected && styles.pairTextSelected,
                      isMatched && styles.pairTextMatched,
                      isWrong && styles.pairTextWrong,
                    ]}
                    numberOfLines={2}
                  >
                    {word}
                  </Text>
                </AnimatedPressable>
              </Animated.View>
            );
          })}
        </View>
      </View>

      {allMatched && (
        <Animated.View style={[styles.resultContainer, { opacity: resultFade }]}>
          <View style={styles.resultBox}>
            <View style={styles.resultIconRow}>
              <View style={styles.successDot}>
                <Check size={16} color="#fff" strokeWidth={3} />
              </View>
              <Text style={styles.resultCorrectText}>
                {wrongAttempts === 0 ? 'Perfect match!' : `Matched! (${wrongAttempts} wrong ${wrongAttempts === 1 ? 'attempt' : 'attempts'})`}
              </Text>
            </View>
          </View>
        </Animated.View>
      )}

      <View style={styles.actions}>
        {!allMatched && (
          <Text style={styles.progressText}>
            {matchedPairs.size}/{pairs.length} matched
          </Text>
        )}

        {allMatched && (
          <AnimatedPressable onPress={handleContinue} style={styles.continueButton} haptic="medium">
            <Text style={styles.continueButtonText}>Continue</Text>
            <ArrowRight size={18} color="#fff" strokeWidth={2.5} />
          </AnimatedPressable>
        )}
      </View>
    </View>
  );
}

export default React.memo(MatchPairsExerciseInner);

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginBottom: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: colors.secondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
  },
  instruction: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 20,
    marginTop: 4,
  },
  columnsContainer: {
    flexDirection: 'row' as const,
    gap: 0,
    marginBottom: 16,
  },
  column: {
    flex: 1,
    gap: 8,
  },
  columnHeader: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: colors.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    textAlign: 'center' as const,
    marginBottom: 4,
  },
  dividerVertical: {
    width: 1,
    backgroundColor: colors.border,
    marginHorizontal: 8,
  },
  pairItem: {
    backgroundColor: colors.backgroundCard,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    minHeight: 50,
  },
  pairItemSelected: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  pairItemMatched: {
    backgroundColor: colors.successLight,
    borderColor: colors.success,
  },
  pairItemWrong: {
    backgroundColor: colors.errorLight,
    borderColor: colors.error,
  },
  pairText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: colors.text,
    flex: 1,
  },
  pairTextSelected: {
    color: colors.primaryDark,
  },
  pairTextMatched: {
    color: colors.success,
  },
  pairTextWrong: {
    color: colors.error,
  },
  matchDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.success,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  progressText: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '500' as const,
  },
  resultContainer: {
    marginTop: 8,
  },
  resultBox: {
    paddingVertical: 12,
  },
  resultIconRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
  },
  successDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.success,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  resultCorrectText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: colors.success,
  },
  actions: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'flex-end' as const,
    gap: 12,
    marginTop: 20,
  },
  continueButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
  },
});
