import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Platform,
} from 'react-native';
import {
  Volume2,
  RotateCcw,
  TrendingUp,
  TrendingDown,
  Minus,
  Target,
  Zap,
  BarChart3,
  AlertTriangle,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { USE_NATIVE_DRIVER } from '@/constants/animation';
import { audioService } from '@/utils/audioService';
import { recordPronunciationResult, getWeakPhonemes, type WeakPhoneme } from '@/utils/pronunciationTracker';
import type { PronunciationResult, PhonemeScore } from '@/utils/azurePronunciation';

interface PronunciationFeedbackProps {
  result: PronunciationResult;
  targetText: string;
  onTryAgain: () => void;
  muted?: boolean;
  accentColor?: string;
  compact?: boolean;
}

const FRENCH_PROBLEM_SOUNDS: Record<string, string> = {
  'ʁ': 'French R (uvular)',
  'y': 'French U (as in "tu")',
  'ø': 'EU sound (as in "peu")',
  'œ': 'Open EU (as in "peur")',
  'ɑ̃': 'Nasal AN',
  'ɛ̃': 'Nasal IN',
  'ɔ̃': 'Nasal ON',
  'ɥ': 'French UE glide',
  'ʒ': 'Soft J (as in "je")',
  'ʃ': 'SH sound (as in "chat")',
  'ɲ': 'GN sound (as in "montagne")',
};

function getScoreColor(score: number): string {
  if (score >= 80) return '#10B981';
  if (score >= 60) return '#F59E0B';
  if (score >= 40) return '#F97316';
  return '#EF4444';
}

function getScoreLabel(score: number): string {
  if (score >= 90) return 'Excellent!';
  if (score >= 80) return 'Great!';
  if (score >= 70) return 'Good';
  if (score >= 60) return 'Fair';
  if (score >= 40) return 'Keep trying';
  return 'Needs work';
}

export default function PronunciationFeedback({
  result,
  targetText,
  onTryAgain,
  muted = false,
  accentColor = Colors.primary,
  compact = false,
}: PronunciationFeedbackProps) {
  const ringAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [weakPhonemes, setWeakPhonemes] = React.useState<WeakPhoneme[]>([]);

  const overallScore = Math.round(result.pronunciationScore);

  useEffect(() => {
    void recordPronunciationResult(result);

    getWeakPhonemes(6).then(setWeakPhonemes).catch(() => {});

    Animated.parallel([
      Animated.timing(ringAnim, {
        toValue: overallScore / 100,
        duration: 1000,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start();
  }, [result, overallScore, ringAnim, fadeAnim]);

  const problemPhonemes = useMemo(() => {
    if (!result.phonemes) return [];
    const weak = result.phonemes
      .filter(p => p.accuracyScore < 70 && p.phoneme.trim().length > 0)
      .sort((a, b) => a.accuracyScore - b.accuracyScore);

    const seen = new Set<string>();
    const unique: PhonemeScore[] = [];
    for (const p of weak) {
      const key = p.phoneme.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(p);
      }
    }
    return unique.slice(0, 8);
  }, [result.phonemes]);

  const handleListenNormal = useCallback(() => {
    if (!muted && targetText) {
      void audioService.playFrenchAudio(targetText, 1.0);
    }
  }, [muted, targetText]);

  const handleListenSlow = useCallback(() => {
    if (!muted && targetText) {
      void audioService.playFrenchAudio(targetText, 0.75);
    }
  }, [muted, targetText]);

  const scoreRingRotation = ringAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const scoreColorStr = getScoreColor(overallScore);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]} testID="pronunciation-feedback">
      <View style={styles.scoreSection}>
        <View style={[styles.scoreRingOuter, { borderColor: scoreColorStr + '25' }]}>
          <Animated.View
            style={[
              styles.scoreRingProgress,
              {
                borderColor: scoreColorStr,
                borderTopColor: 'transparent',
                transform: [{ rotate: scoreRingRotation }],
              },
            ]}
          />
          <View style={styles.scoreInner}>
            <Text style={[styles.scoreNumber, { color: scoreColorStr }]}>
              {overallScore}
            </Text>
            <Text style={styles.scoreOutOf}>/100</Text>
          </View>
        </View>
        <Text style={[styles.scoreLabel, { color: scoreColorStr }]}>
          {getScoreLabel(overallScore)}
        </Text>
      </View>

      {!compact && (
        <View style={styles.breakdownSection}>
          <ScoreBar
            label="Accuracy"
            score={result.accuracyScore}
            icon={<Target size={13} color={getScoreColor(result.accuracyScore)} />}
          />
          <ScoreBar
            label="Fluency"
            score={result.fluencyScore}
            icon={<Zap size={13} color={getScoreColor(result.fluencyScore)} />}
          />
          <ScoreBar
            label="Completeness"
            score={result.completenessScore}
            icon={<BarChart3 size={13} color={getScoreColor(result.completenessScore)} />}
          />
        </View>
      )}

      {problemPhonemes.length > 0 && (
        <View style={styles.phonemeSection}>
          <Text style={styles.phonemeSectionTitle}>Sounds to improve</Text>
          <View style={styles.phonemeGrid}>
            {problemPhonemes.map((p, idx) => {
              const hint = FRENCH_PROBLEM_SOUNDS[p.phoneme] || null;
              return (
                <View
                  key={`${p.phoneme}-${idx}`}
                  style={[
                    styles.phonemeCard,
                    { borderColor: getScoreColor(p.accuracyScore) + '40' },
                  ]}
                >
                  <Text style={[styles.phonemeSymbol, { color: getScoreColor(p.accuracyScore) }]}>
                    /{p.phoneme}/
                  </Text>
                  <Text style={[styles.phonemeCardScore, { color: getScoreColor(p.accuracyScore) }]}>
                    {Math.round(p.accuracyScore)}%
                  </Text>
                  {hint && (
                    <Text style={styles.phonemeHint} numberOfLines={1}>{hint}</Text>
                  )}
                  {p.nBestPhonemes && p.nBestPhonemes.length > 0 && p.nBestPhonemes[0].phoneme !== p.phoneme && (
                    <Text style={styles.phonemeHeard}>
                      heard: /{p.nBestPhonemes[0].phoneme}/
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        </View>
      )}

      {weakPhonemes.length > 0 && !compact && (
        <View style={styles.historySection}>
          <Text style={styles.historySectionTitle}>Your weak spots over time</Text>
          {weakPhonemes.slice(0, 4).map((wp) => (
            <View key={wp.phoneme} style={styles.historyRow}>
              <Text style={styles.historyPhoneme}>/{wp.phoneme}/</Text>
              <View style={styles.historyBarTrack}>
                <View
                  style={[
                    styles.historyBarFill,
                    {
                      width: `${Math.min(100, Math.max(5, wp.averageScore))}%`,
                      backgroundColor: getScoreColor(wp.averageScore),
                    },
                  ]}
                />
              </View>
              <Text style={[styles.historyAvg, { color: getScoreColor(wp.averageScore) }]}>
                {wp.averageScore}%
              </Text>
              <View style={styles.historyTrend}>
                {wp.trend === 'improving' ? (
                  <TrendingUp size={12} color="#10B981" />
                ) : wp.trend === 'declining' ? (
                  <TrendingDown size={12} color="#EF4444" />
                ) : (
                  <Minus size={12} color={Colors.textMuted} />
                )}
              </View>
            </View>
          ))}
        </View>
      )}

      {result.feedback ? (
        <View style={styles.feedbackBox}>
          <AlertTriangle size={14} color={accentColor} />
          <Text style={[styles.feedbackText, { color: accentColor }]}>
            {result.feedback}
          </Text>
        </View>
      ) : null}

      <View style={styles.listenRow}>
        <Pressable
          style={[styles.listenBtn, { backgroundColor: accentColor + '12', borderColor: accentColor + '30' }]}
          onPress={handleListenNormal}
          testID="pronunciation-listen-normal"
        >
          <Volume2 size={16} color={accentColor} />
          <Text style={[styles.listenBtnText, { color: accentColor }]}>Normal</Text>
        </Pressable>
        <Pressable
          style={[styles.listenBtn, { backgroundColor: accentColor + '12', borderColor: accentColor + '30' }]}
          onPress={handleListenSlow}
          testID="pronunciation-listen-slow"
        >
          <Volume2 size={14} color={accentColor} />
          <Text style={[styles.listenBtnText, { color: accentColor }]}>Slow</Text>
        </Pressable>
      </View>

      <Pressable
        style={[styles.retryBtn, { borderColor: accentColor }]}
        onPress={onTryAgain}
        testID="pronunciation-retry"
      >
        <RotateCcw size={16} color={accentColor} />
        <Text style={[styles.retryBtnText, { color: accentColor }]}>Try Again</Text>
      </Pressable>
    </Animated.View>
  );
}

function ScoreBar({ label, score, icon }: { label: string; score: number; icon: React.ReactNode }) {
  const color = getScoreColor(score);
  return (
    <View style={styles.scoreBarRow}>
      <View style={styles.scoreBarLabel}>
        {icon}
        <Text style={styles.scoreBarLabelText}>{label}</Text>
      </View>
      <View style={styles.scoreBarTrack}>
        <View
          style={[
            styles.scoreBarFill,
            { width: `${Math.min(100, Math.max(0, score))}%`, backgroundColor: color },
          ]}
        />
      </View>
      <Text style={[styles.scoreBarValue, { color }]}>
        {Math.round(score)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
  },
  scoreSection: {
    alignItems: 'center' as const,
    marginBottom: 20,
  },
  scoreRingOuter: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 8,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    position: 'relative' as const,
  },
  scoreRingProgress: {
    position: 'absolute' as const,
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 8,
    top: -8,
    left: -8,
  },
  scoreInner: {
    alignItems: 'center' as const,
  },
  scoreNumber: {
    fontSize: 38,
    fontWeight: '800' as const,
    lineHeight: 42,
  },
  scoreOutOf: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: -2,
  },
  scoreLabel: {
    fontSize: 16,
    fontWeight: '700' as const,
    marginTop: 8,
  },
  breakdownSection: {
    gap: 10,
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  scoreBarRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  scoreBarLabel: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
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
    overflow: 'hidden' as const,
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
  phonemeSection: {
    marginBottom: 18,
  },
  phonemeSectionTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 10,
  },
  phonemeGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
  },
  phonemeCard: {
    backgroundColor: '#FAFAFA',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    minWidth: 72,
    alignItems: 'center' as const,
  },
  phonemeSymbol: {
    fontSize: 18,
    fontWeight: '700' as const,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  phonemeCardScore: {
    fontSize: 12,
    fontWeight: '600' as const,
    marginTop: 2,
  },
  phonemeHint: {
    fontSize: 9,
    color: Colors.textMuted,
    marginTop: 2,
    textAlign: 'center' as const,
  },
  phonemeHeard: {
    fontSize: 9,
    color: '#EF4444',
    fontStyle: 'italic' as const,
    marginTop: 1,
  },
  historySection: {
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    padding: 14,
    marginBottom: 18,
  },
  historySectionTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 10,
  },
  historyRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginBottom: 8,
  },
  historyPhoneme: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
    width: 40,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  historyBarTrack: {
    flex: 1,
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden' as const,
  },
  historyBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  historyAvg: {
    fontSize: 12,
    fontWeight: '700' as const,
    width: 32,
    textAlign: 'right' as const,
  },
  historyTrend: {
    width: 16,
    alignItems: 'center' as const,
  },
  feedbackBox: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 8,
    backgroundColor: '#FFF7ED',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  feedbackText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  listenRow: {
    flexDirection: 'row' as const,
    gap: 10,
    marginBottom: 14,
  },
  listenBtn: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  listenBtnText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  retryBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  retryBtnText: {
    fontSize: 15,
    fontWeight: '600' as const,
  },
});
