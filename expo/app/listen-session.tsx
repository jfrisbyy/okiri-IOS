import { useState, useRef, useEffect, useMemo, useLayoutEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Animated,
  Dimensions,
  Modal,
} from 'react-native';
import { useRouter, useNavigation } from 'expo-router';
import { safeGoBack } from '@/utils/navigation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowLeft,
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  CircleDot,
  X,
  Volume2,
  Check,
  Headphones,
  Clock,
  Eye,
  EyeOff,
  ChevronDown,
  Loader2,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { USE_NATIVE_DRIVER } from '@/constants/animation';
import { useApp } from '@/contexts/AppContext';
import { listeningContent, ListeningItem, ListeningDifficulty } from '@/mocks/listeningContent';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type ConversationTurn = {
  speaker: string;
  text: string;
  startTime: number;
  endTime: number;
};

type GeneratedConversation = {
  topic: string;
  difficulty: string;
  turns: ConversationTurn[];
  fullText: string;
};

type CapturedSegment = {
  id: string;
  text: string;
  translation: string;
  startTime: number;
  endTime: number;
  speaker: string;
};

type Scenario = {
  id: string;
  title: string;
  titleEnglish: string;
  description: string;
  emoji: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  duration: string;
  durationSeconds: number;
  type: 'dialogue' | 'story';
  turns: { speaker: 'A' | 'B' | 'narrator'; french: string; english: string; }[];
};

const formatDuration = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (secs === 0) return `${mins} min`;
  return `${mins}m ${secs}s`;
};

const mapListeningToScenario = (item: ListeningItem): Scenario => ({
  id: item.id,
  title: item.title,
  titleEnglish: item.titleEnglish,
  description: item.description,
  emoji: item.emoji,
  difficulty: item.difficulty,
  duration: formatDuration(item.durationSeconds),
  durationSeconds: item.durationSeconds,
  type: item.type,
  turns: item.turns,
});

const SCENARIOS: Scenario[] = listeningContent.map(mapListeningToScenario);

const SPEED_OPTIONS = [0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3];

const FRENCH_VOICES = [
  { id: 'pMsXgVXv3BLzUgSXRplE', name: 'Charlotte', gender: 'female' },
  { id: 'IKne3meq5aSn9XLyUdCD', name: 'Henri', gender: 'male' },
];

const difficultyColors = {
  beginner: Colors.success,
  intermediate: Colors.warning,
  advanced: Colors.error,
};

const difficultyLabels = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

export const unstable_settings = {
  headerShown: false,
};

export default function ListenSessionScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { addGap } = useApp();
  
  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);
  
  const [phase, setPhase] = useState<'topic' | 'generating' | 'listening'>('topic');
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  const [conversation, setConversation] = useState<GeneratedConversation | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureStartTime, setCaptureStartTime] = useState(0);
  const [capturedSegments, setCapturedSegments] = useState<CapturedSegment[]>([]);
  const [currentSegment, setCurrentSegment] = useState<CapturedSegment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generationStep, setGenerationStep] = useState('');
  const [showSubtitles, setShowSubtitles] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [showSpeedPicker, setShowSpeedPicker] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'dialogue' | 'story'>('all');
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const captureAnim = useRef(new Animated.Value(1)).current;
  const progressInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, []);

  useEffect(() => {
    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  const [difficultyFilter, setDifficultyFilter] = useState<ListeningDifficulty | 'all'>('all');

  const filteredScenarios = useMemo(() => {
    return SCENARIOS.filter(s => {
      const typeMatch = filterType === 'all' || s.type === filterType;
      const difficultyMatch = difficultyFilter === 'all' || s.difficulty === difficultyFilter;
      return typeMatch && difficultyMatch;
    });
  }, [filterType, difficultyFilter]);

  const loadPreGeneratedContent = async (scenario: Scenario) => {
    setPhase('generating');
    setGenerationStep('Loading content...');
    setError(null);
    
    try {
      const conversationTurns: ConversationTurn[] = scenario.turns.map((turn, idx) => ({
        speaker: turn.speaker === 'narrator' ? 'Narrator' : turn.speaker,
        text: turn.french,
        startTime: 0,
        endTime: 0,
      }));

      const conv: GeneratedConversation = {
        topic: scenario.title,
        difficulty: scenario.difficulty,
        turns: conversationTurns,
        fullText: scenario.turns.map(t => t.french).join(' '),
      };
      
      setConversation(conv);
      
      setGenerationStep('Generating audio...');
      await generateAudioFromPreGenerated(scenario);
      
      setPhase('listening');
    } catch (e) {
      console.error('Loading error:', e);
      setError('Failed to load content. Please try again.');
      setPhase('topic');
    }
  };

  const generateAudioFromPreGenerated = async (scenario: Scenario) => {
    const audioBlobs: Blob[] = [];
    let currentTimeOffset = 0;
    const updatedTurns: ConversationTurn[] = [];
    
    for (let i = 0; i < scenario.turns.length; i++) {
      const turn = scenario.turns[i];
      const voice = scenario.type === 'story' 
        ? FRENCH_VOICES[0] 
        : (turn.speaker === 'A' ? FRENCH_VOICES[0] : FRENCH_VOICES[1]);
      
      setGenerationStep(`Generating audio ${i + 1}/${scenario.turns.length}...`);
      
      try {
        const response = await fetch('/api/text-to-speech', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: turn.french,
            voiceId: voice.id,
          }),
        });

        if (!response.ok) {
          throw new Error('TTS failed');
        }

        const blob = await response.blob();
        audioBlobs.push(blob);
        
        const audio = new Audio(URL.createObjectURL(blob));
        await new Promise<void>((resolve) => {
          audio.onloadedmetadata = () => {
            updatedTurns.push({
              speaker: turn.speaker === 'narrator' ? 'Narrator' : turn.speaker,
              text: turn.french,
              startTime: currentTimeOffset,
              endTime: currentTimeOffset + audio.duration,
            });
            currentTimeOffset += audio.duration + 0.3;
            resolve();
          };
        });
      } catch (e) {
        console.error('TTS error for turn', i, e);
        throw e;
      }
    }
    
    setConversation(prev => prev ? { ...prev, turns: updatedTurns } : null);
    
    const combinedBlob = new Blob(audioBlobs, { type: 'audio/mpeg' });
    const url = URL.createObjectURL(combinedBlob);
    setAudioUrl(url);
    setDuration(currentTimeOffset);
    
    const audio = new Audio(url);
    audio.playbackRate = playbackSpeed;
    audioRef.current = audio;
    
    audio.onended = () => {
      setIsPlaying(false);
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    };
  };

  const togglePlayPause = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    } else {
      audioRef.current.play();
      progressInterval.current = setInterval(() => {
        if (audioRef.current) {
          setCurrentTime(audioRef.current.currentTime);
        }
      }, 100);
    }
    setIsPlaying(!isPlaying);
  };

  const seekBy = (seconds: number) => {
    if (!audioRef.current) return;
    const newTime = Math.max(0, Math.min(audioRef.current.currentTime + seconds, duration));
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const startCapture = () => {
    setIsCapturing(true);
    setCaptureStartTime(currentTime);
    
    Animated.loop(
      Animated.sequence([
        Animated.timing(captureAnim, {
          toValue: 1.2,
          duration: 500,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(captureAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ])
    ).start();
  };

  const endCapture = async () => {
    setIsCapturing(false);
    captureAnim.stopAnimation();
    captureAnim.setValue(1);
    
    if (!conversation || !selectedScenario) return;
    
    const captureEndTime = currentTime;
    const relevantTurnIndices: number[] = [];
    conversation.turns.forEach((turn, idx) => {
      if (turn.startTime <= captureEndTime && turn.endTime >= captureStartTime) {
        relevantTurnIndices.push(idx);
      }
    });
    
    if (relevantTurnIndices.length > 0) {
      const capturedText = relevantTurnIndices.map((idx) => {
        const turn = conversation.turns[idx];
        return selectedScenario.type === 'story' ? turn.text : `${turn.speaker === 'A' ? '👩' : '👨'}: ${turn.text}`;
      }).join('\n');
      
      const translation = relevantTurnIndices.map((idx) => {
        const turn = selectedScenario.turns[idx];
        return selectedScenario.type === 'story' ? turn.english : `${turn.speaker === 'A' ? '👩' : '👨'}: ${turn.english}`;
      }).join('\n');
      
      if (audioRef.current) {
        audioRef.current.pause();
        setIsPlaying(false);
      }
      
      const segment: CapturedSegment = {
        id: Date.now().toString(),
        text: capturedText,
        translation,
        startTime: captureStartTime,
        endTime: captureEndTime,
        speaker: relevantTurnIndices.map((idx) => conversation.turns[idx].speaker).join(', '),
      };
      
      setCapturedSegments((prev) => [...prev, segment]);
      setCurrentSegment(segment);
    }
  };

  const replaySegment = async (segment: CapturedSegment) => {
    if (!audioRef.current) return;
    
    audioRef.current.currentTime = segment.startTime;
    setCurrentTime(segment.startTime);
    audioRef.current.play();
    setIsPlaying(true);
    
    setTimeout(() => {
      if (audioRef.current) {
        audioRef.current.pause();
        setIsPlaying(false);
      }
    }, (segment.endTime - segment.startTime) * 1000 / playbackSpeed);
  };

  const saveSegmentToGap = async (segment: CapturedSegment) => {
    const frenchText = segment.text.replace(/^[👩👨]: /gm, '').replace(/\n/g, ' ');
    
    await addGap(
      frenchText,
      segment.translation || '',
      'Listening comprehension - captured segment',
      frenchText,
      '',
      'listening',
      undefined,
      undefined,
      undefined,
      'vocab',
      undefined,
      false
    );
    
    setCurrentSegment(null);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getCurrentTurnText = () => {
    if (!conversation) return '';
    const currentTurn = conversation.turns.find(
      (turn) => currentTime >= turn.startTime && currentTime <= turn.endTime
    );
    return currentTurn ? currentTurn.text : '';
  };

  if (phase === 'topic') {
    return (
      <View style={styles.container}>
          <SafeAreaView style={styles.safeArea} edges={['top']}>
            <Animated.View style={[styles.animatedContainer, { opacity: fadeAnim }]}>
              <View style={styles.minimalHeader}>
                <Pressable onPress={() => safeGoBack()} style={styles.backButton}>
                  <ArrowLeft size={24} color={Colors.primary} />
              </Pressable>
              <View style={styles.statsChip}>
                <Headphones size={14} color={Colors.primary} />
                <Text style={[styles.statsText, { color: Colors.textSecondary }]}>{capturedSegments.length} captured</Text>
              </View>
            </View>

            <View style={styles.filterRow}>
              {(['all', 'dialogue', 'story'] as const).map((type) => (
                <Pressable
                  key={type}
                  style={[styles.filterChip, filterType === type && styles.filterChipActive]}
                  onPress={() => setFilterType(type)}
                >
                  <Text style={[styles.filterChipText, filterType === type && styles.filterChipTextActive]}>
                    {type === 'all' ? 'All' : type === 'story' ? 'Stories' : 'Dialogues'}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.difficultyFilterRow}>
              {(['all', 'beginner', 'intermediate', 'advanced'] as const).map((diff) => (
                <Pressable
                  key={diff}
                  style={[styles.difficultyFilterChip, difficultyFilter === diff && styles.difficultyFilterChipActive]}
                  onPress={() => setDifficultyFilter(diff)}
                >
                  {diff !== 'all' && <View style={[styles.difficultyFilterDot, { backgroundColor: difficultyColors[diff] }]} />}
                  <Text style={[styles.difficultyFilterText, difficultyFilter === diff && styles.difficultyFilterTextActive]}>
                    {diff === 'all' ? 'All Levels' : difficultyLabels[diff]}
                  </Text>
                </Pressable>
              ))}
            </View>

            <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
              <Text style={styles.sectionTitle}>{filteredScenarios.length} Scenarios</Text>
              
              {filteredScenarios.map((scenario) => (
                <Pressable
                  key={scenario.id}
                  style={[styles.scenarioCard, selectedScenario?.id === scenario.id && styles.scenarioCardSelected]}
                  onPress={() => setSelectedScenario(scenario)}
                >
                  <View style={styles.scenarioLeft}>
                    <Text style={styles.scenarioEmoji}>{scenario.emoji}</Text>
                  </View>
                  <View style={styles.scenarioMiddle}>
                    <Text style={styles.scenarioTitle}>{scenario.title}</Text>
                    <Text style={styles.scenarioDescription}>{scenario.description}</Text>
                    <View style={styles.scenarioMeta}>
                      <View style={[styles.difficultyBadge, { backgroundColor: difficultyColors[scenario.difficulty] + '20' }]}>
                        <View style={[styles.difficultyDot, { backgroundColor: difficultyColors[scenario.difficulty] }]} />
                        <Text style={[styles.difficultyText, { color: difficultyColors[scenario.difficulty] }]}>
                          {difficultyLabels[scenario.difficulty]}
                        </Text>
                      </View>
                      <View style={styles.durationBadge}>
                        <Clock size={12} color={Colors.textMuted} />
                        <Text style={styles.durationText}>{scenario.duration}</Text>
                      </View>
                    </View>
                  </View>
                  <View style={[styles.radioOuter, selectedScenario?.id === scenario.id && styles.radioOuterSelected]}>
                    {selectedScenario?.id === scenario.id && <View style={styles.radioInner} />}
                  </View>
                </Pressable>
              ))}

              {error && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}
            </ScrollView>

            <View style={styles.footer}>
              <Pressable
                style={[styles.startButton, !selectedScenario && styles.startButtonDisabled]}
                onPress={() => selectedScenario && loadPreGeneratedContent(selectedScenario)}
                disabled={!selectedScenario}
              >
                <Play size={20} color={Colors.textLight} />
                <Text style={styles.startButtonText}>Start Listening</Text>
              </Pressable>
            </View>
          </Animated.View>
        </SafeAreaView>
      </View>
    );
  }

  if (phase === 'generating') {
    return (
      <View style={styles.container}>
          <LinearGradient
            colors={[Colors.primaryGradientStart, Colors.primaryGradientEnd]}
            style={styles.fullGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <SafeAreaView style={styles.generatingContainer}>
              <ActivityIndicator size="large" color={Colors.textLight} />
              <Text style={styles.generatingTitle}>Preparing Your Audio</Text>
            <Text style={styles.generatingStep}>{generationStep}</Text>
            <Text style={styles.generatingTopic}>
              {selectedScenario?.emoji} {selectedScenario?.title}
            </Text>
          </SafeAreaView>
        </LinearGradient>
      </View>
    );
  }

  if (phase === 'listening') {
    const currentText = getCurrentTurnText();
    
    return (
      <View style={styles.container}>
          <SafeAreaView style={styles.safeArea} edges={['top']}>
            <LinearGradient
              colors={[Colors.primaryGradientStart, Colors.primaryGradientEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.listeningHeader}
            >
              <View style={styles.listeningHeaderRow}>
                <Pressable onPress={() => safeGoBack()} style={styles.backButton}>
                  <ArrowLeft size={24} color={Colors.textLight} />
              </Pressable>
              <View style={styles.listeningHeaderCenter}>
                <Text style={styles.listeningHeaderTitle}>{selectedScenario?.title}</Text>
                <Text style={styles.listeningHeaderSubtitle}>{selectedScenario?.description}</Text>
              </View>
              <View style={{ width: 44 }} />
            </View>
          </LinearGradient>

          <View style={styles.controlsRow}>
            <Pressable style={styles.controlButton} onPress={() => setShowSubtitles(!showSubtitles)}>
              {showSubtitles ? <Eye size={20} color={Colors.primary} /> : <EyeOff size={20} color={Colors.textMuted} />}
              <Text style={[styles.controlButtonText, showSubtitles && { color: Colors.primary }]}>
                Subtitles
              </Text>
            </Pressable>
            
            <Pressable style={styles.controlButton} onPress={() => setShowSpeedPicker(true)}>
              <Text style={styles.speedValue}>{playbackSpeed}x</Text>
              <ChevronDown size={16} color={Colors.textMuted} />
            </Pressable>
          </View>

          <View style={styles.listeningContent}>
            {showSubtitles && currentText ? (
              <View style={styles.subtitleBox}>
                <Text style={styles.subtitleText}>{currentText}</Text>
              </View>
            ) : (
              <View style={styles.audioVisualizer}>
                <View style={styles.waveformContainer}>
                  {[...Array(24)].map((_, i) => (
                    <Animated.View
                      key={i}
                      style={[
                        styles.waveBar,
                        {
                          height: isPlaying ? 16 + Math.random() * 48 : 16,
                          backgroundColor: isPlaying ? Colors.primary : Colors.border,
                        },
                      ]}
                    />
                  ))}
                </View>
              </View>
            )}

            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` },
                  ]}
                />
              </View>
              <View style={styles.timeContainer}>
                <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
                <Text style={styles.timeText}>{formatTime(duration)}</Text>
              </View>
            </View>

            <View style={styles.playerControls}>
              <Pressable onPress={() => seekBy(-5)} style={styles.seekButton}>
                <RotateCcw size={28} color={Colors.text} />
                <Text style={styles.seekText}>5s</Text>
              </Pressable>

              <Pressable onPress={togglePlayPause} style={styles.playButton}>
                {isPlaying ? (
                  <Pause size={36} color={Colors.textLight} />
                ) : (
                  <Play size={36} color={Colors.textLight} style={{ marginLeft: 4 }} />
                )}
              </Pressable>

              <Pressable onPress={() => seekBy(5)} style={styles.seekButton}>
                <RotateCw size={28} color={Colors.text} />
                <Text style={styles.seekText}>5s</Text>
              </Pressable>
            </View>

            <View style={styles.captureSection}>
              <Text style={styles.captureLabel}>
                {isCapturing
                  ? 'Release when done capturing'
                  : "Hold to capture what you don't understand"}
              </Text>
              <Pressable
                onPressIn={startCapture}
                onPressOut={endCapture}
                style={styles.captureButtonContainer}
              >
                <Animated.View
                  style={[
                    styles.captureButton,
                    isCapturing && styles.captureButtonActive,
                    { transform: [{ scale: captureAnim }] },
                  ]}
                >
                  <CircleDot size={32} color={isCapturing ? '#EF4444' : Colors.textLight} />
                </Animated.View>
              </Pressable>
            </View>

            {capturedSegments.length > 0 && (
              <View style={styles.capturedCount}>
                <Text style={styles.capturedCountText}>
                  {capturedSegments.length} segment{capturedSegments.length !== 1 ? 's' : ''} captured
                </Text>
              </View>
            )}
          </View>

          <Modal visible={showSpeedPicker} transparent animationType="fade">
            <Pressable style={styles.modalOverlay} onPress={() => setShowSpeedPicker(false)}>
              <View style={styles.speedPickerModal}>
                <Text style={styles.speedPickerTitle}>Playback Speed</Text>
                {SPEED_OPTIONS.map((speed) => (
                  <Pressable
                    key={speed}
                    style={[styles.speedOption, playbackSpeed === speed && styles.speedOptionActive]}
                    onPress={() => { setPlaybackSpeed(speed); setShowSpeedPicker(false); }}
                  >
                    <Text style={[styles.speedOptionText, playbackSpeed === speed && styles.speedOptionTextActive]}>
                      {speed}x {speed === 1.0 ? '(Normal)' : ''}
                    </Text>
                    {playbackSpeed === speed && <Check size={18} color={Colors.primary} />}
                  </Pressable>
                ))}
              </View>
            </Pressable>
          </Modal>

          {currentSegment && (
            <View style={styles.segmentModal}>
              <View style={styles.segmentCard}>
                <View style={styles.segmentHeader}>
                  <Text style={styles.segmentTitle}>Captured Segment</Text>
                  <Pressable onPress={() => setCurrentSegment(null)} style={styles.closeButton}>
                    <X size={22} color={Colors.textMuted} />
                  </Pressable>
                </View>
                
                <View style={styles.segmentTextContainer}>
                  <Text style={styles.segmentLabel}>French</Text>
                  <Text style={styles.segmentFrench}>{currentSegment.text}</Text>
                </View>
                
                {currentSegment.translation && (
                  <View style={styles.segmentTextContainer}>
                    <Text style={styles.segmentLabel}>English</Text>
                    <Text style={styles.segmentEnglish}>{currentSegment.translation}</Text>
                  </View>
                )}
                
                <View style={styles.segmentActions}>
                  <Pressable
                    style={styles.replayButton}
                    onPress={() => replaySegment(currentSegment)}
                  >
                    <Volume2 size={18} color={Colors.primary} />
                    <Text style={styles.replayButtonText}>Replay</Text>
                  </Pressable>
                  
                  <Pressable
                    style={styles.saveButton}
                    onPress={() => saveSegmentToGap(currentSegment)}
                  >
                    <Check size={18} color={Colors.textLight} />
                    <Text style={styles.saveButtonText}>Add to Deck</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )}
        </SafeAreaView>
      </View>
    );
  }

  return null;
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
  minimalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerGradient: {
    paddingBottom: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginLeft: -8,
  },
  headerTextContainer: {
    marginTop: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.textLight,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.85)',
    marginBottom: 16,
  },
  statsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  statsText: {
    fontSize: 13,
    color: Colors.textLight,
    fontWeight: '500',
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 10,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
  },
  filterChipText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: Colors.primary,
  },
  difficultyFilterRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 10,
    gap: 8,
    flexWrap: 'wrap',
  },
  difficultyFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 5,
  },
  difficultyFilterChipActive: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
  },
  difficultyFilterDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  difficultyFilterText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  difficultyFilterTextActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
  contentScroll: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 100,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 16,
  },
  scenarioCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  scenarioCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  scenarioLeft: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: Colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  scenarioEmoji: {
    fontSize: 28,
  },
  scenarioMiddle: {
    flex: 1,
  },
  scenarioTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  scenarioDescription: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  scenarioMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  difficultyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 4,
  },
  difficultyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  difficultyText: {
    fontSize: 11,
    fontWeight: '600',
  },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  durationText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioOuterSelected: {
    borderColor: Colors.primary,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.primary,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 32,
    backgroundColor: Colors.background,
  },
  startButton: {
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  startButtonDisabled: {
    backgroundColor: Colors.border,
  },
  startButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.textLight,
  },
  errorBox: {
    backgroundColor: Colors.errorLight,
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  errorText: {
    color: Colors.error,
    fontSize: 14,
  },
  fullGradient: {
    flex: 1,
  },
  generatingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  generatingTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textLight,
    marginTop: 24,
    textAlign: 'center',
  },
  generatingStep: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 12,
  },
  generatingTopic: {
    fontSize: 18,
    color: Colors.textLight,
    marginTop: 24,
  },
  listeningHeader: {
    paddingBottom: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  listeningHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  listeningHeaderCenter: {
    flex: 1,
    alignItems: 'center',
  },
  listeningHeaderTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textLight,
  },
  listeningHeaderSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 24,
  },
  controlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: Colors.backgroundCard,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  controlButtonText: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  speedValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  listeningContent: {
    flex: 1,
    padding: 20,
  },
  subtitleBox: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    minHeight: 100,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  subtitleText: {
    fontSize: 18,
    color: Colors.text,
    lineHeight: 28,
    textAlign: 'center',
  },
  audioVisualizer: {
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 64,
  },
  waveBar: {
    width: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
  },
  progressContainer: {
    marginBottom: 32,
  },
  progressBar: {
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  timeText: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  playerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 40,
    marginBottom: 40,
  },
  seekButton: {
    alignItems: 'center',
    gap: 4,
  },
  seekText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  playButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  captureSection: {
    alignItems: 'center',
    gap: 12,
  },
  captureLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  captureButtonContainer: {
    padding: 8,
  },
  captureButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.textMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonActive: {
    backgroundColor: '#FEE2E2',
  },
  capturedCount: {
    alignItems: 'center',
    marginTop: 16,
  },
  capturedCountText: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  speedPickerModal: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 16,
    padding: 20,
    width: SCREEN_WIDTH - 80,
    maxWidth: 300,
  },
  speedPickerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  speedOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  speedOptionActive: {
    backgroundColor: Colors.primaryLight,
  },
  speedOptionText: {
    fontSize: 16,
    color: Colors.text,
  },
  speedOptionTextActive: {
    fontWeight: '600',
    color: Colors.primary,
  },
  segmentModal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  segmentCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  segmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  segmentTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  closeButton: {
    padding: 4,
  },
  segmentTextContainer: {
    marginBottom: 16,
  },
  segmentLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  segmentFrench: {
    fontSize: 17,
    color: Colors.text,
    lineHeight: 26,
    fontWeight: '500',
  },
  segmentEnglish: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 24,
    fontStyle: 'italic',
  },
  segmentActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  replayButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  replayButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primary,
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.primary,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textLight,
  },
});
