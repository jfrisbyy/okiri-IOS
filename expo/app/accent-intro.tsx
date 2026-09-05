import { useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Animated,
  Dimensions,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  AudioLines,
  Ear,
  Brain,
  Music,
  ArrowRight,
  Quote,
  Sparkles,
  Globe,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { USE_NATIVE_DRIVER } from '@/constants/animation';
import Kiri from '@/components/Kiri';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const PHILOSOPHY_POINTS = [
  {
    icon: 'ear',
    title: 'Sound Before Meaning',
    body: "Children don't learn their native language by studying grammar tables. They absorb the music of the language first \u2014 the rhythm, the melody, the feel of each sound on their tongue. That's exactly what you're about to do.",
    accent: '#14B8A6',
  },
  {
    icon: 'music',
    title: 'French Is a Musical Language',
    body: "Every French accent has a distinct cadence \u2014 the way syllables flow, the way vowels resonate, the way the throat shapes the iconic French R. If you get this right first, every word you learn later will sound authentic.",
    accent: '#0EA5E9',
  },
  {
    icon: 'brain',
    title: 'Muscle Memory Takes Priority',
    body: "Your mouth has never made these sounds before. The nasal vowels, the uvular R, the precise lip rounding \u2014 these are physical skills. Like learning an instrument, you need to train your muscles before you play the song.",
    accent: '#8B5CF6',
  },
];

export default function AccentIntroScreen() {
  const router = useRouter();

  const heroFade = useRef(new Animated.Value(0)).current;
  const heroSlide = useRef(new Animated.Value(30)).current;
  const quoteOpacity = useRef(new Animated.Value(0)).current;
  const quoteSlide = useRef(new Animated.Value(20)).current;
  const cardAnims = useRef(PHILOSOPHY_POINTS.map(() => new Animated.Value(0))).current;
  const cardSlides = useRef(PHILOSOPHY_POINTS.map(() => new Animated.Value(40))).current;
  const dividerWidth = useRef(new Animated.Value(0)).current;
  const outroFade = useRef(new Animated.Value(0)).current;
  const outroSlide = useRef(new Animated.Value(30)).current;
  const ctaScale = useRef(new Animated.Value(0.9)).current;
  const ctaOpacity = useRef(new Animated.Value(0)).current;
  const kiriOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(heroFade, { toValue: 1, duration: 600, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(heroSlide, { toValue: 0, duration: 600, useNativeDriver: USE_NATIVE_DRIVER }),
      ]),
      Animated.delay(200),
      Animated.parallel([
        Animated.timing(quoteOpacity, { toValue: 1, duration: 500, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(quoteSlide, { toValue: 0, duration: 500, useNativeDriver: USE_NATIVE_DRIVER }),
      ]),
      Animated.delay(100),
      Animated.timing(dividerWidth, { toValue: 1, duration: 400, useNativeDriver: false }),
      Animated.stagger(180, cardAnims.map((anim, i) =>
        Animated.parallel([
          Animated.timing(anim, { toValue: 1, duration: 450, useNativeDriver: USE_NATIVE_DRIVER }),
          Animated.timing(cardSlides[i], { toValue: 0, duration: 450, useNativeDriver: USE_NATIVE_DRIVER }),
        ])
      )),
      Animated.delay(100),
      Animated.parallel([
        Animated.timing(outroFade, { toValue: 1, duration: 500, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(outroSlide, { toValue: 0, duration: 500, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(kiriOpacity, { toValue: 1, duration: 500, useNativeDriver: USE_NATIVE_DRIVER }),
      ]),
      Animated.delay(100),
      Animated.parallel([
        Animated.spring(ctaScale, { toValue: 1, tension: 60, friction: 8, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(ctaOpacity, { toValue: 1, duration: 350, useNativeDriver: USE_NATIVE_DRIVER }),
      ]),
    ]).start();
  }, []);

  const handleChooseAccent = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/accent-explorer' as any);
  }, [router]);

  const renderIcon = useCallback((iconName: string, color: string) => {
    switch (iconName) {
      case 'ear': return <Ear size={24} color={color} />;
      case 'music': return <Music size={24} color={color} />;
      case 'brain': return <Brain size={24} color={color} />;
      default: return <AudioLines size={24} color={color} />;
    }
  }, []);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <LinearGradient
        colors={['#134E4A', '#0F766E', '#0D9488']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
      />

      <View style={styles.bgShapes}>
        <View style={styles.bgCircle1} />
        <View style={styles.bgCircle2} />
        <View style={styles.bgCircle3} />
      </View>

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            style={[
              styles.heroSection,
              { opacity: heroFade, transform: [{ translateY: heroSlide }] },
            ]}
          >
            <View style={styles.heroIconContainer}>
              <AudioLines size={36} color="#0D9488" />
            </View>
            <Text style={styles.heroLabel}>ACCENT PHASE</Text>
            <Text style={styles.heroTitle}>
              Before You Learn{'\n'}a Single Word
            </Text>
            <Text style={styles.heroSubtitle}>
              The most important skill in language isn't vocabulary.{'\n'}It's how you sound.
            </Text>
          </Animated.View>

          <Animated.View
            style={[
              styles.quoteCard,
              { opacity: quoteOpacity, transform: [{ translateY: quoteSlide }] },
            ]}
          >
            <View style={styles.quoteIconWrapper}>
              <Quote size={20} color="rgba(255,255,255,0.4)" />
            </View>
            <Text style={styles.quoteText}>
              {"\""}A person who speaks with a perfect accent but limited vocabulary will always be understood. A person with perfect grammar but a foreign accent will always be corrected.{"\""}
            </Text>
          </Animated.View>

          <Animated.View style={[styles.dividerContainer, {
            transform: [{ scaleX: dividerWidth }],
          }]}>
            <View style={styles.divider} />
          </Animated.View>

          <View style={styles.philosophySection}>
            <Text style={styles.sectionLabel}>THE PHILOSOPHY</Text>

            {PHILOSOPHY_POINTS.map((point, index) => (
              <Animated.View
                key={point.title}
                style={[
                  styles.philosophyCard,
                  {
                    opacity: cardAnims[index],
                    transform: [{ translateY: cardSlides[index] }],
                  },
                ]}
              >
                <View style={[styles.philosophyIconBg, { backgroundColor: `${point.accent}20` }]}>
                  {renderIcon(point.icon, point.accent)}
                </View>
                <View style={styles.philosophyContent}>
                  <Text style={styles.philosophyTitle}>{point.title}</Text>
                  <Text style={styles.philosophyBody}>{point.body}</Text>
                </View>
              </Animated.View>
            ))}
          </View>

          <Animated.View
            style={[
              styles.outroSection,
              { opacity: outroFade, transform: [{ translateY: outroSlide }] },
            ]}
          >
            <View style={styles.ruleCard}>
              <View style={styles.ruleHeader}>
                <Sparkles size={20} color="#FBBF24" />
                <Text style={styles.ruleHeaderText}>The Only Rule</Text>
              </View>
              <Text style={styles.ruleBody}>
                In this phase, nothing matters except your accent and your voice. You won't be tested on meaning. You won't be graded on vocabulary. The only question is:{' '}
                <Text style={styles.ruleEmphasis}>does it sound French?</Text>
              </Text>
              <Text style={styles.ruleFooter}>
                The knowledge will come later. First, we build the instrument.
              </Text>
            </View>
          </Animated.View>

          <Animated.View style={[styles.kiriSection, { opacity: kiriOpacity }]}>
            <Kiri mood="encouraging" size={90} />
          </Animated.View>

          <Animated.View
            style={[
              styles.ctaSection,
              {
                opacity: ctaOpacity,
                transform: [{ scale: ctaScale }],
              },
            ]}
          >
            <Text style={styles.ctaLabel}>
              French sounds different depending on where it's spoken.
            </Text>
            <Text style={styles.ctaSublabel}>
              Choose the accent that resonates with you.
            </Text>

            <Pressable
              style={({ pressed }) => [
                styles.ctaButton,
                pressed && styles.ctaButtonPressed,
              ]}
              onPress={handleChooseAccent}
              testID="choose-accent-btn"
            >
              <Globe size={22} color="#134E4A" />
              <Text style={styles.ctaButtonText}>Choose Your Accent</Text>
              <ArrowRight size={20} color="#134E4A" />
            </Pressable>
          </Animated.View>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#134E4A',
  },
  bgShapes: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  bgCircle1: {
    position: 'absolute',
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: 'rgba(255,255,255,0.03)',
    top: -100,
    right: -120,
  },
  bgCircle2: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(255,255,255,0.025)',
    bottom: 100,
    left: -100,
  },
  bgCircle3: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.02)',
    top: '40%',
    right: -60,
  },
  safeArea: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
  },
  heroSection: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 8,
  },
  heroIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  heroLabel: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 3,
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '800' as const,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 40,
    letterSpacing: -0.5,
    marginBottom: 14,
  },
  heroSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: 24,
  },
  quoteCard: {
    marginTop: 28,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 20,
    borderLeftWidth: 3,
    borderLeftColor: 'rgba(255,255,255,0.25)',
  },
  quoteIconWrapper: {
    marginBottom: 8,
  },
  quoteText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.75)',
    fontStyle: 'italic',
    lineHeight: 24,
  },
  dividerContainer: {
    alignItems: 'center',
    marginVertical: 32,
  },
  divider: {
    width: 60,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 1,
  },
  philosophySection: {
    gap: 16,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 2.5,
    marginBottom: 4,
  },
  philosophyCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 16,
    padding: 18,
    gap: 14,
  },
  philosophyIconBg: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  philosophyContent: {
    flex: 1,
  },
  philosophyTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    marginBottom: 6,
  },
  philosophyBody: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.65)',
    lineHeight: 22,
  },
  outroSection: {
    marginTop: 32,
  },
  ruleCard: {
    backgroundColor: 'rgba(251,191,36,0.08)',
    borderRadius: 18,
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.15)',
  },
  ruleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  ruleHeaderText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#FBBF24',
  },
  ruleBody: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 24,
    marginBottom: 12,
  },
  ruleEmphasis: {
    color: '#FFFFFF',
    fontWeight: '700' as const,
    fontStyle: 'italic',
  },
  ruleFooter: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    fontStyle: 'italic',
    lineHeight: 20,
  },
  kiriSection: {
    alignItems: 'center',
    marginTop: 28,
    marginBottom: 8,
  },
  ctaSection: {
    alignItems: 'center',
    marginTop: 8,
  },
  ctaLabel: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 6,
  },
  ctaSublabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
    marginBottom: 24,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 16,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  ctaButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.97 }],
  },
  ctaButtonText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#134E4A',
  },
  bottomSpacer: {
    height: 40,
  },
});
