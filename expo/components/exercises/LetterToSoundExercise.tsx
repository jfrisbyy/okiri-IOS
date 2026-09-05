import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
} from 'react-native';
import { Check, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { USE_NATIVE_DRIVER } from '@/constants/animation';

interface LetterToSoundExerciseProps {
  content: string;
  choices: string[];
  correctAnswer: string;
  onAnswer: (correct: boolean) => void;
  muted?: boolean;
}

function LetterToSoundExerciseInner({
  content,
  choices,
  correctAnswer,
  onAnswer,
}: LetterToSoundExerciseProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  const resultFade = useRef(new Animated.Value(0)).current;
  const letterScale = useRef(new Animated.Value(1)).current;
  const cardScales = useRef(choices.map(() => new Animated.Value(1))).current;

  const handleSelect = useCallback((choice: string, index: number) => {
    if (submitted) return;

    setSelected(choice);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    Animated.sequence([
      Animated.timing(cardScales[index], { toValue: 0.93, duration: 60, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.spring(cardScales[index], { toValue: 1, friction: 4, tension: 200, useNativeDriver: USE_NATIVE_DRIVER }),
    ]).start();
  }, [submitted, cardScales]);

  const handleCheck = useCallback(() => {
    if (!selected || submitted) return;

    const correct = selected.toLowerCase().trim() === correctAnswer.toLowerCase().trim();
    setIsCorrect(correct);
    setSubmitted(true);

    Animated.timing(resultFade, { toValue: 1, duration: 300, useNativeDriver: USE_NATIVE_DRIVER }).start();

    if (correct) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Animated.sequence([
        Animated.timing(letterScale, { toValue: 1.15, duration: 150, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.spring(letterScale, { toValue: 1, friction: 4, tension: 100, useNativeDriver: USE_NATIVE_DRIVER }),
      ]).start();
    } else {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }

    setTimeout(() => {
      onAnswer(correct);
    }, correct ? 800 : 1500);
  }, [selected, submitted, correctAnswer, onAnswer, resultFade, letterScale]);

  return (
    <View style={styles.container}>
      <Text style={styles.instructionText}>How is this pronounced?</Text>

      <Animated.View style={[styles.letterDisplay, { transform: [{ scale: letterScale }] }]}>
        <Text style={styles.letterText}>{content}</Text>
      </Animated.View>

      <View style={styles.choicesList}>
        {choices.map((choice, idx) => {
          const isSelected = selected === choice;
          const isCorrectChoice = choice.toLowerCase().trim() === correctAnswer.toLowerCase().trim();
          const showCorrect = submitted && isCorrectChoice;
          const showIncorrect = submitted && isSelected && !isCorrectChoice;

          return (
            <Animated.View
              key={`${choice}-${idx}`}
              style={{ transform: [{ scale: cardScales[idx] }] }}
            >
              <Pressable
                style={[
                  styles.choiceCard,
                  isSelected && !submitted && styles.choiceCardSelected,
                  showCorrect && styles.choiceCardCorrect,
                  showIncorrect && styles.choiceCardIncorrect,
                ]}
                onPress={() => handleSelect(choice, idx)}
                disabled={submitted}
                testID={`letter-to-sound-choice-${idx}`}
              >
                <View style={[
                  styles.choiceIndex,
                  isSelected && !submitted && styles.choiceIndexSelected,
                  showCorrect && styles.choiceIndexCorrect,
                  showIncorrect && styles.choiceIndexIncorrect,
                ]}>
                  <Text style={[
                    styles.choiceIndexText,
                    (isSelected || showCorrect || showIncorrect) && { color: '#fff' },
                  ]}>
                    {String.fromCharCode(65 + idx)}
                  </Text>
                </View>
                <Text style={[
                  styles.choiceText,
                  showCorrect && { color: '#059669', fontWeight: '600' as const },
                  showIncorrect && { color: '#DC2626' },
                ]}>
                  {choice}
                </Text>
                {showCorrect && <Check size={18} color="#059669" />}
                {showIncorrect && <X size={18} color="#DC2626" />}
              </Pressable>
            </Animated.View>
          );
        })}
      </View>

      {submitted && (
        <Animated.View style={[styles.resultBanner, { opacity: resultFade }]}>
          <Text style={[styles.resultText, { color: isCorrect ? '#059669' : '#DC2626' }]}>
            {isCorrect ? 'Correct!' : `It's pronounced "${correctAnswer}"`}
          </Text>
        </Animated.View>
      )}

      {!submitted && (
        <Pressable
          style={[styles.checkBtn, !selected && styles.checkBtnDisabled]}
          onPress={handleCheck}
          disabled={!selected}
          testID="letter-to-sound-check-btn"
        >
          <Text style={styles.checkBtnText}>Check</Text>
        </Pressable>
      )}
    </View>
  );
}

const LetterToSoundExercise = React.memo(LetterToSoundExerciseInner);
export default LetterToSoundExercise;

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 4,
    paddingTop: 8,
  },
  instructionText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 20,
    textAlign: 'center' as const,
  },
  letterDisplay: {
    alignSelf: 'center',
    backgroundColor: '#FFF7ED',
    borderRadius: 24,
    paddingHorizontal: 40,
    paddingVertical: 28,
    marginBottom: 28,
    borderWidth: 3,
    borderColor: '#FDBA74',
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
    minWidth: 120,
    alignItems: 'center',
  },
  letterText: {
    fontSize: 48,
    fontWeight: '800' as const,
    color: '#EA580C',
    textAlign: 'center' as const,
  },
  choicesList: {
    gap: 10,
    marginBottom: 24,
  },
  choiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  choiceCardSelected: {
    borderColor: '#F97316',
    backgroundColor: '#FFF7ED',
  },
  choiceCardCorrect: {
    borderColor: '#10B981',
    backgroundColor: '#ECFDF5',
  },
  choiceCardIncorrect: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  choiceIndex: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceIndexSelected: {
    backgroundColor: '#F97316',
    borderColor: '#F97316',
  },
  choiceIndexCorrect: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  choiceIndexIncorrect: {
    backgroundColor: '#EF4444',
    borderColor: '#EF4444',
  },
  choiceIndexText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#9CA3AF',
  },
  choiceText: {
    fontSize: 17,
    color: Colors.text,
    flex: 1,
    letterSpacing: 0.3,
  },
  resultBanner: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
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
