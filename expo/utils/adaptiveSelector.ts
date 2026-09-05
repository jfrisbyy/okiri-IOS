import { AdaptiveLearnerProfile, GapItem, GapPromptType } from '@/types';
import { getFsrsPriority } from '@/utils/fsrs';
import { initialDifficultyForGap, predictCorrect, rankGapsByIrtFit, pickOptionCountForTheta, distractorTightnessForTheta } from '@/utils/irtCalibration';
import { pickExerciseType } from '@/utils/exerciseTypeBandit';
import { findConfusionPartner, getTopConfusionPairs } from '@/utils/confusionModel';
import { isGapEligibleForReExposure } from '@/utils/contextReExposure';

export type AdaptiveStrategy = 'confusion_pair' | 'context_reexposure' | 'standard';

export interface AdaptiveSlot {
  gap: GapItem;
  strategy: AdaptiveStrategy;
  partnerGap?: GapItem;
  preferredType: GapPromptType;
  optionCount: number;
  distractorTightness: 'loose' | 'medium' | 'tight';
  predictedSuccess: number;
  fsrsPriority: number;
}

export interface AdaptiveLessonBrief {
  theta: number;
  slots: AdaptiveSlot[];
  topConfusionCount: number;
  reExposureCount: number;
  badge: 'tuned_to_level' | 'targeting_confusion' | 'wild_callback' | 'review_due';
}

export function buildAdaptiveLessonBrief(
  profile: AdaptiveLearnerProfile,
  gaps: GapItem[],
  feasibleTypesPerGap: (gap: GapItem) => GapPromptType[],
  desiredSlots: number = 6,
): AdaptiveLessonBrief {
  const theta = profile.abilityTheta;
  const active = gaps.filter(g => !g.masteredAt);

  const scored = active
    .map(g => ({
      gap: g,
      fsrs: getFsrsPriority(g),
      fit: Math.abs(predictCorrect(theta, initialDifficultyForGap(g)) - 0.775),
    }))
    .sort((a, b) => (b.fsrs - a.fsrs) + (a.fit - b.fit) * 0.3);

  const confusionPairs = getTopConfusionPairs(active, 3);
  const confusionGapIds = new Set<string>();
  confusionPairs.forEach(p => { confusionGapIds.add(p.gapA.id); confusionGapIds.add(p.gapB.id); });

  const reExposureCandidates = active.filter(isGapEligibleForReExposure);

  const usedIds = new Set<string>();
  const slots: AdaptiveSlot[] = [];
  const recentTypes: GapPromptType[] = [];
  let reExposures = 0;

  for (const entry of scored) {
    if (slots.length >= desiredSlots) break;
    const g = entry.gap;
    if (usedIds.has(g.id)) continue;

    let strategy: AdaptiveStrategy = 'standard';
    let partner: GapItem | undefined;

    if (confusionGapIds.has(g.id) && slots.filter(s => s.strategy === 'confusion_pair').length < 2) {
      const p = findConfusionPartner(g, active);
      if (p && !usedIds.has(p.id)) {
        strategy = 'confusion_pair';
        partner = p;
      }
    } else if (reExposureCandidates.some(r => r.id === g.id) && reExposures < 2) {
      strategy = 'context_reexposure';
      reExposures += 1;
    }

    const feasible = feasibleTypesPerGap(g);
    const preferred = pickExerciseType(profile, feasible, recentTypes);
    recentTypes.push(preferred);
    if (recentTypes.length > 3) recentTypes.shift();

    const b = initialDifficultyForGap(g);
    slots.push({
      gap: g,
      strategy,
      partnerGap: partner,
      preferredType: preferred,
      optionCount: pickOptionCountForTheta(theta),
      distractorTightness: distractorTightnessForTheta(theta),
      predictedSuccess: predictCorrect(theta, b),
      fsrsPriority: entry.fsrs,
    });
    usedIds.add(g.id);
    if (partner) usedIds.add(partner.id);
  }

  let badge: AdaptiveLessonBrief['badge'] = 'tuned_to_level';
  if (slots.some(s => s.strategy === 'confusion_pair')) badge = 'targeting_confusion';
  else if (slots.some(s => s.strategy === 'context_reexposure')) badge = 'wild_callback';
  else if (slots.some(s => s.fsrsPriority > 0.7)) badge = 'review_due';

  return {
    theta,
    slots,
    topConfusionCount: confusionPairs.length,
    reExposureCount: reExposures,
    badge,
  };
}

export function rankPriorityGaps(profile: AdaptiveLearnerProfile, gaps: GapItem[], limit: number): GapItem[] {
  const active = gaps.filter(g => !g.masteredAt);
  const irtRanked = rankGapsByIrtFit(profile.abilityTheta, active);
  return irtRanked
    .map(g => ({ g, score: getFsrsPriority(g) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(x => x.g);
}

export function badgeText(badge: AdaptiveLessonBrief['badge']): string {
  switch (badge) {
    case 'targeting_confusion': return 'Targeting your top confusion';
    case 'wild_callback': return 'Words from the wild';
    case 'review_due': return 'Right before you forget';
    default: return 'Tuned to your level';
  }
}
