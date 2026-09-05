import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  ScrollView,
  TextInput,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { safeGoBack } from '@/utils/navigation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import {
  X,
  Check,
  ArrowRight,
  Lightbulb,
  Award,
  Volume2,
  Flame,
  Target,
  Sparkles,
  BookOpen,
  Headphones,
  Mic,
  PenLine,
  ChevronLeft,
  Plus,
  ChevronRight,
  XCircle,
  Brain,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { USE_NATIVE_DRIVER } from '@/constants/animation';
import { useApp } from '@/contexts/AppContext';
import { foundationLessons } from '@/mocks/content';
import { useFrenchAudio } from '@/hooks/useFrenchAudio';
import { LessonPhase } from '@/types';
import { getProgressivePhases } from '@/utils/lessonPhases';
import {
  initializeFoundationMasteryLesson,
  getNextQuestion,
  processConceptAnswer,
  isLessonComplete,
  checkQuestionAnswer,
  normalizeText,
  getQuestionTypeLabel,
  getMasteredCount,
  shouldSuggestBreak,
  getSessionProgress,
  MASTERY_THRESHOLD,
} from '@/utils/masteryEngine';
import type {
  ConceptMasteryItem,
  EngagingQuestion,
  EngagingQuestionType,
  LessonIntro,
} from '@/utils/masteryEngine';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type LearnSubPhase = 'intro' | 'practice' | 'complete';

const TYPE_COLORS: Record<EngagingQuestionType, { color: string; bg: string }> = {
  multiple_choice: { color: '#4338CA', bg: '#EEF2FF' },
  fill_blank: { color: '#0D9488', bg: '#F0FDFA' },
  word_order: { color: '#7C3AED', bg: '#F5F3FF' },
  match_pairs: { color: '#D97706', bg: '#FFFBEB' },
  listen_type: { color: '#DC2626', bg: '#FEF2F2' },
  sentence_build: { color: '#2563EB', bg: '#EFF6FF' },
  translation: { color: '#059669', bg: '#ECFDF5' },
  production: { color: '#9333EA', bg: '#FAF5FF' },
  spot_the_error: { color: '#E11D48', bg: '#FFF1F2' },
  true_false: { color: '#0369A1', bg: '#F0F9FF' },
  speak_to_answer: { color: '#7C3AED', bg: '#F5F3FF' },
};

const PHASE_CONFIG: Record<LessonPhase, { label: string; color: string }> = {
  learn: { label: 'Practice', color: Colors.primary },
  listen: { label: 'Listen', color: '#8B5CF6' },
  read: { label: 'Read', color: '#10B981' },
  speak: { label: 'Speak', color: '#F59E0B' },
  write: { label: 'Write', color: '#06B6D4' },
  gap_review: { label: 'Review', color: '#EC4899' },
};

function PhaseIcon({ phase, size, color }: { phase: LessonPhase; size: number; color: string }) {
  switch (phase) {
    case 'learn': return <Brain size={size} color={color} />;
    case 'listen': return <Headphones size={size} color={color} />;
    case 'read': return <BookOpen size={size} color={color} />;
    case 'speak': return <Mic size={size} color={color} />;
    case 'write': return <PenLine size={size} color={color} />;
    case 'gap_review': return <Target size={size} color={color} />;
  }
}

export default function FoundationLessonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { addGap, completeFoundationLesson, getLessonInjection, moduleProgress, gaps } = useApp();
  const { speak, isSpeaking } = useFrenchAudio();

  const lesson = foundationLessons.find(l => l.id === id);

  const injection = useMemo(() => {
    return getLessonInjection(moduleProgress.currentModuleId);
  }, [moduleProgress.currentModuleId, getLessonInjection]);

  const phases = useMemo(() => {
    if (!lesson) return [] as LessonPhase[];
    const progressive = getProgressivePhases(lesson.order, lesson.phases);
    if (injection.totalInjected > 0 && !progressive.includes('gap_review')) {
      progressive.push('gap_review');
    }
    return progressive;
  }, [lesson, injection]);

  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0);
  const currentPhase = phases[currentPhaseIndex];
  const isLastPhase = currentPhaseIndex === phases.length - 1;

  const [learnSubPhase, setLearnSubPhase] = useState<LearnSubPhase>('intro');
  const [concepts, setConcepts] = useState<ConceptMasteryItem[]>([]);
  const [introData, setIntroData] = useState<LessonIntro | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<EngagingQuestion | null>(null);
  const [questionsAnswered, setQuestionsAnswered] = useState(0);
  const [totalCorrect, setTotalCorrect] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [answerState, setAnswerState] = useState<'pending' | 'correct' | 'incorrect'>('pending');
  const [lastFormatUsed, setLastFormatUsed] = useState<EngagingQuestionType | null>(null);
  const [justMasteredLabel, setJustMasteredLabel] = useState<string | null>(null);
  const [savedFromLearn, setSavedFromLearn] = useState<Set<string>>(new Set());
  const [sessionBreakVisible, setSessionBreakVisible] = useState(false);

  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [textAnswer, setTextAnswer] = useState('');
  const [placedWords, setPlacedWords] = useState<string[]>([]);
  const [bankWords, setBankWords] = useState<string[]>([]);
  const [pairSelection, setPairSelection] = useState<{ side: 'french' | 'english'; value: string } | null>(null);
  const [matchedFrench, setMatchedFrench] = useState<string[]>([]);
  const [audioPlayed, setAudioPlayed] = useState(false);
  const [wrongMatchCount, setWrongMatchCount] = useState(0);
  const [shuffledFrench, setShuffledFrench] = useState<{ french: string; english: string }[]>([]);
  const [shuffledEnglish, setShuffledEnglish] = useState<{ french: string; english: string }[]>([]);

  const [comprehensionAnswers, setComprehensionAnswers] = useState<Record<string, string>>({});
  const [showComprehensionResults, setShowComprehensionResults] = useState(false);
  const [speakingPromptIndex, setSpeakingPromptIndex] = useState(0);
  const [writingResponse, setWritingResponse] = useState('');
  const [writingSubmitted, setWritingSubmitted] = useState(false);
  const [listenPlayed, setListenPlayed] = useState(false);

  const conceptsRef = useRef<ConceptMasteryItem[]>([]);
  const streakRef = useRef(0);
  const maxStreakRef = useRef(0);
  const questionsRef = useRef(0);
  const totalCorrectRef = useRef(0);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const streakScale = useRef(new Animated.Value(1)).current;
  const masteredOpacity = useRef(new Animated.Value(0)).current;
  const masteredScale = useRef(new Animated.Value(0.8)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const completeFade = useRef(new Animated.Value(0)).current;
  const completeScale = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    if (!lesson) return;
    console.log('[FoundationLesson] Initializing mastery for:', lesson.title);
    const result = initializeFoundationMasteryLesson(lesson.items, lesson.title);
    if (result) {
      setConcepts(result.concepts);
      conceptsRef.current = result.concepts;
      setIntroData(result.intro);
    }
  }, [lesson]);

  const animateIn = useCallback(() => {
    fadeAnim.setValue(0);
    slideAnim.setValue(20);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.timing(slideAnim, { toValue: 0, duration: 250, useNativeDriver: USE_NATIVE_DRIVER }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const animateStreak = useCallback(() => {
    Animated.sequence([
      Animated.spring(streakScale, { toValue: 1.4, friction: 3, tension: 200, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.spring(streakScale, { toValue: 1, friction: 5, tension: 100, useNativeDriver: USE_NATIVE_DRIVER }),
    ]).start();
  }, [streakScale]);

  const animateShake = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: USE_NATIVE_DRIVER }),
    ]).start();
  }, [shakeAnim]);

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
    setPlacedWords([]);
    setBankWords([]);
    setPairSelection(null);
    setMatchedFrench([]);
    setAudioPlayed(false);
    setWrongMatchCount(0);
    setShuffledFrench([]);
    setShuffledEnglish([]);
    setAnswerState('pending');
  }, []);

  const loadQuestion = useCallback((question: EngagingQuestion) => {
    resetQuestionState();
    setCurrentQuestion(question);

    if (question.type === 'word_order' && question.scrambledWords) {
      setBankWords([...question.scrambledWords]);
    } else if (question.type === 'sentence_build' && question.wordBank) {
      setBankWords([...question.wordBank]);
    }

    if (question.type === 'match_pairs' && question.pairs) {
      const fr = [...question.pairs];
      for (let i = fr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [fr[i], fr[j]] = [fr[j], fr[i]];
      }
      const en = [...question.pairs];
      for (let i = en.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [en[i], en[j]] = [en[j], en[i]];
      }
      setShuffledFrench(fr);
      setShuffledEnglish(en);
    }

    animateIn();
  }, [resetQuestionState, animateIn]);

  const handleStartLesson = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const firstQ = getNextQuestion(conceptsRef.current, null, 0);
    if (!firstQ) return;
    setLastFormatUsed(firstQ.type);
    setLearnSubPhase('practice');
    loadQuestion(firstQ);
  }, [loadQuestion]);

  const advanceToNextQuestion = useCallback(() => {
    const answered = questionsRef.current;
    if (shouldSuggestBreak(answered, conceptsRef.current)) {
      setSessionBreakVisible(true);
      return;
    }
    if (isLessonComplete(conceptsRef.current, answered)) {
      setLearnSubPhase('complete');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      completeFade.setValue(0);
      completeScale.setValue(0.85);
      Animated.parallel([
        Animated.timing(completeFade, { toValue: 1, duration: 400, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.spring(completeScale, { toValue: 1, friction: 8, tension: 40, useNativeDriver: USE_NATIVE_DRIVER }),
      ]).start();
      return;
    }
    const nextQ = getNextQuestion(conceptsRef.current, lastFormatUsed, answered);
    if (!nextQ) {
      setLearnSubPhase('complete');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      completeFade.setValue(0);
      completeScale.setValue(0.85);
      Animated.parallel([
        Animated.timing(completeFade, { toValue: 1, duration: 400, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.spring(completeScale, { toValue: 1, friction: 8, tension: 40, useNativeDriver: USE_NATIVE_DRIVER }),
      ]).start();
      return;
    }
    setLastFormatUsed(nextQ.type);
    loadQuestion(nextQ);
  }, [lastFormatUsed, loadQuestion, completeFade, completeScale]);

  const handleCheckAnswer = useCallback(() => {
    if (!currentQuestion || answerState !== 'pending') return;

    let userAnswer = '';
    switch (currentQuestion.type) {
      case 'multiple_choice':
        userAnswer = selectedChoice || '';
        break;
      case 'fill_blank':
      case 'listen_type':
      case 'translation':
      case 'production':
        userAnswer = textAnswer;
        break;
      case 'word_order':
      case 'sentence_build':
        userAnswer = placedWords.join(' ');
        break;
      default:
        return;
    }

    if (!userAnswer.trim()) return;

    const isCorrect = checkQuestionAnswer(currentQuestion, userAnswer);
    setAnswerState(isCorrect ? 'correct' : 'incorrect');
    questionsRef.current += 1;
    setQuestionsAnswered(questionsRef.current);

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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      streakRef.current = 0;
      setStreak(0);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }

    const { newlyMastered, conceptLabel } = processConceptAnswer(
      conceptsRef.current,
      currentQuestion.conceptId,
      isCorrect
    );
    setConcepts([...conceptsRef.current]);

    if (newlyMastered) {
      showMasteryCelebration(conceptLabel);
    }
  }, [currentQuestion, selectedChoice, textAnswer, placedWords, answerState, animateStreak, showMasteryCelebration]);

  const handleMatchPairTap = useCallback((side: 'french' | 'english', value: string) => {
    if (!currentQuestion || currentQuestion.type !== 'match_pairs') return;
    if (matchedFrench.includes(value) && side === 'french') return;

    const matchedEnglish = matchedFrench.map(f => {
      const pair = currentQuestion.pairs?.find(p => p.french === f);
      return pair?.english || '';
    });
    if (matchedEnglish.includes(value) && side === 'english') return;

    if (!pairSelection) {
      setPairSelection({ side, value });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return;
    }

    if (pairSelection.side === side) {
      if (pairSelection.value === value) {
        setPairSelection(null);
      } else {
        setPairSelection({ side, value });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      return;
    }

    const frenchVal = side === 'french' ? value : pairSelection.value;
    const englishVal = side === 'english' ? value : pairSelection.value;
    const isMatch = currentQuestion.pairs?.some(p => p.french === frenchVal && p.english === englishVal);

    if (isMatch) {
      const newMatched = [...matchedFrench, frenchVal];
      setMatchedFrench(newMatched);
      setPairSelection(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      if (newMatched.length === (currentQuestion.pairs?.length || 0)) {
        setTimeout(() => handleMatchPairsComplete(), 600);
      }
    } else {
      setWrongMatchCount(prev => prev + 1);
      setPairSelection(null);
      animateShake();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [currentQuestion, pairSelection, matchedFrench, animateShake]);

  const handleMatchPairsComplete = useCallback(() => {
    if (!currentQuestion) return;
    const isCorrect = wrongMatchCount < 3;

    setAnswerState(isCorrect ? 'correct' : 'incorrect');
    questionsRef.current += 1;
    setQuestionsAnswered(questionsRef.current);

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
    } else {
      streakRef.current = 0;
      setStreak(0);
    }

    const involvedIds = currentQuestion.involvedConceptIds || [currentQuestion.conceptId];
    for (const cid of involvedIds) {
      const { newlyMastered, conceptLabel } = processConceptAnswer(conceptsRef.current, cid, isCorrect);
      if (newlyMastered) showMasteryCelebration(conceptLabel);
    }
    setConcepts([...conceptsRef.current]);
  }, [currentQuestion, wrongMatchCount, animateStreak, showMasteryCelebration]);

  const handleWordTap = useCallback((word: string, fromBank: boolean) => {
    if (answerState !== 'pending') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (fromBank) {
      const idx = bankWords.indexOf(word);
      if (idx === -1) return;
      const newBank = [...bankWords];
      newBank.splice(idx, 1);
      setBankWords(newBank);
      setPlacedWords(prev => [...prev, word]);
    } else {
      const idx = placedWords.indexOf(word);
      if (idx === -1) return;
      const newPlaced = [...placedWords];
      newPlaced.splice(idx, 1);
      setPlacedWords(newPlaced);
      setBankWords(prev => [...prev, word]);
    }
  }, [bankWords, placedWords, answerState]);

  const handleNext = useCallback(() => {
    advanceToNextQuestion();
  }, [advanceToNextQuestion]);

  const handlePlayAudio = useCallback((text?: string) => {
    const textToSpeak = text || currentQuestion?.audioText;
    if (!textToSpeak) return;
    speak(textToSpeak);
    setAudioPlayed(true);
  }, [currentQuestion, speak]);

  const handleSaveToGaps = useCallback(async (french: string, english: string) => {
    if (savedFromLearn.has(french)) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await addGap(
      french, english,
      'Foundation lesson practice',
      french, english, 'foundation', id
    );
    setSavedFromLearn(prev => new Set(prev).add(french));
  }, [addGap, id, savedFromLearn]);

  const advancePhase = useCallback(() => {
    if (isLastPhase) {
      completeFoundationLesson(id || '');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(tabs)/home' as any);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setShowComprehensionResults(false);
      setComprehensionAnswers({});
      setListenPlayed(false);
      setWritingSubmitted(false);
      setWritingResponse('');
      setSpeakingPromptIndex(0);
      fadeAnim.setValue(0);
      slideAnim.setValue(20);
      setCurrentPhaseIndex(prev => prev + 1);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: USE_NATIVE_DRIVER }),
      ]).start();
    }
  }, [isLastPhase, id, completeFoundationLesson, router, fadeAnim, slideAnim]);

  const handleComprehensionAnswer = useCallback((questionIndex: number, answer: string) => {
    setComprehensionAnswers(prev => ({ ...prev, [questionIndex.toString()]: answer }));
  }, []);

  const handleCheckComprehension = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowComprehensionResults(true);
  }, []);

  const masteredCount = useMemo(() => getMasteredCount(concepts), [concepts]);
  const progressPercent = useMemo(() => {
    if (concepts.length === 0) return 0;
    return Math.round((masteredCount / concepts.length) * 100);
  }, [masteredCount, concepts.length]);

  const canCheck = useMemo(() => {
    if (!currentQuestion || answerState !== 'pending') return false;
    switch (currentQuestion.type) {
      case 'multiple_choice':
        return !!selectedChoice;
      case 'fill_blank':
      case 'translation':
      case 'production':
        return textAnswer.trim().length > 0;
      case 'listen_type':
        return textAnswer.trim().length > 0 && audioPlayed;
      case 'word_order':
      case 'sentence_build':
        return placedWords.length > 0;
      case 'match_pairs':
        return false;
      default:
        return false;
    }
  }, [currentQuestion, answerState, selectedChoice, textAnswer, placedWords, audioPlayed]);

  if (!lesson) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.safeArea}>
          <Text style={styles.notFoundText}>Lesson not found</Text>
        </SafeAreaView>
      </View>
    );
  }

  const renderPhaseIndicator = () => (
    <View style={styles.phaseIndicator}>
      {phases.map((phase, idx) => {
        const config = PHASE_CONFIG[phase];
        const isActive = idx === currentPhaseIndex;
        const isCompleted = idx < currentPhaseIndex;
        return (
          <View key={phase + idx} style={styles.phaseStep}>
            <View style={[
              styles.phaseDot,
              isActive && { backgroundColor: config.color },
              isCompleted && { backgroundColor: Colors.success },
              !isActive && !isCompleted && { backgroundColor: Colors.border },
            ]}>
              {isCompleted ? (
                <Check size={10} color={Colors.textLight} />
              ) : (
                <PhaseIcon phase={phase} size={10} color={isActive ? Colors.textLight : Colors.textMuted} />
              )}
            </View>
            {isActive && <Text style={[styles.phaseLabel, { color: config.color }]}>{config.label}</Text>}
          </View>
        );
      })}
    </View>
  );

  const renderLearnIntro = () => {
    if (!introData) return null;
    return (
      <Animated.View style={[styles.introWrap, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <ScrollView style={styles.introScroll} contentContainerStyle={styles.introScrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.introHeader}>
            <LinearGradient
              colors={['#FFF7ED', '#FFEDD5']}
              style={styles.introIconBg}
            >
              <Brain size={32} color={Colors.primary} />
            </LinearGradient>
            <Text style={styles.introTitle}>{introData.title}</Text>
            <Text style={styles.introDesc}>{introData.description}</Text>
          </View>

          <View style={styles.introStats}>
            <View style={styles.introStatItem}>
              <Sparkles size={16} color={Colors.primary} />
              <Text style={styles.introStatText}>{introData.conceptCount} to master</Text>
            </View>
            <View style={styles.introStatItem}>
              <Award size={16} color="#10B981" />
              <Text style={styles.introStatText}>{MASTERY_THRESHOLD} correct each</Text>
            </View>
          </View>

          <Text style={styles.introSectionLabel}>WHAT YOU'LL LEARN</Text>
          <View style={styles.introChips}>
            {introData.conceptPreviews.map((preview, i) => (
              <Pressable
                key={i}
                style={styles.introChip}
                onPress={() => speak(preview.french)}
              >
                <Text style={styles.introChipFrench}>{preview.french}</Text>
                <Text style={styles.introChipEnglish}>{preview.english}</Text>
                <Volume2 size={12} color={Colors.textMuted} style={{ marginLeft: 4 }} />
              </Pressable>
            ))}
          </View>
        </ScrollView>

        <View style={styles.introFooter}>
          <Pressable style={styles.startBtn} onPress={handleStartLesson}>
            <Text style={styles.startBtnText}>Let's Go!</Text>
            <ArrowRight size={20} color="#fff" />
          </Pressable>
        </View>
      </Animated.View>
    );
  };

  const renderLearnPractice = () => {
    if (!currentQuestion) return null;
    const typeConfig = TYPE_COLORS[currentQuestion.type];

    return (
      <Animated.View style={[styles.questionWrap, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
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

          <Text style={styles.questionText}>{currentQuestion.content}</Text>

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
                    {showCorrect && <Check size={18} color="#059669" />}
                    {showIncorrect && <X size={18} color="#DC2626" />}
                  </Pressable>
                );
              })}
            </View>
          )}

          {(currentQuestion.type === 'fill_blank' ||
            currentQuestion.type === 'translation' ||
            currentQuestion.type === 'production' ||
            currentQuestion.type === 'listen_type') && (
            <View style={styles.textInputWrap}>
              {currentQuestion.type === 'listen_type' && (
                <Pressable
                  style={[styles.playBtn, isSpeaking && styles.playBtnActive]}
                  onPress={() => handlePlayAudio()}
                >
                  <Volume2 size={28} color={isSpeaking ? '#fff' : Colors.primary} />
                  <Text style={[styles.playBtnText, isSpeaking && { color: '#fff' }]}>
                    {audioPlayed ? 'Play Again' : 'Tap to Listen'}
                  </Text>
                </Pressable>
              )}
              <TextInput
                style={[
                  styles.textInput,
                  answerState === 'correct' && styles.textInputCorrect,
                  answerState === 'incorrect' && styles.textInputIncorrect,
                ]}
                value={textAnswer}
                onChangeText={setTextAnswer}
                placeholder={currentQuestion.type === 'listen_type' ? 'Type what you heard...' : 'Type your answer...'}
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

          {(currentQuestion.type === 'word_order' || currentQuestion.type === 'sentence_build') && (
            <View style={styles.wordChipsWrap}>
              <View style={[
                styles.placedArea,
                answerState === 'correct' && styles.placedAreaCorrect,
                answerState === 'incorrect' && styles.placedAreaIncorrect,
              ]}>
                {placedWords.length === 0 && (
                  <Text style={styles.placedPlaceholder}>Tap words below to build your answer</Text>
                )}
                <View style={styles.chipsRow}>
                  {placedWords.map((word, idx) => (
                    <Pressable
                      key={`placed-${idx}-${word}`}
                      style={({ pressed }) => [
                        styles.wordChip,
                        styles.wordChipPlaced,
                        pressed && { transform: [{ scale: 0.95 }] },
                        answerState !== 'pending' && { opacity: 0.9 },
                      ]}
                      onPress={() => handleWordTap(word, false)}
                      disabled={answerState !== 'pending'}
                    >
                      <Text style={styles.wordChipPlacedText}>{word}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {answerState === 'incorrect' && (
                <View style={styles.correctBox}>
                  <Text style={styles.correctLabel}>Correct order:</Text>
                  <Text style={styles.correctText}>{currentQuestion.correctAnswer}</Text>
                </View>
              )}

              <View style={styles.bankDivider} />

              <View style={styles.chipsRow}>
                {bankWords.map((word, idx) => (
                  <Pressable
                    key={`bank-${idx}-${word}`}
                    style={({ pressed }) => [
                      styles.wordChip,
                      styles.wordChipBank,
                      pressed && { transform: [{ scale: 0.95 }] },
                    ]}
                    onPress={() => handleWordTap(word, true)}
                    disabled={answerState !== 'pending'}
                  >
                    <Text style={styles.wordChipBankText}>{word}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {currentQuestion.type === 'match_pairs' && currentQuestion.pairs && (
            <Animated.View style={[styles.matchPairsWrap, { transform: [{ translateX: shakeAnim }] }]}>
              <View style={styles.matchColumns}>
                <View style={styles.matchColumn}>
                  {shuffledFrench.map((pair) => {
                    const isMatched = matchedFrench.includes(pair.french);
                    const isSelected = pairSelection?.side === 'french' && pairSelection.value === pair.french;
                    return (
                      <Pressable
                        key={`fr-${pair.french}`}
                        style={[
                          styles.matchCard, styles.matchCardFrench,
                          isSelected && styles.matchCardSelected,
                          isMatched && styles.matchCardMatched,
                        ]}
                        onPress={() => !isMatched && handleMatchPairTap('french', pair.french)}
                        disabled={isMatched || answerState !== 'pending'}
                      >
                        <Text style={[
                          styles.matchCardText,
                          isMatched && styles.matchCardTextMatched,
                          isSelected && { color: '#4338CA', fontWeight: '600' as const },
                        ]} numberOfLines={2}>
                          {pair.french}
                        </Text>
                        {isMatched && <Check size={14} color="#10B981" />}
                      </Pressable>
                    );
                  })}
                </View>
                <View style={styles.matchColumn}>
                  {shuffledEnglish.map((pair) => {
                    const frenchMatch = currentQuestion.pairs?.find(p => p.english === pair.english);
                    const isMatched = frenchMatch ? matchedFrench.includes(frenchMatch.french) : false;
                    const isSelected = pairSelection?.side === 'english' && pairSelection.value === pair.english;
                    return (
                      <Pressable
                        key={`en-${pair.english}`}
                        style={[
                          styles.matchCard, styles.matchCardEnglish,
                          isSelected && styles.matchCardSelectedEn,
                          isMatched && styles.matchCardMatched,
                        ]}
                        onPress={() => !isMatched && handleMatchPairTap('english', pair.english)}
                        disabled={isMatched || answerState !== 'pending'}
                      >
                        <Text style={[
                          styles.matchCardText,
                          isMatched && styles.matchCardTextMatched,
                          isSelected && { color: '#0D9488', fontWeight: '600' as const },
                        ]} numberOfLines={2}>
                          {pair.english}
                        </Text>
                        {isMatched && <Check size={14} color="#10B981" />}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              {answerState !== 'pending' && (
                <View style={styles.matchFeedback}>
                  <Text style={[
                    styles.matchFeedbackText,
                    { color: answerState === 'correct' ? '#10B981' : '#F59E0B' },
                  ]}>
                    {answerState === 'correct' ? 'All matched!' : 'Keep practicing these pairs'}
                  </Text>
                </View>
              )}
            </Animated.View>
          )}

          {answerState !== 'pending' && currentQuestion.type !== 'match_pairs' && (
            <View style={[
              styles.feedbackBar,
              { backgroundColor: answerState === 'correct' ? '#ECFDF5' : '#FEF2F2' },
            ]}>
              <View style={[
                styles.feedbackDot,
                { backgroundColor: answerState === 'correct' ? '#10B981' : '#EF4444' },
              ]} />
              <Text style={[
                styles.feedbackText,
                { color: answerState === 'correct' ? '#059669' : '#DC2626' },
              ]}>
                {answerState === 'correct' ? 'Correct!' : 'Not quite'}
              </Text>
              {answerState === 'incorrect' && !savedFromLearn.has(currentQuestion.correctAnswer) && (
                <Pressable
                  style={styles.feedbackSaveBtn}
                  onPress={() => {
                    const concept = conceptsRef.current.find(c => c.id === currentQuestion.conceptId);
                    if (concept) handleSaveToGaps(concept.french, concept.english);
                  }}
                >
                  <Plus size={12} color={Colors.primary} />
                  <Text style={styles.feedbackSaveText}>Save Gap</Text>
                </Pressable>
              )}
            </View>
          )}

          {currentQuestion.hint && answerState === 'pending' && currentQuestion.type !== 'match_pairs' && (
            <View style={styles.hintRow}>
              <Lightbulb size={14} color={Colors.textMuted} />
              <Text style={styles.hintText}>{currentQuestion.hint}</Text>
            </View>
          )}

          {answerState === 'incorrect' && currentQuestion.explanation && (
            <View style={styles.explanationBox}>
              <Text style={styles.explanationText}>{currentQuestion.explanation}</Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          {currentQuestion.type === 'match_pairs' ? (
            answerState !== 'pending' ? (
              <Pressable style={styles.nextBtn} onPress={handleNext}>
                <Text style={styles.nextBtnText}>Next</Text>
                <ArrowRight size={18} color="#fff" />
              </Pressable>
            ) : (
              <View style={styles.matchHint}>
                <Text style={styles.matchHintText}>
                  {matchedFrench.length}/{currentQuestion.pairs?.length || 0} matched
                </Text>
              </View>
            )
          ) : answerState === 'pending' ? (
            <Pressable
              style={[styles.checkBtn, !canCheck && styles.checkBtnDisabled]}
              onPress={handleCheckAnswer}
              disabled={!canCheck}
            >
              <Text style={styles.checkBtnText}>Check</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.nextBtn} onPress={handleNext}>
              <Text style={styles.nextBtnText}>
                {isLessonComplete(conceptsRef.current, questionsRef.current) ? 'Finish' : 'Next'}
              </Text>
              <ArrowRight size={18} color="#fff" />
            </Pressable>
          )}
        </View>
      </Animated.View>
    );
  };

  const renderLearnComplete = () => {
    const percentage = questionsAnswered > 0 ? Math.round((totalCorrect / questionsAnswered) * 100) : 0;
    const allMastered = concepts.every(c => c.mastered);
    const hasMorePhases = !isLastPhase;

    return (
      <Animated.View style={[styles.learnCompleteWrap, { opacity: completeFade, transform: [{ scale: completeScale }] }]}>
        <ScrollView contentContainerStyle={styles.learnCompleteContent} showsVerticalScrollIndicator={false}>
          <View style={styles.learnCompleteHeader}>
            <View style={[styles.learnCompleteIcon, allMastered && { backgroundColor: '#FFF7ED' }]}>
              {allMastered ? <Award size={36} color={Colors.primary} /> : <Brain size={36} color="#6366F1" />}
            </View>
            <Text style={styles.learnCompleteTitle}>
              {allMastered ? 'All Mastered!' : 'Practice Complete!'}
            </Text>
          </View>

          <View style={styles.learnCompleteScore}>
            <Text style={styles.learnCompleteScoreNum}>{percentage}%</Text>
            <Text style={styles.learnCompleteScoreSub}>{totalCorrect}/{questionsAnswered} correct</Text>
          </View>

          <View style={styles.learnCompleteStatsRow}>
            <View style={styles.learnCompleteStat}>
              <Award size={18} color="#10B981" />
              <Text style={styles.learnCompleteStatNum}>{masteredCount}/{concepts.length}</Text>
              <Text style={styles.learnCompleteStatLabel}>Mastered</Text>
            </View>
            <View style={styles.learnCompleteStatDivider} />
            <View style={styles.learnCompleteStat}>
              <Flame size={18} color="#F59E0B" />
              <Text style={styles.learnCompleteStatNum}>{maxStreak}</Text>
              <Text style={styles.learnCompleteStatLabel}>Best Streak</Text>
            </View>
          </View>

          <View style={styles.conceptResults}>
            {concepts.map(c => (
              <View key={c.id} style={styles.conceptResultRow}>
                <View style={[styles.conceptResultDot, c.mastered && styles.conceptResultDotMastered]}>
                  {c.mastered && <Check size={10} color="#fff" />}
                </View>
                <Text style={[styles.conceptResultText, c.mastered && styles.conceptResultTextMastered]} numberOfLines={1}>
                  {c.french}
                </Text>
                <Text style={styles.conceptResultSub} numberOfLines={1}>{c.english}</Text>
              </View>
            ))}
          </View>

          <Pressable style={styles.advanceBtn} onPress={advancePhase}>
            <Text style={styles.advanceBtnText}>
              {hasMorePhases ? `Continue to ${PHASE_CONFIG[phases[currentPhaseIndex + 1]]?.label || 'Next'}` : 'Complete Lesson'}
            </Text>
            <ArrowRight size={18} color="#fff" />
          </Pressable>
        </ScrollView>
      </Animated.View>
    );
  };

  const renderListenPhase = () => {
    const lp = lesson.listeningPrompt;
    if (!lp) return <View style={styles.centeredPhase}><Text style={styles.notFoundText}>No listening content</Text><Pressable style={styles.skipBtn} onPress={advancePhase}><Text style={styles.skipBtnText}>Skip</Text></Pressable></View>;
    const allAnswered = lp.comprehensionQuestions.every((_, i) => comprehensionAnswers[i.toString()]);
    return (
      <ScrollView style={styles.scrollPhase} contentContainerStyle={styles.scrollPhaseContent} showsVerticalScrollIndicator={false}>
        <View style={styles.phaseHeaderBlock}>
          <View style={[styles.phaseIconCircle, { backgroundColor: '#EDE9FE' }]}>
            <Headphones size={28} color="#8B5CF6" />
          </View>
          <Text style={styles.phaseHeaderTitle}>Listen & Understand</Text>
          <Text style={styles.phaseHeaderDesc}>Listen to the passage, then answer the questions</Text>
        </View>
        <Pressable
          style={[styles.playPassageButton, listenPlayed && styles.playPassageButtonPlayed]}
          onPress={() => { handlePlayAudio(lp.text); setListenPlayed(true); }}
          disabled={isSpeaking}
        >
          <Volume2 size={22} color={Colors.textLight} />
          <Text style={styles.playPassageText}>{isSpeaking ? 'Playing...' : listenPlayed ? 'Play Again' : 'Play Passage'}</Text>
        </Pressable>
        {lp.comprehensionQuestions.map((q, qi) => {
          const userAnswer = comprehensionAnswers[qi.toString()];
          return (
            <View key={qi} style={styles.comprehensionCard}>
              <Text style={styles.comprehensionQuestion}>{q.question}</Text>
              {q.choices.map((choice) => {
                const isSelected = userAnswer === choice;
                const showResult = showComprehensionResults;
                const isCorrectChoice = choice === q.answer;
                return (
                  <Pressable
                    key={choice}
                    style={[
                      styles.comprehensionChoice,
                      isSelected && !showResult && styles.comprehensionChoiceSelected,
                      showResult && isCorrectChoice && styles.comprehensionChoiceCorrect,
                      showResult && isSelected && !isCorrectChoice && styles.comprehensionChoiceWrong,
                    ]}
                    onPress={() => !showComprehensionResults && handleComprehensionAnswer(qi, choice)}
                    disabled={showComprehensionResults}
                  >
                    <Text style={[
                      styles.comprehensionChoiceText,
                      isSelected && !showResult && styles.comprehensionChoiceTextSelected,
                      showResult && isCorrectChoice && styles.comprehensionChoiceTextCorrect,
                      showResult && isSelected && !isCorrectChoice && styles.comprehensionChoiceTextWrong,
                    ]}>{choice}</Text>
                    {showResult && isCorrectChoice && <Check size={16} color="#059669" />}
                    {showResult && isSelected && !isCorrectChoice && <XCircle size={16} color="#DC2626" />}
                  </Pressable>
                );
              })}
            </View>
          );
        })}
        {allAnswered && !showComprehensionResults && (
          <Pressable style={styles.phaseCheckBtn} onPress={handleCheckComprehension}>
            <Text style={styles.phaseCheckBtnText}>Check Answers</Text>
          </Pressable>
        )}
        {showComprehensionResults && (
          <Pressable style={styles.phaseContinueBtn} onPress={advancePhase}>
            <Text style={styles.phaseContinueBtnText}>Continue</Text>
            <ArrowRight size={18} color={Colors.textLight} />
          </Pressable>
        )}
      </ScrollView>
    );
  };

  const renderReadPhase = () => {
    const rp = lesson.readingPassage;
    if (!rp) return <View style={styles.centeredPhase}><Text style={styles.notFoundText}>No reading content</Text><Pressable style={styles.skipBtn} onPress={advancePhase}><Text style={styles.skipBtnText}>Skip</Text></Pressable></View>;
    const allAnswered = rp.comprehensionQuestions.every((_, i) => comprehensionAnswers[i.toString()]);
    return (
      <ScrollView style={styles.scrollPhase} contentContainerStyle={styles.scrollPhaseContent} showsVerticalScrollIndicator={false}>
        <View style={styles.phaseHeaderBlock}>
          <View style={[styles.phaseIconCircle, { backgroundColor: '#D1FAE5' }]}>
            <BookOpen size={28} color="#10B981" />
          </View>
          <Text style={styles.phaseHeaderTitle}>Read & Comprehend</Text>
        </View>
        <View style={styles.readingCard}>
          <Text style={styles.readingTitle}>{rp.title}</Text>
          <Pressable onPress={() => handlePlayAudio(rp.content)} style={styles.readAloudButton} disabled={isSpeaking}>
            <Volume2 size={16} color={Colors.primary} />
            <Text style={styles.readAloudText}>{isSpeaking ? 'Reading...' : 'Read aloud'}</Text>
          </Pressable>
          <Text style={styles.readingContent}>{rp.content}</Text>
        </View>
        {rp.comprehensionQuestions.map((q, qi) => {
          const userAnswer = comprehensionAnswers[qi.toString()];
          return (
            <View key={qi} style={styles.comprehensionCard}>
              <Text style={styles.comprehensionQuestion}>{q.question}</Text>
              {q.choices.map((choice) => {
                const isSelected = userAnswer === choice;
                const showResult = showComprehensionResults;
                const isCorrectChoice = choice === q.answer;
                return (
                  <Pressable
                    key={choice}
                    style={[
                      styles.comprehensionChoice,
                      isSelected && !showResult && styles.comprehensionChoiceSelected,
                      showResult && isCorrectChoice && styles.comprehensionChoiceCorrect,
                      showResult && isSelected && !isCorrectChoice && styles.comprehensionChoiceWrong,
                    ]}
                    onPress={() => !showComprehensionResults && handleComprehensionAnswer(qi, choice)}
                    disabled={showComprehensionResults}
                  >
                    <Text style={[
                      styles.comprehensionChoiceText,
                      isSelected && !showResult && styles.comprehensionChoiceTextSelected,
                      showResult && isCorrectChoice && styles.comprehensionChoiceTextCorrect,
                      showResult && isSelected && !isCorrectChoice && styles.comprehensionChoiceTextWrong,
                    ]}>{choice}</Text>
                    {showResult && isCorrectChoice && <Check size={16} color="#059669" />}
                    {showResult && isSelected && !isCorrectChoice && <XCircle size={16} color="#DC2626" />}
                  </Pressable>
                );
              })}
            </View>
          );
        })}
        {allAnswered && !showComprehensionResults && (
          <Pressable style={styles.phaseCheckBtn} onPress={handleCheckComprehension}>
            <Text style={styles.phaseCheckBtnText}>Check Answers</Text>
          </Pressable>
        )}
        {showComprehensionResults && (
          <Pressable style={styles.phaseContinueBtn} onPress={advancePhase}>
            <Text style={styles.phaseContinueBtnText}>Continue</Text>
            <ArrowRight size={18} color={Colors.textLight} />
          </Pressable>
        )}
      </ScrollView>
    );
  };

  const renderSpeakPhase = () => {
    const prompts = lesson.speakingPrompts || [];
    if (prompts.length === 0) return <View style={styles.centeredPhase}><Text style={styles.notFoundText}>No speaking prompts</Text><Pressable style={styles.skipBtn} onPress={advancePhase}><Text style={styles.skipBtnText}>Skip</Text></Pressable></View>;
    const currentPrompt = prompts[speakingPromptIndex];
    const isLastPrompt = speakingPromptIndex === prompts.length - 1;
    return (
      <View style={styles.centeredPhase}>
        <View style={styles.phaseHeaderBlock}>
          <View style={[styles.phaseIconCircle, { backgroundColor: '#FEF3C7' }]}>
            <Mic size={28} color="#F59E0B" />
          </View>
          <Text style={styles.phaseHeaderTitle}>Speak</Text>
          <Text style={styles.phaseHeaderDesc}>Practice speaking with these prompts</Text>
        </View>
        <View style={styles.speakCard}>
          <Text style={styles.speakPromptLabel}>Prompt {speakingPromptIndex + 1}/{prompts.length}</Text>
          <Text style={styles.speakPrompt}>{currentPrompt}</Text>
          <Text style={styles.speakHint}>Try speaking your answer aloud in French.</Text>
        </View>
        <View style={styles.speakNav}>
          <Pressable
            style={[styles.speakNavBtn, speakingPromptIndex === 0 && styles.speakNavBtnDisabled]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSpeakingPromptIndex(p => p - 1); }}
            disabled={speakingPromptIndex === 0}
          >
            <ChevronLeft size={20} color={speakingPromptIndex === 0 ? Colors.textMuted : Colors.text} />
            <Text style={[styles.speakNavText, speakingPromptIndex === 0 && { color: Colors.textMuted }]}>Back</Text>
          </Pressable>
          <Pressable
            style={styles.phaseContinueBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              if (isLastPrompt) { advancePhase(); } else { setSpeakingPromptIndex(p => p + 1); }
            }}
          >
            <Text style={styles.phaseContinueBtnText}>{isLastPrompt ? 'Continue' : 'Next Prompt'}</Text>
            <ArrowRight size={18} color={Colors.textLight} />
          </Pressable>
        </View>
      </View>
    );
  };

  const renderWritePhase = () => {
    const wt = lesson.writingTask;
    if (!wt) return <View style={styles.centeredPhase}><Text style={styles.notFoundText}>No writing task</Text><Pressable style={styles.skipBtn} onPress={advancePhase}><Text style={styles.skipBtnText}>Skip</Text></Pressable></View>;
    return (
      <ScrollView style={styles.scrollPhase} contentContainerStyle={styles.scrollPhaseContent} showsVerticalScrollIndicator={false}>
        <View style={styles.phaseHeaderBlock}>
          <View style={[styles.phaseIconCircle, { backgroundColor: '#CFFAFE' }]}>
            <PenLine size={28} color="#06B6D4" />
          </View>
          <Text style={styles.phaseHeaderTitle}>Write</Text>
          <Text style={styles.phaseHeaderDesc}>Practice writing in French</Text>
        </View>
        <View style={styles.writeCard}>
          <Text style={styles.writePrompt}>{wt.prompt}</Text>
          <TextInput
            style={styles.writeInput}
            multiline
            placeholder="Write your response in French..."
            placeholderTextColor={Colors.textMuted}
            value={writingResponse}
            onChangeText={setWritingResponse}
            editable={!writingSubmitted}
            textAlignVertical="top"
          />
          {writingSubmitted && wt.exampleResponse && (
            <View style={styles.exampleCard}>
              <Text style={styles.exampleLabel}>Example response:</Text>
              <Text style={styles.exampleText}>{wt.exampleResponse}</Text>
            </View>
          )}
        </View>
        {!writingSubmitted ? (
          <Pressable
            style={[styles.phaseCheckBtn, !writingResponse.trim() && { opacity: 0.5 }]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setWritingSubmitted(true); }}
            disabled={!writingResponse.trim()}
          >
            <Text style={styles.phaseCheckBtnText}>Submit</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.phaseContinueBtn} onPress={advancePhase}>
            <Text style={styles.phaseContinueBtnText}>Continue</Text>
            <ArrowRight size={18} color={Colors.textLight} />
          </Pressable>
        )}
      </ScrollView>
    );
  };

  const renderGapReviewPhase = () => (
    <View style={styles.centeredPhase}>
      <View style={styles.phaseHeaderBlock}>
        <View style={[styles.phaseIconCircle, { backgroundColor: '#FCE7F3' }]}>
          <Target size={28} color="#EC4899" />
        </View>
        <Text style={styles.phaseHeaderTitle}>Gap Review</Text>
        <Text style={styles.phaseHeaderDesc}>{injection.injectionReason}</Text>
      </View>
      <View style={styles.gapReviewCard}>
        <Text style={styles.gapReviewCount}>{injection.totalInjected} gap{injection.totalInjected !== 1 ? 's' : ''} to review</Text>
        <Text style={styles.gapReviewHint}>Practice your gaps to reinforce what you've learned</Text>
      </View>
      <Pressable
        style={styles.phaseContinueBtn}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          router.push('/gap-quiz?source=due' as any);
        }}
      >
        <Text style={styles.phaseContinueBtnText}>Start Review</Text>
        <ArrowRight size={18} color={Colors.textLight} />
      </Pressable>
      <Pressable style={styles.skipBtn} onPress={advancePhase}>
        <Text style={styles.skipBtnText}>Skip for now</Text>
      </Pressable>
    </View>
  );

  const renderCurrentPhase = () => {
    if (currentPhase === 'learn') {
      switch (learnSubPhase) {
        case 'intro': return renderLearnIntro();
        case 'practice': return renderLearnPractice();
        case 'complete': return renderLearnComplete();
      }
    }
    switch (currentPhase) {
      case 'listen': return renderListenPhase();
      case 'read': return renderReadPhase();
      case 'speak': return renderSpeakPhase();
      case 'write': return renderWritePhase();
      case 'gap_review': return renderGapReviewPhase();
      default: return null;
    }
  };

  const showMasteryBar = currentPhase === 'learn' && learnSubPhase === 'practice';

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safeArea}>
        {showMasteryBar ? (
          <>
            <View style={styles.topBar}>
              <Pressable style={styles.closeBtn} onPress={() => safeGoBack()}>
                <X size={20} color={Colors.textSecondary} />
              </Pressable>
              <View style={styles.progressBarWrap}>
                <View style={styles.progressBarTrack}>
                  <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
                </View>
              </View>
              {streak > 0 ? (
                <Animated.View style={[styles.streakBadge, { transform: [{ scale: streakScale }] }]}>
                  <Flame size={14} color="#F59E0B" />
                  <Text style={styles.streakText}>{streak}</Text>
                </Animated.View>
              ) : (
                <View style={styles.streakPlaceholder} />
              )}
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
          </>
        ) : (
          <>
            <View style={styles.headerNav}>
              <Pressable style={styles.headerBackBtn} onPress={() => safeGoBack()}>
                <ChevronLeft size={24} color={Colors.text} />
              </Pressable>
              <Text style={styles.headerTitle} numberOfLines={1}>{lesson.title}</Text>
              <View style={styles.headerSpacer} />
            </View>
            {renderPhaseIndicator()}
          </>
        )}

        <View style={styles.content}>
          {renderCurrentPhase()}
        </View>

        {justMasteredLabel && (
          <Animated.View style={[styles.masteredOverlay, { opacity: masteredOpacity }]} pointerEvents="none">
            <Animated.View style={[styles.masteredCard, { transform: [{ scale: masteredScale }] }]}>
              <Award size={28} color="#10B981" />
              <Text style={styles.masteredTitle}>Mastered!</Text>
              <Text style={styles.masteredLabel}>{justMasteredLabel}</Text>
            </Animated.View>
          </Animated.View>
        )}

        {sessionBreakVisible && (() => {
          const sp = getSessionProgress(conceptsRef.current);
          return (
            <View style={styles.sessionBreakOverlay}>
              <View style={styles.sessionBreakCard}>
                <View style={styles.sessionBreakIconWrap}>
                  <Sparkles size={28} color={Colors.primary} />
                </View>
                <Text style={styles.sessionBreakTitle}>Great Progress!</Text>
                <Text style={styles.sessionBreakSub}>
                  You've mastered {sp.mastered}/{sp.total} concepts
                </Text>
                <View style={styles.sessionBreakBarTrack}>
                  <View style={[styles.sessionBreakBarFill, { width: `${sp.percentage}%` }]} />
                </View>
                <Text style={styles.sessionBreakPercent}>{sp.percentage}%</Text>
                <Pressable
                  style={styles.sessionBreakKeepBtn}
                  onPress={() => {
                    setSessionBreakVisible(false);
                    const answered = questionsRef.current;
                    if (isLessonComplete(conceptsRef.current, answered)) {
                      setLearnSubPhase('complete');
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      completeFade.setValue(0);
                      completeScale.setValue(0.85);
                      Animated.parallel([
                        Animated.timing(completeFade, { toValue: 1, duration: 400, useNativeDriver: USE_NATIVE_DRIVER }),
                        Animated.spring(completeScale, { toValue: 1, friction: 8, tension: 40, useNativeDriver: USE_NATIVE_DRIVER }),
                      ]).start();
                      return;
                    }
                    const nextQ = getNextQuestion(conceptsRef.current, lastFormatUsed, answered);
                    if (nextQ) {
                      setLastFormatUsed(nextQ.type);
                      loadQuestion(nextQ);
                    }
                  }}
                >
                  <Text style={styles.sessionBreakKeepText}>Keep Going</Text>
                </Pressable>
                <Pressable
                  style={styles.sessionBreakPauseBtn}
                  onPress={() => {
                    setSessionBreakVisible(false);
                    safeGoBack();
                  }}
                >
                  <Text style={styles.sessionBreakPauseText}>Take a Break</Text>
                </Pressable>
              </View>
            </View>
          );
        })()}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFBFF' },
  safeArea: { flex: 1 },
  content: { flex: 1 },
  notFoundText: { fontSize: 16, color: Colors.textSecondary, textAlign: 'center', marginTop: 40, marginBottom: 16 },

  headerNav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 6 },
  headerBackBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '600' as const, color: Colors.text, textAlign: 'center' },
  headerSpacer: { width: 40 },

  phaseIndicator: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 10, gap: 10, paddingHorizontal: 16 },
  phaseStep: { alignItems: 'center', gap: 4 },
  phaseDot: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  phaseLabel: { fontSize: 11, fontWeight: '600' as const },

  topBar: { flexDirection: 'row', alignItems: 'center', paddingRight: 16, gap: 12, paddingVertical: 6 },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', marginLeft: 16, marginTop: 4 },
  progressBarWrap: { flex: 1 },
  progressBarTrack: { height: 6, backgroundColor: '#E5E7EB', borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#10B981', borderRadius: 3 },
  streakBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#FFFBEB', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, borderWidth: 1, borderColor: '#FDE68A' },
  streakText: { fontSize: 14, fontWeight: '700' as const, color: '#D97706' },
  streakPlaceholder: { width: 44 },

  conceptDots: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 16 },
  conceptDot: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  conceptDotMastered: { backgroundColor: '#10B981' },
  conceptDotActive: { backgroundColor: '#FDE68A', borderWidth: 2, borderColor: '#F59E0B' },

  introWrap: { flex: 1 },
  introScroll: { flex: 1 },
  introScrollContent: { padding: 24, paddingTop: 12 },
  introHeader: { alignItems: 'center', marginBottom: 28 },
  introIconBg: { width: 72, height: 72, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  introTitle: { fontSize: 24, fontWeight: '700' as const, color: Colors.text, textAlign: 'center', marginBottom: 8 },
  introDesc: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, paddingHorizontal: 12 },
  introStats: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginBottom: 28 },
  introStatItem: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFF7ED', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  introStatText: { fontSize: 13, fontWeight: '500' as const, color: Colors.text },
  introSectionLabel: { fontSize: 11, fontWeight: '700' as const, color: Colors.textMuted, letterSpacing: 1, marginBottom: 12 },
  introChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  introChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: Colors.border, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  introChipFrench: { fontSize: 15, fontWeight: '600' as const, color: Colors.primary, marginRight: 6 },
  introChipEnglish: { fontSize: 13, color: Colors.textSecondary },
  introFooter: { paddingHorizontal: 24, paddingVertical: 16, borderTopWidth: 1, borderTopColor: Colors.borderLight },
  startBtn: { flexDirection: 'row', backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', gap: 8 },
  startBtnText: { fontSize: 17, fontWeight: '700' as const, color: '#fff' },

  questionWrap: { flex: 1 },
  questionScroll: { flex: 1 },
  questionScrollContent: { padding: 20, paddingTop: 8, paddingBottom: 20 },
  typeBadge: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8, marginBottom: 14 },
  typeBadgeText: { fontSize: 12, fontWeight: '600' as const },
  questionText: { fontSize: 19, fontWeight: '600' as const, color: Colors.text, lineHeight: 27, marginBottom: 20 },

  choicesWrap: { gap: 10 },
  choiceBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 2, borderColor: '#E5E7EB', gap: 12 },
  choiceBtnSelected: { borderColor: '#4338CA', backgroundColor: '#EEF2FF' },
  choiceBtnCorrect: { borderColor: '#10B981', backgroundColor: '#ECFDF5' },
  choiceBtnIncorrect: { borderColor: '#EF4444', backgroundColor: '#FEF2F2' },
  choiceLetter: { width: 28, height: 28, borderRadius: 8, borderWidth: 2, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center' },
  choiceLetterText: { fontSize: 13, fontWeight: '700' as const, color: '#9CA3AF' },
  choiceText: { fontSize: 16, color: Colors.text, flex: 1 },

  textInputWrap: { gap: 12 },
  playBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#FFF7ED', borderRadius: 16, paddingVertical: 20, borderWidth: 2, borderColor: '#FFEDD5' },
  playBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  playBtnText: { fontSize: 16, fontWeight: '600' as const, color: Colors.primary },
  textInput: { backgroundColor: '#fff', borderRadius: 14, padding: 16, fontSize: 18, color: Colors.text, borderWidth: 2, borderColor: '#E5E7EB', minHeight: 56 },
  textInputCorrect: { borderColor: '#10B981', backgroundColor: '#ECFDF5' },
  textInputIncorrect: { borderColor: '#EF4444', backgroundColor: '#FEF2F2' },
  correctBox: { backgroundColor: '#ECFDF5', borderRadius: 12, padding: 14 },
  correctLabel: { fontSize: 12, color: '#059669', marginBottom: 4 },
  correctText: { fontSize: 17, fontWeight: '600' as const, color: '#059669' },

  wordChipsWrap: { gap: 12 },
  placedArea: { minHeight: 64, backgroundColor: '#F9FAFB', borderRadius: 14, padding: 12, borderWidth: 2, borderColor: '#E5E7EB', borderStyle: 'dashed' as const },
  placedAreaCorrect: { borderColor: '#10B981', backgroundColor: '#ECFDF5', borderStyle: 'solid' as const },
  placedAreaIncorrect: { borderColor: '#EF4444', backgroundColor: '#FEF2F2', borderStyle: 'solid' as const },
  placedPlaceholder: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', paddingVertical: 8 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  wordChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5 },
  wordChipPlaced: { backgroundColor: '#EEF2FF', borderColor: '#A5B4FC' },
  wordChipPlacedText: { fontSize: 16, fontWeight: '500' as const, color: '#4338CA' },
  wordChipBank: { backgroundColor: '#fff', borderColor: '#D1D5DB' },
  wordChipBankText: { fontSize: 16, fontWeight: '500' as const, color: Colors.text },
  bankDivider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 4 },

  matchPairsWrap: { gap: 12 },
  matchColumns: { flexDirection: 'row', gap: 10 },
  matchColumn: { flex: 1, gap: 8 },
  matchCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 14, borderRadius: 12, borderWidth: 2, minHeight: 52 },
  matchCardFrench: { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' },
  matchCardEnglish: { backgroundColor: '#F0FDFA', borderColor: '#99F6E4' },
  matchCardSelected: { borderColor: '#4338CA', backgroundColor: '#EEF2FF' },
  matchCardSelectedEn: { borderColor: '#0D9488', backgroundColor: '#CCFBF1' },
  matchCardMatched: { borderColor: '#86EFAC', backgroundColor: '#DCFCE7', opacity: 0.7 },
  matchCardText: { fontSize: 15, color: Colors.text, flex: 1 },
  matchCardTextMatched: { color: '#059669', fontWeight: '500' as const },
  matchFeedback: { alignItems: 'center', paddingVertical: 8 },
  matchFeedbackText: { fontSize: 15, fontWeight: '600' as const },

  feedbackBar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  feedbackDot: { width: 8, height: 8, borderRadius: 4 },
  feedbackText: { fontSize: 15, fontWeight: '600' as const },
  feedbackSaveBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto', backgroundColor: Colors.primaryLight, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  feedbackSaveText: { fontSize: 12, fontWeight: '600' as const, color: Colors.primary },

  hintRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 16, backgroundColor: '#F9FAFB', padding: 12, borderRadius: 10 },
  hintText: { flex: 1, fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  explanationBox: { marginTop: 12, backgroundColor: '#FFF7ED', padding: 14, borderRadius: 10 },
  explanationText: { fontSize: 14, color: '#92400E', lineHeight: 20 },

  footer: { paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  checkBtn: { backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  checkBtnDisabled: { backgroundColor: '#D1D5DB' },
  checkBtnText: { fontSize: 16, fontWeight: '700' as const, color: '#fff' },
  nextBtn: { flexDirection: 'row', backgroundColor: '#10B981', borderRadius: 14, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', gap: 8 },
  nextBtnText: { fontSize: 16, fontWeight: '700' as const, color: '#fff' },
  matchHint: { alignItems: 'center', paddingVertical: 12 },
  matchHintText: { fontSize: 14, color: Colors.textMuted, fontWeight: '500' as const },

  learnCompleteWrap: { flex: 1 },
  learnCompleteContent: { padding: 24, alignItems: 'center', paddingTop: 20 },
  learnCompleteHeader: { alignItems: 'center', marginBottom: 16 },
  learnCompleteIcon: { width: 72, height: 72, borderRadius: 22, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  learnCompleteTitle: { fontSize: 24, fontWeight: '700' as const, color: Colors.text },
  learnCompleteScore: { alignItems: 'center', marginBottom: 16 },
  learnCompleteScoreNum: { fontSize: 44, fontWeight: '700' as const, color: Colors.text },
  learnCompleteScoreSub: { fontSize: 15, color: Colors.textSecondary, marginTop: 2 },
  learnCompleteStatsRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, paddingVertical: 16, paddingHorizontal: 20, marginBottom: 20, width: '100%', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  learnCompleteStat: { alignItems: 'center', flex: 1, gap: 4 },
  learnCompleteStatNum: { fontSize: 20, fontWeight: '700' as const, color: Colors.text },
  learnCompleteStatLabel: { fontSize: 11, color: Colors.textMuted, fontWeight: '500' as const },
  learnCompleteStatDivider: { width: 1, height: 32, backgroundColor: '#E5E7EB', marginHorizontal: 12 },
  conceptResults: { width: '100%', backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 20, gap: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  conceptResultRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  conceptResultDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  conceptResultDotMastered: { backgroundColor: '#10B981' },
  conceptResultText: { fontSize: 15, fontWeight: '500' as const, color: Colors.text, flex: 1 },
  conceptResultTextMastered: { color: '#059669' },
  conceptResultSub: { fontSize: 13, color: Colors.textMuted, maxWidth: 120 },
  advanceBtn: { flexDirection: 'row', backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%' },
  advanceBtnText: { fontSize: 16, fontWeight: '700' as const, color: '#fff' },

  masteredOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },
  masteredCard: { backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 32, paddingVertical: 24, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 10 },
  masteredTitle: { fontSize: 22, fontWeight: '700' as const, color: '#10B981', marginTop: 8 },
  masteredLabel: { fontSize: 15, color: Colors.textSecondary, marginTop: 4 },

  scrollPhase: { flex: 1 },
  scrollPhaseContent: { padding: 20, paddingBottom: 40 },
  centeredPhase: { flex: 1, paddingHorizontal: 24, justifyContent: 'center', alignItems: 'center' },
  phaseHeaderBlock: { alignItems: 'center', marginBottom: 20 },
  phaseIconCircle: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  phaseHeaderTitle: { fontSize: 22, fontWeight: '700' as const, color: Colors.text, textAlign: 'center' },
  phaseHeaderDesc: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', marginTop: 4, lineHeight: 20 },

  playPassageButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#8B5CF6', borderRadius: 14, paddingVertical: 16, marginBottom: 20 },
  playPassageButtonPlayed: { backgroundColor: '#7C3AED' },
  playPassageText: { fontSize: 16, fontWeight: '600' as const, color: Colors.textLight },

  comprehensionCard: { backgroundColor: Colors.backgroundCard, borderRadius: 14, padding: 16, marginBottom: 14, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2 },
  comprehensionQuestion: { fontSize: 16, fontWeight: '600' as const, color: Colors.text, marginBottom: 12, lineHeight: 22 },
  comprehensionChoice: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border, marginBottom: 8, backgroundColor: Colors.background },
  comprehensionChoiceSelected: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  comprehensionChoiceCorrect: { borderColor: '#059669', backgroundColor: '#ECFDF5' },
  comprehensionChoiceWrong: { borderColor: '#DC2626', backgroundColor: '#FEF2F2' },
  comprehensionChoiceText: { fontSize: 15, color: Colors.text, flex: 1 },
  comprehensionChoiceTextSelected: { color: Colors.primary, fontWeight: '600' as const },
  comprehensionChoiceTextCorrect: { color: '#059669', fontWeight: '600' as const },
  comprehensionChoiceTextWrong: { color: '#DC2626', fontWeight: '600' as const },

  phaseCheckBtn: { backgroundColor: Colors.secondary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  phaseCheckBtnText: { fontSize: 16, fontWeight: '600' as const, color: Colors.textLight },
  phaseContinueBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16, marginTop: 12, width: '100%' },
  phaseContinueBtnText: { fontSize: 16, fontWeight: '600' as const, color: Colors.textLight },

  readingCard: { backgroundColor: Colors.backgroundCard, borderRadius: 16, padding: 20, marginBottom: 20, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2 },
  readingTitle: { fontSize: 18, fontWeight: '700' as const, color: Colors.text, marginBottom: 8 },
  readAloudButton: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 },
  readAloudText: { fontSize: 13, color: Colors.primary, fontWeight: '500' as const },
  readingContent: { fontSize: 16, color: Colors.text, lineHeight: 26 },

  speakCard: { backgroundColor: Colors.backgroundCard, borderRadius: 16, padding: 24, width: '100%', marginBottom: 20, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 16, elevation: 4 },
  speakPromptLabel: { fontSize: 12, fontWeight: '600' as const, color: Colors.textMuted, marginBottom: 8 },
  speakPrompt: { fontSize: 20, fontWeight: '600' as const, color: Colors.text, lineHeight: 28, marginBottom: 14 },
  speakHint: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
  speakNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 12 },
  speakNavBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 12, paddingHorizontal: 16 },
  speakNavBtnDisabled: { opacity: 0.4 },
  speakNavText: { fontSize: 14, fontWeight: '500' as const, color: Colors.text },

  writeCard: { backgroundColor: Colors.backgroundCard, borderRadius: 16, padding: 20, marginBottom: 16, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2 },
  writePrompt: { fontSize: 16, fontWeight: '600' as const, color: Colors.text, lineHeight: 24, marginBottom: 16 },
  writeInput: { minHeight: 120, backgroundColor: Colors.backgroundSecondary, borderRadius: 12, padding: 14, fontSize: 16, color: Colors.text, lineHeight: 24, borderWidth: 1, borderColor: Colors.border },
  exampleCard: { backgroundColor: Colors.primaryLight, borderRadius: 10, padding: 14, marginTop: 16 },
  exampleLabel: { fontSize: 12, fontWeight: '600' as const, color: Colors.primary, marginBottom: 6 },
  exampleText: { fontSize: 15, color: Colors.text, lineHeight: 22 },

  gapReviewCard: { backgroundColor: Colors.backgroundCard, borderRadius: 16, padding: 24, width: '100%', alignItems: 'center', marginBottom: 20, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 16, elevation: 4 },
  gapReviewCount: { fontSize: 20, fontWeight: '700' as const, color: Colors.text, marginBottom: 8 },
  gapReviewHint: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },

  skipBtn: { marginTop: 12, paddingVertical: 12, paddingHorizontal: 20 },
  skipBtnText: { fontSize: 14, color: Colors.textMuted, fontWeight: '500' as const },

  sessionBreakOverlay: { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center' as const, justifyContent: 'center' as const, zIndex: 100 },
  sessionBreakCard: { backgroundColor: '#fff', borderRadius: 24, padding: 28, marginHorizontal: 24, alignItems: 'center' as const, shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.2, shadowRadius: 32, elevation: 15, width: '85%' as unknown as number },
  sessionBreakIconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#FFF7ED', alignItems: 'center' as const, justifyContent: 'center' as const, marginBottom: 16 },
  sessionBreakTitle: { fontSize: 22, fontWeight: '700' as const, color: Colors.text, marginBottom: 6 },
  sessionBreakSub: { fontSize: 15, color: Colors.textSecondary, marginBottom: 16, textAlign: 'center' as const },
  sessionBreakBarTrack: { width: '100%', height: 8, backgroundColor: '#E5E7EB', borderRadius: 4, overflow: 'hidden' as const, marginBottom: 6 },
  sessionBreakBarFill: { height: '100%', backgroundColor: '#10B981', borderRadius: 4 },
  sessionBreakPercent: { fontSize: 13, fontWeight: '600' as const, color: '#10B981', marginBottom: 20 },
  sessionBreakKeepBtn: { backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center' as const, width: '100%', marginBottom: 10 },
  sessionBreakKeepText: { fontSize: 16, fontWeight: '700' as const, color: '#fff' },
  sessionBreakPauseBtn: { paddingVertical: 12, alignItems: 'center' as const, width: '100%' },
  sessionBreakPauseText: { fontSize: 15, fontWeight: '500' as const, color: Colors.textSecondary },
});
