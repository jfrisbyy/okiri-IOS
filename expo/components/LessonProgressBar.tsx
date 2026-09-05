import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { USE_NATIVE_DRIVER } from '@/constants/animation';
import colors from '@/constants/colors';

interface LessonProgressBarProps {
  totalQuestions: number;
  currentIndex: number;
  results: boolean[];
}

function LessonProgressBarInner({ totalQuestions, currentIndex, results }: LessonProgressBarProps) {
  const fillAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fillAnim.setValue(0);
    Animated.timing(fillAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [currentIndex, fillAnim]);

  const segments: React.ReactNode[] = [];
  for (let i = 0; i < totalQuestions; i++) {
    const isAnswered = i < results.length;
    const isCurrent = i === currentIndex;
    const isCorrect = isAnswered ? results[i] : undefined;

    let segmentColor = '#E2E2E2';
    if (isAnswered && isCorrect === true) segmentColor = colors.success;
    if (isAnswered && isCorrect === false) segmentColor = colors.error;

    segments.push(
      <View
        key={i}
        style={[
          styles.segment,
          i === 0 && styles.segmentFirst,
          i === totalQuestions - 1 && styles.segmentLast,
          { backgroundColor: isAnswered ? segmentColor : '#E8E8E8' },
        ]}
      >
        {isCurrent && !isAnswered ? (
          <Animated.View
            style={[
              styles.fillBar,
              {
                backgroundColor: colors.primary,
                transform: [{
                  scaleX: fillAnim,
                }],
              },
            ]}
          />
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.container} testID="lesson-progress-bar">
      {segments}
    </View>
  );
}

export default React.memo(LessonProgressBarInner);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 3,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  segment: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
  },
  segmentFirst: {
    borderTopLeftRadius: 3,
    borderBottomLeftRadius: 3,
  },
  segmentLast: {
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  fillBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    right: 0,
    transformOrigin: 'left',
  },
});
