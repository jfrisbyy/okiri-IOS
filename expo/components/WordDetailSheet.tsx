import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  ActivityIndicator,
  Dimensions,
  Platform,
  ScrollView,
} from 'react-native';
import { Volume2, Plus, X, Check, BookOpen } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { generateObject } from '@rork-ai/toolkit-sdk';
import { z } from 'zod';
import { useFrenchAudio } from '@/hooks/useFrenchAudio';
import Colors from '@/constants/colors';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const wordDetailSchema = z.object({
  definition: z.string().describe('English definition/translation of the French word or phrase'),
  phonetic: z.string().describe('IPA phonetic transcription of the French word/phrase'),
  exampleFrench: z.string().describe('An example sentence in French using this word/phrase'),
  exampleEnglish: z.string().describe('English translation of the example sentence'),
  partOfSpeech: z.string().describe('Part of speech (noun, verb, adjective, phrase, etc.)'),
  register: z.string().describe('Language register: formal, informal, neutral, slang'),
});

type WordDetail = z.infer<typeof wordDetailSchema>;

interface WordDetailSheetProps {
  word: string | null;
  context: string;
  isAlreadySaved: boolean;
  onAddToGaps: (word: string, detail: WordDetail) => void;
  onDismiss: () => void;
}

function WordDetailSheetInner({
  word,
  context,
  isAlreadySaved,
  onAddToGaps,
  onDismiss,
}: WordDetailSheetProps) {
  const [detail, setDetail] = useState<WordDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);
  const [isAdded, setIsAdded] = useState(isAlreadySaved);
  const [isAdding, setIsAdding] = useState(false);

  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const { speak, stop, isSpeaking } = useFrenchAudio();

  const isVisible = word !== null;

  const fetchWordDetail = useCallback(async () => {
    if (!word) return;
    setIsLoading(true);
    setError(false);

    try {
      console.log('[WordDetail] Fetching details for:', word);
      const result = await generateObject({
        messages: [
          {
            role: 'user',
            content: `You are a French language expert. Provide details for the French word or phrase "${word}" used in context: "${context}". Give an accurate English definition, IPA phonetic transcription, a natural example sentence using it, and classify its part of speech and register.`,
          },
        ],
        schema: wordDetailSchema,
      });

      console.log('[WordDetail] Got details:', result.definition);
      setDetail(result);
    } catch (err) {
      console.error('[WordDetail] Failed to fetch word details:', err);
      setError(true);
    } finally {
      setIsLoading(false);
    }
  }, [word, context]);

  useEffect(() => {
    if (isVisible && word) {
      setIsAdded(isAlreadySaved);
      setError(false);
      setDetail(null);
      setIsAdding(false);

      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();

      void fetchWordDetail();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isVisible, word, isAlreadySaved, slideAnim, backdropAnim, fetchWordDetail]);

  const handleSpeak = useCallback(async () => {
    if (!word) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await speak(word);
  }, [word, speak]);

  const handleSpeakExample = useCallback(async () => {
    if (!detail?.exampleFrench) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await speak(detail.exampleFrench);
  }, [detail, speak]);

  const handleAdd = useCallback(async () => {
    if (!word || !detail || isAdded || isAdding) return;
    setIsAdding(true);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      onAddToGaps(word, detail);
      setIsAdded(true);
    } catch (err) {
      console.error('[WordDetail] Failed to add gap:', err);
    } finally {
      setIsAdding(false);
    }
  }, [word, detail, isAdded, isAdding, onAddToGaps]);

  const handleDismiss = useCallback(() => {
    void stop();
    onDismiss();
  }, [onDismiss, stop]);

  if (!isVisible) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View
        style={[styles.backdrop, { opacity: backdropAnim }]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={handleDismiss} />
      </Animated.View>

      <Animated.View
        style={[
          styles.sheet,
          { transform: [{ translateY: slideAnim }] },
        ]}
      >
        <View style={styles.handleBar} />

        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.wordText}>{word}</Text>
            {detail?.partOfSpeech ? (
              <View style={styles.posBadge}>
                <Text style={styles.posText}>{detail.partOfSpeech}</Text>
              </View>
            ) : null}
            {detail?.register && detail.register !== 'neutral' ? (
              <View style={[styles.posBadge, styles.registerBadge]}>
                <Text style={styles.registerText}>{detail.register}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.headerActions}>
            <Pressable
              onPress={handleSpeak}
              style={[styles.audioBtn, isSpeaking && styles.audioBtnActive]}
              hitSlop={8}
              testID="word-detail-speak"
            >
              <Volume2 size={18} color={isSpeaking ? '#fff' : Colors.primary} />
            </Pressable>
            <Pressable onPress={handleDismiss} style={styles.closeBtn} hitSlop={8}>
              <X size={18} color="rgba(255,255,255,0.5)" />
            </Pressable>
          </View>
        </View>

        {detail?.phonetic ? (
          <Text style={styles.phonetic}>/{detail.phonetic}/</Text>
        ) : isLoading ? (
          <View style={styles.phoneticPlaceholder} />
        ) : null}

        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {isLoading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.loadingText}>Looking up word...</Text>
            </View>
          ) : error ? (
            <View style={styles.errorWrap}>
              <Text style={styles.errorText}>Could not load definition</Text>
              <Pressable onPress={fetchWordDetail} style={styles.retryLink}>
                <Text style={styles.retryLinkText}>Tap to retry</Text>
              </Pressable>
            </View>
          ) : detail ? (
            <>
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Definition</Text>
                <Text style={styles.definitionText}>{detail.definition}</Text>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Example</Text>
                <Pressable onPress={handleSpeakExample} style={styles.exampleRow}>
                  <View style={styles.exampleContent}>
                    <Text style={styles.exampleFr}>{detail.exampleFrench}</Text>
                    <Text style={styles.exampleEn}>{detail.exampleEnglish}</Text>
                  </View>
                  <Volume2 size={14} color="rgba(255,255,255,0.3)" />
                </Pressable>
              </View>
            </>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          {isAdded ? (
            <View style={styles.addedRow}>
              <Check size={16} color={Colors.secondary} />
              <Text style={styles.addedText}>Already in your gaps</Text>
            </View>
          ) : (
            <Pressable
              onPress={handleAdd}
              style={[styles.addBtn, (!detail || isAdding) && styles.addBtnDisabled]}
              disabled={!detail || isAdding}
              testID="add-to-gaps-btn"
            >
              {isAdding ? (
                <ActivityIndicator size={16} color="#fff" />
              ) : (
                <>
                  <Plus size={18} color="#fff" />
                  <Text style={styles.addBtnText}>Add to Gaps</Text>
                  <BookOpen size={14} color="rgba(255,255,255,0.6)" />
                </>
              )}
            </Pressable>
          )}
        </View>
      </Animated.View>
    </View>
  );
}

export const WordDetailSheet = React.memo(WordDetailSheetInner);

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: SCREEN_HEIGHT * 0.48,
    backgroundColor: '#1A1A2E',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    flexWrap: 'wrap',
  },
  wordText: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: '#fff',
    letterSpacing: -0.5,
  },
  posBadge: {
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  posText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.primary,
    textTransform: 'lowercase' as const,
  },
  registerBadge: {
    backgroundColor: 'rgba(13,148,136,0.15)',
  },
  registerText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.secondary,
    textTransform: 'lowercase' as const,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  audioBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(249, 115, 22, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioBtnActive: {
    backgroundColor: Colors.primary,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  phonetic: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.45)',
    marginTop: 4,
    fontStyle: 'italic' as const,
    letterSpacing: 0.5,
  },
  phoneticPlaceholder: {
    height: 20,
    width: 100,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginTop: 4,
  },
  content: {
    marginTop: 16,
    flex: 1,
  },
  loadingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 20,
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
  },
  errorWrap: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  errorText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
  },
  retryLink: {
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  retryLinkText: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '600' as const,
  },
  section: {
    marginBottom: 18,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: 'rgba(255,255,255,0.3)',
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
    marginBottom: 6,
  },
  definitionText: {
    fontSize: 16,
    color: '#fff',
    lineHeight: 23,
    fontWeight: '500' as const,
  },
  exampleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    padding: 12,
    gap: 10,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  exampleContent: {
    flex: 1,
    gap: 4,
  },
  exampleFr: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '600' as const,
    lineHeight: 21,
  },
  exampleEn: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    lineHeight: 18,
    fontStyle: 'italic' as const,
  },
  footer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 14,
  },
  addBtnDisabled: {
    opacity: 0.4,
  },
  addBtnText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
    letterSpacing: 0.2,
  },
  addedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: 'rgba(13,148,136,0.1)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(13,148,136,0.2)',
  },
  addedText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.secondary,
  },
});
