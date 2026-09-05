import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  SafeAreaView,
  ActivityIndicator,
  Platform,
  Animated,
} from 'react-native';
import { useRouter, useNavigation } from 'expo-router';
import { safeGoBack } from '@/utils/navigation';
import {
  ArrowLeft,
  Mic,
  Square,
  ChevronLeft,
  ChevronRight,
  Volume2,
  CheckCircle,
  Info,
  AudioLines,
  Globe,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { USE_NATIVE_DRIVER } from '@/constants/animation';
import { pronunciationCategories, PronunciationCategory } from '@/data/pronunciationData';
import { useAzurePronunciation } from '@/hooks/useAzurePronunciation';
import { useFrenchAudio } from '@/hooks/useFrenchAudio';
import Kiri from '@/components/Kiri';
import PronunciationFeedback from '@/components/PronunciationFeedback';
import type { PronunciationResult } from '@/utils/azurePronunciation';
import { useAccent } from '@/contexts/AccentContext';

export const unstable_settings = {
  headerShown: false,
};

export default function PronunciationPracticeScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { accentLocale } = useAccent();
  const [selectedCategory, setSelectedCategory] = useState<PronunciationCategory | null>(null);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [showTips, setShowTips] = useState(false);
  const [completedWords, setCompletedWords] = useState<Set<string>>(new Set());
  const [_expandedWord, setExpandedWord] = useState<string | null>(null);

  const {
    isRecording,
    isAnalyzing,
    result,
    error: assessmentError,
    startRecording: azureStartRecording,
    stopAndAssess,
    reset: resetAssessment,
  } = useAzurePronunciation(accentLocale);

  const { speak, isSpeaking } = useFrenchAudio();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const currentWord = selectedCategory?.words[currentWordIndex];

  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 500,
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording, pulseAnim]);

  useEffect(() => {
    if (result && result.accuracyScore >= 70 && currentWord) {
      setCompletedWords(prev => new Set([...prev, currentWord.id]));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [result, currentWord]);

  const handleStartRecording = useCallback(async () => {
    if (!currentWord) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await azureStartRecording();
  }, [currentWord, azureStartRecording]);

  const handleStopRecording = useCallback(async () => {
    if (!currentWord) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await stopAndAssess(currentWord.word);
  }, [currentWord, stopAndAssess]);

  const goToNextWord = () => {
    if (selectedCategory && currentWordIndex < selectedCategory.words.length - 1) {
      setCurrentWordIndex(currentWordIndex + 1);
      resetAssessment();
      setExpandedWord(null);
    }
  };

  const goToPrevWord = () => {
    if (currentWordIndex > 0) {
      setCurrentWordIndex(currentWordIndex - 1);
      resetAssessment();
      setExpandedWord(null);
    }
  };

  const _getScoreColor = (score: number) => {
    if (score >= 80) return '#10B981';
    if (score >= 60) return '#F59E0B';
    return '#EF4444';
  };

  const renderCategorySelection = () => (
    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionTitle}>Choose a Sound Category</Text>
      <Text style={styles.sectionSubtitle}>
        Focus on specific French sounds to perfect your accent
      </Text>

      <View style={styles.azureBadge}>
        <AudioLines size={14} color="#0078D4" />
        <Text style={styles.azureBadgeText}>Powered by Azure Speech AI</Text>
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.accentExplorerBanner,
          pressed && { opacity: 0.85 },
        ]}
        onPress={() => router.push('/accent-explorer' as any)}
      >
        <View style={styles.accentExplorerIcon}>
          <Globe size={22} color="#FFFFFF" />
        </View>
        <View style={styles.accentExplorerContent}>
          <Text style={styles.accentExplorerTitle}>Regional Accent Explorer</Text>
          <Text style={styles.accentExplorerDesc}>Compare & practice French, Québécois, Belgian, Swiss, African accents</Text>
        </View>
        <ChevronRight size={20} color="rgba(255,255,255,0.7)" />
      </Pressable>

      <View style={styles.categoriesGrid}>
        {pronunciationCategories.map((category) => (
          <Pressable
            key={category.id}
            style={({ pressed }) => [
              styles.categoryCard,
              { borderColor: category.color },
              pressed && styles.cardPressed,
            ]}
            onPress={() => {
              setSelectedCategory(category);
              setCurrentWordIndex(0);
              resetAssessment();
              setExpandedWord(null);
            }}
          >
            <View
              style={[
                styles.categoryIcon,
                { backgroundColor: category.color + '20' },
              ]}
            >
              <Text style={styles.categoryEmoji}>{category.icon}</Text>
            </View>
            <Text style={styles.categoryName}>{category.name}</Text>
            <Text style={styles.categoryDescription}>
              {category.description}
            </Text>
            <View style={styles.categoryMeta}>
              <Text
                style={[styles.categoryDifficulty, { color: category.color }]}
              >
                {category.difficulty.charAt(0).toUpperCase() +
                  category.difficulty.slice(1)}
              </Text>
              <Text style={styles.categoryWordCount}>
                {category.words.length} words
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );

  const renderPracticeScreen = () => {
    if (!selectedCategory || !currentWord) return null;

    const progress =
      ((currentWordIndex + 1) / selectedCategory.words.length) * 100;
    const categoryCompletedCount = selectedCategory.words.filter((w) =>
      completedWords.has(w.id),
    ).length;

    return (
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.practiceHeader}>
          <Pressable
            onPress={() => {
              setSelectedCategory(null);
              resetAssessment();
            }}
            style={styles.backToCategories}
          >
            <ArrowLeft size={16} color={Colors.primary} />
            <Text style={styles.backToCategoriesText}>Categories</Text>
          </Pressable>

          <View style={styles.progressInfo}>
            <Text style={styles.progressText}>
              {currentWordIndex + 1} / {selectedCategory.words.length}
            </Text>
            <Text style={styles.masteredText}>
              {categoryCompletedCount} mastered
            </Text>
          </View>
        </View>

        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${progress}%`,
                backgroundColor: selectedCategory.color,
              },
            ]}
          />
        </View>

        <View
          style={[styles.wordCard, { borderColor: selectedCategory.color }]}
        >
          <View
            style={[
              styles.wordCardHeader,
              { backgroundColor: selectedCategory.color },
            ]}
          >
            <Text style={styles.categoryLabel}>{selectedCategory.name}</Text>
            {completedWords.has(currentWord.id) && (
              <CheckCircle size={20} color="#FFFFFF" />
            )}
          </View>

          <View style={styles.wordCardBody}>
            <Text style={styles.mainWord}>{currentWord.word}</Text>
            <Text style={styles.ipaText}>{currentWord.ipa}</Text>
            <Text style={styles.translationText}>
              {currentWord.translation}
            </Text>

            <View style={styles.hintBox}>
              <Info size={14} color={Colors.primary} />
              <Text style={styles.hintText}>{currentWord.audioHint}</Text>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.listenButton,
                { backgroundColor: selectedCategory.color },
                pressed && { opacity: 0.8 },
                isSpeaking && { opacity: 0.6 },
              ]}
              onPress={() => speak(currentWord.word)}
              disabled={isSpeaking}
            >
              <Volume2 size={20} color="#FFFFFF" />
              <Text style={styles.listenButtonText}>
                {isSpeaking ? 'Playing...' : 'Listen'}
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.recordSection}>
          {isAnalyzing ? (
            <View style={styles.analyzingContainer}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.analyzingText}>
                Azure Speech AI is analyzing your pronunciation...
              </Text>
            </View>
          ) : isRecording ? (
            <View style={styles.recordingContainer}>
              <Animated.View
                style={[
                  styles.recordingPulse,
                  { transform: [{ scale: pulseAnim }] },
                ]}
              >
                <Pressable
                  style={styles.stopButton}
                  onPress={handleStopRecording}
                >
                  <Square size={32} color="#FFFFFF" fill="#FFFFFF" />
                </Pressable>
              </Animated.View>
              <Text style={styles.recordingText}>
                Recording... Tap to stop
              </Text>
            </View>
          ) : (
            <Pressable
              style={({ pressed }) => [
                styles.recordButton,
                pressed && { transform: [{ scale: 0.95 }] },
              ]}
              onPress={handleStartRecording}
            >
              <View style={styles.recordButtonGradient}>
                <Mic size={32} color="#FFFFFF" />
                <Text style={styles.recordButtonText}>Tap to Record</Text>
              </View>
            </Pressable>
          )}
        </View>

        {assessmentError && !result && (
          <View style={styles.errorBox}>
            <View style={styles.errorBoxIcon}>
              <Info size={16} color="#EF4444" />
            </View>
            <Text style={styles.errorBoxText}>{assessmentError}</Text>
            <Pressable
              onPress={() => resetAssessment()}
              style={styles.errorDismissButton}
            >
              <Text style={styles.errorDismissText}>Dismiss</Text>
            </Pressable>
          </View>
        )}

        {result && renderResults(result)}

        <Pressable
          style={styles.tipsToggle}
          onPress={() => setShowTips(!showTips)}
        >
          <Info size={16} color={Colors.primary} />
          <Text style={styles.tipsToggleText}>
            {showTips ? 'Hide Tips' : 'Show Tips'}
          </Text>
        </Pressable>

        {showTips && (
          <View style={styles.tipsContainer}>
            {selectedCategory.tips.map((tip, idx) => (
              <View key={idx} style={styles.tipItem}>
                <Text style={styles.tipBullet}>•</Text>
                <Text style={styles.tipText}>{tip}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.navigationRow}>
          <Pressable
            style={[
              styles.navButton,
              currentWordIndex === 0 && styles.navButtonDisabled,
            ]}
            onPress={goToPrevWord}
            disabled={currentWordIndex === 0}
          >
            <ChevronLeft
              size={24}
              color={
                currentWordIndex === 0
                  ? Colors.textSecondary
                  : Colors.primary
              }
            />
            <Text
              style={[
                styles.navButtonText,
                currentWordIndex === 0 && styles.navButtonTextDisabled,
              ]}
            >
              Previous
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.navButton,
              currentWordIndex === selectedCategory.words.length - 1 &&
                styles.navButtonDisabled,
            ]}
            onPress={goToNextWord}
            disabled={
              currentWordIndex === selectedCategory.words.length - 1
            }
          >
            <Text
              style={[
                styles.navButtonText,
                currentWordIndex === selectedCategory.words.length - 1 &&
                  styles.navButtonTextDisabled,
              ]}
            >
              Next
            </Text>
            <ChevronRight
              size={24}
              color={
                currentWordIndex === selectedCategory.words.length - 1
                  ? Colors.textSecondary
                  : Colors.primary
              }
            />
          </Pressable>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    );
  };

  const renderResults = (res: PronunciationResult) => (
    <View style={styles.resultSection}>
      <View style={styles.resultWithKiri}>
        <Kiri
          mood={
            res.accuracyScore >= 70
              ? 'celebrating'
              : res.accuracyScore >= 50
                ? 'encouraging'
                : 'thinking'
          }
          size={80}
        />
      </View>

      <PronunciationFeedback
        result={res}
        targetText={currentWord?.word ?? ''}
        onTryAgain={() => {
          resetAssessment();
          setExpandedWord(null);
        }}
        accentColor={selectedCategory?.color ?? Colors.primary}
      />
    </View>
  );

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={() => safeGoBack()} style={styles.backButton}>
            <ArrowLeft size={24} color={Colors.primary} />
          </Pressable>
          <Text style={styles.headerTitle}>Pronunciation</Text>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>

      {selectedCategory ? renderPracticeScreen() : renderCategorySelection()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFBF7',
  },
  safeArea: {
    backgroundColor: '#FFFBF7',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  azureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: '#0078D410',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 20,
  },
  azureBadgeText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#0078D4',
  },
  categoriesGrid: {
    gap: 16,
  },
  categoryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  categoryIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  categoryEmoji: {
    fontSize: 28,
  },
  categoryName: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  categoryDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  categoryMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryDifficulty: {
    fontSize: 12,
    fontWeight: '600' as const,
    textTransform: 'uppercase',
  },
  categoryWordCount: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  practiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  backToCategories: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backToCategoriesText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '500' as const,
  },
  progressInfo: {
    alignItems: 'flex-end',
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  masteredText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  progressBar: {
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: 3,
    marginBottom: 20,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  wordCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 2,
    overflow: 'hidden',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  wordCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  categoryLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  wordCardBody: {
    padding: 24,
    alignItems: 'center',
  },
  mainWord: {
    fontSize: 42,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  ipaText: {
    fontSize: 24,
    color: Colors.primary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 8,
  },
  translationText: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  hintBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.primaryLight,
    padding: 12,
    borderRadius: 12,
    gap: 8,
    marginBottom: 20,
    width: '100%',
  },
  hintText: {
    flex: 1,
    fontSize: 13,
    color: Colors.primary,
    lineHeight: 18,
  },
  listenButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  listenButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  recordSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  recordButton: {
    borderRadius: 80,
    overflow: 'hidden',
  },
  recordButtonGradient: {
    width: 160,
    height: 160,
    borderRadius: 80,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
  },
  recordButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    marginTop: 8,
  },
  recordingContainer: {
    alignItems: 'center',
  },
  recordingPulse: {
    marginBottom: 12,
  },
  stopButton: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordingText: {
    fontSize: 14,
    color: '#EF4444',
    fontWeight: '500' as const,
  },
  analyzingContainer: {
    alignItems: 'center',
    padding: 40,
  },
  analyzingText: {
    marginTop: 16,
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  resultSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  resultWithKiri: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 20,
  },
  scoreCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreNumber: {
    fontSize: 42,
    fontWeight: '700' as const,
  },
  scoreLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: -4,
  },
  scoreBreakdown: {
    width: '100%',
    gap: 10,
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  scoreBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scoreBarLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    width: 110,
  },
  scoreBarLabelText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  scoreBarTrack: {
    flex: 1,
    height: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    overflow: 'hidden',
  },
  scoreBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  scoreBarValue: {
    fontSize: 13,
    fontWeight: '700' as const,
    width: 30,
    textAlign: 'right' as const,
  },
  recognizedBox: {
    backgroundColor: '#FFFBF7',
    padding: 12,
    borderRadius: 12,
    width: '100%',
    marginBottom: 16,
  },
  recognizedLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  recognizedTextValue: {
    fontSize: 16,
    color: Colors.text,
    fontStyle: 'italic',
  },
  wordScoresSection: {
    width: '100%',
    marginBottom: 16,
  },
  wordScoresTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  wordScoresSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  wordScoreContainer: {
    marginBottom: 8,
  },
  wordScoreChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  wordScoreText: {
    fontSize: 16,
    fontWeight: '600' as const,
    flex: 1,
  },
  wordScoreNum: {
    fontSize: 14,
    fontWeight: '700' as const,
  },
  errorTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  errorTypeText: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: '#EF4444',
    textTransform: 'uppercase',
  },
  expandedPhonemes: {
    marginTop: 8,
    marginLeft: 12,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: Colors.border,
    gap: 6,
  },
  expandedPhonemeRow: {
    gap: 4,
  },
  nBestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 4,
    marginTop: 2,
  },
  nBestLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  nBestChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#F3F4F6',
  },
  nBestPhoneme: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.text,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  nBestScore: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  phonemesSection: {
    width: '100%',
    marginBottom: 16,
  },
  phonemesTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 12,
  },
  phonemesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  phonemeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  phonemeChar: {
    fontSize: 18,
    fontWeight: '600' as const,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  phonemeScore: {
    fontSize: 11,
    fontWeight: '500' as const,
  },
  feedbackBox: {
    backgroundColor: Colors.primaryLight,
    padding: 16,
    borderRadius: 12,
    width: '100%',
    marginBottom: 16,
  },
  feedbackTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.primary,
    marginBottom: 8,
  },
  feedbackText: {
    fontSize: 14,
    color: Colors.primary,
    lineHeight: 20,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  tipsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  tipsToggleText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '500' as const,
  },
  tipsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  tipItem: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  tipBullet: {
    fontSize: 14,
    color: Colors.primary,
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
  },
  navigationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  navButtonDisabled: {
    opacity: 0.5,
  },
  navButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  navButtonTextDisabled: {
    color: Colors.textSecondary,
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
    flexWrap: 'wrap',
  },
  errorBoxIcon: {
    marginTop: 1,
  },
  errorBoxText: {
    flex: 1,
    fontSize: 13,
    color: '#991B1B',
    lineHeight: 18,
  },
  errorDismissButton: {
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  errorDismissText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
  accentExplorerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  accentExplorerIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  accentExplorerContent: {
    flex: 1,
  },
  accentExplorerTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    marginBottom: 2,
  },
  accentExplorerDesc: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 16,
  },
});
