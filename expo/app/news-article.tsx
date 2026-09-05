import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Modal,
  TextInput,
  ActivityIndicator,
  Linking,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { safeGoBack } from '@/utils/navigation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import ImageCardBackground from '@/components/ImageCardBackground';
import {
  ChevronLeft,
  ExternalLink,
  Volume2,
  Plus,
  X,
  BookOpen,
  Globe,
  Clock,
  Layers,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { ArticleSkeleton } from '@/components/SkeletonLoader';
import Colors from '@/constants/colors';
import { USE_NATIVE_DRIVER } from '@/constants/animation';
import { useApp } from '@/contexts/AppContext';
import { useNews } from '@/hooks/useNews';
import { getRegionFlag, NEWS_CATEGORY_COLORS, getArticleImageResult } from '@/utils/perplexity';
import { generateText } from '@rork-ai/toolkit-sdk';
import { useFrenchAudio } from '@/hooks/useFrenchAudio';
import { CEFRLevel } from '@/types';
import { isUserBelowB2 } from '@/utils/proficiency';
import { SelectableWords } from '@/components/SelectableWords';
import { logEncounter } from '@/utils/crossTabTracker';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HERO_IMAGE_HEIGHT = 320;

interface WordInfo {
  word: string;
  translation: string;
  explanation: string;
  example: string;
  exampleTranslation: string;
}

interface ContentBlock {
  type: 'heading' | 'subheading' | 'paragraph' | 'list-item' | 'numbered-item' | 'section-label';
  text: string;
  number?: number;
  isFirst?: boolean;
}

function parseAdaptedContent(content: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  const sections = content.split('\n\n').filter(s => s.trim());
  let isFirstParagraph = true;

  for (const section of sections) {
    const lines = section.split('\n').filter(l => l.trim());

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed.startsWith('### ')) {
        blocks.push({ type: 'subheading', text: trimmed.slice(4) });
        continue;
      }
      if (trimmed.startsWith('## ')) {
        blocks.push({ type: 'heading', text: trimmed.slice(3) });
        continue;
      }
      if (trimmed.startsWith('# ')) {
        blocks.push({ type: 'heading', text: trimmed.slice(2) });
        continue;
      }

      const boldMatch = trimmed.match(/^\*\*(.+)\*\*$/);
      if (boldMatch && boldMatch[1].length < 60) {
        blocks.push({ type: 'heading', text: boldMatch[1] });
        continue;
      }

      if (trimmed.endsWith(':') && trimmed.length < 45 && !trimmed.includes('. ')) {
        blocks.push({ type: 'section-label', text: trimmed.slice(0, -1) });
        continue;
      }

      const numMatch = trimmed.match(/^(\d+)[.)]\s+(.+)/);
      if (numMatch) {
        blocks.push({ type: 'numbered-item', text: numMatch[2], number: parseInt(numMatch[1]) });
        continue;
      }

      if (/^[-\u2022*]\s+/.test(trimmed)) {
        blocks.push({ type: 'list-item', text: trimmed.replace(/^[-\u2022*]\s+/, '') });
        continue;
      }

      blocks.push({ type: 'paragraph', text: trimmed, isFirst: isFirstParagraph });
      if (isFirstParagraph) isFirstParagraph = false;
    }
  }

  return blocks;
}

function getReadingTime(content: string): number {
  const words = content.split(/\s+/).filter(w => w.length > 0).length;
  return Math.max(1, Math.ceil(words / 120));
}

export default function NewsArticleScreen() {
  const { articleId, level } = useLocalSearchParams<{ articleId: string; level?: string }>();
  const { addGap, proficiency } = useApp();
  const { findArticleById, getAdaptedArticle, adaptArticle, isAdapting, userLevel, isLoading: isNewsLoading } = useNews();
  const { speak, isSpeaking } = useFrenchAudio();
  const belowB2 = useMemo(() => isUserBelowB2(proficiency.certifiedLevels), [proficiency.certifiedLevels]);
  const cefrLevel = (level as CEFRLevel) ?? userLevel;
  const rawArticle = useMemo(() => findArticleById(articleId ?? ''), [findArticleById, articleId]);
  const adapted = getAdaptedArticle(articleId ?? '', cefrLevel);

  const [isLoadingAdapt, setIsLoadingAdapt] = useState(!adapted);
  const [adaptError, setAdaptError] = useState<string | null>(null);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [wordInfo, setWordInfo] = useState<WordInfo | null>(null);
  const [isLoadingInfo, setIsLoadingInfo] = useState(false);
  const [showPopover, setShowPopover] = useState(false);
  const [gapsCreated, setGapsCreated] = useState(0);
  const [userNote, setUserNote] = useState('');
  const [savedWords, setSavedWords] = useState<Set<string>>(new Set());
  const [_contentHeight, setContentHeight] = useState(0);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const popoverAnim = useRef(new Animated.Value(0)).current;
  const scrollY = useRef(new Animated.Value(0)).current;
  const adaptAttemptedRef = useRef(false);

  const readingTime = useMemo(() => {
    if (!adapted) return 0;
    return getReadingTime(adapted.frenchContent);
  }, [adapted]);

  const contentBlocks = useMemo(() => {
    if (!adapted) return [];
    return parseAdaptedContent(adapted.frenchContent);
  }, [adapted]);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [fadeAnim]);

  useEffect(() => {
    if (adapted) {
      console.log('[NewsArticle] Adapted content available, clearing loading state');
      setIsLoadingAdapt(false);
      setAdaptError(null);
      adaptAttemptedRef.current = false;
      return;
    }
    if (!rawArticle) {
      console.log('[NewsArticle] No raw article yet, waiting...');
      return;
    }
    if (isAdapting) {
      console.log('[NewsArticle] Adaptation already in progress, waiting...');
      return;
    }
    if (adaptAttemptedRef.current) {
      console.log('[NewsArticle] Already attempted adaptation, skipping');
      return;
    }

    console.log(`[NewsArticle] Starting adaptation for article: ${rawArticle.headline}, level: ${cefrLevel}`);
    adaptAttemptedRef.current = true;
    setIsLoadingAdapt(true);
    setAdaptError(null);

    let didTimeout = false;
    const timeout = setTimeout(() => {
      didTimeout = true;
      console.log('[NewsArticle] Adaptation timed out after 60s');
      setAdaptError('Adaptation took too long. You can still read the original summary below, or try again.');
      setIsLoadingAdapt(false);
    }, 60000);

    adaptArticle({ article: rawArticle, level: cefrLevel })
      .then(() => {
        if (!didTimeout) {
          clearTimeout(timeout);
          console.log('[NewsArticle] Adaptation succeeded');
          setAdaptError(null);
          setIsLoadingAdapt(false);
        }
      })
      .catch((e) => {
        if (!didTimeout) {
          clearTimeout(timeout);
          console.log('[NewsArticle] Adapt error:', e);
          setAdaptError('Failed to adapt article. You can still read the original summary below, or try again.');
          setIsLoadingAdapt(false);
          adaptAttemptedRef.current = false;
        }
      });

    return () => clearTimeout(timeout);
  }, [adapted, rawArticle, cefrLevel, adaptArticle, isAdapting]);

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

      const response = await generateText({ messages: [{ role: 'user', content: prompt }] });
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        setWordInfo({
          word,
          translation: parsed.translation || 'Translation unavailable',
          explanation: parsed.explanation || '',
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
    } finally {
      setIsLoadingInfo(false);
    }
  }, []);

  const handleWordPress = useCallback(
    (word: string) => {
      const cleanWord = word.replace(/[.,!?;:"""''«»\-()]/g, '').trim();
      if (cleanWord.length < 2) return;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setSelectedWord(cleanWord);
      setUserNote('');
      setShowPopover(true);
      void fetchWordInfo(cleanWord);
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
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setSelectedWord(cleanPhrase);
      setUserNote('');
      setShowPopover(true);
      void fetchWordInfo(cleanPhrase);
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
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await addGap(
      wordInfo.word,
      wordInfo.translation,
      wordInfo.explanation,
      wordInfo.example,
      wordInfo.exampleTranslation,
      'reading',
      `news_${articleId}`,
      undefined,
      userNote || undefined
    );
    setSavedWords((prev) => new Set(prev).add(selectedWord.toLowerCase()));
    setGapsCreated((prev) => prev + 1);
    void logEncounter(wordInfo.word, wordInfo.example || '', 'read', `news_${articleId}`);  
    closePopover();
  }, [wordInfo, selectedWord, userNote, addGap, articleId, closePopover]);

  const categoryColor = rawArticle
    ? (NEWS_CATEGORY_COLORS[rawArticle.category] ?? Colors.primary)
    : Colors.primary;

  const renderContentBlock = useCallback(
    (block: ContentBlock, index: number) => {
      const key = `block-${index}`;

      switch (block.type) {
        case 'heading':
          return (
            <View key={key} style={styles.headingWrap}>
              <View style={[styles.headingAccent, { backgroundColor: categoryColor }]} />
              <SelectableWords
                text={block.text}
                isActive={true}
                savedWords={savedWords}
                onWordTap={handleWordPress}
                onPhraseSelected={handlePhraseSelect}
                wordStyle={styles.headingWord}
                activeWordStyle={styles.headingWordActive}
                savedWordStyle={styles.savedWord}
                containerStyle={styles.headingContainer}
                selectionColor={`${categoryColor}25`}
              />
            </View>
          );

        case 'subheading':
          return (
            <View key={key} style={styles.subheadingWrap}>
              <SelectableWords
                text={block.text}
                isActive={true}
                savedWords={savedWords}
                onWordTap={handleWordPress}
                onPhraseSelected={handlePhraseSelect}
                wordStyle={styles.subheadingWord}
                activeWordStyle={styles.subheadingWordActive}
                savedWordStyle={styles.savedWord}
                containerStyle={styles.subheadingContainer}
                selectionColor={`${categoryColor}25`}
              />
            </View>
          );

        case 'section-label':
          return (
            <View key={key} style={styles.sectionLabelWrap}>
              <View style={styles.sectionLabelLine} />
              <Text style={[styles.sectionLabelText, { color: categoryColor }]}>
                {block.text}
              </Text>
              <View style={styles.sectionLabelLine} />
            </View>
          );

        case 'numbered-item':
          return (
            <View key={key} style={styles.numberedItemWrap}>
              <View style={[styles.numberCircle, { backgroundColor: categoryColor }]}>
                <Text style={styles.numberCircleText}>{block.number}</Text>
              </View>
              <View style={styles.listItemContent}>
                <SelectableWords
                  text={block.text}
                  isActive={true}
                  savedWords={savedWords}
                  onWordTap={handleWordPress}
                  onPhraseSelected={handlePhraseSelect}
                  wordStyle={styles.listWord}
                  activeWordStyle={styles.listWordActive}
                  savedWordStyle={styles.savedWord}
                  containerStyle={styles.listItemTextWrap}
                  selectionColor={`${categoryColor}25`}
                />
              </View>
            </View>
          );

        case 'list-item':
          return (
            <View key={key} style={styles.bulletItemWrap}>
              <View style={[styles.bulletDot, { backgroundColor: categoryColor }]} />
              <View style={styles.listItemContent}>
                <SelectableWords
                  text={block.text}
                  isActive={true}
                  savedWords={savedWords}
                  onWordTap={handleWordPress}
                  onPhraseSelected={handlePhraseSelect}
                  wordStyle={styles.listWord}
                  activeWordStyle={styles.listWordActive}
                  savedWordStyle={styles.savedWord}
                  containerStyle={styles.listItemTextWrap}
                  selectionColor={`${categoryColor}25`}
                />
              </View>
            </View>
          );

        case 'paragraph':
        default:
          return (
            <SelectableWords
              key={key}
              text={block.text}
              isActive={true}
              savedWords={savedWords}
              onWordTap={handleWordPress}
              onPhraseSelected={handlePhraseSelect}
              wordStyle={styles.bodyWord}
              activeWordStyle={styles.bodyWordActive}
              savedWordStyle={styles.savedWord}
              containerStyle={styles.paragraphWrap}
              selectionColor={`${categoryColor}25`}
            />
          );
      }
    },
    [savedWords, handleWordPress, handlePhraseSelect, categoryColor]
  );

  if (isNewsLoading && !rawArticle) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <ArticleSkeleton />
      </View>
    );
  }

  if (!rawArticle) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.centered}>
          <View style={styles.notFoundCard}>
            <BookOpen size={32} color={Colors.textMuted} />
            <Text style={styles.notFoundTitle}>Article not found</Text>
            <Text style={styles.notFoundSub}>This article may have expired or been removed</Text>
            <Pressable style={styles.backBtn} onPress={() => safeGoBack()}>
              <Text style={styles.backBtnText}>Go Back</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const imgResult = getArticleImageResult(rawArticle);

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, HERO_IMAGE_HEIGHT - 100],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <Animated.View style={[styles.stickyHeader, { opacity: headerOpacity }]}>
        <LinearGradient
          colors={[categoryColor, `${categoryColor}DD`]}
          style={styles.stickyHeaderGradient}
        >
          <SafeAreaView edges={['top']}>
            <View style={styles.stickyHeaderRow}>
              <Pressable onPress={() => safeGoBack()} style={styles.stickyHeaderBtn}>
                <ChevronLeft size={22} color="white" />
              </Pressable>
              <Text style={styles.stickyHeaderTitle} numberOfLines={1}>
                {belowB2 && adapted?.englishSummary ? adapted.englishSummary.split('.')[0] : rawArticle.headline}
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
            colors={['rgba(0,0,0,0.3)', 'transparent', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0.95)']}
            locations={[0, 0.25, 0.65, 1]}
            style={styles.heroGradient}
          >
            <SafeAreaView edges={['top']} style={styles.heroSafeArea}>
              <View style={styles.heroTopRow}>
                <Pressable onPress={() => safeGoBack()} style={styles.heroBackBtn}>
                  <ChevronLeft size={22} color="white" />
                </Pressable>
                {rawArticle.sourceUrl ? (
                  <Pressable
                    style={styles.heroShareBtn}
                    onPress={() => Linking.openURL(rawArticle.sourceUrl)}
                  >
                    <ExternalLink size={18} color="white" />
                  </Pressable>
                ) : null}
              </View>
            </SafeAreaView>

            <View style={styles.heroBottom}>
              <View style={styles.heroBadges}>
                <View style={[styles.heroCategoryBadge, { backgroundColor: categoryColor }]}>
                  <Text style={styles.heroCategoryText}>
                    {rawArticle.category.charAt(0).toUpperCase() + rawArticle.category.slice(1)}
                  </Text>
                </View>
                <View style={styles.heroRegionBadge}>
                  <Text style={styles.heroRegionFlag}>{getRegionFlag(rawArticle.region)}</Text>
                  <Text style={styles.heroRegionText}>{rawArticle.region}</Text>
                </View>
                <View style={styles.heroLevelBadge}>
                  <Text style={styles.heroLevelText}>{cefrLevel}</Text>
                </View>
              </View>
              <Text style={styles.heroHeadline} numberOfLines={3}>{belowB2 && adapted?.englishSummary ? adapted.englishSummary.split('.')[0] : rawArticle.headline}</Text>
              <View style={styles.heroMeta}>
                <Text style={styles.heroSource}>{rawArticle.source}</Text>
                <View style={styles.heroMetaDot} />
                <Text style={styles.heroDate}>{rawArticle.publishedDate}</Text>
              </View>
            </View>
          </LinearGradient>
        </ImageCardBackground>

        <Animated.View
          style={[styles.articleBody, { opacity: fadeAnim }]}
          onLayout={(e) => setContentHeight(e.nativeEvent.layout.height)}
        >
          <View style={styles.articleMasthead}>
            {rawArticle.sourceUrl ? (
              <Pressable
                style={styles.originalLink}
                onPress={() => Linking.openURL(rawArticle.sourceUrl)}
              >
                <ExternalLink size={12} color={categoryColor} />
                <Text style={[styles.originalLinkText, { color: categoryColor }]}>
                  Read original at {rawArticle.source}
                </Text>
              </Pressable>
            ) : null}

            {readingTime > 0 && (
              <View style={styles.readingTimeBadge}>
                <Clock size={12} color={Colors.textMuted} />
                <Text style={styles.readingTimeText}>{readingTime} min read</Text>
              </View>
            )}
          </View>

          {isLoadingAdapt || isAdapting ? (
            <View style={styles.loadingBox}>
              <View style={styles.loadingShimmer}>
                <View style={[styles.shimmerLine, { width: '85%' }]} />
                <View style={[styles.shimmerLine, { width: '100%' }]} />
                <View style={[styles.shimmerLine, { width: '70%' }]} />
                <View style={styles.shimmerGap} />
                <View style={[styles.shimmerLine, { width: '95%' }]} />
                <View style={[styles.shimmerLine, { width: '80%' }]} />
                <View style={[styles.shimmerLine, { width: '90%' }]} />
              </View>
              <View style={styles.loadingIndicatorRow}>
                <ActivityIndicator size="small" color={categoryColor} />
                <Text style={styles.loadingTitle}>Adapting for {cefrLevel}</Text>
              </View>
              <Text style={styles.loadingSubtext}>
                Rewriting real journalism at your level
              </Text>
            </View>
          ) : adaptError ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorBoxText}>{adaptError}</Text>
              <Pressable
                style={[styles.retryBtn, { backgroundColor: categoryColor }]}
                onPress={() => {
                  if (rawArticle) {
                    console.log('[NewsArticle] Manual retry triggered');
                    adaptAttemptedRef.current = false;
                    setAdaptError(null);
                    setIsLoadingAdapt(true);
                  }
                }}
              >
                <Text style={styles.retryBtnText}>Try Again</Text>
              </Pressable>

              {rawArticle && (
                <View style={styles.fallbackContent}>
                  <Text style={styles.fallbackLabel}>Original Summary</Text>
                  <Text style={styles.fallbackHeadline}>{rawArticle.headline}</Text>
                  {belowB2 && (
                    <Text style={styles.fallbackLabel}>French Original</Text>
                  )}
                  <Text style={styles.fallbackSummary}>{rawArticle.summary}</Text>
                  <Text style={styles.fallbackSource}>{rawArticle.source} — {rawArticle.publishedDate}</Text>
                </View>
              )}
            </View>
          ) : adapted ? (
            <>
              <Text style={styles.frenchTitle}>{adapted.frenchTitle}</Text>

              <View style={[styles.summaryBox, { borderLeftColor: `${categoryColor}80` }]}>
                <View style={styles.summaryHeader}>
                  <Globe size={13} color={categoryColor} />
                  <Text style={[styles.summaryLabel, { color: categoryColor }]}>Context</Text>
                </View>
                <Text style={styles.summaryText}>{adapted.englishSummary}</Text>
              </View>

              <View style={styles.interactionHint}>
                <BookOpen size={13} color={categoryColor} />
                <Text style={[styles.interactionHintText, { color: categoryColor }]}>
                  Tap any word to translate
                </Text>
                <View style={styles.interactionDot} />
                <Text style={[styles.interactionHintText, { color: categoryColor }]}>
                  Hold & drag for phrases
                </Text>
              </View>

              <View style={styles.articleContent}>
                {contentBlocks.map((block, idx) => renderContentBlock(block, idx))}
              </View>

              {adapted.vocabulary.length > 0 && (
                <View style={styles.vocabSection}>
                  <View style={styles.vocabHeader}>
                    <Layers size={16} color={categoryColor} />
                    <Text style={styles.vocabTitle}>Key Vocabulary</Text>
                    <Text style={styles.vocabCount}>{adapted.vocabulary.length} words</Text>
                  </View>
                  <View style={styles.vocabDivider} />
                  {adapted.vocabulary.map((v, i) => (
                    <Pressable
                      key={i}
                      style={({ pressed }) => [
                        styles.vocabRow,
                        pressed && { backgroundColor: '#F8F5F2' },
                        i === adapted.vocabulary.length - 1 && styles.vocabRowLast,
                      ]}
                      onPress={() => handleWordPress(v.french)}
                    >
                      <Text style={[styles.vocabFrench, { color: categoryColor }]}>
                        {v.french}
                      </Text>
                      <View style={styles.vocabArrow}>
                        <Text style={styles.vocabArrowText}>{'\u2192'}</Text>
                      </View>
                      <Text style={styles.vocabEnglish}>{v.english}</Text>
                    </Pressable>
                  ))}
                </View>
              )}

              {gapsCreated > 0 && (
                <View style={[styles.gapsStat, { backgroundColor: `${categoryColor}10` }]}>
                  <View style={[styles.gapsIcon, { backgroundColor: categoryColor }]}>
                    <Plus size={12} color="white" />
                  </View>
                  <Text style={[styles.gapsStatText, { color: categoryColor }]}>
                    {gapsCreated} word{gapsCreated !== 1 ? 's' : ''} saved to your deck
                  </Text>
                </View>
              )}
            </>
          ) : null}
        </Animated.View>
      </Animated.ScrollView>

      <Modal visible={showPopover} transparent animationType="none" onRequestClose={closePopover}>
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
                <Text style={[styles.popoverWord, { color: categoryColor }]}>
                  {selectedWord}
                </Text>
                <Pressable onPress={closePopover} style={styles.closeButton}>
                  <X size={20} color={Colors.textMuted} />
                </Pressable>
              </View>

              {isLoadingInfo ? (
                <View style={styles.popoverLoading}>
                  <ActivityIndicator color={categoryColor} />
                  <Text style={styles.popoverLoadingText}>Looking up...</Text>
                </View>
              ) : wordInfo ? (
                <>
                  <View style={styles.translationRow}>
                    <Text style={styles.translation}>{wordInfo.translation}</Text>
                    <Pressable
                      style={[
                        styles.audioBtn,
                        isSpeaking && { backgroundColor: categoryColor },
                      ]}
                      onPress={() => speak(wordInfo.word)}
                    >
                      <Volume2
                        size={18}
                        color={isSpeaking ? 'white' : categoryColor}
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
                    <Text style={styles.exampleEnglish}>{wordInfo.exampleTranslation}</Text>
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
                      { backgroundColor: categoryColor },
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
    backgroundColor: '#FAFAF8',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  loadingArticleText: {
    fontSize: 15,
    color: Colors.textMuted,
    marginTop: 12,
  },
  notFoundCard: {
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 36,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
    gap: 12,
  },
  notFoundTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    marginTop: 4,
  },
  notFoundSub: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center' as const,
    lineHeight: 20,
  },
  backBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 28,
    paddingVertical: 13,
    borderRadius: 12,
    marginTop: 4,
  },
  backBtnText: {
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
    paddingBottom: 80,
  },
  heroImage: {
    width: SCREEN_WIDTH,
    height: HERO_IMAGE_HEIGHT,
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
  heroShareBtn: {
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
  heroLevelBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  heroLevelText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: 'white',
  },
  heroHeadline: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: 'white',
    lineHeight: 26,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    marginBottom: 8,
  },
  heroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroSource: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.75)',
  },
  heroMetaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  heroDate: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
  },
  articleBody: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  articleMasthead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    flexWrap: 'wrap',
    gap: 8,
  },
  originalLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  originalLinkText: {
    fontSize: 12,
    fontWeight: '500' as const,
  },
  readingTimeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.04)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  readingTimeText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '500' as const,
  },
  loadingBox: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
  },
  loadingShimmer: {
    marginBottom: 20,
    gap: 10,
  },
  shimmerLine: {
    height: 14,
    backgroundColor: '#F0EDEA',
    borderRadius: 7,
  },
  shimmerGap: {
    height: 8,
  },
  loadingIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  loadingSubtext: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 4,
    textAlign: 'center' as const,
  },
  errorBox: {
    backgroundColor: Colors.errorLight,
    borderRadius: 18,
    padding: 28,
    alignItems: 'center',
  },
  errorBoxText: {
    fontSize: 15,
    color: Colors.error,
    textAlign: 'center' as const,
    marginBottom: 16,
    lineHeight: 22,
  },
  fallbackContent: {
    marginTop: 20,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 18,
    width: '100%',
  },
  fallbackLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  fallbackHeadline: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 10,
    lineHeight: 24,
  },
  fallbackSummary: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 23,
    marginBottom: 10,
  },
  fallbackSource: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryBtnText: {
    color: 'white',
    fontWeight: '600' as const,
    fontSize: 14,
  },
  frenchTitle: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: '#1A1A1A',
    lineHeight: 36,
    letterSpacing: -0.5,
    marginBottom: 20,
  },
  summaryBox: {
    backgroundColor: 'white',
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
    borderLeftWidth: 3,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
  },
  summaryText: {
    fontSize: 14,
    color: '#555',
    lineHeight: 22,
  },
  interactionHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 20,
    paddingHorizontal: 2,
  },
  interactionHintText: {
    fontSize: 12,
    fontWeight: '500' as const,
  },
  interactionDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.textMuted,
  },
  articleContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 2,
  },
  paragraphWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  bodyWord: {
    fontSize: 17,
    lineHeight: 30,
    color: '#2A2A2A',
    letterSpacing: 0.15,
  },
  bodyWordActive: {
    color: '#2A2A2A',
  },
  headingWrap: {
    marginTop: 16,
    marginBottom: 14,
    paddingLeft: 14,
  },
  headingAccent: {
    position: 'absolute',
    left: 0,
    top: 4,
    bottom: 4,
    width: 3,
    borderRadius: 2,
  },
  headingContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  headingWord: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '700' as const,
    color: '#1A1A1A',
  },
  headingWordActive: {
    color: '#1A1A1A',
  },
  subheadingWrap: {
    marginTop: 12,
    marginBottom: 10,
  },
  subheadingContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  subheadingWord: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '600' as const,
    color: '#333',
  },
  subheadingWordActive: {
    color: '#333',
  },
  sectionLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 16,
    gap: 10,
  },
  sectionLabelLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E8E4E0',
  },
  sectionLabelText: {
    fontSize: 12,
    fontWeight: '700' as const,
    letterSpacing: 1.5,
    textTransform: 'uppercase' as const,
  },
  numberedItemWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
    gap: 12,
  },
  numberCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 3,
  },
  numberCircleText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: 'white',
  },
  bulletItemWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
    gap: 12,
    paddingLeft: 4,
  },
  bulletDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginTop: 11,
  },
  listItemContent: {
    flex: 1,
  },
  listItemTextWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  listWord: {
    fontSize: 16,
    lineHeight: 27,
    color: '#2A2A2A',
  },
  listWordActive: {
    color: '#2A2A2A',
  },
  savedWord: {
    backgroundColor: '#FFF0E6',
    color: Colors.primaryDark,
    borderRadius: 4,
  },
  vocabSection: {
    backgroundColor: 'white',
    borderRadius: 16,
    paddingTop: 18,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 2,
    overflow: 'hidden',
  },
  vocabHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingBottom: 14,
  },
  vocabTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    flex: 1,
  },
  vocabCount: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '500' as const,
  },
  vocabDivider: {
    height: 1,
    backgroundColor: '#F0EDEA',
  },
  vocabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F2EF',
  },
  vocabRowLast: {
    borderBottomWidth: 0,
  },
  vocabFrench: {
    fontSize: 15,
    fontWeight: '600' as const,
    flex: 1,
  },
  vocabArrow: {
    paddingHorizontal: 10,
  },
  vocabArrowText: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  vocabEnglish: {
    fontSize: 14,
    color: Colors.textSecondary,
    flex: 1,
    textAlign: 'right' as const,
  },
  gapsStat: {
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 10,
  },
  gapsIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gapsStatText: {
    fontSize: 14,
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
