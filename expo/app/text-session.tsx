import { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Animated,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useNavigation } from 'expo-router';
import { safeGoBack } from '@/utils/navigation';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  ArrowUp,
  Plus,
  Mic,
  Languages,
  BookmarkPlus,
  Check,
  RefreshCw,
  X,
  ChevronRight,
  Sparkles,
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateText } from '@rork-ai/toolkit-sdk';
import OpenAI from 'openai';
import Colors from '@/constants/colors';
import { USE_NATIVE_DRIVER } from '@/constants/animation';
import {
  textPersonalities,
  TextPersonality,
  PersonalityId,
  getRandomStarter,
} from '@/mocks/textPersonalities';
import { useApp } from '@/contexts/AppContext';
import { CEFRLevel } from '@/types';
import { getTextSessionConfig } from '@/utils/progressiveDifficulty';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const IMESSAGE_BLUE = '#007AFF';
const IMESSAGE_GRAY = '#E9E9EB';
const CHAT_BG = '#F2F2F7';
const HEADER_BG = 'rgba(249, 249, 249, 0.94)';
const INPUT_BG = '#FFFFFF';
const CONTACT_LIST_BG = '#FFFFFF';
const CORRECTION_BG = '#FFF8EC';
const CORRECTION_BORDER = '#F59E0B';
const STORAGE_KEY = 'okiri_text_conversations';

const CORRECTION_REGEX = /\{\{COR:(.+?)\|(.+?)\|(.+?)\}\}/g;

type ParsedCorrection = {
  original: string;
  corrected: string;
  explanation: string;
};

type SessionCorrection = ParsedCorrection & { messageId: string };

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  displayContent: string;
  timestamp: Date;
  delivered?: boolean;
  read?: boolean;
  corrections?: ParsedCorrection[];
  translation?: string;
};

type StoredMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  displayContent: string;
  timestamp: string;
  delivered?: boolean;
  read?: boolean;
  corrections?: ParsedCorrection[];
  translation?: string;
};

type StoredConversation = {
  messages: StoredMessage[];
  usedStarterIndices: number[];
  lastUpdated: string;
};

type AllConversations = Record<string, StoredConversation>;

const openai = new OpenAI({
  apiKey: process.env.EXPO_PUBLIC_AI_INTEGRATIONS_OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY || 'dummy',
  baseURL: process.env.EXPO_PUBLIC_AI_INTEGRATIONS_OPENAI_BASE_URL || process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  dangerouslyAllowBrowser: true,
});

export const unstable_settings = { headerShown: false };

function parseCorrections(content: string): { displayContent: string; corrections: ParsedCorrection[] } {
  const corrections: ParsedCorrection[] = [];
  let match: RegExpExecArray | null;
  const regex = new RegExp(CORRECTION_REGEX.source, 'g');

  while ((match = regex.exec(content)) !== null) {
    corrections.push({
      original: match[1].trim(),
      corrected: match[2].trim(),
      explanation: match[3].trim(),
    });
  }

  const displayContent = content
    .replace(new RegExp(CORRECTION_REGEX.source, 'g'), '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { displayContent, corrections };
}

function getHighestCEFR(certifiedLevels: CEFRLevel[]): CEFRLevel {
  const order: CEFRLevel[] = ['C2', 'C1', 'B2', 'B1', 'A2', 'A1'];
  for (const level of order) {
    if (certifiedLevels.includes(level)) return level;
  }
  return 'A1';
}

function buildSystemPrompt(personality: TextPersonality, certifiedLevels: CEFRLevel[]): string {
  const level = getHighestCEFR(certifiedLevels);

  const levelGuide: Record<CEFRLevel, string> = {
    'A1': 'Use very simple vocabulary, short sentences (1-2 sentences max), mostly present tense. Be very patient and encouraging. Keep your messages brief and simple like a patient friend.',
    'A2': 'Use simple sentences, basic past/future tenses. Common everyday expressions. Keep messages to 2-3 short sentences. Be clear and supportive.',
    'B1': 'Use moderate complexity with varied tenses including conditional. Some idioms. Natural but accessible. Use 2-4 sentences per message.',
    'B2': 'Use natural flowing French with idioms, varied register, and complex sentences. Challenge them with longer, more engaging responses.',
    'C1': 'Use full natural French with complex structures, nuanced vocabulary, and cultural references. Write naturally and at length.',
    'C2': 'Use native-level French with full complexity, slang, literary references, and sophisticated argumentation. No simplification needed.',
  };

  const correctionPrompt = `

CORRECTION FORMAT: When you notice an error in the user's French (grammar, vocabulary, conjugation, gender, spelling), correct it naturally in your conversational response AND include this exact tag on its own line:
{{COR:what they wrote incorrectly|the correct version|brief explanation in English}}
Only flag genuine errors, not style preferences. You can include multiple {{COR:...}} tags for multiple errors. Keep your conversational tone natural around these tags.`;

  const levelPrompt = `

USER LEVEL: The user's current French level is ${level}. ${levelGuide[level]}`;

  return personality.systemPrompt + levelPrompt + correctionPrompt;
}

async function loadAllConversations(): Promise<AllConversations> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  } catch (error) {
    console.log('[TextSession] Error loading conversations:', error);
    return {};
  }
}

async function saveAllConversations(convs: AllConversations): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(convs));
  } catch (error) {
    console.log('[TextSession] Error saving conversations:', error);
  }
}

function serializeMessages(messages: Message[]): StoredMessage[] {
  return messages.map(m => ({
    id: m.id,
    role: m.role,
    content: m.content,
    displayContent: m.displayContent,
    timestamp: m.timestamp.toISOString(),
    delivered: m.delivered,
    read: m.read,
    corrections: m.corrections,
    translation: m.translation,
  }));
}

function deserializeMessages(stored: StoredMessage[]): Message[] {
  return stored.map(m => ({
    ...m,
    timestamp: new Date(m.timestamp),
  }));
}

function TypingDots() {
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animate = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: USE_NATIVE_DRIVER }),
          Animated.timing(dot, { toValue: 0.3, duration: 300, useNativeDriver: USE_NATIVE_DRIVER }),
          Animated.delay(600 - delay),
        ])
      );

    const a1 = animate(dot1, 0);
    const a2 = animate(dot2, 200);
    const a3 = animate(dot3, 400);
    a1.start(); a2.start(); a3.start();

    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, []);

  return (
    <View style={typingStyles.container}>
      <Animated.View style={[typingStyles.dot, { opacity: dot1 }]} />
      <Animated.View style={[typingStyles.dot, { opacity: dot2 }]} />
      <Animated.View style={[typingStyles.dot, { opacity: dot3 }]} />
    </View>
  );
}

const typingStyles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 4, paddingVertical: 4 },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#8E8E93' },
});

function CorrectionCard({
  correction,
  onSave,
  saved,
}: {
  correction: ParsedCorrection;
  onSave: () => void;
  saved: boolean;
}) {
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, friction: 8, tension: 80, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 300, useNativeDriver: USE_NATIVE_DRIVER }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[corrStyles.card, { opacity: opacityAnim, transform: [{ scale: scaleAnim }] }]}>
      <View style={corrStyles.cardBorder} />
      <View style={corrStyles.cardContent}>
        <View style={corrStyles.correctionRow}>
          <Text style={corrStyles.strikeText}>{correction.original}</Text>
          <Text style={corrStyles.arrow}>→</Text>
          <Text style={corrStyles.correctedText}>{correction.corrected}</Text>
        </View>
        <Text style={corrStyles.explanationText}>{correction.explanation}</Text>
        <Pressable
          style={[corrStyles.saveBtn, saved && corrStyles.saveBtnDone]}
          onPress={onSave}
          disabled={saved}
        >
          {saved ? (
            <Check size={13} color="#10B981" />
          ) : (
            <BookmarkPlus size={13} color={IMESSAGE_BLUE} />
          )}
          <Text style={[corrStyles.saveBtnText, saved && corrStyles.saveBtnTextDone]}>
            {saved ? 'Saved' : 'Save to Deck'}
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const corrStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    marginLeft: 16,
    marginRight: 40,
    marginBottom: 6,
    borderRadius: 12,
    backgroundColor: CORRECTION_BG,
    overflow: 'hidden',
  },
  cardBorder: {
    width: 3,
    backgroundColor: CORRECTION_BORDER,
  },
  cardContent: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  correctionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 3,
  },
  strikeText: {
    fontSize: 14,
    color: '#DC2626',
    textDecorationLine: 'line-through',
    fontWeight: '500' as const,
  },
  arrow: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  correctedText: {
    fontSize: 14,
    color: '#059669',
    fontWeight: '600' as const,
  },
  explanationText: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 16,
    marginBottom: 6,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
  },
  saveBtnDone: {
    backgroundColor: '#ECFDF5',
  },
  saveBtnText: {
    fontSize: 12,
    color: IMESSAGE_BLUE,
    fontWeight: '500' as const,
  },
  saveBtnTextDone: {
    color: '#10B981',
  },
});

function MessageBubble({
  message,
  isFirst,
  isLast,
  showTail,
  isSelected,
  onPress,
  onLongPress,
}: {
  message: Message;
  isFirst: boolean;
  isLast: boolean;
  showTail: boolean;
  isSelected: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const isUser = message.role === 'user';
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 8, tension: 100, useNativeDriver: USE_NATIVE_DRIVER }),
    ]).start();
  }, []);

  const bubbleRadius = 18;
  const tailRadius = 4;

  const borderRadiusStyle = isUser
    ? {
        borderTopLeftRadius: bubbleRadius,
        borderTopRightRadius: isFirst ? bubbleRadius : bubbleRadius - 4,
        borderBottomLeftRadius: bubbleRadius,
        borderBottomRightRadius: showTail ? tailRadius : bubbleRadius - 4,
      }
    : {
        borderTopLeftRadius: isFirst ? bubbleRadius : bubbleRadius - 4,
        borderTopRightRadius: bubbleRadius,
        borderBottomLeftRadius: showTail ? tailRadius : bubbleRadius - 4,
        borderBottomRightRadius: bubbleRadius,
      };

  return (
    <Animated.View
      style={[
        bStyles.bubbleRow,
        isUser ? bStyles.userRow : bStyles.assistantRow,
        { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
        !isLast && { marginBottom: 1 },
        isLast && { marginBottom: 6 },
      ]}
    >
      <Pressable
        onPress={!isUser ? onPress : undefined}
        onLongPress={!isUser ? onLongPress : undefined}
        style={[
          bStyles.bubble,
          isUser ? bStyles.userBubble : bStyles.assistantBubble,
          borderRadiusStyle,
          isSelected && !isUser && bStyles.selectedBubble,
        ]}
      >
        <Text style={[bStyles.text, isUser ? bStyles.userText : bStyles.assistantText]}>
          {message.displayContent}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const bStyles = StyleSheet.create({
  bubbleRow: { paddingHorizontal: 16, maxWidth: '82%' },
  userRow: { alignSelf: 'flex-end' },
  assistantRow: { alignSelf: 'flex-start' },
  bubble: { paddingHorizontal: 12, paddingVertical: 8 },
  userBubble: { backgroundColor: IMESSAGE_BLUE },
  assistantBubble: { backgroundColor: IMESSAGE_GRAY },
  selectedBubble: { backgroundColor: '#DCDCE0' },
  text: { fontSize: 17, lineHeight: 22, letterSpacing: -0.41 },
  userText: { color: '#FFFFFF' },
  assistantText: { color: '#000000' },
});

function MessageActionBar({
  onTranslate,
  onSave,
  isTranslating,
  isSaved,
}: {
  onTranslate: () => void;
  onSave: () => void;
  isTranslating: boolean;
  isSaved: boolean;
}) {
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(slideAnim, { toValue: 1, friction: 8, tension: 120, useNativeDriver: USE_NATIVE_DRIVER }).start();
  }, []);

  return (
    <Animated.View
      style={[
        actionStyles.bar,
        { opacity: slideAnim, transform: [{ scale: slideAnim }] },
      ]}
    >
      <Pressable style={actionStyles.actionBtn} onPress={onTranslate} disabled={isTranslating}>
        {isTranslating ? (
          <ActivityIndicator size="small" color={IMESSAGE_BLUE} />
        ) : (
          <Languages size={16} color={IMESSAGE_BLUE} />
        )}
        <Text style={actionStyles.actionText}>Translate</Text>
      </Pressable>
      <View style={actionStyles.divider} />
      <Pressable style={actionStyles.actionBtn} onPress={onSave} disabled={isSaved}>
        {isSaved ? (
          <Check size={16} color="#10B981" />
        ) : (
          <BookmarkPlus size={16} color={IMESSAGE_BLUE} />
        )}
        <Text style={[actionStyles.actionText, isSaved && { color: '#10B981' }]}>
          {isSaved ? 'Saved' : 'Save'}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const actionStyles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    marginLeft: 20,
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 4,
    paddingVertical: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: IMESSAGE_BLUE,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: '#C7C7CC',
    marginVertical: 6,
  },
});

function TranslationBubble({ text }: { text: string }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: USE_NATIVE_DRIVER }).start();
  }, []);

  return (
    <Animated.View style={[transStyles.bubble, { opacity: fadeAnim }]}>
      <Languages size={12} color="#6B7280" />
      <Text style={transStyles.text}>{text}</Text>
    </Animated.View>
  );
}

const transStyles = StyleSheet.create({
  bubble: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
    marginLeft: 20,
    marginRight: 50,
    marginBottom: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#F0F4FF',
    borderRadius: 12,
  },
  text: {
    flex: 1,
    fontSize: 14,
    color: '#4B5563',
    fontStyle: 'italic',
    lineHeight: 19,
  },
});

function SuggestionChips({
  hints,
  onSelect,
  onNewTopic,
}: {
  hints: string[];
  onSelect: (hint: string) => void;
  onNewTopic: () => void;
}) {
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(slideAnim, { toValue: 1, friction: 8, tension: 100, useNativeDriver: USE_NATIVE_DRIVER }).start();
  }, []);

  return (
    <Animated.View style={[chipStyles.container, { opacity: slideAnim, transform: [{ translateY: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={chipStyles.scroll}>
        <Pressable style={chipStyles.topicBtn} onPress={onNewTopic}>
          <RefreshCw size={13} color={IMESSAGE_BLUE} />
          <Text style={chipStyles.topicText}>New Topic</Text>
        </Pressable>
        {hints.map((hint, i) => (
          <Pressable key={i} style={chipStyles.chip} onPress={() => onSelect(hint)}>
            <Text style={chipStyles.chipText}>{hint}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </Animated.View>
  );
}

const chipStyles = StyleSheet.create({
  container: {
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5EA',
    backgroundColor: HEADER_BG,
  },
  scroll: {
    paddingHorizontal: 12,
    gap: 8,
  },
  topicBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: IMESSAGE_BLUE,
  },
  topicText: {
    fontSize: 13,
    color: IMESSAGE_BLUE,
    fontWeight: '500' as const,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: '#E5E5EA',
  },
  chipText: {
    fontSize: 13,
    color: '#1C1C1E',
  },
});

function SessionSummaryModal({
  visible,
  personality,
  messageCount,
  corrections,
  savedKeys,
  sessionDuration,
  onSaveCorrection,
  onDismiss,
}: {
  visible: boolean;
  personality: TextPersonality | null;
  messageCount: number;
  corrections: SessionCorrection[];
  savedKeys: Set<string>;
  sessionDuration: number;
  onSaveCorrection: (correction: SessionCorrection, index: number) => void;
  onDismiss: () => void;
}) {
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, { toValue: 1, friction: 8, tension: 60, useNativeDriver: USE_NATIVE_DRIVER }).start();
    } else {
      slideAnim.setValue(0);
    }
  }, [visible]);

  const minutes = Math.max(1, Math.round(sessionDuration / 60000));

  if (!personality) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onDismiss}>
      <Pressable style={summaryStyles.overlay} onPress={onDismiss}>
        <Animated.View
          style={[
            summaryStyles.sheet,
            {
              opacity: slideAnim,
              transform: [{
                translateY: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [300, 0] }),
              }],
            },
          ]}
        >
          <Pressable onPress={() => {}}>
            <View style={summaryStyles.handle} />

            <View style={summaryStyles.header}>
              <View style={[summaryStyles.avatarCircle, { backgroundColor: personality.color + '18' }]}>
                <Text style={summaryStyles.avatarEmoji}>{personality.avatar}</Text>
              </View>
              <Text style={summaryStyles.headerTitle}>Session with {personality.name}</Text>
            </View>

            <View style={summaryStyles.statsRow}>
              <View style={summaryStyles.stat}>
                <Text style={summaryStyles.statNum}>{messageCount}</Text>
                <Text style={summaryStyles.statLabel}>messages</Text>
              </View>
              <View style={summaryStyles.statDivider} />
              <View style={summaryStyles.stat}>
                <Text style={summaryStyles.statNum}>{minutes}</Text>
                <Text style={summaryStyles.statLabel}>min</Text>
              </View>
              <View style={summaryStyles.statDivider} />
              <View style={summaryStyles.stat}>
                <Text style={summaryStyles.statNum}>{corrections.length}</Text>
                <Text style={summaryStyles.statLabel}>corrections</Text>
              </View>
            </View>

            {corrections.length > 0 ? (
              <View style={summaryStyles.correctionsSection}>
                <Text style={summaryStyles.sectionTitle}>Corrections Found</Text>
                <ScrollView style={summaryStyles.correctionsList} showsVerticalScrollIndicator={false}>
                  {corrections.map((c, i) => {
                    const key = `${c.messageId}-${i}`;
                    const isSaved = savedKeys.has(key);
                    return (
                      <View key={key} style={summaryStyles.correctionItem}>
                        <View style={summaryStyles.correctionTexts}>
                          <View style={summaryStyles.corrRow}>
                            <Text style={summaryStyles.corrOriginal}>{c.original}</Text>
                            <Text style={summaryStyles.corrArrow}>→</Text>
                            <Text style={summaryStyles.corrFixed}>{c.corrected}</Text>
                          </View>
                          <Text style={summaryStyles.corrExpl}>{c.explanation}</Text>
                        </View>
                        <Pressable
                          style={[summaryStyles.corrSaveBtn, isSaved && summaryStyles.corrSaveBtnDone]}
                          onPress={() => onSaveCorrection(c, i)}
                          disabled={isSaved}
                        >
                          {isSaved ? (
                            <Check size={14} color="#10B981" />
                          ) : (
                            <BookmarkPlus size={14} color="#FFFFFF" />
                          )}
                        </Pressable>
                      </View>
                    );
                  })}
                </ScrollView>
              </View>
            ) : (
              <View style={summaryStyles.noCorrWrap}>
                <Sparkles size={28} color="#F59E0B" />
                <Text style={summaryStyles.noCorrTitle}>No corrections needed!</Text>
                <Text style={summaryStyles.noCorrSub}>Great job — your French was on point this session.</Text>
              </View>
            )}

            <Pressable style={summaryStyles.doneBtn} onPress={onDismiss}>
              <Text style={summaryStyles.doneBtnText}>Continue</Text>
            </Pressable>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const summaryStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatarEmoji: { fontSize: 28 },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#1C1C1E',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 16,
  },
  stat: { alignItems: 'center', flex: 1 },
  statNum: { fontSize: 22, fontWeight: '700' as const, color: '#1C1C1E' },
  statLabel: { fontSize: 12, color: '#8E8E93', marginTop: 2 },
  statDivider: { width: 1, height: 30, backgroundColor: '#E5E7EB' },
  correctionsSection: { marginBottom: 20 },
  sectionTitle: { fontSize: 15, fontWeight: '600' as const, color: '#1C1C1E', marginBottom: 10 },
  correctionsList: { maxHeight: 250 },
  correctionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEFCE8',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  correctionTexts: { flex: 1 },
  corrRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginBottom: 2 },
  corrOriginal: { fontSize: 14, color: '#DC2626', textDecorationLine: 'line-through', fontWeight: '500' as const },
  corrArrow: { fontSize: 13, color: '#9CA3AF' },
  corrFixed: { fontSize: 14, color: '#059669', fontWeight: '600' as const },
  corrExpl: { fontSize: 12, color: '#6B7280', lineHeight: 16 },
  corrSaveBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: IMESSAGE_BLUE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  corrSaveBtnDone: { backgroundColor: '#D1FAE5' },
  noCorrWrap: { alignItems: 'center', paddingVertical: 24 },
  noCorrTitle: { fontSize: 17, fontWeight: '600' as const, color: '#1C1C1E', marginTop: 10 },
  noCorrSub: { fontSize: 14, color: '#8E8E93', textAlign: 'center', marginTop: 4 },
  doneBtn: {
    backgroundColor: IMESSAGE_BLUE,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  doneBtnText: { fontSize: 17, fontWeight: '600' as const, color: '#FFFFFF' },
});

export default function TextSessionScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { proficiency, addGap } = useApp();

  const [phase, setPhase] = useState<'contacts' | 'chat'>('contacts');
  const [selectedPersonality, setSelectedPersonality] = useState<TextPersonality | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [allConversations, setAllConversations] = useState<AllConversations>({});
  const [usedStarterIndices, setUsedStarterIndices] = useState<number[]>([]);

  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [translatingId, setTranslatingId] = useState<string | null>(null);
  const [savedMessageIds, setSavedMessageIds] = useState<Set<string>>(new Set());
  const [savedCorrectionKeys, setSavedCorrectionKeys] = useState<Set<string>>(new Set());

  const [showSuggestions, setShowSuggestions] = useState(false);
  const [currentHints, setCurrentHints] = useState<string[]>([]);

  const [showSummary, setShowSummary] = useState(false);
  const [sessionCorrections, setSessionCorrections] = useState<SessionCorrection[]>([]);
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);

  const scrollViewRef = useRef<ScrollView>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    loadAllConversations().then(setAllConversations);
  }, []);

  const saveCurrentConversation = useCallback(async () => {
    if (!selectedPersonality || messages.length === 0) return;

    const updated = {
      ...allConversations,
      [selectedPersonality.id]: {
        messages: serializeMessages(messages),
        usedStarterIndices: usedStarterIndices,
        lastUpdated: new Date().toISOString(),
      },
    };
    setAllConversations(updated);
    await saveAllConversations(updated);
    console.log('[TextSession] Saved conversation for', selectedPersonality.id, 'with', messages.length, 'messages');
  }, [selectedPersonality, messages, allConversations, usedStarterIndices]);

  const selectPersonality = useCallback((personality: TextPersonality) => {
    setSelectedPersonality(personality);
    setSelectedMessageId(null);
    setTranslations({});
    setSavedMessageIds(new Set());
    setSavedCorrectionKeys(new Set());
    setSessionCorrections([]);
    setSessionStartTime(new Date());

    const existing = allConversations[personality.id];

    if (existing && existing.messages.length > 0) {
      const loaded = deserializeMessages(existing.messages);
      setMessages(loaded);
      setUsedStarterIndices(existing.usedStarterIndices || []);

      const existingCorrs: SessionCorrection[] = [];
      loaded.forEach(m => {
        if (m.corrections) {
          m.corrections.forEach(c => existingCorrs.push({ ...c, messageId: m.id }));
        }
      });
      setSessionCorrections(existingCorrs);
      setShowSuggestions(false);
      setCurrentHints([]);
    } else {
      setMessages([]);
      const prevIndices = existing?.usedStarterIndices || [];
      setUsedStarterIndices(prevIndices);

      const { starter, index } = getRandomStarter(personality, prevIndices);
      const newIndices = [...prevIndices, index];
      setUsedStarterIndices(newIndices);

      setTimeout(() => {
        const msg: Message = {
          id: Date.now().toString(),
          role: 'assistant',
          content: starter.message,
          displayContent: starter.message,
          timestamp: new Date(),
        };
        setMessages([msg]);
        setCurrentHints(starter.followUpHints);
        setShowSuggestions(true);
      }, 600);
    }

    setPhase('chat');
  }, [allConversations]);

  const sendNewTopic = useCallback(() => {
    if (!selectedPersonality) return;

    const { starter, index } = getRandomStarter(selectedPersonality, usedStarterIndices);
    const newIndices = [...usedStarterIndices, index];
    setUsedStarterIndices(newIndices);

    setIsLoading(true);
    setTimeout(() => {
      const msg: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: starter.message,
        displayContent: starter.message,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, msg]);
      setCurrentHints(starter.followUpHints);
      setShowSuggestions(true);
      setIsLoading(false);
    }, 800);
  }, [selectedPersonality, usedStarterIndices]);

  const sendMessage = useCallback(async (overrideText?: string) => {
    const text = (overrideText || inputText).trim();
    if (!text || !selectedPersonality || isLoading) return;

    setShowSuggestions(false);
    setSelectedMessageId(null);

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      displayContent: text,
      timestamp: new Date(),
      delivered: false,
      read: false,
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);

    setTimeout(() => {
      setMessages(prev => prev.map(m => m.id === userMessage.id ? { ...m, delivered: true } : m));
    }, 400);

    try {
      const conversationHistory = messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

      const systemPrompt = buildSystemPrompt(selectedPersonality, proficiency.certifiedLevels);
      const textConfig = getTextSessionConfig(proficiency.certifiedLevels);

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          ...conversationHistory,
          { role: 'user', content: text },
        ],
        max_tokens: textConfig.maxTokens,
        temperature: textConfig.temperature,
      });

      const rawContent = response.choices[0]?.message?.content || 'Désolé, je n\'ai pas compris.';
      const { displayContent, corrections } = parseCorrections(rawContent);

      setMessages(prev => prev.map(m => m.id === userMessage.id ? { ...m, read: true } : m));

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: rawContent,
        displayContent,
        timestamp: new Date(),
        corrections: corrections.length > 0 ? corrections : undefined,
      };

      setMessages(prev => [...prev, assistantMessage]);

      if (corrections.length > 0) {
        setSessionCorrections(prev => [
          ...prev,
          ...corrections.map(c => ({ ...c, messageId: assistantMessage.id })),
        ]);
      }
    } catch (error) {
      console.error('[TextSession] Chat error:', error);
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Désolé, il y a eu une erreur. Réessaie !',
        displayContent: 'Désolé, il y a eu une erreur. Réessaie !',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [inputText, selectedPersonality, isLoading, messages, proficiency]);

  const translateMessage = useCallback(async (messageId: string) => {
    if (translations[messageId] || translatingId) return;

    const msg = messages.find(m => m.id === messageId);
    if (!msg) return;

    setTranslatingId(messageId);
    try {
      const result = await generateText({
        messages: [
          { role: 'user', content: `Translate this French text to English. Output ONLY the English translation, nothing else:\n\n"${msg.displayContent}"` },
        ],
      });
      setTranslations(prev => ({ ...prev, [messageId]: result }));
    } catch (error) {
      console.error('[TextSession] Translation error:', error);
      setTranslations(prev => ({ ...prev, [messageId]: '[Translation unavailable]' }));
    } finally {
      setTranslatingId(null);
    }
  }, [messages, translations, translatingId]);

  const saveMessageAsGap = useCallback(async (messageId: string) => {
    const msg = messages.find(m => m.id === messageId);
    if (!msg || savedMessageIds.has(messageId)) return;

    let translation = translations[messageId];
    if (!translation) {
      try {
        translation = await generateText({
          messages: [
            { role: 'user', content: `Translate this French text to English. Output ONLY the English translation:\n\n"${msg.displayContent}"` },
          ],
        });
        setTranslations(prev => ({ ...prev, [messageId]: translation }));
      } catch {
        translation = 'Conversation phrase';
      }
    }

    await addGap(
      msg.displayContent,
      translation,
      `Phrase from text conversation with ${selectedPersonality?.name || 'AI'}`,
      msg.displayContent,
      translation,
      'speech',
      undefined,
      undefined,
      undefined,
      'vocab'
    );

    setSavedMessageIds(prev => new Set(prev).add(messageId));
    console.log('[TextSession] Saved message as gap:', messageId);
  }, [messages, translations, savedMessageIds, addGap, selectedPersonality]);

  const saveCorrectionAsGap = useCallback(async (correction: SessionCorrection, index: number) => {
    const key = `${correction.messageId}-${index}`;
    if (savedCorrectionKeys.has(key)) return;

    await addGap(
      correction.corrected,
      correction.explanation,
      `Correction: "${correction.original}" → "${correction.corrected}"`,
      correction.corrected,
      correction.explanation,
      'speech',
      undefined,
      undefined,
      undefined,
      'grammar'
    );

    setSavedCorrectionKeys(prev => new Set(prev).add(key));
    console.log('[TextSession] Saved correction as gap:', key);
  }, [savedCorrectionKeys, addGap]);

  const goBack = useCallback(async () => {
    if (phase === 'chat') {
      await saveCurrentConversation();

      if (sessionCorrections.length > 0 && messages.length > 2) {
        setShowSummary(true);
        return;
      }

      setPhase('contacts');
      setSelectedPersonality(null);
      setMessages([]);
    } else {
      safeGoBack();
    }
  }, [phase, router, saveCurrentConversation, sessionCorrections, messages]);

  const dismissSummary = useCallback(() => {
    setShowSummary(false);
    setPhase('contacts');
    setSelectedPersonality(null);
    setMessages([]);
    setSessionCorrections([]);
  }, []);

  const formatPreviewTime = useCallback((dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }, []);

  const formatTime = useCallback((date: Date) => {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }, []);

  const getLastUserMessage = useCallback(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') return messages[i];
    }
    return null;
  }, [messages]);

  const renderTimeHeader = useCallback((date: Date) => {
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    const timeStr = isToday
      ? 'Today ' + formatTime(date)
      : date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + ' ' + formatTime(date);

    return (
      <View style={styles.timeHeader}>
        <Text style={styles.timeHeaderText}>{timeStr}</Text>
      </View>
    );
  }, [formatTime]);

  const renderMessages = useCallback(() => {
    const elements: React.ReactNode[] = [];

    if (messages.length > 0) {
      elements.push(<View key="time-header">{renderTimeHeader(messages[0].timestamp)}</View>);
    }

    messages.forEach((msg, i) => {
      const next = messages[i + 1];
      const prev = messages[i - 1];
      const isFirst = !prev || prev.role !== msg.role;
      const isLast = !next || next.role !== msg.role;
      const showTail = isLast;
      const isSelected = selectedMessageId === msg.id;

      elements.push(
        <MessageBubble
          key={msg.id}
          message={msg}
          isFirst={isFirst}
          isLast={isLast}
          showTail={showTail}
          isSelected={isSelected}
          onPress={() => {
            if (msg.role === 'assistant') {
              setSelectedMessageId(isSelected ? null : msg.id);
            }
          }}
          onLongPress={() => {
            if (msg.role === 'assistant') {
              setSelectedMessageId(msg.id);
            }
          }}
        />
      );

      if (isSelected && msg.role === 'assistant') {
        elements.push(
          <MessageActionBar
            key={`actions-${msg.id}`}
            onTranslate={() => translateMessage(msg.id)}
            onSave={() => saveMessageAsGap(msg.id)}
            isTranslating={translatingId === msg.id}
            isSaved={savedMessageIds.has(msg.id)}
          />
        );
      }

      if (translations[msg.id]) {
        elements.push(
          <TranslationBubble key={`trans-${msg.id}`} text={translations[msg.id]} />
        );
      }

      if (msg.corrections && msg.corrections.length > 0) {
        msg.corrections.forEach((corr, ci) => {
          const corrKey = `${msg.id}-${ci}`;
          elements.push(
            <CorrectionCard
              key={`corr-${corrKey}`}
              correction={corr}
              onSave={() => saveCorrectionAsGap({ ...corr, messageId: msg.id }, ci)}
              saved={savedCorrectionKeys.has(corrKey)}
            />
          );
        });
      }

      if (msg.role === 'user' && isLast) {
        const lastUser = getLastUserMessage();
        if (lastUser && lastUser.id === msg.id) {
          elements.push(
            <View key={`status-${msg.id}`} style={styles.deliveryStatus}>
              <Text style={styles.deliveryText}>
                {msg.read ? 'Read' : msg.delivered ? 'Delivered' : ''}
              </Text>
            </View>
          );
        }
      }
    });

    return elements;
  }, [messages, selectedMessageId, translations, translatingId, savedMessageIds, savedCorrectionKeys, renderTimeHeader, getLastUserMessage, translateMessage, saveMessageAsGap, saveCorrectionAsGap]);

  const sessionDuration = sessionStartTime ? Date.now() - sessionStartTime.getTime() : 0;

  if (phase === 'contacts') {
    return (
      <View style={styles.contactsContainer}>
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <View style={styles.contactsHeaderBar}>
            <Pressable onPress={() => safeGoBack()} style={styles.headerBackBtn} hitSlop={10}>
              <ChevronLeft size={28} color={IMESSAGE_BLUE} />
            </Pressable>
            <Text style={styles.contactsHeaderEdit}>Edit</Text>
          </View>

          <View style={styles.contactsTitleRow}>
            <Text style={styles.contactsTitle}>Messages</Text>
          </View>

          <View style={styles.searchBarWrap}>
            <View style={styles.searchBar}>
              <Text style={styles.searchPlaceholder}>Search</Text>
            </View>
          </View>

          <ScrollView
            style={styles.contactsList}
            contentContainerStyle={styles.contactsListContent}
            showsVerticalScrollIndicator={false}
          >
            {textPersonalities.map((personality) => {
              const conv = allConversations[personality.id];
              const hasConvo = conv && conv.messages.length > 0;
              const lastMsg = hasConvo ? conv.messages[conv.messages.length - 1] : null;

              return (
                <Pressable
                  key={personality.id}
                  style={({ pressed }) => [
                    styles.contactRow,
                    pressed && { backgroundColor: '#E5E5EA' },
                  ]}
                  onPress={() => selectPersonality(personality)}
                >
                  <View style={[styles.contactAvatar, { backgroundColor: personality.color + '18' }]}>
                    <Text style={styles.contactAvatarEmoji}>{personality.avatar}</Text>
                  </View>

                  <View style={styles.contactBody}>
                    <View style={styles.contactTopRow}>
                      <Text style={styles.contactName} numberOfLines={1}>{personality.name}</Text>
                      <Text style={styles.contactTimestamp}>
                        {hasConvo && conv.lastUpdated ? formatPreviewTime(conv.lastUpdated) : ''}
                      </Text>
                    </View>
                    <Text style={styles.contactPreview} numberOfLines={2}>
                      {lastMsg ? lastMsg.displayContent : personality.subtitle}
                    </Text>
                  </View>

                  {!hasConvo && (
                    <View style={styles.newBadge}>
                      <Text style={styles.newBadgeText}>NEW</Text>
                    </View>
                  )}

                  <ChevronRight size={15} color="#C7C7CC" />
                </Pressable>
              );
            })}
          </ScrollView>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.chatContainer}>
      <View style={[styles.chatHeaderBar, { paddingTop: insets.top }]}>
        <Pressable onPress={goBack} style={styles.chatBackBtn} hitSlop={10}>
          <ChevronLeft size={28} color={IMESSAGE_BLUE} />
        </Pressable>

        <Pressable style={styles.chatHeaderProfile}>
          <View style={[styles.chatHeaderAvatarCircle, { backgroundColor: selectedPersonality?.color + '18' }]}>
            <Text style={styles.chatHeaderAvatarEmoji}>{selectedPersonality?.avatar}</Text>
          </View>
          <Text style={styles.chatHeaderName} numberOfLines={1}>{selectedPersonality?.name}</Text>
        </Pressable>

        <Pressable onPress={sendNewTopic} style={styles.newTopicBtn} hitSlop={10}>
          <RefreshCw size={18} color={IMESSAGE_BLUE} />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesList}
          contentContainerStyle={styles.messagesContentPad}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        >
          <Pressable onPress={() => setSelectedMessageId(null)}>
            <View style={styles.chatBannerWrap}>
              <View style={[styles.bannerAvatarLarge, { backgroundColor: selectedPersonality?.color + '15' }]}>
                <Text style={styles.bannerAvatarEmoji}>{selectedPersonality?.avatar}</Text>
              </View>
              <Text style={styles.bannerName}>{selectedPersonality?.name}</Text>
              <Text style={styles.bannerSub}>{selectedPersonality?.niche}</Text>
              <View style={styles.bannerPill}>
                <Text style={styles.bannerPillText}>{selectedPersonality?.typingStyle}</Text>
              </View>
            </View>

            {renderMessages()}

            {isLoading && (
              <View style={[bStyles.bubbleRow, bStyles.assistantRow, { marginBottom: 6 }]}>
                <View style={[bStyles.bubble, bStyles.assistantBubble, {
                  borderTopLeftRadius: 18,
                  borderTopRightRadius: 18,
                  borderBottomLeftRadius: 4,
                  borderBottomRightRadius: 18,
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                }]}>
                  <TypingDots />
                </View>
              </View>
            )}
          </Pressable>
        </ScrollView>

        {showSuggestions && currentHints.length > 0 && (
          <SuggestionChips
            hints={currentHints}
            onSelect={(hint) => {
              setShowSuggestions(false);
              setInputText(hint);
              setTimeout(() => sendMessage(hint), 100);
            }}
            onNewTopic={sendNewTopic}
          />
        )}

        <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          <Pressable
            style={styles.inputIconBtn}
            onPress={() => setShowSuggestions(s => !s)}
          >
            <Plus size={24} color={showSuggestions ? IMESSAGE_BLUE : '#8E8E93'} />
          </Pressable>

          <View style={styles.inputFieldWrap}>
            <TextInput
              style={styles.inputField}
              value={inputText}
              onChangeText={setInputText}
              placeholder="iMessage"
              placeholderTextColor="#8E8E93"
              multiline
              maxLength={500}
              onSubmitEditing={() => sendMessage()}
              blurOnSubmit={false}
            />
          </View>

          {inputText.trim() ? (
            <Pressable
              style={[styles.sendCircle, isLoading && { opacity: 0.4 }]}
              onPress={() => sendMessage()}
              disabled={isLoading}
            >
              <ArrowUp size={18} color="#FFFFFF" strokeWidth={3} />
            </Pressable>
          ) : (
            <Pressable style={styles.inputIconBtn}>
              <Mic size={22} color="#8E8E93" />
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>

      <SessionSummaryModal
        visible={showSummary}
        personality={selectedPersonality}
        messageCount={messages.length}
        corrections={sessionCorrections}
        savedKeys={savedCorrectionKeys}
        sessionDuration={sessionDuration}
        onSaveCorrection={saveCorrectionAsGap}
        onDismiss={dismissSummary}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  contactsContainer: {
    flex: 1,
    backgroundColor: CONTACT_LIST_BG,
  },
  contactsHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  headerBackBtn: {
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  contactsHeaderEdit: {
    fontSize: 17,
    color: IMESSAGE_BLUE,
    paddingHorizontal: 8,
  },
  contactsTitleRow: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 6,
  },
  contactsTitle: {
    fontSize: 34,
    fontWeight: '700' as const,
    color: '#000000',
    letterSpacing: 0.37,
  },
  searchBarWrap: {
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  searchBar: {
    backgroundColor: '#E5E5EA',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  searchPlaceholder: {
    color: '#8E8E93',
    fontSize: 17,
  },
  contactsList: { flex: 1 },
  contactsListContent: { paddingBottom: 40 },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#C6C6C8',
  },
  contactAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  contactAvatarEmoji: { fontSize: 26 },
  contactBody: { flex: 1, justifyContent: 'center' },
  contactTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 3,
  },
  contactName: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: '#000000',
    flex: 1,
    marginRight: 8,
  },
  contactTimestamp: {
    fontSize: 15,
    color: '#8E8E93',
  },
  contactPreview: {
    fontSize: 15,
    color: '#8E8E93',
    lineHeight: 20,
  },
  newBadge: {
    backgroundColor: IMESSAGE_BLUE,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 6,
  },
  newBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  chatContainer: {
    flex: 1,
    backgroundColor: CHAT_BG,
  },
  chatHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: HEADER_BG,
    paddingHorizontal: 4,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#A9A9AF',
  },
  chatBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 4,
    minWidth: 60,
  },
  chatHeaderProfile: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  chatHeaderAvatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  chatHeaderAvatarEmoji: { fontSize: 17 },
  chatHeaderName: {
    fontSize: 11,
    fontWeight: '500' as const,
    color: '#000000',
    textAlign: 'center',
  },
  newTopicBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 60,
    alignItems: 'flex-end',
  },
  messagesList: { flex: 1 },
  messagesContentPad: { paddingBottom: 12 },
  chatBannerWrap: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 20,
    paddingHorizontal: 40,
  },
  bannerAvatarLarge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  bannerAvatarEmoji: { fontSize: 38 },
  bannerName: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: '#000000',
    marginBottom: 2,
  },
  bannerSub: {
    fontSize: 13,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 8,
  },
  bannerPill: {
    backgroundColor: '#E5E5EA',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
  },
  bannerPillText: {
    fontSize: 12,
    color: '#8E8E93',
    textAlign: 'center',
  },
  timeHeader: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  timeHeaderText: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500' as const,
  },
  deliveryStatus: {
    alignSelf: 'flex-end',
    paddingRight: 20,
    marginBottom: 4,
    marginTop: -2,
  },
  deliveryText: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '400' as const,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
    paddingTop: 6,
    backgroundColor: HEADER_BG,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#A9A9AF',
    gap: 4,
  },
  inputIconBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 1,
  },
  inputFieldWrap: {
    flex: 1,
    backgroundColor: INPUT_BG,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#C7C7CC',
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 6 : 2,
    minHeight: 36,
    justifyContent: 'center',
  },
  inputField: {
    fontSize: 17,
    color: '#000000',
    maxHeight: 100,
    lineHeight: 22,
    paddingTop: Platform.OS === 'ios' ? 2 : 4,
    paddingBottom: Platform.OS === 'ios' ? 2 : 4,
  },
  sendCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: IMESSAGE_BLUE,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
});
