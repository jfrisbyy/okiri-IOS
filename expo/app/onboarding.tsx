import React, { useState, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Pressable, 
  TextInput, 
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Check, Plane, MessageSquare, Briefcase, Sparkles } from 'lucide-react-native';
import { requestNotificationPermissions } from '@/utils/notificationScheduler';
import Colors from '@/constants/colors';
import { USE_NATIVE_DRIVER } from '@/constants/animation';
import { UserLevel, UserGoal } from '@/types';

type Step = 'info' | 'level' | 'goal';

const levelOptions: { value: UserLevel; label: string; description: string }[] = [
  { value: 'none', label: 'None', description: "I'm starting from zero" },
  { value: 'basics', label: 'I know basics', description: 'Bonjour, merci, simple words' },
  { value: 'simple_texts', label: 'I can read simple texts', description: 'Short articles, basic conversations' },
];

const goalOptions: { value: UserGoal; label: string; icon: React.ReactNode }[] = [
  { value: 'travel', label: 'Travel', icon: <Plane size={24} color={Colors.primary} /> },
  { value: 'conversation', label: 'Conversation', icon: <MessageSquare size={24} color={Colors.primary} /> },
  { value: 'work', label: 'Work / Study', icon: <Briefcase size={24} color={Colors.primary} /> },
  { value: 'curious', label: 'Just curious', icon: <Sparkles size={24} color={Colors.primary} /> },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('info');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [level, setLevel] = useState<UserLevel | null>(null);
  const [goal, setGoal] = useState<UserGoal | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const animateTransition = (callback: () => void) => {
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start();
    setTimeout(callback, 150);
  };

  const handleNext = () => {
    if (step === 'info' && name && email) {
      animateTransition(() => setStep('level'));
    } else if (step === 'level' && level) {
      animateTransition(() => setStep('goal'));
    }
  };

  const handleBack = () => {
    if (step === 'level') {
      animateTransition(() => setStep('info'));
    } else if (step === 'goal') {
      animateTransition(() => setStep('level'));
    } else {
      router.replace('/welcome');
    }
  };

  const handleComplete = async () => {
    if (!level || !goal || isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      void requestNotificationPermissions().then((granted) => {
        console.log('[Onboarding] Notification permissions:', granted ? 'granted' : 'denied');
      });

      router.replace({
        pathname: '/gap-discovery',
        params: { name, email, level, goal },
      } as any);
    } catch (error) {
      console.log('Error navigating to gap discovery:', error);
      setIsSubmitting(false);
    }
  };

  const canProceed = () => {
    if (step === 'info') return name.trim().length > 0 && email.includes('@');
    if (step === 'level') return level !== null;
    if (step === 'goal') return goal !== null;
    return false;
  };

  const getStepNumber = () => {
    if (step === 'info') return 1;
    if (step === 'level') return 2;
    return 3;
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={handleBack} style={styles.backButton}>
            <ArrowLeft size={24} color={Colors.text} />
          </Pressable>
          
          <View style={styles.progressContainer}>
            {[1, 2, 3].map((num) => (
              <View
                key={num}
                style={[
                  styles.progressDot,
                  num <= getStepNumber() && styles.progressDotActive,
                ]}
              />
            ))}
          </View>
          
          <View style={styles.placeholder} />
        </View>

        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView 
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
              {step === 'info' && (
                <>
                  <Text style={styles.title}>Let{"'"}s get to know you</Text>
                  <Text style={styles.subtitle}>
                    We{"'"}ll personalize your French learning experience
                  </Text>

                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>What{"'"}s your name?</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Your name"
                      placeholderTextColor={Colors.textMuted}
                      value={name}
                      onChangeText={setName}
                      autoCapitalize="words"
                      autoCorrect={false}
                    />
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Your email</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="hello@example.com"
                      placeholderTextColor={Colors.textMuted}
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                </>
              )}

              {step === 'level' && (
                <>
                  <Text style={styles.title}>How much French do you know?</Text>
                  <Text style={styles.subtitle}>
                    This helps us find the right starting point for you
                  </Text>

                  <View style={styles.optionsContainer}>
                    {levelOptions.map((option) => (
                      <Pressable
                        key={option.value}
                        style={[
                          styles.optionCard,
                          level === option.value && styles.optionCardSelected,
                        ]}
                        onPress={() => setLevel(option.value)}
                      >
                        <View style={styles.optionContent}>
                          <Text style={[
                            styles.optionLabel,
                            level === option.value && styles.optionLabelSelected,
                          ]}>
                            {option.label}
                          </Text>
                          <Text style={styles.optionDescription}>
                            {option.description}
                          </Text>
                        </View>
                        {level === option.value && (
                          <View style={styles.checkIcon}>
                            <Check size={20} color={Colors.primary} />
                          </View>
                        )}
                      </Pressable>
                    ))}
                  </View>
                </>
              )}

              {step === 'goal' && (
                <>
                  <Text style={styles.title}>What{"'"}s your main goal?</Text>
                  <Text style={styles.subtitle}>
                    We{"'"}ll tailor content to match your interests
                  </Text>

                  <View style={styles.goalGrid}>
                    {goalOptions.map((option) => (
                      <Pressable
                        key={option.value}
                        style={[
                          styles.goalCard,
                          goal === option.value && styles.goalCardSelected,
                        ]}
                        onPress={() => setGoal(option.value)}
                      >
                        <View style={[
                          styles.goalIcon,
                          goal === option.value && styles.goalIconSelected,
                        ]}>
                          {option.icon}
                        </View>
                        <Text style={[
                          styles.goalLabel,
                          goal === option.value && styles.goalLabelSelected,
                        ]}>
                          {option.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              )}
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>

        <View style={styles.footer}>
          <Pressable
            style={[
              styles.continueButton,
              !canProceed() && styles.continueButtonDisabled,
            ]}
            onPress={step === 'goal' ? handleComplete : handleNext}
            disabled={!canProceed() || isSubmitting}
          >
            <Text style={[
              styles.continueButtonText,
              !canProceed() && styles.continueButtonTextDisabled,
            ]}>
              {step === 'goal' ? (isSubmitting ? 'Setting up...' : 'Start learning') : 'Continue'}
            </Text>
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
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -8,
  },
  progressContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.border,
  },
  progressDotActive: {
    backgroundColor: Colors.primary,
    width: 24,
  },
  placeholder: {
    width: 44,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.text,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    lineHeight: 24,
    marginBottom: 32,
  },
  inputContainer: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  optionsContainer: {
    gap: 12,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: 14,
    padding: 18,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  optionCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  optionContent: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  optionLabelSelected: {
    color: Colors.primaryDark,
  },
  optionDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  checkIcon: {
    marginLeft: 12,
  },
  goalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  goalCard: {
    width: '47%',
    backgroundColor: Colors.backgroundCard,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.border,
  },
  goalCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  goalIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  goalIconSelected: {
    backgroundColor: Colors.backgroundCard,
  },
  goalLabel: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    textAlign: 'center',
  },
  goalLabelSelected: {
    color: Colors.primaryDark,
  },
  footer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  continueButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
  },
  continueButtonDisabled: {
    backgroundColor: Colors.border,
  },
  continueButtonText: {
    color: Colors.textLight,
    fontSize: 17,
    fontWeight: '600' as const,
  },
  continueButtonTextDisabled: {
    color: Colors.textMuted,
  },
});
