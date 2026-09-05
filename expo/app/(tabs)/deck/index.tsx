import { useState, useRef, useEffect, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  Pressable,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  Layers, 
  Award,
  ChevronRight,
  BookOpen,
  Mic,
  Volume2,
  Play,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Target,
  Zap,
  ArrowLeft,
  Brain,
  Flame,
  Sparkles,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { USE_NATIVE_DRIVER } from '@/constants/animation';
import { useApp } from '@/contexts/AppContext';
import { useFrenchAudio } from '@/hooks/useFrenchAudio';
import { GapCategory, GapItem } from '@/types';
import { getCategoryStats, categoryLabels } from '@/utils/gapLessonGenerator';
import { classifyGapUrgency, formatUrgencyBadge } from '@/utils/gapScheduler';
import { getSrsSessionCards } from '@/utils/srs';
import MemoryCard from '@/components/MemoryCard';

const categoryColors: Record<GapCategory, string> = {
  vocabulary: Colors.primary,
  grammar: Colors.secondary,
  pronunciation: '#7C3AED',
  phrasing: Colors.warning,
  register: '#10B981',
};

const categoryOrder: GapCategory[] = ['vocabulary', 'grammar', 'pronunciation', 'phrasing', 'register'];

export default function DeckScreen() {
  const router = useRouter();
  const { gaps, activeGaps, masteredGaps, gapsByCategory, refreshGapConcepts, gapSchedule, gapHealth } = useApp();
  const [selectedCategory, setSelectedCategory] = useState<GapCategory | 'all'>('all');
  const [showMastered, setShowMastered] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const { speak } = useFrenchAudio();

  const handleRefreshConcepts = async () => {
    setIsRefreshing(true);
    setRefreshMessage(null);
    try {
      const count = await refreshGapConcepts(true);
      setRefreshMessage(`Refreshed ${count} gap${count !== 1 ? 's' : ''} with new content`);
      setTimeout(() => setRefreshMessage(null), 4000);
    } catch {
      setRefreshMessage('Failed to refresh. Please try again.');
      setTimeout(() => setRefreshMessage(null), 4000);
    } finally {
      setIsRefreshing(false);
    }
  };

  const hasActiveGaps = activeGaps.length > 0;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [fadeAnim]);

  const categoryStats = useMemo(() => getCategoryStats(gaps), [gaps]);

  const displayedGaps = useMemo(() => {
    if (selectedCategory === 'all') {
      return activeGaps;
    }
    return gapsByCategory[selectedCategory];
  }, [selectedCategory, activeGaps, gapsByCategory]);

  const getSourceIcon = (sourceType: string) => {
    if (sourceType === 'reading') return <BookOpen size={12} color={Colors.textMuted} />;
    if (sourceType === 'speech') return <Mic size={12} color={Colors.textMuted} />;
    return <Layers size={12} color={Colors.textMuted} />;
  };

  const handleStartLesson = (category: GapCategory | 'mixed') => {
    router.push(`/gap-lesson?category=${category}`);
  };

  const totalActive = activeGaps.length;
  const totalMastered = masteredGaps.length;
  const criticalCount = gapSchedule.critical.length;
  const dueCount = gapSchedule.due.length;

  const srsCards = useMemo(() => getSrsSessionCards(gaps), [gaps]);
  const hasSrsCards = srsCards.total > 0;

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <Animated.View style={[styles.animatedContainer, { opacity: fadeAnim }]}>
          <LinearGradient
            colors={['#0F766E', '#14B8A6']}
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
              <Text style={styles.title}>My Gaps</Text>
              <Text style={styles.subtitle}>Practice your weak spots until mastery</Text>
              
              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Target size={16} color={Colors.textLight} />
                  <View>
                    <Text style={styles.statValue}>{totalActive}</Text>
                    <Text style={styles.statLabel}>Active</Text>
                  </View>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statBox}>
                  <Award size={16} color={Colors.textLight} />
                  <View>
                    <Text style={styles.statValue}>{totalMastered}</Text>
                    <Text style={styles.statLabel}>Mastered</Text>
                  </View>
                </View>
              </View>
            </View>
            <View style={styles.headerDecoration} />
          </LinearGradient>

          <ScrollView 
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {totalActive > 0 && (
              <Pressable
                style={({ pressed }) => [
                  styles.smartLessonsCard,
                  pressed && styles.srsCardPressed,
                ]}
                onPress={() => router.push('/gap-lessons' as any)}
              >
                <View style={styles.srsCardLeft}>
                  <View style={styles.smartLessonsIcon}>
                    <Sparkles size={20} color="#4338CA" />
                  </View>
                  <View style={styles.srsCardContent}>
                    <Text style={styles.smartLessonsTitle}>Smart Lessons</Text>
                    <Text style={styles.smartLessonsSub}>AI-powered lessons from your gaps</Text>
                  </View>
                </View>
                <ChevronRight size={18} color="#4338CA" />
              </Pressable>
            )}

            {hasSrsCards && (
              <View style={styles.srsReviewSection}>
                <LinearGradient
                  colors={['#312E81', '#4338CA']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.srsReviewGradient}
                >
                  <View style={styles.srsReviewHeader}>
                    <View style={styles.srsReviewIconBg}>
                      <Brain size={22} color="#C7D2FE" />
                    </View>
                    <View style={styles.srsReviewInfo}>
                      <Text style={styles.srsReviewTitle}>Spaced Repetition</Text>
                      <Text style={styles.srsReviewSub}>
                        {srsCards.total} card{srsCards.total !== 1 ? 's' : ''} ready to review
                      </Text>
                    </View>
                    {srsCards.total > 0 && (
                      <View style={styles.srsReviewBadge}>
                        <Text style={styles.srsReviewBadgeText}>{srsCards.total}</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.srsReviewCountsRow}>
                    {srsCards.dueCards.length > 0 && (
                      <View style={styles.srsReviewCountTag}>
                        <Flame size={12} color="#FCD34D" />
                        <Text style={styles.srsReviewCountDue}>{srsCards.dueCards.length} due</Text>
                      </View>
                    )}
                    {srsCards.newCards.length > 0 && (
                      <View style={[styles.srsReviewCountTag, { backgroundColor: 'rgba(96,165,250,0.2)' }]}>
                        <Zap size={12} color="#93C5FD" />
                        <Text style={[styles.srsReviewCountDue, { color: '#93C5FD' }]}>{srsCards.newCards.length} new</Text>
                      </View>
                    )}
                    <Text style={styles.srsReviewEst}>~{Math.max(1, Math.ceil(srsCards.total * 0.4))} min</Text>
                  </View>

                  <Pressable
                    style={({ pressed }) => [
                      styles.srsStartReviewBtn,
                      pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                    ]}
                    onPress={() => router.push('/srs-review' as any)}
                  >
                    <Text style={styles.srsStartReviewText}>Start Review</Text>
                    <ChevronRight size={18} color="#312E81" />
                  </Pressable>
                </LinearGradient>
              </View>
            )}

            {totalActive > 0 && (
              <View style={styles.practiceSection}>
                {(criticalCount > 0 || dueCount > 0) && (
                  <View style={styles.healthRow}>
                    <View style={[
                      styles.healthIndicator,
                      { backgroundColor: gapHealth.score >= 70 ? '#D1FAE5' : gapHealth.score >= 50 ? '#FEF3C7' : '#FEE2E2' },
                    ]}>
                      <View style={[
                        styles.healthDot,
                        { backgroundColor: gapHealth.score >= 70 ? Colors.success : gapHealth.score >= 50 ? '#D97706' : '#DC2626' },
                      ]} />
                      <Text style={[
                        styles.healthLabel,
                        { color: gapHealth.score >= 70 ? '#065F46' : gapHealth.score >= 50 ? '#92400E' : '#991B1B' },
                      ]}>
                        {gapHealth.label}
                      </Text>
                    </View>
                    {criticalCount > 0 && (
                      <View style={styles.urgencyBadgeCritical}>
                        <Text style={styles.urgencyBadgeCriticalText}>{criticalCount} critical</Text>
                      </View>
                    )}
                    {dueCount > 0 && criticalCount === 0 && (
                      <View style={styles.urgencyBadgeDue}>
                        <Text style={styles.urgencyBadgeDueText}>{dueCount} due</Text>
                      </View>
                    )}
                  </View>
                )}

                <Pressable
                  style={({ pressed }) => [
                    styles.startPracticeButton,
                    criticalCount > 0 && styles.startPracticeButtonCritical,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={() => handleStartLesson('mixed')}
                >
                  <View style={styles.practiceButtonIcon}>
                    <Zap size={18} color={Colors.textLight} fill={Colors.textLight} />
                  </View>
                  <View style={styles.practiceButtonContent}>
                    <Text style={styles.practiceButtonTitle}>
                      {criticalCount > 0 ? 'Review Critical Gaps' : 'Start Practice'}
                    </Text>
                    <Text style={styles.practiceButtonDesc}>
                      {criticalCount > 0
                        ? `${criticalCount} gap${criticalCount !== 1 ? 's' : ''} falling behind`
                        : 'Mixed review of all categories'}
                    </Text>
                  </View>
                  <ChevronRight size={20} color={Colors.textLight} />
                </Pressable>
              </View>
            )}

            {hasActiveGaps && (
              <Pressable
                style={[
                  styles.refreshButton,
                  isRefreshing && styles.refreshButtonDisabled,
                ]}
                onPress={handleRefreshConcepts}
                disabled={isRefreshing}
              >
                {isRefreshing ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : (
                  <RefreshCw size={14} color={Colors.primary} />
                )}
                <Text style={styles.refreshButtonText}>
                  {isRefreshing ? 'Generating...' : 'Refresh Questions'}
                </Text>
              </Pressable>
            )}

            {refreshMessage && (
              <View style={styles.refreshMessageContainer}>
                <Text style={styles.refreshMessage}>{refreshMessage}</Text>
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Categories</Text>
              <View style={styles.categoriesGrid}>
                {categoryOrder.map((category) => {
                  const stats = categoryStats[category];
                  const hasGaps = stats.active > 0;
                  
                  return (
                    <Pressable
                      key={category}
                      style={[
                        styles.categoryCard,
                        selectedCategory === category && styles.categoryCardActive,
                        !hasGaps && styles.categoryCardEmpty,
                      ]}
                      onPress={() => setSelectedCategory(selectedCategory === category ? 'all' : category)}
                    >
                      <View style={[styles.categoryIndicator, { backgroundColor: categoryColors[category] }]} />
                      <View style={styles.categoryInfo}>
                        <Text style={[
                          styles.categoryName,
                          selectedCategory === category && styles.categoryNameActive,
                          !hasGaps && styles.categoryNameEmpty,
                        ]}>
                          {categoryLabels[category]}
                        </Text>
                        <Text style={styles.categoryCount}>
                          {stats.active} active · {stats.mastered} mastered
                        </Text>
                      </View>
                      {hasGaps && (
                        <Pressable
                          style={[styles.categoryPlayButton, { backgroundColor: `${categoryColors[category]}15` }]}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleStartLesson(category);
                          }}
                        >
                          <Play size={12} color={categoryColors[category]} fill={categoryColors[category]} />
                        </Pressable>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  {selectedCategory === 'all' ? 'All Gaps' : `${categoryLabels[selectedCategory]}`}
                </Text>
                <Text style={styles.gapsCount}>{displayedGaps.length} gaps</Text>
              </View>

              {displayedGaps.length === 0 ? (
                <View style={styles.emptyState}>
                  <View style={styles.emptyIconContainer}>
                    <Layers size={32} color={Colors.textMuted} />
                  </View>
                  <Text style={styles.emptyTitle}>No gaps yet</Text>
                  <Text style={styles.emptySubtitle}>
                    Add gaps while reading or speaking
                  </Text>
                  <View style={styles.emptyActions}>
                    <Pressable 
                      style={styles.emptyActionButton}
                      onPress={() => router.push('/(tabs)/read')}
                    >
                      <BookOpen size={16} color={Colors.textLight} />
                      <Text style={styles.emptyActionText}>Read</Text>
                    </Pressable>
                    <Pressable 
                      style={[styles.emptyActionButton, styles.emptyActionSecondary]}
                      onPress={() => router.push('/(tabs)/speak')}
                    >
                      <Mic size={16} color={Colors.primary} />
                      <Text style={[styles.emptyActionText, styles.emptyActionTextSecondary]}>Speak</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <View style={styles.gapsList}>
                  {displayedGaps.slice(0, 10).map((gap) => (
                    <GapCard 
                      key={gap.id} 
                      gap={gap} 
                      onSpeak={speak}
                      getSourceIcon={getSourceIcon}
                    />
                  ))}
                  {displayedGaps.length > 10 && (
                    <Text style={styles.moreGapsText}>
                      +{displayedGaps.length - 10} more gaps
                    </Text>
                  )}
                </View>
              )}
            </View>

            {masteredGaps.length > 0 && (
              <View style={styles.masteredSection}>
                <Pressable 
                  style={styles.masteredHeader}
                  onPress={() => setShowMastered(!showMastered)}
                >
                  <View style={styles.masteredHeaderLeft}>
                    <Award size={16} color={Colors.success} />
                    <Text style={styles.masteredTitle}>Mastered ({masteredGaps.length})</Text>
                  </View>
                  {showMastered ? (
                    <ChevronUp size={18} color={Colors.textMuted} />
                  ) : (
                    <ChevronDown size={18} color={Colors.textMuted} />
                  )}
                </Pressable>
                
                {showMastered && (
                  <View style={styles.masteredList}>
                    {masteredGaps.map((gap) => (
                      <View key={gap.id} style={styles.masteredItem}>
                        <Text style={styles.masteredFrench}>{gap.frenchWord}</Text>
                        <Text style={styles.masteredEnglish}>{gap.englishTranslation}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

function GapCard({ 
  gap, 
  onSpeak, 
  getSourceIcon 
}: { 
  gap: GapItem; 
  onSpeak: (text: string) => void;
  getSourceIcon: (type: string) => React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const streakDisplay = `${gap.consecutiveCorrect}/5`;
  const streakProgress = gap.consecutiveCorrect / 5;
  const streakColor = gap.consecutiveCorrect >= 3 ? Colors.success : 
                      gap.consecutiveCorrect >= 1 ? Colors.warning : Colors.border;

  const urgencyInfo = useMemo(() => classifyGapUrgency(gap), [gap]);
  const urgencyBadgeText = formatUrgencyBadge(urgencyInfo.urgency, urgencyInfo.daysOverdue);
  const showUrgencyBadge = urgencyInfo.urgency === 'critical' || urgencyInfo.urgency === 'due';

  const canonicalExamples = gap.conceptData?.canonicalExamples || [];
  const hasMoreContent = gap.explanation || gap.exampleTranslation || canonicalExamples.length > 0;

  return (
    <View style={styles.gapCard}>
      <Pressable 
        onPress={() => setExpanded(!expanded)}
        style={styles.gapCardMain}
      >
        <View style={styles.gapTop}>
          <View style={[styles.gapCategoryDot, { backgroundColor: categoryColors[gap.category] }]} />
          <Text style={styles.gapFrench}>{gap.frenchWord}</Text>
          <View style={styles.gapActions}>
            <Pressable 
              style={styles.audioButton}
              onPress={(e) => {
                e.stopPropagation();
                onSpeak(gap.frenchWord);
              }}
            >
              <Volume2 size={14} color={Colors.primary} />
            </Pressable>
            {hasMoreContent && (
              expanded ? (
                <ChevronUp size={16} color={Colors.textMuted} />
              ) : (
                <ChevronDown size={16} color={Colors.textMuted} />
              )
            )}
          </View>
        </View>
        
        <Text style={styles.gapEnglish}>{gap.englishTranslation}</Text>
        
        <Pressable 
          style={styles.exampleRow}
          onPress={(e) => {
            e.stopPropagation();
            onSpeak(gap.exampleSentence);
          }}
        >
          <Text style={styles.gapExample} numberOfLines={expanded ? undefined : 2}>
            {gap.exampleSentence}
          </Text>
          <Volume2 size={12} color={Colors.textMuted} />
        </Pressable>

        <View style={styles.gapBottom}>
          <View style={styles.gapBottomLeft}>
            <View style={styles.sourceTag}>
              {getSourceIcon(gap.sourceType)}
              <Text style={styles.sourceText}>{gap.sourceType}</Text>
            </View>
            {showUrgencyBadge && (
              <View style={[
                styles.urgencyTag,
                { backgroundColor: `${urgencyInfo.color}15` },
              ]}>
                <View style={[styles.urgencyTagDot, { backgroundColor: urgencyInfo.color }]} />
                <Text style={[styles.urgencyTagText, { color: urgencyInfo.color }]}>
                  {urgencyBadgeText}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.streakContainer}>
            <View style={styles.streakBar}>
              <View style={[styles.streakFill, { width: `${streakProgress * 100}%`, backgroundColor: streakColor }]} />
            </View>
            <Text style={[styles.streakText, { color: streakColor }]}>{streakDisplay}</Text>
          </View>
        </View>
      </Pressable>

      {expanded && (
        <View style={styles.expandedContent}>
          {gap.exampleTranslation && (
            <View style={styles.infoBox}>
              <Text style={styles.infoLabel}>Translation</Text>
              <Text style={styles.infoText}>{gap.exampleTranslation}</Text>
            </View>
          )}

          {gap.explanation && (
            <View style={styles.infoBox}>
              <Text style={styles.infoLabel}>Explanation</Text>
              <Text style={styles.infoText}>{gap.explanation}</Text>
            </View>
          )}

          <MemoryCard gap={gap} />

          {gap.conceptData?.teachingFocus && (
            <View style={[styles.infoBox, styles.conceptBox]}>
              <Text style={styles.infoLabel}>Key concept</Text>
              <Text style={styles.infoText}>{gap.conceptData.teachingFocus}</Text>
            </View>
          )}

          {canonicalExamples.length > 0 && (
            <View style={styles.examplesSection}>
              <Text style={styles.infoLabel}>More examples</Text>
              {canonicalExamples.map((example, index) => (
                <Pressable 
                  key={index} 
                  style={styles.exampleItem}
                  onPress={() => onSpeak(example.french)}
                >
                  <View style={styles.exampleItemRow}>
                    <Text style={styles.exampleFrench}>{example.french}</Text>
                    <Volume2 size={12} color={Colors.primary} />
                  </View>
                  <Text style={styles.exampleEnglish}>{example.english}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      )}
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
    left: -30,
    bottom: -20,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
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
    paddingVertical: 12,
    borderRadius: 12,
    gap: 20,
  },
  statBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textLight,
  },
  statLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.75)',
    marginTop: -2,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  practiceSection: {
    marginBottom: 12,
    gap: 10,
  },
  healthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  healthIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  healthDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  healthLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  urgencyBadgeCritical: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  urgencyBadgeCriticalText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#DC2626',
  },
  urgencyBadgeDue: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  urgencyBadgeDueText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#D97706',
  },
  startPracticeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 14,
    padding: 16,
    gap: 14,
  },
  startPracticeButtonCritical: {
    backgroundColor: '#DC2626',
  },
  buttonPressed: {
    opacity: 0.9,
  },
  practiceButtonIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  practiceButtonContent: {
    flex: 1,
  },
  practiceButtonTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textLight,
  },
  practiceButtonDesc: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: 10,
    paddingVertical: 10,
    gap: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  refreshButtonDisabled: {
    opacity: 0.6,
  },
  refreshButtonText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '500',
  },
  refreshMessageContainer: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: Colors.successLight,
    borderRadius: 8,
  },
  refreshMessage: {
    color: Colors.success,
    fontSize: 13,
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 12,
  },
  gapsCount: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  categoriesGrid: {
    gap: 8,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  categoryCardActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  categoryCardEmpty: {
    opacity: 0.5,
  },
  categoryIndicator: {
    width: 4,
    height: 28,
    borderRadius: 2,
    marginRight: 12,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  categoryNameActive: {
    color: Colors.primaryDark,
  },
  categoryNameEmpty: {
    color: Colors.textMuted,
  },
  categoryCount: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  categoryPlayButton: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textMuted,
    marginBottom: 20,
  },
  emptyActions: {
    flexDirection: 'row',
    gap: 12,
  },
  emptyActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  emptyActionSecondary: {
    backgroundColor: Colors.primaryLight,
  },
  emptyActionText: {
    color: Colors.textLight,
    fontSize: 14,
    fontWeight: '600',
  },
  emptyActionTextSecondary: {
    color: Colors.primary,
  },
  gapsList: {
    gap: 10,
  },
  gapCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  gapCardMain: {
    padding: 14,
  },
  gapTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  gapCategoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
  },
  gapFrench: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: Colors.primary,
  },
  gapActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  audioButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gapEnglish: {
    fontSize: 14,
    color: Colors.text,
    marginBottom: 10,
    marginLeft: 18,
  },
  exampleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: Colors.background,
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  gapExample: {
    flex: 1,
    fontSize: 13,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  gapBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gapBottomLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  urgencyTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  urgencyTagDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  urgencyTagText: {
    fontSize: 10,
    fontWeight: '600' as const,
  },
  sourceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sourceText: {
    fontSize: 11,
    color: Colors.textMuted,
    textTransform: 'capitalize',
  },
  streakContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  streakBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    overflow: 'hidden',
  },
  streakFill: {
    height: '100%',
    borderRadius: 2,
  },
  streakText: {
    fontSize: 11,
    fontWeight: '600',
  },
  expandedContent: {
    padding: 14,
    paddingTop: 0,
    gap: 10,
  },
  infoBox: {
    backgroundColor: Colors.background,
    borderRadius: 8,
    padding: 10,
  },
  conceptBox: {
    backgroundColor: Colors.primaryLight,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  infoText: {
    fontSize: 13,
    color: Colors.text,
    lineHeight: 18,
  },
  examplesSection: {
    gap: 8,
  },
  exampleItem: {
    backgroundColor: Colors.background,
    borderRadius: 8,
    padding: 10,
  },
  exampleItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  exampleFrench: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.primary,
  },
  exampleEnglish: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  moreGapsText: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingVertical: 12,
  },
  masteredSection: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 14,
    overflow: 'hidden',
  },
  masteredHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  masteredHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  masteredTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  masteredList: {
    padding: 14,
    paddingTop: 0,
    gap: 8,
  },
  masteredItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  masteredFrench: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.success,
  },
  masteredEnglish: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  srsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F5F3FF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E9E5FF',
  },
  srsCardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  srsCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  srsIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  srsCardContent: {
    flex: 1,
  },
  srsCardTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#5B21B6',
    marginBottom: 4,
  },
  srsCountsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  srsCountTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  srsCountDue: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#D97706',
  },
  smartLessonsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EEF2FF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  smartLessonsIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#DDD6FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  smartLessonsTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#3730A3',
    marginBottom: 2,
  },
  smartLessonsSub: {
    fontSize: 12,
    color: '#6366F1',
  },
  srsReviewSection: {
    marginBottom: 14,
    borderRadius: 16,
    overflow: 'hidden',
  },
  srsReviewGradient: {
    padding: 18,
    borderRadius: 16,
  },
  srsReviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  srsReviewIconBg: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(199,210,254,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  srsReviewInfo: {
    flex: 1,
  },
  srsReviewTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: '#E0E7FF',
    marginBottom: 2,
  },
  srsReviewSub: {
    fontSize: 13,
    color: '#A5B4FC',
  },
  srsReviewBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  srsReviewBadgeText: {
    fontSize: 13,
    fontWeight: '800' as const,
    color: '#FFF',
  },
  srsReviewCountsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  srsReviewCountTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(252,211,77,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  srsReviewCountDue: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#FCD34D',
  },
  srsReviewEst: {
    fontSize: 12,
    color: '#A5B4FC',
    marginLeft: 'auto' as const,
  },
  srsStartReviewBtn: {
    backgroundColor: '#E0E7FF',
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  srsStartReviewText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#312E81',
  },
});
