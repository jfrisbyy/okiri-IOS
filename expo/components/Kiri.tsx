import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing, Image } from 'react-native';
import { USE_NATIVE_DRIVER } from '@/constants/animation';

type KiriMood = 'idle' | 'happy' | 'thinking' | 'encouraging' | 'celebrating' | 'sad' | 'confused' | 'sleeping';

interface KiriProps {
  mood?: KiriMood;
  size?: number;
  style?: any;
}

const posesImage = require('../assets/kiri/poses.png');

export default function Kiri({ mood = 'idle', size = 120, style }: KiriProps) {
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    bounceAnim.setValue(0);
    scaleAnim.setValue(1);
    rotateAnim.setValue(0);
    
    let animations: Animated.CompositeAnimation[] = [];
    
    const startIdleAnimation = () => {
      const bounce = Animated.loop(
        Animated.sequence([
          Animated.timing(bounceAnim, {
            toValue: -4,
            duration: 1200,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.timing(bounceAnim, {
            toValue: 0,
            duration: 1200,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
        ])
      );
      bounce.start();
      animations.push(bounce);
      
      const breathe = Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1.02,
            duration: 2000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 2000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
        ])
      );
      breathe.start();
      animations.push(breathe);
    };
    
    const startHappyAnimation = () => {
      const bounce = Animated.loop(
        Animated.sequence([
          Animated.timing(bounceAnim, {
            toValue: -10,
            duration: 250,
            easing: Easing.out(Easing.quad),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.timing(bounceAnim, {
            toValue: 0,
            duration: 250,
            easing: Easing.in(Easing.quad),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
        ])
      );
      bounce.start();
      animations.push(bounce);
      
      const wobble = Animated.loop(
        Animated.sequence([
          Animated.timing(rotateAnim, {
            toValue: 1,
            duration: 150,
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.timing(rotateAnim, {
            toValue: -1,
            duration: 150,
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.timing(rotateAnim, {
            toValue: 0,
            duration: 150,
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
        ])
      );
      wobble.start();
      animations.push(wobble);
    };
    
    const startCelebratingAnimation = () => {
      const bounce = Animated.loop(
        Animated.sequence([
          Animated.timing(bounceAnim, {
            toValue: -15,
            duration: 180,
            easing: Easing.out(Easing.quad),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.timing(bounceAnim, {
            toValue: 0,
            duration: 180,
            easing: Easing.in(Easing.quad),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
        ])
      );
      bounce.start();
      animations.push(bounce);
      
      const pop = Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1.08,
            duration: 200,
            easing: Easing.out(Easing.back(2)),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
        ])
      );
      pop.start();
      animations.push(pop);
      
      const wiggle = Animated.loop(
        Animated.sequence([
          Animated.timing(rotateAnim, {
            toValue: 2,
            duration: 100,
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.timing(rotateAnim, {
            toValue: -2,
            duration: 100,
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
        ])
      );
      wiggle.start();
      animations.push(wiggle);
    };
    
    const startThinkingAnimation = () => {
      const slowBounce = Animated.loop(
        Animated.sequence([
          Animated.timing(bounceAnim, {
            toValue: -2,
            duration: 2000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.timing(bounceAnim, {
            toValue: 0,
            duration: 2000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
        ])
      );
      slowBounce.start();
      animations.push(slowBounce);
      
      const tilt = Animated.loop(
        Animated.sequence([
          Animated.timing(rotateAnim, {
            toValue: 0.5,
            duration: 3000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.timing(rotateAnim, {
            toValue: -0.5,
            duration: 3000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
        ])
      );
      tilt.start();
      animations.push(tilt);
    };
    
    const startEncouragingAnimation = () => {
      const bounce = Animated.loop(
        Animated.sequence([
          Animated.timing(bounceAnim, {
            toValue: -6,
            duration: 400,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.timing(bounceAnim, {
            toValue: 0,
            duration: 400,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
        ])
      );
      bounce.start();
      animations.push(bounce);
      
      const nod = Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1.03,
            duration: 500,
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
        ])
      );
      nod.start();
      animations.push(nod);
    };
    
    const startSadAnimation = () => {
      const droop = Animated.loop(
        Animated.sequence([
          Animated.timing(bounceAnim, {
            toValue: 3,
            duration: 1500,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.timing(bounceAnim, {
            toValue: 0,
            duration: 1500,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
        ])
      );
      droop.start();
      animations.push(droop);
      
      const shrink = Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 0.97,
            duration: 2000,
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
        ])
      );
      shrink.start();
      animations.push(shrink);
    };
    
    const startConfusedAnimation = () => {
      const tilt = Animated.loop(
        Animated.sequence([
          Animated.timing(rotateAnim, {
            toValue: 3,
            duration: 800,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.timing(rotateAnim, {
            toValue: -3,
            duration: 800,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
        ])
      );
      tilt.start();
      animations.push(tilt);
    };
    
    switch (mood) {
      case 'happy':
        startHappyAnimation();
        break;
      case 'celebrating':
        startCelebratingAnimation();
        break;
      case 'thinking':
        startThinkingAnimation();
        break;
      case 'encouraging':
        startEncouragingAnimation();
        break;
      case 'sad':
        startSadAnimation();
        break;
      case 'confused':
        startConfusedAnimation();
        break;
      case 'sleeping':
        const sleepBreath = Animated.loop(
          Animated.sequence([
            Animated.timing(scaleAnim, {
              toValue: 1.03,
              duration: 2500,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: USE_NATIVE_DRIVER,
            }),
            Animated.timing(scaleAnim, {
              toValue: 0.98,
              duration: 2500,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: USE_NATIVE_DRIVER,
            }),
          ])
        );
        sleepBreath.start();
        animations.push(sleepBreath);
        break;
      default:
        startIdleAnimation();
    }
    
    return () => {
      animations.forEach(anim => anim.stop());
      bounceAnim.stopAnimation();
      scaleAnim.stopAnimation();
      rotateAnim.stopAnimation();
    };
  }, [mood]);
  
  const getPoseClip = () => {
    const poseMap: Record<KiriMood, { row: number; col: number }> = {
      idle: { row: 2, col: 0 },
      happy: { row: 0, col: 0 },
      thinking: { row: 1, col: 1 },
      encouraging: { row: 2, col: 3 },
      celebrating: { row: 1, col: 2 },
      sad: { row: 0, col: 1 },
      confused: { row: 2, col: 1 },
      sleeping: { row: 0, col: 2 },
    };
    
    return poseMap[mood] || poseMap.idle;
  };
  
  const pose = getPoseClip();
  const cellWidth = size;
  const cellHeight = size;
  const imageWidth = cellWidth * 4;
  const imageHeight = cellHeight * 3;
  
  const rotateInterpolate = rotateAnim.interpolate({
    inputRange: [-3, 0, 3],
    outputRange: ['-3deg', '0deg', '3deg'],
  });
  
  return (
    <Animated.View 
      style={[
        styles.container, 
        style,
        { 
          transform: [
            { translateY: bounceAnim },
            { scale: scaleAnim },
            { rotate: rotateInterpolate },
          ],
          width: size,
          height: size,
        }
      ]}
    >
      <View 
        style={[
          styles.spriteContainer, 
          { 
            width: cellWidth, 
            height: cellHeight,
          }
        ]}
      >
        <Image
          source={posesImage}
          style={{
            width: imageWidth,
            height: imageHeight,
            position: 'absolute',
            left: -pose.col * cellWidth,
            top: -pose.row * cellHeight,
          }}
          resizeMode="cover"
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  spriteContainer: {
    overflow: 'hidden',
  },
});
