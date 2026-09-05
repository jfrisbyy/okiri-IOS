import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Animated,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  ArrowLeft,
  Clock,
  Lock,
  Lightbulb,
  MessageCircle,
  RotateCcw,
  Home,
  Plus,
  Award,
  BookOpen,
  Mic,
  MicOff,
  PhoneOff,
  X,
  Volume2,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { USE_NATIVE_DRIVER } from '@/constants/animation';
import { useGeminiLive } from '@/hooks/useGeminiLive';
import { conversationScenarios } from '@/data/conversationScenarios';
import ConversationBubble from '@/components/ConversationBubble';
import { useApp } from '@/contexts/AppContext';
import { CEFRLevel, ConversationMessage, ConversationSession } from '@/types';
import {
  getCurrentCertifiedLevel,
  CEFR_LEVEL_ORDER,
} from '@/utils/proficiency';
import * as conversationService from '@/lib/conversationService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type CallState = 'idle' | 'connecting' | 'active' | 'ai_speaking';

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function buildGeminiLivePrompt(
  scenarioId: string,
  cefrLevel: CEFRLevel,
  targetLanguage: string = 'fr',
): string {
  const scenario = conversationScenarios.find((s) => s.id === scenarioId);
  const scenarioTitle = scenario?.title || 'Free Conversation';
  const scenarioDesc = scenario?.description || 'Open conversation on any topic.';
  const langName = targetLanguage === 'fr' ? 'French' : targetLanguage;

  return `You are Kiri, a friendly and encouraging ${langName} language tutor having a real-time voice conversation with a student.

Scenario: "${scenarioTitle}" — ${scenarioDesc}
Student's CEFR level: ${cefrLevel}

Rules:
- Speak primarily in ${langName}, adapting complexity to the student's ${cefrLevel} level.
- Keep your spoken responses concise — 1 to 3 sentences maximum. This is a real-time voice conversation, not an essay.
- Stay in character for the scenario. If the scenario is "At a Café", act as a barista/waiter.
- Gently correct grammar mistakes by naturally rephrasing what the student said correctly, without being preachy.
- Introduce 1-2 new vocabulary words per exchange when natural, using context clues.
- If the student seems stuck, offer a gentle prompt or simpler phrasing.
- Be warm, patient, and conversational — like a real friend helping them practice.
- Start by greeting the student in ${langName} and setting the scene for the scenario. Keep it to 1-2 sentences.`;
}

function ScoreRing({ score, size = 100 }: { score: number; size?: number }) {
  const color = score >= 80 ? '#10B981' : score >= 50 ? '#F59E0B' : '#EF4444';
  const strokeWidth = 6;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: score / 100,
      duration: 1200,
      useNativeDriver: false,
    }).start();
  }, [score, progressAnim]);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{
        width: size, height: size, borderRadius: size / 2,
        borderWidth: strokeWidth, borderColor: '#F3F4F6',
        position: 'absolute' as const,
      }} />
      <View style={{
        width: size, height: size, borderRadius: size / 2,
        borderWidth: strokeWidth, borderColor: color,
        position: 'absolute' as const,
        borderTopColor: score > 25 ? color : 'transparent',
        borderRightColor: score > 50 ? color : 'transparent',
        borderBottomColor: score > 75 ? color : 'transparent',
        borderLeftColor: score > 0 ? color : 'transparent',
        transform: [{ rotate: '-90deg' }],
      }} />
      <Text style={{ fontSize: 28, fontWeight: '800' as const, color }}>{Math.round(score)}</Text>
      <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: -2 }}>/ 100</Text>
    </View>
  );
}

function RippleRing({ index, isActive }: { index: number; isActive: boolean }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isActive) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.delay(index * 400),
          Animated.timing(anim, { toValue: 1, duration: 1600, useNativeDriver: USE_NATIVE_DRIVER }),
        ])
      );
      animation.start();
      return () => animation.stop();
    } else {
      anim.setValue(0);
    }
  }, [isActive, anim, index]);

  if (!isActive) return null;

  return (
    <Animated.View
      style={[
        styles.rippleRing,
        {
          opacity: anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.5, 0.15, 0] }),
          transform: [{
            scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.5] }),
          }],
        },
      ]}
    />
  );
}

function ProcessingDots() {
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animate = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 350, useNativeDriver: USE_NATIVE_DRIVER }),
          Animated.timing(dot, { toValue: 0.3, duration: 350, useNativeDriver: USE_NATIVE_DRIVER }),
        ])
      );

    const a1 = animate(dot1, 0);
    const a2 = animate(dot2, 200);
    const a3 = animate(dot3, 400);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, [dot1, dot2, dot3]);

  return (
    <View style={styles.dotsRow}>
      {[dot1, dot2, dot3].map((dot, i) => (
        <Animated.View
          key={i}
          style={[styles.dot, { opacity: dot, transform: [{ scale: dot }] }]}
        />
      ))}
    </View>
  );
}

export default function ConverseScreen() {
  const router = useRouter();
  const { proficiency, addGap, addConversationSession } = useApp();

  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
  const [callState, setCallState] = useState<CallState>('idle');
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [hintVisible, setHintVisible] = useState(false);
  const [hintText, setHintText] = useState('');
  const [completedSession, setCompletedSession] = useState<ConversationSession | null>(null);
  const [expandedMessageId, setExpandedMessageId] = useState<string | null>(null);
  const [captionText, setCaptionText] = useState('');
  const [screenState, setScreenState] = useState<'call' | 'review'>('call');
  const [currentSession, setCurrentSession] = useState<ConversationSession | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showDebug, setShowDebug] = useState<boolean>(true);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hintTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const captionFade = useRef(new Animated.Value(0)).current;
  const micScale = useRef(new Animated.Value(1)).current;
  const micGlow = useRef(new Animated.Value(0)).current;
  const statusFade = useRef(new Animated.Value(1)).current;
  const sessionStartTimeRef = useRef<number>(0);
  const hasStartedStreamRef = useRef<boolean>(false);
  const lastOutputTranscriptRef = useRef<string>('');
  const lastInputTranscriptRef = useRef<string>('');

  const certifiedLevel = useMemo(
    () => getCurrentCertifiedLevel(proficiency.certifiedLevels) || 'A1',
    [proficiency.certifiedLevels]
  ) as CEFRLevel;

  const userLevelIndex = CEFR_LEVEL_ORDER.indexOf(certifiedLevel);

  const isScenarioLocked = useCallback((requiredLevel: CEFRLevel): boolean => {
    const requiredIndex = CEFR_LEVEL_ORDER.indexOf(requiredLevel);
    return requiredIndex > userLevelIndex + 1;
  }, [userLevelIndex]);

  const systemPrompt = useMemo(() => {
    if (!selectedScenarioId) return '';
    return buildGeminiLivePrompt(selectedScenarioId, certifiedLevel, 'fr');
  }, [selectedScenarioId, certifiedLevel]);

  const gemini = useGeminiLive(systemPrompt, {
    onInputTranscript: useCallback((text: string) => {
      console.log('[Converse] User said:', text.substring(0, 80));
      if (text.trim() && text !== lastInputTranscriptRef.current) {
        lastInputTranscriptRef.current = text;

        setMessages((prev) => {
          const sessionId = currentSession?.id || '';
          const userMsg: ConversationMessage = {
            id: generateId(),
            sessionId,
            role: 'user',
            textContent: text.trim(),
            sequenceNumber: prev.length,
            createdAt: new Date().toISOString(),
          };
          return [...prev, userMsg];
        });
      }
    }, [currentSession]),

    onOutputTranscript: useCallback((text: string) => {
      console.log('[Converse] AI said:', text.substring(0, 80));
      if (text.trim() && text !== lastOutputTranscriptRef.current) {
        lastOutputTranscriptRef.current = text;
        setCaptionText(text);
        Animated.timing(captionFade, { toValue: 1, duration: 300, useNativeDriver: USE_NATIVE_DRIVER }).start();

        setMessages((prev) => {
          const sessionId = currentSession?.id || '';
          const aiMsg: ConversationMessage = {
            id: generateId(),
            sessionId,
            role: 'assistant',
            textContent: text.trim(),
            sequenceNumber: prev.length,
            createdAt: new Date().toISOString(),
          };
          return [...prev, aiMsg];
        });
      }
    }, [currentSession, captionFade]),

    onTurnComplete: useCallback(() => {
      console.log('[Converse] Turn complete — audio stream still running, Gemini handles VAD');
      setCallState('active');
    }, []),

    onError: useCallback((error: string) => {
      console.log('[Converse] Gemini Live error:', error);
      setErrorMessage(error);
      setTimeout(() => setErrorMessage(null), 5000);
    }, []),
  });

  const debugScrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    console.log('[Converse] Gemini status changed:', gemini.status, 'callState:', callState);
    if (gemini.status === 'connected' && !hasStartedStreamRef.current) {
      hasStartedStreamRef.current = true;
      console.log('[Converse] Connected! Starting continuous audio stream...');
      setCallState('active');
      void gemini.startStreamingAudio();
      setTimeout(() => {
        console.log('[Converse] Sending initial text nudge to trigger Gemini greeting');
        gemini.sendText('Bonjour! Please greet me and start the conversation as described in your instructions.');
      }, 1500);
    }
    if (gemini.status === 'error') {
      console.log('[Converse] Connection error detected, resetting callState');
      setCallState('idle');
      setSelectedScenarioId(null);
      hasStartedStreamRef.current = false;
    }
    if (gemini.status === 'idle' && callState === 'connecting') {
      console.log('[Converse] Connection dropped while connecting, resetting');
      setCallState('idle');
      hasStartedStreamRef.current = false;
    }
  }, [gemini.status, callState, gemini]);

  useEffect(() => {
    if (gemini.isAiSpeaking) {
      setCallState('ai_speaking');
    } else if (gemini.status === 'connected') {
      setCallState('active');
    }
  }, [gemini.isAiSpeaking, gemini.status]);

  useEffect(() => {
    if (!gemini.isAiSpeaking && callState === 'ai_speaking') {
      Animated.timing(captionFade, { toValue: 0.4, duration: 800, useNativeDriver: USE_NATIVE_DRIVER }).start();
    }
  }, [gemini.isAiSpeaking, callState, captionFade]);

  const isConversationActive = gemini.status === 'connected' || gemini.status === 'connecting';

  useEffect(() => {
    if (isConversationActive) {
      timerRef.current = setInterval(() => {
        setTimerSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isConversationActive]);

  useEffect(() => {
    if (callState === 'active' && !gemini.isMuted) {
      Animated.parallel([
        Animated.timing(micGlow, { toValue: 1, duration: 300, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.loop(
          Animated.sequence([
            Animated.timing(micScale, { toValue: 1.06, duration: 900, useNativeDriver: USE_NATIVE_DRIVER }),
            Animated.timing(micScale, { toValue: 1, duration: 900, useNativeDriver: USE_NATIVE_DRIVER }),
          ])
        ),
      ]).start();
    } else {
      micScale.stopAnimation();
      Animated.parallel([
        Animated.timing(micScale, { toValue: 1, duration: 200, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(micGlow, { toValue: 0, duration: 200, useNativeDriver: USE_NATIVE_DRIVER }),
      ]).start();
    }
  }, [callState, gemini.isMuted, micScale, micGlow]);

  useEffect(() => {
    return () => {
      if (hintTimeoutRef.current) clearTimeout(hintTimeoutRef.current);
    };
  }, []);

  const handleSelectScenario = useCallback(async (scenarioId: string) => {
    if (isScenarioLocked(conversationScenarios.find(s => s.id === scenarioId)?.requiredLevel || 'A1')) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    console.log('[Converse] Selected scenario:', scenarioId);
    setSelectedScenarioId(scenarioId);
    setTimerSeconds(0);
    setCaptionText('');
    setMessages([]);
    lastOutputTranscriptRef.current = '';
    lastInputTranscriptRef.current = '';
    hasStartedStreamRef.current = false;
    sessionStartTimeRef.current = Date.now();
    setCallState('connecting');
    setErrorMessage(null);

    conversationService.startSession(scenarioId, 'fr', certifiedLevel)
      .then((session) => {
        setCurrentSession(session);
        console.log('[Converse] Session created:', session.id);
      })
      .catch((err) => {
        console.log('[Converse] Error creating session (non-blocking):', err);
      });

    try {
      const prompt = buildGeminiLivePrompt(scenarioId, certifiedLevel, 'fr');
      console.log('[Converse] Calling gemini.connect() with prompt length:', prompt.length);
      await gemini.connect(prompt);
      console.log('[Converse] gemini.connect() returned, waiting for setupComplete...');
    } catch (err: any) {
      console.log('[Converse] Error connecting Gemini Live:', err);
      setCallState('idle');
      setSelectedScenarioId(null);
      setErrorMessage(err?.message || 'Connection failed. Please try again.');
      setTimeout(() => setErrorMessage(null), 5000);
    }
  }, [certifiedLevel, isScenarioLocked, gemini]);

  const handleMicTap = useCallback(() => {
    if (!isConversationActive) return;
    if (callState === 'connecting') return;

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    gemini.toggleMute();
    console.log('[Converse] Toggled mute');
  }, [callState, isConversationActive, gemini]);

  const handleEndConversation = useCallback(async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (timerRef.current) clearInterval(timerRef.current);

    await gemini.disconnect();

    const durationSeconds = Math.floor((Date.now() - sessionStartTimeRef.current) / 1000);
    const assistantMessages = messages.filter((m) => m.role === 'assistant');

    const pronScores = assistantMessages
      .map((m) => m.pronunciationScore)
      .filter((s): s is number => s !== undefined);
    const pronunciationScoreAvg = pronScores.length > 0
      ? pronScores.reduce((a, b) => a + b, 0) / pronScores.length
      : 0;

    const grammarCounts = assistantMessages.map((m) => m.grammarErrors?.length || 0);
    const grammarScoreAvg = grammarCounts.length > 0
      ? Math.max(0, 100 - (grammarCounts.reduce((a, b) => a + b, 0) / grammarCounts.length) * 10)
      : 0;

    const fluencyScores = assistantMessages
      .map((m) => m.fluencyMetrics)
      .filter((f): f is NonNullable<typeof f> => f !== undefined);
    const fluencyScoreAvg = fluencyScores.length > 0
      ? Math.min(100, fluencyScores.reduce((a, b) => a + b.wordsPerMinute, 0) / fluencyScores.length)
      : 0;

    const overallScore = messages.length > 1
      ? Math.min(100, Math.max(0, (pronunciationScoreAvg + grammarScoreAvg + fluencyScoreAvg) / 3 || 50))
      : 0;

    const newVocab = assistantMessages.reduce((count, m) => {
      return count + (m.vocabularyHighlights?.filter((v) => v.isNew).length || 0);
    }, 0);

    const finalSession: ConversationSession = {
      ...(currentSession || {
        id: generateId(),
        userId: 'anonymous',
        scenarioId: selectedScenarioId || 'free',
        targetLanguage: 'fr',
        cefrLevelAtStart: certifiedLevel,
        status: 'active' as const,
        createdAt: new Date().toISOString(),
      }),
      durationSeconds,
      totalMessages: messages.length,
      pronunciationScoreAvg,
      grammarScoreAvg,
      fluencyScoreAvg,
      overallScore,
      newVocabularyCount: newVocab,
      status: 'completed',
      endedAt: new Date().toISOString(),
      messages,
    };

    if (currentSession) {
      try {
        await conversationService.endSession(currentSession.id);
      } catch (err) {
        console.log('[Converse] Error ending session on server:', err);
      }
    }

    setCompletedSession(finalSession);
    setScreenState('review');

    try {
      await addConversationSession(finalSession);
      console.log('[Converse] Session stats saved');
    } catch (err) {
      console.log('[Converse] Error saving session stats:', err);
    }

    setCallState('idle');
    setSelectedScenarioId(null);
    setCaptionText('');
    setCurrentSession(null);
    setMessages([]);
    hasStartedStreamRef.current = false;
  }, [gemini, messages, currentSession, selectedScenarioId, certifiedLevel, addConversationSession]);

  const handleHint = useCallback(async () => {
    if (!currentSession) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setHintVisible(true);
    setHintText('Thinking...');

    if (hintTimeoutRef.current) clearTimeout(hintTimeoutRef.current);
    hintTimeoutRef.current = setTimeout(() => setHintVisible(false), 8000);

    try {
      await conversationService.sendMessage(
        currentSession.id,
        '[HINT_REQUEST] The student is stuck. Suggest one simple thing they could say next in French, with an English translation in parentheses. Keep it short — just the suggestion.',
        messages,
        currentSession.cefrLevelAtStart,
        currentSession.targetLanguage,
        currentSession.scenarioId,
        {
          onToken: (token: string) => {
            setHintText(token);
          },
          onComplete: (fullText: string) => {
            const cleaned = fullText.replace(/<feedback>.*<\/feedback>/s, '').trim();
            setHintText(cleaned || 'Try asking a question or responding to the last message.');
            if (hintTimeoutRef.current) clearTimeout(hintTimeoutRef.current);
            hintTimeoutRef.current = setTimeout(() => setHintVisible(false), 5000);
          },
          onError: () => {
            setHintText('Try asking a question or responding to the last message.');
          },
        }
      );
    } catch {
      setHintText('Try asking a question or responding to the last message.');
    }
  }, [currentSession, messages]);

  const handleNewConversation = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCompletedSession(null);
    setScreenState('call');
    setTimerSeconds(0);
    setExpandedMessageId(null);
    setCallState('idle');
    setSelectedScenarioId(null);
    setCaptionText('');
    setCurrentSession(null);
    setMessages([]);
    hasStartedStreamRef.current = false;
  }, []);

  const handleAddToReview = useCallback(() => {
    if (!completedSession) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const newWords = completedSession.messages
      .filter(m => m.role === 'assistant')
      .flatMap(m => m.vocabularyHighlights?.filter(v => v.isNew) || []);

    for (const word of newWords) {
      try {
        void addGap(
          word.word,
          word.translation,
          'Learned in conversation',
          '',
          '',
          'speech',
          undefined,
          undefined,
          undefined,
          'vocab',
        );
      } catch {
        console.log('[Converse] Error adding gap item for word:', word.word);
      }
    }
  }, [completedSession, addGap]);

  const currentScenario = conversationScenarios.find(s => s.id === selectedScenarioId);

  const getStatusText = useCallback((): string => {
    if (gemini.status === 'connecting') return 'Connecting…';
    if (!isConversationActive) return 'Pick a scenario to start';
    switch (callState) {
      case 'connecting': return 'Connecting…';
      case 'ai_speaking': return 'Kiri is speaking…';
      case 'active':
        if (gemini.isMuted) return 'Muted — tap mic to unmute';
        return 'Listening — speak anytime';
      default: return 'Pick a scenario to start';
    }
  }, [callState, isConversationActive, gemini.status, gemini.isMuted]);

  const getMicColor = useCallback((): string => {
    switch (callState) {
      case 'connecting': return Colors.textMuted;
      case 'ai_speaking': return '#8B5CF6';
      case 'active':
        if (gemini.isMuted) return '#9CA3AF';
        return '#10B981';
      default: return Colors.primary;
    }
  }, [callState, gemini.isMuted]);

  if (screenState === 'review' && completedSession) {
    return (
      <View style={styles.container}>
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          <ScrollView
            style={styles.reviewScroll}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.reviewContent}
          >
            <View style={styles.reviewHeader}>
              <Text style={styles.reviewTitle}>Conversation Complete!</Text>
              <Text style={styles.reviewSubtitle}>
                {formatTimer(completedSession.durationSeconds)} • {completedSession.totalMessages} messages
              </Text>
            </View>

            <View style={styles.scoreContainer}>
              <ScoreRing score={completedSession.overallScore} size={120} />
            </View>

            <View style={styles.statsRow}>
              {[
                { label: 'Pronunciation', value: Math.round(completedSession.pronunciationScoreAvg), color: '#10B981', icon: <Mic size={16} color="#10B981" /> },
                { label: 'Grammar', value: Math.round(completedSession.grammarScoreAvg), color: '#8B5CF6', icon: <BookOpen size={16} color="#8B5CF6" /> },
                { label: 'Fluency', value: Math.round(completedSession.fluencyScoreAvg), color: '#06B6D4', icon: <MessageCircle size={16} color="#06B6D4" /> },
                { label: 'New Words', value: completedSession.newVocabularyCount, color: '#F59E0B', icon: <Award size={16} color="#F59E0B" /> },
              ].map((stat) => (
                <View key={stat.label} style={styles.statCard}>
                  <View style={[styles.statIconBg, { backgroundColor: stat.color + '15' }]}>
                    {stat.icon}
                  </View>
                  <Text style={[styles.statValue, { color: stat.color }]}>{stat.value}{stat.label !== 'New Words' ? '%' : ''}</Text>
                  <Text style={styles.statLabel}>{stat.label}</Text>
                </View>
              ))}
            </View>

            {completedSession.newVocabularyCount > 0 && (
              <Pressable
                style={({ pressed }) => [styles.addReviewBtn, pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] }]}
                onPress={handleAddToReview}
              >
                <Plus size={18} color="#fff" />
                <Text style={styles.addReviewBtnText}>Add {completedSession.newVocabularyCount} Words to Review Queue</Text>
              </Pressable>
            )}

            <View style={styles.transcriptSection}>
              <Text style={styles.transcriptTitle}>Full Transcript</Text>
              {completedSession.messages.map((msg) => (
                <ConversationBubble
                  key={msg.id}
                  message={msg}
                  onExpand={() => setExpandedMessageId(
                    expandedMessageId === msg.id ? null : msg.id
                  )}
                />
              ))}
            </View>

            <View style={styles.reviewActions}>
              <Pressable
                style={({ pressed }) => [styles.reviewBtn, styles.reviewBtnPrimary, pressed && { opacity: 0.85 }]}
                onPress={handleNewConversation}
              >
                <RotateCcw size={18} color="#fff" />
                <Text style={styles.reviewBtnPrimaryText}>New Conversation</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.reviewBtn, styles.reviewBtnSecondary, pressed && { opacity: 0.85 }]}
                onPress={() => router.back()}
              >
                <Home size={18} color={Colors.text} />
                <Text style={styles.reviewBtnSecondaryText}>Back to Home</Text>
              </Pressable>
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.headerBackBtn} testID="converse-back">
            <ArrowLeft size={22} color={Colors.text} />
          </Pressable>
          <View style={styles.headerCenter}>
            {isConversationActive && currentScenario ? (
              <>
                <Text style={styles.headerScenarioTitle} numberOfLines={1}>
                  {currentScenario.icon} {currentScenario.title}
                </Text>
                <View style={styles.timerRow}>
                  <Clock size={11} color={Colors.textMuted} />
                  <Text style={styles.timerText}>{formatTimer(timerSeconds)}</Text>
                  {gemini.status === 'connected' && (
                    <View style={styles.connectedDot} />
                  )}
                </View>
              </>
            ) : (
              <Text style={styles.headerTitle}>Converse</Text>
            )}
          </View>
          {isConversationActive ? (
            <Pressable
              style={({ pressed }) => [styles.endCallBtn, pressed && { opacity: 0.8 }]}
              onPress={handleEndConversation}
              testID="end-call"
            >
              <PhoneOff size={16} color="#fff" />
              <Text style={styles.endCallText}>End</Text>
            </Pressable>
          ) : (
            <View style={{ width: 70 }} />
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scenarioChipsContainer}
          style={styles.scenarioChipsScroll}
        >
          {conversationScenarios.map((scenario) => {
            const locked = isScenarioLocked(scenario.requiredLevel);
            const isSelected = selectedScenarioId === scenario.id;
            return (
              <Pressable
                key={scenario.id}
                style={({ pressed }) => [
                  styles.scenarioChip,
                  isSelected && styles.scenarioChipActive,
                  locked && styles.scenarioChipLocked,
                  pressed && !locked && { transform: [{ scale: 0.95 }] },
                ]}
                onPress={() => !locked && !isConversationActive && handleSelectScenario(scenario.id)}
                disabled={locked || (isConversationActive && !isSelected)}
                testID={`scenario-chip-${scenario.id}`}
              >
                {locked && <Lock size={10} color="#9CA3AF" style={{ marginRight: 3 }} />}
                <Text style={styles.scenarioChipEmoji}>{scenario.icon}</Text>
                <Text style={[
                  styles.scenarioChipText,
                  isSelected && styles.scenarioChipTextActive,
                  locked && styles.scenarioChipTextLocked,
                ]} numberOfLines={1}>
                  {scenario.title}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.callBody}>
          <View style={styles.partialBubblePlaceholder} />

          <View style={styles.micContainer}>
            <RippleRing index={0} isActive={callState === 'active' && !gemini.isMuted} />
            <RippleRing index={1} isActive={callState === 'active' && !gemini.isMuted} />
            <RippleRing index={2} isActive={callState === 'active' && !gemini.isMuted} />

            <Animated.View style={[styles.micGlowRing, {
              opacity: micGlow,
              transform: [{ scale: micScale.interpolate({ inputRange: [1, 1.06], outputRange: [1.1, 1.4] }) }],
              backgroundColor: getMicColor() + '20',
            }]} />

            <Animated.View style={{ transform: [{ scale: micScale }] }}>
              <Pressable
                onPress={handleMicTap}
                disabled={!isConversationActive || callState === 'connecting'}
                style={({ pressed }) => [
                  styles.micButton,
                  { backgroundColor: getMicColor() },
                  (!isConversationActive || callState === 'connecting') && styles.micButtonDisabled,
                  pressed && { opacity: 0.9 },
                ]}
                testID="mic-button"
              >
                {callState === 'connecting' ? (
                  <View style={styles.processingDots}>
                    <ProcessingDots />
                  </View>
                ) : callState === 'ai_speaking' ? (
                  <Volume2 size={36} color="#fff" />
                ) : !isConversationActive ? (
                  <MicOff size={36} color="#fff" />
                ) : gemini.isMuted ? (
                  <MicOff size={36} color="#fff" />
                ) : (
                  <Mic size={36} color="#fff" />
                )}
              </Pressable>
            </Animated.View>
          </View>

          <Animated.View style={[styles.statusContainer, { opacity: statusFade }]}>
            <Text style={[styles.statusText, (callState === 'active' && !gemini.isMuted) && styles.statusTextListening]}>
              {getStatusText()}
            </Text>

          </Animated.View>

          {isConversationActive && (
            <View style={styles.actionRow}>
              <Pressable
                onPress={handleHint}
                style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.7, transform: [{ scale: 0.93 }] }]}
                testID="hint-btn"
              >
                <Lightbulb size={20} color="#F59E0B" />
                <Text style={styles.actionBtnLabel}>Hint</Text>
              </Pressable>
            </View>
          )}
        </View>

        {errorMessage && (
          <View style={styles.errorToast}>
            <Text style={styles.errorToastText}>{errorMessage}</Text>
            <Pressable onPress={() => setErrorMessage(null)} style={styles.hintClose}>
              <X size={14} color="#fff" />
            </Pressable>
          </View>
        )}

        {hintVisible && (
          <View style={styles.hintTooltip}>
            <Lightbulb size={16} color="#92400E" />
            <Text style={styles.hintTooltipText}>{hintText}</Text>
            <Pressable onPress={() => setHintVisible(false)} style={styles.hintClose}>
              <X size={14} color={Colors.textMuted} />
            </Pressable>
          </View>
        )}

        <Animated.View style={[styles.captionBar, { opacity: captionFade }]}>
          {captionText ? (
            <View style={styles.captionInner}>
              <Text style={styles.captionEmoji}>🦊</Text>
              <Text style={styles.captionTextContent} numberOfLines={3}>{captionText}</Text>
            </View>
          ) : null}
        </Animated.View>

        {showDebug && (
          <View style={styles.debugPanel}>
            <View style={styles.debugHeader}>
              <Text style={styles.debugTitle}>DEBUG</Text>
              <Text style={styles.debugStatus}>status={gemini.status} call={callState}</Text>
              <Pressable onPress={() => setShowDebug(false)} hitSlop={8}>
                <X size={14} color="#9CA3AF" />
              </Pressable>
            </View>
            <ScrollView
              ref={debugScrollRef}
              style={styles.debugScroll}
              onContentSizeChange={() => debugScrollRef.current?.scrollToEnd({ animated: false })}
            >
              {gemini.debugLogs.length === 0 ? (
                <Text style={styles.debugLogText}>No logs yet. Select a scenario to connect.</Text>
              ) : (
                gemini.debugLogs.map((log, i) => (
                  <Text key={i} style={[
                    styles.debugLogText,
                    log.includes('ERROR') && styles.debugLogError,
                    log.includes('RECEIVED') && styles.debugLogSuccess,
                    log.includes('OPENED') && styles.debugLogSuccess,
                  ]}>{log}</Text>
                ))
              )}
            </ScrollView>
          </View>
        )}

        {!showDebug && (
          <Pressable style={styles.debugToggle} onPress={() => setShowDebug(true)}>
            <Text style={styles.debugToggleText}>DBG</Text>
          </Pressable>
        )}
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
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.backgroundCard,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  headerScenarioTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  timerText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  connectedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginLeft: 2,
  },
  endCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EF4444',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  endCallText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#fff',
  },

  scenarioChipsScroll: {
    maxHeight: 52,
    flexGrow: 0,
  },
  scenarioChipsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    alignItems: 'center',
  },
  scenarioChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: Colors.border,
    gap: 4,
  },
  scenarioChipActive: {
    backgroundColor: Colors.primary + '12',
    borderColor: Colors.primary,
  },
  scenarioChipLocked: {
    opacity: 0.45,
  },
  scenarioChipEmoji: {
    fontSize: 15,
  },
  scenarioChipText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.text,
    maxWidth: 120,
  },
  scenarioChipTextActive: {
    color: Colors.primary,
  },
  scenarioChipTextLocked: {
    color: '#9CA3AF',
  },

  callBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },

  partialBubble: {
    backgroundColor: Colors.primary + '14',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginBottom: 32,
    maxWidth: SCREEN_WIDTH - 80,
  },
  partialBubblePlaceholder: {
    height: 50,
    marginBottom: 32,
  },
  partialText: {
    fontSize: 16,
    color: Colors.primary,
    fontStyle: 'italic' as const,
    textAlign: 'center' as const,
    lineHeight: 22,
  },

  micContainer: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rippleRing: {
    position: 'absolute' as const,
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 2,
    borderColor: '#10B981',
  },
  micGlowRing: {
    position: 'absolute' as const,
    width: 130,
    height: 130,
    borderRadius: 65,
  },
  micButton: {
    width: 110,
    height: 110,
    borderRadius: 55,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  micButtonDisabled: {
    backgroundColor: '#CBD5E1',
    shadowOpacity: 0,
    elevation: 0,
  },

  processingDots: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#fff',
  },

  statusContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  statusText: {
    fontSize: 15,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  statusTextListening: {
    color: '#10B981',
    fontWeight: '600' as const,
  },
  webNote: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 4,
  },

  actionRow: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 28,
  },
  actionBtn: {
    alignItems: 'center',
    gap: 4,
  },
  actionBtnLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '500' as const,
  },

  hintTooltip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FDE68A',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  hintTooltipText: {
    flex: 1,
    fontSize: 14,
    color: '#92400E',
    lineHeight: 20,
  },
  hintClose: {
    padding: 4,
  },

  captionBar: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    minHeight: 60,
  },
  captionInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.backgroundCard,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  captionEmoji: {
    fontSize: 20,
    marginTop: 1,
  },
  errorToast: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#EF4444',
    borderRadius: 14,
    padding: 14,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  errorToastText: {
    flex: 1,
    fontSize: 14,
    color: '#fff',
    lineHeight: 20,
    fontWeight: '500' as const,
  },
  captionTextContent: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
    lineHeight: 23,
  },

  debugPanel: {
    marginHorizontal: 8,
    marginBottom: 4,
    backgroundColor: '#1E1E2E',
    borderRadius: 10,
    maxHeight: 150,
    overflow: 'hidden',
  },
  debugHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#2E2E3E',
  },
  debugTitle: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#F59E0B',
    letterSpacing: 1,
  },
  debugStatus: {
    fontSize: 10,
    color: '#9CA3AF',
    flex: 1,
    marginLeft: 8,
  },
  debugScroll: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  debugLogText: {
    fontSize: 10,
    color: '#A0A0B8',
    lineHeight: 15,
    fontFamily: 'monospace' as const,
  },
  debugLogError: {
    color: '#EF4444',
  },
  debugLogSuccess: {
    color: '#10B981',
  },
  debugToggle: {
    position: 'absolute' as const,
    bottom: 50,
    right: 8,
    backgroundColor: '#1E1E2E',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    opacity: 0.7,
  },
  debugToggleText: {
    fontSize: 10,
    color: '#F59E0B',
    fontWeight: '700' as const,
    fontFamily: 'monospace' as const,
  },

  reviewScroll: {
    flex: 1,
  },
  reviewContent: {
    paddingBottom: 20,
  },
  reviewHeader: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 8,
  },
  reviewTitle: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: Colors.text,
  },
  reviewSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  scoreContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.backgroundCard,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statIconBg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800' as const,
  },
  statLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
    textAlign: 'center' as const,
  },
  addReviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 20,
    backgroundColor: '#8B5CF6',
    borderRadius: 14,
    paddingVertical: 14,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  addReviewBtnText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#fff',
  },
  transcriptSection: {
    paddingTop: 12,
  },
  transcriptTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  reviewActions: {
    paddingHorizontal: 16,
    gap: 10,
    marginTop: 20,
  },
  reviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
  },
  reviewBtnPrimary: {
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  reviewBtnPrimaryText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#fff',
  },
  reviewBtnSecondary: {
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  reviewBtnSecondaryText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
});
