import { AdaptiveLearnerProfile, GapItem } from '@/types';

const LEARN_RATE_THETA = 0.15;
const LEARN_RATE_B = 0.08;
const DEFAULT_DIFFICULTY = 0;

export function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

export function predictCorrect(theta: number, b: number): number {
  return sigmoid(theta - b);
}

export interface IrtUpdate {
  newTheta: number;
  newDifficulty: number;
  predicted: number;
}

export function updateIrt(theta: number, difficulty: number, isCorrect: boolean): IrtUpdate {
  const p = predictCorrect(theta, difficulty);
  const y = isCorrect ? 1 : 0;
  const err = y - p;
  return {
    newTheta: clamp(theta + LEARN_RATE_THETA * err, -4, 4),
    newDifficulty: clamp(difficulty - LEARN_RATE_B * err, -4, 4),
    predicted: p,
  };
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

export function defaultProfile(): AdaptiveLearnerProfile {
  return {
    abilityTheta: 0,
    thetaSamples: 0,
    exerciseTypeStats: {},
    lastUpdatedAt: new Date().toISOString(),
  };
}

export function initialDifficultyForGap(gap: GapItem): number {
  if (typeof gap.irtDifficulty === 'number') return gap.irtDifficulty;
  const levelMap: Record<string, number> = { A1: -2, A2: -1, B1: 0, B2: 1, C1: 2, C2: 3 };
  const base = gap.cefrLevel ? (levelMap[gap.cefrLevel] ?? 0) : 0;
  const diffAdj = gap.difficulty === 'hard' ? 0.5 : gap.difficulty === 'easy' ? -0.5 : 0;
  return base + diffAdj;
}

export function pickOptionCountForTheta(theta: number): number {
  if (theta < -1) return 3;
  if (theta < 1) return 4;
  if (theta < 2) return 5;
  return 6;
}

export function targetSuccessWindow(): { min: number; max: number } {
  return { min: 0.7, max: 0.85 };
}

export function isQuestionInSweetSpot(theta: number, b: number): boolean {
  const p = predictCorrect(theta, b);
  const { min, max } = targetSuccessWindow();
  return p >= min && p <= max;
}

export function rankGapsByIrtFit(theta: number, gaps: GapItem[]): GapItem[] {
  return [...gaps].sort((a, b) => {
    const da = initialDifficultyForGap(a);
    const db = initialDifficultyForGap(b);
    const pa = predictCorrect(theta, da);
    const pb = predictCorrect(theta, db);
    const target = 0.775;
    return Math.abs(pa - target) - Math.abs(pb - target);
  });
}

export function distractorTightnessForTheta(theta: number): 'loose' | 'medium' | 'tight' {
  if (theta < -0.5) return 'loose';
  if (theta < 1.5) return 'medium';
  return 'tight';
}
