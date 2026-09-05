import AsyncStorage from '@react-native-async-storage/async-storage';
import { ACHIEVEMENTS, AchievementCheckState, EarnedAchievement } from '@/data/achievements';

const STORAGE_KEY = 'okiri_achievements';
const SPECIAL_COUNTERS_KEY = 'okiri_achievement_counters';

export interface AchievementCounters {
  perfectLessons: number;
  maxConsecutiveCorrect: number;
  videosWatched: number;
}

const DEFAULT_COUNTERS: AchievementCounters = {
  perfectLessons: 0,
  maxConsecutiveCorrect: 0,
  videosWatched: 0,
};

export async function loadAchievements(): Promise<EarnedAchievement[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.log('[Achievements] Failed to load:', e);
    return [];
  }
}

export async function saveAchievements(achievements: EarnedAchievement[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(achievements));
  } catch (e) {
    console.log('[Achievements] Failed to save:', e);
  }
}

export async function loadCounters(): Promise<AchievementCounters> {
  try {
    const data = await AsyncStorage.getItem(SPECIAL_COUNTERS_KEY);
    return data ? { ...DEFAULT_COUNTERS, ...JSON.parse(data) } : DEFAULT_COUNTERS;
  } catch (e) {
    console.log('[Achievements] Failed to load counters:', e);
    return DEFAULT_COUNTERS;
  }
}

export async function saveCounters(counters: AchievementCounters): Promise<void> {
  try {
    await AsyncStorage.setItem(SPECIAL_COUNTERS_KEY, JSON.stringify(counters));
  } catch (e) {
    console.log('[Achievements] Failed to save counters:', e);
  }
}

export async function incrementCounter(key: keyof AchievementCounters, amount: number = 1): Promise<AchievementCounters> {
  const counters = await loadCounters();
  if (key === 'maxConsecutiveCorrect') {
    counters[key] = Math.max(counters[key], amount);
  } else {
    counters[key] = counters[key] + amount;
  }
  await saveCounters(counters);
  console.log('[Achievements] Counter updated:', key, '=', counters[key]);
  return counters;
}

export function checkAchievements(
  state: AchievementCheckState,
  earned: EarnedAchievement[]
): EarnedAchievement[] {
  const earnedIds = new Set(earned.map(a => a.id));
  const newlyEarned: EarnedAchievement[] = [];

  for (const achievement of ACHIEVEMENTS) {
    if (earnedIds.has(achievement.id)) continue;

    try {
      if (achievement.condition(state)) {
        const newAchievement: EarnedAchievement = {
          id: achievement.id,
          earnedAt: new Date().toISOString(),
          xpAwarded: achievement.xpReward,
        };
        newlyEarned.push(newAchievement);
        console.log('[Achievements] Unlocked:', achievement.title);
      }
    } catch (e) {
      console.log('[Achievements] Error checking:', achievement.id, e);
    }
  }

  return newlyEarned;
}

export function buildCheckState(params: {
  streakCount: number;
  totalXP: number;
  dailyXP: number;
  lessonsCompletedToday: number;
  gaps: { masteredAt?: string }[];
  readingSessions: number;
  totalSpeakingMinutes: number;
  recordingLogs: number;
  completedFoundationIds: string[];
  completedContentIds: string[];
  certifiedLevels: string[];
  pronFoundationCompleted: number;
  modulesCompleted: string[];
  counters: AchievementCounters;
  exercisePerformance: Record<string, any>;
}): AchievementCheckState {
  const masteredCount = params.gaps.filter(g => g.masteredAt).length;
  const now = new Date();

  return {
    streakCount: params.streakCount,
    totalXP: params.totalXP,
    masteredCount,
    totalGaps: params.gaps.length,
    lessonsCompleted: params.completedFoundationIds.length,
    readingSessions: params.readingSessions,
    totalSpeakingMinutes: params.totalSpeakingMinutes,
    recordingLogs: params.recordingLogs,
    completedFoundationIds: params.completedFoundationIds,
    completedContentIds: params.completedContentIds,
    certifiedLevels: params.certifiedLevels,
    pronFoundationCompleted: params.pronFoundationCompleted,
    modulesCompleted: params.modulesCompleted,
    tabsUsed: new Set<string>(),
    perfectLessons: params.counters.perfectLessons,
    maxConsecutiveCorrect: params.counters.maxConsecutiveCorrect,
    currentHour: now.getHours(),
    dailyXP: params.dailyXP,
    lessonsCompletedToday: params.lessonsCompletedToday,
    videosWatched: params.counters.videosWatched,
    exercisePerformance: params.exercisePerformance,
  };
}
