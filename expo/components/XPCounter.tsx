import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Flame, Zap } from 'lucide-react-native';
import { USE_NATIVE_DRIVER } from '@/constants/animation';

interface XPCounterProps {
  xpGained: number;
  comboMultiplier: number;
  streak: number;
}

function XPCounterInner({ xpGained, comboMultiplier, streak }: XPCounterProps) {
  const [displayXP, setDisplayXP] = useState(0);
  const [showPop, setShowPop] = useState(false);
  const [lastXP, setLastXP] = useState(0);

  const popScale = useRef(new Animated.Value(0)).current;
  const popOpacity = useRef(new Animated.Value(0)).current;
  const popTranslateY = useRef(new Animated.Value(0)).current;

  const comboScale = useRef(new Animated.Value(1)).current;
  const comboOpacity = useRef(new Animated.Value(0)).current;
  const flameScale = useRef(new Animated.Value(1)).current;

  const badgeScale = useRef(new Animated.Value(1)).current;

  const isComboActive = streak >= 3;

  useEffect(() => {
    if (xpGained > lastXP && xpGained > 0) {
      const _diff = xpGained - lastXP;
      setLastXP(xpGained);
      setDisplayXP(xpGained);

      setShowPop(true);
      popScale.setValue(0.4);
      popOpacity.setValue(1);
      popTranslateY.setValue(0);

      Animated.parallel([
        Animated.spring(popScale, {
          toValue: 1,
          friction: 4,
          tension: 200,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(popTranslateY, {
          toValue: -30,
          duration: 800,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.sequence([
          Animated.delay(500),
          Animated.timing(popOpacity, {
            toValue: 0,
            duration: 300,
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
        ]),
      ]).start(() => setShowPop(false));

      Animated.sequence([
        Animated.timing(badgeScale, {
          toValue: 1.2,
          duration: 100,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.spring(badgeScale, {
          toValue: 1,
          friction: 4,
          tension: 150,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]).start();
    }
  }, [xpGained, lastXP, popScale, popOpacity, popTranslateY, badgeScale]);

  useEffect(() => {
    if (isComboActive) {
      Animated.timing(comboOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: USE_NATIVE_DRIVER,
      }).start();

      Animated.sequence([
        Animated.timing(comboScale, {
          toValue: 1.3,
          duration: 150,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.spring(comboScale, {
          toValue: 1,
          friction: 4,
          tension: 120,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(flameScale, {
            toValue: 1.2,
            duration: 400,
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.timing(flameScale, {
            toValue: 0.9,
            duration: 400,
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
        ])
      ).start();
    } else {
      Animated.timing(comboOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: USE_NATIVE_DRIVER,
      }).start();
      flameScale.setValue(1);
    }
  }, [isComboActive, comboOpacity, comboScale, flameScale]);

  return (
    <View style={styles.wrapper}>
      {showPop && (
        <Animated.View
          style={[
            styles.popBubble,
            {
              opacity: popOpacity,
              transform: [
                { translateY: popTranslateY },
                { scale: popScale },
              ],
            },
          ]}
          pointerEvents="none"
        >
          <Text style={styles.popText}>+{xpGained - (lastXP - (xpGained - lastXP + (xpGained - lastXP)))}</Text>
        </Animated.View>
      )}

      <Animated.View style={[styles.badge, { transform: [{ scale: badgeScale }] }]}>
        <Zap size={14} color="#F59E0B" />
        <Text style={styles.xpText}>{displayXP}</Text>
        <Text style={styles.xpLabel}>XP</Text>
      </Animated.View>

      {isComboActive && (
        <Animated.View
          style={[
            styles.comboBadge,
            {
              opacity: comboOpacity,
              transform: [{ scale: comboScale }],
            },
          ]}
        >
          <Animated.View style={{ transform: [{ scale: flameScale }] }}>
            <Flame size={12} color="#fff" />
          </Animated.View>
          <Text style={styles.comboText}>x{comboMultiplier}</Text>
        </Animated.View>
      )}
    </View>
  );
}

export default React.memo(XPCounterInner);

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    position: 'relative',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
    gap: 3,
  },
  xpText: {
    fontSize: 14,
    fontWeight: '800' as const,
    color: '#D97706',
  },
  xpLabel: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: '#D97706',
    opacity: 0.7,
  },
  popBubble: {
    position: 'absolute',
    top: -8,
    right: -4,
    backgroundColor: '#F97316',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    zIndex: 10,
  },
  popText: {
    fontSize: 12,
    fontWeight: '800' as const,
    color: '#fff',
  },
  comboBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EF4444',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 4,
    gap: 3,
  },
  comboText: {
    fontSize: 11,
    fontWeight: '800' as const,
    color: '#fff',
    letterSpacing: 0.5,
  },
});
