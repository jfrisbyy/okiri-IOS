import { GapItem } from '../types';

export type SrsQuality = 1 | 2 | 4 | 5;

export interface SrsIntervalPreview {
  again: { days: number; label: string };
  hard: { days: number; label: string };
  good: { days: number; label: string };
  easy: { days: number; label: string };
}

export function formatIntervalDays(days: number): string {
  if (days <= 0) return '<10m';
  if (days === 1) return '1d';
  if (days < 30) return `${days}d`;
  if (days < 365) {
    const months = Math.round(days / 30);
    return `${months}mo`;
  }
  const years = (days / 365).toFixed(1);
  return `${years}y`;
}

export function previewNextIntervals(gap: GapItem): SrsIntervalPreview {
  const againDays = 0;

  let hardDays: number;
  if (gap.reviewCount === 0) hardDays = 1;
  else hardDays = Math.max(1, Math.ceil(gap.currentInterval * 1.2));

  let goodDays: number;
  if (gap.reviewCount === 0) goodDays = 1;
  else if (gap.reviewCount === 1) goodDays = 6;
  else goodDays = Math.ceil(gap.currentInterval * gap.easeFactor);

  let easyDays: number;
  if (gap.reviewCount === 0) easyDays = 4;
  else easyDays = Math.ceil(gap.currentInterval * gap.easeFactor * 1.3);

  return {
    again: { days: againDays, label: '<10m' },
    hard: { days: hardDays, label: formatIntervalDays(hardDays) },
    good: { days: goodDays, label: formatIntervalDays(goodDays) },
    easy: { days: easyDays, label: formatIntervalDays(easyDays) },
  };
}

export function updateSrsAnki(gap: GapItem, quality: SrsQuality): GapItem {
  const updated = { ...gap };

  switch (quality) {
    case 1:
      updated.consecutiveCorrect = 0;
      updated.currentInterval = 0;
      updated.easeFactor = Math.max(1.3, updated.easeFactor - 0.2);
      break;
    case 2:
      if (updated.reviewCount === 0) {
        updated.currentInterval = 1;
      } else {
        updated.currentInterval = Math.max(1, Math.ceil(updated.currentInterval * 1.2));
      }
      updated.easeFactor = Math.max(1.3, updated.easeFactor - 0.15);
      break;
    case 4:
      updated.consecutiveCorrect++;
      if (updated.reviewCount === 0) {
        updated.currentInterval = 1;
      } else if (updated.reviewCount === 1) {
        updated.currentInterval = 6;
      } else {
        updated.currentInterval = Math.ceil(updated.currentInterval * updated.easeFactor);
      }
      break;
    case 5:
      updated.consecutiveCorrect++;
      if (updated.reviewCount === 0) {
        updated.currentInterval = 4;
      } else {
        updated.currentInterval = Math.ceil(updated.currentInterval * updated.easeFactor * 1.3);
      }
      updated.easeFactor = Math.max(1.3, updated.easeFactor + 0.15);
      break;
  }

  updated.reviewCount++;
  updated.lastReviewedAt = new Date().toISOString();

  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + Math.max(updated.currentInterval, 0));
  updated.nextReviewAt = nextDate.toISOString();

  if (updated.consecutiveCorrect >= 5) {
    updated.masteredAt = new Date().toISOString();
  }

  return updated;
}

export function updateSrsData(gap: GapItem, quality: number): GapItem {
  const updatedGap = { ...gap };

  if (quality < 3) {
    updatedGap.consecutiveCorrect = Math.max(0, updatedGap.consecutiveCorrect - 2);
    updatedGap.currentInterval = 1;
  } else {
    updatedGap.consecutiveCorrect++;
    if (updatedGap.reviewCount === 0) {
      updatedGap.currentInterval = 1;
    } else if (updatedGap.reviewCount === 1) {
      updatedGap.currentInterval = 6;
    } else {
      updatedGap.currentInterval = Math.ceil(updatedGap.currentInterval * updatedGap.easeFactor);
    }
    const newEF = updatedGap.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    updatedGap.easeFactor = Math.max(1.3, newEF);
  }

  updatedGap.reviewCount++;
  updatedGap.lastReviewedAt = new Date().toISOString();
  const nextReviewDate = new Date();
  nextReviewDate.setDate(nextReviewDate.getDate() + updatedGap.currentInterval);
  updatedGap.nextReviewAt = nextReviewDate.toISOString();

  if (updatedGap.consecutiveCorrect >= 5) {
    updatedGap.masteredAt = new Date().toISOString();
  }

  return updatedGap;
}

export function mapCorrectnessToQuality(isCorrect: boolean): number {
  return isCorrect ? 4 : 1;
}

export function getSrsSessionCards(
  gaps: GapItem[],
  maxReview: number = 20,
  maxNew: number = 5,
): { dueCards: GapItem[]; newCards: GapItem[]; total: number } {
  const now = new Date();

  const dueCards = gaps
    .filter(g => !g.masteredAt && g.reviewCount > 0 && new Date(g.nextReviewAt) <= now)
    .sort((a, b) => new Date(a.nextReviewAt).getTime() - new Date(b.nextReviewAt).getTime())
    .slice(0, maxReview);

  const newCards = gaps
    .filter(g => !g.masteredAt && g.reviewCount === 0)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .slice(0, maxNew);

  return {
    dueCards,
    newCards,
    total: dueCards.length + newCards.length,
  };
}
