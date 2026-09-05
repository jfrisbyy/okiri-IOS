import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Animated,
} from 'react-native';
import { Languages, Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import colors from '@/constants/colors';
import { USE_NATIVE_DRIVER } from '@/constants/animation';
import AnimatedPressable from '@/components/AnimatedPressable';
import AudioSpeakerButton from '@/components/AudioSpeakerButton';

interface TranslationExerciseProps {
  sourceText: string;
  acceptableAnswers: string[];
  onAnswer: (correct: boolean) => void;
  muted?: boolean;
}

function normalize(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .replace(/['']/g, "'")
    .replace(/[""«»]/g, '"')
    .replace(/\s+/g, ' ')
    .replace(/[.,!?;:…]+$/g, '');
}

function stripAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function fuzzyMatch(input: string, acceptableAnswers: string[]): boolean {
  const normalizedInput = normalize(input);
  const strippedInput = stripAccents(normalizedInput);

  for (const answer of acceptableAnswers) {
    const normalizedAnswer = normalize(answer);
    if (normalizedInput === normalizedAnswer) return true;
    if (strippedInput === stripAccents(normalizedAnswer)) return true;

    const len = Math.max(normalizedInput.length, normalizedAnswer.length);
    if (len === 0) continue;
    let dist = 0;
    const a = normalizedInput;
    const b = normalizedAnswer;
    const maxLen = Math.max(a.length, b.length);
    for (let i = 0; i < maxLen; i++) {
      if (a[i] !== b[i]) dist++;
    }
    dist += Math.abs(a.length - b.length);
    if (dist <= Math.max(1, Math.floor(len * 0.15))) return true;
  }
  return false;
}

function TranslationExerciseInner({
  sourceText,
  acceptableAnswers,
  onAnswer,
  muted = false,
}: TranslationExerciseProps) {
  const [userInput, setUserInput] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  const resultFade = useRef(new Animated.Value(0)).current;
  const inputShake = useRef(new Animated.Value(0)).current;

  const handleCheck = useCallback(() => {
    if (userInput.trim().length === 0 || submitted) return;

    const correct = fuzzyMatch(userInput, acceptableAnswers);
    setIsCorrect(correct);
    setSubmitted(true);

    void Haptics.notificationAsync(
      correct
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Error
    );

    Animated.timing(resultFade, {
      toValue: 1,
      duration: 300,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();

    if (!correct) {
      Animated.sequence([
        Animated.timing(inputShake, { toValue: 10, duration: 50, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(inputShake, { toValue: -10, duration: 50, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(inputShake, { toValue: 8, duration: 50, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(inputShake, { toValue: -8, duration: 50, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(inputShake, { toValue: 0, duration: 50, useNativeDriver: USE_NATIVE_DRIVER }),
      ]).start();
    }
  }, [userInput, acceptableAnswers, submitted, resultFade, inputShake]);

  const handleContinue = useCallback(() => {
    onAnswer(isCorrect);
  }, [isCorrect, onAnswer]);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Languages size={18} color={colors.secondary} />
        <Text style={styles.label}>Translate to French</Text>
      </View>

      <View style={styles.sourceCard}>
        <View style={styles.sourceRow}>
          <Text style={styles.sourceText}>{sourceText}</Text>
          <AudioSpeakerButton
            text={sourceText}
            size={18}
            color={colors.primary}
            muted={muted}
            testID="translation-listen-btn"
          />
        </View>
      </View>

      <Animated.View style={{ transform: [{ translateX: inputShake }] }}>
        <TextInput
          style={[
            styles.input,
            submitted && isCorrect && styles.inputCorrect,
            submitted && !isCorrect && styles.inputIncorrect,
          ]}
          value={userInput}
          onChangeText={setUserInput}
          placeholder="Type your French translation..."
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          multiline
          editable={!submitted}
          returnKeyType="done"
          testID="translation-input"
        />
      </Animated.View>

      {submitted && (
        <Animated.View style={[styles.resultContainer, { opacity: resultFade }]}>
          {isCorrect ? (
            <View style={styles.resultRow}>
              <View style={styles.successDot}>
                <Check size={14} color="#fff" strokeWidth={3} />
              </View>
              <Text style={styles.resultCorrectText}>Great translation!</Text>
            </View>
          ) : (
            <View>
              <Text style={styles.resultIncorrectText}>Not quite right</Text>
              <Text style={styles.acceptedLabel}>Accepted answer:</Text>
              <Text style={styles.acceptedAnswer}>{acceptableAnswers[0]}</Text>
            </View>
          )}
        </Animated.View>
      )}

      <View style={styles.actions}>
        {!submitted && userInput.trim().length > 0 && (
          <AnimatedPressable onPress={handleCheck} style={styles.checkButton} haptic="medium">
            <Text style={styles.checkButtonText}>Check</Text>
            <Check size={18} color="#fff" strokeWidth={2.5} />
          </AnimatedPressable>
        )}

        {submitted && (
          <AnimatedPressable onPress={handleContinue} style={styles.continueButton} haptic="medium">
            <Text style={styles.continueButtonText}>Continue</Text>
          </AnimatedPressable>
        )}
      </View>
    </View>
  );
}

export default React.memo(TranslationExerciseInner);

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: colors.secondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
  },
  sourceCard: {
    backgroundColor: colors.backgroundSecondary,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
  },
  sourceRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
  },
  sourceText: {
    fontSize: 19,
    fontWeight: '600' as const,
    color: colors.text,
    lineHeight: 28,
    flex: 1,
  },
  input: {
    backgroundColor: colors.backgroundCard,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 17,
    color: colors.text,
    fontWeight: '500' as const,
    minHeight: 56,
    textAlignVertical: 'top' as const,
  },
  inputCorrect: {
    borderColor: colors.success,
    backgroundColor: colors.successLight,
  },
  inputIncorrect: {
    borderColor: colors.error,
    backgroundColor: colors.errorLight,
  },
  resultContainer: {
    marginTop: 16,
  },
  resultRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
  },
  successDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.success,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  resultCorrectText: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: colors.success,
  },
  resultIncorrectText: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: colors.error,
    marginBottom: 6,
  },
  acceptedLabel: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  acceptedAnswer: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.primary,
    fontStyle: 'italic' as const,
  },
  actions: {
    flexDirection: 'row' as const,
    justifyContent: 'flex-end' as const,
    marginTop: 24,
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
