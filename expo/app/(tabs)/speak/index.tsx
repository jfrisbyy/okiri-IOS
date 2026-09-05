import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  Pressable,
  Animated,
  Dimensions,
  FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  Mic, 
  Clock, 
  TrendingUp,
  Check,
  History,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Lightbulb,
  Heart,
  Compass,
  Users,
  Sparkles,
  ArrowLeft,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { USE_NATIVE_DRIVER } from '@/constants/animation';
import { useApp } from '@/contexts/AppContext';
import * as Haptics from 'expo-haptics';
import {
  getRecommendedSpeakDurations,
  getGuidedPromptDuration,
  CATEGORY_CEFR_LEVELS,
  getUserCEFRLevel,
  isCategoryRecommended,
} from '@/utils/progressiveDifficulty';
import {
  Prompt,
  describePrompts,
  opinionsPrompts,
  hypotheticalPrompts,
  storytellingPrompts,
  socialPrompts,
  emotionsPrompts,
} from '@/data/speakingPrompts';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 40;

interface PromptCategory {
  id: string;
  name: string;
  icon: React.ReactNode;
  color: string;
  prompts: Prompt[];
}

const promptCategories: PromptCategory[] = [
  {
    id: 'describe',
    name: 'Describe & Explain',
    icon: <Lightbulb size={20} color="#FFFFFF" />,
    color: '#3B82F6',
    prompts: describePrompts,
  },
  {
    id: 'opinions',
    name: 'Opinions & Arguments',
    icon: <MessageCircle size={20} color="#FFFFFF" />,
    color: '#8B5CF6',
    prompts: opinionsPrompts,
  },
  {
    id: 'hypothetical',
    name: 'Hypotheticals',
    icon: <Sparkles size={20} color="#FFFFFF" />,
    color: '#EC4899',
    prompts: hypotheticalPrompts,
  },
  {
    id: 'storytelling',
    name: 'Storytelling',
    icon: <Compass size={20} color="#FFFFFF" />,
    color: '#10B981',
    prompts: storytellingPrompts,
  },
  {
    id: 'social',
    name: 'Social Scenarios',
    icon: <Users size={20} color="#FFFFFF" />,
    color: '#F59E0B',
    prompts: socialPrompts,
  },
  {
    id: 'emotions',
    name: 'Emotions & Feelings',
    icon: <Heart size={20} color="#FFFFFF" />,
    color: '#EF4444',
    prompts: emotionsPrompts,
  },
];

export default function SpeakScreen() {
  const router = useRouter();
  const { progress, proficiency } = useApp();

  const userLevel = useMemo(() => getUserCEFRLevel(proficiency.certifiedLevels), [proficiency.certifiedLevels]);
  const recommendedDurations = useMemo(() => getRecommendedSpeakDurations(proficiency.certifiedLevels, progress.totalSpeakingMinutes), [proficiency.certifiedLevels, progress.totalSpeakingMinutes]);
  const guidedDuration = useMemo(() => getGuidedPromptDuration(proficiency.certifiedLevels), [proficiency.certifiedLevels]);

  const [selectedDuration, setSelectedDuration] = useState(2);
  const [selectedCategory, setSelectedCategory] = useState(promptCategories[0]);
  const [currentPromptIndex, setCurrentPromptIndex] = useState(0);
  const [mode, setMode] = useState<'free' | 'guided'>('free');
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const promptListRef = useRef<FlatList>(null);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [fadeAnim]);

  useEffect(() => {
    if (recommendedDurations.length > 0) {
      setSelectedDuration(recommendedDurations[0].value);
    }
  }, [recommendedDurations]);

  const handleStartFreeSpeech = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: '/speech-session',
      params: { 
        duration: selectedDuration.toString(),
        prompt: 'Free Speech - Talk about anything you want',
      },
    });
  };

  const handleStartGuidedSession = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const prompt = selectedCategory.prompts[currentPromptIndex];
    router.push({
      pathname: '/speech-session',
      params: { 
        duration: guidedDuration.toString(),
        prompt: prompt.text,
      },
    });
  };

  const handlePrevPrompt = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentPromptIndex > 0) {
      const newIndex = currentPromptIndex - 1;
      setCurrentPromptIndex(newIndex);
      promptListRef.current?.scrollToIndex({ index: newIndex, animated: true });
    }
  };

  const handleNextPrompt = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentPromptIndex < selectedCategory.prompts.length - 1) {
      const newIndex = currentPromptIndex + 1;
      setCurrentPromptIndex(newIndex);
      promptListRef.current?.scrollToIndex({ index: newIndex, animated: true });
    }
  };

  const handleSelectCategory = (category: PromptCategory) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedCategory(category);
    setCurrentPromptIndex(0);
    setTimeout(() => {
      promptListRef.current?.scrollToIndex({ index: 0, animated: false });
    }, 100);
  };

  const onPromptScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / CARD_WIDTH);
    if (index !== currentPromptIndex && index >= 0 && index < selectedCategory.prompts.length) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setCurrentPromptIndex(index);
    }
  };

  const currentPrompt = selectedCategory.prompts[currentPromptIndex];

  const renderPromptCard = ({ item, index }: { item: Prompt; index: number }) => (
    <View style={[styles.promptCardWrapper, { width: CARD_WIDTH }]}>
      <View style={[styles.promptCard, { borderColor: selectedCategory.color }]}>
        <View style={[styles.promptHeader, { backgroundColor: selectedCategory.color }]}>
          <Text style={styles.promptNumber}>
            {index + 1} of {selectedCategory.prompts.length}
          </Text>
          <Text style={styles.challengeLabel}>{item.challenge}</Text>
        </View>
        
        <View style={styles.promptBody}>
          <Text style={styles.promptText}>{item.text}</Text>
          
          <View style={styles.vocabSection}>
            <Text style={styles.vocabTitle}>Key Vocabulary</Text>
            <View style={styles.vocabTags}>
              {item.vocabularyFocus.map((word, idx) => (
                <View key={idx} style={styles.vocabTag}>
                  <Text style={styles.vocabWord}>{word}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <Animated.View style={[styles.animatedContainer, { opacity: fadeAnim }]}>
          <LinearGradient
            colors={['#1E293B', '#334155']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerGradient}
          >
            <Pressable 
              style={styles.backButton}
              onPress={() => router.push('/(tabs)/home')}
            >
              <ArrowLeft size={24} color={Colors.textLight} />
            </Pressable>
            <View style={styles.headerContent}>
              <Text style={styles.title}>Speak</Text>
              <Text style={styles.subtitle}>Practice speaking and build fluency</Text>
              
              <View style={styles.statsRow}>
                <View style={styles.statChip}>
                  <TrendingUp size={14} color={Colors.textLight} />
                  <Text style={styles.statValue}>{progress.totalSpeakingMinutes}</Text>
                  <Text style={styles.statLabel}>total min</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statChip}>
                  <Clock size={14} color={Colors.textLight} />
                  <Text style={styles.statValue}>{progress.weeklyStats.speakingMinutes}</Text>
                  <Text style={styles.statLabel}>this week</Text>
                </View>
                <View style={styles.statDivider} />
                <Pressable 
                  style={styles.historyButton}
                  onPress={() => router.push('/recording-log')}
                >
                  <History size={14} color={Colors.textLight} />
                  <Text style={styles.historyLabel}>History</Text>
                </Pressable>
              </View>
            </View>
            <View style={styles.headerDecoration} />
          </LinearGradient>

          <View style={styles.modeToggle}>
            <Pressable
              style={[styles.modeButton, mode === 'free' && styles.modeButtonActive]}
              onPress={() => setMode('free')}
            >
              <Mic size={16} color={mode === 'free' ? Colors.textLight : Colors.text} />
              <Text style={[styles.modeButtonText, mode === 'free' && styles.modeButtonTextActive]}>
                Free Speech
              </Text>
            </Pressable>
            <Pressable
              style={[styles.modeButton, mode === 'guided' && styles.modeButtonActive]}
              onPress={() => setMode('guided')}
            >
              <Lightbulb size={16} color={mode === 'guided' ? Colors.textLight : Colors.text} />
              <Text style={[styles.modeButtonText, mode === 'guided' && styles.modeButtonTextActive]}>
                Guided Prompts
              </Text>
            </Pressable>
          </View>

          <ScrollView 
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {mode === 'free' ? (
              <View style={styles.freeSpeechSection}>
                <Text style={styles.sectionTitle}>Session Length</Text>
                <Text style={styles.sectionSubtitle}>
                  Speak freely about anything - your day, thoughts, or stories
                </Text>
                
                <View style={styles.durationGrid}>
                  {recommendedDurations.map((duration) => (
                    <Pressable
                      key={duration.value}
                      style={[
                        styles.durationCard,
                        selectedDuration === duration.value && styles.durationCardActive,
                      ]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setSelectedDuration(duration.value);
                      }}
                    >
                      {selectedDuration === duration.value && (
                        <View style={styles.checkMark}>
                          <Check size={12} color={Colors.textLight} />
                        </View>
                      )}
                      <Text style={[
                        styles.durationValue,
                        selectedDuration === duration.value && styles.durationValueActive,
                      ]}>
                        {duration.label}
                      </Text>
                      <Text style={[
                        styles.durationDesc,
                        selectedDuration === duration.value && styles.durationDescActive,
                      ]}>
                        {duration.description}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <View style={styles.freeSpeechTips}>
                  <Text style={styles.tipsTitle}>Tips for Free Speech</Text>
                  <Text style={styles.tipItem}>Talk about your day in French</Text>
                  <Text style={styles.tipItem}>Describe what you see around you</Text>
                  <Text style={styles.tipItem}>Narrate your thoughts out loud</Text>
                  <Text style={styles.tipItem}>Practice conversations with yourself</Text>
                </View>
              </View>
            ) : (
              <View style={styles.guidedSection}>
                <Text style={styles.sectionTitle}>Choose a Category</Text>
                <Text style={styles.sectionSubtitle}>
                  Targeted prompts to expand your vocabulary
                </Text>

                <View style={styles.guidedDurationBadge}>
                  <Clock size={14} color={Colors.primary} />
                  <Text style={styles.guidedDurationText}>{guidedDuration} min guided session</Text>
                </View>

                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.categoryScroll}
                >
                  {promptCategories.map((category) => (
                    <Pressable
                      key={category.id}
                      style={[
                        styles.categoryChip,
                        selectedCategory.id === category.id && { backgroundColor: category.color },
                      ]}
                      onPress={() => handleSelectCategory(category)}
                    >
                      <View style={[
                        styles.categoryIcon,
                        selectedCategory.id === category.id 
                          ? { backgroundColor: 'rgba(255,255,255,0.2)' }
                          : { backgroundColor: category.color + '20' }
                      ]}>
                        {React.cloneElement(category.icon as React.ReactElement<{ color: string }>, {
                          color: selectedCategory.id === category.id ? '#FFFFFF' : category.color
                        })}
                      </View>
                      <Text style={[
                        styles.categoryName,
                        selectedCategory.id === category.id && styles.categoryNameActive,
                      ]}>
                        {category.name}
                      </Text>
                      {CATEGORY_CEFR_LEVELS[category.id] && (
                        <View style={[
                          styles.cefrBadge,
                          selectedCategory.id === category.id && styles.cefrBadgeActive,
                          isCategoryRecommended(category.id, userLevel) && selectedCategory.id !== category.id && styles.cefrBadgeRecommended,
                        ]}>
                          <Text style={[
                            styles.cefrBadgeText,
                            selectedCategory.id === category.id && styles.cefrBadgeTextActive,
                          ]}>
                            {CATEGORY_CEFR_LEVELS[category.id]}+
                          </Text>
                        </View>
                      )}
                    </Pressable>
                  ))}
                </ScrollView>

                <View style={styles.promptCardContainer}>
                  <Text style={styles.swipeHint}>Swipe to browse prompts</Text>
                  <FlatList
                    ref={promptListRef}
                    data={selectedCategory.prompts}
                    renderItem={renderPromptCard}
                    keyExtractor={(item) => item.id}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    snapToInterval={CARD_WIDTH}
                    decelerationRate="fast"
                    contentContainerStyle={styles.carouselContent}
                    onMomentumScrollEnd={onPromptScroll}
                    getItemLayout={(_, index) => ({
                      length: CARD_WIDTH,
                      offset: CARD_WIDTH * index,
                      index,
                    })}
                  />
                  
                  <View style={styles.promptNav}>
                    <Pressable 
                      style={[styles.navButton, currentPromptIndex === 0 && styles.navButtonDisabled]}
                      onPress={handlePrevPrompt}
                      disabled={currentPromptIndex === 0}
                    >
                      <ChevronLeft size={24} color={currentPromptIndex === 0 ? Colors.textMuted : Colors.text} />
                    </Pressable>
                    
                    <View style={styles.promptDots}>
                      {selectedCategory.prompts.map((_, index) => (
                        <View 
                          key={index} 
                          style={[
                            styles.dot,
                            index === currentPromptIndex && { backgroundColor: selectedCategory.color }
                          ]} 
                        />
                      ))}
                    </View>
                    
                    <Pressable 
                      style={[
                        styles.navButton, 
                        currentPromptIndex === selectedCategory.prompts.length - 1 && styles.navButtonDisabled
                      ]}
                      onPress={handleNextPrompt}
                      disabled={currentPromptIndex === selectedCategory.prompts.length - 1}
                    >
                      <ChevronRight size={24} color={
                        currentPromptIndex === selectedCategory.prompts.length - 1 
                          ? Colors.textMuted 
                          : Colors.text
                      } />
                    </Pressable>
                  </View>
                </View>
              </View>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              style={({ pressed }) => [
                styles.startButton,
                mode === 'guided' && { backgroundColor: selectedCategory.color },
                pressed && styles.startButtonPressed,
              ]}
              onPress={mode === 'free' ? handleStartFreeSpeech : handleStartGuidedSession}
            >
              <View style={styles.micIconContainer}>
                <Mic size={20} color={Colors.textLight} />
              </View>
              <Text style={styles.startButtonText}>
                {mode === 'free' ? 'Start Free Speech' : 'Start with This Prompt'}
              </Text>
            </Pressable>
          </View>
        </Animated.View>
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
  animatedContainer: {
    flex: 1,
  },
  backButton: {
    position: 'absolute',
    top: 16,
    left: 16,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerGradient: {
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 24,
    position: 'relative',
    overflow: 'hidden',
  },
  headerContent: {
    zIndex: 1,
  },
  headerDecoration: {
    position: 'absolute',
    right: -20,
    top: 10,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.textLight,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.85)',
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 16,
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textLight,
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  statDivider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  historyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  historyLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500' as const,
  },
  modeToggle: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 12,
    padding: 4,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
  },
  modeButtonActive: {
    backgroundColor: Colors.primary,
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  modeButtonTextActive: {
    color: Colors.textLight,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 120,
  },
  freeSpeechSection: {
    gap: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  durationGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  durationCard: {
    flex: 1,
    backgroundColor: Colors.backgroundCard,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.border,
    position: 'relative',
  },
  durationCardActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  checkMark: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationValue: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  durationValueActive: {
    color: Colors.primaryDark,
  },
  durationDesc: {
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  durationDescActive: {
    color: Colors.primary,
  },
  freeSpeechTips: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 14,
    padding: 16,
    marginTop: 8,
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 12,
  },
  tipItem: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 8,
    paddingLeft: 12,
  },
  guidedSection: {
    gap: 16,
  },
  categoryScroll: {
    paddingVertical: 8,
    gap: 10,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: Colors.backgroundCard,
    marginRight: 10,
  },
  categoryIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  categoryNameActive: {
    color: '#FFFFFF',
  },
  promptCardContainer: {
    marginTop: 8,
  },
  swipeHint: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  carouselContent: {
    paddingHorizontal: 0,
  },
  promptCardWrapper: {
    paddingHorizontal: 4,
  },
  promptCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 16,
    borderWidth: 2,
    overflow: 'hidden',
  },
  promptHeader: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  promptNumber: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.8)',
  },
  challengeLabel: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: '#FFFFFF',
  },
  promptBody: {
    padding: 12,
  },
  promptText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    lineHeight: 24,
    marginBottom: 12,
  },
  vocabSection: {
    marginTop: 8,
  },
  vocabTitle: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textMuted,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  vocabTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  vocabTag: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  vocabWord: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: Colors.primary,
    fontStyle: 'italic',
  },
  promptNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 8,
    marginTop: 8,
  },
  navButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  navButtonDisabled: {
    opacity: 0.5,
  },
  promptDots: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.border,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 24,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  startButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  micIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButtonText: {
    color: Colors.textLight,
    fontSize: 17,
    fontWeight: '600',
  },
  cefrBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: Colors.backgroundSecondary,
    marginLeft: 4,
  },
  cefrBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  cefrBadgeRecommended: {
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  cefrBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: Colors.textMuted,
  },
  cefrBadgeTextActive: {
    color: '#FFFFFF',
  },
  guidedDurationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primaryLight,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 8,
  },
  guidedDurationText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
});
