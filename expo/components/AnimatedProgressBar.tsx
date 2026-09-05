import React, { useEffect, useRef, useState } from 'react';
import { Animated, View, ViewStyle, StyleProp, LayoutChangeEvent } from 'react-native';

interface AnimatedProgressBarProps {
  progress: number;
  color?: string;
  trackColor?: string;
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  delay?: number;
  duration?: number;
}

export default function AnimatedProgressBar({
  progress,
  color = '#F97316',
  trackColor = '#F0E0DA',
  height = 6,
  borderRadius = 3,
  style,
  delay = 0,
  duration = 800,
}: AnimatedProgressBarProps) {
  const widthAnim = useRef(new Animated.Value(0)).current;
  const [containerWidth, setContainerWidth] = useState<number>(0);

  useEffect(() => {
    const clampedProgress = Math.min(Math.max(progress, 0), 100) / 100;
    Animated.timing(widthAnim, {
      toValue: clampedProgress,
      duration,
      delay,
      useNativeDriver: false,
    }).start();
  }, [progress, delay, duration, widthAnim]);

  const handleLayout = (e: LayoutChangeEvent) => {
    setContainerWidth(e.nativeEvent.layout.width);
  };

  return (
    <View
      style={[{ height, backgroundColor: trackColor, borderRadius, overflow: 'hidden' as const }, style]}
      onLayout={handleLayout}
    >
      <Animated.View
        style={{
          height: '100%',
          backgroundColor: color,
          borderRadius,
          width: containerWidth > 0
            ? widthAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, containerWidth],
              })
            : 0,
        }}
      />
    </View>
  );
}
