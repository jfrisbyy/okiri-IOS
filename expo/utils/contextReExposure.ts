import { GapItem, OriginalContext } from '@/types';

const MIN_DAYS_BETWEEN_REEXPOSURE = 7;

export function captureOriginalContext(
  sentence: string,
  sourceTab: OriginalContext['sourceTab'],
  translation?: string,
  sourceContentId?: string,
): OriginalContext | undefined {
  if (!sentence || sentence.trim().length < 10) return undefined;
  return {
    sentence: sentence.trim(),
    translation,
    sourceTab,
    sourceContentId,
    capturedAt: new Date().toISOString(),
    reExposureCount: 0,
  };
}

export function isGapEligibleForReExposure(gap: GapItem): boolean {
  const ctx = gap.originalContext;
  if (!ctx) return false;
  if (gap.masteredAt) return false;
  const capturedDays = daysSince(ctx.capturedAt);
  if (capturedDays < 3) return false;
  if (!ctx.lastReExposedAt) return true;
  return daysSince(ctx.lastReExposedAt) >= MIN_DAYS_BETWEEN_REEXPOSURE;
}

export interface ReExposureQuestion {
  id: string;
  type: 'fill_blank' | 'translation';
  question: string;
  content: string;
  correctAnswer: string;
  hint?: string;
  relatedGapId: string;
  wildEncounter: {
    sourceTab: OriginalContext['sourceTab'];
    context: string;
    daysAgo: number;
    contentId: string;
  };
  explanation: string;
}

export function buildReExposureQuestion(gap: GapItem): ReExposureQuestion | null {
  const ctx = gap.originalContext;
  if (!ctx) return null;
  const sentence = ctx.sentence;
  const word = gap.frenchWord;
  if (!word) return null;
  const daysAgo = Math.round(daysSince(ctx.capturedAt));

  const re = new RegExp(`\\b${escapeRe(word)}\\b`, 'i');
  if (re.test(sentence)) {
    const content = sentence.replace(re, '___');
    return {
      id: 'ctx_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      type: 'fill_blank',
      question: `You saw this ${daysAgo} days ago. Fill in the missing word:`,
      content,
      correctAnswer: word,
      hint: gap.englishTranslation,
      relatedGapId: gap.id,
      wildEncounter: {
        sourceTab: ctx.sourceTab,
        context: sentence,
        daysAgo,
        contentId: ctx.sourceContentId ?? '',
      },
      explanation: `"${word}" means "${gap.englishTranslation}". You first saw it in: "${sentence}".`,
    };
  }
  if (ctx.translation) {
    return {
      id: 'ctx_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      type: 'translation',
      question: `You saw this ${daysAgo} days ago. Translate to English:`,
      content: sentence,
      correctAnswer: ctx.translation,
      hint: `Key word: "${word}" → "${gap.englishTranslation}"`,
      relatedGapId: gap.id,
      wildEncounter: {
        sourceTab: ctx.sourceTab,
        context: sentence,
        daysAgo,
        contentId: ctx.sourceContentId ?? '',
      },
      explanation: `You first encountered this sentence ${daysAgo} days ago.`,
    };
  }
  return null;
}

export function markReExposed(gap: GapItem): GapItem {
  if (!gap.originalContext) return gap;
  return {
    ...gap,
    originalContext: {
      ...gap.originalContext,
      lastReExposedAt: new Date().toISOString(),
      reExposureCount: gap.originalContext.reExposureCount + 1,
    },
  };
}

function daysSince(iso: string): number {
  return Math.max(0, (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
