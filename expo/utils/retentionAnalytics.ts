import type { GapItem } from '@/types';

export type RetentionBucket = 'fresh' | 'fading' | 'at_risk' | 'mastered' | 'new';

export interface RetentionStats {
  totalLearned: number;
  fresh: GapItem[];
  fading: GapItem[];
  atRisk: GapItem[];
  mastered: GapItem[];
  newItems: GapItem[];
  dueToday: GapItem[];
  retentionPercent: number;
  masteredThisWeek: number;
  slippingBack: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function classifyGap(gap: GapItem, now: Date = new Date()): RetentionBucket {
  if (gap.masteredAt) return 'mastered';
  if (!gap.reviewCount || gap.reviewCount === 0) return 'new';

  const nextReview = new Date(gap.nextReviewAt).getTime();
  const nowMs = now.getTime();
  const overdueMs = nowMs - nextReview;
  const overdueDays = overdueMs / DAY_MS;

  if (overdueDays > 3 || gap.consecutiveCorrect === 0) return 'at_risk';
  if (overdueDays > 0) return 'fading';

  const daysSinceReview = gap.lastReviewedAt
    ? (nowMs - new Date(gap.lastReviewedAt).getTime()) / DAY_MS
    : 0;
  if (gap.consecutiveCorrect <= 1 && daysSinceReview > 2) return 'fading';
  return 'fresh';
}

export function computeRetentionStats(gaps: GapItem[]): RetentionStats {
  const now = new Date();
  const fresh: GapItem[] = [];
  const fading: GapItem[] = [];
  const atRisk: GapItem[] = [];
  const mastered: GapItem[] = [];
  const newItems: GapItem[] = [];
  const dueToday: GapItem[] = [];

  for (const gap of gaps) {
    const bucket = classifyGap(gap, now);
    if (bucket === 'mastered') mastered.push(gap);
    else if (bucket === 'fresh') fresh.push(gap);
    else if (bucket === 'fading') fading.push(gap);
    else if (bucket === 'at_risk') atRisk.push(gap);
    else newItems.push(gap);

    if (!gap.masteredAt && gap.reviewCount > 0 && new Date(gap.nextReviewAt) <= now) {
      dueToday.push(gap);
    }
  }

  const totalLearned = fresh.length + fading.length + atRisk.length + mastered.length;
  const retentionScore =
    mastered.length * 1.0 + fresh.length * 0.85 + fading.length * 0.5 + atRisk.length * 0.15;
  const retentionPercent = totalLearned > 0
    ? Math.round((retentionScore / totalLearned) * 100)
    : 0;

  const weekAgo = now.getTime() - 7 * DAY_MS;
  const masteredThisWeek = gaps.filter(
    g => g.masteredAt && new Date(g.masteredAt).getTime() >= weekAgo,
  ).length;

  return {
    totalLearned,
    fresh,
    fading,
    atRisk,
    mastered,
    newItems,
    dueToday,
    retentionPercent,
    masteredThisWeek,
    slippingBack: atRisk.length,
  };
}

export function getRetentionLabel(percent: number): { label: string; color: string } {
  if (percent >= 85) return { label: 'Excellent', color: '#10B981' };
  if (percent >= 70) return { label: 'Strong', color: '#059669' };
  if (percent >= 50) return { label: 'Fading', color: '#F59E0B' };
  return { label: 'At risk', color: '#EF4444' };
}
