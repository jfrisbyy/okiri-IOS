import { GapItem, GapCategory, CEFRLevel, ModuleId } from '@/types';

export type GapUrgency = 'critical' | 'due' | 'upcoming' | 'stable' | 'mastered' | 'checkin_due';

export interface GapUrgencyInfo {
  urgency: GapUrgency;
  priority: number;
  daysOverdue: number;
  daysSinceCreated: number;
  label: string;
  color: string;
}

export interface GapScheduleSummary {
  critical: GapItem[];
  due: GapItem[];
  upcoming: GapItem[];
  stable: GapItem[];
  mastered: GapItem[];
  checkinDue: GapItem[];
  totalActionable: number;
  shouldBlockProgress: boolean;
  blockReason?: string;
}

export interface LessonInjection {
  preLessonGaps: GapItem[];
  duringLessonGaps: GapItem[];
  totalInjected: number;
  injectionReason: string;
}

const URGENCY_COLORS: Record<GapUrgency, string> = {
  critical: '#DC2626',
  due: '#F59E0B',
  upcoming: '#3B82F6',
  stable: '#6B7280',
  mastered: '#10B981',
  checkin_due: '#8B5CF6',
};

const URGENCY_LABELS: Record<GapUrgency, string> = {
  critical: 'Needs attention now',
  due: 'Due for review',
  upcoming: 'Coming up soon',
  stable: 'On track',
  mastered: 'Mastered',
  checkin_due: 'Mastery check-in',
};

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const MS_PER_HOUR = 1000 * 60 * 60;

const CRITICAL_OVERDUE_DAYS = 3;
const CHECKIN_INTERVAL_DAYS = 30;
const MAX_CRITICAL_BEFORE_BLOCK = 8;
const MAX_PRE_LESSON_GAPS = 4;
const MAX_DURING_LESSON_GAPS = 3;
const NEW_GAP_REVIEW_WINDOW_HOURS = 24;

function daysBetween(date1: Date, date2: Date): number {
  return (date2.getTime() - date1.getTime()) / MS_PER_DAY;
}

function hoursBetween(date1: Date, date2: Date): number {
  return (date2.getTime() - date1.getTime()) / MS_PER_HOUR;
}

export function classifyGapUrgency(gap: GapItem): GapUrgencyInfo {
  const now = new Date();
  const createdAt = new Date(gap.createdAt);
  const daysSinceCreated = daysBetween(createdAt, now);

  if (gap.masteredAt) {
    const masteredDate = new Date(gap.masteredAt);
    const daysSinceMastered = daysBetween(masteredDate, now);
    const lastReviewed = gap.lastReviewedAt ? new Date(gap.lastReviewedAt) : masteredDate;
    const daysSinceLastReview = daysBetween(lastReviewed, now);

    if (daysSinceMastered >= CHECKIN_INTERVAL_DAYS && daysSinceLastReview >= CHECKIN_INTERVAL_DAYS) {
      return {
        urgency: 'checkin_due',
        priority: 15,
        daysOverdue: Math.floor(daysSinceLastReview - CHECKIN_INTERVAL_DAYS),
        daysSinceCreated: Math.floor(daysSinceCreated),
        label: URGENCY_LABELS.checkin_due,
        color: URGENCY_COLORS.checkin_due,
      };
    }

    return {
      urgency: 'mastered',
      priority: 0,
      daysOverdue: 0,
      daysSinceCreated: Math.floor(daysSinceCreated),
      label: URGENCY_LABELS.mastered,
      color: URGENCY_COLORS.mastered,
    };
  }

  const nextReview = new Date(gap.nextReviewAt);
  const daysUntilDue = daysBetween(now, nextReview);
  const daysOverdue = Math.max(0, -daysUntilDue);

  const isNewGap = gap.reviewCount === 0;
  const hoursSinceCreated = hoursBetween(createdAt, now);
  const hasRecentFailures = gap.consecutiveCorrect === 0 && gap.reviewCount >= 2;

  if (daysOverdue >= CRITICAL_OVERDUE_DAYS) {
    return {
      urgency: 'critical',
      priority: 100 + Math.floor(daysOverdue),
      daysOverdue: Math.floor(daysOverdue),
      daysSinceCreated: Math.floor(daysSinceCreated),
      label: URGENCY_LABELS.critical,
      color: URGENCY_COLORS.critical,
    };
  }

  if (isNewGap && hoursSinceCreated >= NEW_GAP_REVIEW_WINDOW_HOURS) {
    return {
      urgency: 'critical',
      priority: 90,
      daysOverdue: Math.floor(daysOverdue),
      daysSinceCreated: Math.floor(daysSinceCreated),
      label: 'New — never reviewed',
      color: URGENCY_COLORS.critical,
    };
  }

  if (hasRecentFailures && daysOverdue > 0) {
    return {
      urgency: 'critical',
      priority: 85 + Math.floor(daysOverdue),
      daysOverdue: Math.floor(daysOverdue),
      daysSinceCreated: Math.floor(daysSinceCreated),
      label: 'Struggling — needs practice',
      color: URGENCY_COLORS.critical,
    };
  }

  if (daysOverdue > 0) {
    return {
      urgency: 'due',
      priority: 50 + Math.floor(daysOverdue * 10),
      daysOverdue: Math.floor(daysOverdue),
      daysSinceCreated: Math.floor(daysSinceCreated),
      label: URGENCY_LABELS.due,
      color: URGENCY_COLORS.due,
    };
  }

  if (daysUntilDue <= 1) {
    return {
      urgency: 'upcoming',
      priority: 30,
      daysOverdue: 0,
      daysSinceCreated: Math.floor(daysSinceCreated),
      label: URGENCY_LABELS.upcoming,
      color: URGENCY_COLORS.upcoming,
    };
  }

  return {
    urgency: 'stable',
    priority: 10,
    daysOverdue: 0,
    daysSinceCreated: Math.floor(daysSinceCreated),
    label: URGENCY_LABELS.stable,
    color: URGENCY_COLORS.stable,
  };
}

export function getGapScheduleSummary(gaps: GapItem[]): GapScheduleSummary {
  const critical: GapItem[] = [];
  const due: GapItem[] = [];
  const upcoming: GapItem[] = [];
  const stable: GapItem[] = [];
  const mastered: GapItem[] = [];
  const checkinDue: GapItem[] = [];

  for (const gap of gaps) {
    const info = classifyGapUrgency(gap);
    switch (info.urgency) {
      case 'critical': critical.push(gap); break;
      case 'due': due.push(gap); break;
      case 'upcoming': upcoming.push(gap); break;
      case 'stable': stable.push(gap); break;
      case 'mastered': mastered.push(gap); break;
      case 'checkin_due': checkinDue.push(gap); break;
    }
  }

  const sortByPriority = (a: GapItem, b: GapItem) => {
    const aInfo = classifyGapUrgency(a);
    const bInfo = classifyGapUrgency(b);
    return bInfo.priority - aInfo.priority;
  };

  critical.sort(sortByPriority);
  due.sort(sortByPriority);

  const totalActionable = critical.length + due.length + checkinDue.length;
  const shouldBlockProgress = critical.length >= MAX_CRITICAL_BEFORE_BLOCK;
  const blockReason = shouldBlockProgress
    ? `You have ${critical.length} critical gaps that need attention before moving on. Review them to keep your learning solid.`
    : undefined;

  return {
    critical,
    due,
    upcoming,
    stable,
    mastered,
    checkinDue,
    totalActionable,
    shouldBlockProgress,
    blockReason,
  };
}

const MODULE_CEFR_MAP: Record<ModuleId, CEFRLevel> = {
  'module-1': 'A1',
  'module-2': 'A2',
  'module-3': 'A2',
  'module-4': 'B1',
  'module-5': 'B2',
  'module-6': 'C1',
  'module-7': 'C1',
  'module-8': 'C2',
};

const MODULE_CATEGORIES: Record<ModuleId, GapCategory[]> = {
  'module-1': ['pronunciation', 'vocabulary'],
  'module-2': ['vocabulary', 'grammar', 'phrasing'],
  'module-3': ['grammar', 'vocabulary'],
  'module-4': ['phrasing', 'register', 'grammar'],
  'module-5': ['grammar', 'register', 'phrasing'],
  'module-6': ['register', 'grammar', 'phrasing'],
  'module-7': ['register', 'grammar', 'phrasing', 'vocabulary'],
  'module-8': ['register', 'phrasing', 'vocabulary', 'grammar', 'pronunciation'],
};

export function getGapsForLessonInjection(
  gaps: GapItem[],
  moduleId: ModuleId,
): LessonInjection {
  const moduleCefr = MODULE_CEFR_MAP[moduleId];
  const moduleCategories = MODULE_CATEGORIES[moduleId] || ['vocabulary', 'grammar'];

  const summary = getGapScheduleSummary(gaps);

  const preLessonGaps: GapItem[] = [];
  const duringLessonGaps: GapItem[] = [];
  const reasons: string[] = [];

  for (const gap of summary.critical) {
    if (preLessonGaps.length >= MAX_PRE_LESSON_GAPS) break;
    preLessonGaps.push(gap);
  }

  if (preLessonGaps.length > 0) {
    reasons.push(`${preLessonGaps.length} critical gap${preLessonGaps.length > 1 ? 's' : ''} need review`);
  }

  const remainingPreSlots = MAX_PRE_LESSON_GAPS - preLessonGaps.length;
  if (remainingPreSlots > 0) {
    const relevantDue = summary.due.filter(g => {
      const matchesCefr = !g.cefrLevel || g.cefrLevel === moduleCefr;
      const matchesCategory = moduleCategories.includes(g.category);
      return matchesCefr || matchesCategory;
    });

    for (const gap of relevantDue) {
      if (preLessonGaps.length >= MAX_PRE_LESSON_GAPS) break;
      if (!preLessonGaps.some(g => g.id === gap.id)) {
        preLessonGaps.push(gap);
      }
    }
  }

  const relevantUpcoming = summary.upcoming.filter(g => {
    const matchesCategory = moduleCategories.includes(g.category);
    const matchesCefr = !g.cefrLevel || g.cefrLevel === moduleCefr;
    return matchesCategory && matchesCefr;
  });

  for (const gap of relevantUpcoming) {
    if (duringLessonGaps.length >= MAX_DURING_LESSON_GAPS) break;
    if (!preLessonGaps.some(g => g.id === gap.id)) {
      duringLessonGaps.push(gap);
    }
  }

  if (duringLessonGaps.length < MAX_DURING_LESSON_GAPS) {
    for (const gap of summary.checkinDue) {
      if (duringLessonGaps.length >= MAX_DURING_LESSON_GAPS) break;
      if (!preLessonGaps.some(g => g.id === gap.id)) {
        duringLessonGaps.push(gap);
      }
    }
  }

  if (duringLessonGaps.length > 0) {
    reasons.push(`${duringLessonGaps.length} gap${duringLessonGaps.length > 1 ? 's' : ''} woven into lesson`);
  }

  return {
    preLessonGaps,
    duringLessonGaps,
    totalInjected: preLessonGaps.length + duringLessonGaps.length,
    injectionReason: reasons.join(' · ') || 'No gaps to review right now',
  };
}

export function shouldForceGapReview(gaps: GapItem[]): { force: boolean; reason: string; count: number } {
  const summary = getGapScheduleSummary(gaps);

  if (summary.critical.length >= 5) {
    return {
      force: true,
      reason: `${summary.critical.length} gaps are falling behind. A quick review will keep your learning on track.`,
      count: summary.critical.length,
    };
  }

  const newUnreviewedCount = gaps.filter(g => {
    if (g.masteredAt || g.reviewCount > 0) return false;
    const hoursSince = hoursBetween(new Date(g.createdAt), new Date());
    return hoursSince >= NEW_GAP_REVIEW_WINDOW_HOURS;
  }).length;

  if (newUnreviewedCount >= 3) {
    return {
      force: true,
      reason: `${newUnreviewedCount} new gaps haven't been practiced yet. Review them before they slip away.`,
      count: newUnreviewedCount,
    };
  }

  return { force: false, reason: '', count: 0 };
}

export function getReactivationData(gap: GapItem): Partial<GapItem> {
  return {
    masteredAt: undefined,
    consecutiveCorrect: 0,
    difficulty: 'hard',
    currentInterval: 1,
    easeFactor: Math.max(1.3, gap.easeFactor - 0.3),
    nextReviewAt: new Date().toISOString(),
  };
}

export function getPriorityScore(gap: GapItem): number {
  const info = classifyGapUrgency(gap);
  let score = info.priority;

  if (gap.reviewCount === 0) {
    score += 20;
  }

  if (gap.consecutiveCorrect === 0 && gap.reviewCount > 0) {
    score += 15;
  }

  if (gap.gapType === 'grammar') {
    score += 5;
  }

  return score;
}

export function selectPriorityGaps(
  gaps: GapItem[],
  maxCount: number,
  options?: {
    category?: GapCategory;
    cefrLevel?: CEFRLevel;
    includeCheckins?: boolean;
  }
): GapItem[] {
  let candidates = gaps.filter(g => {
    if (g.masteredAt && !options?.includeCheckins) return false;
    if (g.masteredAt && options?.includeCheckins) {
      const info = classifyGapUrgency(g);
      if (info.urgency !== 'checkin_due') return false;
    }
    if (options?.category && g.category !== options.category) return false;
    if (options?.cefrLevel && g.cefrLevel && g.cefrLevel !== options.cefrLevel) return false;
    return true;
  });

  candidates.sort((a, b) => getPriorityScore(b) - getPriorityScore(a));

  return candidates.slice(0, maxCount);
}

export function getGapHealthScore(gaps: GapItem[]): {
  score: number;
  label: string;
  description: string;
} {
  if (gaps.length === 0) {
    return { score: 100, label: 'No gaps yet', description: 'Start reading or speaking to discover gaps' };
  }

  const summary = getGapScheduleSummary(gaps);
  const totalActive = gaps.filter(g => !g.masteredAt).length;

  if (totalActive === 0) {
    return { score: 100, label: 'All clear', description: 'All gaps mastered!' };
  }

  const criticalRatio = summary.critical.length / totalActive;
  const dueRatio = (summary.critical.length + summary.due.length) / totalActive;

  let score = 100;
  score -= criticalRatio * 60;
  score -= dueRatio * 25;
  score -= Math.min(summary.checkinDue.length * 2, 10);

  score = Math.max(0, Math.min(100, Math.round(score)));

  let label: string;
  let description: string;

  if (score >= 90) {
    label = 'Excellent';
    description = 'Your gaps are well managed. Keep it up!';
  } else if (score >= 70) {
    label = 'Good';
    description = 'A few gaps need attention, but you\'re on track.';
  } else if (score >= 50) {
    label = 'Needs work';
    description = 'Several gaps are falling behind. Time for a review session.';
  } else {
    label = 'Falling behind';
    description = 'Many gaps need urgent attention. Review now to stay on track.';
  }

  return { score, label, description };
}

export function formatUrgencyBadge(urgency: GapUrgency, daysOverdue: number): string {
  switch (urgency) {
    case 'critical':
      return daysOverdue > 0 ? `${daysOverdue}d overdue` : 'Review now';
    case 'due':
      return 'Due today';
    case 'upcoming':
      return 'Coming up';
    case 'stable':
      return 'On track';
    case 'mastered':
      return 'Mastered';
    case 'checkin_due':
      return 'Check-in';
    default:
      return '';
  }
}
