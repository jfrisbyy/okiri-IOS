import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Animated,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { safeGoBack } from '@/utils/navigation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  X,
  Check,
  ArrowRight,
  Shield,
  Award,
  Home,
  RotateCcw,
  Sparkles,
  Target,
  AlertCircle,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { generateObject } from '@rork-ai/toolkit-sdk';
import { z } from 'zod';
import Colors from '@/constants/colors';
import { USE_NATIVE_DRIVER } from '@/constants/animation';
import { useApp } from '@/contexts/AppContext';
import { CEFRLevel } from '@/types';
import {
  CEFR_LEVEL_NAMES,
  CEFR_LEVEL_COLORS,
  CEFR_LEVEL_DESCRIPTIONS,
  PASS_THRESHOLD,
  ProficiencyQuestion,
  getFallbackQuestions,
  getTestPromptForLevel,
} from '@/utils/proficiency';
import Kiri from '@/components/Kiri';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type AnswerState = 'pending' | 'correct' | 'incorrect';

const questionSchema = z.object({
  questions: z.array(z.object({
    type: z.enum(['multiple_choice', 'fill_blank', 'translation']),
    question: z.string(),
    correctAnswer: z.string(),
    choices: z.array(z.string()).optional(),
    skill: z.enum(['vocabulary', 'grammar', 'comprehension', 'production']),
  }))
});

export default function ProficiencyTestScreen() {
  const { level } = useLocalSearchParams<{ level: string }>();
  const router = useRouter();
  const { certifyLevel, recordProficiencyAttempt, proficiency } = useApp();

  const testLevel = (level as CEFRLevel) || 'A1';
  const levelColors = CEFR_LEVEL_COLORS[testLevel];

  const [questions, setQuestions] = useState<ProficiencyQuestion[]>([]);
  const [isGenerating, setIsGenerating] = useState(true);
  const [generationError, setGenerationError] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [textAnswer, setTextAnswer] = useState('');
  const [answerState, setAnswerState] = useState<AnswerState>('pending');
  const [correctCount, setCorrectCount] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [skillScores, setSkillScores] = useState<Record<string, { correct: number; total: number }>>({});

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const completeFade = useRef(new Animated.Value(0)).current;
  const completeScale = useRef(new Animated.Value(0.85)).current;
  const shieldScale = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  const previousAttempts = proficiency.records.find(r => r.level === testLevel)?.attempts ?? 0;

  useEffect(() => {
    generateQuestions();
  }, []);

  const generateQuestions = async () => {
    setIsGenerating(true);
    setGenerationError(false);
    console.log(`[ProficiencyTest] Generating questions for ${testLevel}`);

    try {
      const result = await generateObject({
        messages: [
          {
            role: 'user',
            content: getTestPromptForLevel(testLevel),
          },
        ],
        schema: questionSchema,
      });

      if (result.questions && result.questions.length >= 5) {
        const validated = result.questions
          .filter(q => q.question && q.correctAnswer && q.type)
          .map(q => ({
            type: q.type as ProficiencyQuestion['type'],
            question: q.question,
            correctAnswer: q.correctAnswer,
            choices: q.choices,
            skill: q.skill as ProficiencyQuestion['skill'],
          }));

        if (validated.length >= 5) {
          setQuestions(validated.slice(0, 10));
          console.log(`[ProficiencyTest] Generated ${validated.length} questions`);
          animateIn();
          setIsGenerating(false);
          return;
        }
      }
      throw new Error('Not enough valid questions generated');
    } catch (error) {
      console.log('[ProficiencyTest] AI generation failed, using fallback:', error);
      setQuestions(getFallbackQuestions(testLevel));
      setGenerationError(true);
      animateIn();
    } finally {
      setIsGenerating(false);
    }
  };

  const animateIn = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: USE_NATIVE_DRIVER }),
    ]).start();
  };

  const currentQuestion = questions[currentIndex];
  const totalQuestions = questions.length;
  const hasChoices = currentQuestion?.choices && currentQuestion.choices.length > 0;
  const useTextInput = currentQuestion && (
    currentQuestion.type === 'translation' ||
    currentQuestion.type === 'fill_blank' ||
    (currentQuestion.type === 'multiple_choice' && !hasChoices)
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

  const handleCheckAnswer = useCallback(() => {
    if (!currentQuestion || answerState !== 'pending') return;

    const userAnswer = useTextInput ? textAnswer.trim() : selectedAnswer;
    if (!userAnswer) return;

    const normalizedUser = normalizeText(userAnswer);
    const normalizedCorrect = normalizeText(currentQuestion.correctAnswer);

    const isCorrect = normalizedUser === normalizedCorrect ||
      normalizedUser.includes(normalizedCorrect) ||
      normalizedCorrect.includes(normalizedUser) ||
      (currentQuestion.type === 'translation' && (
        normalizedUser.length > 5 &&
        normalizedCorrect.split(' ').filter(w => normalizedUser.includes(w)).length >= Math.floor(normalizedCorrect.split(' ').length * 0.6)
      ));

    setAnswerState(isCorrect ? 'correct' : 'incorrect');

    if (isCorrect) {
      setCorrectCount(prev => prev + 1);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }

    const skill = currentQuestion.skill;
    setSkillScores(prev => ({
      ...prev,
      [skill]: {
        correct: (prev[skill]?.correct ?? 0) + (isCorrect ? 1 : 0),
        total: (prev[skill]?.total ?? 0) + 1,
      },
    }));
  }, [currentQuestion, selectedAnswer, textAnswer, answerState, useTextInput]);

  const animateNextQuestion = useCallback(() => {
    fadeAnim.setValue(0);
    slideAnim.setValue(30);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: USE_NATIVE_DRIVER }),
    ]).start();

    Animated.timing(progressAnim, {
      toValue: (currentIndex + 1) / totalQuestions,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [fadeAnim, slideAnim, progressAnim, currentIndex, totalQuestions]);

  const handleNext = useCallback(async () => {
    if (currentIndex >= totalQuestions - 1) {
      const finalScore = Math.round(((correctCount + (answerState === 'correct' ? 0 : 0)) / totalQuestions) * 100);
      const passed = finalScore >= PASS_THRESHOLD;

      setIsComplete(true);

      if (passed) {
        await certifyLevel(testLevel, finalScore);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        await recordProficiencyAttempt(testLevel, finalScore);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      Animated.parallel([
        Animated.timing(completeFade, { toValue: 1, duration: 500, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.spring(completeScale, { toValue: 1, friction: 8, tension: 40, useNativeDriver: USE_NATIVE_DRIVER }),
        ...(passed ? [
          Animated.sequence([
            Animated.delay(300),
            Animated.spring(shieldScale, { toValue: 1, friction: 6, tension: 50, useNativeDriver: USE_NATIVE_DRIVER }),
          ]),
        ] : []),
      ]).start();
    } else {
      setCurrentIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setTextAnswer('');
      setAnswerState('pending');
      animateNextQuestion();
    }
  }, [currentIndex, totalQuestions, correctCount, answerState, certifyLevel, recordProficiencyAttempt, testLevel, animateNextQuestion, completeFade, completeScale, shieldScale]);

  const handleClose = useCallback(() => {
    safeGoBack();
  }, [router]);

  const handleRetry = useCallback(() => {
    setQuestions([]);
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setTextAnswer('');
    setAnswerState('pending');
    setCorrectCount(0);
    setIsComplete(false);
    setSkillScores({});
    completeFade.setValue(0);
    completeScale.setValue(0.85);
    shieldScale.setValue(0);
    progressAnim.setValue(0);
    generateQuestions();
  }, []);

  const handleGoHome = useCallback(() => {
    router.replace('/(tabs)/home' as any);
  }, [router]);

  if (isGenerating) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <LinearGradient colors={levelColors.gradient} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.loadingContainer}>
          <View style={styles.loadingContent}>
            <View style={styles.shieldIconLarge}>
              <Shield size={48} color={Colors.textLight} />
            </View>
            <Text style={styles.loadingTitle}>{testLevel} Proficiency Test</Text>
            <Text style={styles.loadingSubtitle}>{CEFR_LEVEL_NAMES[testLevel]}</Text>
            <ActivityIndicator size="large" color={Colors.textLight} style={styles.loadingSpinner} />
            <Text style={styles.loadingText}>Preparing your assessment...</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (isComplete) {
    const percentage = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
    const passed = percentage >= PASS_THRESHOLD;

    const skillBreakdown = Object.entries(skillScores).map(([skill, data]) => ({
      skill,
      percentage: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0,
      correct: data.correct,
      total: data.total,
    }));

    const weakAreas = skillBreakdown.filter(s => s.percentage < 60);

    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <LinearGradient
          colors={passed ? ['#ECFDF5', '#D1FAE5'] : ['#FFF7ED', '#FFEDD5']}
          style={StyleSheet.absoluteFill}
        />
        <SafeAreaView style={styles.safeArea}>
          <ScrollView
            contentContainerStyle={styles.completeScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Animated.View style={[
              styles.completeContent,
              { opacity: completeFade, transform: [{ scale: completeScale }] },
            ]}>
              {passed && (
                <Animated.View style={[
                  styles.certifiedShield,
                  { transform: [{ scale: shieldScale }] },
                ]}>
                  <LinearGradient
                    colors={levelColors.gradient}
                    style={styles.shieldGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Shield size={32} color={Colors.textLight} />
                    <Text style={styles.shieldLevelText}>{testLevel}</Text>
                  </LinearGradient>
                </Animated.View>
              )}

              {!passed && (
                <View style={styles.failIcon}>
                  <Target size={40} color="#D97706" />
                </View>
              )}

              <Kiri mood={passed ? 'celebrating' : 'encouraging'} size={100} />

              <View style={styles.scoreSection}>
                <Text style={[
                  styles.scoreNumber,
                  { color: passed ? '#059669' : '#D97706' },
                ]}>{percentage}%</Text>
                <Text style={styles.scoreDetail}>{correctCount}/{totalQuestions} correct</Text>
                <Text style={styles.scoreThreshold}>
                  {passed ? 'Passed' : 'Not passed'} · {PASS_THRESHOLD}% required
                </Text>
              </View>

              <Text style={styles.completeTitle}>
                {passed
                  ? `${testLevel} Certified!`
                  : 'Almost There!'}
              </Text>
              <Text style={styles.completeMessage}>
                {passed
                  ? `You've proven ${CEFR_LEVEL_NAMES[testLevel]} proficiency in French. New content is now unlocked!`
                  : `You need ${PASS_THRESHOLD}% to certify ${testLevel}. Review the areas below and try again.`}
              </Text>

              {skillBreakdown.length > 0 && (
                <View style={styles.skillBreakdown}>
                  <Text style={styles.skillBreakdownTitle}>Skill Breakdown</Text>
                  {skillBreakdown.map(({ skill, percentage: pct, correct: c, total: t }) => (
                    <View key={skill} style={styles.skillRow}>
                      <View style={styles.skillInfo}>
                        <Text style={styles.skillName}>{skill}</Text>
                        <Text style={styles.skillScore}>{c}/{t}</Text>
                      </View>
                      <View style={styles.skillBar}>
                        <View style={[
                          styles.skillBarFill,
                          {
                            width: `${pct}%`,
                            backgroundColor: pct >= 70 ? '#10B981' : pct >= 50 ? '#F59E0B' : '#EF4444',
                          },
                        ]} />
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {!passed && weakAreas.length > 0 && (
                <View style={styles.weakAreasCard}>
                  <View style={styles.weakAreasHeader}>
                    <AlertCircle size={16} color="#D97706" />
                    <Text style={styles.weakAreasTitle}>Focus Areas</Text>
                  </View>
                  {weakAreas.map(({ skill }) => (
                    <Text key={skill} style={styles.weakAreaItem}>
                      • Practice more {skill} exercises
                    </Text>
                  ))}
                </View>
              )}

              <View style={styles.completeActions}>
                {passed ? (
                  <>
                    <Pressable
                      style={[styles.primaryButton, { backgroundColor: levelColors.accent }]}
                      onPress={handleGoHome}
                    >
                      <Sparkles size={18} color={Colors.textLight} />
                      <Text style={styles.primaryButtonText}>Continue Learning</Text>
                    </Pressable>
                  </>
                ) : (
                  <>
                    <Pressable
                      style={[styles.primaryButton, { backgroundColor: '#D97706' }]}
                      onPress={handleRetry}
                    >
                      <RotateCcw size={18} color={Colors.textLight} />
                      <Text style={styles.primaryButtonText}>Try Again</Text>
                    </Pressable>
                    <Pressable style={styles.secondaryButton} onPress={handleGoHome}>
                      <Home size={16} color={Colors.textSecondary} />
                      <Text style={styles.secondaryButtonText}>Back to Home</Text>
                    </Pressable>
                  </>
                )}
              </View>
            </Animated.View>
          </ScrollView>
        </SafeAreaView>
      </View>
    );
  }

  if (!currentQuestion) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Something went wrong</Text>
            <Pressable style={styles.secondaryButton} onPress={handleClose}>
              <Text style={styles.secondaryButtonText}>Go Back</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <LinearGradient
        colors={levelColors.gradient}
        style={styles.testHeader}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <SafeAreaView edges={['top']} style={styles.testHeaderSafe}>
          <View style={styles.testHeaderRow}>
            <Pressable style={styles.closeButton} onPress={handleClose}>
              <X size={22} color={Colors.textLight} />
            </Pressable>
            <View style={styles.testHeaderCenter}>
              <Shield size={16} color={Colors.textLight} />
              <Text style={styles.testHeaderTitle}>{testLevel} Test</Text>
            </View>
            <Text style={styles.testHeaderCount}>
              {currentIndex + 1}/{totalQuestions}
            </Text>
          </View>

          <View style={styles.progressBarContainer}>
            <View style={styles.progressBarTrack}>
              <Animated.View style={[styles.progressBarFill, { width: progressWidth }]} />
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView
        style={styles.questionScroll}
        contentContainerStyle={styles.questionContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View style={{
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        }}>
          <View style={styles.questionTypeTag}>
            <Text style={[styles.questionTypeText, { color: levelColors.accent }]}>
              {currentQuestion.type === 'multiple_choice' ? 'Multiple Choice' :
                currentQuestion.type === 'fill_blank' ? 'Fill in the Blank' : 'Translation'}
            </Text>
            <View style={[styles.skillTag, { backgroundColor: levelColors.bg }]}>
              <Text style={[styles.skillTagText, { color: levelColors.text }]}>
                {currentQuestion.skill}
              </Text>
            </View>
          </View>

          <Text style={styles.questionText}>{currentQuestion.question}</Text>

          {hasChoices && !useTextInput ? (
            <View style={styles.choicesContainer}>
              {currentQuestion.choices!.map((choice, idx) => {
                const isSelected = selectedAnswer === choice;
                const isCorrectChoice = answerState !== 'pending' && choice === currentQuestion.correctAnswer;
                const isWrongSelection = answerState === 'incorrect' && isSelected;

                return (
                  <Pressable
                    key={idx}
                    style={[
                      styles.choiceButton,
                      isSelected && answerState === 'pending' && styles.choiceSelected,
                      isCorrectChoice && styles.choiceCorrect,
                      isWrongSelection && styles.choiceWrong,
                    ]}
                    onPress={() => handleSelectAnswer(choice)}
                    disabled={answerState !== 'pending'}
                  >
                    <View style={[
                      styles.choiceIndicator,
                      isSelected && answerState === 'pending' && { backgroundColor: levelColors.accent, borderColor: levelColors.accent },
                      isCorrectChoice && styles.choiceIndicatorCorrect,
                      isWrongSelection && styles.choiceIndicatorWrong,
                    ]}>
                      {isCorrectChoice && <Check size={12} color={Colors.textLight} />}
                      {isWrongSelection && <X size={12} color={Colors.textLight} />}
                    </View>
                    <Text style={[
                      styles.choiceText,
                      isSelected && answerState === 'pending' && { color: levelColors.accent },
                      isCorrectChoice && styles.choiceTextCorrect,
                      isWrongSelection && styles.choiceTextWrong,
                    ]}>
                      {choice}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <View style={styles.textInputContainer}>
              <TextInput
                style={[
                  styles.answerInput,
                  answerState === 'correct' && styles.answerInputCorrect,
                  answerState === 'incorrect' && styles.answerInputWrong,
                  { borderColor: answerState === 'pending' ? levelColors.accent : undefined },
                ]}
                placeholder="Type your answer..."
                placeholderTextColor={Colors.textMuted}
                value={textAnswer}
                onChangeText={setTextAnswer}
                editable={answerState === 'pending'}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {answerState === 'incorrect' && (
                <View style={styles.correctAnswerBox}>
                  <Text style={styles.correctAnswerLabel}>Correct answer:</Text>
                  <Text style={styles.correctAnswerText}>{currentQuestion.correctAnswer}</Text>
                </View>
              )}
            </View>
          )}

          {answerState !== 'pending' && (
            <View style={[
              styles.feedbackBanner,
              answerState === 'correct' ? styles.feedbackCorrect : styles.feedbackWrong,
            ]}>
              {answerState === 'correct' ? (
                <>
                  <Check size={20} color="#059669" />
                  <Text style={styles.feedbackCorrectText}>Correct!</Text>
                </>
              ) : (
                <>
                  <X size={20} color="#DC2626" />
                  <Text style={styles.feedbackWrongText}>
                    {hasChoices ? `Correct: ${currentQuestion.correctAnswer}` : 'Not quite right'}
                  </Text>
                </>
              )}
            </View>
          )}
        </Animated.View>
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={styles.bottomBar}>
        {answerState === 'pending' ? (
          <Pressable
            style={[
              styles.checkButton,
              { backgroundColor: levelColors.accent },
              (!selectedAnswer && !textAnswer.trim()) && styles.checkButtonDisabled,
            ]}
            onPress={handleCheckAnswer}
            disabled={!selectedAnswer && !textAnswer.trim()}
          >
            <Text style={styles.checkButtonText}>Check Answer</Text>
          </Pressable>
        ) : (
          <Pressable
            style={[styles.nextButton, { backgroundColor: levelColors.accent }]}
            onPress={handleNext}
          >
            <Text style={styles.nextButtonText}>
              {currentIndex >= totalQuestions - 1 ? 'See Results' : 'Next Question'}
            </Text>
            <ArrowRight size={18} color={Colors.textLight} />
          </Pressable>
        )}
      </SafeAreaView>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContent: {
    alignItems: 'center',
    padding: 40,
  },
  shieldIconLarge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  loadingTitle: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.textLight,
    marginBottom: 4,
  },
  loadingSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 32,
  },
  loadingSpinner: {
    marginBottom: 16,
  },
  loadingText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorText: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginBottom: 20,
  },
  testHeader: {
    paddingBottom: 12,
  },
  testHeaderSafe: {},
  testHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  testHeaderCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  testHeaderTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.textLight,
  },
  testHeaderCount: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  progressBarContainer: {
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.textLight,
    borderRadius: 3,
  },
  questionScroll: {
    flex: 1,
  },
  questionContent: {
    padding: 24,
    paddingBottom: 40,
  },
  questionTypeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  questionTypeText: {
    fontSize: 13,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  skillTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  skillTagText: {
    fontSize: 11,
    fontWeight: '600' as const,
    textTransform: 'capitalize' as const,
  },
  questionText: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: Colors.text,
    lineHeight: 28,
    marginBottom: 28,
  },
  choicesContainer: {
    gap: 10,
  },
  choiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: 14,
    padding: 16,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  choiceSelected: {
    borderColor: '#3B82F6',
    backgroundColor: '#EFF6FF',
  },
  choiceCorrect: {
    borderColor: '#10B981',
    backgroundColor: '#ECFDF5',
  },
  choiceWrong: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  choiceIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    marginRight: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  choiceIndicatorCorrect: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  choiceIndicatorWrong: {
    backgroundColor: '#EF4444',
    borderColor: '#EF4444',
  },
  choiceText: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
    lineHeight: 22,
  },
  choiceTextCorrect: {
    color: '#065F46',
    fontWeight: '600' as const,
  },
  choiceTextWrong: {
    color: '#991B1B',
  },
  textInputContainer: {
    gap: 12,
  },
  answerInput: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 14,
    padding: 16,
    fontSize: 16,
    color: Colors.text,
    borderWidth: 2,
    minHeight: 56,
  },
  answerInputCorrect: {
    borderColor: '#10B981',
    backgroundColor: '#ECFDF5',
  },
  answerInputWrong: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  correctAnswerBox: {
    backgroundColor: '#ECFDF5',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  correctAnswerLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#065F46',
    marginBottom: 4,
  },
  correctAnswerText: {
    fontSize: 15,
    color: '#059669',
    fontWeight: '500' as const,
  },
  feedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    marginTop: 20,
  },
  feedbackCorrect: {
    backgroundColor: '#ECFDF5',
  },
  feedbackWrong: {
    backgroundColor: '#FEF2F2',
  },
  feedbackCorrectText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#059669',
  },
  feedbackWrongText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#DC2626',
    flex: 1,
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  checkButton: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkButtonDisabled: {
    opacity: 0.4,
  },
  checkButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.textLight,
  },
  nextButton: {
    flexDirection: 'row',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.textLight,
  },
  completeScrollContent: {
    flexGrow: 1,
    paddingVertical: 24,
  },
  completeContent: {
    alignItems: 'center',
    padding: 24,
  },
  certifiedShield: {
    marginBottom: 16,
  },
  shieldGradient: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  shieldLevelText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.textLight,
    marginTop: 2,
  },
  failIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  scoreSection: {
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 12,
  },
  scoreNumber: {
    fontSize: 52,
    fontWeight: '800' as const,
    letterSpacing: -1,
  },
  scoreDetail: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  scoreThreshold: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 4,
  },
  completeTitle: {
    fontSize: 26,
    fontWeight: '700' as const,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  completeMessage: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  skillBreakdown: {
    width: '100%',
    backgroundColor: Colors.backgroundCard,
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    gap: 14,
  },
  skillBreakdownTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  skillRow: {
    gap: 6,
  },
  skillInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  skillName: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.text,
    textTransform: 'capitalize' as const,
  },
  skillScore: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  skillBar: {
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  skillBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  weakAreasCard: {
    width: '100%',
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  weakAreasHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  weakAreasTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#92400E',
  },
  weakAreaItem: {
    fontSize: 13,
    color: '#B45309',
    lineHeight: 20,
    paddingLeft: 4,
  },
  completeActions: {
    width: '100%',
    gap: 12,
    marginTop: 8,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 14,
    paddingVertical: 16,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.textLight,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
});
