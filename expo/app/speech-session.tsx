import { useState, useRef, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Pressable,
  TextInput,
  Modal,
  Animated,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { safeGoBack } from '@/utils/navigation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Mic, MicOff, Plus, Volume2, Check, AlertCircle, BookOpen, ChevronRight, MessageCircle, Sparkles, Trophy } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { USE_NATIVE_DRIVER } from '@/constants/animation';
import { useApp } from '@/contexts/AppContext';
import { generateText } from '@rork-ai/toolkit-sdk';
import { useFrenchAudio } from '@/hooks/useFrenchAudio';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useGrammarCheck, GrammarError } from '@/hooks/useGrammarCheck';
import { useFluencySuggestions, FluencySuggestion } from '@/hooks/useFluencySuggestions';
import { useAudioRecording } from '@/hooks/useAudioRecording';
import { SpeechGrammarError, SpeechFluencySuggestion } from '@/types';
import Kiri from '@/components/Kiri';
import { logEncounterBatch } from '@/utils/crossTabTracker';

interface CapturedGap {
  id: string;
  englishInput: string;
  frenchPhrase: string;
  translation: string;
}

export default function SpeechSessionScreen() {
  const { duration, prompt } = useLocalSearchParams<{ duration: string; prompt: string }>();
  const router = useRouter();
  const { addGap, addSpeechSession, addRecordingLog } = useApp();
  
  const durationSeconds = parseInt(duration || '5', 10) * 60;
  const [timeRemaining, setTimeRemaining] = useState(durationSeconds);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(true);
  const [showGapModal, setShowGapModal] = useState(false);
  const [gapInput, setGapInput] = useState('');
  const [isLoadingGap, setIsLoadingGap] = useState(false);
  const [capturedGaps, setCapturedGaps] = useState<CapturedGap[]>([]);
  const [generatedPhrase, setGeneratedPhrase] = useState<{ french: string; english: string } | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [showTranscript, setShowTranscript] = useState(true);
  const [grammarErrors, setGrammarErrors] = useState<SpeechGrammarError[]>([]);
  const [fluencySuggestions, setFluencySuggestions] = useState<SpeechFluencySuggestion[]>([]);
  const [isCheckingGrammar, setIsCheckingGrammar] = useState(false);
  const [isCheckingFluency, setIsCheckingFluency] = useState(false);
  const [selectedError, setSelectedError] = useState<SpeechGrammarError | null>(null);
  const [selectedSuggestion, setSelectedSuggestion] = useState<SpeechFluencySuggestion | null>(null);
  const [grammarCheckFailed, setGrammarCheckFailed] = useState(false);
  const [fluencyCheckFailed, setFluencyCheckFailed] = useState(false);
  const [timerElapsed, setTimerElapsed] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const sessionEndedRef = useRef(false);
  const celebrationShownRef = useRef(false);
  
  const [isExiting, setIsExiting] = useState(false);
  const [manualTranscript, setManualTranscript] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const celebrationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const celebrationScale = useRef(new Animated.Value(0)).current;
  const celebrationOpacity = useRef(new Animated.Value(0)).current;
  const insightsOpacity = useRef(new Animated.Value(0)).current;
  const insightsSlide = useRef(new Animated.Value(50)).current;
  const exitOpacity = useRef(new Animated.Value(1)).current;
  const exitScale = useRef(new Animated.Value(1)).current;
  const transcriptScrollRef = useRef<ScrollView>(null);
  const { speak, isSpeaking } = useFrenchAudio();
  
  // Cross-platform audio recording
  const { 
    startRecording: startAudioRecording, 
    stopRecording: stopAudioRecording, 
    pauseRecording: pauseAudioRecording,
    resumeRecording: resumeAudioRecording,
    isRecordingActive,
    cleanup: cleanupAudioRecording 
  } = useAudioRecording();
  
  const { 
    isListening, 
    transcript, 
    interimTranscript, 
    startListening, 
    stopListening, 
    resetTranscript,
    isSupported: speechSupported,
    error: speechError,
    getRecordedAudioSegments,
  } = useSpeechRecognition();
  
  const { checkText, isChecking: grammarChecking, error: grammarError } = useGrammarCheck();
  const { analyzeText: analyzeFluency, isAnalyzing: fluencyAnalyzing, error: fluencyError } = useFluencySuggestions();

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      stopListening();
      cleanupAudioRecording();
    };
  }, [stopListening, cleanupAudioRecording]);

  useEffect(() => {
    if (!isPaused && timeRemaining > 0 && !timerElapsed) {
      timerRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            setTimerElapsed(true);
            setIsRecording(false);
            setIsPaused(true);
            stopListening();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isPaused, timeRemaining, timerElapsed, stopListening]);

  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 800,
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording, pulseAnim]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSessionComplete = useCallback(async (actualMinutes: number) => {
    stopListening();
    setIsCheckingGrammar(true);
    setIsCheckingFluency(true);
    setGrammarCheckFailed(false);
    setFluencyCheckFailed(false);
    
    const combinedTranscript = (transcript + (manualTranscript ? ' ' + manualTranscript : '')).trim();
    const fullTranscript = combinedTranscript;
    let collectedGrammarErrors: SpeechGrammarError[] = [];
    let collectedFluencySuggestions: SpeechFluencySuggestion[] = [];
    
    try {
      await addSpeechSession(Math.max(1, actualMinutes));
      
      if (fullTranscript) {
        try {
          const errors = await checkText(fullTranscript);
          const mappedErrors: SpeechGrammarError[] = errors.map(err => ({
            id: err.id,
            incorrectText: err.incorrectText,
            correctedText: err.replacements[0] || err.incorrectText,
            ruleName: err.shortMessage || err.ruleCategory,
            ruleExplanation: err.message,
            sentence: err.sentence,
            category: err.ruleCategory,
            addedToDeck: false,
          }));
          setGrammarErrors(mappedErrors);
          collectedGrammarErrors = mappedErrors;
        } catch (e) {
          console.log('Grammar check failed:', e);
          setGrammarCheckFailed(true);
        }
        setIsCheckingGrammar(false);
        
        try {
          const aiResults = await analyzeFluency(fullTranscript);
          
          const aiGrammarErrors: SpeechGrammarError[] = aiResults
            .filter(s => s.isGrammarError)
            .map(s => ({
              id: s.id,
              incorrectText: s.originalPhrase,
              correctedText: s.suggestedPhrase,
              ruleName: 'Grammar',
              ruleExplanation: s.explanation,
              sentence: s.fullSentence || s.originalPhrase,
              exampleWhereOriginalWorks: s.exampleWhereOriginalWorks || '',
              category: 'GRAMMAR',
              addedToDeck: false,
            }));
          
          if (aiGrammarErrors.length > 0) {
            setGrammarErrors(prev => [...prev, ...aiGrammarErrors]);
            collectedGrammarErrors = [...collectedGrammarErrors, ...aiGrammarErrors];
          }
          
          const mappedSuggestions: SpeechFluencySuggestion[] = aiResults
            .filter(s => !s.isGrammarError)
            .map(s => ({
              id: s.id,
              originalPhrase: s.originalPhrase,
              suggestedPhrase: s.suggestedPhrase,
              explanation: s.explanation,
              fullSentence: s.fullSentence || '',
              exampleWhereOriginalWorks: s.exampleWhereOriginalWorks || '',
              category: s.category,
              isGrammarError: false,
              addedToDeck: false,
            }));
          setFluencySuggestions(mappedSuggestions);
          collectedFluencySuggestions = mappedSuggestions;
        } catch (e) {
          console.log('Fluency analysis failed:', e);
          setFluencyCheckFailed(true);
        }
        setIsCheckingFluency(false);
      } else {
        setIsCheckingGrammar(false);
        setIsCheckingFluency(false);
      }
      
      for (const error of collectedGrammarErrors) {
        try {
          await addGap(
            error.correctedText,
            error.incorrectText,
            `${error.ruleName}: ${error.ruleExplanation}`,
            error.sentence,
            error.correctedText,
            'speech',
            undefined,
            undefined,
            undefined,
            'grammar',
            undefined,
            false
          );
        } catch (e) {
          console.log('Failed to add grammar gap:', e);
        }
      }

      for (const suggestion of collectedFluencySuggestions) {
        try {
          await addGap(
            suggestion.suggestedPhrase,
            suggestion.originalPhrase,
            `Fluency tip: ${suggestion.explanation}`,
            suggestion.suggestedPhrase,
            suggestion.suggestedPhrase,
            'speech',
            undefined,
            undefined,
            undefined,
            'connector',
            undefined,
            true
          );
        } catch (e) {
          console.log('Failed to add fluency gap:', e);
        }
      }

      const gapsAddedCount = collectedGrammarErrors.length + collectedFluencySuggestions.length;

      const spokenWords = fullTranscript
        .split(/\s+/)
        .map(w => w.replace(/[.,;:!?'"()«»\-…]/g, '').trim())
        .filter(w => w.length >= 3);
      if (spokenWords.length > 0) {
        void logEncounterBatch(spokenWords, fullTranscript.slice(0, 200), 'speak', `speech_${Date.now()}`);
      }

      let audioData: string | undefined;
      if (isNativePlatform) {
        try {
          const segments = getRecordedAudioSegments();
          if (segments.length > 0) {
            audioData = JSON.stringify(segments);
            console.log('[Speech] Saved', segments.length, 'audio segments for playback');
          }
        } catch (e) {
          console.log('Failed to get native audio segments:', e);
          audioData = undefined;
        }
      } else {
        try {
          const audioPromise = stopAudioRecording();
          const timeoutPromise = new Promise<undefined>((resolve) => setTimeout(() => {
            console.log('Audio recording stop timed out');
            resolve(undefined);
          }, 5000));
          audioData = await Promise.race([audioPromise, timeoutPromise]);
        } catch (e) {
          console.log('Failed to stop audio recording:', e);
          audioData = undefined;
        }
      }

      try {
        await addRecordingLog(
          prompt || 'Free Practice',
          Math.floor(durationSeconds / 60),
          Math.max(1, actualMinutes),
          fullTranscript,
          collectedGrammarErrors,
          collectedFluencySuggestions,
          gapsAddedCount,
          audioData
        );
      } catch (e) {
        console.log('Failed to save recording log:', e);
      }
    } catch (e) {
      console.log('Session complete error:', e);
      setIsCheckingGrammar(false);
      setIsCheckingFluency(false);
    } finally {
      setIsComplete(true);
    }
  }, [transcript, manualTranscript, checkText, analyzeFluency, stopListening, addSpeechSession, addRecordingLog, prompt, durationSeconds]);

  const isNativePlatform = Platform.OS !== 'web';

  const handleToggleRecording = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isPaused) {
      const isNewSession = timeRemaining === durationSeconds;
      if (isNewSession) {
        resetTranscript();
      }
      setIsRecording(true);
      setIsPaused(false);
      if (speechSupported) {
        startListening();
      }
      if (!isNativePlatform) {
        if (isRecordingActive()) {
          await resumeAudioRecording();
        } else {
          await startAudioRecording();
        }
      }
    } else {
      setIsRecording(false);
      setIsPaused(true);
      stopListening();
      if (!isNativePlatform) {
        await pauseAudioRecording();
      }
    }
  };

  const handleMarkGap = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowGapModal(true);
    setGapInput('');
    setGeneratedPhrase(null);
  };

  const handleGeneratePhrase = async () => {
    if (!gapInput.trim()) return;
    
    setIsLoadingGap(true);
    try {
      const promptText = `The user is learning French and wanted to say this but couldn't: "${gapInput}"

Generate a natural French phrase that expresses this idea. The phrase should be:
- Simple and natural (A1-B1 level)
- Something a native speaker would actually say

Respond in this exact JSON format:
{"french": "...", "english": "..."}`;

      const response = await generateText({ messages: [{ role: 'user', content: promptText }] });
      
      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          setGeneratedPhrase({
            french: parsed.french || gapInput,
            english: parsed.english || gapInput,
          });
        }
      } catch {
        setGeneratedPhrase({
          french: gapInput,
          english: gapInput,
        });
      }
    } catch (error) {
      console.log('Error generating phrase:', error);
      setGeneratedPhrase({
        french: gapInput,
        english: gapInput,
      });
    } finally {
      setIsLoadingGap(false);
    }
  };

  const handleSaveGap = async () => {
    if (!generatedPhrase) return;
    
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    const newGap: CapturedGap = {
      id: Date.now().toString(),
      englishInput: gapInput,
      frenchPhrase: generatedPhrase.french,
      translation: generatedPhrase.english,
    };
    
    setCapturedGaps(prev => [...prev, newGap]);
    
    setShowGapModal(false);
    setGapInput('');
    const phraseToSave = generatedPhrase;
    setGeneratedPhrase(null);
    
    addGap(
      phraseToSave.french,
      phraseToSave.english,
      `Phrase you wanted to say: "${gapInput}"`,
      phraseToSave.french,
      phraseToSave.english,
      'speech'
    );
  };

  const handleAddErrorToDeck = async (error: SpeechGrammarError) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    setGrammarErrors(prev => 
      prev.map(e => e.id === error.id ? { ...e, addedToDeck: true } : e)
    );
    setSelectedError(null);
    
    addGap(
      error.correctedText,
      error.incorrectText,
      `${error.ruleName}: ${error.ruleExplanation}`,
      error.sentence,
      error.correctedText,
      'speech'
    );
  };

  const handleAddSuggestionToDeck = async (suggestion: SpeechFluencySuggestion) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    setFluencySuggestions(prev => 
      prev.map(s => s.id === suggestion.id ? { ...s, addedToDeck: true } : s)
    );
    setSelectedSuggestion(null);
    
    addGap(
      suggestion.suggestedPhrase,
      suggestion.originalPhrase,
      `Fluency tip: ${suggestion.explanation}`,
      suggestion.suggestedPhrase,
      suggestion.suggestedPhrase,
      'speech'
    );
  };

  const handleEndSession = useCallback(() => {
    if (sessionEndedRef.current) return;
    sessionEndedRef.current = true;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (timerRef.current) clearInterval(timerRef.current);
    stopListening();
    setIsRecording(false);
    setIsPaused(true);
    setIsProcessing(true);
    
    const actualMinutes = Math.ceil((durationSeconds - timeRemaining) / 60);
    handleSessionComplete(actualMinutes);
  }, [durationSeconds, timeRemaining, handleSessionComplete, stopListening]);

  const handleContinueRecording = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    sessionEndedRef.current = false;
    setTimerElapsed(false);
    setTimeRemaining(60);
    setIsRecording(true);
    setIsPaused(false);
    startListening();
  };

  useEffect(() => {
    if (transcriptScrollRef.current && (transcript || interimTranscript)) {
      transcriptScrollRef.current.scrollToEnd({ animated: true });
    }
  }, [transcript, interimTranscript]);

  const handleExitWithAnimation = useCallback(() => {
    if (isExiting) return;
    setIsExiting(true);
    
    Animated.parallel([
      Animated.timing(exitOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }),
      Animated.timing(exitScale, {
        toValue: 0.95,
        duration: 300,
        useNativeDriver: false,
      }),
    ]).start();
    
    setTimeout(() => {
      safeGoBack();
    }, 300);
  }, [isExiting, exitOpacity, exitScale, router]);

  const skipCelebration = useCallback(() => {
    if (celebrationTimeoutRef.current) {
      clearTimeout(celebrationTimeoutRef.current);
      celebrationTimeoutRef.current = null;
    }
    setShowCelebration(false);
    celebrationOpacity.setValue(0);
    celebrationScale.setValue(0.8);
    insightsOpacity.setValue(1);
    insightsSlide.setValue(0);
  }, [celebrationOpacity, celebrationScale, insightsOpacity, insightsSlide]);

  useEffect(() => {
    if (isComplete && !celebrationShownRef.current) {
      celebrationShownRef.current = true;
      setShowCelebration(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      Animated.parallel([
        Animated.spring(celebrationScale, {
          toValue: 1,
          friction: 6,
          tension: 40,
          useNativeDriver: false,
        }),
        Animated.timing(celebrationOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: false,
        }),
      ]).start();

      celebrationTimeoutRef.current = setTimeout(() => {
        Animated.parallel([
          Animated.timing(celebrationOpacity, {
            toValue: 0,
            duration: 300,
            useNativeDriver: false,
          }),
          Animated.timing(celebrationScale, {
            toValue: 0.8,
            duration: 300,
            useNativeDriver: false,
          }),
        ]).start();

        setTimeout(() => {
          setShowCelebration(false);
          Animated.parallel([
            Animated.timing(insightsOpacity, {
              toValue: 1,
              duration: 400,
              useNativeDriver: false,
            }),
            Animated.timing(insightsSlide, {
              toValue: 0,
              duration: 400,
              useNativeDriver: false,
            }),
          ]).start();
        }, 350);
      }, 2000);

      const safetyTimeout = setTimeout(() => {
        if (showCelebration) {
          console.log('[Speech] Safety timeout - forcing celebration skip');
          skipCelebration();
        }
      }, 4000);

      return () => clearTimeout(safetyTimeout);
    }
  }, [isComplete, celebrationScale, celebrationOpacity, insightsOpacity, insightsSlide, skipCelebration]);

  useEffect(() => {
    return () => {
      if (celebrationTimeoutRef.current) {
        clearTimeout(celebrationTimeoutRef.current);
      }
    };
  }, []);

  if (isProcessing && !isComplete) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={[Colors.primary, Colors.primaryLight]}
          style={styles.celebrationGradient}
        >
          <SafeAreaView style={styles.celebrationSafeArea}>
            <View style={styles.processingContent}>
              <View style={styles.sleepingKiriContainer}>
                <Kiri mood="sleeping" size={120} />
              </View>
              <Text style={styles.processingTitle}>Analyzing your speech...</Text>
              <Text style={styles.processingSubtitle}>
                Checking grammar and fluency
              </Text>
            </View>
          </SafeAreaView>
        </LinearGradient>
      </View>
    );
  }

  if (isComplete) {
    if (showCelebration) {
      return (
        <Pressable style={styles.container} onPress={skipCelebration}>
          <LinearGradient
            colors={[Colors.primary, Colors.primaryLight]}
            style={styles.celebrationGradient}
          >
            <SafeAreaView style={styles.celebrationSafeArea}>
              <Animated.View 
                style={[
                  styles.celebrationContent,
                  {
                    opacity: celebrationOpacity,
                    transform: [{ scale: celebrationScale }],
                  },
                ]}
              >
                <View style={styles.celebrationKiriContainer}>
                  <Kiri mood="celebrating" size={140} />
                </View>
                <View style={styles.celebrationBadge}>
                  <Trophy size={28} color="white" />
                </View>
                <Text style={styles.celebrationTitle}>Amazing!</Text>
                <Text style={styles.celebrationSubtitle}>Great speaking practice</Text>
                <View style={styles.celebrationSparkles}>
                  <Sparkles size={24} color="rgba(255,255,255,0.8)" />
                  <Sparkles size={16} color="rgba(255,255,255,0.6)" style={{ marginTop: -20, marginLeft: 40 }} />
                  <Sparkles size={20} color="rgba(255,255,255,0.7)" style={{ marginTop: 10, marginLeft: -60 }} />
                </View>
                <Text style={styles.celebrationSkipHint}>Tap anywhere to continue</Text>
              </Animated.View>
            </SafeAreaView>
          </LinearGradient>
        </Pressable>
      );
    }

    return (
      <Animated.View style={[styles.container, { opacity: exitOpacity, transform: [{ scale: exitScale }] }]}>
        <LinearGradient
          colors={[Colors.primary, Colors.primaryLight]}
          style={styles.headerGradient}
        >
          <SafeAreaView edges={['top']}>
            <View style={styles.headerRow}>
              <Pressable onPress={handleExitWithAnimation} style={styles.headerCloseButton}>
                <X size={24} color="white" />
              </Pressable>
              <View style={styles.headerCenter}>
                <MessageCircle size={20} color="white" />
                <Text style={styles.headerTitleText}>Session Complete</Text>
              </View>
              <View style={styles.headerKiri}>
                <Kiri mood="celebrating" size={50} />
              </View>
            </View>
          </SafeAreaView>
        </LinearGradient>

        <Animated.ScrollView 
          style={[styles.completeScroll, { opacity: insightsOpacity }]}
          contentContainerStyle={styles.completeContent}
        >
          <Animated.View style={{ transform: [{ translateY: insightsSlide }] }}>
            {isCheckingGrammar ? (
              <View style={styles.checkingContainer}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={styles.checkingText}>Analyzing your speech...</Text>
              </View>
            ) : (
              <>
                <View style={styles.completeIcon}>
                  <Check size={48} color={Colors.primary} />
                </View>
                <Text style={styles.completeTitle}>Great session!</Text>
                <Text style={styles.completeStats}>
                  You spoke for {Math.ceil((durationSeconds - timeRemaining) / 60)} minutes{'\n'}
                  and captured {capturedGaps.length} gaps
                </Text>

                {transcript.trim() && (
                  <View style={styles.transcriptSection}>
                    <Text style={styles.sectionTitle}>What you said:</Text>
                    <View style={styles.transcriptBox}>
                      <Text style={styles.transcriptText}>{transcript.trim()}</Text>
                    </View>
                  </View>
                )}

                {grammarErrors.length > 0 && (
                  <View style={styles.errorsSection}>
                    <View style={styles.errorsSectionHeader}>
                      <AlertCircle size={20} color={Colors.secondary} />
                      <Text style={styles.sectionTitle}>Grammar insights</Text>
                    </View>
                    <Text style={styles.errorsSubtitle}>
                      Tap an error to add it to your study deck
                    </Text>
                    
                    {grammarErrors.map((error) => (
                      <Pressable 
                        key={error.id} 
                        style={[
                          styles.errorCard,
                          error.addedToDeck && styles.errorCardAdded,
                        ]}
                        onPress={() => !error.addedToDeck && setSelectedError(error)}
                        disabled={error.addedToDeck}
                      >
                        <View style={styles.errorHeader}>
                          <View style={styles.errorCategoryBadge}>
                            <Text style={styles.errorCategoryText}>{error.ruleName}</Text>
                          </View>
                          {error.addedToDeck ? (
                            <View style={styles.addedBadge}>
                              <Check size={14} color={Colors.primary} />
                              <Text style={styles.addedText}>Added</Text>
                            </View>
                          ) : (
                            <ChevronRight size={18} color={Colors.textMuted} />
                          )}
                        </View>
                        
                        <View style={styles.errorComparison}>
                          <View style={styles.errorIncorrect}>
                            <Text style={styles.errorLabel}>You said:</Text>
                            <Text style={styles.incorrectText}>{error.incorrectText}</Text>
                          </View>
                          <View style={styles.errorCorrect}>
                            <Text style={styles.errorLabel}>Correct:</Text>
                            <View style={styles.correctionRow}>
                              <Text style={styles.correctText}>{error.correctedText}</Text>
                              <Pressable 
                                style={styles.ttsButton}
                                onPress={(e) => {
                                  e.stopPropagation();
                                  speak(error.correctedText);
                                }}
                              >
                                <Volume2 size={16} color={Colors.primary} />
                              </Pressable>
                            </View>
                          </View>
                        </View>
                        
                        <Text style={styles.errorExplanation} numberOfLines={2}>
                          {error.ruleExplanation}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}

                {grammarErrors.length === 0 && transcript.trim() && !grammarCheckFailed && (
                  <View style={styles.noErrorsCard}>
                    <Check size={24} color={Colors.success} />
                    <Text style={styles.noErrorsText}>No grammar issues detected!</Text>
                  </View>
                )}

                {grammarCheckFailed && (
                  <View style={styles.grammarFailedCard}>
                    <AlertCircle size={20} color={Colors.secondary} />
                    <Text style={styles.grammarFailedText}>
                      Grammar analysis was unavailable. Try again later.
                    </Text>
                  </View>
                )}

                {isCheckingFluency ? (
                  <View style={styles.checkingContainer}>
                    <ActivityIndicator size="small" color={Colors.primary} />
                    <Text style={styles.checkingText}>Analyzing fluency...</Text>
                  </View>
                ) : fluencySuggestions.length > 0 && (
                  <View style={styles.errorsSection}>
                    <View style={styles.errorsSectionHeader}>
                      <BookOpen size={20} color={Colors.primary} />
                      <Text style={styles.sectionTitle}>Fluency suggestions</Text>
                    </View>
                    <Text style={styles.errorsSubtitle}>
                      More natural ways to express your ideas
                    </Text>
                    
                    {fluencySuggestions.map((suggestion) => (
                      <Pressable 
                        key={suggestion.id} 
                        style={[
                          styles.suggestionCard,
                          suggestion.addedToDeck && styles.errorCardAdded,
                        ]}
                        onPress={() => !suggestion.addedToDeck && setSelectedSuggestion(suggestion)}
                        disabled={suggestion.addedToDeck}
                      >
                        <View style={styles.errorHeader}>
                          <View style={styles.suggestionCategoryBadge}>
                            <Text style={styles.suggestionCategoryText}>
                              {suggestion.category === 'more_natural' ? 'More Natural' : 
                               suggestion.category === 'idiomatic' ? 'Idiomatic' : 
                               suggestion.category === 'clearer' ? 'Clearer' : 'Suggestion'}
                            </Text>
                          </View>
                          {suggestion.addedToDeck ? (
                            <View style={styles.addedBadge}>
                              <Check size={14} color={Colors.primary} />
                              <Text style={styles.addedText}>Added</Text>
                            </View>
                          ) : (
                            <ChevronRight size={18} color={Colors.textMuted} />
                          )}
                        </View>
                        
                        <View style={styles.errorComparison}>
                          <View style={styles.errorIncorrect}>
                            <Text style={styles.errorLabel}>You said:</Text>
                            <Text style={styles.suggestionOriginalText}>{suggestion.originalPhrase}</Text>
                          </View>
                          <View style={styles.errorCorrect}>
                            <Text style={styles.errorLabel}>Try instead:</Text>
                            <View style={styles.correctionRow}>
                              <Text style={styles.suggestionBetterText}>{suggestion.suggestedPhrase}</Text>
                              <Pressable 
                                style={styles.ttsButton}
                                onPress={(e) => {
                                  e.stopPropagation();
                                  speak(suggestion.suggestedPhrase);
                                }}
                              >
                                <Volume2 size={16} color={Colors.primary} />
                              </Pressable>
                            </View>
                          </View>
                        </View>
                        
                        <Text style={styles.errorExplanation} numberOfLines={2}>
                          {suggestion.explanation}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}

                {fluencyCheckFailed && !isCheckingFluency && (
                  <View style={styles.grammarFailedCard}>
                    <AlertCircle size={20} color={Colors.textMuted} />
                    <Text style={styles.grammarFailedText}>
                      Fluency analysis was unavailable.
                    </Text>
                  </View>
                )}

                {capturedGaps.length > 0 && (
                  <View style={styles.gapsSummary}>
                    <Text style={styles.sectionTitle}>New phrases learned:</Text>
                    {capturedGaps.map((gap) => (
                      <Pressable 
                        key={gap.id} 
                        style={styles.gapSummaryItem}
                        onPress={() => speak(gap.frenchPhrase)}
                      >
                        <View style={styles.gapSummaryHeader}>
                          <Text style={styles.gapSummaryFrench}>{gap.frenchPhrase}</Text>
                          <Volume2 size={16} color={Colors.primary} />
                        </View>
                        <Text style={styles.gapSummaryEnglish}>{gap.translation}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}

                <Pressable
                  style={styles.doneButton}
                  onPress={handleExitWithAnimation}
                >
                  <Text style={styles.doneButtonText}>Done</Text>
                </Pressable>
              </>
            )}
          </Animated.View>
        </Animated.ScrollView>

        <Modal
          visible={!!selectedError}
            transparent
            animationType="slide"
            onRequestClose={() => setSelectedError(null)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Add to Study Deck</Text>
                  <Pressable 
                    onPress={() => setSelectedError(null)} 
                    style={styles.modalClose}
                  >
                    <X size={20} color={Colors.textMuted} />
                  </Pressable>
                </View>

                {selectedError && (
                  <View style={styles.errorDetailContent}>
                    <View style={styles.errorDetailBadge}>
                      <BookOpen size={16} color={Colors.primary} />
                      <Text style={styles.errorDetailCategory}>{selectedError.ruleName}</Text>
                    </View>

                    <View style={styles.errorDetailComparison}>
                      <View style={styles.errorDetailBox}>
                        <Text style={styles.errorDetailLabel}>Incorrect</Text>
                        <Text style={styles.errorDetailIncorrect}>{selectedError.incorrectText}</Text>
                      </View>
                      <View style={styles.errorDetailArrow}>
                        <ChevronRight size={24} color={Colors.textMuted} />
                      </View>
                      <View style={styles.errorDetailBox}>
                        <Text style={styles.errorDetailLabel}>Correct</Text>
                        <Text style={styles.errorDetailCorrect}>{selectedError.correctedText}</Text>
                      </View>
                    </View>

                    <View style={styles.contextBox}>
                      <Text style={styles.contextLabel}>In your sentence:</Text>
                      <Text style={styles.contextText}>{selectedError.sentence}</Text>
                    </View>

                    <View style={styles.ruleExplanationBox}>
                      <Text style={styles.ruleExplanationTitle}>Why this is wrong:</Text>
                      <Text style={styles.ruleExplanationText}>{selectedError.ruleExplanation}</Text>
                    </View>

                    {selectedError.exampleWhereOriginalWorks && (
                      <View style={styles.exampleBox}>
                        <Text style={styles.exampleLabel}>When "{selectedError.incorrectText}" is correct:</Text>
                        <Text style={styles.exampleText}>{selectedError.exampleWhereOriginalWorks}</Text>
                      </View>
                    )}

                    <Pressable
                      style={styles.addToDeckButton}
                      onPress={() => handleAddErrorToDeck(selectedError)}
                    >
                      <Plus size={18} color={Colors.textLight} />
                      <Text style={styles.addToDeckButtonText}>Add to My Gaps Deck</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            </View>
          </Modal>

          <Modal
            visible={!!selectedSuggestion}
            transparent
            animationType="slide"
            onRequestClose={() => setSelectedSuggestion(null)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Fluency Suggestion</Text>
                  <Pressable 
                    onPress={() => setSelectedSuggestion(null)} 
                    style={styles.modalClose}
                  >
                    <X size={20} color={Colors.textMuted} />
                  </Pressable>
                </View>

                {selectedSuggestion && (
                  <View style={styles.errorDetailContent}>
                    <View style={styles.suggestionDetailBadge}>
                      <BookOpen size={16} color={Colors.primary} />
                      <Text style={styles.suggestionDetailCategory}>
                        {selectedSuggestion.category === 'more_natural' ? 'More Natural Phrasing' : 
                         selectedSuggestion.category === 'idiomatic' ? 'Idiomatic Expression' : 
                         selectedSuggestion.category === 'clearer' ? 'Clearer Expression' : 'Fluency Tip'}
                      </Text>
                    </View>

                    <View style={styles.errorDetailComparison}>
                      <View style={styles.errorDetailBox}>
                        <Text style={styles.errorDetailLabel}>You said</Text>
                        <Text style={styles.suggestionDetailOriginal}>{selectedSuggestion.originalPhrase}</Text>
                      </View>
                      <View style={styles.errorDetailArrow}>
                        <ChevronRight size={24} color={Colors.textMuted} />
                      </View>
                      <View style={styles.errorDetailBox}>
                        <Text style={styles.errorDetailLabel}>Try instead</Text>
                        <Text style={styles.suggestionDetailBetter}>{selectedSuggestion.suggestedPhrase}</Text>
                      </View>
                    </View>

                    {selectedSuggestion.fullSentence && (
                      <View style={styles.contextBox}>
                        <Text style={styles.contextLabel}>In your sentence:</Text>
                        <Text style={styles.contextText}>{selectedSuggestion.fullSentence}</Text>
                      </View>
                    )}

                    <View style={styles.ruleExplanationBox}>
                      <Text style={styles.ruleExplanationTitle}>Why this is better:</Text>
                      <Text style={styles.ruleExplanationText}>{selectedSuggestion.explanation}</Text>
                    </View>

                    <Pressable
                      style={styles.addToDeckButton}
                      onPress={() => handleAddSuggestionToDeck(selectedSuggestion)}
                    >
                      <Plus size={18} color={Colors.textLight} />
                      <Text style={styles.addToDeckButtonText}>Add to My Gaps Deck</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            </View>
          </Modal>
      </Animated.View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[Colors.primary, Colors.primaryLight]}
        style={styles.headerGradient}
      >
        <SafeAreaView edges={['top']}>
          <View style={styles.headerRow}>
            <Pressable onPress={() => safeGoBack()} style={styles.headerCloseButton}>
              <X size={24} color="white" />
            </Pressable>
            <View style={styles.headerCenter}>
              <MessageCircle size={20} color="white" />
              <Text style={styles.headerTitleText}>Speaking</Text>
            </View>
            <View style={styles.headerKiri}>
              <Kiri mood={isRecording ? 'encouraging' : 'idle'} size={50} />
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollContentContainer}>
        <View style={styles.promptCard}>
          <Text style={styles.promptLabel}>Your prompt</Text>
          <Text style={styles.promptText}>{prompt}</Text>
        </View>

        <View style={styles.timerContainer}>
          <Text style={styles.timerText}>{formatTime(timeRemaining)}</Text>
          <Text style={styles.timerLabel}>
            {isPaused ? 'Paused' : isListening ? 'Listening...' : 'Recording...'}
          </Text>
        </View>

        <Animated.View style={[styles.micContainer, { transform: [{ scale: pulseAnim }] }]}>
          <Pressable
            style={[
              styles.micButton,
              isRecording && styles.micButtonRecording,
            ]}
            onPress={handleToggleRecording}
          >
            {isRecording ? (
              <MicOff size={40} color={Colors.textLight} />
            ) : (
              <Mic size={40} color={Colors.textLight} />
            )}
          </Pressable>
        </Animated.View>

        <Text style={styles.micHint}>
          {isPaused ? 'Tap to start speaking' : 'Tap to pause'}
        </Text>

        {timerElapsed && (
          <View style={styles.timerElapsedBanner}>
            <View style={styles.timerElapsedContent}>
              <AlertCircle size={24} color={Colors.secondary} />
              <View style={styles.timerElapsedText}>
                <Text style={styles.timerElapsedTitle}>Time's up!</Text>
                <Text style={styles.timerElapsedSubtitle}>
                  Would you like to continue or end the session?
                </Text>
              </View>
            </View>
            <View style={styles.timerElapsedActions}>
              <Pressable 
                style={styles.continueButton}
                onPress={handleContinueRecording}
              >
                <Text style={styles.continueButtonText}>Continue (+1 min)</Text>
              </Pressable>
              <Pressable 
                style={styles.endNowButton}
                onPress={handleEndSession}
              >
                <Text style={styles.endNowButtonText}>End Session</Text>
              </Pressable>
            </View>
          </View>
        )}

        {speechSupported && showTranscript && (transcript || interimTranscript) && (
          <View style={styles.liveTranscriptContainer}>
            <View style={styles.liveTranscriptHeader}>
              <Text style={styles.liveTranscriptLabel}>Live transcription</Text>
              {isListening && (
                <View style={styles.listeningIndicator}>
                  <View style={styles.listeningDot} />
                  <Text style={styles.listeningText}>Listening</Text>
                </View>
              )}
            </View>
            <ScrollView 
              ref={transcriptScrollRef}
              style={styles.liveTranscriptScroll} 
              nestedScrollEnabled
              onContentSizeChange={() => {
                transcriptScrollRef.current?.scrollToEnd({ animated: true });
              }}
            >
              <Text style={styles.liveTranscriptText}>
                {transcript}
                <Text style={styles.interimText}>{interimTranscript}</Text>
              </Text>
            </ScrollView>
          </View>
        )}

        {!speechSupported && !showManualInput && (
          <Pressable 
            style={styles.unsupportedBanner}
            onPress={() => setShowManualInput(true)}
          >
            <AlertCircle size={16} color={Colors.secondary} />
            <Text style={styles.unsupportedText}>
              Auto-transcription unavailable — tap to type what you said
            </Text>
          </Pressable>
        )}

        {showManualInput && (
          <View style={styles.manualInputContainer}>
            <View style={styles.manualInputHeader}>
              <Text style={styles.manualInputLabel}>Type what you said in French</Text>
              {manualTranscript.trim().length > 0 && (
                <View style={styles.manualCharCount}>
                  <Text style={styles.manualCharCountText}>{manualTranscript.trim().split(/\s+/).length} words</Text>
                </View>
              )}
            </View>
            <TextInput
              style={styles.manualInputField}
              placeholder="Type your French here..."
              placeholderTextColor={Colors.textMuted}
              value={manualTranscript}
              onChangeText={setManualTranscript}
              multiline
              autoCorrect={false}
              autoCapitalize="none"
            />
          </View>
        )}

        <Pressable
          style={styles.gapButton}
          onPress={handleMarkGap}
        >
          <Plus size={20} color={Colors.primary} />
          <Text style={styles.gapButtonText}>Mark a gap</Text>
        </Pressable>

        {capturedGaps.length > 0 && (
          <View style={styles.capturedCount}>
            <Text style={styles.capturedCountText}>
              {capturedGaps.length} gap{capturedGaps.length !== 1 ? 's' : ''} captured
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <SafeAreaView edges={['bottom']}>
          <Pressable
            style={styles.endButton}
            onPress={handleEndSession}
          >
            <Text style={styles.endButtonText}>End session</Text>
          </Pressable>
        </SafeAreaView>
      </View>

      <Modal
        visible={showGapModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowGapModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>What did you want to say?</Text>
              <Pressable 
                onPress={() => setShowGapModal(false)} 
                style={styles.modalClose}
              >
                <X size={20} color={Colors.textMuted} />
              </Pressable>
            </View>

            <TextInput
              style={styles.gapInputField}
              placeholder="Type in English or broken French..."
              placeholderTextColor={Colors.textMuted}
              value={gapInput}
              onChangeText={setGapInput}
              multiline
              autoFocus
            />

            {!generatedPhrase && (
              <Pressable
                style={[
                  styles.generateButton,
                  (!gapInput.trim() || isLoadingGap) && styles.generateButtonDisabled,
                ]}
                onPress={handleGeneratePhrase}
                disabled={!gapInput.trim() || isLoadingGap}
              >
                <Text style={styles.generateButtonText}>
                  {isLoadingGap ? 'Generating...' : 'Show me how to say it'}
                </Text>
              </Pressable>
            )}

            {generatedPhrase && (
              <View style={styles.phraseResult}>
                <View style={styles.phraseHeader}>
                  <Text style={styles.phraseLabel}>In French:</Text>
                  <Pressable 
                    style={[styles.audioButtonSmall, isSpeaking && styles.audioButtonActive]}
                    onPress={() => speak(generatedPhrase.french)}
                  >
                    <Volume2 size={18} color={isSpeaking ? Colors.textLight : Colors.primary} />
                  </Pressable>
                </View>
                <Text style={styles.phraseFrench}>{generatedPhrase.french}</Text>
                <Text style={styles.phraseEnglish}>{generatedPhrase.english}</Text>

                <Pressable
                  style={styles.saveGapButton}
                  onPress={handleSaveGap}
                >
                  <Plus size={18} color={Colors.textLight} />
                  <Text style={styles.saveGapButtonText}>Save to My Gaps Deck</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFBF7',
  },
  celebrationGradient: {
    flex: 1,
  },
  celebrationSafeArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  celebrationContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  celebrationKiriContainer: {
    marginBottom: 20,
  },
  celebrationBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  celebrationTitle: {
    fontSize: 36,
    fontWeight: '700' as const,
    color: 'white',
    marginBottom: 8,
  },
  celebrationSubtitle: {
    fontSize: 18,
    fontWeight: '500' as const,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 20,
  },
  celebrationSparkles: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  celebrationSkipHint: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 32,
    fontWeight: '400' as const,
  },
  processingContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  sleepingKiriContainer: {
    marginBottom: 24,
  },
  headerGradient: {
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  headerCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitleText: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: 'white',
  },
  headerKiri: {
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.backgroundCard,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  placeholder: {
    width: 44,
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingHorizontal: 24,
    alignItems: 'center',
    paddingBottom: 20,
    paddingTop: 20,
  },
  promptCard: {
    width: '100%',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 18,
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  promptLabel: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.textMuted,
    marginBottom: 6,
  },
  promptText: {
    fontSize: 17,
    fontWeight: '500' as const,
    color: Colors.text,
    lineHeight: 24,
  },
  timerContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  timerText: {
    fontSize: 72,
    fontWeight: '700' as const,
    color: Colors.text,
    letterSpacing: -2,
  },
  timerLabel: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginTop: 8,
  },
  micContainer: {
    marginBottom: 20,
  },
  micButton: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  micButtonRecording: {
    backgroundColor: Colors.secondary,
    shadowColor: Colors.secondary,
  },
  micHint: {
    fontSize: 14,
    color: Colors.textMuted,
    marginBottom: 24,
  },
  processingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  processingTitle: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: Colors.text,
    marginTop: 20,
    marginBottom: 8,
  },
  processingSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  timerElapsedBanner: {
    width: '100%',
    backgroundColor: Colors.secondaryLight,
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.secondary,
  },
  timerElapsedContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  timerElapsedText: {
    flex: 1,
  },
  timerElapsedTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.secondary,
    marginBottom: 4,
  },
  timerElapsedSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  timerElapsedActions: {
    flexDirection: 'row',
    gap: 12,
  },
  continueButton: {
    flex: 1,
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  continueButtonText: {
    color: Colors.textLight,
    fontSize: 14,
    fontWeight: '600' as const,
  },
  endNowButton: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  endNowButtonText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600' as const,
  },
  liveTranscriptContainer: {
    width: '100%',
    backgroundColor: Colors.backgroundCard,
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    maxHeight: 150,
  },
  liveTranscriptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  liveTranscriptLabel: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.textMuted,
  },
  listeningIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  listeningDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.secondary,
  },
  listeningText: {
    fontSize: 12,
    color: Colors.secondary,
    fontWeight: '500' as const,
  },
  liveTranscriptScroll: {
    maxHeight: 100,
  },
  liveTranscriptText: {
    fontSize: 15,
    color: Colors.text,
    lineHeight: 22,
  },
  interimText: {
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  unsupportedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.secondaryLight,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 20,
    width: '100%',
  },
  unsupportedText: {
    fontSize: 13,
    color: Colors.secondary,
    flex: 1,
  },
  manualInputContainer: {
    width: '100%',
    backgroundColor: Colors.backgroundCard,
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  manualInputHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  manualInputLabel: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.textMuted,
  },
  manualCharCount: {
    backgroundColor: Colors.primaryLight,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  manualCharCountText: {
    fontSize: 11,
    color: Colors.primary,
    fontWeight: '500' as const,
  },
  manualInputField: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: Colors.text,
    minHeight: 80,
    textAlignVertical: 'top',
    lineHeight: 22,
  },
  gapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: Colors.backgroundCard,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  gapButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  capturedCount: {
    marginTop: 20,
    backgroundColor: Colors.primaryLight,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  capturedCountText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.primary,
  },
  footer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  endButton: {
    backgroundColor: Colors.backgroundCard,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  endButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.backgroundCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  modalClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gapInputField: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: Colors.text,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  generateButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  generateButtonDisabled: {
    backgroundColor: Colors.border,
  },
  generateButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.textLight,
  },
  phraseResult: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 14,
    padding: 18,
  },
  phraseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  phraseLabel: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.textMuted,
  },
  audioButtonSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  audioButtonActive: {
    backgroundColor: Colors.primary,
  },
  phraseFrench: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: Colors.primary,
    marginBottom: 8,
  },
  phraseEnglish: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  saveGapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
  },
  saveGapButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.textLight,
  },
  completeScroll: {
    flex: 1,
  },
  completeContent: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 40,
  },
  checkingContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  checkingText: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginTop: 16,
  },
  completeIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  completeTitle: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 12,
  },
  completeStats: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  transcriptSection: {
    width: '100%',
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 12,
  },
  transcriptBox: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 14,
    padding: 16,
  },
  transcriptText: {
    fontSize: 15,
    color: Colors.text,
    lineHeight: 22,
  },
  errorsSection: {
    width: '100%',
    marginBottom: 24,
  },
  errorsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  errorsSubtitle: {
    fontSize: 14,
    color: Colors.textMuted,
    marginBottom: 14,
  },
  errorCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  errorCardAdded: {
    borderColor: Colors.primaryLight,
    backgroundColor: Colors.primaryLight + '20',
  },
  errorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  errorCategoryBadge: {
    backgroundColor: Colors.secondaryLight,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  errorCategoryText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.secondary,
  },
  addedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addedText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '500' as const,
  },
  errorComparison: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
  },
  errorIncorrect: {
    flex: 1,
  },
  errorCorrect: {
    flex: 1,
  },
  errorLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  incorrectText: {
    fontSize: 15,
    color: Colors.secondary,
    fontWeight: '500' as const,
    textDecorationLine: 'line-through',
  },
  correctText: {
    fontSize: 15,
    color: Colors.success,
    fontWeight: '600' as const,
    flex: 1,
  },
  correctionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ttsButton: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: Colors.primaryLight,
  },
  errorExplanation: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  noErrorsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.primaryLight,
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    width: '100%',
  },
  grammarFailedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.secondaryLight,
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    width: '100%',
  },
  grammarFailedText: {
    flex: 1,
    fontSize: 14,
    color: Colors.secondary,
    lineHeight: 20,
  },
  noErrorsText: {
    fontSize: 15,
    color: Colors.primaryDark,
    fontWeight: '500' as const,
  },
  gapsSummary: {
    width: '100%',
    marginBottom: 32,
  },
  gapSummaryItem: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  gapSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  gapSummaryFrench: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.primary,
    marginBottom: 4,
  },
  gapSummaryEnglish: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  doneButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 14,
  },
  doneButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.textLight,
  },
  errorDetailContent: {
    paddingTop: 8,
  },
  errorDetailBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primaryLight,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 20,
  },
  errorDetailCategory: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.primaryDark,
  },
  errorDetailComparison: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  errorDetailBox: {
    flex: 1,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 12,
    padding: 14,
  },
  errorDetailArrow: {
    paddingHorizontal: 8,
  },
  errorDetailLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 6,
  },
  errorDetailIncorrect: {
    fontSize: 18,
    color: Colors.secondary,
    fontWeight: '600' as const,
    textDecorationLine: 'line-through',
  },
  errorDetailCorrect: {
    fontSize: 18,
    color: Colors.success,
    fontWeight: '600' as const,
  },
  ruleExplanationBox: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  ruleExplanationTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textMuted,
    marginBottom: 8,
  },
  ruleExplanationText: {
    fontSize: 15,
    color: Colors.text,
    lineHeight: 22,
  },
  suggestionCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.primaryLight,
  },
  suggestionCategoryBadge: {
    backgroundColor: Colors.primaryLight,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  suggestionCategoryText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.primaryDark,
  },
  suggestionOriginalText: {
    fontSize: 15,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  suggestionBetterText: {
    fontSize: 15,
    color: Colors.primary,
    fontWeight: '600' as const,
    flex: 1,
  },
  suggestionDetailBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primaryLight,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 20,
  },
  suggestionDetailCategory: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.primaryDark,
  },
  suggestionDetailOriginal: {
    fontSize: 16,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  suggestionDetailBetter: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '600' as const,
  },
  contextBox: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
  },
  contextLabel: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.textMuted,
    marginBottom: 8,
  },
  contextText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  exampleBox: {
    backgroundColor: Colors.successLight,
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
    borderLeftWidth: 3,
    borderLeftColor: Colors.success,
  },
  exampleLabel: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.success,
    marginBottom: 8,
  },
  exampleText: {
    fontSize: 14,
    color: Colors.text,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  addToDeckButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
  },
  addToDeckButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.textLight,
  },
});
