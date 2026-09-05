import { GapItem, CEFRLevel } from '@/types';
import { ExercisePerformance, getExerciseAccuracySummary } from '@/utils/exerciseSelector';
import { getErrorsForConcept, getErrorPatterns, ErrorEntry } from '@/utils/errorHistoryStore';

export interface LearnerProfileSnapshot {
  cefrLevel: CEFRLevel;
  exerciseTypePerformance: Record<string, number>;
  recentErrors: ErrorEntry[];
  commonMistakePatterns: { errorType: string; count: number; examples: { wrong: string; correct: string }[] }[];
  conceptAttemptCount: number;
  conceptAccuracy: number;
  strongExerciseTypes: string[];
  weakExerciseTypes: string[];
}

export async function buildLearnerProfile(
  conceptId: string,
  cefrLevel: CEFRLevel,
  gaps: GapItem[],
  exercisePerformance?: ExercisePerformance,
): Promise<LearnerProfileSnapshot> {
  const perf = exercisePerformance || {};

  const accuracySummary = getExerciseAccuracySummary(perf);

  const exerciseTypePerformance: Record<string, number> = {};
  for (const entry of accuracySummary) {
    exerciseTypePerformance[entry.type] = Math.round(entry.accuracy * 100);
  }

  const recentErrors = await getErrorsForConcept(conceptId);
  const conceptErrors = recentErrors.slice(0, 10);

  const allPatterns = await getErrorPatterns(5);
  const commonMistakePatterns = allPatterns.slice(0, 3).map(p => ({
    errorType: p.errorType,
    count: p.count,
    examples: p.examples,
  }));

  const gap = gaps.find(g => g.id === conceptId || g.frenchWord === conceptId);
  const conceptAttemptCount = gap?.reviewCount ?? 0;
  const conceptAccuracy = gap && gap.reviewCount > 0
    ? Math.round((gap.consecutiveCorrect / Math.max(gap.reviewCount, 1)) * 100)
    : 0;

  const STRONG_THRESHOLD = 75;
  const WEAK_THRESHOLD = 50;

  const strongExerciseTypes = accuracySummary
    .filter(e => e.accuracy * 100 >= STRONG_THRESHOLD && e.attempts >= 3)
    .map(e => e.type);

  const weakExerciseTypes = accuracySummary
    .filter(e => e.accuracy * 100 < WEAK_THRESHOLD && e.attempts >= 2)
    .map(e => e.type);

  console.log('[LearnerProfile] Built profile for concept:', conceptId,
    'CEFR:', cefrLevel,
    'strong:', strongExerciseTypes.join(','),
    'weak:', weakExerciseTypes.join(','),
    'patterns:', commonMistakePatterns.map(p => p.errorType).join(','),
  );

  return {
    cefrLevel,
    exerciseTypePerformance,
    recentErrors: conceptErrors,
    commonMistakePatterns,
    conceptAttemptCount,
    conceptAccuracy,
    strongExerciseTypes,
    weakExerciseTypes,
  };
}

export function formatProfileForPrompt(snapshot: LearnerProfileSnapshot): string {
  const lines: string[] = [];

  lines.push(`This learner is CEFR ${snapshot.cefrLevel} level.`);

  if (snapshot.conceptAttemptCount > 0) {
    lines.push(`They have attempted this concept ${snapshot.conceptAttemptCount} time${snapshot.conceptAttemptCount === 1 ? '' : 's'} previously with ${snapshot.conceptAccuracy}% accuracy.`);
  } else {
    lines.push(`This is their first encounter with this concept.`);
  }

  const perfEntries = Object.entries(snapshot.exerciseTypePerformance);
  if (perfEntries.length > 0) {
    const strongDescs = perfEntries
      .filter(([, acc]) => acc >= 75)
      .map(([type, acc]) => `${type} (${acc}% accuracy)`);
    const weakDescs = perfEntries
      .filter(([, acc]) => acc < 50)
      .map(([type, acc]) => `${type} (${acc}% accuracy)`);
    const midDescs = perfEntries
      .filter(([, acc]) => acc >= 50 && acc < 75)
      .map(([type, acc]) => `${type} (${acc}% accuracy)`);

    if (strongDescs.length > 0) {
      lines.push(`Their strongest exercise types are ${strongDescs.join(', ')}.`);
    }
    if (midDescs.length > 0) {
      lines.push(`They perform moderately on ${midDescs.join(', ')}.`);
    }
    if (weakDescs.length > 0) {
      lines.push(`Their weakest exercise types are ${weakDescs.join(', ')}.`);
    }
  }

  if (snapshot.recentErrors.length > 0) {
    lines.push(`\nIn their last ${snapshot.recentErrors.length} errors on this concept:`);
    const errorGroups: Record<string, { wrong: string; correct: string; count: number }[]> = {};
    for (const err of snapshot.recentErrors) {
      const key = `${err.wrongAnswer}→${err.correctAnswer}`;
      if (!errorGroups[err.errorType]) errorGroups[err.errorType] = [];
      const existing = errorGroups[err.errorType].find(e => `${e.wrong}→${e.correct}` === key);
      if (existing) {
        existing.count++;
      } else {
        errorGroups[err.errorType].push({ wrong: err.wrongAnswer, correct: err.correctAnswer, count: 1 });
      }
    }
    for (const [errType, examples] of Object.entries(errorGroups)) {
      for (const ex of examples) {
        const times = ex.count > 1 ? ` (${ex.count} times)` : '';
        lines.push(`  - They wrote "${ex.wrong}" instead of "${ex.correct}"${times} [${errType}]`);
      }
    }
  }

  if (snapshot.commonMistakePatterns.length > 0) {
    const patternDescs = snapshot.commonMistakePatterns.map(p => {
      const exStr = p.examples.length > 0
        ? `: e.g. "${p.examples[0].wrong}" instead of "${p.examples[0].correct}"`
        : '';
      return `${p.errorType} (${p.count} occurrences${exStr})`;
    });
    lines.push(`\nCommon mistake patterns across all concepts: ${patternDescs.join('; ')}.`);
  }

  return lines.join('\n');
}

export function buildPedagogicalInstructions(snapshot: LearnerProfileSnapshot): string {
  const lines: string[] = [];

  if (snapshot.commonMistakePatterns.length > 0 || snapshot.recentErrors.length > 0) {
    lines.push(`Because this learner has specific error patterns, create exercises that:`);

    if (snapshot.recentErrors.length > 0) {
      const wrongWords = [...new Set(snapshot.recentErrors.map(e => e.wrongAnswer).filter(Boolean))].slice(0, 5);
      const correctWords = [...new Set(snapshot.recentErrors.map(e => e.correctAnswer).filter(Boolean))].slice(0, 5);
      if (wrongWords.length > 0) {
        lines.push(`(1) Use their ACTUAL mistake words/phrases as exercise material. Specifically use: ${correctWords.map(w => `"${w}"`).join(', ')} — these are words they have gotten wrong before.`);
      }
    }

    for (const pattern of snapshot.commonMistakePatterns) {
      switch (pattern.errorType) {
        case 'gender_agreement':
          lines.push(`(!) Create exercises contrasting masculine/feminine forms since they confuse grammatical gender.`);
          break;
        case 'auxiliary_confusion':
          lines.push(`(!) Create exercises contrasting avoir vs être as auxiliaries — they consistently mix these up.`);
          break;
        case 'accent_missing':
          lines.push(`(!) Include exercises requiring correct accent placement — they often omit or misplace accents.`);
          break;
        case 'verb_conjugation':
          lines.push(`(!) Focus on verb ending exercises — they struggle with conjugation forms.`);
          break;
        case 'tense_confusion':
          lines.push(`(!) Include exercises that contrast different tenses in similar contexts.`);
          break;
        case 'article_error':
          lines.push(`(!) Create exercises focusing on correct article usage (le/la/les/un/une/des).`);
          break;
        case 'preposition_error':
          lines.push(`(!) Include fill-in-the-blank exercises for preposition selection (à, de, en, dans, etc.).`);
          break;
        case 'word_order':
          lines.push(`(!) Use sentence_build and word_order exercises to reinforce French sentence structure.`);
          break;
        case 'spelling':
          lines.push(`(!) Include dictation/typing exercises to reinforce correct spelling.`);
          break;
        default:
          break;
      }
    }

    if (snapshot.weakExerciseTypes.length > 0) {
      lines.push(`(2) Include MORE exercises of types: ${snapshot.weakExerciseTypes.join(', ')} — these are their weak areas that need targeted practice.`);
    }

    lines.push(`(3) Include at least one exercise that directly re-tests a previous wrong answer in a slightly different context.`);
    lines.push(`(4) Create distractors that specifically test their known confusion patterns.`);
  } else {
    lines.push(`This learner has no recorded error patterns yet. Generate a balanced mix of exercise types to establish a performance baseline. Include a variety of recognition and production exercises.`);
  }

  return lines.join('\n');
}

export function buildScaffoldingInstructions(snapshot: LearnerProfileSnapshot): string {
  const lines: string[] = [];

  lines.push(`Order exercises in pedagogical progression:`);

  const accuracy = snapshot.conceptAccuracy;
  const strong = snapshot.strongExerciseTypes;
  const weak = snapshot.weakExerciseTypes;

  if (accuracy < 40) {
    lines.push(`- This learner's concept accuracy is LOW (${accuracy}%). Use heavy scaffolding.`);
    lines.push(`- Start with 3 exercises using recognition types (multiple_choice, true_false, match_pairs) to rebuild confidence.`);
    lines.push(`- Then 2-3 exercises using intermediate types that target the specific error pattern.`);
    lines.push(`- End with only 1-2 challenge exercises using easier production types, with generous hints.`);
    lines.push(`- Ratio: 60% strong/recognition types, 40% weak/production types.`);
  } else if (accuracy <= 70) {
    lines.push(`- This learner's concept accuracy is MODERATE (${accuracy}%). Use balanced progression.`);
    if (strong.length > 0) {
      lines.push(`- Start with 1-2 exercises using their strong types (${strong.join(', ')}) as warm-up.`);
    } else {
      lines.push(`- Start with 1-2 recognition exercises as warm-up.`);
    }
    lines.push(`- Then 2-3 exercises introducing their weak types with supportive hints.`);
    if (weak.length > 0) {
      lines.push(`- End with 2-3 challenge exercises primarily using: ${weak.join(', ')}.`);
    } else {
      lines.push(`- End with 2-3 production-level challenge exercises.`);
    }
    lines.push(`- Ratio: 40% strong types, 60% weak types.`);
  } else {
    lines.push(`- This learner's concept accuracy is HIGH (${accuracy}%). Skip to challenges.`);
    lines.push(`- Start with 1 quick warm-up exercise, then immediately move to production-level work.`);
    if (weak.length > 0) {
      lines.push(`- Focus challenge section on: ${weak.join(', ')} — push them on their weakest areas.`);
    } else {
      lines.push(`- Focus on production, translation, and sentence_build for maximum challenge.`);
    }
    lines.push(`- Ratio: 20% strong types, 80% weak/production types.`);
  }

  if (snapshot.conceptAttemptCount === 0) {
    lines.push(`- FIRST ATTEMPT: Since this is the learner's first time with this concept, start gently with more recognition exercises before any production.`);
  }

  return lines.join('\n');
}
