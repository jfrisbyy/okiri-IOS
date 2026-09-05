import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  SafeAreaView,
  TextInput,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { safeGoBack } from '@/utils/navigation';
import { ArrowLeft, Check, X, RefreshCw, ArrowRight, Sparkles, Flame } from 'lucide-react-native';
import Colors from '@/constants/colors';
import Kiri from '@/components/Kiri';

interface Question {
  type: 'conjugate' | 'fill_blank' | 'translate' | 'identify' | 'correct';
  question: string;
  verb?: string;
  correctAnswer: string;
  options?: string[] | null;
  explanation: string;
}

export default function TensePracticeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const tense = params.tense as string || 'Present';
  const frenchName = params.frenchName as string || 'Présent';

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [score, setScore] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQuestions = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/tense-practice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tense,
          tenseFrenchName: frenchName,
          count: 10,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate questions');
      }

      const data = await response.json();
      if (data.questions && data.questions.length > 0) {
        setQuestions(data.questions);
        setCurrentIndex(0);
        setScore(0);
        setShowResult(false);
        setUserAnswer('');
      } else {
        throw new Error('No questions generated');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load questions');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestions();
  }, [tense, frenchName]);

  const currentQuestion = questions[currentIndex];

  const normalizeAnswer = (text: string | null | undefined) => {
    if (!text) return '';
    return text
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/['']/g, "'")
      .replace(/\s+/g, ' ');
  };

  const checkAnswer = () => {
    if (!currentQuestion) return;

    const correct = normalizeAnswer(userAnswer) === normalizeAnswer(currentQuestion.correctAnswer);
    setIsCorrect(correct);
    setShowResult(true);
    if (correct) {
      setScore(score + 1);
    }
  };

  const nextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setUserAnswer('');
      setShowResult(false);
    }
  };

  const isComplete = currentIndex >= questions.length - 1 && showResult;

  if (isLoading) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={[Colors.primary, Colors.primaryLight]}
          style={styles.headerGradient}
        >
          <SafeAreaView>
            <View style={styles.header}>
              <Pressable onPress={() => safeGoBack()} style={styles.backButton}>
                <ArrowLeft size={24} color="#FFFFFF" />
              </Pressable>
              <Text style={styles.headerTitle}>{tense} Practice</Text>
              <View style={styles.placeholder} />
            </View>
          </SafeAreaView>
        </LinearGradient>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Generating practice questions...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={[Colors.primary, Colors.primaryLight]}
          style={styles.headerGradient}
        >
          <SafeAreaView>
            <View style={styles.header}>
              <Pressable onPress={() => safeGoBack()} style={styles.backButton}>
                <ArrowLeft size={24} color="#FFFFFF" />
              </Pressable>
              <Text style={styles.headerTitle}>{tense} Practice</Text>
              <View style={styles.placeholder} />
            </View>
          </SafeAreaView>
        </LinearGradient>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={fetchQuestions}>
            <RefreshCw size={18} color="#FFFFFF" />
            <Text style={styles.retryButtonText}>Try Again</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[Colors.primary, Colors.primaryLight]}
        style={styles.headerGradient}
      >
        <SafeAreaView>
          <View style={styles.header}>
            <Pressable onPress={() => safeGoBack()} style={styles.backButton}>
              <ArrowLeft size={24} color="#FFFFFF" />
            </Pressable>
            <Text style={styles.headerTitle}>{tense} Practice</Text>
            <View style={styles.placeholder} />
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${((currentIndex + 1) / questions.length) * 100}%` }]} />
        </View>
        <Text style={styles.progressText}>
          Question {currentIndex + 1} of {questions.length}
        </Text>

        {currentQuestion && (
          <View style={styles.questionCard}>
            <View style={styles.typeTag}>
              <Text style={styles.typeTagText}>{currentQuestion.type.replace('_', ' ')}</Text>
            </View>
            
            <Text style={styles.questionText}>{currentQuestion.question}</Text>

            {currentQuestion.verb && (
              <Text style={styles.verbHint}>Verb: {currentQuestion.verb}</Text>
            )}

            {currentQuestion.options && currentQuestion.options.length > 0 ? (
              <View style={styles.optionsContainer}>
                {currentQuestion.options.map((option, index) => (
                  <Pressable
                    key={index}
                    style={[
                      styles.optionButton,
                      userAnswer === option && styles.optionButtonSelected,
                      showResult && option === currentQuestion.correctAnswer && styles.optionButtonCorrect,
                      showResult && userAnswer === option && option !== currentQuestion.correctAnswer && styles.optionButtonIncorrect,
                    ]}
                    onPress={() => !showResult && setUserAnswer(option)}
                    disabled={showResult}
                  >
                    <Text style={[
                      styles.optionText,
                      userAnswer === option && styles.optionTextSelected,
                      showResult && option === currentQuestion.correctAnswer && styles.optionTextCorrect,
                    ]}>
                      {option}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <TextInput
                style={styles.answerInput}
                placeholder="Type your answer..."
                placeholderTextColor={Colors.textSecondary}
                value={userAnswer}
                onChangeText={setUserAnswer}
                editable={!showResult}
                autoCapitalize="none"
              />
            )}

            {showResult && (
              <View style={[styles.resultCard, isCorrect ? styles.resultCorrect : styles.resultIncorrect]}>
                <View style={styles.resultWithKiri}>
                  <View style={styles.kiriReaction}>
                    <Kiri 
                      mood={isCorrect ? 'celebrating' : 'encouraging'} 
                      size={70} 
                    />
                  </View>
                  <View style={styles.resultContent}>
                    <View style={styles.resultHeader}>
                      {isCorrect ? (
                        <>
                          <Check size={20} color="#22C55E" />
                          <Text style={styles.resultCorrectText}>Correct!</Text>
                        </>
                      ) : (
                        <>
                          <X size={20} color="#EF4444" />
                          <Text style={styles.resultIncorrectText}>Not quite</Text>
                        </>
                      )}
                    </View>
                    {!isCorrect && (
                      <Text style={styles.correctAnswerText}>
                        Correct answer: <Text style={styles.correctAnswerHighlight}>{currentQuestion.correctAnswer}</Text>
                      </Text>
                    )}
                  </View>
                </View>
                <Text style={styles.explanationText}>{currentQuestion.explanation}</Text>
              </View>
            )}

            {!showResult ? (
              <Pressable
                style={[styles.submitButton, !(userAnswer || '').trim() && styles.submitButtonDisabled]}
                onPress={checkAnswer}
                disabled={!(userAnswer || '').trim()}
              >
                <Text style={styles.submitButtonText}>Check Answer</Text>
              </Pressable>
            ) : !isComplete ? (
              <Pressable style={styles.nextButton} onPress={nextQuestion}>
                <Text style={styles.nextButtonText}>Next Question</Text>
              </Pressable>
            ) : (
              <View style={styles.completeCard}>
                <Text style={styles.completeTitle}>Practice Complete!</Text>
                <Text style={styles.scoreText}>
                  Score: {score}/{questions.length} ({Math.round((score / questions.length) * 100)}%)
                </Text>
                <View style={styles.completeButtons}>
                  <Pressable style={styles.practiceAgainButton} onPress={fetchQuestions}>
                    <RefreshCw size={18} color="#FFFFFF" />
                    <Text style={styles.practiceAgainText}>Practice Again</Text>
                  </Pressable>
                  <Pressable style={styles.doneButton} onPress={() => safeGoBack()}>
                    <Text style={styles.doneButtonText}>Done</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFBF7',
  },
  resultWithKiri: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  kiriReaction: {
    marginRight: 4,
  },
  resultContent: {
    flex: 1,
  },
  headerGradient: {
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  retryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  progressBar: {
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: 3,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
  progressText: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  questionCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  typeTag: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.primaryLight + '30',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 12,
  },
  typeTagText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
    textTransform: 'uppercase',
  },
  questionText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    lineHeight: 26,
    marginBottom: 16,
  },
  verbHint: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    marginBottom: 16,
  },
  optionsContainer: {
    gap: 10,
    marginBottom: 16,
  },
  optionButton: {
    backgroundColor: Colors.background,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  optionButtonSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight + '15',
  },
  optionButtonCorrect: {
    borderColor: '#22C55E',
    backgroundColor: '#22C55E15',
  },
  optionButtonIncorrect: {
    borderColor: '#EF4444',
    backgroundColor: '#EF444415',
  },
  optionText: {
    fontSize: 15,
    color: Colors.text,
    textAlign: 'center',
  },
  optionTextSelected: {
    fontWeight: '600',
  },
  optionTextCorrect: {
    color: '#22C55E',
    fontWeight: '600',
  },
  answerInput: {
    backgroundColor: Colors.background,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  resultCard: {
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
  },
  resultCorrect: {
    backgroundColor: '#22C55E15',
    borderWidth: 1,
    borderColor: '#22C55E30',
  },
  resultIncorrect: {
    backgroundColor: '#EF444415',
    borderWidth: 1,
    borderColor: '#EF444430',
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  resultCorrectText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#22C55E',
  },
  resultIncorrectText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#EF4444',
  },
  correctAnswerText: {
    fontSize: 14,
    color: Colors.text,
    marginBottom: 8,
  },
  correctAnswerHighlight: {
    fontWeight: '700',
    color: Colors.primary,
  },
  explanationText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  submitButton: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  nextButton: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  completeCard: {
    alignItems: 'center',
    paddingTop: 16,
  },
  completeTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
  },
  scoreText: {
    fontSize: 18,
    color: Colors.primary,
    fontWeight: '600',
    marginBottom: 20,
  },
  completeButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  practiceAgainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  practiceAgainText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  doneButton: {
    backgroundColor: Colors.backgroundCard,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  doneButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  bottomSpacer: {
    height: 40,
  },
});
