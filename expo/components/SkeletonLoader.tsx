import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, ViewStyle } from 'react-native';
import Colors from '@/constants/colors';
import { USE_NATIVE_DRIVER } from '@/constants/animation';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

function SkeletonBlock({ width = '100%', height = 16, borderRadius = 8, style }: SkeletonProps) {
  const pulseAnim = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.7, duration: 700, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(pulseAnim, { toValue: 0.35, duration: 700, useNativeDriver: USE_NATIVE_DRIVER }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulseAnim]);

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: Colors.border,
          opacity: pulseAnim,
        },
        style,
      ]}
    />
  );
}

function HomeScreenSkeleton() {
  return (
    <View style={skeletonStyles.container}>
      <View style={skeletonStyles.headerBlock}>
        <SkeletonBlock width={120} height={28} borderRadius={10} />
        <SkeletonBlock width={100} height={24} borderRadius={12} />
      </View>

      <View style={skeletonStyles.statsCard}>
        <View style={skeletonStyles.statsRow}>
          <SkeletonBlock width={80} height={20} />
          <SkeletonBlock width={56} height={56} borderRadius={28} />
        </View>
        <SkeletonBlock width="70%" height={6} borderRadius={3} style={{ marginTop: 12 }} />
        <SkeletonBlock width="50%" height={14} borderRadius={6} style={{ marginTop: 10 }} />
      </View>

      <View style={skeletonStyles.cefrCard}>
        <SkeletonBlock width="60%" height={14} />
        <SkeletonBlock width="100%" height={10} borderRadius={5} style={{ marginTop: 10 }} />
        <View style={skeletonStyles.cefrSubBars}>
          <SkeletonBlock width="45%" height={8} borderRadius={4} />
          <SkeletonBlock width="45%" height={8} borderRadius={4} />
        </View>
      </View>

      <View style={skeletonStyles.sectionBlock}>
        <SkeletonBlock width={160} height={18} style={{ marginBottom: 12 }} />
        {[0, 1, 2].map(i => (
          <View key={i} style={skeletonStyles.recCard}>
            <SkeletonBlock width={42} height={42} borderRadius={12} />
            <View style={{ flex: 1, marginLeft: 12, gap: 6 }}>
              <SkeletonBlock width="60%" height={14} />
              <SkeletonBlock width="40%" height={10} />
            </View>
            <SkeletonBlock width={60} height={24} borderRadius={10} />
          </View>
        ))}
      </View>

      <View style={skeletonStyles.weekRow}>
        {[0, 1, 2].map(i => (
          <View key={i} style={skeletonStyles.weekCard}>
            <SkeletonBlock width={32} height={32} borderRadius={10} />
            <SkeletonBlock width={30} height={20} style={{ marginTop: 8 }} />
            <SkeletonBlock width={50} height={10} style={{ marginTop: 4 }} />
          </View>
        ))}
      </View>
    </View>
  );
}

function ArticleSkeleton() {
  return (
    <View style={skeletonStyles.container}>
      <SkeletonBlock width="100%" height={240} borderRadius={0} />
      <View style={{ padding: 20, gap: 14 }}>
        <SkeletonBlock width="90%" height={22} />
        <SkeletonBlock width="60%" height={14} />
        <View style={{ marginTop: 8, gap: 10 }}>
          <SkeletonBlock width="100%" height={14} />
          <SkeletonBlock width="100%" height={14} />
          <SkeletonBlock width="85%" height={14} />
          <SkeletonBlock width="100%" height={14} />
          <SkeletonBlock width="70%" height={14} />
        </View>
        <View style={{ marginTop: 12, gap: 10 }}>
          <SkeletonBlock width="100%" height={14} />
          <SkeletonBlock width="95%" height={14} />
          <SkeletonBlock width="80%" height={14} />
        </View>
      </View>
    </View>
  );
}

function VideoSessionSkeleton() {
  return (
    <View style={skeletonStyles.container}>
      <SkeletonBlock width="100%" height={220} borderRadius={0} />
      <View style={{ padding: 16, gap: 12 }}>
        <SkeletonBlock width="80%" height={18} />
        <SkeletonBlock width="50%" height={12} />
        <View style={{ marginTop: 16, gap: 14 }}>
          {[0, 1, 2, 3, 4, 5].map(i => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <SkeletonBlock width={40} height={14} borderRadius={6} />
              <SkeletonBlock width="75%" height={14} />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function LessonSkeleton() {
  return (
    <View style={skeletonStyles.container}>
      <View style={{ padding: 20, gap: 16 }}>
        <View style={skeletonStyles.lessonHeader}>
          <SkeletonBlock width={36} height={36} borderRadius={18} />
          <SkeletonBlock width="60%" height={8} borderRadius={4} />
          <SkeletonBlock width={36} height={36} borderRadius={18} />
        </View>

        <View style={skeletonStyles.lessonConceptCard}>
          <SkeletonBlock width={60} height={24} borderRadius={8} />
          <SkeletonBlock width="80%" height={20} style={{ marginTop: 14 }} />
          <SkeletonBlock width="50%" height={14} style={{ marginTop: 8 }} />
        </View>

        <View style={skeletonStyles.lessonQuestionArea}>
          <SkeletonBlock width="90%" height={18} />
          <SkeletonBlock width="70%" height={18} style={{ marginTop: 8 }} />
          <View style={{ marginTop: 20, gap: 12 }}>
            {[0, 1, 2, 3].map(i => (
              <SkeletonBlock key={i} width="100%" height={52} borderRadius={14} />
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

function CardListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <View style={skeletonStyles.container}>
      <View style={{ padding: 16, gap: 12 }}>
        {Array.from({ length: count }).map((_, i) => (
          <View key={i} style={skeletonStyles.genericCard}>
            <SkeletonBlock width={48} height={48} borderRadius={14} />
            <View style={{ flex: 1, marginLeft: 12, gap: 6 }}>
              <SkeletonBlock width="70%" height={16} />
              <SkeletonBlock width="50%" height={12} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

export {
  SkeletonBlock,
  HomeScreenSkeleton,
  ArticleSkeleton,
  VideoSessionSkeleton,
  LessonSkeleton,
  CardListSkeleton,
};

const skeletonStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerBlock: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  statsCard: {
    marginHorizontal: 16,
    backgroundColor: Colors.backgroundCard,
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cefrCard: {
    marginHorizontal: 16,
    backgroundColor: Colors.backgroundCard,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  cefrSubBars: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  sectionBlock: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  recCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  weekRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 16,
  },
  weekCard: {
    flex: 1,
    backgroundColor: Colors.backgroundCard,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
  },
  lessonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lessonConceptCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 16,
    padding: 20,
  },
  lessonQuestionArea: {
    marginTop: 8,
  },
  genericCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: 16,
    padding: 16,
  },
});
