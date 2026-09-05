import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { safeGoBack } from '@/utils/navigation';
import { ArrowLeft, Clock, Calendar, MessageSquare, AlertCircle, Lightbulb, Volume2, Trash2, ChevronRight, Play, Pause } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import Colors from '@/constants/colors';
import { useApp } from '@/contexts/AppContext';
import { useFrenchAudio } from '@/hooks/useFrenchAudio';
import { useAudioPlayback } from '@/hooks/useAudioPlayback';
import { SpeechRecordingLog } from '@/types';

const SCREEN_WIDTH = Dimensions.get('window').width;
const MAX_WIDTH = Math.min(SCREEN_WIDTH, 430);

export default function RecordingLogScreen() {
  const router = useRouter();
  const { recordingLogs, deleteRecordingLog } = useApp();
  const { speak } = useFrenchAudio();
  const [playingId, setPlayingId] = useState<string | null>(null);
  const { play, stop, isPlaying } = useAudioPlayback();

  const playRecording = async (log: SpeechRecordingLog) => {
    if (!log.audioData) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    if (playingId === log.id) {
      await stop();
      setPlayingId(null);
      return;
    }
    
    try {
      await play(log.audioData);
      setPlayingId(log.id);
    } catch (error) {
      console.log('Error playing audio:', error);
      setPlayingId(null);
    }
  };

  React.useEffect(() => {
    if (!isPlaying && playingId) {
      setPlayingId(null);
    }
  }, [isPlaying, playingId]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      const hours = Math.floor(diff / (1000 * 60 * 60));
      if (hours === 0) {
        const minutes = Math.floor(diff / (1000 * 60));
        return minutes <= 1 ? 'Just now' : `${minutes} mins ago`;
      }
      return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return `${days} days ago`;
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const handleDelete = async (logId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Stop audio if this log was playing
    if (playingId === logId) {
      await stop();
      setPlayingId(null);
    }
    await deleteRecordingLog(logId);
  };

  const renderLogCard = (log: SpeechRecordingLog) => {
    const hasErrors = log.grammarErrors.length > 0;
    const hasSuggestions = log.fluencySuggestions.length > 0;
    
    return (
      <View key={log.id} style={styles.logCard}>
        <View style={styles.logHeader}>
          <View style={styles.logMeta}>
            <Calendar size={14} color={Colors.textMuted} />
            <Text style={styles.logDate}>{formatDate(log.createdAt)}</Text>
            <Clock size={14} color={Colors.textMuted} />
            <Text style={styles.logDuration}>{log.actualDuration} min</Text>
          </View>
          <Pressable 
            style={styles.deleteButton}
            onPress={() => handleDelete(log.id)}
          >
            <Trash2 size={16} color={Colors.textMuted} />
          </Pressable>
        </View>

        <Text style={styles.promptText} numberOfLines={1}>
          {log.prompt}
        </Text>

        {log.audioData && (
          <Pressable 
            style={[styles.playButton, playingId === log.id && styles.playButtonActive]}
            onPress={() => playRecording(log)}
          >
            {playingId === log.id ? (
              <Pause size={18} color="#FFFFFF" />
            ) : (
              <Play size={18} color="#FFFFFF" />
            )}
            <Text style={styles.playButtonText}>
              {playingId === log.id ? 'Playing...' : 'Play Recording'}
            </Text>
          </Pressable>
        )}

        {log.transcript ? (
          <View style={styles.transcriptBox}>
            <Text style={styles.transcriptLabel}>Your speech:</Text>
            <Text style={styles.transcriptText} numberOfLines={3}>
              "{log.transcript}"
            </Text>
          </View>
        ) : (
          <View style={styles.noTranscriptBox}>
            <MessageSquare size={16} color={Colors.textMuted} />
            <Text style={styles.noTranscriptText}>No speech detected</Text>
          </View>
        )}

        {(hasErrors || hasSuggestions) && (
          <View style={styles.feedbackSection}>
            {hasErrors && (
              <View style={styles.feedbackRow}>
                <AlertCircle size={14} color={Colors.secondary} />
                <Text style={styles.feedbackCount}>
                  {log.grammarErrors.length} grammar {log.grammarErrors.length === 1 ? 'insight' : 'insights'}
                </Text>
              </View>
            )}
            {hasSuggestions && (
              <View style={styles.feedbackRow}>
                <Lightbulb size={14} color={Colors.primary} />
                <Text style={styles.feedbackCount}>
                  {log.fluencySuggestions.length} fluency {log.fluencySuggestions.length === 1 ? 'tip' : 'tips'}
                </Text>
              </View>
            )}
          </View>
        )}

        {hasErrors && (
          <View style={styles.correctionsSection}>
            <Text style={styles.correctionsTitle}>Corrections:</Text>
            {log.grammarErrors.slice(0, 2).map((error, idx) => (
              <View key={idx} style={styles.correctionItem}>
                <View style={styles.correctionText}>
                  <Text style={styles.incorrectPhrase}>{error.incorrectText}</Text>
                  <ChevronRight size={14} color={Colors.textMuted} />
                  <Text style={styles.correctPhrase}>{error.correctedText}</Text>
                </View>
                <Pressable 
                  style={styles.miniTtsButton}
                  onPress={() => speak(error.correctedText)}
                >
                  <Volume2 size={14} color={Colors.primary} />
                </Pressable>
              </View>
            ))}
            {log.grammarErrors.length > 2 && (
              <Text style={styles.moreCount}>+{log.grammarErrors.length - 2} more</Text>
            )}
          </View>
        )}

        {hasSuggestions && (
          <View style={styles.suggestionsSection}>
            <Text style={styles.correctionsTitle}>Suggestions:</Text>
            {log.fluencySuggestions.slice(0, 2).map((suggestion, idx) => (
              <View key={idx} style={styles.correctionItem}>
                <View style={styles.correctionText}>
                  <Text style={styles.originalPhrase}>{suggestion.originalPhrase}</Text>
                  <ChevronRight size={14} color={Colors.textMuted} />
                  <Text style={styles.betterPhrase}>{suggestion.suggestedPhrase}</Text>
                </View>
                <Pressable 
                  style={styles.miniTtsButton}
                  onPress={() => speak(suggestion.suggestedPhrase)}
                >
                  <Volume2 size={14} color={Colors.primary} />
                </Pressable>
              </View>
            ))}
            {log.fluencySuggestions.length > 2 && (
              <Text style={styles.moreCount}>+{log.fluencySuggestions.length - 2} more</Text>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#6366F1', '#818CF8']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <View style={styles.headerContent}>
          <Pressable
            style={styles.backButton}
            onPress={() => safeGoBack()}
          >
            <ArrowLeft size={24} color="#fff" />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Speaking Log</Text>
            <Text style={styles.headerSubtitle}>
              {recordingLogs.length} {recordingLogs.length === 1 ? 'session' : 'sessions'}
            </Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {recordingLogs.length === 0 ? (
          <View style={styles.emptyState}>
            <MessageSquare size={48} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>No recordings yet</Text>
            <Text style={styles.emptySubtitle}>
              Complete a speaking session to see your history here
            </Text>
          </View>
        ) : (
          recordingLogs.map(renderLogCard)
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerGradient: {
    paddingTop: 60,
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    maxWidth: 260,
  },
  logCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    width: '100%',
    maxWidth: MAX_WIDTH - 40,
    alignSelf: 'center',
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  logMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  logDate: {
    fontSize: 12,
    color: Colors.textMuted,
    marginRight: 8,
  },
  logDuration: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  deleteButton: {
    padding: 8,
    borderRadius: 8,
  },
  promptText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 12,
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 12,
  },
  playButtonActive: {
    backgroundColor: Colors.primaryDark || '#D97706',
  },
  playButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  transcriptBox: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  transcriptLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  transcriptText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  noTranscriptBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  noTranscriptText: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  feedbackSection: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  feedbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  feedbackCount: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  correctionsSection: {
    marginTop: 4,
  },
  suggestionsSection: {
    marginTop: 12,
  },
  correctionsTitle: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  correctionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  correctionText: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  incorrectPhrase: {
    fontSize: 13,
    color: Colors.secondary,
    textDecorationLine: 'line-through',
    maxWidth: '40%',
  },
  correctPhrase: {
    fontSize: 13,
    color: Colors.success,
    fontWeight: '500' as const,
    flex: 1,
  },
  originalPhrase: {
    fontSize: 13,
    color: Colors.textSecondary,
    maxWidth: '40%',
  },
  betterPhrase: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '500' as const,
    flex: 1,
  },
  miniTtsButton: {
    padding: 6,
    borderRadius: 12,
    backgroundColor: Colors.primaryLight,
  },
  moreCount: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 4,
  },
});
