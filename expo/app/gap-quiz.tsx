import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Pressable,
  ScrollView,
  TextInput,
  Animated,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  X, Check, ArrowRight, Lightbulb, Award, 
  Home, Layers, Sparkles, Target, BookOpen, Mic,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { USE_NATIVE_DRIVER } from '@/constants/animation';
import { useApp } from '@/contexts/AppContext';
import { GapLesson, GapPrompt } from '@/types';
import { generateQuickQuiz } from '@/utils/gapLessonGenerator';
import Kiri from '@/components/Kiri';

type AnswerState = 'pending' | 'correct' | 'incorrect';

const SOURCE_TITLES: Record<string, string> = {
  foundation: 'Practice New Phrases',
  reading: 'Practice New Words',
  listening: 'Listening Review',
  speech: 'Speech Review',
  due: 'Daily Review',
};

export default function GapQuizScreen() {
  const { source, sourceId } = useLocalSearchParams<{
    source?: string;
    sourceId?: string;
  }>();
  const router = useRouter();
  const { gaps, recordGapAttempt } = useApp();

  const [quiz, setQuiz] = useState<GapLesson | null>(null);
  const [noGaps, setNoGaps] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [textAnswer, setTextAnswer] = useState('');
  const [answerState, setAnswerState] = useState<AnswerState>('pending');
  const [correctCount, setCorrectCount] = useState(0);
  const [masteredCount, setMasteredCount] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const completeFade = useRef(new Animated.Value(0)).current;
  const completeScale = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    let targetGapIds: string[] | undefined;

    if (source === 'due') {
      const now = new Date();
      targetGapIds = gaps
        .filter(g => !g.masteredAt && new Date(g.nextReviewAt) <= now)
        .map(g => g.id);
    } else if (source && sourceId) {
      targetGapIds = gaps
        .filter(g => !g.masteredAt && g.sourceType === source && g.sourceContentId === sourceId)
        .map(g => g.id);
    } else if (source) {
      targetGapIds = gaps
        .filter(g => !g.masteredAt && g.sourceType === source)
        .map(g => g.id);
    }

    const maxQ = source === 'due' ? 10 : 6;
    const lesson = generateQuickQuiz(gaps, targetGapIds, maxQ);

    if (lesson && lesson.prompts.length > 0) {
      setQuiz(lesson);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(slideAnim, { toValue: 0, duration: 350, useNativeDriver: USE_NATIVE_DRIVER }),
      ]).start();
    } else {
      setNoGaps(true);
    }
  }, []);

  const currentPrompt = quiz?.prompts[currentIndex];
  const totalPrompts = quiz?.prompts.length ?? 0;

  const hasChoices = currentPrompt?.choices && currentPrompt.choices.length > 0;
  const useTextInput = currentPrompt && (
    currentPrompt.type === 'production' || 
    currentPrompt.type === 'translation' || 
    currentPrompt.type === 'correction' ||
    (currentPrompt.type === 'fill_blank' && !hasChoices)
  );

  const normalizeText = (text: string): string => {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[.,!?;:'"\-()]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const handleSelectAnswer = useCallback((answer: string) => {
    if (answerState !== 'pending') return;
    setSelectedAnswer(answer);
  }, [answerState]);

  const handleCheckAnswer = useCallback(async () => {
    if (!currentPrompt || answerState !== 'pending') return;

    const userAnswer = useTextInput ? textAnswer.trim().toLowerCase() : selectedAnswer?.toLowerCase();
    const correctAnswer = currentPrompt.correctAnswer.toLowerCase();

    const normalizedUser = normalizeText(userAnswer || '');
    const normalizedCorrect = normalizeText(correctAnswer);

    const isCorrect = userAnswer === correctAnswer ||
      normalizedUser === normalizedCorrect ||
      (currentPrompt.type === 'production' && normalizedUser.includes(normalizedCorrect)) ||
      (currentPrompt.type === 'translation' && normalizedCorrect.includes(normalizedUser));

    setAnswerState(isCorrect ? 'correct' : 'incorrect');

    if (isCorrect) {
      setCorrectCount(prev => prev + 1);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }

    const result = await recordGapAttempt(currentPrompt.gapId, isCorrect);
    if (result.newlyMastered) {
      setMasteredCount(prev => prev + 1);
    }
  }, [currentPrompt, selectedAnswer, textAnswer, answerState, recordGapAttempt, useTextInput]);

  const animateNextQuestion = useCallback(() => {
    fadeAnim.setValue(0);
    slideAnim.setValue(20);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.timing(slideAnim, { toValue: 0, duration: 250, useNativeDriver: USE_NATIVE_DRIVER }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const handleNext = useCallback(() => {
    if (!quiz) return;

    if (currentIndex >= quiz.prompts.length - 1) {
      setIsComplete(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Animated.parallel([
        Animated.timing(completeFade, { toValue: 1, duration: 400, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.spring(completeScale, { toValue: 1, friction: 8, tension: 40, useNativeDriver: USE_NATIVE_DRIVER }),
      ]).start();
    } else {
      setCurrentIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setTextAnswer('');
      setAnswerState('pending');
      animateNextQuestion();
    }
  }, [quiz, currentIndex, animateNextQuestion, completeFade, completeScale]);

  const handleClose = useCallback(() => {
    router.replace('/(tabs)/home' as any);
  }, [router]);

  const handleGoToDeck = useCallback(() => {
    router.replace('/(tabs)/deck' as any);
  }, [router]);

  const title = useMemo(() => {
    if (source && SOURCE_TITLES[source]) return SOURCE_TITLES[source];
    return 'Quick Review';
  }, [source]);

  if (noGaps) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.emptyContainer}>
            <Kiri mood="idle" size={120} />
            <Text style={styles.emptyTitle}>All caught up!</Text>
            <Text style={styles.emptySubtitle}>
              No gaps to practice right now. Keep reading, speaking, and learning to build your deck.
            </Text>
            <Pressable style={styles.emptyButton} onPress={handleClose}>
              <Home size={18} color={Colors.textLight} />
              <Text style={styles.emptyButtonText}>Back to Home</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (isComplete) {
    const percentage = totalPrompts > 0 ? Math.round((correctCount / totalPrompts) * 100) : 0;
    const mood = percentage >= 80 ? 'celebrating' : percentage >= 50 ? 'encouraging' : 'encouraging';

    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <LinearGradient
          colors={percentage >= 70 ? ['#ECFDF5', '#D1FAE5'] : ['#FFF7ED', '#FFEDD5']}
          style={StyleSheet.absoluteFill}
        />
        <SafeAreaView style={styles.safeArea}>
          <Animated.View style={[
            styles.completeContent,
            { opacity: completeFade, transform: [{ scale: completeScale }] },
          ]}>
            <Kiri mood={mood} size={110} />

            <View style={styles.scoreRing}>
              <Text style={styles.scoreNumber}>{percentage}%</Text>
              <Text style={styles.scoreLabel}>{correctCount}/{totalPrompts} correct</Text>
            </View>

            <Text style={styles.completeTitle}>
              {percentage >= 80 ? 'Excellent!' : percentage >= 50 ? 'Good work!' : 'Keep going!'}
            </Text>
            <Text style={styles.completeMessage}>
              {percentage >= 80
                ? 'You\'re building strong French foundations.'
                : percentage >= 50
                ? 'Review these gaps again soon to lock them in.'
                : 'Don\'t worry — every practice makes you stronger.'}
            </Text>

            {masteredCount > 0 && (
              <View style={styles.masteredBadge}>
                <Award size={18} color={Colors.success} />
                <Text style={styles.masteredBadgeText}>
                  {masteredCount} gap{masteredCount > 1 ? 's' : ''} mastered!
                </Text>
              </View>
            )}

            <View style={styles.completeActions}>
              <Pressable
                style={({ pressed }) => [styles.primaryAction, pressed && styles.actionPressed]}
                onPress={handleClose}
              >
                <Home size={18} color={Colors.textLight} />
                <Text style={styles.primaryActionText}>Continue</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.secondaryAction, pressed && styles.actionPressed]}
                onPress={handleGoToDeck}
              >
                <Layers size={18} color={Colors.primary} />
                <Text style={styles.secondaryActionText}>View All Gaps</Text>
              </Pressable>
            </View>
          </Animated.View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable style={styles.closeButton} onPress={handleClose}>
            <X size={22} color={Colors.textSecondary} />
          </Pressable>
          <Text style={styles.headerTitle}>{title}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.dotsRow}>
          {Array.from({ length: totalPrompts }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i < currentIndex && styles.dotDone,
                i === currentIndex && styles.dotActive,
              ]}
            />
          ))}
        </View>

        <Animated.View style={[
          styles.questionArea,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}>
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {currentPrompt && (
              <>
                <View style={styles.typeTag}>
                  <Text style={styles.typeTagText}>
                    {currentPrompt.type === 'multiple_choice' && 'Choose the correct answer'}
                    {currentPrompt.type === 'fill_blank' && 'Fill in the blank'}
                    {currentPrompt.type === 'correction' && 'Find the correct word'}
                    {currentPrompt.type === 'production' && 'Type your answer'}
                    {currentPrompt.type === 'translation' && 'Translate'}
                  </Text>
                </View>

                <Text style={styles.questionText}>{currentPrompt.question}</Text>

                {hasChoices && (
                  <View style={styles.choicesContainer}>
                    {currentPrompt.choices!.map((choice, idx) => {
                      const isSelected = selectedAnswer === choice;
                      const isCorrectChoice = choice.toLowerCase() === currentPrompt.correctAnswer.toLowerCase();
                      const showCorrect = answerState !== 'pending' && isCorrectChoice;
                      const showIncorrect = answerState === 'incorrect' && isSelected && !isCorrectChoice;

                      return (
                        <Pressable
                          key={idx}
                          style={[
                            styles.choiceButton,
                            isSelected && answerState === 'pending' && styles.choiceSelected,
                            showCorrect && styles.choiceCorrect,
                            showIncorrect && styles.choiceIncorrect,
                          ]}
                          onPress={() => handleSelectAnswer(choice)}
                          disabled={answerState !== 'pending'}
                        >
                          <Text style={[
                            styles.choiceText,
                            isSelected && answerState === 'pending' && styles.choiceTextSelected,
                            showCorrect && styles.choiceTextCorrect,
                            showIncorrect && styles.choiceTextIncorrect,
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

                {useTextInput && (
                  <View style={styles.inputContainer}>
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
                    />
                    {answerState === 'incorrect' && (
                      <View style={styles.correctBox}>
                        <Text style={styles.correctLabel}>Correct answer:</Text>
                        <Text style={styles.correctText}>{currentPrompt.correctAnswer}</Text>
                      </View>
                    )}
                  </View>
                )}

                {answerState !== 'pending' && (
                  <View style={styles.feedbackRow}>
                    <View style={[
                      styles.feedbackDot,
                      { backgroundColor: answerState === 'correct' ? Colors.success : Colors.warning },
                    ]} />
                    <Text style={[
                      styles.feedbackText,
                      { color: answerState === 'correct' ? Colors.success : Colors.warning },
                    ]}>
                      {answerState === 'correct' ? 'Correct!' : 'Not quite — keep practicing'}
                    </Text>
                  </View>
                )}

                {currentPrompt.hint && answerState === 'pending' && (
                  <View style={styles.hintRow}>
                    <Lightbulb size={14} color={Colors.textMuted} />
                    <Text style={styles.hintText}>{currentPrompt.hint}</Text>
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </Animated.View>

        <View style={styles.footer}>
          {answerState === 'pending' ? (
            <Pressable
              style={[
                styles.checkButton,
                (!selectedAnswer && !textAnswer.trim()) && styles.checkButtonDisabled,
              ]}
              onPress={handleCheckAnswer}
              disabled={!selectedAnswer && !textAnswer.trim()}
            >
              <Text style={styles.checkButtonText}>Check</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.nextButton} onPress={handleNext}>
              <Text style={styles.nextButtonText}>
                {currentIndex >= totalPrompts - 1 ? 'Finish' : 'Next'}
              </Text>
              <ArrowRight size={18} color={Colors.textLight} />
            </Pressable>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFBF7',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  headerSpacer: {
    width: 40,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 24,
  },
  dot: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    maxWidth: 40,
  },
  dotDone: {
    backgroundColor: Colors.success,
  },
  dotActive: {
    backgroundColor: Colors.primary,
  },
  questionArea: {
    flex: 1,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingTop: 16,
  },
  typeTag: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    marginBottom: 16,
  },
  typeTagText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  questionText: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: Colors.text,
    lineHeight: 28,
    marginBottom: 24,
  },
  choicesContainer: {
    gap: 10,
  },
  choiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.backgroundCard,
    borderRadius: 14,
    padding: 16,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  choiceSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  choiceCorrect: {
    borderColor: Colors.success,
    backgroundColor: Colors.successLight,
  },
  choiceIncorrect: {
    borderColor: Colors.error,
    backgroundColor: `${Colors.error}10`,
  },
  choiceText: {
    fontSize: 16,
    color: Colors.text,
    flex: 1,
  },
  choiceTextSelected: {
    color: Colors.primary,
    fontWeight: '500' as const,
  },
  choiceTextCorrect: {
    color: Colors.success,
    fontWeight: '600' as const,
  },
  choiceTextIncorrect: {
    color: Colors.error,
  },
  inputContainer: {
    gap: 12,
  },
  textInput: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 14,
    padding: 16,
    fontSize: 18,
    color: Colors.text,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  textInputCorrect: {
    borderColor: Colors.success,
    backgroundColor: Colors.successLight,
  },
  textInputIncorrect: {
    borderColor: Colors.error,
    backgroundColor: `${Colors.error}10`,
  },
  correctBox: {
    backgroundColor: Colors.successLight,
    borderRadius: 12,
    padding: 14,
  },
  correctLabel: {
    fontSize: 12,
    color: Colors.success,
    marginBottom: 4,
  },
  correctText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.success,
  },
  feedbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
  },
  feedbackDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  feedbackText: {
    fontSize: 15,
    fontWeight: '600' as const,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 20,
    backgroundColor: Colors.backgroundSecondary,
    padding: 12,
    borderRadius: 10,
  },
  hintText: {
    flex: 1,
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  footer: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  checkButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  checkButtonDisabled: {
    backgroundColor: Colors.border,
  },
  checkButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.textLight,
  },
  nextButton: {
    flexDirection: 'row',
    backgroundColor: Colors.success,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.textLight,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.text,
    marginTop: 20,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
  },
  emptyButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.textLight,
  },
  completeContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  scoreRing: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 16,
  },
  scoreNumber: {
    fontSize: 48,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  scoreLabel: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  completeTitle: {
    fontSize: 26,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  completeMessage: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  masteredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.successLight,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 24,
  },
  masteredBadgeText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.success,
  },
  completeActions: {
    width: '100%',
    gap: 12,
    marginTop: 8,
  },
  primaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
  },
  primaryActionText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.textLight,
  },
  secondaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.primaryLight,
    paddingVertical: 14,
    borderRadius: 14,
  },
  secondaryActionText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  actionPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
});
