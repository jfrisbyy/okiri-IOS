import type { GapItem } from '@/types';
import type { EngagingQuestion } from '@/utils/masteryEngine';
import { validateQuestion } from '@/utils/questionValidator';
import { getSmartDistractors } from '@/utils/distractorBank';

const TAG = '[EmergencyGenerator]';

const ENGLISH_FALLBACK_POOL = [
  'hello', 'goodbye', 'please', 'thank you', 'yes', 'no',
  'water', 'bread', 'house', 'book', 'good', 'bad',
];

const FRENCH_FALLBACK_POOL = [
  'bonjour', 'au revoir', "s'il vous plaît", 'merci', 'oui', 'non',
  'eau', 'pain', 'maison', 'livre', 'bon', 'mauvais',
];

function generateId(): string {
  return 'emg_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function pickDistractors(
  correctAnswer: string,
  candidates: string[],
  fallbackPool: string[],
  count: number,
  language: 'french' | 'english' = 'english',
  gap?: GapItem,
): string[] {
  const normalCA = correctAnswer.toLowerCase().trim();
  const seen = new Set<string>([normalCA]);
  const result: string[] = [];

  for (const c of candidates) {
    if (result.length >= count) break;
    const norm = c.toLowerCase().trim();
    if (norm.length === 0 || seen.has(norm)) continue;
    seen.add(norm);
    result.push(c);
  }

  if (result.length < count) {
    const bankDistractors = getSmartDistractors({
      correctAnswer,
      answerLanguage: language,
      count: count - result.length,
      contentType: gap?.contentType,
      category: gap?.category,
      cefrLevel: gap?.cefrLevel,
      avoidList: Array.from(seen),
    });
    for (const bd of bankDistractors) {
      if (result.length >= count) break;
      const norm = bd.toLowerCase().trim();
      if (!seen.has(norm)) {
        seen.add(norm);
        result.push(bd);
      }
    }
  }

  for (const fb of fallbackPool) {
    if (result.length >= count) break;
    const norm = fb.toLowerCase().trim();
    if (!seen.has(norm)) {
      seen.add(norm);
      result.push(fb);
    }
  }

  return result.slice(0, count);
}

function buildSimpleRecognition(
  gap: GapItem,
  otherGaps: GapItem[],
): EngagingQuestion | null {
  const candidates = otherGaps
    .map(g => g.englishTranslation)
    .filter(t => t && t.trim().length > 0);
  const distractors = pickDistractors(gap.englishTranslation, candidates, ENGLISH_FALLBACK_POOL, 3, 'english', gap);
  if (distractors.length < 2) return null;

  const choices = shuffleArray([gap.englishTranslation, ...distractors]);

  return {
    id: generateId(),
    type: 'multiple_choice',
    conceptId: '',
    content: `What does "${gap.frenchWord}" mean in English?`,
    correctAnswer: gap.englishTranslation,
    choices,
    hint: `Think about the meaning of "${gap.frenchWord}".`,
    explanation: `The French word "${gap.frenchWord}" means "${gap.englishTranslation}" in English.`,
  };
}

function buildReverseRecognition(
  gap: GapItem,
  otherGaps: GapItem[],
): EngagingQuestion | null {
  const candidates = otherGaps
    .map(g => g.frenchWord)
    .filter(t => t && t.trim().length > 0);
  const distractors = pickDistractors(gap.frenchWord, candidates, FRENCH_FALLBACK_POOL, 3, 'french', gap);
  if (distractors.length < 2) return null;

  const choices = shuffleArray([gap.frenchWord, ...distractors]);

  return {
    id: generateId(),
    type: 'multiple_choice',
    conceptId: '',
    content: `Which French word means "${gap.englishTranslation}"?`,
    correctAnswer: gap.frenchWord,
    choices,
    hint: `Look for the correct French translation.`,
    explanation: `The French word "${gap.frenchWord}" means "${gap.englishTranslation}" in English.`,
  };
}

function buildEmergencyTrueFalse(
  gap: GapItem,
  otherGaps: GapItem[],
): EngagingQuestion | null {
  const makeTrue = Math.random() > 0.5;

  if (makeTrue) {
    return {
      id: generateId(),
      type: 'true_false',
      conceptId: '',
      content: 'Is this translation correct?',
      correctAnswer: 'true',
      statement: `"${gap.frenchWord}" means "${gap.englishTranslation}"`,
      isTrue: true,
      explanation: `The French word "${gap.frenchWord}" means "${gap.englishTranslation}" in English.`,
    };
  }

  const wrongGap = otherGaps.find(
    g =>
      g.englishTranslation &&
      g.englishTranslation.toLowerCase().trim() !== gap.englishTranslation.toLowerCase().trim() &&
      g.frenchWord.toLowerCase().trim() !== gap.frenchWord.toLowerCase().trim(),
  );

  const wrongTranslation = wrongGap
    ? wrongGap.englishTranslation
    : ENGLISH_FALLBACK_POOL.find(
        fb => fb.toLowerCase().trim() !== gap.englishTranslation.toLowerCase().trim(),
      ) || 'something else';

  return {
    id: generateId(),
    type: 'true_false',
    conceptId: '',
    content: 'Is this translation correct?',
    correctAnswer: 'false',
    statement: `"${gap.frenchWord}" means "${wrongTranslation}"`,
    isTrue: false,
    explanation: `"${gap.frenchWord}" actually means "${gap.englishTranslation}" in English.`,
  };
}

export function generateEmergencyQuestions(
  gaps: GapItem[],
  maxQuestions: number,
): EngagingQuestion[] {
  try {
    if (!gaps || gaps.length === 0) {
      console.log(`${TAG} No gaps provided, returning empty`);
      return [];
    }

    const pool: EngagingQuestion[] = [];

    for (const gap of gaps) {
      if (!gap.frenchWord || !gap.englishTranslation) continue;

      const otherGaps = gaps.filter(
        g => g.id !== gap.id && g.frenchWord && g.englishTranslation,
      );

      const q1 = buildSimpleRecognition(gap, otherGaps);
      if (q1) {
        const v1 = validateQuestion(q1);
        if (v1) pool.push(v1);
      }

      const q2 = buildReverseRecognition(gap, otherGaps);
      if (q2) {
        const v2 = validateQuestion(q2);
        if (v2) pool.push(v2);
      }

      const q3 = buildEmergencyTrueFalse(gap, otherGaps);
      if (q3) {
        const v3 = validateQuestion(q3);
        if (v3) pool.push(v3);
      }
    }

    const shuffled = shuffleArray(pool);
    const result = shuffled.slice(0, maxQuestions);
    console.log(`${TAG} Generated ${result.length} emergency questions from ${gaps.length} gaps`);
    return result;
  } catch (e) {
    console.error(`${TAG} Unexpected error:`, e);
    return [];
  }
}
