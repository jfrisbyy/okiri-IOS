import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
} from 'react-native';
import { BookOpen, Lightbulb, MessageCircle } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { DynamicLessonTeachItem } from '@/types';
import { USE_NATIVE_DRIVER } from '@/constants/animation';
import AnimatedPressable from '@/components/AnimatedPressable';
import AudioSpeakerButton from '@/components/AudioSpeakerButton';
import { audioService } from '@/utils/audioService';
import colors from '@/constants/colors';

interface ConceptTeachCardProps {
  teachItem: DynamicLessonTeachItem;
  onContinue: () => void;
  muted?: boolean;
}

function highlightTarget(sentence: string, target?: string): React.ReactNode[] {
  if (!target || !sentence.includes(target)) {
    return [<Text key="full">{sentence}</Text>];
  }
  const parts = sentence.split(target);
  const nodes: React.ReactNode[] = [];
  parts.forEach((part, i) => {
    if (part) nodes.push(<Text key={`p-${i}`}>{part}</Text>);
    if (i < parts.length - 1) {
      nodes.push(
        <Text key={`h-${i}`} style={styles.highlightedWord}>
          {target}
        </Text>
      );
    }
  });
  return nodes;
}

function ConceptTeachCardInner({ teachItem, onContinue, muted = false }: ConceptTeachCardProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideX = useRef(new Animated.Value(60)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.spring(slideX, {
        toValue: 0,
        speed: 14,
        bounciness: 4,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start();
  }, [fadeAnim, slideX]);

  useEffect(() => {
    if (!muted && teachItem.french) {
      const timer = setTimeout(() => {
        audioService.playFrenchAudio(teachItem.french || '').catch(() => {});
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [teachItem.french, muted]);

  const isExample = teachItem.type === 'example';
  const isTip = teachItem.type === 'tip';

  const IconComponent = isTip ? Lightbulb : isExample ? MessageCircle : BookOpen;
  const typeLabel = isTip ? 'Tip' : isExample ? 'Example' : 'Concept';

  return (
    <Animated.View
      style={[
        styles.outer,
        {
          opacity: fadeAnim,
          transform: [{ translateX: slideX }],
        },
      ]}
    >
      <LinearGradient
        colors={['#1E293B', '#1A1F3A', '#211D35']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <View style={styles.badge}>
          <IconComponent size={14} color={colors.primary} />
          <Text style={styles.badgeText}>{typeLabel}</Text>
        </View>

        {teachItem.french ? (
          <View style={styles.frenchRow}>
            <Text style={styles.frenchTitle}>{teachItem.french}</Text>
            <AudioSpeakerButton
              text={teachItem.french}
              size={22}
              color="rgba(255,255,255,0.7)"
              activeColor="#fff"
              muted={muted}
              style={styles.speakerBtn}
            />
          </View>
        ) : null}

        {teachItem.english ? (
          <Text style={styles.englishSubtitle}>{teachItem.english}</Text>
        ) : null}

        {!isExample && teachItem.content ? (
          <View style={styles.explanationBox}>
            <Text style={styles.explanationText}>{teachItem.content}</Text>
          </View>
        ) : null}

        {isExample && teachItem.content ? (
          <View style={styles.exampleBlock}>
            <View style={styles.exampleLine} />
            <View style={styles.exampleContent}>
              <Text style={styles.exampleFrench}>
                {highlightTarget(teachItem.content, teachItem.french)}
              </Text>
              {teachItem.english ? (
                <Text style={styles.exampleEnglish}>{teachItem.english}</Text>
              ) : null}
            </View>
          </View>
        ) : null}

        {!isExample && teachItem.french && teachItem.content ? (
          <View style={styles.exampleBlock}>
            <View style={styles.exampleLine} />
            <View style={styles.exampleContent}>
              <Text style={styles.exampleFrench}>
                {highlightTarget(
                  teachItem.french,
                  undefined
                )}
              </Text>
              {teachItem.english ? (
                <Text style={styles.exampleEnglish}>{teachItem.english}</Text>
              ) : null}
            </View>
          </View>
        ) : null}

        <AnimatedPressable
          onPress={onContinue}
          style={styles.continueButton}
          haptic="light"
          testID="concept-teach-continue"
        >
          <Text style={styles.continueText}>Got it!</Text>
        </AnimatedPressable>
      </LinearGradient>
    </Animated.View>
  );
}

export default React.memo(ConceptTeachCardInner);

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  card: {
    flex: 1,
    borderRadius: 20,
    padding: 24,
    justifyContent: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(249,115,22,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 20,
    gap: 6,
  },
  badgeText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600' as const,
    letterSpacing: 0.3,
  },
  frenchRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginBottom: 6,
  },
  frenchTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700' as const,
    letterSpacing: -0.3,
    flex: 1,
  },
  speakerBtn: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  englishSubtitle: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 16,
    fontWeight: '400' as const,
    marginBottom: 24,
  },
  explanationBox: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
  },
  explanationText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 15,
    lineHeight: 23,
    fontWeight: '400' as const,
  },
  exampleBlock: {
    flexDirection: 'row' as const,
    marginBottom: 28,
    gap: 14,
  },
  exampleLine: {
    width: 3,
    borderRadius: 2,
    backgroundColor: colors.primary,
    opacity: 0.7,
  },
  exampleContent: {
    flex: 1,
    gap: 6,
  },
  exampleFrench: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '500' as const,
    lineHeight: 25,
  },
  highlightedWord: {
    color: colors.primary,
    fontWeight: '700' as const,
  },
  exampleEnglish: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 14,
    fontStyle: 'italic' as const,
    lineHeight: 20,
  },
  continueButton: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center' as const,
    marginTop: 'auto' as const,
  },
  continueText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700' as const,
    letterSpacing: 0.2,
  },
});
