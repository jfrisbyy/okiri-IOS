import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { Mic, MicOff, Volume2, RotateCcw, CheckCircle, XCircle, AlertCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { USE_NATIVE_DRIVER } from '@/constants/animation';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { usePronunciationCheck } from '@/hooks/usePronunciationCheck';
import { useAzurePronunciation } from '@/hooks/useAzurePronunciation';
import { audioService } from '@/utils/audioService';
import PronunciationFeedback from '@/components/PronunciationFeedback';
import type { PronunciationResult } from '@/utils/azurePronunciation';

interface SpeakToAnswerProps {
  englishPrompt: string;
  expectedFrench: string;
  hint?: string;
  onAnswer: (correct: boolean) => void;
  muted?: boolean;
}

interface WordResult {
  word: string;
  status: 'correct' | 'wrong' | 'missing';
}

function normalizeForCompare(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['']/g, "'")
    .replace(/[""«»]/g, '"')
    .replace(/[.,!?;:…\-()]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function compareWords(transcript: string, expected: string): { words: WordResult[]; accuracy: number } {
  const normTranscript = normalizeForCompare(transcript);
  const normExpected = normalizeForCompare(expected);

  if (normTranscript === normExpected) {
    return {
      words: expected.split(/\s+/).map(w => ({ word: w, status: 'correct' as const })),
      accuracy: 100,
    };
  }

  const expectedWords = expected.split(/\s+/).filter(w => w.length > 0);
  const transcriptWords = normTranscript.split(/\s+/).filter(w => w.length > 0);
  const results: WordResult[] = [];
  let matchCount = 0;

  for (const ew of expectedWords) {
    const normEw = normalizeForCompare(ew);
    const found = transcriptWords.some(tw => {
      if (tw === normEw) return true;
      if (normEw.length <= 2) return tw === normEw;
      const dist = levenshtein(tw, normEw);
      return dist <= Math.ceil(normEw.length * 0.3);
    });

    if (found) {
      results.push({ word: ew, status: 'correct' });
      matchCount++;
    } else {
      results.push({ word: ew, status: 'missing' });
    }
  }

  for (const tw of transcriptWords) {
    const matchesAny = expectedWords.some(ew => {
      const normEw = normalizeForCompare(ew);
      if (tw === normEw) return true;
      const dist = levenshtein(tw, normEw);
      return dist <= Math.ceil(normEw.length * 0.3);
    });
    if (!matchesAny) {
      results.push({ word: tw, status: 'wrong' });
    }
  }

  const accuracy = expectedWords.length > 0
    ? Math.round((matchCount / expectedWords.length) * 100)
    : 0;

  return { words: results, accuracy };
}

function levenshtein(a: string, b: string): number {
  const m: number[][] = [];
  for (let i = 0; i <= b.length; i++) m[i] = [i];
  for (let j = 0; j <= a.length; j++) m[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      m[i][j] = b[i - 1] === a[j - 1]
        ? m[i - 1][j - 1]
        : Math.min(m[i - 1][j - 1] + 1, m[i][j - 1] + 1, m[i - 1][j] + 1);
    }
  }
  return m[b.length][a.length];
}

export default function SpeakToAnswer({
  englishPrompt,
  expectedFrench,
  hint,
  onAnswer,
  muted,
}: SpeakToAnswerProps) {
  const [stage, setStage] = useState<'prompt' | 'recording' | 'processing' | 'result'>('prompt');
  const [wordResults, setWordResults] = useState<WordResult[]>([]);
  const [accuracy, setAccuracy] = useState(0);
  const [_transcriptText, setTranscriptText] = useState('');
  const [pronunciationScore, setPronunciationScore] = useState<string | null>(null);
  const [azureResult, setAzureResult] = useState<PronunciationResult | null>(null);
  const [recordingTimer, setRecordingTimer] = useState(0);
  const [showHint, setShowHint] = useState(false);

  const {
    isListening,
    transcript,
    interimTranscript,
    startListening,
    stopListening,
    resetTranscript,
    isSupported,
    error: sttError,
  } = useSpeechRecognition();

  const {
    checkPronunciation,
    getScoreColor,
    getScoreLabel,
  } = usePronunciationCheck();

  const {
    result: azurePronResult,
    startRecording: azureStartRecording,
    stopAndAssess: azureStopAndAssess,
    reset: resetAzure,
  } = useAzurePronunciation();

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const ringAnim = useRef(new Animated.Value(0)).current;
  const resultFade = useRef(new Animated.Value(0)).current;
  const resultSlide = useRef(new Animated.Value(30)).current;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasProcessedRef = useRef(false);
  const azureStartedRef = useRef(false);

  useEffect(() => {
    if (azurePronResult && stage === 'result') {
      setAzureResult(azurePronResult);
      console.log('[SpeakToAnswer] Azure result received:', azurePronResult.pronunciationScore);
    }
  }, [azurePronResult, stage]);

  useEffect(() => {
    if (stage === 'recording') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 600, useNativeDriver: USE_NATIVE_DRIVER }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: USE_NATIVE_DRIVER }),
        ])
      );
      const ring = Animated.loop(
        Animated.sequence([
          Animated.timing(ringAnim, { toValue: 1, duration: 1200, useNativeDriver: USE_NATIVE_DRIVER }),
          Animated.timing(ringAnim, { toValue: 0, duration: 0, useNativeDriver: USE_NATIVE_DRIVER }),
        ])
      );
      pulse.start();
      ring.start();
      return () => { pulse.stop(); ring.stop(); };
    } else {
      pulseAnim.setValue(1);
      ringAnim.setValue(0);
    }
  }, [stage, pulseAnim, ringAnim]);

  const processResult = useCallback(async (finalTranscript: string) => {
    if (hasProcessedRef.current) return;
    hasProcessedRef.current = true;

    console.log('[SpeakToAnswer] Processing transcript:', finalTranscript);
    setStage('processing');
    setTranscriptText(finalTranscript);

    const { words, accuracy: acc } = compareWords(finalTranscript, expectedFrench);
    setWordResults(words);
    setAccuracy(acc);

    try {
      const pronResult = await checkPronunciation(expectedFrench);
      if (pronResult) {
        setPronunciationScore(pronResult.score);
        console.log('[SpeakToAnswer] Pronunciation score:', pronResult.score, pronResult.matchPercentage);
      }
    } catch (e) {
      console.log('[SpeakToAnswer] Pronunciation check skipped:', e);
    }

    if (azureStartedRef.current) {
      try {
        console.log('[SpeakToAnswer] Stopping Azure assessment...');
        const result = await azureStopAndAssess(expectedFrench);
        if (result) {
          setAzureResult(result);
          console.log('[SpeakToAnswer] Azure pronunciation score:', result.pronunciationScore);
        }
      } catch (e) {
        console.log('[SpeakToAnswer] Azure assessment skipped:', e);
      }
      azureStartedRef.current = false;
    }

    setStage('result');
    resultFade.setValue(0);
    resultSlide.setValue(30);
    Animated.parallel([
      Animated.timing(resultFade, { toValue: 1, duration: 300, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.spring(resultSlide, { toValue: 0, friction: 8, tension: 60, useNativeDriver: USE_NATIVE_DRIVER }),
    ]).start();

    void Haptics.impactAsync(acc >= 70
      ? Haptics.ImpactFeedbackStyle.Medium
      : Haptics.ImpactFeedbackStyle.Heavy
    );
  }, [expectedFrench, checkPronunciation, resultFade, resultSlide, azureStopAndAssess]);

  const cleanupTimers = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (autoStopRef.current) { clearTimeout(autoStopRef.current); autoStopRef.current = null; }
  }, []);

  useEffect(() => {
    if (!isListening && transcript && stage === 'recording') {
      const finalText = transcript.trim();
      if (finalText) {
        cleanupTimers();
        void processResult(finalText);
      }
    }
  }, [isListening, transcript, stage, processResult, cleanupTimers]);

  const handleStartRecording = useCallback(async () => {
    if (!isSupported) {
      console.log('[SpeakToAnswer] Speech recognition not supported');
      return;
    }

    hasProcessedRef.current = false;
    resetTranscript();
    setTranscriptText('');
    setWordResults([]);
    setAccuracy(0);
    setPronunciationScore(null);
    setAzureResult(null);
    setRecordingTimer(0);
    setStage('recording');

    startListening();

    try {
      await azureStartRecording();
      azureStartedRef.current = true;
      console.log('[SpeakToAnswer] Azure recording started alongside speech recognition');
    } catch (e) {
      console.log('[SpeakToAnswer] Azure recording start skipped:', e);
      azureStartedRef.current = false;
    }

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    timerRef.current = setInterval(() => {
      setRecordingTimer(prev => prev + 1);
    }, 1000);

    autoStopRef.current = setTimeout(() => {
      console.log('[SpeakToAnswer] Auto-stopping after 10s');
      stopListening();
      cleanupTimers();
    }, 10000);
  }, [isSupported, resetTranscript, startListening, stopListening, cleanupTimers, azureStartRecording]);

  const handleStopRecording = useCallback(() => {
    stopListening();
    cleanupTimers();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    setTimeout(() => {
      if (!hasProcessedRef.current) {
        const finalText = (transcript || interimTranscript || '').trim();
        if (finalText) {
          void processResult(finalText);
        } else {
          setStage('prompt');
          hasProcessedRef.current = false;
          if (azureStartedRef.current) {
            resetAzure();
            azureStartedRef.current = false;
          }
        }
      }
    }, 1500);
  }, [stopListening, cleanupTimers, transcript, interimTranscript, processResult, resetAzure]);

  const handleRetry = useCallback(() => {
    hasProcessedRef.current = false;
    azureStartedRef.current = false;
    resetTranscript();
    setStage('prompt');
    setTranscriptText('');
    setWordResults([]);
    setAccuracy(0);
    setPronunciationScore(null);
    setAzureResult(null);
    setRecordingTimer(0);
    resetAzure();
  }, [resetTranscript, resetAzure]);

  const handleSubmit = useCallback(() => {
    const isCorrect = accuracy >= 70;
    onAnswer(isCorrect);
  }, [accuracy, onAnswer]);

  const handleListenExpected = useCallback(() => {
    if (!muted) {
      void audioService.playFrenchAudio(expectedFrench);
    }
  }, [muted, expectedFrench]);

  const ringScale = ringAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.8],
  });
  const ringOpacity = ringAnim.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: [0.4, 0.2, 0],
  });

  const isCorrect = accuracy >= 70;
  const isPartial = accuracy >= 40 && accuracy < 70;

  if (!isSupported) {
    return (
      <View style={styles.container}>
        <View style={styles.unsupportedCard}>
          <MicOff size={32} color={Colors.textMuted} />
          <Text style={styles.unsupportedText}>
            Speech recognition is not available on this device.
          </Text>
          <Text style={styles.unsupportedHint}>
            Try using Chrome on desktop, or run the app on a mobile device.
          </Text>
          <Pressable style={styles.skipBtn} onPress={() => onAnswer(false)}>
            <Text style={styles.skipBtnText}>Skip Exercise</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.promptSection}>
        <Text style={styles.promptLabel}>Say this in French:</Text>
        <Text style={styles.promptText}>"{englishPrompt}"</Text>
        {hint && showHint && (
          <Text style={styles.hintText}>{hint}</Text>
        )}
        {hint && !showHint && stage === 'prompt' && (
          <Pressable onPress={() => setShowHint(true)}>
            <Text style={styles.showHintBtn}>Show hint</Text>
          </Pressable>
        )}
      </View>

      {stage === 'prompt' && (
        <View style={styles.micSection}>
          <Text style={styles.micInstruction}>Tap the microphone and speak</Text>
          <Pressable onPress={handleStartRecording} testID="speak-start-btn">
            <View style={styles.micButtonOuter}>
              <View style={styles.micButton}>
                <Mic size={36} color="#fff" />
              </View>
            </View>
          </Pressable>
          <Pressable style={styles.listenBtn} onPress={handleListenExpected}>
            <Volume2 size={16} color={Colors.primary} />
            <Text style={styles.listenBtnText}>Hear the answer</Text>
          </Pressable>
        </View>
      )}

      {stage === 'recording' && (
        <View style={styles.micSection}>
          <View style={styles.timerRow}>
            <View style={styles.recordingDot} />
            <Text style={styles.timerText}>
              {recordingTimer}s / 10s
            </Text>
          </View>

          <View style={styles.micAnimContainer}>
            <Animated.View
              style={[
                styles.micRing,
                {
                  transform: [{ scale: ringScale }],
                  opacity: ringOpacity,
                },
              ]}
            />
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <Pressable onPress={handleStopRecording} testID="speak-stop-btn">
                <View style={[styles.micButton, styles.micButtonRecording]}>
                  <Mic size={36} color="#fff" />
                </View>
              </Pressable>
            </Animated.View>
          </View>

          {(interimTranscript || transcript) ? (
            <Text style={styles.interimText} numberOfLines={2}>
              {interimTranscript || transcript}
            </Text>
          ) : (
            <Text style={styles.listeningText}>Listening...</Text>
          )}

          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${(recordingTimer / 10) * 100}%` }]} />
          </View>
        </View>
      )}

      {stage === 'processing' && (
        <View style={styles.micSection}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.processingText}>Analyzing your speech...</Text>
        </View>
      )}

      {stage === 'result' && (
        <Animated.View
          style={[
            styles.resultSection,
            {
              opacity: resultFade,
              transform: [{ translateY: resultSlide }],
            },
          ]}
        >
          <View style={[
            styles.scoreBadge,
            isCorrect ? styles.scoreBadgeCorrect : isPartial ? styles.scoreBadgePartial : styles.scoreBadgeWrong,
          ]}>
            {isCorrect ? (
              <CheckCircle size={20} color="#fff" />
            ) : isPartial ? (
              <AlertCircle size={20} color="#fff" />
            ) : (
              <XCircle size={20} color="#fff" />
            )}
            <Text style={styles.scoreText}>
              {accuracy}% {isCorrect ? 'Correct!' : isPartial ? 'Almost!' : 'Try harder'}
            </Text>
          </View>

          {azureResult ? (
            <View style={styles.azureFeedbackWrap}>
              <PronunciationFeedback
                result={azureResult}
                targetText={expectedFrench}
                onTryAgain={handleRetry}
                muted={muted}
                compact={true}
              />
            </View>
          ) : pronunciationScore ? (
            <View style={[styles.pronBadge, { backgroundColor: getScoreColor(pronunciationScore as any) + '20' }]}>
              <Text style={[styles.pronText, { color: getScoreColor(pronunciationScore as any) }]}>
                Pronunciation: {getScoreLabel(pronunciationScore as any)}
              </Text>
            </View>
          ) : null}

          <View style={styles.wordResultsWrap}>
            <Text style={styles.wordResultsLabel}>Your answer:</Text>
            <View style={styles.wordResultsRow}>
              {wordResults.map((wr, i) => (
                <View
                  key={`${wr.word}-${i}`}
                  style={[
                    styles.wordChip,
                    wr.status === 'correct' && styles.wordChipCorrect,
                    wr.status === 'wrong' && styles.wordChipWrong,
                    wr.status === 'missing' && styles.wordChipMissing,
                  ]}
                >
                  <Text style={[
                    styles.wordChipText,
                    wr.status === 'correct' && styles.wordChipTextCorrect,
                    wr.status === 'wrong' && styles.wordChipTextWrong,
                    wr.status === 'missing' && styles.wordChipTextMissing,
                  ]}>
                    {wr.word}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.expectedWrap}>
            <Text style={styles.expectedLabel}>Expected:</Text>
            <View style={styles.expectedRow}>
              <Text style={styles.expectedText}>{expectedFrench}</Text>
              <Pressable onPress={handleListenExpected} style={styles.expectedAudioBtn}>
                <Volume2 size={16} color={Colors.primary} />
              </Pressable>
            </View>
          </View>

          {sttError && (
            <Text style={styles.errorText}>{sttError}</Text>
          )}

          <View style={styles.resultActions}>
            {!azureResult && (
              <Pressable style={styles.retryBtn} onPress={handleRetry} testID="speak-retry-btn">
                <RotateCcw size={18} color={Colors.primary} />
                <Text style={styles.retryBtnText}>Try Again</Text>
              </Pressable>
            )}
            <Pressable
              style={[styles.continueBtn, isCorrect && styles.continueBtnCorrect, azureResult && styles.continueBtnFull]}
              onPress={handleSubmit}
              testID="speak-continue-btn"
            >
              <Text style={[styles.continueBtnText, isCorrect && styles.continueBtnTextCorrect]}>
                Continue
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  promptSection: {
    marginBottom: 24,
  },
  promptLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  promptText: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.text,
    lineHeight: 30,
  },
  hintText: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 8,
    fontStyle: 'italic' as const,
  },
  showHintBtn: {
    fontSize: 13,
    color: Colors.primary,
    marginTop: 8,
    fontWeight: '500' as const,
  },
  micSection: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingBottom: 40,
  },
  micInstruction: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginBottom: 32,
  },
  micButtonOuter: {
    padding: 8,
    borderRadius: 50,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  micButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EF4444',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  micButtonRecording: {
    backgroundColor: '#DC2626',
  },
  micAnimContainer: {
    width: 160,
    height: 160,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  micRing: {
    position: 'absolute' as const,
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: '#EF4444',
  },
  listenBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    marginTop: 24,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: Colors.primary + '10',
  },
  listenBtnText: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '500' as const,
  },
  timerRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginBottom: 16,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
  },
  timerText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  interimText: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    marginTop: 16,
    fontStyle: 'italic' as const,
    paddingHorizontal: 20,
  },
  listeningText: {
    fontSize: 15,
    color: Colors.textMuted,
    marginTop: 16,
  },
  progressBarBg: {
    width: '80%',
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    marginTop: 20,
    overflow: 'hidden' as const,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#EF4444',
    borderRadius: 2,
  },
  processingText: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginTop: 16,
  },
  resultSection: {
    flex: 1,
    paddingBottom: 20,
  },
  scoreBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    alignSelf: 'center' as const,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 24,
    marginBottom: 16,
  },
  scoreBadgeCorrect: {
    backgroundColor: '#22C55E',
  },
  scoreBadgePartial: {
    backgroundColor: '#F59E0B',
  },
  scoreBadgeWrong: {
    backgroundColor: '#EF4444',
  },
  scoreText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
  },
  pronBadge: {
    alignSelf: 'center' as const,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    marginBottom: 16,
  },
  pronText: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  azureFeedbackWrap: {
    marginBottom: 16,
  },
  wordResultsWrap: {
    marginBottom: 16,
  },
  wordResultsLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  wordResultsRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 6,
  },
  wordChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundCard,
  },
  wordChipCorrect: {
    borderColor: '#22C55E',
    backgroundColor: '#22C55E10',
  },
  wordChipWrong: {
    borderColor: '#EF4444',
    backgroundColor: '#EF444410',
  },
  wordChipMissing: {
    borderColor: '#F59E0B',
    backgroundColor: '#F59E0B10',
    borderStyle: 'dashed' as const,
  },
  wordChipText: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  wordChipTextCorrect: {
    color: '#16A34A',
  },
  wordChipTextWrong: {
    color: '#EF4444',
    textDecorationLine: 'line-through' as const,
  },
  wordChipTextMissing: {
    color: '#D97706',
  },
  expectedWrap: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  expectedLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textMuted,
    marginBottom: 6,
  },
  expectedRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  expectedText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    flex: 1,
  },
  expectedAudioBtn: {
    padding: 6,
  },
  errorText: {
    fontSize: 13,
    color: '#EF4444',
    textAlign: 'center' as const,
    marginBottom: 12,
  },
  resultActions: {
    flexDirection: 'row' as const,
    gap: 12,
    marginTop: 8,
  },
  retryBtn: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    backgroundColor: Colors.background,
  },
  retryBtnText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  continueBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.textMuted,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  continueBtnCorrect: {
    backgroundColor: Colors.primary,
  },
  continueBtnFull: {
    flex: 2,
  },
  continueBtnText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#fff',
  },
  continueBtnTextCorrect: {
    color: '#fff',
  },
  unsupportedCard: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    padding: 32,
    gap: 12,
  },
  unsupportedText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    textAlign: 'center' as const,
  },
  unsupportedHint: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center' as const,
  },
  skipBtn: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
  },
  skipBtnText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#fff',
  },
});
