import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Animated,
  ActivityIndicator,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateObject, generateText } from '@rork-ai/toolkit-sdk';
import { z } from 'zod';
import {
  ArrowLeft,
  Search,
  Bookmark,
  BookmarkCheck,
  ChevronRight,
  MessageSquareText,
  HelpCircle,
  Lightbulb,
  Volume2,
  Trash2,
  Clock,
  Sparkles,
  Coffee,
  ShoppingBag,
  Train,
  Hotel,
  Stethoscope,
  Phone,
  MapPin,
  Users,
  Languages,
  Plus,
  X,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { USE_NATIVE_DRIVER } from '@/constants/animation';
import { safeGoBack } from '@/utils/navigation';
import { useFrenchAudio } from '@/hooks/useFrenchAudio';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const STORAGE_KEY = 'okiri_saved_scenarios';

interface ScenarioPhrase {
  french: string;
  english: string;
  context: string;
}

interface ScenarioQA {
  question: string;
  questionEnglish: string;
  answer: string;
  answerEnglish: string;
}

interface ScenarioTip {
  tip: string;
  category: 'native' | 'cultural' | 'practical';
}

interface ScenarioResult {
  title: string;
  titleFrench: string;
  summary: string;
  keyPhrases: ScenarioPhrase[];
  questionsAndAnswers: ScenarioQA[];
  tips: ScenarioTip[];
  nativeExpressions: ScenarioPhrase[];
}

interface SavedScenario {
  id: string;
  query: string;
  result: ScenarioResult;
  savedAt: string;
}

const scenarioSchema = z.object({
  title: z.string(),
  titleFrench: z.string(),
  summary: z.string(),
  keyPhrases: z.array(z.object({
    french: z.string(),
    english: z.string(),
    context: z.string(),
  })),
  questionsAndAnswers: z.array(z.object({
    question: z.string(),
    questionEnglish: z.string(),
    answer: z.string(),
    answerEnglish: z.string(),
  })),
  tips: z.array(z.object({
    tip: z.string(),
    category: z.enum(['native', 'cultural', 'practical']),
  })),
  nativeExpressions: z.array(z.object({
    french: z.string(),
    english: z.string(),
    context: z.string(),
  })),
});

const QUICK_SCENARIOS = [
  { label: 'Restaurant', icon: Coffee, color: '#D97706' },
  { label: 'Shopping', icon: ShoppingBag, color: '#059669' },
  { label: 'Train Station', icon: Train, color: '#2563EB' },
  { label: 'Hotel', icon: Hotel, color: '#7C3AED' },
  { label: 'Doctor', icon: Stethoscope, color: '#DC2626' },
  { label: 'Phone Call', icon: Phone, color: '#0891B2' },
  { label: 'Asking Directions', icon: MapPin, color: '#EA580C' },
  { label: 'Meeting People', icon: Users, color: '#DB2777' },
];

type TabKey = 'phrases' | 'qa' | 'tips';

export default function ScenariosScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentResult, setCurrentResult] = useState<ScenarioResult | null>(null);
  const [savedScenarios, setSavedScenarios] = useState<SavedScenario[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>('phrases');
  const [showSaved, setShowSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentQuery, setCurrentQuery] = useState('');
  const [customPhrases, setCustomPhrases] = useState<ScenarioPhrase[]>([]);
  const [translatorOpen, setTranslatorOpen] = useState(false);
  const [translateInput, setTranslateInput] = useState('');
  const [translateResult, setTranslateResult] = useState<{ french: string; english: string } | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const { speak, stop, isSpeaking } = useFrenchAudio();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const resultAnim = useRef(new Animated.Value(0)).current;
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
    loadSavedScenarios();
  }, [fadeAnim]);

  useEffect(() => {
    if (!isSpeaking) {
      setPlayingId(null);
    }
  }, [isSpeaking]);

  const loadSavedScenarios = async () => {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (data) {
        setSavedScenarios(JSON.parse(data));
      }
    } catch (e) {
      console.log('[Scenarios] Failed to load saved scenarios:', e);
    }
  };

  const toggleSaveScenario = useCallback(async () => {
    if (!currentResult) return;
    const existing = savedScenarios.find(s => s.query === currentQuery);

    if (existing) {
      const updated = savedScenarios.filter(s => s.query !== currentQuery);
      setSavedScenarios(updated);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      console.log('[Scenarios] Unsaved scenario:', currentQuery);
      return;
    }

    const resultWithCustom: ScenarioResult = {
      ...currentResult,
      keyPhrases: [...currentResult.keyPhrases, ...customPhrases],
    };
    const newSaved: SavedScenario = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2),
      query: currentQuery,
      result: resultWithCustom,
      savedAt: new Date().toISOString(),
    };
    const updated = [newSaved, ...savedScenarios];
    setSavedScenarios(updated);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    console.log('[Scenarios] Saved scenario:', currentQuery);
  }, [currentResult, currentQuery, savedScenarios, customPhrases]);

  const deleteScenario = useCallback(async (id: string) => {
    const updated = savedScenarios.filter(s => s.id !== id);
    setSavedScenarios(updated);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [savedScenarios]);

  const isCurrentSaved = useMemo(() => {
    return savedScenarios.some(s => s.query === currentQuery);
  }, [savedScenarios, currentQuery]);

  const handleTranslate = useCallback(async () => {
    if (!translateInput.trim()) return;
    setIsTranslating(true);
    setTranslateResult(null);
    try {
      const result = await generateText({
        messages: [{
          role: 'user',
          content: `Translate the following English phrase to French. Return ONLY the French translation, nothing else:\n\n"${translateInput.trim()}"`
        }],
      });
      setTranslateResult({ french: result.trim(), english: translateInput.trim() });
      console.log('[Scenarios] Translated:', translateInput, '->', result.trim());
    } catch (e) {
      console.error('[Scenarios] Translation failed:', e);
      setTranslateResult({ french: 'Translation failed', english: translateInput.trim() });
    } finally {
      setIsTranslating(false);
    }
  }, [translateInput]);

  const addTranslatedPhrase = useCallback(() => {
    if (!translateResult || translateResult.french === 'Translation failed') return;
    const newPhrase: ScenarioPhrase = {
      french: translateResult.french,
      english: translateResult.english,
      context: 'Added from translator',
    };
    setCustomPhrases(prev => [...prev, newPhrase]);
    setTranslateInput('');
    setTranslateResult(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    console.log('[Scenarios] Added custom phrase:', newPhrase.french);
  }, [translateResult]);

  const playAudio = useCallback(async (text: string, id: string) => {
    if (playingId === id && isSpeaking) {
      await stop();
      setPlayingId(null);
      return;
    }
    if (isSpeaking) {
      await stop();
    }
    setPlayingId(id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await speak(text);
  }, [playingId, speak, stop, isSpeaking]);

  const generateScenario = useCallback(async (scenarioQuery: string) => {
    if (!scenarioQuery.trim()) return;
    setIsGenerating(true);
    setError(null);
    setCurrentResult(null);
    setCurrentQuery(scenarioQuery.trim());
    setShowSaved(false);
    setCustomPhrases([]);
    setTranslatorOpen(false);
    setTranslateInput('');
    setTranslateResult(null);
    resultAnim.setValue(0);

    console.log('[Scenarios] Generating scenario for:', scenarioQuery);

    try {
      const result = await generateObject({
        messages: [
          {
            role: 'user',
            content: `You are a French language survival guide assistant. A user is in France and needs quick help with this real-life situation: "${scenarioQuery}"

Generate a comprehensive quick-reference guide with:

1. **title**: A clear English title for this scenario
2. **titleFrench**: The French equivalent title
3. **summary**: A 1-2 sentence overview of what to expect in this situation in France

4. **keyPhrases** (8-10 phrases): The most essential phrases they'll need. Include:
   - Greetings and openers specific to this context
   - Key request phrases
   - Polite expressions
   - Closing/thank you phrases
   Each with: french text, english translation, and when/how to use it (context)

5. **questionsAndAnswers** (5-6): Common questions they might hear FROM French speakers in this situation, with suggested responses. Both in French and English.

6. **tips** (4-5): Practical tips including:
   - Cultural norms specific to this situation
   - Things to avoid (faux pas)
   - Ways to sound more natural/native
   Mark each as 'native' (language tips), 'cultural' (French culture), or 'practical' (logistics)

7. **nativeExpressions** (3-4): Colloquial or idiomatic expressions a native would use in this situation that would impress locals. Include french, english translation, and usage context.

Make it practical and immediately usable. Prioritize phrases by usefulness.`,
          },
        ],
        schema: scenarioSchema,
      });

      setCurrentResult(result);
      setActiveTab('phrases');
      Animated.spring(resultAnim, {
        toValue: 1,
        tension: 50,
        friction: 9,
        useNativeDriver: USE_NATIVE_DRIVER,
      }).start();
      console.log('[Scenarios] Generated successfully:', result.title);
    } catch (e) {
      console.error('[Scenarios] Generation failed:', e);
      setError('Failed to generate scenario. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  }, [resultAnim]);

  const openSavedScenario = useCallback((scenario: SavedScenario) => {
    setCurrentResult(scenario.result);
    setCurrentQuery(scenario.query);
    setShowSaved(false);
    setActiveTab('phrases');
    setCustomPhrases([]);
    setTranslatorOpen(false);
    setTranslateInput('');
    setTranslateResult(null);
    resultAnim.setValue(0);
    Animated.spring(resultAnim, {
      toValue: 1,
      tension: 50,
      friction: 9,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [resultAnim]);

  const tipCategoryStyle = (cat: string) => {
    switch (cat) {
      case 'native': return { bg: '#EFF6FF', text: '#2563EB', label: 'Language' };
      case 'cultural': return { bg: '#FFF7ED', text: '#EA580C', label: 'Culture' };
      case 'practical': return { bg: '#ECFDF5', text: '#059669', label: 'Practical' };
      default: return { bg: '#F3F4F6', text: '#6B7280', label: cat };
    }
  };

  const renderSearchView = () => (
    <View style={styles.searchSection}>
      <View style={styles.inputRow}>
        <View style={styles.inputContainer}>
          <Search size={18} color={Colors.textMuted} />
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="Describe your situation..."
            placeholderTextColor={Colors.textMuted}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => generateScenario(query)}
            returnKeyType="search"
            testID="scenario-input"
          />
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.goButton,
            !query.trim() && styles.goButtonDisabled,
            pressed && { opacity: 0.85 },
          ]}
          onPress={() => generateScenario(query)}
          disabled={!query.trim() || isGenerating}
          testID="scenario-generate"
        >
          <Sparkles size={18} color="#fff" />
        </Pressable>
      </View>

      <Text style={styles.quickLabel}>Quick scenarios</Text>
      <View style={styles.quickGrid}>
        {QUICK_SCENARIOS.map((item) => (
          <Pressable
            key={item.label}
            style={({ pressed }) => [
              styles.quickChip,
              pressed && { opacity: 0.8, transform: [{ scale: 0.96 }] },
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setQuery(item.label);
              generateScenario(item.label);
            }}
          >
            <View style={[styles.quickChipIcon, { backgroundColor: item.color + '18' }]}>
              <item.icon size={16} color={item.color} />
            </View>
            <Text style={styles.quickChipText}>{item.label}</Text>
          </Pressable>
        ))}
      </View>

      {savedScenarios.length > 0 && (
        <View style={styles.savedSection}>
          <View style={styles.savedHeader}>
            <View style={styles.savedHeaderLeft}>
              <Clock size={14} color={Colors.textSecondary} />
              <Text style={styles.savedTitle}>Saved Scenarios</Text>
            </View>
            <Text style={styles.savedCount}>{savedScenarios.length}</Text>
          </View>
          {savedScenarios.slice(0, 5).map((scenario) => (
            <Pressable
              key={scenario.id}
              style={({ pressed }) => [
                styles.savedCard,
                pressed && { opacity: 0.85 },
              ]}
              onPress={() => openSavedScenario(scenario)}
            >
              <View style={styles.savedCardContent}>
                <Text style={styles.savedCardTitle} numberOfLines={1}>
                  {scenario.result.title}
                </Text>
                <Text style={styles.savedCardSub} numberOfLines={1}>
                  {scenario.result.titleFrench}
                </Text>
              </View>
              <Pressable
                style={styles.deleteBtn}
                onPress={(e) => {
                  e.stopPropagation();
                  deleteScenario(scenario.id);
                }}
                hitSlop={8}
              >
                <Trash2 size={14} color={Colors.textMuted} />
              </Pressable>
              <ChevronRight size={16} color={Colors.textMuted} />
            </Pressable>
          ))}
          {savedScenarios.length > 5 && (
            <Pressable
              style={styles.showAllBtn}
              onPress={() => setShowSaved(true)}
            >
              <Text style={styles.showAllText}>View all {savedScenarios.length} scenarios</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );

  const renderResultView = () => {
    if (!currentResult) return null;

    return (
      <Animated.View style={[styles.resultContainer, {
        opacity: resultAnim,
        transform: [{ translateY: resultAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
      }]}>
        <View style={styles.resultHeader}>
          <View style={styles.resultTitleSection}>
            <Text style={styles.resultTitle}>{currentResult.title}</Text>
            <Text style={styles.resultTitleFr}>{currentResult.titleFrench}</Text>
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.saveBtn,
              isCurrentSaved && styles.saveBtnActive,
              pressed && { opacity: 0.8 },
            ]}
            onPress={toggleSaveScenario}
          >
            {isCurrentSaved
              ? <BookmarkCheck size={20} color={Colors.primary} />
              : <Bookmark size={20} color={Colors.textSecondary} />
            }
          </Pressable>
        </View>

        <Text style={styles.resultSummary}>{currentResult.summary}</Text>

        <View style={styles.tabBar}>
          {([
            { key: 'phrases' as TabKey, label: 'Phrases', icon: MessageSquareText },
            { key: 'qa' as TabKey, label: 'Q & A', icon: HelpCircle },
            { key: 'tips' as TabKey, label: 'Tips', icon: Lightbulb },
          ]).map((tab) => (
            <Pressable
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.tabActive]}
              onPress={() => {
                setActiveTab(tab.key);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
            >
              <tab.icon size={14} color={activeTab === tab.key ? Colors.primary : Colors.textMuted} />
              <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {activeTab === 'phrases' && (
          <View style={styles.tabContent}>
            {currentResult.keyPhrases.map((phrase, i) => (
              <Pressable
                key={i}
                style={({ pressed }) => [styles.phraseCard, pressed && { opacity: 0.85 }]}
                onPress={() => playAudio(phrase.french, `phrase-${i}`)}
              >
                <View style={styles.phraseNumberBadge}>
                  <Text style={styles.phraseNumber}>{i + 1}</Text>
                </View>
                <View style={styles.phraseContent}>
                  <Text style={styles.phraseFrench}>{phrase.french}</Text>
                  <Text style={styles.phraseEnglish}>{phrase.english}</Text>
                  <View style={styles.phraseContextRow}>
                    <View style={styles.contextDot} />
                    <Text style={styles.phraseContext}>{phrase.context}</Text>
                  </View>
                </View>
                <View style={[styles.audioHint, playingId === `phrase-${i}` && styles.audioHintActive]}>
                  <Volume2 size={14} color={playingId === `phrase-${i}` ? Colors.primary : Colors.textMuted} />
                </View>
              </Pressable>
            ))}

            {customPhrases.length > 0 && (
              <>
                <View style={styles.nativeDivider}>
                  <View style={[styles.nativeDividerLine, { backgroundColor: Colors.accent }]} />
                  <View style={[styles.nativeBadge, { backgroundColor: Colors.primaryLight }]}>
                    <Plus size={12} color={Colors.primary} />
                    <Text style={[styles.nativeBadgeText, { color: Colors.primaryDark }]}>Your Phrases</Text>
                  </View>
                  <View style={[styles.nativeDividerLine, { backgroundColor: Colors.accent }]} />
                </View>
                {customPhrases.map((phrase, i) => (
                  <Pressable
                    key={`custom-${i}`}
                    style={({ pressed }) => [styles.phraseCard, styles.customCard, pressed && { opacity: 0.85 }]}
                    onPress={() => playAudio(phrase.french, `custom-${i}`)}
                  >
                    <View style={[styles.phraseNumberBadge, { backgroundColor: Colors.primaryLight }]}>
                      <Plus size={12} color={Colors.primary} />
                    </View>
                    <View style={styles.phraseContent}>
                      <Text style={styles.phraseFrench}>{phrase.french}</Text>
                      <Text style={styles.phraseEnglish}>{phrase.english}</Text>
                      <View style={styles.phraseContextRow}>
                        <View style={[styles.contextDot, { backgroundColor: Colors.primary }]} />
                        <Text style={styles.phraseContext}>{phrase.context}</Text>
                      </View>
                    </View>
                    <View style={[styles.audioHint, playingId === `custom-${i}` && styles.audioHintActive]}>
                      <Volume2 size={14} color={playingId === `custom-${i}` ? Colors.primary : Colors.textMuted} />
                    </View>
                  </Pressable>
                ))}
              </>
            )}

            {currentResult.nativeExpressions.length > 0 && (
              <>
                <View style={styles.nativeDivider}>
                  <View style={styles.nativeDividerLine} />
                  <View style={styles.nativeBadge}>
                    <Volume2 size={12} color="#D97706" />
                    <Text style={styles.nativeBadgeText}>Sound Like a Native</Text>
                  </View>
                  <View style={styles.nativeDividerLine} />
                </View>
                {currentResult.nativeExpressions.map((expr, i) => (
                  <Pressable
                    key={`native-${i}`}
                    style={({ pressed }) => [styles.phraseCard, styles.nativeCard, pressed && { opacity: 0.85 }]}
                    onPress={() => playAudio(expr.french, `native-${i}`)}
                  >
                    <View style={[styles.phraseNumberBadge, { backgroundColor: '#FEF3C7' }]}>
                      <Sparkles size={12} color="#D97706" />
                    </View>
                    <View style={styles.phraseContent}>
                      <Text style={[styles.phraseFrench, { color: '#92400E' }]}>{expr.french}</Text>
                      <Text style={styles.phraseEnglish}>{expr.english}</Text>
                      <View style={styles.phraseContextRow}>
                        <View style={[styles.contextDot, { backgroundColor: '#D97706' }]} />
                        <Text style={styles.phraseContext}>{expr.context}</Text>
                      </View>
                    </View>
                    <View style={[styles.audioHint, playingId === `native-${i}` && styles.audioHintActive]}>
                      <Volume2 size={14} color={playingId === `native-${i}` ? '#D97706' : Colors.textMuted} />
                    </View>
                  </Pressable>
                ))}
              </>
            )}
          </View>
        )}

        {activeTab === 'qa' && (
          <View style={styles.tabContent}>
            <Text style={styles.qaIntro}>Tap any phrase to hear it spoken</Text>
            {currentResult.questionsAndAnswers.map((qa, i) => (
              <View key={i} style={styles.qaCard}>
                <Pressable
                  style={({ pressed }) => [styles.qaQuestionSection, pressed && { opacity: 0.8 }]}
                  onPress={() => playAudio(qa.question, `qa-q-${i}`)}
                >
                  <View style={styles.qaBubbleRow}>
                    <View style={styles.qaTheyBadge}>
                      <Text style={styles.qaTheyBadgeText}>They ask</Text>
                    </View>
                    <View style={[styles.qaAudioBtn, playingId === `qa-q-${i}` && styles.qaAudioBtnActive]}>
                      <Volume2 size={12} color={playingId === `qa-q-${i}` ? '#DC2626' : Colors.textMuted} />
                    </View>
                  </View>
                  <Text style={styles.qaFrench}>{qa.question}</Text>
                  <Text style={styles.qaEnglish}>{qa.questionEnglish}</Text>
                </Pressable>
                <View style={styles.qaAnswerDivider} />
                <Pressable
                  style={({ pressed }) => [styles.qaAnswerSection, pressed && { opacity: 0.8 }]}
                  onPress={() => playAudio(qa.answer, `qa-a-${i}`)}
                >
                  <View style={styles.qaBubbleRow}>
                    <View style={styles.qaYouBadge}>
                      <Text style={styles.qaYouBadgeText}>You say</Text>
                    </View>
                    <View style={[styles.qaAudioBtn, playingId === `qa-a-${i}` && styles.qaAudioBtnActive]}>
                      <Volume2 size={12} color={playingId === `qa-a-${i}` ? '#059669' : Colors.textMuted} />
                    </View>
                  </View>
                  <Text style={styles.qaFrench}>{qa.answer}</Text>
                  <Text style={styles.qaEnglish}>{qa.answerEnglish}</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'tips' && (
          <View style={styles.tabContent}>
            {currentResult.tips.map((tip, i) => {
              const style = tipCategoryStyle(tip.category);
              return (
                <View key={i} style={styles.tipCard}>
                  <View style={[styles.tipCategoryBadge, { backgroundColor: style.bg }]}>
                    <Text style={[styles.tipCategoryText, { color: style.text }]}>{style.label}</Text>
                  </View>
                  <Text style={styles.tipText}>{tip.tip}</Text>
                </View>
              );
            })}
          </View>
        )}

        {translatorOpen ? (
          <View style={styles.translatorSection}>
            <View style={styles.translatorHeader}>
              <View style={styles.translatorTitleRow}>
                <Languages size={16} color={Colors.secondary} />
                <Text style={styles.translatorTitle}>Quick Translator</Text>
              </View>
              <Pressable
                style={styles.translatorClose}
                onPress={() => {
                  setTranslatorOpen(false);
                  setTranslateInput('');
                  setTranslateResult(null);
                }}
                hitSlop={8}
              >
                <X size={16} color={Colors.textMuted} />
              </Pressable>
            </View>
            <View style={styles.translatorInputRow}>
              <TextInput
                style={styles.translatorInput}
                placeholder="Type in English..."
                placeholderTextColor={Colors.textMuted}
                value={translateInput}
                onChangeText={setTranslateInput}
                onSubmitEditing={handleTranslate}
                returnKeyType="go"
                testID="translator-input"
              />
              <Pressable
                style={({ pressed }) => [
                  styles.translatorGoBtn,
                  (!translateInput.trim() || isTranslating) && { opacity: 0.5 },
                  pressed && { opacity: 0.8 },
                ]}
                onPress={handleTranslate}
                disabled={!translateInput.trim() || isTranslating}
              >
                {isTranslating
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Languages size={16} color="#fff" />
                }
              </Pressable>
            </View>
            {translateResult && (
              <View style={styles.translatorResult}>
                <Pressable
                  style={({ pressed }) => [styles.translatorResultContent, pressed && { opacity: 0.8 }]}
                  onPress={() => playAudio(translateResult.french, 'translate-result')}
                >
                  <Text style={styles.translatorResultFr}>{translateResult.french}</Text>
                  <Text style={styles.translatorResultEn}>{translateResult.english}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
                    <Volume2 size={12} color={playingId === 'translate-result' ? Colors.primary : Colors.textMuted} />
                    <Text style={{ fontSize: 11, color: Colors.textMuted }}>Tap to hear</Text>
                  </View>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.addPhraseBtn,
                    pressed && { opacity: 0.8 },
                  ]}
                  onPress={addTranslatedPhrase}
                >
                  <Plus size={14} color="#fff" />
                  <Text style={styles.addPhraseBtnText}>Add</Text>
                </Pressable>
              </View>
            )}
          </View>
        ) : (
          <Pressable
            style={({ pressed }) => [
              styles.translatorToggle,
              pressed && { opacity: 0.85 },
            ]}
            onPress={() => {
              setTranslatorOpen(true);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <Languages size={16} color={Colors.secondary} />
            <Text style={styles.translatorToggleText}>Translate & Add Phrase</Text>
          </Pressable>
        )}

        <Pressable
          style={({ pressed }) => [
            styles.newScenarioBtn,
            pressed && { opacity: 0.85 },
          ]}
          onPress={() => {
            setCurrentResult(null);
            setQuery('');
            setCurrentQuery('');
            setCustomPhrases([]);
            setTranslatorOpen(false);
            setTranslateInput('');
            setTranslateResult(null);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
        >
          <Search size={16} color={Colors.primary} />
          <Text style={styles.newScenarioBtnText}>New Scenario</Text>
        </Pressable>
      </Animated.View>
    );
  };

  const renderSavedList = () => (
    <View style={styles.savedFullList}>
      <View style={styles.savedFullHeader}>
        <Pressable onPress={() => setShowSaved(false)} style={styles.savedBackBtn}>
          <ArrowLeft size={20} color={Colors.text} />
        </Pressable>
        <Text style={styles.savedFullTitle}>All Saved Scenarios</Text>
      </View>
      {savedScenarios.map((scenario) => (
        <Pressable
          key={scenario.id}
          style={({ pressed }) => [
            styles.savedFullCard,
            pressed && { opacity: 0.85 },
          ]}
          onPress={() => openSavedScenario(scenario)}
        >
          <View style={styles.savedFullCardContent}>
            <Text style={styles.savedFullCardTitle}>{scenario.result.title}</Text>
            <Text style={styles.savedFullCardSub}>{scenario.result.titleFrench}</Text>
            <Text style={styles.savedFullCardDate}>
              {new Date(scenario.savedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </Text>
          </View>
          <Pressable
            style={styles.deleteBtn}
            onPress={(e) => {
              e.stopPropagation();
              deleteScenario(scenario.id);
            }}
            hitSlop={8}
          >
            <Trash2 size={16} color={Colors.error} />
          </Pressable>
        </Pressable>
      ))}
      {savedScenarios.length === 0 && (
        <View style={styles.emptyState}>
          <Bookmark size={32} color={Colors.textMuted} />
          <Text style={styles.emptyText}>No saved scenarios yet</Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0F766E', '#0D9488', '#14B8A6']}
        style={styles.headerGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <SafeAreaView edges={['top']} style={styles.headerSafe}>
          <View style={styles.headerRow}>
            <Pressable
              style={styles.backBtn}
              onPress={() => safeGoBack()}
              testID="back-button"
            >
              <ArrowLeft size={22} color="#fff" />
            </Pressable>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>Scenarios</Text>
              <Text style={styles.headerSub}>Quick help for real-life situations</Text>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Animated.ScrollView
          style={[styles.flex, { opacity: fadeAnim }]}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {isGenerating && (
            <View style={styles.loadingContainer}>
              <View style={styles.loadingCard}>
                <ActivityIndicator size="large" color={Colors.secondary} />
                <Text style={styles.loadingTitle}>Building your guide...</Text>
                <Text style={styles.loadingSub}>Preparing phrases, tips & answers</Text>
              </View>
            </View>
          )}

          {error && !isGenerating && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
              <Pressable
                style={styles.retryBtn}
                onPress={() => generateScenario(currentQuery)}
              >
                <Text style={styles.retryText}>Retry</Text>
              </Pressable>
            </View>
          )}

          {showSaved && renderSavedList()}

          {!showSaved && !isGenerating && !currentResult && !error && renderSearchView()}

          {!showSaved && !isGenerating && currentResult && renderResultView()}

          <View style={{ height: 40 }} />
        </Animated.ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  headerGradient: {
    paddingBottom: 20,
  },
  headerSafe: {},
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#fff',
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  scrollContent: {
    paddingTop: 20,
    paddingHorizontal: 20,
  },
  searchSection: {},
  inputRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    paddingVertical: 14,
  },
  goButton: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  goButtonDisabled: {
    opacity: 0.5,
  },
  quickLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 28,
  },
  quickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  quickChipIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickChipText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  savedSection: {
    marginTop: 4,
  },
  savedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  savedHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  savedTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  savedCount: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textMuted,
    backgroundColor: Colors.borderLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: 'hidden',
  },
  savedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: 12,
    padding: 14,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    gap: 10,
  },
  savedCardContent: {
    flex: 1,
  },
  savedCardTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  savedCardSub: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  deleteBtn: {
    padding: 6,
  },
  showAllBtn: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  showAllText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.secondary,
  },
  loadingContainer: {
    paddingTop: 60,
    alignItems: 'center',
  },
  loadingCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    gap: 12,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 4,
    width: '100%',
    maxWidth: 300,
  },
  loadingTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginTop: 4,
  },
  loadingSub: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  errorContainer: {
    backgroundColor: Colors.errorLight,
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    gap: 12,
  },
  errorText: {
    fontSize: 14,
    color: Colors.error,
    textAlign: 'center' as const,
  },
  retryBtn: {
    backgroundColor: Colors.error,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 10,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#fff',
  },
  resultContainer: {},
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  resultTitleSection: {
    flex: 1,
    marginRight: 12,
  },
  resultTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.text,
    letterSpacing: -0.3,
  },
  resultTitleFr: {
    fontSize: 15,
    color: Colors.secondary,
    fontWeight: '500' as const,
    marginTop: 2,
  },
  saveBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: Colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnActive: {
    backgroundColor: Colors.primaryLight,
  },
  resultSummary: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 20,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.borderLight,
    borderRadius: 12,
    padding: 3,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: Colors.backgroundCard,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.textMuted,
  },
  tabTextActive: {
    color: Colors.primary,
    fontWeight: '600' as const,
  },
  tabContent: {},
  phraseCard: {
    flexDirection: 'row',
    backgroundColor: Colors.backgroundCard,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    gap: 12,
  },
  nativeCard: {
    borderColor: '#FDE68A',
    backgroundColor: '#FFFBEB',
  },
  customCard: {
    borderColor: Colors.accent,
    backgroundColor: '#FFF8F3',
  },
  phraseNumberBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: Colors.secondaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  phraseNumber: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.secondary,
  },
  phraseContent: {
    flex: 1,
  },
  phraseFrench: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  phraseEnglish: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  phraseContextRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  contextDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.secondary,
    marginTop: 6,
  },
  phraseContext: {
    fontSize: 12,
    color: Colors.textMuted,
    fontStyle: 'italic' as const,
    flex: 1,
    lineHeight: 16,
  },
  audioHint: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  audioHintActive: {
    backgroundColor: Colors.primaryLight,
  },
  nativeDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 16,
  },
  nativeDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#FDE68A',
  },
  nativeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  nativeBadgeText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#92400E',
  },
  qaIntro: {
    fontSize: 13,
    color: Colors.textMuted,
    marginBottom: 14,
  },
  qaCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    overflow: 'hidden',
  },
  qaQuestionSection: {
    padding: 14,
  },
  qaAnswerSection: {
    padding: 14,
    backgroundColor: '#F0FDFA',
  },
  qaAnswerDivider: {
    height: 1,
    backgroundColor: Colors.borderLight,
  },
  qaBubbleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  qaTheyBadge: {
    alignSelf: 'flex-start' as const,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  qaTheyBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#991B1B',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.4,
  },
  qaYouBadge: {
    alignSelf: 'flex-start' as const,
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  qaYouBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#065F46',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.4,
  },
  qaAudioBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qaAudioBtnActive: {
    backgroundColor: Colors.primaryLight,
  },
  qaFrench: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  qaEnglish: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  tipCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  tipCategoryBadge: {
    alignSelf: 'flex-start' as const,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 8,
  },
  tipCategoryText: {
    fontSize: 10,
    fontWeight: '700' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.4,
  },
  tipText: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
  },
  translatorSection: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 14,
    padding: 14,
    marginTop: 16,
    borderWidth: 1,
    borderColor: Colors.secondary + '30',
  },
  translatorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  translatorTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  translatorTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.secondary,
  },
  translatorClose: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  translatorInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  translatorInput: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  translatorGoBtn: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  translatorResult: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    backgroundColor: '#F0FDFA',
    borderRadius: 10,
    padding: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.secondary + '20',
  },
  translatorResultContent: {
    flex: 1,
  },
  translatorResultFr: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  translatorResultEn: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  addPhraseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.secondary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addPhraseBtnText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#fff',
  },
  translatorToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.secondaryLight,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 12,
  },
  translatorToggleText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.secondary,
  },
  newScenarioBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primaryLight,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 12,
  },
  newScenarioBtnText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  savedFullList: {},
  savedFullHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  savedBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedFullTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  savedFullCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: 14,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    gap: 12,
  },
  savedFullCardContent: {
    flex: 1,
  },
  savedFullCardTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  savedFullCardSub: {
    fontSize: 13,
    color: Colors.secondary,
    marginTop: 2,
  },
  savedFullCardDate: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 40,
    gap: 10,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textMuted,
  },
});
