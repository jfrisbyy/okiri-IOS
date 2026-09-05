import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Heart } from 'lucide-react-native';
import { USE_NATIVE_DRIVER } from '@/constants/animation';

interface HeartsDisplayProps {
  hearts: number;
  maxHearts?: number;
}

const MAX_DEFAULT = 5;

function HeartsDisplayInner({ hearts, maxHearts = MAX_DEFAULT }: HeartsDisplayProps) {
  const [prevHearts, setPrevHearts] = useState(hearts);
  const heartAnims = useRef<Animated.Value[]>(
    Array.from({ length: maxHearts }, () => new Animated.Value(1))
  ).current;
  const shakeAnims = useRef<Animated.Value[]>(
    Array.from({ length: maxHearts }, () => new Animated.Value(0))
  ).current;
  const opacityAnims = useRef<Animated.Value[]>(
    Array.from({ length: maxHearts }, () => new Animated.Value(1))
  ).current;

  useEffect(() => {
    if (hearts < prevHearts) {
      const lostIndex = hearts;
      if (lostIndex >= 0 && lostIndex < maxHearts) {
        Animated.sequence([
          Animated.parallel([
            Animated.timing(heartAnims[lostIndex], {
              toValue: 1.4,
              duration: 100,
              useNativeDriver: USE_NATIVE_DRIVER,
            }),
            Animated.sequence([
              Animated.timing(shakeAnims[lostIndex], {
                toValue: -4,
                duration: 40,
                useNativeDriver: USE_NATIVE_DRIVER,
              }),
              Animated.timing(shakeAnims[lostIndex], {
                toValue: 4,
                duration: 40,
                useNativeDriver: USE_NATIVE_DRIVER,
              }),
              Animated.timing(shakeAnims[lostIndex], {
                toValue: -3,
                duration: 40,
                useNativeDriver: USE_NATIVE_DRIVER,
              }),
              Animated.timing(shakeAnims[lostIndex], {
                toValue: 3,
                duration: 40,
                useNativeDriver: USE_NATIVE_DRIVER,
              }),
              Animated.timing(shakeAnims[lostIndex], {
                toValue: 0,
                duration: 40,
                useNativeDriver: USE_NATIVE_DRIVER,
              }),
            ]),
          ]),
          Animated.parallel([
            Animated.timing(heartAnims[lostIndex], {
              toValue: 0.6,
              duration: 200,
              useNativeDriver: USE_NATIVE_DRIVER,
            }),
            Animated.timing(opacityAnims[lostIndex], {
              toValue: 0.4,
              duration: 200,
              useNativeDriver: USE_NATIVE_DRIVER,
            }),
          ]),
          Animated.parallel([
            Animated.timing(heartAnims[lostIndex], {
              toValue: 1,
              duration: 150,
              useNativeDriver: USE_NATIVE_DRIVER,
            }),
            Animated.timing(opacityAnims[lostIndex], {
              toValue: 1,
              duration: 150,
              useNativeDriver: USE_NATIVE_DRIVER,
            }),
          ]),
        ]).start();
      }
    }
    setPrevHearts(hearts);
  }, [hearts, prevHearts, maxHearts, heartAnims, shakeAnims, opacityAnims]);

  return (
    <View style={styles.container}>
      {Array.from({ length: maxHearts }, (_, i) => {
        const isFilled = i < hearts;
        return (
          <Animated.View
            key={i}
            style={{
              transform: [
                { scale: heartAnims[i] },
                { translateX: shakeAnims[i] },
              ],
              opacity: opacityAnims[i],
            }}
          >
            <Heart
              size={18}
              color={isFilled ? '#EF4444' : '#D1D5DB'}
              fill={isFilled ? '#EF4444' : 'transparent'}
            />
          </Animated.View>
        );
      })}
      {hearts <= 1 && hearts > 0 && (
        <Text style={styles.warningText}>!</Text>
      )}
    </View>
  );
}

export default React.memo(HeartsDisplayInner);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  warningText: {
    fontSize: 12,
    fontWeight: '800' as const,
    color: '#EF4444',
    marginLeft: 2,
  },
});
