import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Animated,
  Pressable,
} from 'react-native';
import { Volume2, Snail, Headphones } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { USE_NATIVE_DRIVER } from '@/constants/animation';
import { audioService } from '@/utils/audioService';

interface ListenAndTypeProps {
  listenText: string;
  correctAnswer: string;
  hint?: string;
  onAnswer: (correct: boolean) => void;
  muted?: boolean;
}

interface CharDiff {
  char: string;
  status: 'correct' | 'wrong' | 'missing' | 'extra';
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

function fuzzyDictationMatch(input: string, correct: string): { isCorrect: boolean; score: number } {
  const normInput = normalize(input);
  const normCorrect = normalize(correct);

  if (normInput === normCorrect) return { isCorrect: true, score: 1 };

  if (stripAccents(normInput) === stripAccents(normCorrect)) {
    return { isCorrect: true, score: 0.95 };
  }

  const inputWords = normInput.split(' ').filter(w => w.length > 0);
  const correctWords = normCorrect.split(' ').filter(w => w.length > 0);

  let matchCount = 0;
  const used = new Set<number>();

  for (const iw of inputWords) {
    const strippedIw = stripAccents(iw);
    for (let j = 0; j < correctWords.length; j++) {
      if (used.has(j)) continue;
      const cw = correctWords[j];
      if (iw === cw || strippedIw === stripAccents(cw)) {
        matchCount++;
        used.add(j);
        break;
      }
    }
  }

  const score = correctWords.length > 0 ? matchCount / correctWords.length : 0;
  const isCorrect = score >= 0.75 && inputWords.length >= correctWords.length * 0.6;

  return { isCorrect, score };
}

function computeCharDiff(input: string, correct: string): CharDiff[] {
  const result: CharDiff[] = [];
  const normInput = normalize(input);
  const normCorrect = normalize(correct);

  const maxLen = Math.max(normInput.length, normCorrect.length);

  for (let i = 0; i < maxLen; i++) {
    const ic = normInput[i];
    const cc = normCorrect[i];

    if (i >= normInput.length) {
      result.push({ char: cc, status: 'missing' });
    } else if (i >= normCorrect.length) {
      result.push({ char: ic, status: 'extra' });
    } else if (ic === cc) {
      result.push({ char: ic, status: 'correct' });
    } else if (stripAccents(ic) === stripAccents(cc)) {
      result.push({ char: cc, status: 'correct' });
    } else {
      result.push({ char: cc, status: 'wrong' });
    }
  }

  return result;
}

function ListenAndTypeInner({
  listenText,
  correctAnswer,
  hint,
  onAnswer,
  muted = false,
}: ListenAndTypeProps) {
  const [userInput, setUserInput] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [score, setScore] = useState(0);
  const [hasPlayed, setHasPlayed] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playCount, setPlayCount] = useState(0);
  const [charDiff, setCharDiff] = useState<CharDiff[]>([]);

  const resultFade = useRef(new Animated.Value(0)).current;
  const speakerPulse = useRef(new Animated.Value(1)).current;
  const inputShake = useRef(new Animated.Value(0)).current;
  const diffFade = useRef(new Animated.Value(0)).current;
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
        Animated.timing(speakerPulse, { toValue: 1.12, duration: 600, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(speakerPulse, { toValue: 1, duration: 600, useNativeDriver: USE_NATIVE_DRIVER }),
      ])
    );
    pulseLoop.current.start();
  }, [speakerPulse]);

  const stopPulse = useCallback(() => {
    pulseLoop.current?.stop();
    speakerPulse.setValue(1);
  }, [speakerPulse]);

  const playAudio = useCallback(async (speed: 0.5 | 0.75 | 1.0 = 1.0) => {
    if (muted || isPlaying) return;
    setIsPlaying(true);
    startPulse();
    try {
      await audioService.playFrenchAudio(listenText, speed);
      setHasPlayed(true);
      setPlayCount(prev => prev + 1);
      console.log('[ListenAndType] Audio played at speed:', speed);
    } catch (err) {
      console.error('[ListenAndType] Audio error:', err);
    } finally {
      setIsPlaying(false);
      stopPulse();
    }
  }, [listenText, muted, isPlaying, startPulse, stopPulse]);

  useEffect(() => {
    if (!muted && !submitted) {
      const timer = setTimeout(() => {
        void playAudio(1.0);
      }, 400);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCheck = useCallback(() => {
    if (userInput.trim().length === 0 || submitted) return;

    const { isCorrect: correct, score: matchScore } = fuzzyDictationMatch(userInput, correctAnswer);
    setIsCorrect(correct);
    setScore(matchScore);
    setSubmitted(true);

    const diff = computeCharDiff(userInput, correctAnswer);
    setCharDiff(diff);

    Animated.parallel([
      Animated.timing(resultFade, { toValue: 1, duration: 300, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.timing(diffFade, { toValue: 1, duration: 400, useNativeDriver: USE_NATIVE_DRIVER }),
    ]).start();

    if (correct) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Animated.sequence([
        Animated.timing(inputShake, { toValue: 10, duration: 50, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(inputShake, { toValue: -10, duration: 50, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(inputShake, { toValue: 6, duration: 50, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(inputShake, { toValue: -6, duration: 50, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(inputShake, { toValue: 0, duration: 50, useNativeDriver: USE_NATIVE_DRIVER }),
      ]).start();
    }

    setTimeout(() => {
      onAnswer(correct);
    }, correct ? 800 : 1800);
  }, [userInput, correctAnswer, submitted, onAnswer, resultFade, diffFade, inputShake]);

  const scoreLabel = useMemo(() => {
    if (score >= 1) return 'Perfect!';
    if (score >= 0.9) return 'Almost perfect!';
    if (score >= 0.75) return 'Good enough!';
    if (score >= 0.5) return 'Halfway there';
    return 'Keep practicing';
  }, [score]);

  const scoreColor = useMemo(() => {
    if (score >= 0.9) return '#10B981';
    if (score >= 0.75) return '#F59E0B';
    return '#EF4444';
  }, [score]);

  return (
    <View style={styles.container}>
      <View style={styles.listenSection}>
        <View style={styles.headphonesIcon}>
          <Headphones size={24} color="#4338CA" />
        </View>
        <Text style={styles.listenLabel}>Listen carefully and type what you hear</Text>

        <View style={styles.audioControls}>
          <Animated.View style={{ transform: [{ scale: speakerPulse }] }}>
            <Pressable
              style={[styles.mainPlayBtn, isPlaying && styles.mainPlayBtnActive]}
              onPress={() => playAudio(1.0)}
              disabled={isPlaying || submitted}
              testID="listen-type-play-btn"
            >
              <Volume2 size={32} color={isPlaying ? '#fff' : '#4338CA'} />
              {isPlaying && (
                <View style={styles.waveBars}>
                  {[0, 1, 2].map(i => (
                    <View key={i} style={[styles.waveBar, { height: 8 + Math.random() * 12 }]} />
                  ))}
                </View>
              )}
            </Pressable>
          </Animated.View>

          <Pressable
            style={[styles.slowBtn, isPlaying && styles.slowBtnDisabled]}
            onPress={() => playAudio(0.5)}
            disabled={isPlaying || submitted}
            testID="listen-type-slow-btn"
          >
            <Snail size={18} color={isPlaying ? '#CBD5E1' : '#64748B'} />
            <Text style={[styles.slowBtnText, isPlaying && { color: '#CBD5E1' }]}>Slow</Text>
          </Pressable>
        </View>

        {playCount > 0 && !submitted && (
          <Text style={styles.playCountHint}>
            {playCount === 1 ? 'Played once' : `Played ${playCount} times`}
          </Text>
        )}
      </View>

      <Animated.View style={[styles.inputSection, { transform: [{ translateX: inputShake }] }]}>
        <TextInput
          style={[
            styles.textInput,
            submitted && isCorrect && styles.textInputCorrect,
            submitted && !isCorrect && styles.textInputIncorrect,
          ]}
          value={userInput}
          onChangeText={setUserInput}
          placeholder="Type what you heard..."
          placeholderTextColor={Colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!submitted}
          multiline
          textAlignVertical="top"
          testID="listen-type-input"
        />
      </Animated.View>

      {submitted && (
        <Animated.View style={[styles.resultSection, { opacity: resultFade }]}>
          <View style={[styles.scoreRow, { borderLeftColor: scoreColor }]}>
            <Text style={[styles.scoreLabel, { color: scoreColor }]}>{scoreLabel}</Text>
            <Text style={[styles.scorePercent, { color: scoreColor }]}>
              {Math.round(score * 100)}%
            </Text>
          </View>

          <Animated.View style={[styles.diffSection, { opacity: diffFade }]}>
            <Text style={styles.diffTitle}>Character comparison:</Text>
            <View style={styles.diffRow}>
              {charDiff.map((d, i) => (
                <Text
                  key={i}
                  style={[
                    styles.diffChar,
                    d.status === 'correct' && styles.diffCorrect,
                    d.status === 'wrong' && styles.diffWrong,
                    d.status === 'missing' && styles.diffMissing,
                    d.status === 'extra' && styles.diffExtra,
                  ]}
                >
                  {d.char === ' ' ? ' ' : d.char}
                </Text>
              ))}
            </View>

            {!isCorrect && (
              <View style={styles.correctAnswerBox}>
                <Text style={styles.correctAnswerLabel}>Correct answer:</Text>
                <Text style={styles.correctAnswerText}>{correctAnswer}</Text>
              </View>
            )}
          </Animated.View>
        </Animated.View>
      )}

      {!submitted && (
        <Pressable
          style={[
            styles.checkBtn,
            (!hasPlayed || userInput.trim().length === 0) && styles.checkBtnDisabled,
          ]}
          onPress={handleCheck}
          disabled={!hasPlayed || userInput.trim().length === 0}
          testID="listen-type-check-btn"
        >
          <Text style={styles.checkBtnText}>Check</Text>
        </Pressable>
      )}

      {hint && !submitted && (
        <Text style={styles.hintText}>{hint}</Text>
      )}
    </View>
  );
}

const ListenAndType = React.memo(ListenAndTypeInner);
export default ListenAndType;

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 4,
    paddingTop: 8,
  },
  listenSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  headphonesIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  listenLabel: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    textAlign: 'center' as const,
    marginBottom: 20,
  },
  audioControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  mainPlayBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#C7D2FE',
    shadowColor: '#4338CA',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  mainPlayBtnActive: {
    backgroundColor: '#4338CA',
    borderColor: '#4338CA',
  },
  waveBars: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: -6,
    gap: 3,
  },
  waveBar: {
    width: 3,
    backgroundColor: '#fff',
    borderRadius: 2,
  },
  slowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  slowBtnDisabled: {
    opacity: 0.5,
  },
  slowBtnText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#64748B',
  },
  playCountHint: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 10,
  },
  inputSection: {
    marginBottom: 16,
  },
  textInput: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 17,
    color: Colors.text,
    minHeight: 80,
    lineHeight: 24,
  },
  textInputCorrect: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
  },
  textInputIncorrect: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  resultSection: {
    marginBottom: 16,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderLeftWidth: 4,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  scoreLabel: {
    fontSize: 16,
    fontWeight: '700' as const,
  },
  scorePercent: {
    fontSize: 20,
    fontWeight: '800' as const,
  },
  diffSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  diffTitle: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  diffRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  diffChar: {
    fontSize: 20,
    fontWeight: '500' as const,
    letterSpacing: 0.5,
  },
  diffCorrect: {
    color: '#10B981',
  },
  diffWrong: {
    color: '#EF4444',
    textDecorationLine: 'underline',
    textDecorationColor: '#EF4444',
  },
  diffMissing: {
    color: '#F59E0B',
    backgroundColor: '#FFFBEB',
    borderRadius: 2,
  },
  diffExtra: {
    color: '#94A3B8',
    textDecorationLine: 'line-through',
    textDecorationColor: '#94A3B8',
  },
  correctAnswerBox: {
    backgroundColor: '#F0FDF4',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  correctAnswerLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#059669',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  correctAnswerText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#065F46',
    lineHeight: 22,
  },
  checkBtn: {
    backgroundColor: '#4338CA',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4338CA',
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
  hintText: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center' as const,
    marginTop: 12,
    fontStyle: 'italic' as const,
  },
});
