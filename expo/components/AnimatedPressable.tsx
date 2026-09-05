import React, { useRef, useCallback } from 'react';
import { Animated, Pressable, PressableProps, ViewStyle, StyleProp, GestureResponderEvent } from 'react-native';
import { USE_NATIVE_DRIVER } from '@/constants/animation';
import * as Haptics from 'expo-haptics';

interface AnimatedPressableProps extends Omit<PressableProps, 'style'> {
  scaleValue?: number;
  haptic?: 'light' | 'medium' | 'heavy' | 'none';
  style?: StyleProp<ViewStyle>;
}

export default function AnimatedPressable({
  scaleValue = 0.97,
  haptic = 'light',
  onPressIn,
  onPressOut,
  onPress,
  style,
  children,
  ...props
}: AnimatedPressableProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback((e: GestureResponderEvent) => {
    Animated.spring(scaleAnim, {
      toValue: scaleValue,
      useNativeDriver: USE_NATIVE_DRIVER,
      speed: 50,
      bounciness: 4,
    }).start();
    onPressIn?.(e);
  }, [scaleAnim, scaleValue, onPressIn]);

  const handlePressOut = useCallback((e: GestureResponderEvent) => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: USE_NATIVE_DRIVER,
      speed: 40,
      bounciness: 6,
    }).start();
    onPressOut?.(e);
  }, [scaleAnim, onPressOut]);

  const handlePress = useCallback((e: GestureResponderEvent) => {
    if (haptic !== 'none') {
      const feedbackStyle = haptic === 'heavy'
        ? Haptics.ImpactFeedbackStyle.Heavy
        : haptic === 'medium'
        ? Haptics.ImpactFeedbackStyle.Medium
        : Haptics.ImpactFeedbackStyle.Light;
      Haptics.impactAsync(feedbackStyle);
    }
    onPress?.(e);
  }, [haptic, onPress]);

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        style={style}
        {...props}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
