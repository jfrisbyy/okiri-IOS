import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Mail, Lock, User, Eye, EyeOff, ArrowRight, CheckCircle, AlertTriangle, Info } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import Colors from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { USE_NATIVE_DRIVER } from '@/constants/animation';

type AuthMode = 'signin' | 'signup';

export default function AuthScreen() {
  const { signIn, signUp, isAuthenticated } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'info' | 'warning' } | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 700,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  useEffect(() => {
    if (isAuthenticated) {
      console.log('[Auth] Authenticated, navigating to home');
      router.replace('/');
    }
  }, [isAuthenticated, router]);

  const handleSubmit = async () => {
    setError('');
    setStatusMessage(null);

    if (!email.trim() || !password.trim()) {
      setError('Please fill in all fields');
      return;
    }
    if (mode === 'signup' && !name.trim()) {
      setError('Please enter your name');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'signin') {
        await signIn(email.trim(), password);
        console.log('[Auth] Sign in successful');
        setStatusMessage({ text: 'Signed in successfully!', type: 'success' });
      } else {
        const data = await signUp(email.trim(), password, name.trim());
        console.log('[Auth] Sign up response:', JSON.stringify(data, null, 2));
        if (data?.user && !data?.session) {
          setStatusMessage({
            text: 'Account created! Check your email to confirm your account before signing in.',
            type: 'info',
          });
          setMode('signin');
        } else if (data?.session) {
          setStatusMessage({ text: 'Account created! You are now signed in.', type: 'success' });
        }
      }
    } catch (e: any) {
      console.log('[Auth] Error:', e?.message, e?.status, JSON.stringify(e));
      const msg = (e?.message || 'Something went wrong').toLowerCase();
      if (msg.includes('invalid login credentials') || msg.includes('invalid login')) {
        setError('Incorrect email or password. Please try again.');
      } else if (msg.includes('email not confirmed')) {
        setStatusMessage({
          text: 'Your email is not yet confirmed. Please check your inbox and spam folder.',
          type: 'warning',
        });
      } else if (msg.includes('already registered') || msg.includes('user already registered')) {
        setError('This email is already registered. Try signing in instead.');
      } else if (msg.includes('email rate limit') || msg.includes('rate limit')) {
        setError('Too many attempts. Please wait a moment and try again.');
      } else if (msg.includes('network') || msg.includes('fetch')) {
        setError('Network error. Please check your connection and try again.');
      } else if (msg.includes('weak password') || msg.includes('password')) {
        setError('Password is too weak. Use at least 6 characters with a mix of letters and numbers.');
      } else if (msg.includes('invalid email') || msg.includes('unable to validate')) {
        setError('Please enter a valid email address.');
      } else if (msg.includes('signup is disabled')) {
        setError('Sign-ups are currently disabled. Please try again later.');
      } else {
        setError(e?.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setMode(prev => prev === 'signin' ? 'signup' : 'signin');
    setError('');
    setStatusMessage(null);
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#FFF0E6', Colors.background, Colors.background]}
        style={styles.gradient}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.5 }}
      />

      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Animated.View
              style={[
                styles.headerSection,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }],
                },
              ]}
            >
              <View style={styles.logoRow}>
                <Text style={styles.logo}>Okiri</Text>
                <View style={styles.frenchFlag}>
                  <View style={[styles.flagStripe, { backgroundColor: '#0055A4' }]} />
                  <View style={[styles.flagStripe, { backgroundColor: '#FFFFFF' }]} />
                  <View style={[styles.flagStripe, { backgroundColor: '#EF4135' }]} />
                </View>
              </View>
              <Text style={styles.title}>
                {mode === 'signin' ? 'Welcome back' : 'Create account'}
              </Text>
              <Text style={styles.subtitle}>
                {mode === 'signin'
                  ? 'Sign in to continue your French journey'
                  : 'Start learning French the smart way'}
              </Text>
            </Animated.View>

            <Animated.View
              style={[
                styles.formSection,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }],
                },
              ]}
            >
              {mode === 'signup' && (
                <View style={styles.inputGroup}>
                  <View style={styles.inputIcon}>
                    <User size={18} color={Colors.textMuted} />
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="Your name"
                    placeholderTextColor={Colors.textMuted}
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                    autoComplete="name"
                    testID="auth-name-input"
                  />
                </View>
              )}

              <View style={styles.inputGroup}>
                <View style={styles.inputIcon}>
                  <Mail size={18} color={Colors.textMuted} />
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Email address"
                  placeholderTextColor={Colors.textMuted}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  testID="auth-email-input"
                />
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.inputIcon}>
                  <Lock size={18} color={Colors.textMuted} />
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor={Colors.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  testID="auth-password-input"
                />
                <Pressable
                  style={styles.eyeButton}
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={8}
                >
                  {showPassword ? (
                    <EyeOff size={18} color={Colors.textMuted} />
                  ) : (
                    <Eye size={18} color={Colors.textMuted} />
                  )}
                </Pressable>
              </View>

              {statusMessage ? (
                <View style={[
                  styles.statusContainer,
                  statusMessage.type === 'success' && styles.statusSuccess,
                  statusMessage.type === 'info' && styles.statusInfo,
                  statusMessage.type === 'warning' && styles.statusWarning,
                ]}>
                  <View style={styles.statusIconWrap}>
                    {statusMessage.type === 'success' && <CheckCircle size={18} color={Colors.success} />}
                    {statusMessage.type === 'info' && <Info size={18} color="#3B82F6" />}
                    {statusMessage.type === 'warning' && <AlertTriangle size={18} color={Colors.warning} />}
                  </View>
                  <Text style={[
                    styles.statusText,
                    statusMessage.type === 'success' && { color: Colors.success },
                    statusMessage.type === 'info' && { color: '#3B82F6' },
                    statusMessage.type === 'warning' && { color: '#92400E' },
                  ]}>{statusMessage.text}</Text>
                </View>
              ) : null}

              {error ? (
                <View style={styles.errorContainer}>
                  <View style={styles.statusIconWrap}>
                    <AlertTriangle size={16} color={Colors.error} />
                  </View>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <Pressable
                style={({ pressed }) => [
                  styles.submitButton,
                  pressed && styles.submitPressed,
                  loading && styles.submitDisabled,
                ]}
                onPress={handleSubmit}
                disabled={loading}
                testID="auth-submit-button"
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <View style={styles.submitInner}>
                    <Text style={styles.submitText}>
                      {mode === 'signin' ? 'Sign in' : 'Create account'}
                    </Text>
                    <ArrowRight size={18} color="#fff" />
                  </View>
                )}
              </Pressable>

              <Pressable
                style={styles.toggleButton}
                onPress={toggleMode}
                testID="auth-toggle-mode"
              >
                <Text style={styles.toggleText}>
                  {mode === 'signin'
                    ? "Don't have an account? "
                    : 'Already have an account? '}
                  <Text style={styles.toggleTextBold}>
                    {mode === 'signin' ? 'Sign up' : 'Sign in'}
                  </Text>
                </Text>
              </Pressable>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
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
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  headerSection: {
    marginBottom: 36,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 24,
  },
  logo: {
    fontSize: 26,
    fontWeight: '700' as const,
    color: Colors.primary,
    letterSpacing: -0.5,
  },
  frenchFlag: {
    flexDirection: 'row',
    width: 22,
    height: 14,
    borderRadius: 3,
    overflow: 'hidden',
  },
  flagStripe: {
    flex: 1,
  },
  title: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: Colors.text,
    letterSpacing: -0.8,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  formSection: {
    gap: 14,
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    height: 54,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
    height: '100%',
  },
  eyeButton: {
    padding: 4,
    marginLeft: 8,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  statusSuccess: {
    backgroundColor: Colors.successLight,
  },
  statusInfo: {
    backgroundColor: '#EFF6FF',
  },
  statusWarning: {
    backgroundColor: Colors.warningLight,
  },
  statusIconWrap: {
    marginTop: 1,
  },
  statusText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500' as const,
    lineHeight: 20,
  },
  errorContainer: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    backgroundColor: Colors.errorLight,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  errorText: {
    flex: 1,
    color: Colors.error,
    fontSize: 14,
    fontWeight: '500' as const,
    lineHeight: 20,
  },
  submitButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  submitPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  submitDisabled: {
    opacity: 0.7,
  },
  submitInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  submitText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600' as const,
  },
  toggleButton: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  toggleText: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  toggleTextBold: {
    color: Colors.primary,
    fontWeight: '600' as const,
  },
});
