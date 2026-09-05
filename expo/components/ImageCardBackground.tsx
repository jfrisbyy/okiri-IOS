import React, { useState, useCallback, useEffect, useRef } from 'react';
import { ImageBackground, View, StyleSheet, ImageStyle, StyleProp, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface ImageCardBackgroundProps {
  uri: string;
  fallbackUri: string;
  gradientColors?: [string, string, ...string[]];
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  children: React.ReactNode;
}

function ImageCardBackgroundComponent({
  uri,
  fallbackUri,
  gradientColors = ['#1C1C2E', '#2D1B4E', '#1a1a2e'],
  children,
  style,
  imageStyle,
}: ImageCardBackgroundProps) {
  const getInitialPhase = (): 'primary' | 'fallback' | 'gradient' => {
    if (uri && uri.startsWith('http')) return 'primary';
    if (fallbackUri && fallbackUri.startsWith('http')) return 'fallback';
    return 'gradient';
  };

  const [phase, setPhase] = useState<'primary' | 'fallback' | 'gradient'>(getInitialPhase);
  const prevUri = useRef(uri);

  useEffect(() => {
    if (uri !== prevUri.current) {
      prevUri.current = uri;
      if (uri && uri.startsWith('http')) {
        setPhase('primary');
      } else if (fallbackUri && fallbackUri.startsWith('http')) {
        setPhase('fallback');
      } else {
        setPhase('gradient');
      }
    }
  }, [uri, fallbackUri]);

  const handleError = useCallback(() => {
    setPhase(prev => {
      if (prev === 'primary') {
        if (fallbackUri && fallbackUri.startsWith('http') && fallbackUri !== uri) {
          console.log('[ImageCard] Primary image failed, trying fallback');
          return 'fallback';
        }
        console.log('[ImageCard] Primary image failed, using gradient');
        return 'gradient';
      }
      console.log('[ImageCard] Fallback image failed, using gradient');
      return 'gradient';
    });
  }, [fallbackUri, uri]);

  if (phase === 'gradient') {
    return (
      <View style={[style, styles.container]}>
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {children}
      </View>
    );
  }

  const currentUri = phase === 'primary' ? uri : fallbackUri;

  return (
    <ImageBackground
      source={{ uri: currentUri }}
      style={style}
      imageStyle={imageStyle}
      resizeMode="cover"
      onError={handleError}
    >
      {children}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden' as const,
  },
});

export default React.memo(ImageCardBackgroundComponent);
