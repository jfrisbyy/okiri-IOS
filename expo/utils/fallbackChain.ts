import type { GapItem } from '@/types';
import type { EngagingQuestion } from '@/utils/masteryEngine';
import { validateQuestion } from '@/utils/questionValidator';
import { generateTemplateQuestions } from '@/utils/exerciseTemplates';
import { generateEmergencyQuestions } from '@/utils/emergencyQuestionGenerator';

const TAG = '[FallbackChain]';

interface LessonContext {
  contentType?: string;
  difficulty?: string;
  cefrLevel?: string;
}

function deduplicateQuestions(questions: EngagingQuestion[]): EngagingQuestion[] {
  const seen = new Set<string>();
  const result: EngagingQuestion[] = [];

  for (const q of questions) {
    const textKey = (q.content || '').toLowerCase().trim();
    const structKey = `${q.type}|${(q.correctAnswer || '').toLowerCase().trim()}|${(q.choices?.[0] || '').toLowerCase().trim()}`;

    if (seen.has(textKey) || seen.has(structKey)) continue;
    if (textKey.length > 0) seen.add(textKey);
    if (structKey.length > 3) seen.add(structKey);
    result.push(q);
  }

  return result;
}

function interleaveByType(questions: EngagingQuestion[]): EngagingQuestion[] {
  const groups = new Map<string, EngagingQuestion[]>();

  for (const q of questions) {
    const existing = groups.get(q.type) || [];
    existing.push(q);
    groups.set(q.type, existing);
  }

  const result: EngagingQuestion[] = [];
  const typeKeys = Array.from(groups.keys());
  let round = 0;
  let added = true;

  while (added) {
    added = false;
    for (const key of typeKeys) {
      const group = groups.get(key)!;
      if (round < group.length) {
        result.push(group[round]);
        added = true;
      }
    }
    round++;
  }

  return result;
}

function questionCoversGap(question: EngagingQuestion, frenchWord: string): boolean {
  const lower = frenchWord.toLowerCase().trim();
  if (!lower) return false;
  const content = (question.content || '').toLowerCase();
  const answer = (question.correctAnswer || '').toLowerCase();
  return content.includes(lower) || answer.includes(lower);
}

const HARDCODED_FALLBACK: EngagingQuestion = {
  id: 'fallback_bonjour_greeting',
  type: 'true_false',
  conceptId: '',
  content: 'Is this correct?',
  correctAnswer: 'true',
  statement: '"Bonjour" is a French greeting meaning "Hello" or "Good day"',
  isTrue: true,
  explanation: '"Bonjour" is the standard French greeting.',
};

export function ensureLessonQuestions(
  gaps: GapItem[],
  existingQuestions: EngagingQuestion[],
  targetCount: number,
  _lessonContext?: LessonContext,
): EngagingQuestion[] {
  try {
    const validQuestions: EngagingQuestion[] = [];
    let rejectedCount = 0;

    for (const q of (existingQuestions || [])) {
      const valid = validateQuestion(q);
      if (valid) {
        validQuestions.push(valid);
      } else {
        rejectedCount++;
      }
    }

    console.log(
      `${TAG} Starting with ${validQuestions.length} valid questions out of ${(existingQuestions || []).length} provided (${rejectedCount} rejected), target: ${targetCount}`,
    );

    if (validQuestions.length >= targetCount) {
      const deduped = deduplicateQuestions(validQuestions);
      const interleaved = interleaveByType(deduped);
      console.log(`${TAG} Sufficient questions from primary source`);
      return interleaved.slice(0, targetCount);
    }

    const safeGaps = (gaps || []).filter(g => g.frenchWord && g.englishTranslation);

    if (safeGaps.length > 0) {
      const deficit = targetCount - validQuestions.length;
      const gapsToGenerate = safeGaps
        .filter(g => {
          let count = 0;
          for (const q of validQuestions) {
            if (questionCoversGap(q, g.frenchWord)) count++;
          }
          return count < 2;
        })
        .slice(0, 5);

      let templateAdded = 0;
      for (const gap of gapsToGenerate) {
        if (validQuestions.length >= targetCount) break;
        const perGap = Math.max(2, Math.ceil(deficit / Math.max(gapsToGenerate.length, 1)));
        const otherGaps = safeGaps.filter(g => g.id !== gap.id);
        const templateQ = generateTemplateQuestions(gap, otherGaps, perGap);
        for (const q of templateQ) {
          if (validQuestions.length >= targetCount) break;
          validQuestions.push(q);
          templateAdded++;
        }
      }

      console.log(`${TAG} Templates produced ${templateAdded} additional valid questions`);
    }

    if (validQuestions.length >= targetCount) {
      const deduped = deduplicateQuestions(validQuestions);
      const interleaved = interleaveByType(deduped);
      return interleaved.slice(0, targetCount);
    }

    if (safeGaps.length > 0) {
      const remainingDeficit = targetCount - validQuestions.length;
      const emergencyQ = generateEmergencyQuestions(safeGaps, remainingDeficit);
      let emergencyAdded = 0;

      for (const q of emergencyQ) {
        const valid = validateQuestion(q);
        if (valid) {
          validQuestions.push(valid);
          emergencyAdded++;
        }
      }

      console.log(`${TAG} Emergency generator produced ${emergencyAdded} additional questions`);
    }

    if (validQuestions.length >= targetCount) {
      const deduped = deduplicateQuestions(validQuestions);
      const interleaved = interleaveByType(deduped);
      return interleaved.slice(0, targetCount);
    }

    if (validQuestions.length > 0) {
      console.warn(
        `${TAG} WARNING: Could only produce ${validQuestions.length} questions, target was ${targetCount}`,
      );
      const deduped = deduplicateQuestions(validQuestions);
      return interleaveByType(deduped);
    }

    console.warn(`${TAG} CRITICAL: Used hardcoded fallback — no gaps available`);
    const fallbackValid = validateQuestion({ ...HARDCODED_FALLBACK, id: 'fallback_' + Date.now().toString(36) });
    return fallbackValid ? [fallbackValid] : [HARDCODED_FALLBACK];
  } catch (e) {
    console.error(`${TAG} Unexpected error in ensureLessonQuestions:`, e);
    const fallbackValid = validateQuestion({ ...HARDCODED_FALLBACK, id: 'fallback_err_' + Date.now().toString(36) });
    return fallbackValid ? [fallbackValid] : [HARDCODED_FALLBACK];
  }
}
