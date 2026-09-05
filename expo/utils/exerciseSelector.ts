import { GapItem, GapCategory, GapPromptType, CEFRLevel, Difficulty } from '@/types';

export interface ExercisePerformance {
  [exerciseType: string]: {
    attempts: number;
    correct: number;
    lastAttemptAt: string;
  };
}

export interface ExerciseWeight {
  type: GapPromptType;
  weight: number;
}

export interface ExerciseDistribution {
  weights: ExerciseWeight[];
  promptHint: string;
}

const ALL_EXERCISE_TYPES: GapPromptType[] = [
  'multiple_choice', 'fill_blank', 'correction', 'translation', 'production',
  'sentence_build', 'spot_the_error', 'true_false', 'match_pairs', 'word_order',
  'tap_what_you_hear', 'listen_and_type', 'speak_to_answer',
];

const SIMPLE_TYPES: GapPromptType[] = ['multiple_choice', 'true_false', 'tap_what_you_hear', 'match_pairs'];
const INTERMEDIATE_TYPES: GapPromptType[] = ['fill_blank', 'correction', 'spot_the_error', 'word_order'];
const ADVANCED_TYPES: GapPromptType[] = ['translation', 'production', 'sentence_build', 'listen_and_type', 'speak_to_answer'];

const CEFR_RANK: Record<CEFRLevel, number> = {
  'A1': 1, 'A2': 2, 'B1': 3, 'B2': 4, 'C1': 5, 'C2': 6,
};

const CATEGORY_TYPE_AFFINITY: Record<GapCategory, GapPromptType[]> = {
  vocabulary: ['multiple_choice', 'match_pairs', 'fill_blank', 'translation'],
  grammar: ['fill_blank', 'correction', 'spot_the_error', 'sentence_build', 'word_order'],
  pronunciation: ['tap_what_you_hear', 'multiple_choice', 'true_false', 'listen_and_type', 'speak_to_answer'],
  phrasing: ['sentence_build', 'word_order', 'fill_blank', 'production'],
  register: ['correction', 'spot_the_error', 'translation', 'production'],
};

function getAccuracy(perf: ExercisePerformance, type: string): number | null {
  const data = perf[type];
  if (!data || data.attempts < 2) return null;
  return data.correct / data.attempts;
}

function getWeakestCategories(gaps: GapItem[]): GapCategory[] {
  const categoryStats: Record<GapCategory, { hard: number; total: number }> = {
    vocabulary: { hard: 0, total: 0 },
    grammar: { hard: 0, total: 0 },
    pronunciation: { hard: 0, total: 0 },
    phrasing: { hard: 0, total: 0 },
    register: { hard: 0, total: 0 },
  };

  for (const gap of gaps) {
    if (gap.masteredAt) continue;
    const cat = gap.category;
    categoryStats[cat].total += 1;
    if (gap.difficulty === 'hard') {
      categoryStats[cat].hard += 1;
    }
  }

  const ranked = (Object.entries(categoryStats) as [GapCategory, { hard: number; total: number }][])
    .filter(([, s]) => s.total > 0)
    .sort((a, b) => {
      const ratioA = a[1].hard / a[1].total;
      const ratioB = b[1].hard / b[1].total;
      return ratioB - ratioA;
    });

  return ranked.slice(0, 2).map(([cat]) => cat);
}

function getCefrRank(gaps: GapItem[], difficulty: Difficulty): number {
  const cefrFromGaps = gaps
    .filter(g => g.cefrLevel)
    .map(g => CEFR_RANK[g.cefrLevel!]);

  if (cefrFromGaps.length > 0) {
    const avg = cefrFromGaps.reduce((a, b) => a + b, 0) / cefrFromGaps.length;
    return Math.round(avg);
  }

  const difficultyMap: Record<Difficulty, number> = {
    beginner: 1,
    easy: 2,
    medium: 3,
    hard: 4,
    university: 5,
  };
  return difficultyMap[difficulty] ?? 2;
}

export function selectExerciseDistribution(
  gaps: GapItem[],
  exercisePerformance: ExercisePerformance,
  difficulty: Difficulty,
): ExerciseDistribution {
  const cefrRank = getCefrRank(gaps, difficulty);
  const weakCategories = getWeakestCategories(gaps);

  console.log('[ExerciseSelector] CEFR rank:', cefrRank, 'weak categories:', weakCategories);

  const weights = new Map<GapPromptType, number>();
  for (const type of ALL_EXERCISE_TYPES) {
    weights.set(type, 1.0);
  }

  if (cefrRank >= 4) {
    for (const t of ADVANCED_TYPES) weights.set(t, (weights.get(t) ?? 1) * 1.8);
    for (const t of SIMPLE_TYPES) weights.set(t, (weights.get(t) ?? 1) * 0.5);
  } else if (cefrRank >= 3) {
    for (const t of INTERMEDIATE_TYPES) weights.set(t, (weights.get(t) ?? 1) * 1.5);
    for (const t of ADVANCED_TYPES) weights.set(t, (weights.get(t) ?? 1) * 1.2);
  } else {
    for (const t of SIMPLE_TYPES) weights.set(t, (weights.get(t) ?? 1) * 1.4);
    for (const t of ADVANCED_TYPES) weights.set(t, (weights.get(t) ?? 1) * 0.4);
  }

  for (const cat of weakCategories) {
    const affinityTypes = CATEGORY_TYPE_AFFINITY[cat] ?? [];
    for (const t of affinityTypes) {
      weights.set(t, (weights.get(t) ?? 1) * 1.3);
    }
  }

  const performanceEntries = Object.keys(exercisePerformance);
  if (performanceEntries.length >= 2) {
    for (const type of ALL_EXERCISE_TYPES) {
      const accuracy = getAccuracy(exercisePerformance, type);
      if (accuracy === null) {
        weights.set(type, (weights.get(type) ?? 1) * 1.1);
        continue;
      }

      if (accuracy < 0.4) {
        weights.set(type, (weights.get(type) ?? 1) * 2.0);
      } else if (accuracy < 0.6) {
        weights.set(type, (weights.get(type) ?? 1) * 1.5);
      } else if (accuracy > 0.9) {
        weights.set(type, (weights.get(type) ?? 1) * 0.6);
      } else if (accuracy > 0.8) {
        weights.set(type, (weights.get(type) ?? 1) * 0.8);
      }
    }
  }

  const totalWeight = Array.from(weights.values()).reduce((a, b) => a + b, 0);
  const normalized: ExerciseWeight[] = ALL_EXERCISE_TYPES.map(type => ({
    type,
    weight: Math.round(((weights.get(type) ?? 1) / totalWeight) * 100),
  }));

  normalized.sort((a, b) => b.weight - a.weight);

  const top5 = normalized.slice(0, 5);
  const bottom3 = normalized.slice(-3);

  const preferredTypes = top5.map(w => w.type);
  const reducedTypes = bottom3.map(w => w.type);

  const promptHint = buildPromptHint(preferredTypes, reducedTypes, cefrRank);

  console.log('[ExerciseSelector] Distribution:', normalized.map(w => `${w.type}:${w.weight}%`).join(', '));

  return { weights: normalized, promptHint };
}

function buildPromptHint(
  preferred: GapPromptType[],
  reduced: GapPromptType[],
  cefrRank: number,
): string {
  const lines: string[] = [];

  lines.push(`EXERCISE TYPE PREFERENCE (based on learner's performance history):`);
  lines.push(`- PRIORITIZE these types (learner needs more practice): ${preferred.join(', ')}`);
  lines.push(`- USE LESS of these types (learner already strong): ${reduced.join(', ')}`);

  if (cefrRank >= 4) {
    lines.push(`- Learner is advanced (B2+). Favor translation, production, and sentence_build. Minimize multiple_choice and true_false.`);
  } else if (cefrRank <= 2) {
    lines.push(`- Learner is beginner (A1-A2). Include multiple_choice and true_false for confidence. Limit production and translation.`);
  }

  lines.push(`- Aim for at least 60% of questions from the PRIORITIZE list.`);

  return lines.join('\n');
}

export function recordExerciseResult(
  performance: ExercisePerformance,
  exerciseType: GapPromptType,
  isCorrect: boolean,
): ExercisePerformance {
  const existing = performance[exerciseType] ?? { attempts: 0, correct: 0, lastAttemptAt: '' };
  return {
    ...performance,
    [exerciseType]: {
      attempts: existing.attempts + 1,
      correct: existing.correct + (isCorrect ? 1 : 0),
      lastAttemptAt: new Date().toISOString(),
    },
  };
}

export function getExerciseAccuracySummary(
  performance: ExercisePerformance,
): { type: GapPromptType; accuracy: number; attempts: number }[] {
  return ALL_EXERCISE_TYPES
    .filter(type => performance[type] && performance[type].attempts > 0)
    .map(type => ({
      type,
      accuracy: performance[type].correct / performance[type].attempts,
      attempts: performance[type].attempts,
    }))
    .sort((a, b) => a.accuracy - b.accuracy);
}
