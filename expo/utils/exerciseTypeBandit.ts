import { AdaptiveLearnerProfile, ExerciseTypeStats, GapPromptType } from '@/types';

const EPSILON = 0.15;
const DELAYED_WINDOW_DAYS = 7;
const PRIOR_STRENGTH = 3;

export function emptyStats(): ExerciseTypeStats {
  return { attempts: 0, correct: 0, delayedCorrect: 0, delayedAttempts: 0 };
}

export function retentionScore(stats: ExerciseTypeStats | undefined): number {
  if (!stats) return 0.5;
  const immediate = (stats.correct + PRIOR_STRENGTH * 0.5) / (stats.attempts + PRIOR_STRENGTH);
  const delayed = stats.delayedAttempts > 0
    ? (stats.delayedCorrect + PRIOR_STRENGTH * 0.5) / (stats.delayedAttempts + PRIOR_STRENGTH)
    : immediate;
  return immediate * 0.3 + delayed * 0.7;
}

export function pickExerciseType(
  profile: AdaptiveLearnerProfile,
  feasibleTypes: GapPromptType[],
  avoidRecentTypes: GapPromptType[] = [],
): GapPromptType {
  if (feasibleTypes.length === 0) return 'multiple_choice';
  if (feasibleTypes.length === 1) return feasibleTypes[0];

  const filtered = feasibleTypes.filter(t => !avoidRecentTypes.includes(t));
  const pool = filtered.length > 0 ? filtered : feasibleTypes;

  if (Math.random() < EPSILON) {
    const unexplored = pool.filter(t => (profile.exerciseTypeStats[t]?.attempts ?? 0) < 3);
    if (unexplored.length > 0) {
      return unexplored[Math.floor(Math.random() * unexplored.length)];
    }
    return pool[Math.floor(Math.random() * pool.length)];
  }

  let best: GapPromptType = pool[0];
  let bestScore = -1;
  for (const t of pool) {
    const score = retentionScore(profile.exerciseTypeStats[t]) + Math.random() * 0.02;
    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }
  return best;
}

export function recordImmediate(
  profile: AdaptiveLearnerProfile,
  type: GapPromptType,
  isCorrect: boolean,
): AdaptiveLearnerProfile {
  const stats = { ...(profile.exerciseTypeStats[type] ?? emptyStats()) };
  stats.attempts += 1;
  if (isCorrect) stats.correct += 1;
  stats.lastUsedAt = new Date().toISOString();
  return {
    ...profile,
    exerciseTypeStats: { ...profile.exerciseTypeStats, [type]: stats },
    lastUpdatedAt: new Date().toISOString(),
  };
}

export function recordDelayed(
  profile: AdaptiveLearnerProfile,
  type: GapPromptType,
  isCorrect: boolean,
): AdaptiveLearnerProfile {
  const stats = { ...(profile.exerciseTypeStats[type] ?? emptyStats()) };
  stats.delayedAttempts += 1;
  if (isCorrect) stats.delayedCorrect += 1;
  return {
    ...profile,
    exerciseTypeStats: { ...profile.exerciseTypeStats, [type]: stats },
    lastUpdatedAt: new Date().toISOString(),
  };
}

export function getBestType(profile: AdaptiveLearnerProfile): GapPromptType | null {
  const entries = Object.entries(profile.exerciseTypeStats) as [GapPromptType, ExerciseTypeStats][];
  if (entries.length === 0) return null;
  const eligible = entries.filter(([, s]) => s.attempts >= 3);
  if (eligible.length === 0) return null;
  eligible.sort((a, b) => retentionScore(b[1]) - retentionScore(a[1]));
  return eligible[0][0];
}

export function isDelayedWindow(lastUsedAt: string | undefined): boolean {
  if (!lastUsedAt) return false;
  const days = (Date.now() - new Date(lastUsedAt).getTime()) / (1000 * 60 * 60 * 24);
  return days >= DELAYED_WINDOW_DAYS;
}
