import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
} from 'react-native';
import { Volume2, Check, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { USE_NATIVE_DRIVER } from '@/constants/animation';
import { audioService } from '@/utils/audioService';

interface SoundToLetterExerciseProps {
  audioText: string;
  choices: string[];
  correctAnswer: string;
  onAnswer: (correct: boolean) => void;
  muted?: boolean;
}

function SoundToLetterExerciseInner({
  audioText,
  choices,
  correctAnswer,
  onAnswer,
  muted = false,
}: SoundToLetterExerciseProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);

  const speakerPulse = useRef(new Animated.Value(1)).current;
  const resultFade = useRef(new Animated.Value(0)).current;
  const cardScales = useRef(choices.map(() => new Animated.Value(1))).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    return () => {
      pulseLoop.current?.stop();
    };
  }, []);

  const startPulse = useCallback(() => {
    pulseLoop.current?.stop();
    pulseLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(speakerPulse, { toValue: 1.1, duration: 500, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(speakerPulse, { toValue: 1, duration: 500, useNativeDriver: USE_NATIVE_DRIVER }),
      ])
    );
    pulseLoop.current.start();
  }, [speakerPulse]);

  const stopPulse = useCallback(() => {
    pulseLoop.current?.stop();
    speakerPulse.setValue(1);
  }, [speakerPulse]);

  const playAudio = useCallback(async () => {
    if (muted || isPlaying) return;
    setIsPlaying(true);
    startPulse();
    try {
      await audioService.playFrenchAudio(audioText, 0.75);
      setHasPlayed(true);
      console.log('[SoundToLetter] Audio played for:', audioText);
    } catch (err) {
      console.error('[SoundToLetter] Audio error:', err);
    } finally {
      setIsPlaying(false);
      stopPulse();
    }
  }, [audioText, muted, isPlaying, startPulse, stopPulse]);

  useEffect(() => {
    if (!muted && !submitted) {
      const timer = setTimeout(() => {
        void playAudio();
      }, 400);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    } else {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }

    setTimeout(() => {
      onAnswer(correct);
    }, correct ? 800 : 1500);
  }, [selected, submitted, correctAnswer, onAnswer, resultFade]);

  return (
    <View style={styles.container}>
      <View style={styles.audioSection}>
        <Text style={styles.instructionText}>Listen and pick the letter</Text>
        <Animated.View style={{ transform: [{ scale: speakerPulse }] }}>
          <Pressable
            style={[styles.playBtn, isPlaying && styles.playBtnActive]}
            onPress={playAudio}
            disabled={isPlaying || submitted}
            testID="sound-to-letter-play-btn"
          >
            <Volume2 size={36} color={isPlaying ? '#fff' : '#2563EB'} />
          </Pressable>
        </Animated.View>
        {!hasPlayed && !muted && (
          <Text style={styles.tapHint}>Tap to listen</Text>
        )}
      </View>

      <View style={styles.grid}>
        {choices.map((choice, idx) => {
          const isSelected = selected === choice;
          const isCorrectChoice = choice.toLowerCase().trim() === correctAnswer.toLowerCase().trim();
          const showCorrect = submitted && isCorrectChoice;
          const showIncorrect = submitted && isSelected && !isCorrectChoice;

          return (
            <Animated.View
              key={`${choice}-${idx}`}
              style={[
                styles.cardWrap,
                { transform: [{ scale: cardScales[idx] }] },
              ]}
            >
              <Pressable
                style={[
                  styles.card,
                  isSelected && !submitted && styles.cardSelected,
                  showCorrect && styles.cardCorrect,
                  showIncorrect && styles.cardIncorrect,
                ]}
                onPress={() => handleSelect(choice, idx)}
                disabled={submitted}
                testID={`sound-to-letter-choice-${idx}`}
              >
                <Text style={[
                  styles.cardLetter,
                  isSelected && !submitted && styles.cardLetterSelected,
                  showCorrect && styles.cardLetterCorrect,
                  showIncorrect && styles.cardLetterIncorrect,
                ]}>
                  {choice}
                </Text>
                {showCorrect && <Check size={18} color="#059669" style={styles.cardIcon} />}
                {showIncorrect && <X size={18} color="#DC2626" style={styles.cardIcon} />}
              </Pressable>
            </Animated.View>
          );
        })}
      </View>

      {submitted && (
        <Animated.View style={[styles.resultBanner, { opacity: resultFade }]}>
          <Text style={[styles.resultText, { color: isCorrect ? '#059669' : '#DC2626' }]}>
            {isCorrect ? 'Correct!' : `The answer is "${correctAnswer}"`}
          </Text>
        </Animated.View>
      )}

      {!submitted && (
        <Pressable
          style={[styles.checkBtn, (!selected || !hasPlayed) && styles.checkBtnDisabled]}
          onPress={handleCheck}
          disabled={!selected || !hasPlayed}
          testID="sound-to-letter-check-btn"
        >
          <Text style={styles.checkBtnText}>Check</Text>
        </Pressable>
      )}
    </View>
  );
}

const SoundToLetterExercise = React.memo(SoundToLetterExerciseInner);
export default SoundToLetterExercise;

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 4,
    paddingTop: 8,
  },
  audioSection: {
    alignItems: 'center',
    marginBottom: 28,
  },
  instructionText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 18,
    textAlign: 'center' as const,
  },
  playBtn: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#BFDBFE',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  playBtnActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  tapHint: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 10,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
    marginBottom: 24,
  },
  cardWrap: {
    width: '45%',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    minHeight: 80,
  },
  cardSelected: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  cardCorrect: {
    borderColor: '#10B981',
    backgroundColor: '#ECFDF5',
  },
  cardIncorrect: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  cardLetter: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: Colors.text,
    textAlign: 'center' as const,
  },
  cardLetterSelected: {
    color: '#2563EB',
  },
  cardLetterCorrect: {
    color: '#059669',
  },
  cardLetterIncorrect: {
    color: '#DC2626',
  },
  cardIcon: {
    position: 'absolute',
    top: 8,
    right: 8,
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
    backgroundColor: '#2563EB',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563EB',
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
