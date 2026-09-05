import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Animated,
} from 'react-native';
import { Mic, MicOff } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { USE_NATIVE_DRIVER } from '@/constants/animation';

interface MicrophoneButtonProps {
  isRecording: boolean;
  onPressIn: () => void;
  onPressOut: () => void;
  disabled?: boolean;
}

const MicrophoneButton = React.memo(function MicrophoneButton({
  isRecording,
  onPressIn,
  onPressOut,
  disabled = false,
}: MicrophoneButtonProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const waveAnims = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  useEffect(() => {
    if (isRecording) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.08, duration: 800, useNativeDriver: USE_NATIVE_DRIVER }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: USE_NATIVE_DRIVER }),
        ])
      );
      pulse.start();

      Animated.timing(glowAnim, { toValue: 1, duration: 300, useNativeDriver: USE_NATIVE_DRIVER }).start();

      const waveAnimations = waveAnims.map((anim, i) =>
        Animated.loop(
          Animated.sequence([
            Animated.delay(i * 100),
            Animated.timing(anim, { toValue: 1, duration: 400, useNativeDriver: USE_NATIVE_DRIVER }),
            Animated.timing(anim, { toValue: 0.3, duration: 400, useNativeDriver: USE_NATIVE_DRIVER }),
          ])
        )
      );
      waveAnimations.forEach(a => a.start());

      return () => {
        pulse.stop();
        waveAnimations.forEach(a => a.stop());
      };
    } else {
      pulseAnim.setValue(1);
      Animated.timing(glowAnim, { toValue: 0, duration: 200, useNativeDriver: USE_NATIVE_DRIVER }).start();
      waveAnims.forEach(a => a.setValue(0));
    }
  }, [isRecording, pulseAnim, glowAnim, waveAnims]);

  return (
    <View style={styles.wrapper}>
      {isRecording && (
        <View style={styles.waveformContainer}>
          {waveAnims.map((anim, i) => (
            <Animated.View
              key={i}
              style={[
                styles.waveBar,
                {
                  transform: [{
                    scaleY: anim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.3, 1],
                    }),
                  }],
                  opacity: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.4, 1],
                  }),
                },
              ]}
            />
          ))}
        </View>
      )}

      <Animated.View
        style={[
          styles.glowRing,
          {
            opacity: glowAnim,
            transform: [{ scale: pulseAnim.interpolate({ inputRange: [1, 1.08], outputRange: [1, 1.3] }) }],
          },
        ]}
      />

      <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
        <Pressable
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          disabled={disabled}
          style={[
            styles.button,
            isRecording && styles.buttonRecording,
            disabled && styles.buttonDisabled,
          ]}
          testID="mic-button"
        >
          {disabled ? (
            <MicOff size={32} color="#FFFFFF" />
          ) : (
            <Mic size={32} color="#FFFFFF" />
          )}
        </Pressable>
      </Animated.View>
    </View>
  );
});

export default MicrophoneButton;

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowRing: {
    position: 'absolute' as const,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary + '30',
  },
  button: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonRecording: {
    backgroundColor: '#EF4444',
    shadowColor: '#EF4444',
  },
  buttonDisabled: {
    backgroundColor: '#CBD5E1',
    shadowOpacity: 0,
    elevation: 0,
  },
  waveformContainer: {
    position: 'absolute' as const,
    top: -40,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 4,
    height: 30,
  },
  waveBar: {
    width: 4,
    height: 24,
    borderRadius: 2,
    backgroundColor: Colors.primary,
  },
});
