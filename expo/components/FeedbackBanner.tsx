import React, { useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { Check, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { USE_NATIVE_DRIVER } from '@/constants/animation';
import AnimatedPressable from '@/components/AnimatedPressable';

interface FeedbackBannerProps {
  isCorrect: boolean;
  correctAnswer: string;
  explanation: string;
  onContinue: () => void;
}

function FeedbackBannerInner({
  isCorrect,
  correctAnswer,
  explanation,
  onContinue,
}: FeedbackBannerProps) {
  const slideY = useRef(new Animated.Value(200)).current;
  const iconScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    void Haptics.impactAsync(
      isCorrect
        ? Haptics.ImpactFeedbackStyle.Light
        : Haptics.ImpactFeedbackStyle.Medium
    );

    Animated.spring(slideY, {
      toValue: 0,
      useNativeDriver: USE_NATIVE_DRIVER,
      speed: 12,
      bounciness: 8,
    }).start();

    Animated.sequence([
      Animated.delay(150),
      Animated.spring(iconScale, {
        toValue: 1,
        useNativeDriver: USE_NATIVE_DRIVER,
        speed: 14,
        bounciness: 12,
      }),
    ]).start();
  }, [slideY, iconScale, isCorrect]);

  const handleContinue = useCallback(() => {
    onContinue();
  }, [onContinue]);

  const bgColor = isCorrect ? '#059669' : '#DC2626';
  const bgColorLight = isCorrect ? '#047857' : '#B91C1C';

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: bgColor, transform: [{ translateY: slideY }] },
      ]}
    >
      <View style={styles.content}>
        <View style={styles.topRow}>
          <Animated.View
            style={[
              styles.iconCircle,
              { backgroundColor: bgColorLight, transform: [{ scale: iconScale }] },
            ]}
          >
            {isCorrect ? (
              <Check size={22} color="#fff" strokeWidth={3} />
            ) : (
              <X size={22} color="#fff" strokeWidth={3} />
            )}
          </Animated.View>
          <Text style={styles.title}>{isCorrect ? 'Correct!' : 'Incorrect'}</Text>
        </View>

        {!isCorrect && (
          <View style={styles.answerSection}>
            <Text style={styles.answerLabel}>Correct answer:</Text>
            <Text style={styles.answerText}>{correctAnswer}</Text>
          </View>
        )}

        {explanation.length > 0 && (
          <Text style={styles.explanation}>{explanation}</Text>
        )}

        <AnimatedPressable
          onPress={handleContinue}
          style={[styles.continueButton, { backgroundColor: bgColorLight }]}
          haptic="light"
          testID="feedback-continue"
        >
          <Text style={styles.continueText}>Continue</Text>
        </AnimatedPressable>
      </View>
    </Animated.View>
  );
}

export default React.memo(FeedbackBannerInner);

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    width: SCREEN_WIDTH,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 16,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 36,
  },
  topRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 14,
    marginBottom: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  title: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: '#fff',
  },
  answerSection: {
    marginBottom: 8,
  },
  answerLabel: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 4,
  },
  answerText: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: '#fff',
    lineHeight: 24,
  },
  explanation: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 20,
    marginBottom: 8,
  },
  continueButton: {
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center' as const,
  },
  continueText: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: '#fff',
  },
});
