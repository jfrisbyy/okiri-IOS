import React, { useEffect, useRef, useCallback, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Animated,
  View,
} from 'react-native';
import { Volume2 } from 'lucide-react-native';
import { USE_NATIVE_DRIVER } from '@/constants/animation';
import { audioService } from '@/utils/audioService';
import type { PlaybackSpeed } from '@/utils/audioService';

interface AudioSpeakerButtonProps {
  text: string;
  speed?: PlaybackSpeed;
  size?: number;
  color?: string;
  activeColor?: string;
  style?: object;
  disabled?: boolean;
  muted?: boolean;
  testID?: string;
}

function AudioSpeakerButtonInner({
  text,
  speed = 1.0,
  size = 20,
  color = '#F97316',
  activeColor = '#fff',
  style,
  disabled = false,
  muted = false,
  testID,
}: AudioSpeakerButtonProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const wave1 = useRef(new Animated.Value(0)).current;
  const wave2 = useRef(new Animated.Value(0)).current;
  const wave3 = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (isPlaying) {
      pulseAnim.current = Animated.loop(
        Animated.stagger(120, [
          Animated.sequence([
            Animated.timing(wave1, { toValue: 1, duration: 300, useNativeDriver: USE_NATIVE_DRIVER }),
            Animated.timing(wave1, { toValue: 0.3, duration: 300, useNativeDriver: USE_NATIVE_DRIVER }),
          ]),
          Animated.sequence([
            Animated.timing(wave2, { toValue: 1, duration: 300, useNativeDriver: USE_NATIVE_DRIVER }),
            Animated.timing(wave2, { toValue: 0.3, duration: 300, useNativeDriver: USE_NATIVE_DRIVER }),
          ]),
          Animated.sequence([
            Animated.timing(wave3, { toValue: 1, duration: 300, useNativeDriver: USE_NATIVE_DRIVER }),
            Animated.timing(wave3, { toValue: 0.3, duration: 300, useNativeDriver: USE_NATIVE_DRIVER }),
          ]),
        ])
      );
      pulseAnim.current.start();
    } else {
      pulseAnim.current?.stop();
      wave1.setValue(0);
      wave2.setValue(0);
      wave3.setValue(0);
    }

    return () => {
      pulseAnim.current?.stop();
    };
  }, [isPlaying, wave1, wave2, wave3]);

  const handlePress = useCallback(async () => {
    if (disabled || muted || !text?.trim()) return;

    if (isPlaying) {
      await audioService.stopCurrent();
      setIsPlaying(false);
      return;
    }

    setIsPlaying(true);
    try {
      await audioService.playFrenchAudio(text, speed);
    } catch (e) {
      console.log('[AudioSpeakerButton] Playback error:', e);
    } finally {
      setIsPlaying(false);
    }
  }, [text, speed, disabled, muted, isPlaying]);

  const barHeight1 = wave1.interpolate({
    inputRange: [0, 1],
    outputRange: [size * 0.25, size * 0.6],
  });
  const barHeight2 = wave2.interpolate({
    inputRange: [0, 1],
    outputRange: [size * 0.35, size * 0.75],
  });
  const barHeight3 = wave3.interpolate({
    inputRange: [0, 1],
    outputRange: [size * 0.2, size * 0.5],
  });

  const iconColor = isPlaying ? activeColor : color;
  const bgColor = isPlaying ? color : 'transparent';

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || muted}
      style={[
        styles.button,
        {
          width: size + 16,
          height: size + 16,
          borderRadius: (size + 16) / 2,
          backgroundColor: bgColor,
          opacity: muted ? 0.3 : 1,
        },
        style,
      ]}
      testID={testID}
      hitSlop={8}
    >
      {isPlaying ? (
        <View style={styles.waveContainer}>
          <Animated.View
            style={[
              styles.waveBar,
              {
                height: barHeight1,
                width: 3,
                backgroundColor: activeColor,
                borderRadius: 1.5,
              },
            ]}
          />
          <Animated.View
            style={[
              styles.waveBar,
              {
                height: barHeight2,
                width: 3,
                backgroundColor: activeColor,
                borderRadius: 1.5,
              },
            ]}
          />
          <Animated.View
            style={[
              styles.waveBar,
              {
                height: barHeight3,
                width: 3,
                backgroundColor: activeColor,
                borderRadius: 1.5,
              },
            ]}
          />
        </View>
      ) : (
        <Volume2 size={size} color={iconColor} />
      )}
    </Pressable>
  );
}

export default React.memo(AudioSpeakerButtonInner);

const styles = StyleSheet.create({
  button: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  waveContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 2,
  },
  waveBar: {
    minHeight: 4,
  },
});
