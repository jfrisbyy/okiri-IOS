import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PronunciationResult } from '@/utils/azurePronunciation';

const STORAGE_KEY = 'pronunciation_phoneme_history';
const MAX_ENTRIES_PER_PHONEME = 30;

export interface PhonemeHistoryEntry {
  score: number;
  timestamp: number;
}

export interface PhonemeHistory {
  [phoneme: string]: PhonemeHistoryEntry[];
}

export interface WeakPhoneme {
  phoneme: string;
  averageScore: number;
  attempts: number;
  trend: 'improving' | 'declining' | 'stable';
  lastScore: number;
}

let cachedHistory: PhonemeHistory | null = null;

async function loadHistory(): Promise<PhonemeHistory> {
  if (cachedHistory) return cachedHistory;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    cachedHistory = raw ? JSON.parse(raw) : {};
    console.log('[PronTracker] Loaded history, phonemes tracked:', Object.keys(cachedHistory!).length);
    return cachedHistory!;
  } catch (e) {
    console.log('[PronTracker] Failed to load history:', e);
    cachedHistory = {};
    return cachedHistory;
  }
}

async function saveHistory(history: PhonemeHistory): Promise<void> {
  cachedHistory = history;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch (e) {
    console.log('[PronTracker] Failed to save history:', e);
  }
}

export async function recordPronunciationResult(result: PronunciationResult): Promise<void> {
  if (!result.phonemes || result.phonemes.length === 0) {
    console.log('[PronTracker] No phonemes to record');
    return;
  }

  const history = await loadHistory();
  const now = Date.now();

  for (const p of result.phonemes) {
    if (!p.phoneme || p.phoneme.trim().length === 0) continue;

    const key = p.phoneme.toLowerCase();
    if (!history[key]) {
      history[key] = [];
    }

    history[key].push({ score: p.accuracyScore, timestamp: now });

    if (history[key].length > MAX_ENTRIES_PER_PHONEME) {
      history[key] = history[key].slice(-MAX_ENTRIES_PER_PHONEME);
    }
  }

  await saveHistory(history);
  console.log('[PronTracker] Recorded', result.phonemes.length, 'phoneme scores');
}

export async function getWeakPhonemes(limit: number = 10): Promise<WeakPhoneme[]> {
  const history = await loadHistory();
  const phonemes: WeakPhoneme[] = [];

  for (const [phoneme, entries] of Object.entries(history)) {
    if (entries.length < 2) continue;

    const scores = entries.map(e => e.score);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const lastScore = scores[scores.length - 1];

    const recentHalf = scores.slice(Math.floor(scores.length / 2));
    const olderHalf = scores.slice(0, Math.floor(scores.length / 2));

    const recentAvg = recentHalf.length > 0
      ? recentHalf.reduce((a, b) => a + b, 0) / recentHalf.length
      : avg;
    const olderAvg = olderHalf.length > 0
      ? olderHalf.reduce((a, b) => a + b, 0) / olderHalf.length
      : avg;

    const diff = recentAvg - olderAvg;
    let trend: 'improving' | 'declining' | 'stable' = 'stable';
    if (diff > 5) trend = 'improving';
    else if (diff < -5) trend = 'declining';

    phonemes.push({
      phoneme,
      averageScore: Math.round(avg),
      attempts: entries.length,
      trend,
      lastScore: Math.round(lastScore),
    });
  }

  phonemes.sort((a, b) => a.averageScore - b.averageScore);

  return phonemes.slice(0, limit);
}

export async function getPhonemeStats(): Promise<{
  totalTracked: number;
  weakCount: number;
  strongCount: number;
  averageOverall: number;
}> {
  const history = await loadHistory();
  const phonemeKeys = Object.keys(history);

  if (phonemeKeys.length === 0) {
    return { totalTracked: 0, weakCount: 0, strongCount: 0, averageOverall: 0 };
  }

  let totalScore = 0;
  let totalEntries = 0;
  let weakCount = 0;
  let strongCount = 0;

  for (const entries of Object.values(history)) {
    if (entries.length === 0) continue;
    const avg = entries.reduce((a, b) => a + b.score, 0) / entries.length;
    totalScore += avg;
    totalEntries++;
    if (avg < 60) weakCount++;
    else if (avg >= 80) strongCount++;
  }

  return {
    totalTracked: phonemeKeys.length,
    weakCount,
    strongCount,
    averageOverall: totalEntries > 0 ? Math.round(totalScore / totalEntries) : 0,
  };
}

export async function clearPronunciationHistory(): Promise<void> {
  cachedHistory = {};
  await AsyncStorage.removeItem(STORAGE_KEY);
  console.log('[PronTracker] History cleared');
}
