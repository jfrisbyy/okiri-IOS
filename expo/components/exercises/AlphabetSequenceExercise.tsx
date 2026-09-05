import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Animated,
} from 'react-native';
import { Check, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { USE_NATIVE_DRIVER } from '@/constants/animation';

interface AlphabetSequenceExerciseProps {
  sequence: string[];
  blankIndex: number;
  correctAnswer: string;
  onAnswer: (correct: boolean) => void;
  muted?: boolean;
}

function AlphabetSequenceExerciseInner({
  sequence,
  blankIndex,
  correctAnswer,
  onAnswer,
}: AlphabetSequenceExerciseProps) {
  const [userInput, setUserInput] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  const resultFade = useRef(new Animated.Value(0)).current;
  const blankScale = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const handleCheck = useCallback(() => {
    if (userInput.trim().length === 0 || submitted) return;

    const correct = userInput.trim().toLowerCase() === correctAnswer.trim().toLowerCase();
    setIsCorrect(correct);
    setSubmitted(true);

    Animated.timing(resultFade, { toValue: 1, duration: 300, useNativeDriver: USE_NATIVE_DRIVER }).start();

    if (correct) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Animated.sequence([
        Animated.timing(blankScale, { toValue: 1.2, duration: 150, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.spring(blankScale, { toValue: 1, friction: 4, tension: 100, useNativeDriver: USE_NATIVE_DRIVER }),
      ]).start();
    } else {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(shakeAnim, { toValue: 6, duration: 50, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(shakeAnim, { toValue: -6, duration: 50, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: USE_NATIVE_DRIVER }),
      ]).start();
    }

    setTimeout(() => {
      onAnswer(correct);
    }, correct ? 800 : 1500);
  }, [userInput, submitted, correctAnswer, onAnswer, resultFade, blankScale, shakeAnim]);

  return (
    <View style={styles.container}>
      <Text style={styles.instructionText}>What letter is missing?</Text>

      <Animated.View style={[styles.sequenceRow, { transform: [{ translateX: shakeAnim }] }]}>
        {sequence.map((letter, idx) => {
          const isBlank = idx === blankIndex;

          if (isBlank) {
            return (
              <Animated.View
                key={`blank-${idx}`}
                style={[
                  styles.blankSlot,
                  submitted && isCorrect && styles.blankSlotCorrect,
                  submitted && !isCorrect && styles.blankSlotIncorrect,
                  { transform: [{ scale: blankScale }] },
                ]}
              >
                {submitted ? (
                  <Text style={[
                    styles.blankText,
                    isCorrect ? styles.blankTextCorrect : styles.blankTextIncorrect,
                  ]}>
                    {isCorrect ? userInput.toUpperCase() : correctAnswer.toUpperCase()}
                  </Text>
                ) : (
                  <Text style={styles.blankPlaceholder}>?</Text>
                )}
              </Animated.View>
            );
          }

          return (
            <View key={`letter-${idx}`} style={styles.letterSlot}>
              <Text style={styles.letterText}>{letter}</Text>
            </View>
          );
        })}
      </Animated.View>

      {!submitted && (
        <View style={styles.inputSection}>
          <TextInput
            style={styles.textInput}
            value={userInput}
            onChangeText={(text) => setUserInput(text.slice(0, 3))}
            placeholder="?"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={3}
            textAlign="center"
            testID="alphabet-sequence-input"
          />
        </View>
      )}

      {submitted && (
        <Animated.View style={[styles.resultBanner, { opacity: resultFade }]}>
          <View style={styles.resultRow}>
            {isCorrect ? (
              <Check size={20} color="#059669" />
            ) : (
              <X size={20} color="#DC2626" />
            )}
            <Text style={[styles.resultText, { color: isCorrect ? '#059669' : '#DC2626' }]}>
              {isCorrect ? 'Correct!' : `The missing letter is "${correctAnswer}"`}
            </Text>
          </View>
        </Animated.View>
      )}

      {!submitted && (
        <Pressable
          style={[styles.checkBtn, userInput.trim().length === 0 && styles.checkBtnDisabled]}
          onPress={handleCheck}
          disabled={userInput.trim().length === 0}
          testID="alphabet-sequence-check-btn"
        >
          <Text style={styles.checkBtnText}>Check</Text>
        </Pressable>
      )}
    </View>
  );
}

const AlphabetSequenceExercise = React.memo(AlphabetSequenceExerciseInner);
export default AlphabetSequenceExercise;

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 4,
    paddingTop: 8,
  },
  instructionText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 24,
    textAlign: 'center' as const,
  },
  sequenceRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 32,
    flexWrap: 'wrap',
    paddingHorizontal: 8,
  },
  letterSlot: {
    width: 48,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#E2E8F0',
  },
  letterText: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.text,
    textAlign: 'center' as const,
  },
  blankSlot: {
    width: 48,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FDBA74',
    borderStyle: 'dashed',
  },
  blankSlotCorrect: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
    borderStyle: 'solid',
  },
  blankSlotIncorrect: {
    backgroundColor: '#FEF2F2',
    borderColor: '#EF4444',
    borderStyle: 'solid',
  },
  blankPlaceholder: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#FDBA74',
  },
  blankText: {
    fontSize: 24,
    fontWeight: '700' as const,
  },
  blankTextCorrect: {
    color: '#059669',
  },
  blankTextIncorrect: {
    color: '#DC2626',
  },
  inputSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  textInput: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    paddingHorizontal: 24,
    paddingVertical: 14,
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.text,
    width: 100,
    textAlign: 'center' as const,
  },
  resultBanner: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  resultText: {
    fontSize: 16,
    fontWeight: '700' as const,
  },
  checkBtn: {
    backgroundColor: '#F97316',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  checkBtnDisabled: {
    backgroundColor: '#CBD5E1',
    shadowOpacity: 0,
    elevation: 0,
  },
  checkBtnText: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: '#fff',
  },
});
