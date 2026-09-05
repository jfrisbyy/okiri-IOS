import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Pressable,
} from 'react-native';
import { Check, RotateCcw, ArrowRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import colors from '@/constants/colors';
import { USE_NATIVE_DRIVER } from '@/constants/animation';
import AnimatedPressable from '@/components/AnimatedPressable';
import { audioService } from '@/utils/audioService';

interface SentenceBuildExerciseProps {
  words: string[];
  correctAnswer: string;
  hint: string;
  onAnswer: (correct: boolean) => void;
  muted?: boolean;
}

function SentenceBuildExerciseInner({
  words,
  correctAnswer,
  hint,
  onAnswer,
  muted = false,
}: SentenceBuildExerciseProps) {
  const [bankWords, setBankWords] = useState<string[]>(words);
  const [placedWords, setPlacedWords] = useState<string[]>([]);
  const [result, setResult] = useState<'correct' | 'incorrect' | null>(null);
  const [showHint, setShowHint] = useState(false);

  const fadeAnims = useRef<Record<string, Animated.Value>>({});
  const resultFade = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const zonePulse = useRef(new Animated.Value(1)).current;

  const getAnim = useCallback((key: string) => {
    if (!fadeAnims.current[key]) {
      fadeAnims.current[key] = new Animated.Value(1);
    }
    return fadeAnims.current[key];
  }, []);

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(zonePulse, {
          toValue: 1.01,
          duration: 1500,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(zonePulse, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ])
    );
    if (placedWords.length === 0 && !result) {
      pulse.start();
    }
    return () => pulse.stop();
  }, [placedWords.length, result, zonePulse]);

  const handlePlaceWord = useCallback((word: string, index: number) => {
    if (result) return;
    const key = `bank-${index}-${word}`;
    const anim = getAnim(key);

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    Animated.timing(anim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start(() => {
      setBankWords(prev => {
        const next = [...prev];
        next.splice(index, 1);
        return next;
      });
      setPlacedWords(prev => [...prev, word]);
      anim.setValue(1);
    });
  }, [result, getAnim]);

  const handleRemoveWord = useCallback((word: string, index: number) => {
    if (result) return;
    const key = `placed-${index}-${word}`;
    const anim = getAnim(key);

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    Animated.timing(anim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start(() => {
      setPlacedWords(prev => {
        const next = [...prev];
        next.splice(index, 1);
        return next;
      });
      setBankWords(prev => [...prev, word]);
      anim.setValue(1);
    });
  }, [result, getAnim]);

  const handleCheck = useCallback(() => {
    const userAnswer = placedWords.join(' ').trim().toLowerCase().replace(/\s+/g, ' ');
    const expected = correctAnswer.trim().toLowerCase().replace(/\s+/g, ' ');
    const isCorrect = userAnswer === expected;

    setResult(isCorrect ? 'correct' : 'incorrect');
    void Haptics.notificationAsync(
      isCorrect
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Error
    );

    if (isCorrect && !muted) {
      audioService.playFrenchAudio(correctAnswer).catch(() => {});
    }

    Animated.timing(resultFade, {
      toValue: 1,
      duration: 300,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();

    if (!isCorrect) {
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: USE_NATIVE_DRIVER }),
      ]).start();
    }
  }, [placedWords, correctAnswer, resultFade, shakeAnim, muted]);

  const handleReset = useCallback(() => {
    setBankWords(words);
    setPlacedWords([]);
    setResult(null);
    setShowHint(false);
    resultFade.setValue(0);
    shakeAnim.setValue(0);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [words, resultFade, shakeAnim]);

  const handleContinue = useCallback(() => {
    onAnswer(result === 'correct');
  }, [result, onAnswer]);

  const allPlaced = bankWords.length === 0 && placedWords.length > 0;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Translate to French</Text>
      <Text style={styles.prompt}>{hint}</Text>

      {showHint && (
        <View style={styles.hintBox}>
          <Text style={styles.hintText}>Hint: {correctAnswer.split(' ').slice(0, 2).join(' ')}...</Text>
        </View>
      )}

      <Animated.View
        style={[
          styles.answerZone,
          result === 'correct' && styles.answerZoneCorrect,
          result === 'incorrect' && styles.answerZoneIncorrect,
          {
            transform: [
              { translateX: shakeAnim },
              { scale: !result && placedWords.length === 0 ? zonePulse : 1 },
            ],
          },
        ]}
      >
        {placedWords.length === 0 && !result && (
          <Text style={styles.answerPlaceholder}>Tap words to build the sentence</Text>
        )}
        <View style={styles.chipRow}>
          {placedWords.map((word, i) => {
            const key = `placed-${i}-${word}`;
            const anim = getAnim(key);
            return (
              <Animated.View key={key} style={{ opacity: anim, transform: [{ scale: anim }] }}>
                <AnimatedPressable
                  onPress={() => handleRemoveWord(word, i)}
                  style={[
                    styles.chip,
                    styles.chipPlaced,
                    result === 'correct' && styles.chipCorrect,
                    result === 'incorrect' && styles.chipIncorrect,
                  ]}
                  haptic="light"
                  disabled={!!result}
                >
                  <Text style={[
                    styles.chipText,
                    styles.chipTextPlaced,
                    result === 'correct' && styles.chipTextCorrect,
                  ]}>{word}</Text>
                </AnimatedPressable>
              </Animated.View>
            );
          })}
        </View>
      </Animated.View>

      <View style={styles.divider} />

      <View style={styles.bankZone}>
        <View style={styles.chipRow}>
          {bankWords.map((word, i) => {
            const key = `bank-${i}-${word}`;
            const anim = getAnim(key);
            return (
              <Animated.View key={key} style={{ opacity: anim, transform: [{ scale: anim }] }}>
                <AnimatedPressable
                  onPress={() => handlePlaceWord(word, i)}
                  style={styles.chip}
                  haptic="light"
                  disabled={!!result}
                >
                  <Text style={styles.chipText}>{word}</Text>
                </AnimatedPressable>
              </Animated.View>
            );
          })}
        </View>
      </View>

      {result && (
        <Animated.View style={[styles.resultContainer, { opacity: resultFade }]}>
          {result === 'correct' ? (
            <View style={styles.resultBox}>
              <View style={styles.resultIconRow}>
                <View style={styles.successDot}>
                  <Check size={16} color="#fff" strokeWidth={3} />
                </View>
                <Text style={styles.resultCorrectText}>Excellent!</Text>
              </View>
            </View>
          ) : (
            <View style={styles.resultBox}>
              <Text style={styles.resultIncorrectText}>Not quite right</Text>
              <Text style={styles.correctionLabel}>Correct answer:</Text>
              <Text style={styles.correctionText}>{correctAnswer}</Text>
            </View>
          )}
        </Animated.View>
      )}

      <View style={styles.actions}>
        {!result && !showHint && placedWords.length === 0 && (
          <Pressable onPress={() => setShowHint(true)} style={styles.hintButton}>
            <Text style={styles.hintButtonText}>Show hint</Text>
          </Pressable>
        )}

        {!result && placedWords.length > 0 && (
          <Pressable onPress={handleReset} style={styles.resetButton}>
            <RotateCcw size={18} color={colors.textSecondary} />
            <Text style={styles.resetText}>Reset</Text>
          </Pressable>
        )}

        {!result && allPlaced && (
          <AnimatedPressable onPress={handleCheck} style={styles.checkButton} haptic="medium">
            <Text style={styles.checkButtonText}>Check</Text>
            <Check size={18} color="#fff" strokeWidth={2.5} />
          </AnimatedPressable>
        )}

        {result && (
          <AnimatedPressable onPress={handleContinue} style={styles.continueButton} haptic="medium">
            <Text style={styles.continueButtonText}>Continue</Text>
            <ArrowRight size={18} color="#fff" strokeWidth={2.5} />
          </AnimatedPressable>
        )}
      </View>
    </View>
  );
}

export default React.memo(SentenceBuildExerciseInner);

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: colors.primary,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
    marginBottom: 6,
  },
  prompt: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: colors.text,
    lineHeight: 28,
    marginBottom: 20,
  },
  hintBox: {
    backgroundColor: colors.warningLight,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: colors.warning,
  },
  hintText: {
    fontSize: 14,
    color: colors.warning,
    fontWeight: '500' as const,
    fontStyle: 'italic' as const,
  },
  answerZone: {
    minHeight: 80,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed' as const,
    padding: 12,
    justifyContent: 'center',
  },
  answerZoneCorrect: {
    backgroundColor: colors.successLight,
    borderColor: colors.success,
    borderStyle: 'solid' as const,
  },
  answerZoneIncorrect: {
    backgroundColor: colors.errorLight,
    borderColor: colors.error,
    borderStyle: 'solid' as const,
  },
  answerPlaceholder: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center' as const,
    fontStyle: 'italic' as const,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 16,
    marginHorizontal: 20,
  },
  bankZone: {
    minHeight: 60,
  },
  chipRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
  },
  chip: {
    backgroundColor: colors.backgroundCard,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  chipPlaced: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  chipCorrect: {
    backgroundColor: colors.successLight,
    borderColor: colors.success,
  },
  chipIncorrect: {
    backgroundColor: colors.errorLight,
    borderColor: colors.error,
  },
  chipText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.text,
  },
  chipTextPlaced: {
    color: colors.primaryDark,
  },
  chipTextCorrect: {
    color: colors.success,
  },
  resultContainer: {
    marginTop: 16,
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
  resultIncorrectText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: colors.error,
    marginBottom: 6,
  },
  correctionLabel: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  correctionText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.text,
    fontStyle: 'italic' as const,
  },
  actions: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'flex-end' as const,
    gap: 12,
    marginTop: 20,
  },
  hintButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  hintButtonText: {
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: '500' as const,
  },
  resetButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  resetText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500' as const,
  },
  checkButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
  },
  checkButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
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
