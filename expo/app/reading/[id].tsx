import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Animated,
  Modal,
  TextInput,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { safeGoBack } from '@/utils/navigation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import ImageCardBackground from '@/components/ImageCardBackground';
import {
  X,
  Volume2,
  Plus,
  Check,
  ChevronLeft,
  BookOpen,
  Clock,
  Globe,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { USE_NATIVE_DRIVER } from '@/constants/animation';
import { useApp } from '@/contexts/AppContext';
import { frenchContent } from '@/mocks/content';
import { generateText } from '@rork-ai/toolkit-sdk';
import { useFrenchAudio } from '@/hooks/useFrenchAudio';
import { getLibraryImageResult, getRegionFlag } from '@/utils/perplexity';
import { Difficulty, Region, ContentCategory } from '@/types';
import { searchSingleImage, getCachedSmartImage } from '@/utils/imageSearch';
import { SelectableWords } from '@/components/SelectableWords';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HERO_HEIGHT = 300;

const difficultyColors: Record<Difficulty, string> = {
  beginner: '#10B981',
  easy: '#F97316',
  medium: '#F59E0B',
  hard: '#0D9488',
  university: '#7C3AED',
};

const difficultyLabels: Record<Difficulty, string> = {
  beginner: 'Beginner',
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  university: 'University',
};

const regionLabels: Record<Region, string> = {
  france: 'France',
  martinique: 'Martinique',
  guadeloupe: 'Guadeloupe',
  senegal: 'Senegal',
  morocco: 'Morocco',
  quebec: 'Quebec',
  belgium: 'Belgium',
  switzerland: 'Switzerland',
  'ivory-coast': 'Ivory Coast',
  cameroon: 'Cameroon',
  haiti: 'Haiti',
  drc: 'DR Congo',
  general: 'General',
};

const categoryLabels: Record<ContentCategory, string> = {
  dialogue: 'Dialogue',
  article: 'Article',
  story: 'Story',
  fiction: 'Fiction',
  news: 'News',
  culture: 'Culture',
  history: 'History',
  literature: 'Literature',
  science: 'Science',
  travel: 'Travel',
  food: 'Food',
  music: 'Music',
  sports: 'Sports',
};

const categoryAccents: Record<string, string> = {
  dialogue: '#3B82F6',
  article: '#6366F1',
  story: '#8B5CF6',
  fiction: '#A855F7',
  news: '#DC2626',
  culture: '#EC4899',
  history: '#D97706',
  literature: '#0EA5E9',
  science: '#2563EB',
  travel: '#059669',
  food: '#EA580C',
  music: '#7C3AED',
  sports: '#10B981',
};

interface WordInfo {
  word: string;
  translation: string;
  explanation: string;
  example: string;
  exampleTranslation: string;
}

export default function ReadingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { addGap, completeContent } = useApp();

  const content = frenchContent.find((c) => c.id === id);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [wordInfo, setWordInfo] = useState<WordInfo | null>(null);
  const [isLoadingInfo, setIsLoadingInfo] = useState(false);
  const [showPopover, setShowPopover] = useState(false);
  const [gapsCreated, setGapsCreated] = useState(0);
  const [totalWords, setTotalWords] = useState(0);
  const [userNote, setUserNote] = useState('');
  const [savedWords, setSavedWords] = useState<Set<string>>(new Set());

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const popoverAnim = useRef(new Animated.Value(0)).current;
  const scrollY = useRef(new Animated.Value(0)).current;
  const { speak, isSpeaking } = useFrenchAudio();

  const accentColor = useMemo(
    () => (content ? categoryAccents[content.category] ?? '#6366F1' : '#6366F1'),
    [content]
  );

  const [smartImage, setSmartImage] = useState<string | null>(null);

  useEffect(() => {
    if (!content) return;
    const cached = getCachedSmartImage(content.title, content.region);
    if (cached) {
      setSmartImage(cached);
      return;
    }
    searchSingleImage(content.title, content.region, content.category)
      .then(url => { if (url) setSmartImage(url); })
      .catch(() => {});
  }, [content?.id]);

  const imgResult = useMemo(
    () => content ? getLibraryImageResult(content.title, content.region, content.category, content.id, smartImage ? { [content.id]: smartImage } : undefined) : { primary: '', fallback: '', gradient: ['#1C1C2E', '#2D1B4E', '#1a1a2e'] as [string, string, string] },
    [smartImage, content]
  );

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();

    if (content) {
      const words = content.content.split(/\s+/).filter((w) => w.length > 0);
      setTotalWords(words.length);
    }
  }, [fadeAnim, content]);

  const fetchWordInfo = useCallback(async (word: string) => {
    setIsLoadingInfo(true);
    try {
      const prompt = `For the French word or phrase "${word}", provide:
1. English translation
2. Brief explanation (1-2 sentences, plain English)
3. An example sentence in French using this word
4. English translation of the example

Respond in this exact JSON format:
{"translation": "...", "explanation": "...", "example": "...", "exampleTranslation": "..."}`;

      const response = await generateText({
        messages: [{ role: 'user', content: prompt }],
      });

      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          setWordInfo({
            word,
            translation: parsed.translation || 'Translation unavailable',
            explanation: parsed.explanation || 'No explanation available',
            example: parsed.example || word,
            exampleTranslation: parsed.exampleTranslation || '',
          });
        }
      } catch {
        setWordInfo({
          word,
          translation: 'Translation unavailable',
          explanation: 'Could not load explanation',
          example: word,
          exampleTranslation: '',
        });
      }
    } catch (error) {
      console.log('Error fetching word info:', error);
      setWordInfo({
        word,
        translation: 'Translation unavailable',
        explanation: 'Could not load explanation',
        example: word,
        exampleTranslation: '',
      });
    } finally {
      setIsLoadingInfo(false);
    }
  }, []);

  const handleWordPress = useCallback(
    (word: string, _context: string) => {
      const cleanWord = word.replace(/[.,!?;:"""''«»\-()]/g, '').trim();
      if (cleanWord.length < 2) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setSelectedWord(cleanWord);
      setUserNote('');
      setShowPopover(true);
      fetchWordInfo(cleanWord);
      Animated.spring(popoverAnim, {
        toValue: 1,
        useNativeDriver: USE_NATIVE_DRIVER,
        tension: 100,
        friction: 8,
      }).start();
    },
    [fetchWordInfo, popoverAnim]
  );

  const handlePhraseSelect = useCallback(
    (phrase: string, _context: string) => {
      const cleanPhrase = phrase.replace(/[.,!?;:"""''«»…]/g, '').trim();
      if (!cleanPhrase || cleanPhrase.length < 2) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setSelectedWord(cleanPhrase);
      setUserNote('');
      setShowPopover(true);
      fetchWordInfo(cleanPhrase);
      Animated.spring(popoverAnim, {
        toValue: 1,
        useNativeDriver: USE_NATIVE_DRIVER,
        tension: 100,
        friction: 8,
      }).start();
    },
    [fetchWordInfo, popoverAnim]
  );

  const closePopover = useCallback(() => {
    Animated.timing(popoverAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start(() => {
      setShowPopover(false);
      setSelectedWord(null);
      setWordInfo(null);
    });
  }, [popoverAnim]);

  const handleSaveGap = useCallback(async () => {
    if (!wordInfo || !selectedWord) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    await addGap(
      wordInfo.word,
      wordInfo.translation,
      wordInfo.explanation,
      wordInfo.example,
      wordInfo.exampleTranslation,
      'reading',
      id,
      undefined,
      userNote || undefined
    );

    setSavedWords((prev) => new Set(prev).add(selectedWord.toLowerCase()));
    setGapsCreated((prev) => prev + 1);
    closePopover();
  }, [wordInfo, selectedWord, userNote, addGap, id, closePopover]);

  const handleFinish = useCallback(() => {
    const percentWithoutHelp =
      totalWords > 0
        ? Math.round(((totalWords - gapsCreated) / totalWords) * 100)
        : 100;

    completeContent(id || '', gapsCreated, percentWithoutHelp);
    router.replace({
      pathname: '/reading-complete',
      params: {
        id: id || '',
        gapsCreated: gapsCreated.toString(),
        percentWithoutHelp: percentWithoutHelp.toString(),
      },
    } as any);
  }, [totalWords, gapsCreated, completeContent, id, router]);

  const renderContent = useCallback(() => {
    if (!content) return null;

    const lines = content.content.split('\n');

    return lines.map((line, lineIndex) => {
      if (line.trim() === '') {
        return <View key={lineIndex} style={styles.emptyLine} />;
      }

      return (
        <SelectableWords
          key={lineIndex}
          text={line}
          isActive={true}
          savedWords={savedWords}
          onWordTap={handleWordPress}
          onPhraseSelected={handlePhraseSelect}
          wordStyle={styles.word}
          activeWordStyle={styles.wordActive}
          savedWordStyle={[styles.savedWord, { backgroundColor: `${accentColor}18` }] as any}
          containerStyle={styles.contentLine}
          selectionColor={`${accentColor}25`}
        />
      );
    });
  }, [
    content,
    savedWords,
    handleWordPress,
    handlePhraseSelect,
    accentColor,
  ]);

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, HERO_HEIGHT - 100],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const percentWithoutHelp = useMemo(() => {
    if (totalWords === 0) return 100;
    return Math.round(((totalWords - gapsCreated) / totalWords) * 100);
  }, [totalWords, gapsCreated]);

  if (!content) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.centered}>
          <Text style={styles.errorText}>Content not found</Text>
          <Pressable style={styles.errorBackBtn} onPress={() => safeGoBack()}>
            <Text style={styles.errorBackBtnText}>Go Back</Text>
          </Pressable>
        </SafeAreaView>
      </View>
    );
  }

  const diffColor = difficultyColors[content.difficulty];
  const flag = getRegionFlag(content.region);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <Animated.View style={[styles.stickyHeader, { opacity: headerOpacity }]}>
        <LinearGradient
          colors={[accentColor, `${accentColor}DD`]}
          style={styles.stickyHeaderGradient}
        >
          <SafeAreaView edges={['top']}>
            <View style={styles.stickyHeaderRow}>
              <Pressable onPress={() => safeGoBack()} style={styles.stickyHeaderBtn}>
                <ChevronLeft size={22} color="white" />
              </Pressable>
              <Text style={styles.stickyHeaderTitle} numberOfLines={1}>
                {content.title}
              </Text>
              <View style={styles.stickyHeaderBtnPlaceholder} />
            </View>
          </SafeAreaView>
        </LinearGradient>
      </Animated.View>

      <Animated.ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: USE_NATIVE_DRIVER }
        )}
        scrollEventThrottle={16}
      >
        <ImageCardBackground
          uri={imgResult.primary}
          fallbackUri={imgResult.fallback}
          gradientColors={imgResult.gradient}
          style={styles.heroImage}
        >
          <LinearGradient
            colors={[
              'rgba(0,0,0,0.3)',
              'transparent',
              'rgba(0,0,0,0.7)',
              'rgba(0,0,0,0.95)',
            ]}
            locations={[0, 0.25, 0.65, 1]}
            style={styles.heroGradient}
          >
            <SafeAreaView edges={['top']} style={styles.heroSafeArea}>
              <View style={styles.heroTopRow}>
                <Pressable onPress={() => safeGoBack()} style={styles.heroBackBtn}>
                  <ChevronLeft size={22} color="white" />
                </Pressable>
                <View style={styles.heroSelectionBtn}>
                  <BookOpen size={18} color="rgba(255,255,255,0.85)" />
                </View>
              </View>
            </SafeAreaView>

            <View style={styles.heroBottom}>
              <View style={styles.heroBadges}>
                <View style={[styles.heroCategoryBadge, { backgroundColor: accentColor }]}>
                  <Text style={styles.heroCategoryText}>
                    {categoryLabels[content.category]}
                  </Text>
                </View>
                <View style={styles.heroRegionBadge}>
                  <Text style={styles.heroRegionFlag}>{flag}</Text>
                  <Text style={styles.heroRegionText}>
                    {regionLabels[content.region]}
                  </Text>
                </View>
                <View style={[styles.heroDiffBadge, { backgroundColor: diffColor }]}>
                  <Text style={styles.heroDiffText}>
                    {difficultyLabels[content.difficulty]}
                  </Text>
                </View>
              </View>
              <Text style={styles.heroTitle}>{content.title}</Text>
              {content.subtitle ? (
                <Text style={styles.heroSubtitle}>{content.subtitle}</Text>
              ) : null}
              <View style={styles.heroMeta}>
                <Clock size={12} color="rgba(255,255,255,0.6)" />
                <Text style={styles.heroMetaText}>
                  {content.estimatedMinutes} min read
                </Text>
                <View style={styles.heroMetaDot} />
                <Text style={styles.heroMetaText}>
                  {totalWords} words
                </Text>
              </View>
            </View>
          </LinearGradient>
        </ImageCardBackground>

        <Animated.View style={[styles.articleBody, { opacity: fadeAnim }]}>
          <View style={styles.tapHintRow}>
            <BookOpen size={14} color={accentColor} />
            <Text style={[styles.tapHintText, { color: accentColor }]}>
              Tap any word · Hold & drag for phrases
            </Text>
          </View>

          <View style={styles.contentCard}>
            {renderContent()}
          </View>

          {gapsCreated > 0 && (
            <View style={[styles.progressCard, { borderLeftColor: accentColor }]}>
              <View style={styles.progressRow}>
                <View style={styles.progressStat}>
                  <Text style={[styles.progressValue, { color: accentColor }]}>
                    {gapsCreated}
                  </Text>
                  <Text style={styles.progressLabel}>saved</Text>
                </View>
                <View style={styles.progressDivider} />
                <View style={styles.progressStat}>
                  <Text style={[styles.progressValue, { color: Colors.success }]}>
                    {percentWithoutHelp}%
                  </Text>
                  <Text style={styles.progressLabel}>independent</Text>
                </View>
              </View>
            </View>
          )}

          <Pressable
            style={({ pressed }) => [
              styles.finishButton,
              { backgroundColor: accentColor },
              pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
            ]}
            onPress={handleFinish}
            testID="finish-reading-btn"
          >
            <Check size={20} color="white" />
            <Text style={styles.finishButtonText}>Finish Reading</Text>
          </Pressable>
        </Animated.View>
      </Animated.ScrollView>

      <Modal
        visible={showPopover}
        transparent
        animationType="none"
        onRequestClose={closePopover}
      >
        <Pressable style={styles.modalOverlay} onPress={closePopover}>
          <Animated.View
            style={[
              styles.popover,
              {
                opacity: popoverAnim,
                transform: [
                  {
                    translateY: popoverAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [50, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <Pressable onPress={(e) => e.stopPropagation()}>
              <View style={styles.popoverHandle} />
              <View style={styles.popoverHeader}>
                <Text style={[styles.popoverWord, { color: accentColor }]}>
                  {selectedWord}
                </Text>
                <Pressable onPress={closePopover} style={styles.closeButton}>
                  <X size={20} color={Colors.textMuted} />
                </Pressable>
              </View>

              {isLoadingInfo ? (
                <View style={styles.popoverLoading}>
                  <ActivityIndicator color={accentColor} />
                  <Text style={styles.popoverLoadingText}>Looking up...</Text>
                </View>
              ) : wordInfo ? (
                <>
                  <View style={styles.translationRow}>
                    <Text style={styles.translation}>{wordInfo.translation}</Text>
                    <Pressable
                      style={[
                        styles.audioBtn,
                        isSpeaking && { backgroundColor: accentColor },
                      ]}
                      onPress={() => speak(wordInfo.word)}
                    >
                      <Volume2
                        size={18}
                        color={isSpeaking ? 'white' : accentColor}
                      />
                    </Pressable>
                  </View>

                  <Text style={styles.explanation}>{wordInfo.explanation}</Text>

                  <Pressable
                    style={styles.exampleContainer}
                    onPress={() => speak(wordInfo.example)}
                  >
                    <View style={styles.exampleHeader}>
                      <Text style={styles.exampleLabel}>Example</Text>
                      <Volume2 size={14} color={Colors.textMuted} />
                    </View>
                    <Text style={styles.exampleFrench}>{wordInfo.example}</Text>
                    <Text style={styles.exampleEnglish}>
                      {wordInfo.exampleTranslation}
                    </Text>
                  </Pressable>

                  <TextInput
                    style={styles.noteInput}
                    placeholder="Add a personal note (optional)"
                    placeholderTextColor={Colors.textMuted}
                    value={userNote}
                    onChangeText={setUserNote}
                    multiline
                  />

                  <Pressable
                    style={({ pressed }) => [
                      styles.saveButton,
                      { backgroundColor: accentColor },
                      pressed && { opacity: 0.9 },
                    ]}
                    onPress={handleSaveGap}
                  >
                    <Plus size={18} color="white" />
                    <Text style={styles.saveButtonText}>Save to My Gaps Deck</Text>
                  </Pressable>
                </>
              ) : null}
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F5F2',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  errorBackBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  errorBackBtnText: {
    color: 'white',
    fontWeight: '600' as const,
    fontSize: 15,
  },
  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  stickyHeaderGradient: {
    paddingBottom: 12,
  },
  stickyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 12,
  },
  stickyHeaderBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stickyHeaderTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600' as const,
    color: 'white',
  },
  stickyHeaderBtnPlaceholder: {
    width: 36,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 60,
  },
  heroImage: {
    width: SCREEN_WIDTH,
    height: HERO_HEIGHT,
  },
  heroGradient: {
    flex: 1,
    justifyContent: 'space-between',
  },
  heroSafeArea: {
    zIndex: 10,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  heroBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  heroSelectionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  heroBottom: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  heroBadges: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  heroCategoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  heroCategoryText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: 'white',
    letterSpacing: 0.3,
    textTransform: 'uppercase' as const,
  },
  heroRegionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  heroRegionFlag: {
    fontSize: 13,
  },
  heroRegionText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.85)',
  },
  heroDiffBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  heroDiffText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: 'white',
    letterSpacing: 0.3,
    textTransform: 'uppercase' as const,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: 'white',
    lineHeight: 29,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 20,
    marginBottom: 6,
  },
  heroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  heroMetaText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
  },
  heroMetaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  articleBody: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  tapHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  tapHintText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500' as const,
  },
  contentCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 22,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  contentLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  emptyLine: {
    height: 16,
  },
  word: {
    fontSize: 18,
    lineHeight: 31,
    color: Colors.text,
  },
  wordActive: {
    color: Colors.text,
  },
  savedWord: {
    color: Colors.primaryDark,
    borderRadius: 4,
  },
  progressCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressStat: {
    flex: 1,
    alignItems: 'center',
  },
  progressValue: {
    fontSize: 28,
    fontWeight: '700' as const,
  },
  progressLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
    fontWeight: '500' as const,
  },
  progressDivider: {
    width: 1,
    height: 36,
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  finishButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  finishButtonText: {
    color: 'white',
    fontSize: 17,
    fontWeight: '600' as const,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  popover: {
    backgroundColor: 'white',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
  },
  popoverHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.1)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  popoverHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  popoverWord: {
    fontSize: 24,
    fontWeight: '700' as const,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  popoverLoading: {
    padding: 30,
    alignItems: 'center',
    gap: 8,
  },
  popoverLoadingText: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  translationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  translation: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  audioBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F0FDF4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  explanation: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: 16,
  },
  exampleContainer: {
    backgroundColor: '#F8F5F2',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  exampleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  exampleLabel: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: Colors.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  exampleFrench: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.text,
    fontStyle: 'italic' as const,
    marginBottom: 6,
  },
  exampleEnglish: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  noteInput: {
    backgroundColor: '#F8F5F2',
    borderRadius: 14,
    padding: 14,
    fontSize: 15,
    color: Colors.text,
    marginBottom: 16,
    minHeight: 50,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600' as const,
  },
});
