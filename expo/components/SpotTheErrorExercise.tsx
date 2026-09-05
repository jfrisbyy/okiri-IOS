import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Animated,
} from 'react-native';
import { Check, ArrowRight, AlertTriangle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import colors from '@/constants/colors';
import { USE_NATIVE_DRIVER } from '@/constants/animation';
import AnimatedPressable from '@/components/AnimatedPressable';
import AudioSpeakerButton from '@/components/AudioSpeakerButton';

interface SpotTheErrorExerciseProps {
  errorSentence: string;
  correctedSentence: string;
  onAnswer: (correct: boolean) => void;
  muted?: boolean;
}

function SpotTheErrorExerciseInner({
  errorSentence,
  correctedSentence,
  onAnswer,
  muted = false,
}: SpotTheErrorExerciseProps) {
  const words = errorSentence.split(/\s+/);
  const correctedWords = correctedSentence.split(/\s+/);

  const errorIndex = words.findIndex((w, i) => {
    const clean = w.replace(/[.,!?;:'"]/g, '').toLowerCase();
    const corrClean = (correctedWords[i] || '').replace(/[.,!?;:'"]/g, '').toLowerCase();
    return clean !== corrClean;
  });

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [correction, setCorrection] = useState('');
  const [result, setResult] = useState<'correct' | 'incorrect' | null>(null);

  const resultFade = useRef(new Animated.Value(0)).current;
  const inputSlide = useRef(new Animated.Value(0)).current;
  const shakeAnims = useRef<Animated.Value[]>(words.map(() => new Animated.Value(0))).current;
  const wordScales = useRef<Animated.Value[]>(words.map(() => new Animated.Value(1))).current;

  const handleSelectWord = useCallback((index: number) => {
    if (result) return;

    if (selectedIndex === index) {
      setSelectedIndex(null);
      setCorrection('');
      Animated.timing(inputSlide, {
        toValue: 0,
        duration: 200,
        useNativeDriver: USE_NATIVE_DRIVER,
      }).start();
      return;
    }

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    Animated.sequence([
      Animated.timing(wordScales[index], {
        toValue: 1.15,
        duration: 100,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(wordScales[index], {
        toValue: 1,
        duration: 100,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start();

    setSelectedIndex(index);
    setCorrection('');

    Animated.spring(inputSlide, {
      toValue: 1,
      useNativeDriver: USE_NATIVE_DRIVER,
      speed: 14,
      bounciness: 4,
    }).start();
  }, [result, selectedIndex, inputSlide, wordScales]);

  const handleCheck = useCallback(() => {
    if (selectedIndex === null) return;

    const tappedCorrectWord = selectedIndex === errorIndex;
    const correctedWord = correctedWords[errorIndex] || '';
    const cleanCorrection = correction.trim().replace(/[.,!?;:'"]/g, '').toLowerCase();
    const cleanExpected = correctedWord.replace(/[.,!?;:'"]/g, '').toLowerCase();
    const typedCorrectly = cleanCorrection === cleanExpected;

    const isCorrect = tappedCorrectWord && typedCorrectly;

    setResult(isCorrect ? 'correct' : 'incorrect');
    void Haptics.notificationAsync(
      isCorrect
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Error
    );

    Animated.timing(resultFade, {
      toValue: 1,
      duration: 300,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();

    if (!isCorrect && !tappedCorrectWord) {
      Animated.sequence([
        Animated.timing(shakeAnims[selectedIndex], { toValue: 8, duration: 50, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(shakeAnims[selectedIndex], { toValue: -8, duration: 50, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(shakeAnims[selectedIndex], { toValue: 6, duration: 50, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(shakeAnims[selectedIndex], { toValue: -6, duration: 50, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(shakeAnims[selectedIndex], { toValue: 0, duration: 50, useNativeDriver: USE_NATIVE_DRIVER }),
      ]).start();
    }
  }, [selectedIndex, errorIndex, correctedWords, correction, resultFade, shakeAnims]);

  const handleContinue = useCallback(() => {
    onAnswer(result === 'correct');
  }, [result, onAnswer]);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <AlertTriangle size={18} color={colors.warning} />
        <Text style={styles.label}>Spot the error</Text>
        <AudioSpeakerButton
          text={errorSentence}
          size={18}
          color={colors.warning}
          muted={muted}
          style={styles.audioBtn}
        />
      </View>
      <Text style={styles.instruction}>Tap the incorrect word, then type the correction</Text>

      <View style={styles.sentenceContainer}>
        {words.map((word, i) => (
          <Animated.View
            key={`${i}-${word}`}
            style={{
              transform: [
                { translateX: shakeAnims[i] },
                { scale: wordScales[i] },
              ],
            }}
          >
            <AnimatedPressable
              onPress={() => handleSelectWord(i)}
              style={[
                styles.wordChip,
                selectedIndex === i && styles.wordChipSelected,
                result && i === errorIndex && styles.wordChipError,
                result === 'correct' && i === errorIndex && styles.wordChipCorrectHighlight,
              ]}
              haptic="none"
              disabled={!!result}
            >
              <Text
                style={[
                  styles.wordText,
                  selectedIndex === i && styles.wordTextSelected,
                  result && i === errorIndex && styles.wordTextError,
                  result === 'correct' && i === errorIndex && styles.wordTextCorrect,
                ]}
              >
                {word}
              </Text>
            </AnimatedPressable>
          </Animated.View>
        ))}
      </View>

      {selectedIndex !== null && !result && (
        <Animated.View
          style={[
            styles.inputContainer,
            {
              opacity: inputSlide,
              transform: [{
                translateY: inputSlide.interpolate({
                  inputRange: [0, 1],
                  outputRange: [12, 0],
                }),
              }],
            },
          ]}
        >
          <Text style={styles.inputLabel}>
            Replace "<Text style={styles.inputLabelBold}>{words[selectedIndex]}</Text>" with:
          </Text>
          <TextInput
            style={styles.input}
            value={correction}
            onChangeText={setCorrection}
            placeholder="Type the correct word..."
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
          />
        </Animated.View>
      )}

      {result && (
        <Animated.View style={[styles.resultContainer, { opacity: resultFade }]}>
          {result === 'correct' ? (
            <View style={styles.resultBox}>
              <View style={styles.resultIconRow}>
                <View style={styles.successDot}>
                  <Check size={16} color="#fff" strokeWidth={3} />
                </View>
                <Text style={styles.resultCorrectText}>Well spotted!</Text>
              </View>
            </View>
          ) : (
            <View style={styles.resultBox}>
              <Text style={styles.resultIncorrectText}>Not quite</Text>
              <Text style={styles.correctionLabel}>The error was in:</Text>
              <Text style={styles.correctionHighlight}>
                "{words[errorIndex]}" → "{correctedWords[errorIndex]}"
              </Text>
              <Text style={styles.correctionFull}>{correctedSentence}</Text>
            </View>
          )}
        </Animated.View>
      )}

      <View style={styles.actions}>
        {!result && selectedIndex !== null && correction.trim().length > 0 && (
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

export default React.memo(SpotTheErrorExerciseInner);

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
    color: colors.warning,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
    flex: 1,
  },
  audioBtn: {
    marginLeft: 'auto' as const,
  },
  instruction: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 20,
    marginTop: 4,
  },
  sentenceContainer: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 6,
    marginBottom: 20,
    backgroundColor: colors.backgroundSecondary,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  wordChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.backgroundCard,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  wordChipSelected: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  wordChipError: {
    backgroundColor: colors.errorLight,
    borderColor: colors.error,
  },
  wordChipCorrectHighlight: {
    backgroundColor: colors.successLight,
    borderColor: colors.success,
  },
  wordText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: colors.text,
  },
  wordTextSelected: {
    color: colors.primaryDark,
  },
  wordTextError: {
    color: colors.error,
    textDecorationLine: 'line-through' as const,
  },
  wordTextCorrect: {
    color: colors.success,
    textDecorationLine: 'none' as const,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  inputLabelBold: {
    fontWeight: '700' as const,
    color: colors.text,
  },
  input: {
    backgroundColor: colors.backgroundCard,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
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
  correctionHighlight: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: colors.primary,
    marginBottom: 8,
  },
  correctionFull: {
    fontSize: 15,
    color: colors.text,
    fontStyle: 'italic' as const,
    lineHeight: 22,
  },
  actions: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'flex-end' as const,
    gap: 12,
    marginTop: 20,
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
