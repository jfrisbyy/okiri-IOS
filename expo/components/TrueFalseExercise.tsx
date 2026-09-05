import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
} from 'react-native';
import { Check, X, ArrowRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import colors from '@/constants/colors';
import { USE_NATIVE_DRIVER } from '@/constants/animation';
import AnimatedPressable from '@/components/AnimatedPressable';
import AudioSpeakerButton from '@/components/AudioSpeakerButton';

interface TrueFalseExerciseProps {
  statement: string;
  isTrue: boolean;
  context: string;
  onAnswer: (correct: boolean) => void;
  muted?: boolean;
}

function TrueFalseExerciseInner({
  statement,
  isTrue,
  context,
  onAnswer,
  muted = false,
}: TrueFalseExerciseProps) {
  const [selected, setSelected] = useState<'true' | 'false' | null>(null);
  const [result, setResult] = useState<'correct' | 'incorrect' | null>(null);

  const resultFade = useRef(new Animated.Value(0)).current;
  const trueBounce = useRef(new Animated.Value(1)).current;
  const falseBounce = useRef(new Animated.Value(1)).current;
  const trueGlow = useRef(new Animated.Value(0)).current;
  const falseGlow = useRef(new Animated.Value(0)).current;
  const statementScale = useRef(new Animated.Value(1)).current;

  const handleSelect = useCallback((choice: 'true' | 'false') => {
    if (result) return;

    const isCorrect = (choice === 'true') === isTrue;
    setSelected(choice);
    setResult(isCorrect ? 'correct' : 'incorrect');

    void Haptics.notificationAsync(
      isCorrect
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Error
    );

    const bounceAnim = choice === 'true' ? trueBounce : falseBounce;
    const glowAnim = choice === 'true' ? trueGlow : falseGlow;

    Animated.parallel([
      Animated.sequence([
        Animated.timing(bounceAnim, {
          toValue: 0.88,
          duration: 80,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.spring(bounceAnim, {
          toValue: 1,
          useNativeDriver: USE_NATIVE_DRIVER,
          speed: 12,
          bounciness: 14,
        }),
      ]),
      Animated.timing(glowAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(resultFade, {
        toValue: 1,
        duration: 350,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.sequence([
        Animated.timing(statementScale, {
          toValue: 1.02,
          duration: 150,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(statementScale, {
          toValue: 1,
          duration: 150,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]),
    ]).start();
  }, [result, isTrue, trueBounce, falseBounce, trueGlow, falseGlow, resultFade, statementScale]);

  const handleContinue = useCallback(() => {
    onAnswer(result === 'correct');
  }, [result, onAnswer]);

  const trueCorrect = result && isTrue;
  const falseCorrect = result && !isTrue;
  const trueWrong = result && selected === 'true' && !isTrue;
  const falseWrong = result && selected === 'false' && isTrue;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>True or False?</Text>

      <View style={styles.contextBox}>
        <Text style={styles.contextText}>{context}</Text>
      </View>

      <Animated.View style={[styles.statementCard, { transform: [{ scale: statementScale }] }]}>
        <Text style={styles.statementText}>{statement}</Text>
        <AudioSpeakerButton
          text={statement}
          size={18}
          color={colors.secondary}
          muted={muted}
          style={styles.statementAudio}
        />
      </Animated.View>

      <View style={styles.buttonRow}>
        <Animated.View style={[
          styles.buttonWrapper,
          {
            transform: [{ scale: trueBounce }],
            opacity: trueGlow.interpolate({
              inputRange: [0, 1],
              outputRange: [1, trueWrong ? 0.6 : 1],
            }),
          },
        ]}>
          <AnimatedPressable
            onPress={() => handleSelect('true')}
            style={[
              styles.choiceButton,
              styles.trueButton,
              selected === 'true' && styles.trueButtonActive,
              trueCorrect && styles.correctButton,
              trueWrong && styles.wrongButton,
            ]}
            haptic="none"
            disabled={!!result}
          >
            <View style={[
              styles.iconCircle,
              styles.trueIconCircle,
              trueCorrect && styles.correctIconCircle,
              trueWrong && styles.wrongIconCircle,
            ]}>
              <Check
                size={28}
                color={trueCorrect ? '#fff' : trueWrong ? '#fff' : colors.success}
                strokeWidth={3}
              />
            </View>
            <Text style={[
              styles.choiceLabel,
              styles.trueLabelText,
              trueCorrect && styles.correctLabelText,
              trueWrong && styles.wrongLabelText,
            ]}>True</Text>
          </AnimatedPressable>
        </Animated.View>

        <Animated.View style={[
          styles.buttonWrapper,
          {
            transform: [{ scale: falseBounce }],
            opacity: falseGlow.interpolate({
              inputRange: [0, 1],
              outputRange: [1, falseWrong ? 0.6 : 1],
            }),
          },
        ]}>
          <AnimatedPressable
            onPress={() => handleSelect('false')}
            style={[
              styles.choiceButton,
              styles.falseButton,
              selected === 'false' && styles.falseButtonActive,
              falseCorrect && styles.correctButton,
              falseWrong && styles.wrongButton,
            ]}
            haptic="none"
            disabled={!!result}
          >
            <View style={[
              styles.iconCircle,
              styles.falseIconCircle,
              falseCorrect && styles.correctIconCircle,
              falseWrong && styles.wrongIconCircle,
            ]}>
              <X
                size={28}
                color={falseCorrect ? '#fff' : falseWrong ? '#fff' : colors.error}
                strokeWidth={3}
              />
            </View>
            <Text style={[
              styles.choiceLabel,
              styles.falseLabelText,
              falseCorrect && styles.correctLabelText,
              falseWrong && styles.wrongLabelText,
            ]}>False</Text>
          </AnimatedPressable>
        </Animated.View>
      </View>

      {result && (
        <Animated.View style={[styles.resultContainer, { opacity: resultFade }]}>
          {result === 'correct' ? (
            <View style={styles.resultBox}>
              <View style={styles.resultIconRow}>
                <View style={styles.successDot}>
                  <Check size={16} color="#fff" strokeWidth={3} />
                </View>
                <Text style={styles.resultCorrectText}>Correct!</Text>
              </View>
            </View>
          ) : (
            <View style={styles.resultBox}>
              <Text style={styles.resultIncorrectText}>Incorrect</Text>
              <Text style={styles.correctionLabel}>
                The statement is <Text style={styles.correctionBold}>{isTrue ? 'TRUE' : 'FALSE'}</Text>
              </Text>
            </View>
          )}
        </Animated.View>
      )}

      <View style={styles.actions}>
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

export default React.memo(TrueFalseExerciseInner);

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: colors.secondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
    marginBottom: 12,
  },
  contextBox: {
    backgroundColor: colors.secondaryLight,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: colors.secondary,
  },
  contextText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    fontWeight: '500' as const,
  },
  statementCard: {
    backgroundColor: colors.backgroundCard,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  statementText: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: colors.text,
    lineHeight: 28,
    textAlign: 'center' as const,
  },
  statementAudio: {
    marginTop: 12,
    alignSelf: 'center' as const,
    backgroundColor: colors.secondaryLight,
  },
  buttonRow: {
    flexDirection: 'row' as const,
    gap: 14,
    marginBottom: 16,
  },
  buttonWrapper: {
    flex: 1,
  },
  choiceButton: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 24,
    borderRadius: 18,
    borderWidth: 2,
  },
  trueButton: {
    backgroundColor: colors.successLight,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  trueButtonActive: {
    borderColor: colors.success,
  },
  falseButton: {
    backgroundColor: colors.errorLight,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  falseButtonActive: {
    borderColor: colors.error,
  },
  correctButton: {
    backgroundColor: colors.successLight,
    borderColor: colors.success,
  },
  wrongButton: {
    backgroundColor: colors.errorLight,
    borderColor: colors.error,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 8,
  },
  trueIconCircle: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  falseIconCircle: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  correctIconCircle: {
    backgroundColor: colors.success,
  },
  wrongIconCircle: {
    backgroundColor: colors.error,
  },
  choiceLabel: {
    fontSize: 16,
    fontWeight: '700' as const,
  },
  trueLabelText: {
    color: colors.success,
  },
  falseLabelText: {
    color: colors.error,
  },
  correctLabelText: {
    color: colors.success,
  },
  wrongLabelText: {
    color: colors.error,
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
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  correctionBold: {
    fontWeight: '700' as const,
    color: colors.text,
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
