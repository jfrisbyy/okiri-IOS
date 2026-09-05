import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
import { safeGoBack } from '@/utils/navigation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Check, X, Award, ArrowRight, Lightbulb, Sparkles, Flame } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useApp } from '@/contexts/AppContext';
import { GapCategory, GapPrompt, GapLesson } from '@/types';
import { generateGapLesson, categoryLabels } from '@/utils/gapLessonGenerator';
import Kiri from '@/components/Kiri';

type AnswerState = 'pending' | 'correct' | 'incorrect';

export default function GapLessonScreen() {
  const { category } = useLocalSearchParams<{ category: string }>();
  const router = useRouter();
  const { gaps, recordGapAttempt } = useApp();
  
  const [lesson, setLesson] = useState<GapLesson | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [textAnswer, setTextAnswer] = useState('');
  const [answerState, setAnswerState] = useState<AnswerState>('pending');
  const [correctCount, setCorrectCount] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [masteredDuringLesson, setMasteredDuringLesson] = useState<string[]>([]);
  const [lessonComplete, setLessonComplete] = useState(false);

  useEffect(() => {
    if (lesson) return;
    const cat = (category as GapCategory | 'mixed') || 'mixed';
    const generatedLesson = generateGapLesson(gaps, cat, 25);
    setLesson(generatedLesson);
  }, [category]);

  const currentPrompt = lesson?.prompts[currentIndex];
  const progress = lesson ? ((currentIndex + 1) / lesson.prompts.length) * 100 : 0;
  
  const hasChoices = currentPrompt?.choices && currentPrompt.choices.length > 0;
  const useTextInput = currentPrompt && (
    currentPrompt.type === 'production' || 
    currentPrompt.type === 'translation' || 
    currentPrompt.type === 'correction' ||
    (currentPrompt.type === 'fill_blank' && !hasChoices)
  );

  const handleSelectAnswer = useCallback((answer: string) => {
    if (answerState !== 'pending') return;
    setSelectedAnswer(answer);
  }, [answerState]);

  const normalizeForComparison = (text: string): string => {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[.,!?;:'"\-()]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const [accentTip, setAccentTip] = useState<string | null>(null);

  const handleCheckAnswer = useCallback(async () => {
    if (!currentPrompt || answerState !== 'pending') return;

    const userAnswer = useTextInput
      ? textAnswer.trim().toLowerCase()
      : selectedAnswer?.toLowerCase();

    const correctAnswer = currentPrompt.correctAnswer.toLowerCase();
    
    const normalizedUser = normalizeForComparison(userAnswer || '');
    const normalizedCorrect = normalizeForComparison(correctAnswer);
    
    const exactMatch = userAnswer === correctAnswer;
    const normalizedMatch = normalizedUser === normalizedCorrect ||
      (currentPrompt.type === 'production' && normalizedUser.includes(normalizedCorrect)) ||
      (currentPrompt.type === 'translation' && normalizedCorrect.includes(normalizedUser));
    
    const isCorrect = exactMatch || normalizedMatch;
    
    if (normalizedMatch && !exactMatch && useTextInput) {
      const hasAccentDiff = userAnswer !== correctAnswer && 
        userAnswer?.replace(/[.,!?;:'"\-()]/g, '').replace(/\s+/g, ' ').trim() !== 
        correctAnswer.replace(/[.,!?;:'"\-()]/g, '').replace(/\s+/g, ' ').trim();
      if (hasAccentDiff) {
        setAccentTip(`Tip: Note the accents in "${currentPrompt.correctAnswer}"`);
      }
    } else {
      setAccentTip(null);
    }

    setAnswerState(isCorrect ? 'correct' : 'incorrect');
    
    if (isCorrect) {
      setCorrectCount(prev => prev + 1);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }

    const result = await recordGapAttempt(currentPrompt.gapId, isCorrect);
    if (result.newlyMastered) {
      setMasteredDuringLesson(prev => [...prev, currentPrompt.gapId]);
    }
  }, [currentPrompt, selectedAnswer, textAnswer, answerState, recordGapAttempt, useTextInput]);

  const handleNext = useCallback(() => {
    if (!lesson) return;

    if (currentIndex >= lesson.prompts.length - 1) {
      setLessonComplete(true);
    } else {
      setCurrentIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setTextAnswer('');
      setAnswerState('pending');
      setShowHint(false);
      setAccentTip(null);
    }
  }, [lesson, currentIndex]);

  const handleFinish = useCallback(() => {
    router.replace('/(tabs)/deck');
  }, [router]);

  if (!lesson) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No gaps to practice</Text>
            <Text style={styles.emptySubtitle}>Add some gaps by reading or speaking first</Text>
            <Pressable style={styles.backButton} onPress={() => safeGoBack()}>
              <Text style={styles.backButtonText}>Go Back</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (lessonComplete) {
    const percentage = Math.round((correctCount / lesson.prompts.length) * 100);
    
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.completeContainer}>
            <View style={styles.completeIcon}>
              <Award size={48} color={Colors.success} />
            </View>
            <Text style={styles.completeTitle}>Lesson Complete!</Text>
            <Text style={styles.completeScore}>{correctCount}/{lesson.prompts.length} correct ({percentage}%)</Text>
            
            {masteredDuringLesson.length > 0 && (
              <View style={styles.masteredNotice}>
                <Award size={20} color={Colors.success} />
                <Text style={styles.masteredNoticeText}>
                  {masteredDuringLesson.length} gap{masteredDuringLesson.length > 1 ? 's' : ''} mastered!
                </Text>
              </View>
            )}

            <Pressable style={styles.finishButton} onPress={handleFinish}>
              <Text style={styles.finishButtonText}>Back to Deck</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{
          headerShown: true,
          title: lesson.title,
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.text,
          headerLeft: () => (
            <Pressable onPress={() => router.replace('/(tabs)/deck')} style={styles.headerButton}>
              <ChevronLeft size={24} color={Colors.text} />
            </Pressable>
          ),
        }}
      />
      
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
          <Text style={styles.progressText}>{currentIndex + 1} / {lesson.prompts.length}</Text>
        </View>

        <ScrollView 
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
        >
          {currentPrompt && (
            <>
              <View style={styles.promptTypeTag}>
                <Text style={styles.promptTypeText}>
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
                  {currentPrompt.choices!.map((choice, index) => {
                    const isSelected = selectedAnswer === choice;
                    const isCorrectChoice = choice.toLowerCase() === currentPrompt.correctAnswer.toLowerCase();
                    const showCorrect = answerState !== 'pending' && isCorrectChoice;
                    const showIncorrect = answerState === 'incorrect' && isSelected && !isCorrectChoice;

                    return (
                      <Pressable
                        key={index}
                        style={[
                          styles.choiceButton,
                          isSelected && answerState === 'pending' && styles.choiceButtonSelected,
                          showCorrect && styles.choiceButtonCorrect,
                          showIncorrect && styles.choiceButtonIncorrect,
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
                        {showCorrect && <Check size={20} color={Colors.success} />}
                        {showIncorrect && <X size={20} color={Colors.error} />}
                      </Pressable>
                    );
                  })}
                </View>
              )}

              {useTextInput && (
                <View style={styles.textInputContainer}>
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
                    <View style={styles.correctAnswerBox}>
                      <Text style={styles.correctAnswerLabel}>Correct answer:</Text>
                      <Text style={styles.correctAnswerText}>{currentPrompt.correctAnswer}</Text>
                    </View>
                  )}
                  {answerState === 'correct' && accentTip && (
                    <View style={styles.accentTipBox}>
                      <Lightbulb size={16} color={Colors.primary} />
                      <Text style={styles.accentTipText}>{accentTip}</Text>
                    </View>
                  )}
                </View>
              )}

              {showHint && currentPrompt.hint && (
                <View style={styles.hintBox}>
                  <Lightbulb size={16} color={Colors.warning} />
                  <Text style={styles.hintText}>{currentPrompt.hint}</Text>
                </View>
              )}

              {answerState === 'pending' && !showHint && currentPrompt.hint && (
                <Pressable style={styles.showHintButton} onPress={() => setShowHint(true)}>
                  <Lightbulb size={16} color={Colors.primary} />
                  <Text style={styles.showHintText}>Show Hint</Text>
                </Pressable>
              )}

              {answerState !== 'pending' && (
                <View style={styles.kiriReactionContainer}>
                  <Kiri 
                    mood={answerState === 'correct' ? 'celebrating' : 'encouraging'} 
                    size={80} 
                  />
                  <Text style={[
                    styles.reactionText,
                    answerState === 'correct' ? styles.reactionTextCorrect : styles.reactionTextIncorrect
                  ]}>
                    {answerState === 'correct' ? 'Great job!' : 'Keep going!'}
                  </Text>
                </View>
              )}
            </>
          )}
        </ScrollView>

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
              <Text style={styles.checkButtonText}>Check Answer</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.nextButton} onPress={handleNext}>
              <Text style={styles.nextButtonText}>
                {currentIndex >= lesson.prompts.length - 1 ? 'Finish' : 'Next'}
              </Text>
              <ArrowRight size={20} color={Colors.textLight} />
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
  kiriReactionContainer: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 16,
  },
  reactionText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 8,
  },
  reactionTextCorrect: {
    color: '#10B981',
  },
  reactionTextIncorrect: {
    color: '#F97316',
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    gap: 12,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
  progressText: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '500' as const,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
  },
  promptTypeTag: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 16,
  },
  promptTypeText: {
    fontSize: 13,
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
    gap: 12,
  },
  choiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.backgroundCard,
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  choiceButtonSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  choiceButtonCorrect: {
    borderColor: Colors.success,
    backgroundColor: Colors.successLight,
  },
  choiceButtonIncorrect: {
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
  textInputContainer: {
    gap: 12,
  },
  textInput: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 12,
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
  correctAnswerBox: {
    backgroundColor: Colors.successLight,
    borderRadius: 12,
    padding: 16,
  },
  correctAnswerLabel: {
    fontSize: 13,
    color: Colors.success,
    marginBottom: 4,
  },
  correctAnswerText: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.success,
  },
  accentTipBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: Colors.primaryLight,
    borderRadius: 12,
    padding: 14,
  },
  accentTipText: {
    flex: 1,
    fontSize: 14,
    color: Colors.primary,
    lineHeight: 20,
  },
  hintBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: Colors.warningLight,
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
  },
  hintText: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
  },
  showHintButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 16,
    paddingVertical: 10,
  },
  showHintText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '500' as const,
  },
  footer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  checkButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
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
    borderRadius: 12,
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
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.textLight,
  },
  completeContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  completeIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.successLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  completeTitle: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  completeScore: {
    fontSize: 18,
    color: Colors.textSecondary,
    marginBottom: 24,
  },
  masteredNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.successLight,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 24,
  },
  masteredNoticeText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.success,
  },
  finishButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  finishButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.textLight,
  },
});
