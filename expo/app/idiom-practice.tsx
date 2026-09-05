import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Dimensions,
  Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  ArrowLeft, 
  Volume2,
  CheckCircle,
  XCircle,
  ArrowRight,
  RotateCcw,
  Trophy,
  Sparkles,
  Flame,
  Star,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { USE_NATIVE_DRIVER } from '@/constants/animation';
import { 
  frenchIdioms, 
  FrenchIdiom,
  categoryEmojis,
  getRandomIdioms,
} from '@/data/idiomsData';
import Kiri from '@/components/Kiri';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type QuestionType = 'meaning' | 'french' | 'literal';

interface Question {
  idiom: FrenchIdiom;
  type: QuestionType;
  options: string[];
  correctAnswer: string;
}

const QUESTIONS_PER_SESSION = 10;

function generateQuestions(count: number): Question[] {
  const selectedIdioms = getRandomIdioms(count);
  const allIdioms = frenchIdioms;
  
  return selectedIdioms.map((idiom) => {
    const types: QuestionType[] = ['meaning', 'french', 'literal'];
    const type = types[Math.floor(Math.random() * types.length)];
    
    let correctAnswer: string;
    let wrongAnswers: string[];
    
    switch (type) {
      case 'meaning':
        correctAnswer = idiom.meaning;
        wrongAnswers = allIdioms
          .filter(i => i.id !== idiom.id)
          .map(i => i.meaning)
          .sort(() => Math.random() - 0.5)
          .slice(0, 3);
        break;
      case 'french':
        correctAnswer = idiom.french;
        wrongAnswers = allIdioms
          .filter(i => i.id !== idiom.id)
          .map(i => i.french)
          .sort(() => Math.random() - 0.5)
          .slice(0, 3);
        break;
      case 'literal':
        correctAnswer = idiom.literal;
        wrongAnswers = allIdioms
          .filter(i => i.id !== idiom.id)
          .map(i => i.literal)
          .sort(() => Math.random() - 0.5)
          .slice(0, 3);
        break;
    }
    
    const options = [correctAnswer, ...wrongAnswers].sort(() => Math.random() - 0.5);
    
    return {
      idiom,
      type,
      options,
      correctAnswer,
    };
  });
}

const ConfettiParticle = ({ delay, startX }: { delay: number; startX: number }) => {
  const translateY = useRef(new Animated.Value(-20)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0)).current;
  
  const colors = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#95E1D3', '#F38181', '#AA96DA'];
  const color = colors[Math.floor(Math.random() * colors.length)];
  
  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(scale, {
          toValue: 1,
          duration: 200,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(translateY, {
          toValue: 300,
          duration: 1500,
          easing: Easing.out(Easing.quad),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(translateX, {
          toValue: (Math.random() - 0.5) * 200,
          duration: 1500,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(rotate, {
          toValue: Math.random() * 10,
          duration: 1500,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.sequence([
          Animated.delay(800),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 700,
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
        ]),
      ]),
    ]).start();
  }, [delay, translateY, translateX, opacity, rotate, scale]);

  const spin = rotate.interpolate({
    inputRange: [0, 10],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View
      style={[
        styles.confettiParticle,
        {
          left: startX,
          backgroundColor: color,
          transform: [
            { translateY },
            { translateX },
            { rotate: spin },
            { scale },
          ],
          opacity,
        },
      ]}
    />
  );
};

const AnimatedOption = ({ 
  option, 
  index, 
  onPress, 
  isSelected, 
  showResult, 
  isCorrect, 
  isWrong,
  disabled 
}: {
  option: string;
  index: number;
  onPress: () => void;
  isSelected: boolean;
  showResult: boolean;
  isCorrect: boolean;
  isWrong: boolean;
  disabled: boolean;
}) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      delay: index * 80,
      tension: 100,
      friction: 8,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [index, scaleAnim]);

  useEffect(() => {
    if (isWrong && showResult) {
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: USE_NATIVE_DRIVER }),
      ]).start();
    }
  }, [isWrong, showResult, shakeAnim]);

  const handlePressIn = () => {
    Animated.spring(pressScale, {
      toValue: 0.96,
      tension: 100,
      friction: 5,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(pressScale, {
      toValue: 1,
      tension: 100,
      friction: 5,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  };

  const getStyle = () => {
    if (!showResult) {
      return isSelected ? styles.optionSelected : styles.option;
    }
    if (isCorrect) return styles.optionCorrect;
    if (isWrong) return styles.optionWrong;
    return styles.optionDisabled;
  };

  const getTextStyle = () => {
    if (!showResult) {
      return isSelected ? styles.optionTextSelected : styles.optionText;
    }
    if (isCorrect) return styles.optionTextCorrect;
    if (isWrong) return styles.optionTextWrong;
    return styles.optionTextDisabled;
  };

  const letters = ['A', 'B', 'C', 'D'];

  return (
    <Animated.View
      style={{
        transform: [
          { scale: Animated.multiply(scaleAnim, pressScale) },
          { translateX: shakeAnim },
        ],
        opacity: scaleAnim,
      }}
    >
      <Pressable
        style={getStyle()}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
      >
        <View style={styles.optionContent}>
          <View style={[
            styles.optionLetter,
            isSelected && !showResult && styles.optionLetterSelected,
            isCorrect && styles.optionLetterCorrect,
            isWrong && styles.optionLetterWrong,
          ]}>
            <Text style={[
              styles.optionLetterText,
              (isSelected || isCorrect || isWrong) && styles.optionLetterTextActive,
            ]}>
              {letters[index]}
            </Text>
          </View>
          <Text style={getTextStyle()}>{option}</Text>
        </View>
        {isCorrect && <CheckCircle size={22} color="#10B981" />}
        {isWrong && <XCircle size={22} color="#EF4444" />}
      </Pressable>
    </Animated.View>
  );
};

export default function IdiomPracticeScreen() {
  const router = useRouter();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [isPlayingTTS, setIsPlayingTTS] = useState(false);
  const [streak, setStreak] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const [questionKey, setQuestionKey] = useState(0);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const questionFade = useRef(new Animated.Value(1)).current;
  const scorePopAnim = useRef(new Animated.Value(1)).current;
  const streakScaleAnim = useRef(new Animated.Value(1)).current;
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setQuestions(generateQuestions(QUESTIONS_PER_SESSION));
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [fadeAnim]);

  const currentQuestion = questions[currentIndex];
  const progress = questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0;

  const playTTS = async (text: string) => {
    if (isPlayingTTS) return;
    setIsPlayingTTS(true);
    
    try {
      const response = await fetch('/api/text-to-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voiceId: 'XB0fDUnXU5powFXDhCwa' }),
      });

      if (response.ok) {
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        
        if (currentAudioRef.current) {
          currentAudioRef.current.pause();
          currentAudioRef.current = null;
        }
        
        const audio = new Audio(audioUrl);
        currentAudioRef.current = audio;
        
        audio.onended = () => {
          setIsPlayingTTS(false);
          URL.revokeObjectURL(audioUrl);
        };
        
        audio.onerror = () => {
          setIsPlayingTTS(false);
          URL.revokeObjectURL(audioUrl);
        };
        
        await audio.play();
      } else {
        setIsPlayingTTS(false);
      }
    } catch (error) {
      console.error('TTS error:', error);
      setIsPlayingTTS(false);
    }
  };

  const handleAnswer = (answer: string) => {
    if (showResult) return;
    
    setSelectedAnswer(answer);
    setShowResult(true);
    
    const isCorrect = answer === currentQuestion.correctAnswer;
    
    if (isCorrect) {
      setScore(prev => prev + 1);
      setStreak(prev => prev + 1);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 1500);
      
      Animated.sequence([
        Animated.timing(scorePopAnim, {
          toValue: 1.3,
          duration: 150,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.spring(scorePopAnim, {
          toValue: 1,
          tension: 100,
          friction: 5,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]).start();
      
      if (streak >= 1) {
        Animated.sequence([
          Animated.timing(streakScaleAnim, {
            toValue: 1.4,
            duration: 150,
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.spring(streakScaleAnim, {
            toValue: 1,
            tension: 100,
            friction: 5,
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
        ]).start();
      }
    } else {
      setStreak(0);
    }
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      questionFade.setValue(0);
      setCurrentIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setShowResult(false);
      setQuestionKey(prev => prev + 1);
      
      Animated.timing(questionFade, {
        toValue: 1,
        duration: 250,
        useNativeDriver: USE_NATIVE_DRIVER,
      }).start();
    } else {
      setSessionComplete(true);
    }
  };

  const handleRestart = () => {
    setQuestions(generateQuestions(QUESTIONS_PER_SESSION));
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setShowResult(false);
    setScore(0);
    setStreak(0);
    setSessionComplete(false);
    setQuestionKey(0);
  };

  const getQuestionPrompt = () => {
    if (!currentQuestion) return '';
    
    switch (currentQuestion.type) {
      case 'meaning':
        return 'What does this idiom mean?';
      case 'french':
        return 'Which French idiom has this meaning?';
      case 'literal':
        return 'What is the literal translation?';
    }
  };

  const getQuestionSubject = () => {
    if (!currentQuestion) return '';
    
    switch (currentQuestion.type) {
      case 'meaning':
        return currentQuestion.idiom.french;
      case 'french':
        return currentQuestion.idiom.meaning;
      case 'literal':
        return currentQuestion.idiom.french;
    }
  };

  if (sessionComplete) {
    const percentage = Math.round((score / questions.length) * 100);
    const stars = percentage >= 90 ? 3 : percentage >= 70 ? 2 : percentage >= 50 ? 1 : 0;
    
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <LinearGradient
            colors={percentage >= 70 ? ['#10B981', '#059669'] : ['#F97316', '#EA580C']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.resultsGradient}
          >
            <View style={styles.resultsContent}>
              <View style={styles.trophyContainer}>
                <Trophy size={56} color="#FFF" />
              </View>
              
              <Text style={styles.resultsTitle}>
                {percentage >= 90 ? 'Amazing!' : percentage >= 70 ? 'Great Job!' : percentage >= 50 ? 'Good Effort!' : 'Keep Learning!'}
              </Text>
              
              <View style={styles.starsContainer}>
                {[0, 1, 2].map((i) => (
                  <Star
                    key={i}
                    size={36}
                    color={i < stars ? '#FFD700' : 'rgba(255,255,255,0.3)'}
                    fill={i < stars ? '#FFD700' : 'transparent'}
                  />
                ))}
              </View>
              
              <View style={styles.scoreCircle}>
                <Text style={styles.scorePercentage}>{percentage}%</Text>
                <Text style={styles.scoreLabel}>{score} of {questions.length}</Text>
              </View>
              
              <Text style={styles.encouragement}>
                {percentage >= 90 ? "You're mastering French idioms!" :
                 percentage >= 70 ? "You're getting the hang of it!" :
                 percentage >= 50 ? "Practice makes perfect!" :
                 "Every expert was once a beginner!"}
              </Text>
              
              <View style={styles.resultsButtons}>
                <Pressable
                  style={styles.restartButton}
                  onPress={handleRestart}
                >
                  <RotateCcw size={20} color="#FFF" />
                  <Text style={styles.restartButtonText}>Practice Again</Text>
                </Pressable>
                
                <Pressable
                  style={styles.backToIdiomsButton}
                  onPress={() => router.push('/idioms')}
                >
                  <Text style={styles.backToIdiomsText}>Back to Idioms</Text>
                </Pressable>
              </View>
            </View>
          </LinearGradient>
        </SafeAreaView>
      </View>
    );
  }

  if (!currentQuestion) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading questions...</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <Animated.View style={[styles.animatedContainer, { opacity: fadeAnim }]}>
          {showConfetti && (
            <View style={styles.confettiContainer}>
              {[...Array(20)].map((_, i) => (
                <ConfettiParticle 
                  key={i} 
                  delay={i * 30} 
                  startX={Math.random() * SCREEN_WIDTH}
                />
              ))}
            </View>
          )}

          <View style={styles.header}>
            <Pressable 
              style={styles.backButton}
              onPress={() => router.push('/idioms')}
            >
              <ArrowLeft size={22} color={Colors.text} />
            </Pressable>
            
            <View style={styles.headerStats}>
              <Animated.View style={[styles.scoreBadge, { transform: [{ scale: scorePopAnim }] }]}>
                <Sparkles size={16} color={Colors.primary} />
                <Text style={styles.scoreText}>{score}</Text>
              </Animated.View>
              
              {streak >= 2 && (
                <Animated.View style={[styles.streakBadge, { transform: [{ scale: streakScaleAnim }] }]}>
                  <Flame size={16} color="#F59E0B" />
                  <Text style={styles.streakText}>{streak}</Text>
                </Animated.View>
              )}
            </View>
          </View>

          <View style={styles.progressSection}>
            <View style={styles.progressInfo}>
              <Text style={styles.questionNumber}>Question {currentIndex + 1}</Text>
              <Text style={styles.questionTotal}>of {questions.length}</Text>
            </View>
            <View style={styles.progressBar}>
              <Animated.View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
          </View>

          <Animated.View 
            key={questionKey}
            style={[styles.questionContainer, { opacity: questionFade }]}
          >
            <LinearGradient
              colors={['#FFF7ED', '#FFEDD5']}
              style={styles.questionCard}
            >
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryEmoji}>
                  {categoryEmojis[currentQuestion.idiom.category]}
                </Text>
                <Text style={styles.categoryName}>
                  {currentQuestion.idiom.category.charAt(0).toUpperCase() + 
                   currentQuestion.idiom.category.slice(1)}
                </Text>
              </View>

              <Text style={styles.questionPrompt}>{getQuestionPrompt()}</Text>
              
              <View style={styles.subjectContainer}>
                <Text style={styles.questionSubject}>"{getQuestionSubject()}"</Text>
                {currentQuestion.type !== 'french' && (
                  <Pressable
                    style={[styles.ttsButton, isPlayingTTS && styles.ttsButtonActive]}
                    onPress={() => playTTS(currentQuestion.idiom.french)}
                  >
                    <Volume2 size={18} color={isPlayingTTS ? '#FFF' : Colors.primary} />
                  </Pressable>
                )}
              </View>
            </LinearGradient>

            <View style={styles.optionsContainer}>
              {currentQuestion.options.map((option, index) => (
                <AnimatedOption
                  key={`${questionKey}-${index}`}
                  option={option}
                  index={index}
                  onPress={() => handleAnswer(option)}
                  isSelected={selectedAnswer === option}
                  showResult={showResult}
                  isCorrect={showResult && option === currentQuestion.correctAnswer}
                  isWrong={showResult && option === selectedAnswer && option !== currentQuestion.correctAnswer}
                  disabled={showResult}
                />
              ))}
            </View>

            {showResult && (
              <Animated.View style={styles.feedbackSection}>
                <View style={styles.feedbackWithKiri}>
                  <View style={styles.kiriReaction}>
                    <Kiri 
                      mood={selectedAnswer === currentQuestion.correctAnswer ? 'celebrating' : 'encouraging'} 
                      size={80} 
                    />
                  </View>
                  {selectedAnswer === currentQuestion.correctAnswer ? (
                    <View style={styles.feedbackCorrect}>
                      <CheckCircle size={28} color="#10B981" />
                      <Text style={styles.feedbackCorrectText}>Correct!</Text>
                      {streak >= 2 && (
                        <View style={styles.streakMessage}>
                          <Flame size={16} color="#F59E0B" />
                          <Text style={styles.streakMessageText}>{streak} in a row!</Text>
                        </View>
                      )}
                    </View>
                  ) : (
                    <View style={styles.feedbackWrong}>
                      <XCircle size={28} color="#EF4444" />
                      <Text style={styles.feedbackWrongText}>Not quite</Text>
                    </View>
                  )}
                </View>
                
                <View style={styles.idiomSummary}>
                  <Text style={styles.summaryFrench}>{currentQuestion.idiom.french}</Text>
                  <Text style={styles.summaryMeaning}>{currentQuestion.idiom.meaning}</Text>
                  <Text style={styles.summaryLiteral}>
                    Literal: "{currentQuestion.idiom.literal}"
                  </Text>
                </View>

                <Pressable
                  style={styles.nextButton}
                  onPress={handleNext}
                >
                  <LinearGradient
                    colors={[Colors.primary, '#EA580C']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.nextButtonGradient}
                  >
                    <Text style={styles.nextButtonText}>
                      {currentIndex < questions.length - 1 ? 'Next Question' : 'See Results'}
                    </Text>
                    <ArrowRight size={20} color="#FFF" />
                  </LinearGradient>
                </Pressable>
              </Animated.View>
            )}
          </Animated.View>
        </Animated.View>
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
  animatedContainer: {
    flex: 1,
  },
  confettiContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 400,
    zIndex: 100,
    pointerEvents: 'none',
  },
  confettiParticle: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: Colors.textMuted,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  headerStats: {
    flexDirection: 'row',
    gap: 10,
  },
  scoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  scoreText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primary,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#FCD34D',
  },
  streakText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#D97706',
  },
  progressSection: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  progressInfo: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  questionNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  questionTotal: {
    fontSize: 14,
    color: Colors.textMuted,
    marginLeft: 4,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#FFE4CC',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 4,
  },
  questionContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  questionCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: '#FFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    marginBottom: 16,
  },
  categoryEmoji: {
    fontSize: 16,
  },
  categoryName: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  questionPrompt: {
    fontSize: 15,
    color: Colors.textMuted,
    marginBottom: 8,
  },
  subjectContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  questionSubject: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
    lineHeight: 30,
  },
  ttsButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  ttsButtonActive: {
    backgroundColor: Colors.primary,
  },
  optionsContainer: {
    gap: 12,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    borderWidth: 2,
    borderColor: '#F3F4F6',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  optionSelected: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF7ED',
    borderWidth: 2,
    borderColor: Colors.primary,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  optionCorrect: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ECFDF5',
    borderWidth: 2,
    borderColor: '#10B981',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  optionWrong: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEF2F2',
    borderWidth: 2,
    borderColor: '#EF4444',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  optionDisabled: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderWidth: 2,
    borderColor: '#F3F4F6',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    opacity: 0.6,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  optionLetter: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLetterSelected: {
    backgroundColor: Colors.primary,
  },
  optionLetterCorrect: {
    backgroundColor: '#10B981',
  },
  optionLetterWrong: {
    backgroundColor: '#EF4444',
  },
  optionLetterText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  optionLetterTextActive: {
    color: '#FFF',
  },
  optionText: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    lineHeight: 22,
  },
  optionTextSelected: {
    flex: 1,
    fontSize: 15,
    color: Colors.primary,
    fontWeight: '500',
    lineHeight: 22,
  },
  optionTextCorrect: {
    flex: 1,
    fontSize: 15,
    color: '#059669',
    fontWeight: '600',
    lineHeight: 22,
  },
  optionTextWrong: {
    flex: 1,
    fontSize: 15,
    color: '#DC2626',
    fontWeight: '500',
    lineHeight: 22,
  },
  optionTextDisabled: {
    flex: 1,
    fontSize: 15,
    color: Colors.textMuted,
    lineHeight: 22,
  },
  feedbackSection: {
    marginTop: 20,
    alignItems: 'center',
  },
  feedbackWithKiri: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 8,
  },
  kiriReaction: {
    marginRight: 8,
  },
  feedbackCorrect: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  feedbackCorrectText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#10B981',
  },
  streakMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  streakMessageText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#D97706',
  },
  feedbackWrong: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  feedbackWrongText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#EF4444',
  },
  idiomSummary: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    width: '100%',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryFrench: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: 4,
  },
  summaryMeaning: {
    fontSize: 15,
    color: Colors.text,
    marginBottom: 8,
  },
  summaryLiteral: {
    fontSize: 13,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  nextButton: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
  },
  nextButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  resultsGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  resultsContent: {
    alignItems: 'center',
    width: '100%',
  },
  trophyContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  resultsTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 16,
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  scoreCircle: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  scorePercentage: {
    fontSize: 40,
    fontWeight: '800',
    color: '#FFF',
  },
  scoreLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
  },
  encouragement: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.95)',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  resultsButtons: {
    width: '100%',
    gap: 12,
  },
  restartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  restartButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  backToIdiomsButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  backToIdiomsText: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
  },
});
