import { useState, useRef, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Pressable,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { safeGoBack } from '@/utils/navigation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Volume2, RotateCcw, Check, Award } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { USE_NATIVE_DRIVER } from '@/constants/animation';
import { useApp } from '@/contexts/AppContext';
import { GapDifficulty } from '@/types';
import { useFrenchAudio } from '@/hooks/useFrenchAudio';

export default function ReviewScreen() {
  const router = useRouter();
  const { todayGaps, reviewGap } = useApp();
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const flipAnim = useRef(new Animated.Value(0)).current;
  const { speak, isSpeaking } = useFrenchAudio();

  const currentGap = todayGaps[currentIndex];

  const animateFlip = useCallback(() => {
    Animated.spring(flipAnim, {
      toValue: showAnswer ? 0 : 1,
      useNativeDriver: USE_NATIVE_DRIVER,
      tension: 80,
      friction: 8,
    }).start();
    setShowAnswer(!showAnswer);
  }, [showAnswer, flipAnim]);

  const animateNext = useCallback((callback: () => void) => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start(() => {
      callback();
      flipAnim.setValue(0);
      setShowAnswer(false);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: USE_NATIVE_DRIVER,
      }).start();
    });
  }, [fadeAnim, flipAnim]);

  const handleRate = useCallback(async (rating: GapDifficulty) => {
    if (!currentGap) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    await reviewGap(currentGap.id, rating);
    setReviewedCount(prev => prev + 1);
    
    if (currentIndex < todayGaps.length - 1) {
      animateNext(() => {
        setCurrentIndex(prev => prev + 1);
      });
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsComplete(true);
    }
  }, [currentGap, reviewGap, currentIndex, todayGaps.length, animateNext]);

  const handleShowAnswer = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    animateFlip();
  }, [animateFlip]);

  if (todayGaps.length === 0 || isComplete) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <Pressable onPress={() => safeGoBack()} style={styles.closeButton}>
              <X size={24} color={Colors.text} />
            </Pressable>
          </View>

          <View style={styles.completeContainer}>
            <View style={styles.completeIcon}>
              <Award size={48} color={Colors.primary} />
            </View>
            <Text style={styles.completeTitle}>
              {todayGaps.length === 0 ? 'No gaps to review' : 'Nice work!'}
            </Text>
            <Text style={styles.completeSubtitle}>
              {todayGaps.length === 0 
                ? 'Add gaps while reading or speaking to build your deck.'
                : `You strengthened ${reviewedCount} gaps today.`}
            </Text>
            <Pressable
              style={styles.doneButton}
              onPress={() => safeGoBack()}
            >
              <Text style={styles.doneButtonText}>Done</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const frontInterpolate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const backInterpolate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['180deg', '360deg'],
  });

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={() => safeGoBack()} style={styles.closeButton}>
            <X size={24} color={Colors.text} />
          </Pressable>
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { width: `${((currentIndex + 1) / todayGaps.length) * 100}%` }
                ]} 
              />
            </View>
            <Text style={styles.progressText}>
              {currentIndex + 1} / {todayGaps.length}
            </Text>
          </View>
          <View style={styles.placeholder} />
        </View>

        <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
          <Pressable onPress={handleShowAnswer} style={styles.cardWrapper}>
            <Animated.View 
              style={[
                styles.card,
                styles.cardFront,
                { transform: [{ rotateY: frontInterpolate }] },
              ]}
            >
              <Text style={styles.cardLabel}>French</Text>
              <Text style={styles.cardFrench}>{currentGap.frenchWord}</Text>
              <Pressable 
                style={[styles.audioButton, isSpeaking && styles.audioButtonActive]}
                onPress={() => speak(currentGap.frenchWord)}
              >
                <Volume2 size={24} color={isSpeaking ? Colors.textLight : Colors.primary} />
              </Pressable>
              {!showAnswer && (
                <Text style={styles.tapHint}>Tap to reveal meaning</Text>
              )}
            </Animated.View>

            <Animated.View 
              style={[
                styles.card,
                styles.cardBack,
                { transform: [{ rotateY: backInterpolate }] },
              ]}
            >
              <Text style={styles.cardLabel}>English</Text>
              <Text style={styles.cardEnglish}>{currentGap.englishTranslation}</Text>
              <View style={styles.explanationContainer}>
                <Text style={styles.explanationText}>{currentGap.explanation}</Text>
              </View>
              <Pressable 
                style={styles.exampleContainer}
                onPress={() => speak(currentGap.exampleSentence)}
              >
                <View style={styles.exampleHeader}>
                  <Text style={styles.exampleLabel}>Example</Text>
                  <Volume2 size={14} color={Colors.textMuted} />
                </View>
                <Text style={styles.exampleFrench}>{currentGap.exampleSentence}</Text>
                <Text style={styles.exampleEnglish}>{currentGap.exampleTranslation}</Text>
              </Pressable>
            </Animated.View>
          </Pressable>
        </Animated.View>

        {showAnswer && (
          <View style={styles.ratingContainer}>
            <Text style={styles.ratingLabel}>How well did you know this?</Text>
            <View style={styles.ratingButtons}>
              <Pressable
                style={[styles.ratingButton, styles.ratingHard]}
                onPress={() => handleRate('hard')}
              >
                <RotateCcw size={18} color={Colors.secondary} />
                <Text style={[styles.ratingText, styles.ratingTextHard]}>Hard</Text>
              </Pressable>
              <Pressable
                style={[styles.ratingButton, styles.ratingOkay]}
                onPress={() => handleRate('okay')}
              >
                <Check size={18} color={Colors.warning} />
                <Text style={[styles.ratingText, styles.ratingTextOkay]}>Okay</Text>
              </Pressable>
              <Pressable
                style={[styles.ratingButton, styles.ratingEasy]}
                onPress={() => handleRate('easy')}
              >
                <Award size={18} color={Colors.success} />
                <Text style={[styles.ratingText, styles.ratingTextEasy]}>Easy</Text>
              </Pressable>
            </View>
          </View>
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
  progressContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    gap: 10,
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
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.textMuted,
  },
  placeholder: {
    width: 44,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  cardWrapper: {
    height: 400,
  },
  card: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backgroundColor: Colors.backgroundCard,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 4,
    backfaceVisibility: 'hidden',
  },
  cardFront: {
    zIndex: 1,
  },
  cardBack: {
    zIndex: 0,
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 16,
  },
  cardFrench: {
    fontSize: 36,
    fontWeight: '700' as const,
    color: Colors.primary,
    textAlign: 'center',
    marginBottom: 24,
  },
  cardEnglish: {
    fontSize: 28,
    fontWeight: '600' as const,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 20,
  },
  audioButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  audioButtonActive: {
    backgroundColor: Colors.primary,
  },
  tapHint: {
    position: 'absolute',
    bottom: 28,
    fontSize: 14,
    color: Colors.textMuted,
  },
  explanationContainer: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    width: '100%',
  },
  explanationText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  exampleContainer: {
    width: '100%',
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 12,
    padding: 12,
  },
  exampleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  exampleLabel: {
    fontSize: 11,
    fontWeight: '500' as const,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  exampleFrench: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.text,
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 6,
  },
  exampleEnglish: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  ratingContainer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  ratingLabel: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  ratingButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  ratingButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 2,
  },
  ratingHard: {
    borderColor: Colors.secondary,
    backgroundColor: Colors.secondaryLight,
  },
  ratingOkay: {
    borderColor: Colors.warning,
    backgroundColor: Colors.warningLight,
  },
  ratingEasy: {
    borderColor: Colors.success,
    backgroundColor: Colors.successLight,
  },
  ratingText: {
    fontSize: 15,
    fontWeight: '600' as const,
  },
  ratingTextHard: {
    color: Colors.secondary,
  },
  ratingTextOkay: {
    color: Colors.warning,
  },
  ratingTextEasy: {
    color: Colors.success,
  },
  completeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
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
    marginBottom: 8,
  },
  completeSubtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
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
});
