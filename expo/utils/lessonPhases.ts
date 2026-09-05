import { LessonPhase } from '@/types';

export const PHASE_UNLOCK_ORDER: { phase: LessonPhase; unlocksAt: number }[] = [
  { phase: 'learn', unlocksAt: 1 },
  { phase: 'listen', unlocksAt: 3 },
  { phase: 'speak', unlocksAt: 5 },
  { phase: 'read', unlocksAt: 7 },
  { phase: 'write', unlocksAt: 9 },
];

export function getProgressivePhases(
  lessonOrder: number,
  lessonDefinedPhases: LessonPhase[],
): LessonPhase[] {
  const unlocked = PHASE_UNLOCK_ORDER
    .filter(p => lessonOrder >= p.unlocksAt)
    .map(p => p.phase);

  return lessonDefinedPhases.filter(p => unlocked.includes(p) || p === 'gap_review');
}

export function getNewlyUnlockedPhase(lessonOrder: number): LessonPhase | null {
  const entry = PHASE_UNLOCK_ORDER.find(p => p.unlocksAt === lessonOrder && p.unlocksAt > 1);
  return entry?.phase ?? null;
}

export function getPhaseDisplayName(phase: LessonPhase): string {
  switch (phase) {
    case 'listen': return 'Listening';
    case 'speak': return 'Speaking';
    case 'read': return 'Reading';
    case 'write': return 'Writing';
    case 'learn': return 'Learn';
    case 'gap_review': return 'Gap Review';
    default: return '';
  }
}

export function getJourneyStatus(
  completedLessons: number,
  totalLessons: number,
  activeGaps: number,
  masteredGaps: number,
): { label: string; description: string; isComplete: boolean; phase: 'learning' | 'gap_mastery' | 'complete' } {
  if (completedLessons >= totalLessons && activeGaps === 0) {
    return {
      label: 'Fluency Achieved',
      description: `All ${totalLessons} lessons complete, ${masteredGaps} gaps mastered. Your French foundation is solid.`,
      isComplete: true,
      phase: 'complete',
    };
  }

  if (completedLessons >= totalLessons && activeGaps > 0) {
    return {
      label: 'Gap Mastery Phase',
      description: `All lessons complete! ${activeGaps} gap${activeGaps !== 1 ? 's' : ''} remaining to master.`,
      isComplete: false,
      phase: 'gap_mastery',
    };
  }

  const percent = Math.round((completedLessons / totalLessons) * 100);
  return {
    label: `${percent}% Complete`,
    description: `${completedLessons}/${totalLessons} lessons \u00b7 ${activeGaps} active gaps`,
    isComplete: false,
    phase: 'learning',
  };
}
