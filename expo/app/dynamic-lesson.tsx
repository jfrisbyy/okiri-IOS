import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Animated,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { safeGoBack } from '@/utils/navigation';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  X,
  Check,
  ArrowRight,
  Lightbulb,
  Award,
  Volume2,
  VolumeX,
  Brain,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { USE_NATIVE_DRIVER } from '@/constants/animation';
import { useApp } from '@/contexts/AppContext';
import { DynamicLessonTeachItem } from '@/types';
import { analyzeGapConcepts } from '@/utils/gapAnalyzer';
import {
  initializeLesson,
  getNextQuestion,
  processConceptAnswer,
  isLessonComplete,
  checkQuestionAnswer,
  normalizeText,
  getQuestionTypeLabel,
  getMasteredCount,
  MASTERY_THRESHOLD,
  MAX_QUESTIONS_LIMIT,
} from '@/utils/masteryEngine';
import type {
  ConceptMasteryItem,
  EngagingQuestion,
  EngagingQuestionType,
  LessonIntro,
} from '@/utils/masteryEngine';
import { useFrenchAudio } from '@/hooks/useFrenchAudio';
import { useMuteToggle } from '@/hooks/useMuteToggle';
import AudioSpeakerButton from '@/components/AudioSpeakerButton';
import { audioService } from '@/utils/audioService';

import WildEncounterBadge from '@/components/WildEncounterBadge';
import { getRecentEncounters, EncounterFrequency } from '@/utils/crossTabTracker';
import { LessonSkeleton } from '@/components/SkeletonLoader';
import type { WildEncounterInfo } from '@/types';
import SentenceBuildExercise from '@/components/SentenceBuildExercise';
import WordOrderExercise from '@/components/WordOrderExercise';
import SpotTheErrorExercise from '@/components/SpotTheErrorExercise';
import TrueFalseExercise from '@/components/TrueFalseExercise';
import MatchPairsExercise from '@/components/MatchPairsExercise';
import TranslationExercise from '@/components/TranslationExercise';
import ListenAndType from '@/components/exercises/ListenAndType';
import SpeakToAnswer from '@/components/exercises/SpeakToAnswer';
import SoundToLetterExercise from '@/components/exercises/SoundToLetterExercise';
import LetterToSoundExercise from '@/components/exercises/LetterToSoundExercise';
import AlphabetSequenceExercise from '@/components/exercises/AlphabetSequenceExercise';
import FeedbackBanner from '@/components/FeedbackBanner';
import ConceptTeachCard from '@/components/ConceptTeachCard';
import LessonProgressBar from '@/components/LessonProgressBar';
import LessonSummary from '@/components/LessonSummary';
import XPCounter from '@/components/XPCounter';
import HeartsDisplay from '@/components/HeartsDisplay';
import PersonalBestChallenge from '@/components/PersonalBestChallenge';
import LessonIntroCard from '@/components/LessonIntroCard';
import type { GapItem } from '@/types';
import { evaluateAndAdapt, SessionError } from '@/utils/adaptiveRegeneration';
import { classifyError } from '@/utils/errorClassifier';
import { validateQuestion } from '@/utils/questionValidator';
import { badgeText } from '@/utils/adaptiveSelector';
import { getTopConfusionPairs } from '@/utils/confusionModel';
import { isGapEligibleForReExposure } from '@/utils/contextReExposure';


type LessonPhase = 'loading' | 'challenge' | 'intro' | 'teaching' | 'practice' | 'complete';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function isQuestionRenderable(question: any, expectedType?: string): boolean {
  if (!question || typeof question !== 'object') return false;
  const type = expectedType || question.type;
  if (!type) return false;

  switch (type) {
    case 'multiple_choice':
      return !!question.content && typeof question.content === 'string' && question.content.length > 0
        && Array.isArray(question.choices) && question.choices.length >= 2
        && typeof question.correctAnswer === 'string';
    case 'fill_blank':
      return !!question.content && typeof question.content === 'string' && question.content.length > 0
        && question.correctAnswer != null;
    case 'true_false':
      return !!(question.statement || question.content)
        && typeof (question.statement || question.content) === 'string'
        && (question.statement || question.content).length > 0
        && (question.correctAnswer === 'true' || question.correctAnswer === 'false'
          || question.isTrue === true || question.isTrue === false);
    case 'word_order':
      return !!question.content && typeof question.content === 'string'
        && (Array.isArray(question.scrambledWords) && question.scrambledWords.length >= 2
          || Array.isArray(question.words) && question.words.length >= 2);
    case 'translation':
      return !!question.content && typeof question.content === 'string' && question.content.length > 0
        && question.correctAnswer != null;
    case 'production':
      return !!question.content && typeof question.content === 'string' && question.content.length > 0;
    case 'spot_the_error':
      return !!(question.errorSentence || question.content)
        && typeof (question.errorSentence || question.content) === 'string'
        && (question.errorSentence || question.content).length > 0;
    case 'match_pairs':
      return Array.isArray(question.pairs) && question.pairs.length >= 2;
    case 'sentence_build':
      return !!question.content && typeof question.content === 'string'
        && (Array.isArray(question.wordBank) && question.wordBank.length >= 2
          || Array.isArray(question.words) && question.words.length >= 2);
    case 'listen_type':
      return !!(question.audioText || question.content || question.correctAnswer)
        && question.correctAnswer != null;
    case 'speak_to_answer':
      return !!question.content && typeof question.content === 'string' && question.content.length > 0;
    case 'sound_to_letter':
      return !!(question.audioText || question.content)
        && Array.isArray(question.choices) && question.choices.length >= 2;
    case 'letter_to_sound':
      return !!question.content && typeof question.content === 'string'
        && Array.isArray(question.choices) && question.choices.length >= 2;
    case 'alphabet_sequence':
      return Array.isArray(question.sequence) && question.sequence.length >= 2
        && question.correctAnswer != null;
    default:
      return false;
  }
}

const TYPE_COLORS: Record<EngagingQuestionType, { color: string; bg: string }> = {
  multiple_choice: { color: '#4338CA', bg: '#EEF2FF' },
  fill_blank: { color: '#0D9488', bg: '#F0FDFA' },
  word_order: { color: '#7C3AED', bg: '#F5F3FF' },
  match_pairs: { color: '#D97706', bg: '#FFFBEB' },
  listen_type: { color: '#DC2626', bg: '#FEF2F2' },
  speak_to_answer: { color: '#7C3AED', bg: '#F5F3FF' },
  sentence_build: { color: '#2563EB', bg: '#EFF6FF' },
  translation: { color: '#059669', bg: '#ECFDF5' },
  production: { color: '#9333EA', bg: '#FAF5FF' },
  spot_the_error: { color: '#E11D48', bg: '#FFF1F2' },
  true_false: { color: '#0369A1', bg: '#F0F9FF' },
  sound_to_letter: { color: '#2563EB', bg: '#EFF6FF' },
  letter_to_sound: { color: '#EA580C', bg: '#FFF7ED' },
  alphabet_sequence: { color: '#0D9488', bg: '#F0FDFA' },
};

export default function DynamicLessonScreen() {
  const { clusterIndex } = useLocalSearchParams<{ clusterIndex: string }>();
  const router = useRouter();
  const { gaps, recordGapAttempt, gameState, awardXP, loseHeart, updatePersonalBest, trackExerciseResult, adaptiveProfile } = useApp();
  const { speak: _speak } = useFrenchAudio();
  const { isMuted, toggleMute } = useMuteToggle();

  const [phase, setPhase] = useState<LessonPhase>('loading');
  const [error, setError] = useState<string | null>(null);
  const [concepts, setConcepts] = useState<ConceptMasteryItem[]>([]);
  const [introData, setIntroData] = useState<LessonIntro | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<EngagingQuestion | null>(null);

  const [teachItems, setTeachItems] = useState<DynamicLessonTeachItem[]>([]);
  const [teachIndex, setTeachIndex] = useState(0);

  const [questionsAnswered, setQuestionsAnswered] = useState(0);
  const [totalCorrect, setTotalCorrect] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [answerState, setAnswerState] = useState<'pending' | 'correct' | 'incorrect'>('pending');
  const [showFeedback, setShowFeedback] = useState(false);
  const [lastFormatUsed, setLastFormatUsed] = useState<EngagingQuestionType | null>(null);
  const [justMasteredLabel, setJustMasteredLabel] = useState<string | null>(null);
  const [_gapMasteredCount, setGapMasteredCount] = useState(0);
  const [questionResults, setQuestionResults] = useState<boolean[]>([]);
  const [totalQuestionsEstimate, setTotalQuestionsEstimate] = useState(10);

  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [textAnswer, setTextAnswer] = useState('');
  const [_audioPlayed, _setAudioPlayed] = useState(false);
  const [sessionXP, setSessionXP] = useState(0);

  const [previousBest, setPreviousBest] = useState<{ bestAccuracy: number; bestStreak: number } | null>(null);
  const [hasChallenge, setHasChallenge] = useState(false);
  const [gapSources, setGapSources] = useState<{ gapId: string; french: string; english: string; sourceType: GapItem['sourceType']; sourceContentId?: string }[]>([]);
  const [crossTabEncounters, setCrossTabEncounters] = useState<EncounterFrequency[]>([]);
  const [connectedWordsCount, setConnectedWordsCount] = useState(0);
  const connectedWordsRef = useRef(0);
  const sessionErrorsRef = useRef<SessionError[]>([]);
  const priorityQueueRef = useRef<EngagingQuestion[]>([]);

  const conceptsRef = useRef<ConceptMasteryItem[]>([]);
  const streakRef = useRef(0);
  const maxStreakRef = useRef(0);
  const questionsRef = useRef(0);
  const totalCorrectRef = useRef(0);
  const pbProcessedRef = useRef(false);

  const slideOutAnim = useRef(new Animated.Value(0)).current;
  const slideInAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const streakScale = useRef(new Animated.Value(1)).current;
  const masteredOpacity = useRef(new Animated.Value(0)).current;
  const masteredScale = useRef(new Animated.Value(0.8)).current;
  const completeFade = useRef(new Animated.Value(0)).current;
  const completeScale = useRef(new Animated.Value(0.85)).current;
  const loadingPulse = useRef(new Animated.Value(0.6)).current;

  const clusters = useMemo(() => analyzeGapConcepts(gaps), [gaps]);

  const adaptiveBadgeLabel = useMemo(() => {
    const clusterGaps = gaps.filter(g => !g.masteredAt);
    const confusion = getTopConfusionPairs(clusterGaps, 1);
    const reExp = clusterGaps.filter(isGapEligibleForReExposure);
    if (confusion.length > 0) return badgeText('targeting_confusion');
    if (reExp.length > 0) return badgeText('wild_callback');
    if (adaptiveProfile.thetaSamples > 5) return badgeText('tuned_to_level');
    return undefined;
  }, [gaps, adaptiveProfile]);
  const cluster = useMemo(() => {
    const idx = parseInt(clusterIndex || '0', 10);
    return clusters[idx] || null;
  }, [clusters, clusterIndex]);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(loadingPulse, { toValue: 1, duration: 800, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(loadingPulse, { toValue: 0.6, duration: 800, useNativeDriver: USE_NATIVE_DRIVER }),
      ])
    ).start();
  }, [loadingPulse]);

  useEffect(() => {
    if (!cluster) {
      setError('Could not find the lesson concept. Please go back and try again.');
      return;
    }

    console.log('[DynamicLesson] Initializing lesson for:', cluster.name);
    const result = initializeLesson(cluster, gaps);

    if (!result) {
      setError('No active gaps for this concept. Try adding more gaps first.');
      return;
    }

    setConcepts(result.concepts);
    conceptsRef.current = result.concepts;
    setIntroData(result.intro);

    const sources = result.concepts.map((c) => {
      const gap = gaps.find(g => g.id === c.relatedGapId);
      return {
        gapId: c.relatedGapId || c.id,
        french: c.french,
        english: c.english,
        sourceType: (gap?.sourceType || 'foundation') as GapItem['sourceType'],
        sourceContentId: gap?.sourceContentId,
      };
    });
    setGapSources(sources);
    console.log('[DynamicLesson] Gap sources:', sources.map(s => `${s.french} (${s.sourceType})`));

    const generated: DynamicLessonTeachItem[] = result.concepts.slice(0, 4).map((c) => ({
      type: 'explanation' as const,
      content: c.explanation || `"${c.french}" means "${c.english}".`,
      french: c.exampleSentence || c.french,
      english: c.exampleTranslation || c.english,
    }));
    setTeachItems(generated);

    const estimatedTotal = Math.max(result.concepts.length * MASTERY_THRESHOLD, 8);
    setTotalQuestionsEstimate(Math.min(estimatedTotal, MAX_QUESTIONS_LIMIT));

    const clusterKey = cluster.name.toLowerCase().replace(/\s+/g, '_');
    const existingBest = gameState.personalBests[clusterKey];
    if (existingBest && existingBest.bestAccuracy > 0) {
      setPreviousBest(existingBest);
      setHasChallenge(true);
      setPhase('challenge');
      console.log('[DynamicLesson] Personal best found for', clusterKey, existingBest);
    } else {
      setPreviousBest(null);
      setHasChallenge(false);
      setPhase('intro');
    }
    animateIn();

    getRecentEncounters(14).then(enc => {
      setCrossTabEncounters(enc);
      console.log('[DynamicLesson] Loaded', enc.length, 'cross-tab encounters for badge matching');
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cluster]);

  const animateIn = useCallback(() => {
    fadeAnim.setValue(0);
    slideAnim.setValue(20);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.timing(slideAnim, { toValue: 0, duration: 250, useNativeDriver: USE_NATIVE_DRIVER }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const animateSlideTransition = useCallback((onMidpoint: () => void) => {
    slideOutAnim.setValue(0);
    slideInAnim.setValue(SCREEN_WIDTH);

    Animated.timing(slideOutAnim, {
      toValue: -SCREEN_WIDTH,
      duration: 200,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start(() => {
      onMidpoint();
      Animated.spring(slideInAnim, {
        toValue: 0,
        friction: 12,
        tension: 80,
        useNativeDriver: USE_NATIVE_DRIVER,
      }).start();
    });
  }, [slideOutAnim, slideInAnim]);

  const animateStreak = useCallback(() => {
    Animated.sequence([
      Animated.spring(streakScale, { toValue: 1.4, friction: 3, tension: 200, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.spring(streakScale, { toValue: 1, friction: 5, tension: 100, useNativeDriver: USE_NATIVE_DRIVER }),
    ]).start();
  }, [streakScale]);

  const showMasteryCelebration = useCallback((label: string) => {
    setJustMasteredLabel(label);
    masteredOpacity.setValue(0);
    masteredScale.setValue(0.8);
    Animated.parallel([
      Animated.timing(masteredOpacity, { toValue: 1, duration: 200, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.spring(masteredScale, { toValue: 1, friction: 5, tension: 100, useNativeDriver: USE_NATIVE_DRIVER }),
    ]).start(() => {
      setTimeout(() => {
        Animated.timing(masteredOpacity, { toValue: 0, duration: 300, useNativeDriver: USE_NATIVE_DRIVER }).start(() => {
          setJustMasteredLabel(null);
        });
      }, 1200);
    });
  }, [masteredOpacity, masteredScale]);

  const resetQuestionState = useCallback(() => {
    setSelectedChoice(null);
    setTextAnswer('');
    _setAudioPlayed(false);
    setAnswerState('pending');
    setShowFeedback(false);
  }, []);

  const loadQuestion = useCallback((question: EngagingQuestion) => {
    resetQuestionState();
    setCurrentQuestion(question);
    slideOutAnim.setValue(0);
    slideInAnim.setValue(0);
  }, [resetQuestionState, slideOutAnim, slideInAnim]);

  const getValidNextQuestion = useCallback((lastFormat: EngagingQuestionType | null, answered: number): EngagingQuestion | null => {
    let attempts = 0;
    const maxAttempts = 20;
    while (attempts < maxAttempts) {
      const candidate = getNextQuestion(conceptsRef.current, lastFormat, answered);
      if (!candidate) return null;
      const valid = validateQuestion(candidate);
      if (valid) return valid;
      console.warn('[DynamicLesson] Skipping invalid question, trying next...');
      attempts++;
    }
    return null;
  }, []);

  const startPractice = useCallback(() => {
    const firstQ = getValidNextQuestion(null, 0);
    if (!firstQ) {
      setError('Could not generate questions for this lesson.');
      return;
    }
    setLastFormatUsed(firstQ.type);
    setPhase('practice');
    loadQuestion(firstQ);
  }, [loadQuestion, getValidNextQuestion]);

  const handleChallengeAccepted = useCallback(() => {
    setPhase('intro');
    animateIn();
  }, [animateIn]);

  const handleStartLesson = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (teachItems.length > 0) {
      setTeachIndex(0);
      setPhase('teaching');
      animateIn();
    } else {
      startPractice();
    }
  }, [teachItems, animateIn, startPractice]);

  const handleTeachContinue = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const nextIdx = teachIndex + 1;
    if (nextIdx >= teachItems.length) {
      startPractice();
    } else {
      animateSlideTransition(() => {
        setTeachIndex(nextIdx);
      });
    }
  }, [teachIndex, teachItems, startPractice, animateSlideTransition]);

  const advanceToNextQuestion = useCallback(() => {
    const answered = questionsRef.current;
    if (isLessonComplete(conceptsRef.current, answered)) {
      setPhase('complete');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Animated.parallel([
        Animated.timing(completeFade, { toValue: 1, duration: 400, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.spring(completeScale, { toValue: 1, friction: 8, tension: 40, useNativeDriver: USE_NATIVE_DRIVER }),
      ]).start();
      return;
    }

    const nextQ = getValidNextQuestion(lastFormatUsed, answered);
    if (!nextQ) {
      setPhase('complete');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Animated.parallel([
        Animated.timing(completeFade, { toValue: 1, duration: 400, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.spring(completeScale, { toValue: 1, friction: 8, tension: 40, useNativeDriver: USE_NATIVE_DRIVER }),
      ]).start();
      return;
    }

    setLastFormatUsed(nextQ.type);
    animateSlideTransition(() => {
      loadQuestion(nextQ);
    });
  }, [lastFormatUsed, loadQuestion, completeFade, completeScale, animateSlideTransition, getValidNextQuestion]);

  const recordAnswer = useCallback(async (isCorrect: boolean, question: EngagingQuestion, userAnswer?: string) => {
    const errorType = !isCorrect && userAnswer
      ? classifyError(userAnswer, question.correctAnswer, question.type)
      : 'unknown';

    sessionErrorsRef.current.push({
      errorType: !isCorrect ? errorType : 'unknown',
      wrongAnswer: userAnswer || '',
      correctAnswer: question.correctAnswer,
      questionType: question.type,
      conceptId: question.conceptId,
      isCorrect,
    });
    console.log('[DynamicLesson] Session errors count:', sessionErrorsRef.current.length, 'last:', isCorrect ? 'correct' : errorType);
    questionsRef.current += 1;
    setQuestionsAnswered(questionsRef.current);
    setQuestionResults(prev => [...prev, isCorrect]);

    if (isCorrect) {
      totalCorrectRef.current += 1;
      setTotalCorrect(totalCorrectRef.current);
      streakRef.current += 1;
      setStreak(streakRef.current);
      if (streakRef.current > maxStreakRef.current) {
        maxStreakRef.current = streakRef.current;
        setMaxStreak(maxStreakRef.current);
      }
      animateStreak();

      const comboMult = streakRef.current >= 3 ? 2 : 1;
      const xpEarned = 10 * comboMult;
      awardXP(xpEarned);
      setSessionXP(prev => prev + xpEarned);
      console.log('[DynamicLesson] Awarded XP:', xpEarned, 'combo:', comboMult, 'sessionTotal:', sessionXP + xpEarned);
    } else {
      streakRef.current = 0;
      setStreak(0);
      loseHeart();
      console.log('[DynamicLesson] Lost heart, remaining:', gameState.hearts - 1);
    }

    const involvedIds = question.involvedConceptIds || [question.conceptId];
    for (const cid of involvedIds) {
      const { newlyMastered, conceptLabel } = processConceptAnswer(
        conceptsRef.current, cid, isCorrect,
        !isCorrect ? userAnswer : undefined,
        !isCorrect ? question.type : undefined,
      );
      if (newlyMastered) {
        showMasteryCelebration(conceptLabel);
      }
    }
    setConcepts([...conceptsRef.current]);

    for (const cid of involvedIds) {
      const concept = conceptsRef.current.find(c => c.id === cid);
      const gapId = question.relatedGapId || concept?.relatedGapId;
      if (gapId) {
        try {
          const result = await recordGapAttempt(gapId, isCorrect, {
            exerciseType: question.type as any,
            pickedText: !isCorrect ? userAnswer : undefined,
            wasReExposure: Boolean(question.wildEncounter),
          });
          if (result.newlyMastered) {
            setGapMasteredCount(prev => prev + 1);
          }
        } catch (e) {
          console.error('[DynamicLesson] recordGapAttempt error:', e);
        }
      }
    }
  }, [recordGapAttempt, animateStreak, showMasteryCelebration, awardXP, loseHeart, gameState.hearts, sessionXP]);

  const handleCheckAnswer = useCallback(async () => {
    if (!currentQuestion || answerState !== 'pending') return;

    let userAnswer = '';
    switch (currentQuestion.type) {
      case 'multiple_choice':
        userAnswer = selectedChoice || '';
        break;
      case 'fill_blank':
      case 'production':
        userAnswer = textAnswer;
        break;
      default:
        return;
    }

    if (!userAnswer.trim()) return;

    const isCorrect = checkQuestionAnswer(currentQuestion, userAnswer);
    setAnswerState(isCorrect ? 'correct' : 'incorrect');
    setShowFeedback(true);

    if (isCorrect) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }

    if (currentQuestion.type === 'fill_blank' && !isMuted && currentQuestion.audioText) {
      audioService.playFrenchAudio(currentQuestion.audioText).catch(() => {});
    }

    trackExerciseResult(currentQuestion.type, isCorrect);
    await recordAnswer(isCorrect, currentQuestion, userAnswer);
  }, [currentQuestion, selectedChoice, textAnswer, answerState, recordAnswer, trackExerciseResult, isMuted]);

  const handleDelegatedAnswer = useCallback((isCorrect: boolean, userAnswer?: string) => {
    if (!currentQuestion) return;
    setAnswerState(isCorrect ? 'correct' : 'incorrect');
    setShowFeedback(true);
    trackExerciseResult(currentQuestion.type, isCorrect);
    void recordAnswer(isCorrect, currentQuestion, userAnswer);
  }, [currentQuestion, recordAnswer, trackExerciseResult]);

  const handleFeedbackContinue = useCallback(async () => {
    setShowFeedback(false);

    const conceptId = currentQuestion?.conceptId || cluster?.id || '';
    const remainingEstimate = Math.max(0, totalQuestionsEstimate - questionsRef.current);

    try {
      const adaptation = await evaluateAndAdapt(
        sessionErrorsRef.current,
        remainingEstimate,
        conceptId,
      );

      if (adaptation) {
        if (adaptation.type === 'skip_easy' && adaptation.skipCount && adaptation.skipCount > 0) {
          console.log('[DynamicLesson] Adaptive: skipping', adaptation.skipCount, 'easy questions');
        } else if (adaptation.questions && adaptation.questions.length > 0) {
          console.log('[DynamicLesson] Adaptive: injecting', adaptation.questions.length, adaptation.type, 'questions');
          priorityQueueRef.current.push(...adaptation.questions);
        }
      }
    } catch (e) {
      console.warn('[DynamicLesson] Adaptive evaluation failed, continuing normally:', e);
    }

    while (priorityQueueRef.current.length > 0) {
      const candidate = priorityQueueRef.current.shift()!;
      const validPQ = validateQuestion(candidate);
      if (validPQ) {
        setLastFormatUsed(validPQ.type);
        animateSlideTransition(() => {
          loadQuestion(validPQ);
        });
        return;
      }
      console.warn('[DynamicLesson] Skipping invalid priority queue question');
    }

    advanceToNextQuestion();
  }, [advanceToNextQuestion, currentQuestion, cluster, totalQuestionsEstimate, animateSlideTransition, loadQuestion]);

  const handleClose = useCallback(() => {
    safeGoBack();
  }, []);

  const handleGoHome = useCallback(() => {
    router.replace('/(tabs)/home' as any);
  }, [router]);

  const _masteredCount = useMemo(() => getMasteredCount(concepts), [concepts]);

  const currentWildEncounter = useMemo((): WildEncounterInfo | undefined => {
    if (!currentQuestion || crossTabEncounters.length === 0) return undefined;

    const wordsToCheck: string[] = [];
    if (currentQuestion.relatedGapId || currentQuestion.conceptId) {
      const concept = concepts.find(c => c.relatedGapId === currentQuestion.relatedGapId || c.id === currentQuestion.conceptId);
      if (concept) {
        wordsToCheck.push(concept.french.toLowerCase().replace(/[^a-z\u00e0\u00e2\u00e4\u00e9\u00e8\u00ea\u00eb\u00ef\u00ee\u00f4\u00f9\u00fb\u00fc\u00ff\u00e7\u0153\u00e6]/g, ''));
      }
    }
    const answerWords = currentQuestion.correctAnswer.split(/\s+/).filter(w => w.length > 3);
    for (const w of answerWords) {
      wordsToCheck.push(w.toLowerCase().replace(/[^a-z\u00e0\u00e2\u00e4\u00e9\u00e8\u00ea\u00eb\u00ef\u00ee\u00f4\u00f9\u00fb\u00fc\u00ff\u00e7\u0153\u00e6]/g, ''));
    }

    for (const enc of crossTabEncounters) {
      const encWord = enc.word.toLowerCase().replace(/[^a-z\u00e0\u00e2\u00e4\u00e9\u00e8\u00ea\u00eb\u00ef\u00ee\u00f4\u00f9\u00fb\u00fc\u00ff\u00e7\u0153\u00e6]/g, '');
      if (wordsToCheck.includes(encWord)) {
        const daysAgo = Math.max(0, Math.floor((Date.now() - new Date(enc.lastSeen).getTime()) / (1000 * 60 * 60 * 24)));
        return {
          sourceTab: enc.sources[0],
          context: enc.contexts[0] || '',
          daysAgo,
          contentId: enc.word,
        };
      }
    }
    return undefined;
  }, [currentQuestion, crossTabEncounters, concepts]);

  useEffect(() => {
    if (currentWildEncounter && currentQuestion) {
      connectedWordsRef.current++;
      setConnectedWordsCount(connectedWordsRef.current);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestion?.id, currentWildEncounter]);

  useEffect(() => {
    if (phase !== 'practice' || !currentQuestion || answerState !== 'pending') return;
    if (!isQuestionRenderable(currentQuestion, currentQuestion.type)) {
      console.warn('[DefensiveRender] Skipping malformed question:', currentQuestion.type, currentQuestion.id);
      const timer = setTimeout(() => {
        advanceToNextQuestion();
      }, 0);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestion?.id, phase, answerState]);

  const canCheck = useMemo(() => {
    if (!currentQuestion || answerState !== 'pending') return false;
    switch (currentQuestion.type) {
      case 'multiple_choice':
        return !!selectedChoice;
      case 'fill_blank':
      case 'production':
        return textAnswer.trim().length > 0;
      default:
        return false;
    }
  }, [currentQuestion, answerState, selectedChoice, textAnswer]);

  const needsInlineCheck = useMemo(() => {
    if (!currentQuestion) return false;
    return ['multiple_choice', 'fill_blank', 'production'].includes(currentQuestion.type);
  }, [currentQuestion]);

  if (phase === 'loading') {
    if (error) {
      return (
        <View style={styles.container}>
          <Stack.Screen options={{ headerShown: false }} />
          <SafeAreaView style={styles.safeArea}>
            <Pressable style={styles.closeBtn} onPress={handleClose}>
              <X size={22} color={Colors.textSecondary} />
            </Pressable>
            <View style={styles.loadingContainer}>
              <View style={styles.loadingIcon}>
                <Brain size={40} color="#F97316" />
              </View>
              <Text style={styles.loadingTitle}>Oops</Text>
              <Text style={styles.loadingSubtitle}>{error}</Text>
              <Pressable style={styles.errorBtn} onPress={handleClose}>
                <Text style={styles.errorBtnText}>Go Back</Text>
              </Pressable>
            </View>
          </SafeAreaView>
        </View>
      );
    }
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.safeArea}>
          <Pressable style={styles.closeBtn} onPress={handleClose}>
            <X size={22} color={Colors.textSecondary} />
          </Pressable>
          <LessonSkeleton />
        </SafeAreaView>
      </View>
    );
  }

  if (phase === 'challenge' && previousBest) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.safeArea}>
          <Pressable style={styles.closeBtn} onPress={handleClose}>
            <X size={22} color={Colors.textSecondary} />
          </Pressable>
          <PersonalBestChallenge
            conceptName={cluster?.name || 'this concept'}
            previousBestAccuracy={previousBest.bestAccuracy}
            previousBestStreak={previousBest.bestStreak}
            onAccept={handleChallengeAccepted}
          />
        </SafeAreaView>
      </View>
    );
  }

  if (phase === 'intro' && introData) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.safeArea}>
          <Pressable style={styles.closeBtn} onPress={handleClose}>
            <X size={22} color={Colors.textSecondary} />
          </Pressable>
          <LessonIntroCard
            title={introData.title}
            description={introData.description}
            gapSources={gapSources}
            onStart={handleStartLesson}
            adaptiveBadge={adaptiveBadgeLabel}
          />
        </SafeAreaView>
      </View>
    );
  }

  if (phase === 'teaching' && teachItems.length > 0) {
    const currentTeach = teachItems[teachIndex];
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.topBar}>
            <Pressable style={styles.closeBtn} onPress={handleClose}>
              <X size={20} color={Colors.textSecondary} />
            </Pressable>
            <View style={styles.progressBarWrap}>
              <View style={styles.teachProgressRow}>
                {teachItems.map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.teachProgressDot,
                      i <= teachIndex && styles.teachProgressDotActive,
                    ]}
                  />
                ))}
              </View>
            </View>
            <Pressable style={styles.muteBtn} onPress={toggleMute}>
              {isMuted ? (
                <VolumeX size={18} color={Colors.textMuted} />
              ) : (
                <Volume2 size={18} color={Colors.primary} />
              )}
            </Pressable>
          </View>

          <Animated.View
            style={[
              styles.teachCardWrap,
              {
                transform: [
                  { translateX: teachIndex === 0 ? 0 : slideInAnim },
                ],
              },
            ]}
          >
            {currentTeach && (
              <ConceptTeachCard
                teachItem={currentTeach}
                onContinue={handleTeachContinue}
                muted={isMuted}
              />
            )}
          </Animated.View>
        </SafeAreaView>
      </View>
    );
  }

  const handleOneMore = useCallback(() => {
    setPhase('loading');
    setQuestionsAnswered(0);
    setTotalCorrect(0);
    setStreak(0);
    setMaxStreak(0);
    setQuestionResults([]);
    setGapMasteredCount(0);
    setSessionXP(0);
    setConnectedWordsCount(0);
    connectedWordsRef.current = 0;
    sessionErrorsRef.current = [];
    priorityQueueRef.current = [];
    pbProcessedRef.current = false;
    questionsRef.current = 0;
    totalCorrectRef.current = 0;
    streakRef.current = 0;
    maxStreakRef.current = 0;
    setCurrentQuestion(null);
    setLastFormatUsed(null);
    setTeachIndex(0);
    resetQuestionState();

    if (!cluster) return;
    const result = initializeLesson(cluster, gaps);
    if (!result) {
      setError('No active gaps for this concept.');
      return;
    }
    setConcepts(result.concepts);
    conceptsRef.current = result.concepts;
    setIntroData(result.intro);
    const generated: DynamicLessonTeachItem[] = result.concepts.slice(0, 4).map((c) => ({
      type: 'explanation' as const,
      content: c.explanation || `"${c.french}" means "${c.english}".`,
      french: c.exampleSentence || c.french,
      english: c.exampleTranslation || c.english,
    }));
    setTeachItems(generated);
    const newSources = result.concepts.map((c) => {
      const gap = gaps.find(g => g.id === c.relatedGapId);
      return {
        gapId: c.relatedGapId || c.id,
        french: c.french,
        english: c.english,
        sourceType: (gap?.sourceType || 'foundation') as GapItem['sourceType'],
        sourceContentId: gap?.sourceContentId,
      };
    });
    setGapSources(newSources);
    const estimatedTotal = Math.max(result.concepts.length * MASTERY_THRESHOLD, 8);
    setTotalQuestionsEstimate(Math.min(estimatedTotal, MAX_QUESTIONS_LIMIT));
    setPhase('intro');
    animateIn();
  }, [cluster, gaps, animateIn, resetQuestionState]);

  const completionAccuracy = useMemo(() => {
    if (phase !== 'complete') return 0;
    return questionsAnswered > 0 ? Math.round((totalCorrect / questionsAnswered) * 100) : 0;
  }, [phase, totalCorrect, questionsAnswered]);

  const completionBeatPB = useMemo(() => {
    if (phase !== 'complete') return false;
    return hasChallenge && previousBest ? completionAccuracy > previousBest.bestAccuracy : false;
  }, [phase, hasChallenge, previousBest, completionAccuracy]);

  useEffect(() => {
    if (phase !== 'complete' || pbProcessedRef.current) return;
    pbProcessedRef.current = true;

    const clusterKey = cluster?.name.toLowerCase().replace(/\s+/g, '_') || '';
    if (clusterKey) {
      updatePersonalBest(clusterKey, completionAccuracy, maxStreak);
      console.log('[DynamicLesson] Updated personal best for', clusterKey, completionAccuracy, maxStreak);
      if (completionBeatPB) {
        awardXP(25);
        setSessionXP(prev => prev + 25);
        console.log('[DynamicLesson] Personal best beaten! +25 bonus XP');
      }
    }
  }, [phase, cluster, completionAccuracy, maxStreak, completionBeatPB, updatePersonalBest, awardXP]);

  if (phase === 'complete') {
    const conceptsPracticedData = concepts.map(c => ({
      label: `${c.french} — ${c.english}`,
      mastered: c.mastered,
    }));

    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.safeArea}>
          <LessonSummary
            correctAnswers={totalCorrect}
            totalQuestions={questionsAnswered}
            maxStreak={maxStreak}
            conceptsPracticed={conceptsPracticedData}
            onContinue={handleGoHome}
            onOneMore={handleOneMore}
            sessionXP={sessionXP}
            connectedWordsCount={connectedWordsCount}
            personalBest={hasChallenge && previousBest ? {
              beaten: completionBeatPB,
              oldAccuracy: previousBest.bestAccuracy,
              newAccuracy: completionAccuracy,
              bonusXP: completionBeatPB ? 25 : 0,
            } : undefined}
          />
        </SafeAreaView>
      </View>
    );
  }

  const typeConfig = currentQuestion ? TYPE_COLORS[currentQuestion.type] || TYPE_COLORS.multiple_choice : TYPE_COLORS.multiple_choice;

  const renderDelegatedExercise = () => {
    if (!currentQuestion) return null;

    switch (currentQuestion.type) {
      case 'sentence_build':
        return (
          <SentenceBuildExercise
            words={currentQuestion.wordBank || currentQuestion.correctAnswer.split(' ')}
            correctAnswer={currentQuestion.correctAnswer}
            hint={currentQuestion.hint || ''}
            onAnswer={handleDelegatedAnswer}
            muted={isMuted}
          />
        );

      case 'word_order':
        return (
          <WordOrderExercise
            scrambledWords={currentQuestion.scrambledWords || currentQuestion.correctAnswer.split(' ')}
            correctAnswer={currentQuestion.correctAnswer}
            prompt={currentQuestion.content}
            onAnswer={handleDelegatedAnswer}
            muted={isMuted}
          />
        );

      case 'spot_the_error':
        return (
          <SpotTheErrorExercise
            errorSentence={currentQuestion.errorSentence || currentQuestion.content}
            correctedSentence={currentQuestion.correctedSentence || currentQuestion.correctAnswer}
            onAnswer={handleDelegatedAnswer}
            muted={isMuted}
          />
        );

      case 'true_false':
        return (
          <TrueFalseExercise
            statement={currentQuestion.statement || currentQuestion.content}
            isTrue={currentQuestion.isTrue ?? (currentQuestion.correctAnswer.toLowerCase() === 'true')}
            context={currentQuestion.hint || currentQuestion.explanation || ''}
            onAnswer={handleDelegatedAnswer}
            muted={isMuted}
          />
        );

      case 'match_pairs':
        return (
          <MatchPairsExercise
            pairs={(currentQuestion.pairs || []).map(p => ({ left: p.french, right: p.english }))}
            onComplete={(allCorrect) => handleDelegatedAnswer(allCorrect)}
            muted={isMuted}
          />
        );

      case 'translation':
        return (
          <TranslationExercise
            sourceText={currentQuestion.content}
            acceptableAnswers={[currentQuestion.correctAnswer]}
            onAnswer={handleDelegatedAnswer}
            muted={isMuted}
          />
        );

      case 'listen_type':
        return (
          <ListenAndType
            listenText={currentQuestion.audioText || currentQuestion.correctAnswer}
            correctAnswer={currentQuestion.correctAnswer}
            hint={currentQuestion.hint}
            onAnswer={handleDelegatedAnswer}
            muted={isMuted}
          />
        );

      case 'speak_to_answer':
        return (
          <SpeakToAnswer
            englishPrompt={currentQuestion.content}
            expectedFrench={currentQuestion.correctAnswer}
            hint={currentQuestion.hint}
            onAnswer={handleDelegatedAnswer}
            muted={isMuted}
          />
        );

      case 'sound_to_letter':
        return (
          <SoundToLetterExercise
            audioText={currentQuestion.audioText || currentQuestion.correctAnswer}
            choices={currentQuestion.choices || []}
            correctAnswer={currentQuestion.correctAnswer}
            onAnswer={handleDelegatedAnswer}
            muted={isMuted}
          />
        );

      case 'letter_to_sound':
        return (
          <LetterToSoundExercise
            content={currentQuestion.content}
            choices={currentQuestion.choices || []}
            correctAnswer={currentQuestion.correctAnswer}
            onAnswer={handleDelegatedAnswer}
            muted={isMuted}
          />
        );

      case 'alphabet_sequence':
        return (
          <AlphabetSequenceExercise
            sequence={currentQuestion.sequence || []}
            blankIndex={currentQuestion.blankIndex ?? 0}
            correctAnswer={currentQuestion.correctAnswer}
            onAnswer={handleDelegatedAnswer}
            muted={isMuted}
          />
        );

      default:
        return null;
    }
  };

  const isDelegated = currentQuestion && [
    'sentence_build', 'word_order', 'spot_the_error',
    'true_false', 'match_pairs', 'translation', 'listen_type', 'speak_to_answer',
    'sound_to_letter', 'letter_to_sound', 'alphabet_sequence',
  ].includes(currentQuestion.type);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topBar}>
          <Pressable style={styles.closeBtn} onPress={handleClose}>
            <X size={20} color={Colors.textSecondary} />
          </Pressable>

          <HeartsDisplay hearts={gameState.hearts} />

          <View style={styles.progressBarWrap}>
            <LessonProgressBar
              totalQuestions={totalQuestionsEstimate}
              currentIndex={questionsAnswered}
              results={questionResults}
            />
          </View>

          <Pressable style={styles.muteBtn} onPress={toggleMute}>
            {isMuted ? (
              <VolumeX size={16} color={Colors.textMuted} />
            ) : (
              <Volume2 size={16} color={Colors.primary} />
            )}
          </Pressable>

          <XPCounter
            xpGained={sessionXP}
            comboMultiplier={streak >= 3 ? 2 : 1}
            streak={streak}
          />
        </View>

        <View style={styles.conceptDots}>
          {concepts.map(c => (
            <View
              key={c.id}
              style={[
                styles.conceptDot,
                c.mastered && styles.conceptDotMastered,
                currentQuestion?.conceptId === c.id && !c.mastered && styles.conceptDotActive,
                currentQuestion?.involvedConceptIds?.includes(c.id) && !c.mastered && styles.conceptDotActive,
              ]}
            >
              {c.mastered && <Check size={8} color="#fff" />}
            </View>
          ))}
        </View>

        {currentQuestion && (
          <Animated.View
            style={[
              styles.questionWrap,
              {
                transform: [{ translateX: slideInAnim }],
              },
            ]}
          >
            <ScrollView
              style={styles.questionScroll}
              contentContainerStyle={styles.questionScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={[styles.typeBadge, { backgroundColor: typeConfig.bg }]}>
                <Text style={[styles.typeBadgeText, { color: typeConfig.color }]}>
                  {getQuestionTypeLabel(currentQuestion.type)}
                </Text>
              </View>

              {!isDelegated && (
                <View style={styles.questionRow}>
                  <Text style={styles.questionText}>{currentQuestion.content}</Text>
                  {currentQuestion.audioText && (
                    <AudioSpeakerButton
                      text={currentQuestion.audioText}
                      size={18}
                      color={Colors.primary}
                      muted={isMuted}
                      testID="question-audio-btn"
                    />
                  )}
                </View>
              )}

              {currentWildEncounter && (
                <WildEncounterBadge encounter={currentWildEncounter} />
              )}

              {isDelegated ? (
                renderDelegatedExercise()
              ) : (
                <>
                  {currentQuestion.type === 'multiple_choice' && currentQuestion.choices && (
                    <View style={styles.choicesWrap}>
                      {currentQuestion.choices.map((choice, idx) => {
                        const isSelected = selectedChoice === choice;
                        const isCorrectChoice = normalizeText(choice) === normalizeText(currentQuestion.correctAnswer);
                        const showCorrect = answerState !== 'pending' && isCorrectChoice;
                        const showIncorrect = answerState === 'incorrect' && isSelected && !isCorrectChoice;

                        return (
                          <Pressable
                            key={idx}
                            style={[
                              styles.choiceBtn,
                              isSelected && answerState === 'pending' && styles.choiceBtnSelected,
                              showCorrect && styles.choiceBtnCorrect,
                              showIncorrect && styles.choiceBtnIncorrect,
                            ]}
                            onPress={() => answerState === 'pending' && setSelectedChoice(choice)}
                            disabled={answerState !== 'pending'}
                          >
                            <View style={[
                              styles.choiceLetter,
                              isSelected && answerState === 'pending' && { backgroundColor: '#4338CA', borderColor: '#4338CA' },
                              showCorrect && { backgroundColor: '#10B981', borderColor: '#10B981' },
                              showIncorrect && { backgroundColor: '#EF4444', borderColor: '#EF4444' },
                            ]}>
                              <Text style={[
                                styles.choiceLetterText,
                                (isSelected || showCorrect || showIncorrect) && { color: '#fff' },
                              ]}>
                                {String.fromCharCode(65 + idx)}
                              </Text>
                            </View>
                            <Text style={[
                              styles.choiceText,
                              showCorrect && { color: '#059669', fontWeight: '600' as const },
                              showIncorrect && { color: '#DC2626' },
                            ]} numberOfLines={2}>
                              {choice}
                            </Text>
                            <AudioSpeakerButton
                              text={choice}
                              size={14}
                              color={Colors.textMuted}
                              muted={isMuted}
                            />
                            {showCorrect && <Check size={18} color="#059669" />}
                            {showIncorrect && <X size={18} color="#DC2626" />}
                          </Pressable>
                        );
                      })}
                    </View>
                  )}

                  {(currentQuestion.type === 'fill_blank' ||
                    currentQuestion.type === 'production') && (
                    <View style={styles.textInputWrap}>
                      <TextInput
                        style={[
                          styles.textInput,
                          answerState === 'correct' && styles.textInputCorrect,
                          answerState === 'incorrect' && styles.textInputIncorrect,
                        ]}
                        value={textAnswer}
                        onChangeText={setTextAnswer}
                        placeholder="Type your answer..."
                        placeholderTextColor={Colors.textMuted}
                        autoCapitalize="none"
                        autoCorrect={false}
                        editable={answerState === 'pending'}
                        multiline={currentQuestion.type === 'production'}
                      />
                      {answerState === 'incorrect' && (
                        <View style={styles.correctBox}>
                          <Text style={styles.correctLabel}>Correct answer:</Text>
                          <Text style={styles.correctText}>{currentQuestion.correctAnswer}</Text>
                        </View>
                      )}
                    </View>
                  )}
                </>
              )}

              {currentQuestion.hint && answerState === 'pending' && needsInlineCheck && (
                <View style={styles.hintRow}>
                  <Lightbulb size={14} color={Colors.textMuted} />
                  <Text style={styles.hintText}>{currentQuestion.hint}</Text>
                </View>
              )}

              {answerState === 'incorrect' && currentQuestion.explanation && needsInlineCheck && (
                <View style={styles.explanationBox}>
                  <Text style={styles.explanationText}>{currentQuestion.explanation}</Text>
                </View>
              )}
            </ScrollView>

            {needsInlineCheck && !showFeedback && (
              <View style={styles.footer}>
                {answerState === 'pending' ? (
                  <Pressable
                    style={[styles.checkBtn, !canCheck && styles.checkBtnDisabled]}
                    onPress={handleCheckAnswer}
                    disabled={!canCheck}
                  >
                    <Text style={styles.checkBtnText}>Check</Text>
                  </Pressable>
                ) : (
                  <Pressable style={styles.nextBtn} onPress={handleFeedbackContinue}>
                    <Text style={styles.nextBtnText}>
                      {isLessonComplete(conceptsRef.current, questionsRef.current) ? 'Finish' : 'Next'}
                    </Text>
                    <ArrowRight size={18} color="#fff" />
                  </Pressable>
                )}
              </View>
            )}
          </Animated.View>
        )}

        {showFeedback && currentQuestion && (
          <FeedbackBanner
            isCorrect={answerState === 'correct'}
            correctAnswer={currentQuestion.correctAnswer}
            explanation={currentQuestion.explanation || ''}
            onContinue={handleFeedbackContinue}
          />
        )}

        {justMasteredLabel && (
          <Animated.View
            style={[styles.masteredOverlay, { opacity: masteredOpacity }]}
            pointerEvents="none"
          >
            <Animated.View style={[styles.masteredCard, { transform: [{ scale: masteredScale }] }]}>
              <Award size={28} color="#10B981" />
              <Text style={styles.masteredTitle}>Mastered!</Text>
              <Text style={styles.masteredLabel}>{justMasteredLabel}</Text>
            </Animated.View>
          </Animated.View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFBFF',
  },
  safeArea: {
    flex: 1,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 16,
    marginTop: 4,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loadingIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  loadingTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  loadingSubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  errorBtn: {
    marginTop: 24,
    backgroundColor: '#F97316',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
  },
  errorBtnText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#fff',
  },
  introWrap: {
    flex: 1,
  },
  introScroll: {
    flex: 1,
  },
  introScrollContent: {
    padding: 24,
    paddingTop: 12,
  },
  introHeader: {
    alignItems: 'center',
    marginBottom: 28,
  },
  introIconBg: {
    width: 72,
    height: 72,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  introTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.text,
    textAlign: 'center' as const,
    marginBottom: 8,
  },
  introDesc: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    lineHeight: 22,
    paddingHorizontal: 12,
  },
  introStats: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 28,
  },
  introStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  introStatText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  introSectionLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.textMuted,
    letterSpacing: 1,
    marginBottom: 12,
  },
  introChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  introChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  introChipFrench: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#F97316',
    marginRight: 6,
  },
  introChipEnglish: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  introFooter: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  startBtn: {
    flexDirection: 'row',
    backgroundColor: '#F97316',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  startBtnText: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: '#fff',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 16,
    gap: 12,
    paddingVertical: 6,
  },
  progressBarWrap: {
    flex: 1,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  streakText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#D97706',
  },
  streakPlaceholder: {
    width: 44,
  },
  teachProgressRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teachProgressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E5E7EB',
  },
  teachProgressDotActive: {
    backgroundColor: '#F97316',
  },
  teachCardWrap: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  conceptDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  conceptDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  conceptDotMastered: {
    backgroundColor: '#10B981',
  },
  conceptDotActive: {
    backgroundColor: '#FDE68A',
    borderWidth: 2,
    borderColor: '#F59E0B',
  },
  questionWrap: {
    flex: 1,
  },
  questionScroll: {
    flex: 1,
  },
  questionScrollContent: {
    padding: 20,
    paddingTop: 8,
    paddingBottom: 20,
  },
  typeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    marginBottom: 14,
  },
  typeBadgeText: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  questionText: {
    fontSize: 19,
    fontWeight: '600' as const,
    color: Colors.text,
    lineHeight: 27,
    marginBottom: 20,
  },
  choicesWrap: {
    gap: 10,
  },
  choiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  choiceBtnSelected: {
    borderColor: '#4338CA',
    backgroundColor: '#EEF2FF',
  },
  choiceBtnCorrect: {
    borderColor: '#10B981',
    backgroundColor: '#ECFDF5',
  },
  choiceBtnIncorrect: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  choiceLetter: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceLetterText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#9CA3AF',
  },
  choiceText: {
    fontSize: 16,
    color: Colors.text,
    flex: 1,
  },
  textInputWrap: {
    gap: 12,
  },
  playBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#FFF7ED',
    borderRadius: 16,
    paddingVertical: 20,
    borderWidth: 2,
    borderColor: '#FFEDD5',
  },
  playBtnActive: {
    backgroundColor: '#F97316',
    borderColor: '#F97316',
  },
  playBtnText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#F97316',
  },
  textInput: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    fontSize: 18,
    color: Colors.text,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    minHeight: 56,
  },
  textInputCorrect: {
    borderColor: '#10B981',
    backgroundColor: '#ECFDF5',
  },
  textInputIncorrect: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  correctBox: {
    backgroundColor: '#ECFDF5',
    borderRadius: 12,
    padding: 14,
  },
  correctLabel: {
    fontSize: 12,
    color: '#059669',
    marginBottom: 4,
  },
  correctText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: '#059669',
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 16,
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 10,
  },
  hintText: {
    flex: 1,
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  explanationBox: {
    marginTop: 12,
    backgroundColor: '#FFF7ED',
    padding: 14,
    borderRadius: 10,
  },
  explanationText: {
    fontSize: 14,
    color: '#92400E',
    lineHeight: 20,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  checkBtn: {
    backgroundColor: '#F97316',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  checkBtnDisabled: {
    backgroundColor: '#D1D5DB',
  },
  checkBtnText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
  },
  nextBtn: {
    flexDirection: 'row',
    backgroundColor: '#10B981',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  nextBtnText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
  },
  masteredOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  masteredCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 32,
    paddingVertical: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
  masteredTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: '#10B981',
    marginTop: 8,
  },
  masteredLabel: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  muteBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  questionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 20,
  },
});
