import { GapItem, FsrsState } from '@/types';

export type FsrsGrade = 1 | 2 | 3 | 4;

const W: number[] = [
  0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01,
  1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61,
];

const REQUEST_RETENTION = 0.9;
const MAX_STABILITY = 36500;

function daysBetween(a: Date, b: Date): number {
  return Math.max(0, (a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

function clampDifficulty(d: number): number {
  return Math.max(1, Math.min(10, d));
}

export function initialFsrs(): FsrsState {
  return {
    stability: 0,
    difficulty: 5,
    reps: 0,
    lapses: 0,
    dueAt: new Date().toISOString(),
  };
}

function initStability(grade: FsrsGrade): number {
  const s = W[grade - 1];
  return Math.max(0.1, s);
}

function initDifficulty(grade: FsrsGrade): number {
  const d = W[4] - (grade - 3) * W[5];
  return clampDifficulty(d);
}

function nextDifficulty(d: number, grade: FsrsGrade): number {
  const deltaD = -W[6] * (grade - 3);
  const newD = d + deltaD * (10 - d) / 9;
  const mean = W[4] * 0.5 + newD * 0.5;
  return clampDifficulty(mean);
}

function retrievability(stability: number, elapsedDays: number): number {
  if (stability <= 0) return 0;
  return Math.pow(1 + elapsedDays / (9 * stability), -1);
}

function nextRecallStability(d: number, s: number, r: number, grade: FsrsGrade): number {
  const hardPenalty = grade === 2 ? W[15] : 1;
  const easyBonus = grade === 4 ? W[16] : 1;
  const factor = Math.exp(W[8]) *
    (11 - d) *
    Math.pow(Math.max(s, 0.01), -W[9]) *
    (Math.exp((1 - r) * W[10]) - 1) *
    hardPenalty * easyBonus;
  return Math.min(MAX_STABILITY, Math.max(0.1, s * (1 + factor)));
}

function nextForgetStability(d: number, s: number, r: number): number {
  const f = W[11] * Math.pow(d, -W[12]) *
    (Math.pow(s + 1, W[13]) - 1) *
    Math.exp((1 - r) * W[14]);
  return Math.min(MAX_STABILITY, Math.max(0.1, f));
}

function intervalForStability(s: number): number {
  if (s <= 0) return 0;
  const i = (s / (9)) * (Math.pow(REQUEST_RETENTION, -1) - 1);
  return Math.max(1, Math.round(i));
}

export function updateFsrs(prev: FsrsState | undefined, grade: FsrsGrade, now: Date = new Date()): FsrsState {
  const state = prev ?? initialFsrs();
  const lastReview = state.lastReviewAt ? new Date(state.lastReviewAt) : null;

  let difficulty: number;
  let stability: number;
  let reps = state.reps + 1;
  let lapses = state.lapses;

  if (state.reps === 0 || state.stability <= 0) {
    difficulty = initDifficulty(grade);
    stability = initStability(grade);
    if (grade === 1) lapses += 1;
  } else {
    const elapsed = lastReview ? daysBetween(now, lastReview) : 0;
    const r = retrievability(state.stability, elapsed);
    difficulty = nextDifficulty(state.difficulty, grade);
    if (grade === 1) {
      stability = nextForgetStability(difficulty, state.stability, r);
      lapses += 1;
    } else {
      stability = nextRecallStability(difficulty, state.stability, r, grade);
    }
  }

  const intervalDays = intervalForStability(stability);
  const due = new Date(now);
  if (grade === 1) {
    due.setMinutes(due.getMinutes() + 10);
  } else {
    due.setDate(due.getDate() + intervalDays);
  }

  return {
    stability,
    difficulty,
    reps,
    lapses,
    lastReviewAt: now.toISOString(),
    dueAt: due.toISOString(),
  };
}

export function getRetrievability(state: FsrsState | undefined, now: Date = new Date()): number {
  if (!state || !state.lastReviewAt || state.stability <= 0) return 0;
  const elapsed = daysBetween(now, new Date(state.lastReviewAt));
  return retrievability(state.stability, elapsed);
}

export function getFsrsPriority(gap: GapItem, now: Date = new Date()): number {
  const state = gap.fsrs;
  if (!state) return gap.reviewCount === 0 ? 0.7 : 0.5;
  const r = getRetrievability(state, now);
  const overdue = Math.max(0, daysBetween(now, new Date(state.dueAt)));
  return (1 - r) + Math.min(overdue / 14, 1) * 0.3;
}

export function mapCorrectnessToGrade(isCorrect: boolean, confidence: 'low' | 'medium' | 'high' = 'medium'): FsrsGrade {
  if (!isCorrect) return 1;
  if (confidence === 'low') return 2;
  if (confidence === 'high') return 4;
  return 3;
}

export function getForgettingCurvePoints(state: FsrsState | undefined, days: number = 30): { day: number; retrievability: number }[] {
  const points: { day: number; retrievability: number }[] = [];
  if (!state || state.stability <= 0) {
    for (let i = 0; i <= days; i += 3) points.push({ day: i, retrievability: 0 });
    return points;
  }
  for (let i = 0; i <= days; i += 3) {
    points.push({ day: i, retrievability: retrievability(state.stability, i) });
  }
  return points;
}
