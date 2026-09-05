import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BookOpen, MessageCircle, Sparkles } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { USE_NATIVE_DRIVER } from '@/constants/animation';

export default function WelcomeScreen() {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[Colors.primaryLight, Colors.background, Colors.background]}
        style={styles.gradient}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.4 }}
      />
      
      <SafeAreaView style={styles.safeArea}>
        <Animated.View 
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Text style={styles.logo}>Okiri</Text>
              <View style={styles.frenchFlag}>
                <View style={[styles.flagStripe, { backgroundColor: '#0055A4' }]} />
                <View style={[styles.flagStripe, { backgroundColor: '#FFFFFF' }]} />
                <View style={[styles.flagStripe, { backgroundColor: '#EF4135' }]} />
              </View>
            </View>
          </View>

          <View style={styles.heroSection}>
            <Text style={styles.title}>Bienvenue,</Text>
            <Text style={styles.subtitle}>let{"'"}s learn French through real use.</Text>
            
            <Text style={styles.description}>
              Read, speak, and turn your gaps into your personal curriculum.
            </Text>
          </View>

          <View style={styles.featuresContainer}>
            <View style={styles.featureRow}>
              <View style={styles.featureIcon}>
                <BookOpen size={20} color={Colors.primary} />
              </View>
              <Text style={styles.featureText}>Read authentic French content</Text>
            </View>
            <View style={styles.featureRow}>
              <View style={styles.featureIcon}>
                <MessageCircle size={20} color={Colors.primary} />
              </View>
              <Text style={styles.featureText}>Speak and capture what you can{"'"}t say</Text>
            </View>
            <View style={styles.featureRow}>
              <View style={styles.featureIcon}>
                <Sparkles size={20} color={Colors.primary} />
              </View>
              <Text style={styles.featureText}>Build your personalized vocabulary</Text>
            </View>
          </View>

          <View style={styles.encouragement}>
            <Text style={styles.encouragementText}>
              You{"'"}re not expected to know everything.{'\n'}That{"'"}s the point.
            </Text>
          </View>
        </Animated.View>

        <View style={styles.buttonContainer}>
          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => router.push('/onboarding')}
          >
            <Text style={styles.primaryButtonText}>Get started</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => router.push('/auth')}
          >
            <Text style={styles.secondaryButtonText}>I already have an account</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: '50%',
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logo: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.primary,
    letterSpacing: -0.5,
  },
  frenchFlag: {
    flexDirection: 'row',
    width: 24,
    height: 16,
    borderRadius: 3,
    overflow: 'hidden',
  },
  flagStripe: {
    flex: 1,
  },
  heroSection: {
    marginBottom: 32,
  },
  title: {
    fontSize: 42,
    fontWeight: '700' as const,
    color: Colors.text,
    letterSpacing: -1,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 28,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
    letterSpacing: -0.5,
    lineHeight: 36,
  },
  description: {
    fontSize: 17,
    color: Colors.textMuted,
    marginTop: 16,
    lineHeight: 24,
  },
  featuresContainer: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 16,
    padding: 20,
    gap: 16,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureText: {
    fontSize: 15,
    color: Colors.text,
    flex: 1,
    fontWeight: '500' as const,
  },
  encouragement: {
    marginTop: 32,
    paddingHorizontal: 8,
  },
  encouragementText: {
    fontSize: 15,
    color: Colors.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 22,
  },
  buttonContainer: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    gap: 12,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: Colors.textLight,
    fontSize: 17,
    fontWeight: '600' as const,
  },
  secondaryButton: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontWeight: '500' as const,
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});
