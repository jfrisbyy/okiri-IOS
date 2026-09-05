import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Animated,
  Dimensions,
  Modal,
  TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import {
  Check,
  X,
  ArrowRight,
  BookOpen,
  Sparkles,
  Eye,
  Target,
  Award,
  ChevronRight,
  Lightbulb,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { USE_NATIVE_DRIVER } from '@/constants/animation';
import { useApp } from '@/contexts/AppContext';
import { UserLevel, UserGoal } from '@/types';
import {
  getOnboardingPassage,
  generateQuizQuestions,
  OnboardingWord,
  QuizQuestion,
} from '@/mocks/onboardingPassages';
import Kiri from '@/components/Kiri';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Phase = 'intro' | 'read' | 'learn' | 'reread' | 'complete';
type QuizAnswerState = 'pending' | 'correct' | 'incorrect';

interface MarkedWord {
  french: string;
  english: string;
  explanation: string;
  exampleSentence: string;
  exampleTranslation: string;
}

export default function GapDiscoveryScreen() {
  const { name, email, level, goal } = useLocalSearchParams<{
    name: string;
    email: string;
    level: string;
    goal: string;
  }>();
  const router = useRouter();
  const { createUser, addGap } = useApp();

  const userLevel = (level as UserLevel) || 'none';
  const userGoal = (goal as UserGoal) || 'curious';
  const passage = useMemo(() => getOnboardingPassage(userLevel), [userLevel]);

  const [phase, setPhase] = useState<Phase>('intro');
  const [markedWords, setMarkedWords] = useState<MarkedWord[]>([]);
  const [learnedWords, setLearnedWords] = useState<Set<string>>(new Set());
  const [allTimeMarked, setAllTimeMarked] = useState<Set<string>>(new Set());
  const [roundNumber, setRoundNumber] = useState(1);
  const [startTime] = useState(Date.now());

  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizIndex, setQuizIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [quizAnswerState, setQuizAnswerState] = useState<QuizAnswerState>('pending');
  const [quizCorrectCount, setQuizCorrectCount] = useState(0);

  const [wordTooltip, setWordTooltip] = useState<OnboardingWord | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const introScale = useRef(new Animated.Value(0.9)).current;
  const phaseTransition = useRef(new Animated.Value(1)).current;
  const tooltipAnim = useRef(new Animated.Value(0)).current;
  const quizSlideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.spring(introScale, { toValue: 1, friction: 8, tension: 40, useNativeDriver: USE_NATIVE_DRIVER }),
    ]).start();
  }, []);

  const animatePhaseChange = useCallback((nextPhase: Phase) => {
    Animated.timing(phaseTransition, {
      toValue: 0,
      duration: 200,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start(({ finished }) => {
      setPhase(nextPhase);
      quizSlideAnim.setValue(30);
      Animated.parallel([
        Animated.timing(phaseTransition, { toValue: 1, duration: 300, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(quizSlideAnim, { toValue: 0, duration: 300, useNativeDriver: USE_NATIVE_DRIVER }),
      ]).start();
    });

    setTimeout(() => {
      setPhase((current) => {
        if (current !== nextPhase) {
          phaseTransition.setValue(1);
          quizSlideAnim.setValue(0);
          return nextPhase;
        }
        return current;
      });
    }, 350);
  }, [phaseTransition, quizSlideAnim]);

  const words = useMemo(() => passage.french.split(/\s+/).filter(w => w.length > 0), [passage]);

  const vocabLookup = useMemo(() => {
    const map = new Map<string, OnboardingWord>();
    for (const word of passage.vocabulary) {
      map.set(word.french.toLowerCase(), word);
    }
    return map;
  }, [passage]);

  const cleanWord = useCallback((w: string) => {
    return w.replace(/[.,;:!?'"()«»\-…]/g, '').toLowerCase();
  }, []);

  const findVocabMatch = useCallback((tappedWord: string): OnboardingWord | null => {
    const cleaned = cleanWord(tappedWord);
    if (vocabLookup.has(cleaned)) return vocabLookup.get(cleaned)!;

    for (const [key, val] of vocabLookup) {
      const keyClean = key.toLowerCase().replace(/[.,;:!?'"()«»\-…]/g, '');
      if (keyClean === cleaned) return val;
      if (cleaned.startsWith(keyClean) || keyClean.startsWith(cleaned)) return val;
    }
    return null;
  }, [vocabLookup, cleanWord]);

  const handleWordTap = useCallback((word: string) => {
    if (phase !== 'read' && phase !== 'reread') return;

    const match = findVocabMatch(word);
    if (!match) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const alreadyMarked = markedWords.some(
      m => m.french.toLowerCase() === match.french.toLowerCase()
    );

    if (!alreadyMarked) {
      setMarkedWords(prev => [...prev, {
        french: match.french,
        english: match.english,
        explanation: match.explanation,
        exampleSentence: match.exampleSentence,
        exampleTranslation: match.exampleTranslation,
      }]);
      setAllTimeMarked(prev => new Set([...prev, match.french.toLowerCase()]));
    }

    setWordTooltip(match);
    tooltipAnim.setValue(0);
    Animated.spring(tooltipAnim, {
      toValue: 1,
      friction: 8,
      tension: 60,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [phase, markedWords, findVocabMatch, tooltipAnim]);

  const dismissTooltip = useCallback(() => {
    Animated.timing(tooltipAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start(() => setWordTooltip(null));
  }, [tooltipAnim]);

  const handleStartReading = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    animatePhaseChange('read');
  }, [animatePhaseChange]);

  const handleDoneMarking = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    dismissTooltip();

    if (markedWords.length === 0) {
      animatePhaseChange('complete');
      return;
    }

    const currentRoundWords = markedWords.filter(
      m => !learnedWords.has(m.french.toLowerCase())
    );

    if (currentRoundWords.length === 0) {
      animatePhaseChange('complete');
      return;
    }

    const matchingVocab = currentRoundWords
      .map(m => passage.vocabulary.find(v => v.french.toLowerCase() === m.french.toLowerCase()))
      .filter((v): v is OnboardingWord => v !== null);

    if (matchingVocab.length === 0) {
      animatePhaseChange('complete');
      return;
    }

    const questions = generateQuizQuestions(matchingVocab);
    const limitedQuestions = questions.slice(0, Math.min(questions.length, 8));
    setQuizQuestions(limitedQuestions);
    setQuizIndex(0);
    setSelectedAnswer(null);
    setQuizAnswerState('pending');
    setQuizCorrectCount(0);
    animatePhaseChange('learn');
  }, [markedWords, learnedWords, passage, animatePhaseChange, dismissTooltip]);

  const handleUnderstandAll = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    dismissTooltip();
    animatePhaseChange('complete');
  }, [animatePhaseChange, dismissTooltip]);

  const normalizeForCompare = useCallback((text: string) => {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[.,!?;:'"\-()]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }, []);

  const handleQuizSelect = useCallback((answer: string) => {
    if (quizAnswerState !== 'pending') return;
    setSelectedAnswer(answer);
  }, [quizAnswerState]);

  const handleQuizCheck = useCallback(() => {
    const currentQ = quizQuestions[quizIndex];
    if (!currentQ || quizAnswerState !== 'pending') return;

    let isCorrect = false;

    if (currentQ.type === 'multiple_choice') {
      isCorrect = selectedAnswer === currentQ.correctAnswer;
    } else {
      const normUser = normalizeForCompare(selectedAnswer || '');
      const normCorrect = normalizeForCompare(currentQ.correctAnswer);
      isCorrect = normUser === normCorrect || normCorrect.includes(normUser) || normUser.includes(normCorrect);
    }

    setQuizAnswerState(isCorrect ? 'correct' : 'incorrect');

    if (isCorrect) {
      setQuizCorrectCount(prev => prev + 1);
      setLearnedWords(prev => new Set([...prev, currentQ.wordFrench.toLowerCase()]));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [quizQuestions, quizIndex, selectedAnswer, quizAnswerState, normalizeForCompare]);

  const handleQuizNext = useCallback(() => {
    if (quizIndex >= quizQuestions.length - 1) {
      setRoundNumber(prev => prev + 1);
      setMarkedWords([]);
      animatePhaseChange('reread');
    } else {
      setQuizIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setQuizAnswerState('pending');
      quizSlideAnim.setValue(20);
      Animated.timing(quizSlideAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: USE_NATIVE_DRIVER,
      }).start();
    }
  }, [quizIndex, quizQuestions.length, animatePhaseChange, quizSlideAnim]);

  const handleComplete = useCallback(async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      await createUser(name || '', email || '', userLevel, userGoal);

      for (const wordKey of allTimeMarked) {
        const vocab = passage.vocabulary.find(
          v => v.french.toLowerCase() === wordKey
        );
        if (vocab) {
          await addGap(
            vocab.french,
            vocab.english,
            vocab.explanation,
            vocab.exampleSentence,
            vocab.exampleTranslation,
            'foundation',
            'onboarding',
            undefined,
            undefined,
            'vocab',
          );
        }
      }

      router.replace('/(tabs)/home');
    } catch (error) {
      console.error('[GapDiscovery] Error completing onboarding:', error);
      setIsSubmitting(false);
    }
  }, [isSubmitting, createUser, name, email, userLevel, userGoal, allTimeMarked, passage, addGap, router]);

  const elapsedMinutes = useMemo(() => {
    return Math.max(1, Math.round((Date.now() - startTime) / 60000));
  }, [startTime, phase]);

  const isWordMarked = useCallback((word: string) => {
    const cleaned = cleanWord(word);
    return allTimeMarked.has(cleaned) || markedWords.some(
      m => cleanWord(m.french) === cleaned
    );
  }, [allTimeMarked, markedWords, cleanWord]);

  const isWordLearned = useCallback((word: string) => {
    const cleaned = cleanWord(word);
    return learnedWords.has(cleaned);
  }, [learnedWords, cleanWord]);

  const renderPassageWords = useCallback((showLearned: boolean) => {
    return (
      <View style={styles.passageContainer}>
        {words.map((word, idx) => {
          const cleaned = cleanWord(word);
          const marked = isWordMarked(word);
          const learned = isWordLearned(word);
          const hasVocab = findVocabMatch(word) !== null;

          return (
            <Pressable
              key={`${idx}-${word}`}
              onPress={() => handleWordTap(word)}
              style={({ pressed }) => [
                styles.wordTouchable,
                pressed && hasVocab && styles.wordPressed,
              ]}
            >
              <Text
                style={[
                  styles.passageWord,
                  hasVocab && styles.passageWordTappable,
                  marked && !learned && styles.passageWordMarked,
                  showLearned && learned && styles.passageWordLearned,
                ]}
              >
                {word}
                {idx < words.length - 1 ? ' ' : ''}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  }, [words, cleanWord, isWordMarked, isWordLearned, findVocabMatch, handleWordTap]);

  const renderIntro = () => (
    <Animated.View style={[styles.phaseContent, {
      opacity: fadeAnim,
      transform: [{ translateY: slideAnim }, { scale: introScale }],
    }]}>
      <View style={styles.introContainer}>
        <Kiri mood="happy" size={120} />

        <View style={styles.introBubble}>
          <Text style={styles.introTitle}>Let's try something</Text>
          <Text style={styles.introText}>
            Here's a short message written in French.{'\n\n'}
            <Text style={styles.introHighlight}>Tap any word you don't understand</Text> — we'll teach it to you right away, then you'll read it again.{'\n\n'}
            Keep going until the whole message makes sense.
          </Text>
        </View>

        <View style={styles.introHintRow}>
          <View style={styles.introHintDot} />
          <Text style={styles.introHintText}>
            This is exactly how Okiri works — your gaps become your lessons
          </Text>
        </View>

        <Pressable
          style={({ pressed }) => [styles.introButton, pressed && styles.buttonPressed]}
          onPress={handleStartReading}
          testID="start-reading-btn"
        >
          <BookOpen size={20} color="#fff" />
          <Text style={styles.introButtonText}>Show me the French</Text>
        </Pressable>
      </View>
    </Animated.View>
  );

  const renderRead = () => (
    <Animated.View style={[styles.phaseContent, { opacity: phaseTransition }]}>
      <ScrollView
        style={styles.readScroll}
        contentContainerStyle={styles.readScrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.readHeader}>
          <View style={styles.phaseIndicator}>
            <View style={[styles.phaseStep, styles.phaseStepActive]}>
              <BookOpen size={14} color="#fff" />
            </View>
            <View style={styles.phaseStepLine} />
            <View style={styles.phaseStep}>
              <Target size={14} color={Colors.textMuted} />
            </View>
            <View style={styles.phaseStepLine} />
            <View style={styles.phaseStep}>
              <Eye size={14} color={Colors.textMuted} />
            </View>
          </View>

          <Text style={styles.readInstruction}>
            Tap any word you don't know
          </Text>

          {markedWords.length > 0 && (
            <View style={styles.markedBadge}>
              <Target size={14} color={Colors.primary} />
              <Text style={styles.markedBadgeText}>
                {markedWords.length} word{markedWords.length !== 1 ? 's' : ''} marked
              </Text>
            </View>
          )}
        </View>

        <View style={styles.passageCard}>
          {renderPassageWords(false)}
        </View>

        {markedWords.length > 0 && (
          <View style={styles.markedList}>
            <Text style={styles.markedListTitle}>Words you marked:</Text>
            {markedWords.map((m, i) => (
              <View key={i} style={styles.markedItem}>
                <Text style={styles.markedFrench}>{m.french}</Text>
                <Text style={styles.markedEnglish}>{m.english}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={styles.readFooter}>
        <Pressable
          style={({ pressed }) => [styles.doneMarkingButton, pressed && styles.buttonPressed]}
          onPress={handleDoneMarking}
          testID="done-marking-btn"
        >
          <Text style={styles.doneMarkingText}>
            {markedWords.length > 0 ? `Learn these ${markedWords.length} words` : "I understand everything"}
          </Text>
          <ArrowRight size={18} color="#fff" />
        </Pressable>

        {markedWords.length === 0 && (
          <Text style={styles.readHint}>
            No words tapped? If you understand it all, that's great!
          </Text>
        )}
      </View>
    </Animated.View>
  );

  const renderLearn = () => {
    const currentQ = quizQuestions[quizIndex];
    if (!currentQ) return null;

    const totalQ = quizQuestions.length;

    return (
      <Animated.View style={[styles.phaseContent, { opacity: phaseTransition }]}>
        <View style={styles.learnHeader}>
          <View style={styles.phaseIndicator}>
            <View style={[styles.phaseStep, styles.phaseStepDone]}>
              <Check size={14} color="#fff" />
            </View>
            <View style={[styles.phaseStepLine, styles.phaseStepLineDone]} />
            <View style={[styles.phaseStep, styles.phaseStepActive]}>
              <Target size={14} color="#fff" />
            </View>
            <View style={styles.phaseStepLine} />
            <View style={styles.phaseStep}>
              <Eye size={14} color={Colors.textMuted} />
            </View>
          </View>

          <View style={styles.quizDotsRow}>
            {Array.from({ length: totalQ }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.quizDot,
                  i < quizIndex && styles.quizDotDone,
                  i === quizIndex && styles.quizDotActive,
                ]}
              />
            ))}
          </View>
        </View>

        <Animated.View style={[styles.quizArea, {
          opacity: phaseTransition,
          transform: [{ translateY: quizSlideAnim }],
        }]}>
          <ScrollView
            style={styles.quizScroll}
            contentContainerStyle={styles.quizScrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.quizTypeTag}>
              <Text style={styles.quizTypeText}>
                {currentQ.type === 'multiple_choice' ? 'Choose the correct answer' : 'Translate this sentence'}
              </Text>
            </View>

            <Text style={styles.quizQuestion}>{currentQ.question}</Text>

            {currentQ.type === 'multiple_choice' && currentQ.choices && (
              <View style={styles.quizChoices}>
                {currentQ.choices.map((choice, idx) => {
                  const isSelected = selectedAnswer === choice;
                  const isCorrectChoice = choice === currentQ.correctAnswer;
                  const showCorrect = quizAnswerState !== 'pending' && isCorrectChoice;
                  const showIncorrect = quizAnswerState === 'incorrect' && isSelected && !isCorrectChoice;

                  return (
                    <Pressable
                      key={idx}
                      style={[
                        styles.quizChoice,
                        isSelected && quizAnswerState === 'pending' && styles.quizChoiceSelected,
                        showCorrect && styles.quizChoiceCorrect,
                        showIncorrect && styles.quizChoiceIncorrect,
                      ]}
                      onPress={() => handleQuizSelect(choice)}
                      disabled={quizAnswerState !== 'pending'}
                    >
                      <Text style={[
                        styles.quizChoiceText,
                        isSelected && quizAnswerState === 'pending' && styles.quizChoiceTextSelected,
                        showCorrect && styles.quizChoiceTextCorrect,
                        showIncorrect && styles.quizChoiceTextIncorrect,
                      ]}>
                        {choice}
                      </Text>
                      {showCorrect && <Check size={18} color={Colors.success} />}
                      {showIncorrect && <X size={18} color={Colors.error} />}
                    </Pressable>
                  );
                })}
              </View>
            )}

            {currentQ.type === 'translation' && (
              <View style={styles.translationInputWrap}>
                <TextInput
                  style={[
                    styles.translationInput,
                    quizAnswerState === 'correct' && styles.translationInputCorrect,
                    quizAnswerState === 'incorrect' && styles.translationInputIncorrect,
                  ]}
                  value={selectedAnswer || ''}
                  onChangeText={setSelectedAnswer}
                  placeholder="Type your translation..."
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={quizAnswerState === 'pending'}
                  multiline
                />
                {quizAnswerState === 'incorrect' && (
                  <View style={styles.correctAnswerBox}>
                    <Text style={styles.correctAnswerLabel}>Correct answer:</Text>
                    <Text style={styles.correctAnswerText}>{currentQ.correctAnswer}</Text>
                  </View>
                )}
              </View>
            )}

            {quizAnswerState !== 'pending' && (
              <View style={styles.quizFeedback}>
                <View style={[
                  styles.feedbackIcon,
                  { backgroundColor: quizAnswerState === 'correct' ? Colors.successLight : '#FFF7ED' },
                ]}>
                  {quizAnswerState === 'correct' ? (
                    <Check size={20} color={Colors.success} />
                  ) : (
                    <X size={20} color={Colors.warning} />
                  )}
                </View>
                <Text style={[
                  styles.feedbackText,
                  { color: quizAnswerState === 'correct' ? Colors.success : Colors.warning },
                ]}>
                  {quizAnswerState === 'correct' ? 'Nice work!' : "Not quite — you'll get it next time"}
                </Text>
              </View>
            )}

            {currentQ.hint && quizAnswerState === 'pending' && (
              <View style={styles.quizHintRow}>
                <Lightbulb size={14} color={Colors.textMuted} />
                <Text style={styles.quizHintText}>{currentQ.hint}</Text>
              </View>
            )}
          </ScrollView>
        </Animated.View>

        <View style={styles.quizFooter}>
          {quizAnswerState === 'pending' ? (
            <Pressable
              style={[
                styles.quizCheckButton,
                !selectedAnswer && styles.quizCheckButtonDisabled,
              ]}
              onPress={handleQuizCheck}
              disabled={!selectedAnswer}
            >
              <Text style={styles.quizCheckButtonText}>Check</Text>
            </Pressable>
          ) : (
            <Pressable
              style={({ pressed }) => [styles.quizNextButton, pressed && styles.buttonPressed]}
              onPress={handleQuizNext}
            >
              <Text style={styles.quizNextButtonText}>
                {quizIndex >= quizQuestions.length - 1 ? 'Read again' : 'Next'}
              </Text>
              <ArrowRight size={18} color="#fff" />
            </Pressable>
          )}
        </View>
      </Animated.View>
    );
  };

  const renderReread = () => (
    <Animated.View style={[styles.phaseContent, { opacity: phaseTransition }]}>
      <ScrollView
        style={styles.readScroll}
        contentContainerStyle={styles.readScrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.readHeader}>
          <View style={styles.phaseIndicator}>
            <View style={[styles.phaseStep, styles.phaseStepDone]}>
              <Check size={14} color="#fff" />
            </View>
            <View style={[styles.phaseStepLine, styles.phaseStepLineDone]} />
            <View style={[styles.phaseStep, styles.phaseStepDone]}>
              <Check size={14} color="#fff" />
            </View>
            <View style={[styles.phaseStepLine, styles.phaseStepLineDone]} />
            <View style={[styles.phaseStep, styles.phaseStepActive]}>
              <Eye size={14} color="#fff" />
            </View>
          </View>

          <Text style={styles.rereadTitle}>Read it again</Text>
          <Text style={styles.rereadSubtitle}>
            Words you learned are highlighted. Tap any new words you still don't know.
          </Text>

          {learnedWords.size > 0 && (
            <View style={styles.learnedBadge}>
              <Sparkles size={14} color={Colors.success} />
              <Text style={styles.learnedBadgeText}>
                {learnedWords.size} word{learnedWords.size !== 1 ? 's' : ''} learned
              </Text>
            </View>
          )}
        </View>

        <View style={styles.passageCard}>
          {renderPassageWords(true)}
        </View>

        {markedWords.length > 0 && (
          <View style={styles.markedList}>
            <Text style={styles.markedListTitle}>New words marked:</Text>
            {markedWords.map((m, i) => (
              <View key={i} style={styles.markedItem}>
                <Text style={styles.markedFrench}>{m.french}</Text>
                <Text style={styles.markedEnglish}>{m.english}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={styles.rereadFooter}>
        {markedWords.length > 0 ? (
          <Pressable
            style={({ pressed }) => [styles.doneMarkingButton, pressed && styles.buttonPressed]}
            onPress={handleDoneMarking}
          >
            <Text style={styles.doneMarkingText}>
              Learn these {markedWords.length} new words
            </Text>
            <ArrowRight size={18} color="#fff" />
          </Pressable>
        ) : (
          <Pressable
            style={({ pressed }) => [styles.understandButton, pressed && styles.buttonPressed]}
            onPress={handleUnderstandAll}
          >
            <Check size={20} color="#fff" />
            <Text style={styles.understandButtonText}>I understand it all now</Text>
          </Pressable>
        )}

        {markedWords.length === 0 && (
          <Pressable style={styles.markMoreHint} onPress={() => {}}>
            <Text style={styles.markMoreText}>
              Still confused? Tap more words above
            </Text>
          </Pressable>
        )}
      </View>
    </Animated.View>
  );

  const renderComplete = () => {
    const totalLearned = allTimeMarked.size;
    const totalRounds = roundNumber;

    return (
      <Animated.View style={[styles.phaseContent, { opacity: phaseTransition }]}>
        <LinearGradient
          colors={['#ECFDF5', '#D1FAE5', '#FFF9F7']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
        <ScrollView
          contentContainerStyle={styles.completeScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.completeContent}>
            <Kiri mood="celebrating" size={130} />

            <View style={styles.completeStatsCard}>
              <Text style={styles.completeBigNumber}>{totalLearned}</Text>
              <Text style={styles.completeStatsLabel}>
                {totalLearned === 1 ? 'gap discovered & learned' : 'gaps discovered & learned'}
              </Text>

              <View style={styles.completeStatsDivider} />

              <View style={styles.completeStatsRow}>
                <View style={styles.completeStat}>
                  <Text style={styles.completeStatNumber}>{totalRounds}</Text>
                  <Text style={styles.completeStatLabel}>
                    {totalRounds === 1 ? 'round' : 'rounds'}
                  </Text>
                </View>
                <View style={styles.completeStatSep} />
                <View style={styles.completeStat}>
                  <Text style={styles.completeStatNumber}>{elapsedMinutes}</Text>
                  <Text style={styles.completeStatLabel}>
                    {elapsedMinutes === 1 ? 'minute' : 'minutes'}
                  </Text>
                </View>
              </View>
            </View>

            <Text style={styles.completeTitle}>
              {totalLearned > 0 ? 'You just experienced the gap method' : 'Impressive!'}
            </Text>
            <Text style={styles.completeMessage}>
              {totalLearned > 0
                ? `You found ${totalLearned} word${totalLearned !== 1 ? 's' : ''} you didn't know, learned ${totalLearned === 1 ? 'it' : 'them'}, and read the passage again with understanding. This is how Okiri works — every day.`
                : "You understood the whole passage! As you explore harder content, Okiri will find and fill your gaps automatically."
              }
            </Text>

            {totalLearned > 0 && (
              <View style={styles.completeSavedNote}>
                <Award size={16} color={Colors.primary} />
                <Text style={styles.completeSavedText}>
                  {totalLearned} gap{totalLearned !== 1 ? 's' : ''} saved to your deck for review
                </Text>
              </View>
            )}

            <Pressable
              style={({ pressed }) => [styles.completeButton, pressed && styles.buttonPressed]}
              onPress={handleComplete}
              disabled={isSubmitting}
              testID="enter-app-btn"
            >
              <Text style={styles.completeButtonText}>
                {isSubmitting ? 'Setting up...' : 'Start learning with Okiri'}
              </Text>
              <ChevronRight size={20} color="#fff" />
            </Pressable>
          </View>
        </ScrollView>
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safeArea}>
        {phase === 'intro' && renderIntro()}
        {phase === 'read' && renderRead()}
        {phase === 'learn' && renderLearn()}
        {phase === 'reread' && renderReread()}
        {phase === 'complete' && renderComplete()}
      </SafeAreaView>

      {wordTooltip && (
        <Pressable style={styles.tooltipOverlay} onPress={dismissTooltip}>
          <Animated.View style={[styles.tooltipCard, {
            opacity: tooltipAnim,
            transform: [{
              translateY: tooltipAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0],
              }),
            }],
          }]}>
            <View style={styles.tooltipHeader}>
              <Text style={styles.tooltipFrench}>{wordTooltip.french}</Text>
              <Text style={styles.tooltipEnglish}>{wordTooltip.english}</Text>
            </View>
            <Text style={styles.tooltipExplanation}>{wordTooltip.explanation}</Text>
            <View style={styles.tooltipExample}>
              <Text style={styles.tooltipExampleFrench}>{wordTooltip.exampleSentence}</Text>
              <Text style={styles.tooltipExampleEnglish}>{wordTooltip.exampleTranslation}</Text>
            </View>
            <Pressable style={styles.tooltipDismiss} onPress={dismissTooltip}>
              <Text style={styles.tooltipDismissText}>Got it</Text>
            </Pressable>
          </Animated.View>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  safeArea: {
    flex: 1,
  },
  phaseContent: {
    flex: 1,
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },

  introContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingBottom: 32,
  },
  introBubble: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 20,
    padding: 24,
    marginTop: 24,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  introTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  introText: {
    fontSize: 16,
    color: Colors.textSecondary,
    lineHeight: 24,
  },
  introHighlight: {
    color: Colors.primary,
    fontWeight: '600' as const,
  },
  introHintRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 20,
    paddingHorizontal: 4,
  },
  introHintDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
    marginTop: 7,
  },
  introHintText: {
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 18,
    flex: 1,
  },
  introButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.primary,
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 16,
    marginTop: 28,
    width: '100%',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  introButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: '#fff',
  },

  readScroll: {
    flex: 1,
  },
  readScrollContent: {
    padding: 20,
    paddingBottom: 16,
  },
  readHeader: {
    marginBottom: 20,
  },
  readInstruction: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    marginTop: 16,
    letterSpacing: -0.2,
  },
  markedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    alignSelf: 'flex-start',
    marginTop: 10,
  },
  markedBadgeText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  passageCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  passageContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
  },
  wordTouchable: {
    borderRadius: 4,
  },
  wordPressed: {
    backgroundColor: 'rgba(249, 115, 22, 0.1)',
  },
  passageWord: {
    fontSize: 19,
    lineHeight: 32,
    color: Colors.text,
    letterSpacing: 0.2,
  },
  passageWordTappable: {
    textDecorationLine: 'underline',
    textDecorationColor: 'rgba(249, 115, 22, 0.2)',
    textDecorationStyle: 'dotted',
  },
  passageWordMarked: {
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
    color: Colors.primaryDark,
    fontWeight: '600' as const,
    borderRadius: 3,
    overflow: 'hidden',
  },
  passageWordLearned: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    color: '#059669',
    fontWeight: '600' as const,
    borderRadius: 3,
    overflow: 'hidden',
  },
  markedList: {
    marginTop: 16,
    backgroundColor: Colors.primaryLight,
    borderRadius: 14,
    padding: 16,
  },
  markedListTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.primary,
    marginBottom: 10,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  markedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(249, 115, 22, 0.1)',
  },
  markedFrench: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.primaryDark,
  },
  markedEnglish: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  readFooter: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  readHint: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center' as const,
    marginTop: 8,
  },
  doneMarkingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 18,
    borderRadius: 16,
  },
  doneMarkingText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#fff',
  },

  phaseIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
  },
  phaseStep: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.border,
  },
  phaseStepActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  phaseStepDone: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },
  phaseStepLine: {
    width: 32,
    height: 2,
    backgroundColor: Colors.border,
  },
  phaseStepLineDone: {
    backgroundColor: Colors.success,
  },

  learnHeader: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  quizDotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
    marginTop: 12,
  },
  quizDot: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    maxWidth: 36,
  },
  quizDotDone: {
    backgroundColor: Colors.success,
  },
  quizDotActive: {
    backgroundColor: Colors.primary,
  },
  quizArea: {
    flex: 1,
  },
  quizScroll: {
    flex: 1,
  },
  quizScrollContent: {
    padding: 24,
    paddingTop: 16,
  },
  quizTypeTag: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    marginBottom: 16,
  },
  quizTypeText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  quizQuestion: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: Colors.text,
    lineHeight: 28,
    marginBottom: 24,
  },
  quizChoices: {
    gap: 10,
  },
  quizChoice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.backgroundCard,
    borderRadius: 14,
    padding: 16,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  quizChoiceSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  quizChoiceCorrect: {
    borderColor: Colors.success,
    backgroundColor: Colors.successLight,
  },
  quizChoiceIncorrect: {
    borderColor: Colors.error,
    backgroundColor: `${Colors.error}10`,
  },
  quizChoiceText: {
    fontSize: 16,
    color: Colors.text,
    flex: 1,
  },
  quizChoiceTextSelected: {
    color: Colors.primary,
    fontWeight: '500' as const,
  },
  quizChoiceTextCorrect: {
    color: Colors.success,
    fontWeight: '600' as const,
  },
  quizChoiceTextIncorrect: {
    color: Colors.error,
  },
  translationInputWrap: {
    gap: 12,
  },
  translationInput: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 14,
    padding: 16,
    fontSize: 17,
    color: Colors.text,
    borderWidth: 2,
    borderColor: Colors.border,
    minHeight: 80,
    textAlignVertical: 'top' as const,
  },
  translationInputCorrect: {
    borderColor: Colors.success,
    backgroundColor: Colors.successLight,
  },
  translationInputIncorrect: {
    borderColor: Colors.error,
    backgroundColor: `${Colors.error}10`,
  },
  correctAnswerBox: {
    backgroundColor: Colors.successLight,
    borderRadius: 12,
    padding: 14,
  },
  correctAnswerLabel: {
    fontSize: 12,
    color: Colors.success,
    marginBottom: 4,
  },
  correctAnswerText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.success,
  },
  quizFeedback: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 20,
  },
  feedbackIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedbackText: {
    fontSize: 15,
    fontWeight: '600' as const,
    flex: 1,
  },
  quizHintRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 16,
    backgroundColor: Colors.backgroundSecondary,
    padding: 12,
    borderRadius: 10,
  },
  quizHintText: {
    flex: 1,
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  quizFooter: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  quizCheckButton: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
  },
  quizCheckButtonDisabled: {
    backgroundColor: Colors.border,
  },
  quizCheckButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#fff',
  },
  quizNextButton: {
    flexDirection: 'row',
    backgroundColor: Colors.success,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  quizNextButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#fff',
  },

  rereadTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
    marginTop: 16,
    letterSpacing: -0.3,
  },
  rereadSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginTop: 6,
  },
  learnedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.successLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    alignSelf: 'flex-start',
    marginTop: 10,
  },
  learnedBadgeText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.success,
  },
  rereadFooter: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  understandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.success,
    paddingVertical: 18,
    borderRadius: 16,
  },
  understandButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#fff',
  },
  markMoreHint: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  markMoreText: {
    fontSize: 13,
    color: Colors.textMuted,
  },

  completeScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 28,
  },
  completeContent: {
    alignItems: 'center',
  },
  completeStatsCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    width: '100%',
    marginTop: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  completeBigNumber: {
    fontSize: 56,
    fontWeight: '800' as const,
    color: Colors.primary,
    letterSpacing: -2,
  },
  completeStatsLabel: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  completeStatsDivider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    width: '80%',
    marginVertical: 16,
  },
  completeStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
  },
  completeStat: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  completeStatNumber: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  completeStatLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  completeStatSep: {
    width: 1,
    height: 32,
    backgroundColor: Colors.border,
  },
  completeTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.text,
    marginTop: 28,
    textAlign: 'center' as const,
    letterSpacing: -0.3,
  },
  completeMessage: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    lineHeight: 22,
    marginTop: 10,
    paddingHorizontal: 8,
  },
  completeSavedNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 20,
  },
  completeSavedText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.primary,
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 16,
    marginTop: 28,
    width: '100%',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  completeButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: '#fff',
  },

  tooltipOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
    zIndex: 100,
  },
  tooltipCard: {
    backgroundColor: Colors.backgroundCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
  },
  tooltipHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 12,
    marginBottom: 10,
  },
  tooltipFrench: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  tooltipEnglish: {
    fontSize: 17,
    color: Colors.textSecondary,
  },
  tooltipExplanation: {
    fontSize: 15,
    color: Colors.text,
    lineHeight: 22,
    marginBottom: 14,
  },
  tooltipExample: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  tooltipExampleFrench: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.text,
    fontStyle: 'italic',
    marginBottom: 4,
  },
  tooltipExampleEnglish: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  tooltipDismiss: {
    alignSelf: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 12,
  },
  tooltipDismissText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#fff',
  },
});
