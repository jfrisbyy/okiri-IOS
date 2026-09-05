import React, { useState, useRef, useCallback, useEffect } from 'react';
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
  Dimensions,
} from 'react-native';
import { useRouter, useNavigation } from 'expo-router';
import { safeGoBack } from '@/utils/navigation';
import {
  ArrowLeft,
  Globe,
  Volume2,
  Mic,
  Square,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  MapPin,
  Users,
  BookOpen,
  Zap,
  Target,
  BarChart3,
  RefreshCw,
  Info,
  AudioLines,
  Languages,
  Ear,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { USE_NATIVE_DRIVER } from '@/constants/animation';
import Colors from '@/constants/colors';
import {
  frenchRegions,
  comparisonPhrases,
  FrenchRegionId,
  FrenchRegion,
} from '@/data/regionalAccents';
import { playRegionalAudio, stopRegionalAudio } from '@/utils/azureRegionalTTS';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useAccent } from '@/contexts/AccentContext';
import { Check, Sparkles, TrendingUp, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react-native';
import type { AccentEvaluationResult } from '@/utils/accentEvaluation';
import { evaluateAccentWithGPT4o } from '@/utils/gpt4oAccentEvaluation';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type TabId = 'overview' | 'compare' | 'practice';

export default function AccentExplorerScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { selectedAccentId, selectAccent, hasSelectedAccent } = useAccent();

  const [selectedRegion, setSelectedRegion] = useState<FrenchRegion>(frenchRegions[0]);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [expandedSoundId, setExpandedSoundId] = useState<string | null>(null);
  const [expandedVocabId, setExpandedVocabId] = useState<string | null>(null);
  const [practiceWordIndex, setPracticeWordIndex] = useState(0);
  const [accentEval, setAccentEval] = useState<AccentEvaluationResult | null>(null);
  const [isEvaluatingAccent, setIsEvaluatingAccent] = useState(false);
  const [expandedFeatureId, setExpandedFeatureId] = useState<string | null>(null);

  const {
    isRecording,
    isStopping,
    error: recorderError,
    startRecording,
    stopRecording,
    reset: resetRecorder,
  } = useAudioRecorder();

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const tabSlideAnim = useRef(new Animated.Value(0)).current;

  React.useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 600, useNativeDriver: USE_NATIVE_DRIVER }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: USE_NATIVE_DRIVER }),
        ]),
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording, pulseAnim]);

  const handlePlayRegional = useCallback(async (text: string, regionId: FrenchRegionId, itemId: string) => {
    if (playingId === itemId) {
      await stopRegionalAudio();
      setPlayingId(null);
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPlayingId(itemId);

    try {
      await playRegionalAudio(
        { regionId, text, voiceGender: 'female', rate: '-10%' },
        undefined,
        () => setPlayingId(null),
      );
    } catch (err) {
      console.log('[AccentExplorer] Play error:', err);
      setPlayingId(null);
    }
  }, [playingId]);

  const handleStartRecording = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await startRecording();
  }, [startRecording]);

  const handleStopRecording = useCallback(async () => {
    const currentWord = selectedRegion.practiceWords[practiceWordIndex];
    if (!currentWord) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const audioResult = await stopRecording();
    if (!audioResult) {
      console.warn('[AccentExplorer] No audio captured');
      return;
    }

    setIsEvaluatingAccent(true);
    try {
      console.log('[AccentExplorer] Starting direct audio accent evaluation...');
      const evalResult = await evaluateAccentWithGPT4o(
        audioResult.base64,
        audioResult.mimeType,
        selectedRegion,
        currentWord.word,
        currentWord.ipa,
      );
      setAccentEval(evalResult);
      console.log('[AccentExplorer] Accent eval complete:', evalResult.accentMatchScore);
    } catch (err: any) {
      console.error('[AccentExplorer] Accent eval error:', err?.message);
    } finally {
      setIsEvaluatingAccent(false);
    }
  }, [stopRecording, selectedRegion, practiceWordIndex]);

  const handleSelectRegion = useCallback((region: FrenchRegion) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedRegion(region);
    setPracticeWordIndex(0);
    resetRecorder();
    setAccentEval(null);
    setExpandedSoundId(null);
    setExpandedVocabId(null);
    setExpandedFeatureId(null);
  }, [resetRecorder]);

  const handleConfirmAccent = useCallback(async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await selectAccent(selectedRegion.id);
  }, [selectAccent, selectedRegion]);

  const handleTabSwitch = useCallback((tab: TabId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTab(tab);
    resetRecorder();
    setAccentEval(null);
    setIsEvaluatingAccent(false);
    setExpandedFeatureId(null);
  }, [resetRecorder]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#10B981';
    if (score >= 60) return '#F59E0B';
    return '#EF4444';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 90) return 'Excellent!';
    if (score >= 80) return 'Great!';
    if (score >= 70) return 'Good';
    if (score >= 60) return 'Fair';
    return 'Keep trying';
  };

  const renderTabs = () => (
    <View style={styles.tabBar}>
      {([
        { id: 'overview' as const, label: 'Overview', icon: <Globe size={14} color={activeTab === 'overview' ? '#FFFFFF' : Colors.textSecondary} /> },
        { id: 'compare' as const, label: 'Compare', icon: <Languages size={14} color={activeTab === 'compare' ? '#FFFFFF' : Colors.textSecondary} /> },
        { id: 'practice' as const, label: 'Practice', icon: <Mic size={14} color={activeTab === 'practice' ? '#FFFFFF' : Colors.textSecondary} /> },
      ]).map((tab) => (
        <Pressable
          key={tab.id}
          style={[
            styles.tabButton,
            activeTab === tab.id && { backgroundColor: selectedRegion.color },
          ]}
          onPress={() => handleTabSwitch(tab.id)}
        >
          {tab.icon}
          <Text style={[styles.tabLabel, activeTab === tab.id && styles.tabLabelActive]}>
            {tab.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );

  const renderOverviewTab = () => (
    <View style={styles.tabContent}>
      <View style={[styles.regionHero, { borderLeftColor: selectedRegion.color }]}>
        <Text style={styles.heroFlag}>{selectedRegion.flag}</Text>
        <View style={styles.heroInfo}>
          <Text style={styles.heroName}>{selectedRegion.name}</Text>
          <View style={styles.heroMeta}>
            <MapPin size={12} color={Colors.textMuted} />
            <Text style={styles.heroMetaText}>
              {selectedRegion.spokenIn.slice(0, 3).join(', ')}
              {selectedRegion.spokenIn.length > 3 ? ` +${selectedRegion.spokenIn.length - 3}` : ''}
            </Text>
          </View>
          <View style={styles.heroMeta}>
            <Users size={12} color={Colors.textMuted} />
            <Text style={styles.heroMetaText}>{selectedRegion.speakerCount} speakers</Text>
          </View>
        </View>
      </View>

      <Text style={styles.descriptionText}>{selectedRegion.description}</Text>

      <Pressable
        style={({ pressed }) => [
          styles.selectAccentBtn,
          { backgroundColor: selectedRegion.color },
          selectedAccentId === selectedRegion.id && styles.selectAccentBtnSelected,
          pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
        ]}
        onPress={handleConfirmAccent}
        testID="select-accent-btn"
      >
        {selectedAccentId === selectedRegion.id ? (
          <>
            <Check size={18} color="#FFFFFF" />
            <Text style={styles.selectAccentBtnText}>Your Active Accent</Text>
          </>
        ) : (
          <>
            <Globe size={18} color="#FFFFFF" />
            <Text style={styles.selectAccentBtnText}>Use {selectedRegion.shortName} Accent</Text>
          </>
        )}
      </Pressable>

      {selectedRegion.accentIdentity ? (
        <View style={[styles.accentIdentityCard, { borderLeftColor: selectedRegion.color }]}>
          <View style={styles.accentIdentityHeader}>
            <Ear size={15} color={selectedRegion.color} />
            <Text style={[styles.accentIdentityTitle, { color: selectedRegion.color }]}>What Makes It Stand Out</Text>
          </View>
          <Text style={styles.accentIdentityText}>{selectedRegion.accentIdentity}</Text>
        </View>
      ) : null}

      <Text style={styles.sectionLabel}>Characteristic Sounds</Text>
      {selectedRegion.characteristicSounds.map((sound) => {
        const isExpanded = expandedSoundId === sound.id;
        return (
          <Pressable
            key={sound.id}
            style={styles.soundCard}
            onPress={() => setExpandedSoundId(isExpanded ? null : sound.id)}
          >
            <View style={styles.soundCardHeader}>
              <View style={[styles.soundBadge, { backgroundColor: selectedRegion.color + '18' }]}>
                <Text style={[styles.soundIpa, { color: selectedRegion.color }]}>{sound.ipa}</Text>
              </View>
              <View style={styles.soundInfo}>
                <Text style={styles.soundName}>{sound.sound}</Text>
                <Text style={styles.soundDesc} numberOfLines={isExpanded ? undefined : 2}>{sound.description}</Text>
              </View>
              {isExpanded ? <ChevronUp size={18} color={Colors.textMuted} /> : <ChevronDown size={18} color={Colors.textMuted} />}
            </View>
            {isExpanded && sound.examples.length > 0 && (
              <View style={styles.soundExamples}>
                {sound.examples.map((ex, i) => (
                  <View key={i} style={styles.soundExampleRow}>
                    <Text style={styles.soundExampleWord}>{ex.word}</Text>
                    <View style={styles.soundExampleCompare}>
                      <Text style={styles.soundExampleLabel}>Standard:</Text>
                      <Text style={styles.soundExampleIpa}>{ex.standardPronunciation}</Text>
                    </View>
                    <View style={styles.soundExampleCompare}>
                      <Text style={[styles.soundExampleLabel, { color: selectedRegion.color }]}>Regional:</Text>
                      <Text style={[styles.soundExampleIpa, { color: selectedRegion.color }]}>{ex.regionalPronunciation}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </Pressable>
        );
      })}

      <Text style={styles.sectionLabel}>Regional Vocabulary</Text>
      {selectedRegion.uniqueVocabulary.map((vocab) => {
        const isExpanded = expandedVocabId === vocab.id;
        return (
          <Pressable
            key={vocab.id}
            style={styles.vocabCard}
            onPress={() => {
              setExpandedVocabId(isExpanded ? null : vocab.id);
            }}
          >
            <View style={styles.vocabRow}>
              <View style={styles.vocabMain}>
                <Text style={[styles.vocabRegional, { color: selectedRegion.color }]}>{vocab.regional}</Text>
                <Text style={styles.vocabEnglish}>{vocab.english}</Text>
              </View>
              <Pressable
                style={[styles.vocabPlayBtn, { backgroundColor: selectedRegion.color + '15' }]}
                onPress={(e) => {
                  e.stopPropagation?.();
                  handlePlayRegional(vocab.regional, selectedRegion.id, vocab.id);
                }}
              >
                <Volume2 size={16} color={playingId === vocab.id ? Colors.textMuted : selectedRegion.color} />
              </Pressable>
            </View>
            {isExpanded && (
              <View style={styles.vocabDetail}>
                {vocab.standard !== vocab.regional && (
                  <Text style={styles.vocabStandard}>Standard: {vocab.standard}</Text>
                )}
                <Text style={styles.vocabNote}>{vocab.note}</Text>
              </View>
            )}
          </Pressable>
        );
      })}

      <Text style={styles.sectionLabel}>Cultural Notes</Text>
      <View style={styles.culturalNotesCard}>
        {selectedRegion.culturalNotes.map((note, i) => (
          <View key={i} style={styles.culturalNoteRow}>
            <View style={[styles.culturalDot, { backgroundColor: selectedRegion.color }]} />
            <Text style={styles.culturalNoteText}>{note}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  const renderCompareTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.compareBanner}>
        <Ear size={18} color={selectedRegion.color} />
        <Text style={styles.compareBannerText}>
          Hear the same phrase in different accents
        </Text>
      </View>

      {comparisonPhrases.map((phrase) => (
        <View key={phrase.id} style={styles.compareCard}>
          <View style={styles.compareCardHeader}>
            <Text style={styles.compareFrench}>{phrase.french}</Text>
            <Text style={styles.compareEnglish}>{phrase.english}</Text>
          </View>

          <View style={styles.compareAccents}>
            {frenchRegions.filter(r => phrase.ipa[r.id]).map((region) => (
              <Pressable
                key={region.id}
                style={[
                  styles.compareAccentRow,
                  selectedRegion.id === region.id && { backgroundColor: region.color + '08', borderLeftColor: region.color, borderLeftWidth: 3 },
                ]}
                onPress={() => handlePlayRegional(phrase.french, region.id, `${phrase.id}-${region.id}`)}
              >
                <Text style={styles.compareAccentFlag}>{region.flag}</Text>
                <View style={styles.compareAccentInfo}>
                  <Text style={[
                    styles.compareAccentName,
                    selectedRegion.id === region.id && { fontWeight: '700' as const, color: region.color },
                  ]}>
                    {region.shortName}
                  </Text>
                  <Text style={styles.compareAccentIpa}>{phrase.ipa[region.id]}</Text>
                </View>
                <View
                  style={[
                    styles.comparePlayBtn,
                    playingId === `${phrase.id}-${region.id}` && { backgroundColor: region.color },
                  ]}
                >
                  <Volume2
                    size={14}
                    color={playingId === `${phrase.id}-${region.id}` ? '#FFFFFF' : region.color}
                  />
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      ))}
    </View>
  );

  const renderPracticeTab = () => {
    const currentWord = selectedRegion.practiceWords[practiceWordIndex];
    if (!currentWord) return null;

    return (
      <View style={styles.tabContent}>
        <View style={styles.practiceBanner}>
          <AudioLines size={16} color={selectedRegion.color} />
          <Text style={styles.practiceBannerText}>
            Practice the {selectedRegion.shortName} accent
          </Text>
          <View style={[styles.localeBadge, { backgroundColor: selectedRegion.color + '15' }]}>
            <Text style={[styles.localeText, { color: selectedRegion.color }]}>{selectedRegion.azureLocale}</Text>
          </View>
        </View>

        <View style={styles.practiceProgress}>
          {selectedRegion.practiceWords.map((_, i) => (
            <View
              key={i}
              style={[
                styles.practiceProgressDot,
                i === practiceWordIndex && { backgroundColor: selectedRegion.color, transform: [{ scale: 1.3 }] },
                i < practiceWordIndex && { backgroundColor: selectedRegion.color + '50' },
              ]}
            />
          ))}
        </View>

        <View style={[styles.practiceWordCard, { borderColor: selectedRegion.color }]}>
          <View style={[styles.practiceWordHeader, { backgroundColor: selectedRegion.color }]}>
            <Text style={styles.practiceWordCount}>
              {practiceWordIndex + 1} / {selectedRegion.practiceWords.length}
            </Text>
            <Text style={styles.practiceRegionLabel}>{selectedRegion.shortName} Accent</Text>
          </View>

          <View style={styles.practiceWordBody}>
            <Text style={styles.practiceMainWord} adjustsFontSizeToFit numberOfLines={4}>{currentWord.word}</Text>
            <Text style={[styles.practiceIpa, { color: selectedRegion.color }]} numberOfLines={3} adjustsFontSizeToFit>{currentWord.ipa}</Text>
            <Text style={styles.practiceTranslation} numberOfLines={3}>{currentWord.translation}</Text>

            <View style={styles.practiceHintBox}>
              <Info size={13} color={selectedRegion.color} />
              <Text style={[styles.practiceHintText, { color: selectedRegion.color }]}>{currentWord.audioHint}</Text>
            </View>

            <Pressable
              style={[styles.practiceListenBtn, { backgroundColor: selectedRegion.color }]}
              onPress={() => handlePlayRegional(currentWord.word, selectedRegion.id, `practice-${practiceWordIndex}`)}
              disabled={playingId === `practice-${practiceWordIndex}`}
            >
              <Volume2 size={18} color="#FFFFFF" />
              <Text style={styles.practiceListenText}>
                {playingId === `practice-${practiceWordIndex}` ? 'Playing...' : 'Listen to Regional Accent'}
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.recordSection}>
          {isStopping || isEvaluatingAccent ? (
            <View style={styles.analyzingContainer}>
              <ActivityIndicator size="large" color={selectedRegion.color} />
              <Text style={styles.analyzingText}>
                {isStopping ? 'Processing recording...' : 'Evaluating your accent...'}
              </Text>
              {isEvaluatingAccent && (
                <Text style={styles.analyzingSubtext}>AI is listening to and comparing your accent against native {selectedRegion.shortName} speakers</Text>
              )}
            </View>
          ) : isRecording ? (
            <View style={styles.recordingContainer}>
              <Animated.View style={[styles.recordingPulse, { transform: [{ scale: pulseAnim }] }]}>
                <Pressable
                  style={[styles.stopButton, { backgroundColor: '#EF4444' }]}
                  onPress={handleStopRecording}
                >
                  <Square size={28} color="#FFFFFF" fill="#FFFFFF" />
                </Pressable>
              </Animated.View>
              <Text style={styles.recordingText}>Recording... Tap to stop</Text>
            </View>
          ) : (
            <Pressable
              style={({ pressed }) => [
                styles.recordButton,
                pressed && { transform: [{ scale: 0.95 }] },
              ]}
              onPress={handleStartRecording}
            >
              <View style={[styles.recordButtonInner, { backgroundColor: selectedRegion.color }]}>
                <Mic size={28} color="#FFFFFF" />
                <Text style={styles.recordButtonText}>Tap to Record</Text>
              </View>
            </Pressable>
          )}
        </View>

        {recorderError ? (
          <View style={styles.errorBox}>
            <Info size={16} color="#EF4444" />
            <Text style={styles.errorText}>{recorderError}</Text>
            <Pressable
              style={styles.errorRetryBtn}
              onPress={() => {
                resetRecorder();
              }}
            >
              <RefreshCw size={14} color="#EF4444" />
              <Text style={styles.errorRetryText}>Try Again</Text>
            </Pressable>
          </View>
        ) : null}

        {accentEval && renderAccentResults(accentEval)}

        <View style={styles.practiceNav}>
          <Pressable
            style={[styles.practiceNavBtn, practiceWordIndex === 0 && styles.practiceNavBtnDisabled]}
            onPress={() => {
              if (practiceWordIndex > 0) {
                setPracticeWordIndex(practiceWordIndex - 1);
                resetRecorder();
                setAccentEval(null);
                setExpandedFeatureId(null);
              }
            }}
            disabled={practiceWordIndex === 0}
          >
            <ArrowLeft size={18} color={practiceWordIndex === 0 ? Colors.textMuted : selectedRegion.color} />
            <Text style={[styles.practiceNavText, practiceWordIndex === 0 && { color: Colors.textMuted }]}>Previous</Text>
          </Pressable>

          <Pressable
            style={[styles.practiceNavBtn, practiceWordIndex === selectedRegion.practiceWords.length - 1 && styles.practiceNavBtnDisabled]}
            onPress={() => {
              if (practiceWordIndex < selectedRegion.practiceWords.length - 1) {
                setPracticeWordIndex(practiceWordIndex + 1);
                resetRecorder();
                setAccentEval(null);
                setExpandedFeatureId(null);
              }
            }}
            disabled={practiceWordIndex === selectedRegion.practiceWords.length - 1}
          >
            <Text style={[styles.practiceNavText, practiceWordIndex === selectedRegion.practiceWords.length - 1 && { color: Colors.textMuted }]}>Next</Text>
            <ChevronRight size={18} color={practiceWordIndex === selectedRegion.practiceWords.length - 1 ? Colors.textMuted : selectedRegion.color} />
          </Pressable>
        </View>
      </View>
    );
  };

  const renderScoreBar = (label: string, score: number, icon: React.ReactNode) => (
    <View style={styles.scoreBarRow}>
      <View style={styles.scoreBarLabel}>
        {icon}
        <Text style={styles.scoreBarLabelText}>{label}</Text>
      </View>
      <View style={styles.scoreBarTrack}>
        <View
          style={[
            styles.scoreBarFill,
            { width: `${Math.min(100, Math.max(0, score))}%`, backgroundColor: getScoreColor(score) },
          ]}
        />
      </View>
      <Text style={[styles.scoreBarValue, { color: getScoreColor(score) }]}>{Math.round(score)}</Text>
    </View>
  );

  const getAccentScoreColor = (score: number) => {
    if (score >= 75) return '#10B981';
    if (score >= 50) return '#F59E0B';
    if (score >= 25) return '#F97316';
    return '#EF4444';
  };

  const getAccentScoreEmoji = (score: number) => {
    if (score >= 75) return '🎯';
    if (score >= 50) return '👍';
    if (score >= 25) return '💪';
    return '🎧';
  };

  const renderAccentResults = (evalResult: AccentEvaluationResult) => (
    <View style={styles.accentResultCard}>
      <View style={styles.accentResultHeader}>
        <Sparkles size={18} color={selectedRegion.color} />
        <Text style={[styles.accentResultTitle, { color: selectedRegion.color }]}>Accent Analysis</Text>
        <View style={[styles.accentBadge, { backgroundColor: selectedRegion.color + '15' }]}>
          <Text style={[styles.accentBadgeText, { color: selectedRegion.color }]}>{selectedRegion.shortName}</Text>
        </View>
      </View>

      <View style={[styles.accentScoreCircle, { borderColor: getAccentScoreColor(evalResult.accentMatchScore) }]}>
        <Text style={styles.accentScoreEmoji}>{getAccentScoreEmoji(evalResult.accentMatchScore)}</Text>
        <Text style={[styles.accentScoreNum, { color: getAccentScoreColor(evalResult.accentMatchScore) }]}>
          {Math.round(evalResult.accentMatchScore)}
        </Text>
        <Text style={[styles.accentScoreSubLabel, { color: getAccentScoreColor(evalResult.accentMatchScore) }]}>
          {evalResult.accentLabel}
        </Text>
      </View>

      <Text style={styles.accentOverallFeedback}>{evalResult.overallFeedback}</Text>

      {evalResult.featureScores.length > 0 && (
        <View style={styles.featureSection}>
          <Text style={styles.featureSectionTitle}>Accent Feature Breakdown</Text>
          {evalResult.featureScores.map((fs, i) => {
            const featureKey = `${fs.feature}-${i}`;
            const isExpanded = expandedFeatureId === featureKey;
            return (
              <Pressable
                key={featureKey}
                style={[styles.featureRow, { borderLeftColor: getAccentScoreColor(fs.score) }]}
                onPress={() => setExpandedFeatureId(isExpanded ? null : featureKey)}
              >
                <View style={styles.featureRowHeader}>
                  {fs.detected ? (
                    <CheckCircle2 size={16} color="#10B981" />
                  ) : (
                    <XCircle size={16} color="#EF4444" />
                  )}
                  <Text style={styles.featureName}>{fs.feature}</Text>
                  <Text style={[styles.featureScore, { color: getAccentScoreColor(fs.score) }]}>
                    {Math.round(fs.score)}%
                  </Text>
                </View>
                {isExpanded && (
                  <Text style={styles.featureFeedback}>{fs.feedback}</Text>
                )}
              </Pressable>
            );
          })}
        </View>
      )}

      {evalResult.strongPoints.length > 0 && (
        <View style={styles.pointsSection}>
          <View style={styles.pointsHeader}>
            <TrendingUp size={14} color="#10B981" />
            <Text style={[styles.pointsTitle, { color: '#10B981' }]}>Strong Points</Text>
          </View>
          {evalResult.strongPoints.map((point, i) => (
            <Text key={i} style={styles.pointText}>• {point}</Text>
          ))}
        </View>
      )}

      {evalResult.weakPoints.length > 0 && (
        <View style={styles.pointsSection}>
          <View style={styles.pointsHeader}>
            <AlertTriangle size={14} color="#F59E0B" />
            <Text style={[styles.pointsTitle, { color: '#F59E0B' }]}>Areas to Improve</Text>
          </View>
          {evalResult.weakPoints.map((point, i) => (
            <Text key={i} style={styles.pointText}>• {point}</Text>
          ))}
        </View>
      )}

      {evalResult.detailedTips.length > 0 && (
        <View style={[styles.tipsSection, { backgroundColor: selectedRegion.color + '08', borderLeftColor: selectedRegion.color }]}>
          <Text style={[styles.tipsTitle, { color: selectedRegion.color }]}>Tips for {selectedRegion.shortName} Accent</Text>
          {evalResult.detailedTips.map((tip, i) => (
            <Text key={i} style={styles.tipText}>→ {tip}</Text>
          ))}
        </View>
      )}

      <Pressable
        style={[styles.retryBtn, { borderColor: selectedRegion.color }]}
        onPress={() => {
          resetRecorder();
          setAccentEval(null);
          setExpandedFeatureId(null);
        }}
      >
        <RefreshCw size={16} color={selectedRegion.color} />
        <Text style={[styles.retryText, { color: selectedRegion.color }]}>Try Again</Text>
      </Pressable>
    </View>
  );

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={() => safeGoBack()} style={styles.backButton}>
            <ArrowLeft size={22} color={Colors.text} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Globe size={18} color={selectedRegion.color} />
            <Text style={styles.headerTitle}>Accent Explorer</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.regionScroll}
        >
          {frenchRegions.map((region) => {
            const isActive = selectedRegion.id === region.id;
            const isSavedAccent = selectedAccentId === region.id;
            return (
              <Pressable
                key={region.id}
                style={[styles.regionChip, isActive && { backgroundColor: region.color }]}
                onPress={() => handleSelectRegion(region)}
              >
                {isSavedAccent && <Check size={10} color={isActive ? '#FFFFFF' : region.color} />}
                <Text style={styles.regionFlag}>{region.flag}</Text>
                <Text style={[styles.regionChipName, isActive && styles.regionChipNameActive]}>
                  {region.shortName}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </SafeAreaView>

      {renderTabs()}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'overview' && renderOverviewTab()}
        {activeTab === 'compare' && renderCompareTab()}
        {activeTab === 'practice' && renderPracticeTab()}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAF9',
  },
  safeArea: {
    backgroundColor: '#FAFAF9',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  regionScroll: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 6,
  },
  regionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: '#EEEEED',
  },
  regionFlag: {
    fontSize: 12,
  },
  regionChipName: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  regionChipNameActive: {
    color: '#FFFFFF',
  },
  selectAccentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  selectAccentBtnSelected: {
    opacity: 0.85,
  },
  selectAccentBtnText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    backgroundColor: '#F0F0EE',
    borderRadius: 12,
    padding: 3,
    marginBottom: 12,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
    borderRadius: 10,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  tabLabelActive: {
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  tabContent: {
    gap: 16,
  },
  regionHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  heroFlag: {
    fontSize: 42,
  },
  heroInfo: {
    flex: 1,
    gap: 4,
  },
  heroName: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  heroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  heroMetaText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  descriptionText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 21,
  },
  accentIdentityCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  accentIdentityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  accentIdentityTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
  },
  accentIdentityText: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.text,
    marginTop: 4,
  },
  soundCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  soundCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  soundBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  soundIpa: {
    fontSize: 16,
    fontWeight: '700' as const,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  soundInfo: {
    flex: 1,
  },
  soundName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 3,
  },
  soundDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  soundExamples: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0EE',
    gap: 10,
  },
  soundExampleRow: {
    gap: 4,
  },
  soundExampleWord: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  soundExampleCompare: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  soundExampleLabel: {
    fontSize: 11,
    fontWeight: '500' as const,
    color: Colors.textMuted,
    width: 65,
  },
  soundExampleIpa: {
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: Colors.text,
  },
  vocabCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  vocabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  vocabMain: {
    flex: 1,
    gap: 2,
  },
  vocabRegional: {
    fontSize: 16,
    fontWeight: '700' as const,
  },
  vocabEnglish: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  vocabPlayBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vocabDetail: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0F0EE',
    gap: 4,
  },
  vocabStandard: {
    fontSize: 13,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  vocabNote: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  culturalNotesCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  culturalNoteRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  culturalDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
  },
  culturalNoteText: {
    flex: 1,
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
  },
  compareBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
  },
  compareBannerText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.text,
    flex: 1,
  },
  compareCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  compareCardHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F4',
  },
  compareFrench: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 5,
    lineHeight: 22,
  },
  compareEnglish: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  compareAccents: {
    padding: 4,
  },
  compareAccentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  compareAccentFlag: {
    fontSize: 20,
  },
  compareAccentInfo: {
    flex: 1,
    gap: 1,
  },
  compareAccentName: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  compareAccentIpa: {
    fontSize: 12,
    color: Colors.textMuted,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  comparePlayBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F4',
  },
  practiceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
  },
  practiceBannerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  localeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  localeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  practiceProgress: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  practiceProgressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E5E5E5',
  },
  practiceWordCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 2,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  practiceWordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  practiceWordCount: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.85)',
  },
  practiceRegionLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  practiceWordBody: {
    padding: 24,
    alignItems: 'center',
  },
  practiceMainWord: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 8,
    textAlign: 'center' as const,
    lineHeight: 26,
  },
  practiceIpa: {
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 8,
    textAlign: 'center' as const,
    lineHeight: 19,
  },
  practiceTranslation: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 14,
    textAlign: 'center' as const,
    lineHeight: 20,
  },
  practiceHintBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FAFAF9',
    padding: 12,
    borderRadius: 10,
    width: '100%',
    marginBottom: 16,
  },
  practiceHintText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  practiceListenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 22,
  },
  practiceListenText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  recordSection: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  recordButton: {
    borderRadius: 70,
    overflow: 'hidden',
  },
  recordButtonInner: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordButtonText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    marginTop: 6,
  },
  recordingContainer: {
    alignItems: 'center',
  },
  recordingPulse: {
    marginBottom: 10,
  },
  stopButton: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordingText: {
    fontSize: 13,
    color: '#EF4444',
    fontWeight: '500' as const,
  },
  analyzingContainer: {
    alignItems: 'center',
    padding: 30,
  },
  analyzingText: {
    marginTop: 14,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  resultCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  resultScoreCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  resultScoreNum: {
    fontSize: 36,
    fontWeight: '700' as const,
  },
  resultScoreLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: -2,
  },
  scoreBreakdown: {
    width: '100%',
    gap: 8,
    marginBottom: 16,
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
    width: 105,
  },
  scoreBarLabelText: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  scoreBarTrack: {
    flex: 1,
    height: 7,
    backgroundColor: '#F0F0EE',
    borderRadius: 4,
    overflow: 'hidden',
  },
  scoreBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  scoreBarValue: {
    fontSize: 12,
    fontWeight: '700' as const,
    width: 28,
    textAlign: 'right' as const,
  },
  recognizedBox: {
    backgroundColor: '#FAFAF9',
    padding: 12,
    borderRadius: 10,
    width: '100%',
    marginBottom: 12,
  },
  recognizedLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    marginBottom: 3,
  },
  recognizedValue: {
    fontSize: 15,
    color: Colors.text,
    fontStyle: 'italic',
  },
  wordScoresSection: {
    width: '100%',
    marginBottom: 12,
    gap: 6,
  },
  wordScoresTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  wordChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  wordChipText: {
    fontSize: 15,
    fontWeight: '600' as const,
    flex: 1,
  },
  wordChipScore: {
    fontSize: 13,
    fontWeight: '700' as const,
  },
  wordPhonemes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    width: '100%',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0F0EE',
  },
  phonemeChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    alignItems: 'center',
  },
  phonemeText: {
    fontSize: 14,
    fontWeight: '600' as const,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  phonemeNum: {
    fontSize: 10,
    fontWeight: '500' as const,
  },
  feedbackBox: {
    padding: 14,
    borderRadius: 10,
    borderLeftWidth: 3,
    width: '100%',
    marginBottom: 12,
  },
  feedbackText: {
    fontSize: 13,
    lineHeight: 19,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  retryText: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  practiceNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  practiceNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  practiceNavBtnDisabled: {
    opacity: 0.5,
  },
  practiceNavText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    fontSize: 13,
    color: '#B91C1C',
    textAlign: 'center' as const,
    lineHeight: 19,
  },
  errorRetryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#EF4444',
  },
  errorRetryText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#EF4444',
  },
  analyzingSubtext: {
    marginTop: 6,
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center' as const,
  },
  accentResultCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  accentResultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  accentResultTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    flex: 1,
  },
  accentBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  accentBadgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  accentScoreCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 5,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center' as const,
  },
  accentScoreEmoji: {
    fontSize: 20,
    marginBottom: 2,
  },
  accentScoreNum: {
    fontSize: 32,
    fontWeight: '800' as const,
    lineHeight: 36,
  },
  accentScoreSubLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    marginTop: -2,
  },
  accentOverallFeedback: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 21,
    textAlign: 'center' as const,
  },
  featureSection: {
    gap: 8,
  },
  featureSectionTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  featureRow: {
    backgroundColor: '#FAFAF9',
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 3,
    gap: 6,
  },
  featureRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  featureScore: {
    fontSize: 13,
    fontWeight: '700' as const,
  },
  featureFeedback: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
    paddingLeft: 24,
  },
  pointsSection: {
    gap: 6,
  },
  pointsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pointsTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
  },
  pointText: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
    paddingLeft: 20,
  },
  tipsSection: {
    padding: 14,
    borderRadius: 12,
    borderLeftWidth: 3,
    gap: 6,
  },
  tipsTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    marginBottom: 2,
  },
  tipText: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
  },
});
