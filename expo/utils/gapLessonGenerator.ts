import { GapItem, GapPrompt, GapLesson, GapCategory, GeneratedQuestion, CEFRLevel } from '@/types';
import { classifyGapUrgency, getPriorityScore, selectPriorityGaps } from '@/utils/gapScheduler';
import { validateGapPrompt, validateGapPromptBatch } from '@/utils/questionValidator';
import { generateTemplateQuestions, templateQuestionsToGapPrompts } from '@/utils/exerciseTemplates';
import { getSmartDistractors } from '@/utils/distractorBank';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function isEnglishText(text: string): boolean {
  if (!text || text.length < 3) return false;
  
  const frenchIndicators = [
    /\bje\b/i, /\btu\b/i, /\bil\b/i, /\belle\b/i, /\bnous\b/i, /\bvous\b/i, /\bils\b/i,
    /\ble\b/i, /\bla\b/i, /\bles\b/i, /\bun\b/i, /\bune\b/i, /\bdes\b/i,
    /\best\b/i, /\bsont\b/i, /\bêtre\b/i, /\bavoir\b/i,
    /\bne\b.*\bpas\b/i, /\bne\b.*\brien\b/i, /\bne\b.*\bjamais\b/i,
    /\bpas\b/i, /\brien\b/i, /\bjamais\b/i,
    /\bpour\b/i, /\bavec\b/i, /\bdans\b/i, /\bsur\b/i,
    /\bqu[ie]/i, /\bque\b/i, /\bqui\b/i,
    /\bveux\b/i, /\bvoudrais\b/i, /\bpeux\b/i, /\bfais\b/i, /\bfait\b/i,
    /\bcontinuer\b/i, /\bpleurer\b/i, /\bmanger\b/i, /\bparler\b/i,
    /\bà\b/i, /\boù\b/i, /\bça\b/i, /\bc'est\b/i,
    /[éèêëàâäùûüôöîïç]/i,
  ];

  let frenchScore = 0;
  for (const pattern of frenchIndicators) {
    if (pattern.test(text)) {
      frenchScore++;
    }
  }

  return frenchScore < 2;
}

function generateEnglishDistractors(correctAnswer: string, allGaps: GapItem[], count: number = 3, gap?: GapItem): string[] {
  const normalized = correctAnswer.toLowerCase().trim();
  const gapCandidates = allGaps
    .filter(g => g.sourceType === 'reading')
    .map(g => g.englishTranslation)
    .filter(t => {
      if (!t || t.toLowerCase().trim() === normalized || t.length < 3) return false;
      if (!isEnglishText(t)) return false;
      return true;
    });
  
  const unique = [...new Set(gapCandidates)];
  const fromGaps = shuffleArray(unique).slice(0, Math.min(2, count));
  const result = [...fromGaps];

  if (result.length < count) {
    const bankDistractors = getSmartDistractors({
      correctAnswer,
      answerLanguage: 'english',
      count: count - result.length,
      contentType: gap?.contentType,
      category: gap?.category,
      cefrLevel: gap?.cefrLevel,
      avoidList: [correctAnswer, ...result],
    });
    result.push(...bankDistractors);
  }

  if (result.length < count) {
    const fallbacks = [
      'I don\'t want to continue',
      'to keep doing something',
      'to stop crying', 
      'something else entirely',
      'a different action',
      'to change my mind'
    ].filter(f => f.toLowerCase() !== normalized && !result.some(r => r.toLowerCase() === f.toLowerCase()));
    result.push(...fallbacks.slice(0, count - result.length));
  }

  return result.slice(0, count);
}

function generateFrenchDistractors(correctAnswer: string, allGaps: GapItem[], count: number = 3, gap?: GapItem): string[] {
  const normalized = correctAnswer.toLowerCase().trim();
  const gapCandidates = allGaps
    .filter(g => g.sourceType === 'reading')
    .map(g => g.frenchWord)
    .filter(t => t.toLowerCase().trim() !== normalized && t.length > 1);
  
  const unique = [...new Set(gapCandidates)];
  const fromGaps = shuffleArray(unique).slice(0, Math.min(2, count));
  const result = [...fromGaps];

  if (result.length < count) {
    const bankDistractors = getSmartDistractors({
      correctAnswer,
      answerLanguage: 'french',
      count: count - result.length,
      contentType: gap?.contentType,
      category: gap?.category,
      cefrLevel: gap?.cefrLevel,
      avoidList: [correctAnswer, ...result],
    });
    result.push(...bankDistractors);
  }

  if (result.length < count) {
    const fallbacks = ['peut-être', 'souvent', 'maintenant'].filter(
      f => f !== correctAnswer && !result.some(r => r.toLowerCase() === f.toLowerCase())
    );
    result.push(...fallbacks.slice(0, count - result.length));
  }

  return result.slice(0, count);
}

function hasConceptData(gap: GapItem): boolean {
  return !!(
    gap.conceptData &&
    gap.conceptData.questionPool &&
    gap.conceptData.questionPool.length > 0
  );
}

function convertGeneratedQuestionToPrompt(
  question: GeneratedQuestion,
  gapId: string,
  category: GapCategory
): GapPrompt | null {
  if (question.type === 'multiple_choice') {
    if (!question.choices || !Array.isArray(question.choices) || question.choices.length < 2) {
      return null;
    }
    
    const normalizedCorrect = question.correctAnswer.toLowerCase().trim();
    const hasCorrectAnswer = question.choices.some(
      c => c.toLowerCase().trim() === normalizedCorrect
    );
    
    if (!hasCorrectAnswer) {
      const fixedChoices = [question.correctAnswer, ...question.choices.slice(0, 3)];
      return {
        id: generateId(),
        gapId,
        type: question.type,
        question: question.question,
        correctAnswer: question.correctAnswer,
        choices: shuffleArray(fixedChoices),
        hint: question.hint,
        category,
      };
    }
  }
  
  return {
    id: generateId(),
    gapId,
    type: question.type,
    question: question.question,
    correctAnswer: question.correctAnswer,
    choices: question.choices,
    hint: question.hint,
    category,
  };
}

function generatePromptsFromConceptData(gap: GapItem): GapPrompt[] {
  if (!gap.conceptData || !gap.conceptData.questionPool) {
    return [];
  }

  return gap.conceptData.questionPool
    .map(q => convertGeneratedQuestionToPrompt(q, gap.id, gap.category))
    .filter((p): p is GapPrompt => p !== null);
}

function generateWordMeaningPrompt(gap: GapItem, allGaps: GapItem[]): GapPrompt | null {
  if (!gap.frenchWord || !gap.englishTranslation) {
    return null;
  }
  
  if (gap.frenchWord.length < 2 || gap.englishTranslation.length < 2) {
    return null;
  }

  if (!isEnglishText(gap.englishTranslation)) {
    return null;
  }
  
  const distractors = generateEnglishDistractors(gap.englishTranslation, allGaps, 3, gap);
  
  if (distractors.length < 2) {
    return null;
  }
  
  const choices = shuffleArray([gap.englishTranslation, ...distractors]);
  
  return validateGapPrompt({
    id: generateId(),
    gapId: gap.id,
    type: 'multiple_choice',
    question: `What does "${gap.frenchWord}" mean in English?`,
    correctAnswer: gap.englishTranslation,
    choices,
    hint: gap.explanation || `This is a key vocabulary word.`,
    category: gap.category,
  });
}

function generateRecognitionPrompt(gap: GapItem, allGaps: GapItem[]): GapPrompt | null {
  if (!gap.frenchWord || !gap.englishTranslation) {
    return null;
  }

  if (!isEnglishText(gap.englishTranslation)) {
    return null;
  }
  
  const distractors = generateFrenchDistractors(gap.frenchWord, allGaps, 3, gap);
  
  if (distractors.length < 2) {
    return null;
  }
  
  const choices = shuffleArray([gap.frenchWord, ...distractors]);
  
  return validateGapPrompt({
    id: generateId(),
    gapId: gap.id,
    type: 'multiple_choice',
    question: `Which French word means "${gap.englishTranslation}"?`,
    correctAnswer: gap.frenchWord,
    choices,
    hint: gap.explanation || `Think about the correct form.`,
    category: gap.category,
  });
}

function generateCorrectionChoicePrompt(gap: GapItem, allGaps: GapItem[]): GapPrompt | null {
  if (!gap.frenchWord || !gap.englishTranslation) {
    return null;
  }

  if (!isEnglishText(gap.englishTranslation)) {
    return null;
  }
  
  const distractors = generateFrenchDistractors(gap.frenchWord, allGaps, 3, gap);
  
  if (distractors.length < 2) {
    return null;
  }
  
  const choices = shuffleArray([gap.frenchWord, ...distractors]);
  
  return validateGapPrompt({
    id: generateId(),
    gapId: gap.id,
    type: 'correction',
    question: `Which is the correct French form for "${gap.englishTranslation}"?`,
    correctAnswer: gap.frenchWord,
    choices,
    hint: gap.explanation || `Remember the correct conjugation/form.`,
    category: gap.category,
  });
}

function generateTypeAnswerPrompt(gap: GapItem): GapPrompt | null {
  if (!gap.frenchWord || !gap.englishTranslation) {
    return null;
  }
  
  if (gap.frenchWord.length < 2) {
    return null;
  }

  if (!isEnglishText(gap.englishTranslation)) {
    return null;
  }
  
  return validateGapPrompt({
    id: generateId(),
    gapId: gap.id,
    type: 'production',
    question: `Type the correct French for:\n\n"${gap.englishTranslation}"`,
    correctAnswer: gap.frenchWord,
    hint: gap.explanation || `Think about the correct form.`,
    category: gap.category,
  });
}

type SentenceValidity = 'valid' | 'correctable' | 'invalid';

function classifySentenceValidity(gap: GapItem): SentenceValidity {
  if (gap.sourceType === 'reading') {
    return 'valid';
  }
  
  if (gap.sourceType === 'foundation' && gap.exampleTranslation) {
    return 'valid';
  }
  
  const sentence = gap.exampleSentence || '';
  
  if (!sentence || sentence.length < 5) {
    return 'invalid';
  }
  
  const words = sentence.split(/\s+/).filter(w => w.length > 0);
  if (words.length < 3) {
    return 'invalid';
  }
  
  const brokenPatterns = [
    /ne\s+\w+\s+pas\s+ne/i,
    /pas\s+ne\s+rien/i,
    /ne\s+rien\s+ne/i,
    /pas\s+pas/i,
    /ne\s+ne/i,
    /rien\s+rien/i,
  ];
  
  for (const pattern of brokenPatterns) {
    if (pattern.test(sentence)) {
      return 'invalid';
    }
  }
  
  if (hasConceptData(gap)) {
    return 'valid';
  }
  
  if (gap.sourceType === 'speech') {
    if (gap.frenchWord && gap.englishTranslation) {
      return 'correctable';
    }
  }
  
  if (gap.sourceType === 'foundation') {
    if (gap.frenchWord && gap.englishTranslation) {
      return 'correctable';
    }
  }
  
  return 'invalid';
}

function generatePromptsForGap(gap: GapItem, allGaps: GapItem[]): GapPrompt[] {
  const validity = classifySentenceValidity(gap);
  
  if (validity === 'invalid') {
    return [];
  }

  if (hasConceptData(gap)) {
    const conceptPrompts = generatePromptsFromConceptData(gap);
    if (conceptPrompts.length >= 3) return conceptPrompts;
  }

  const prompts: GapPrompt[] = [];
  
  const p1 = generateWordMeaningPrompt(gap, allGaps);
  if (p1) prompts.push(p1);
  
  const p2 = generateRecognitionPrompt(gap, allGaps);
  if (p2) prompts.push(p2);
  
  const p3 = generateCorrectionChoicePrompt(gap, allGaps);
  if (p3) prompts.push(p3);
  
  const p4 = generateTypeAnswerPrompt(gap);
  if (p4) prompts.push(p4);

  if (prompts.length < 3) {
    const needed = 5 - prompts.length;
    const templateQuestions = generateTemplateQuestions(gap, allGaps, needed);
    const templatePrompts = templateQuestionsToGapPrompts(templateQuestions, gap.id, gap.category);
    const validated = validateGapPromptBatch(templatePrompts);
    prompts.push(...validated);
    if (validated.length > 0) {
      console.log('[GapLessonGen] Template backfill added', validated.length, 'prompts for gap:', gap.frenchWord);
    }
  }
  
  return prompts;
}

const CEFR_ORDER: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

function cefrToNumeric(level: CEFRLevel): number {
  return CEFR_ORDER.indexOf(level);
}

function numericToCefr(num: number): CEFRLevel {
  return CEFR_ORDER[Math.max(0, Math.min(num, CEFR_ORDER.length - 1))];
}

export function estimateLearnerLevel(allGaps: GapItem[]): CEFRLevel {
  const masteredGaps = allGaps.filter(g => g.masteredAt && g.cefrLevel);
  
  if (masteredGaps.length === 0) {
    return 'A1';
  }

  const levelCounts: Record<CEFRLevel, number> = { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0 };
  masteredGaps.forEach(g => {
    if (g.cefrLevel) {
      levelCounts[g.cefrLevel]++;
    }
  });

  let highestMasteredLevel: CEFRLevel = 'A1';
  for (const level of CEFR_ORDER) {
    if (levelCounts[level] >= 3) {
      highestMasteredLevel = level;
    }
  }

  return highestMasteredLevel;
}

function filterByCefr(gaps: GapItem[], learnerLevel: CEFRLevel): GapItem[] {
  const learnerNum = cefrToNumeric(learnerLevel);
  const maxLevel = numericToCefr(learnerNum + 1);
  const maxNum = cefrToNumeric(maxLevel);

  return gaps.filter(gap => {
    if (!gap.cefrLevel) return true;
    const gapNum = cefrToNumeric(gap.cefrLevel);
    return gapNum <= maxNum;
  });
}

type LessonPhase = 'input' | 'guided' | 'production';

function classifyPromptPhase(prompt: GapPrompt): LessonPhase {
  if (prompt.type === 'multiple_choice') {
    return 'input';
  }
  if (prompt.type === 'fill_blank' || prompt.type === 'correction') {
    return 'guided';
  }
  return 'production';
}

function structureLessonPrompts(prompts: GapPrompt[], maxPrompts: number): GapPrompt[] {
  const inputPrompts: GapPrompt[] = [];
  const guidedPrompts: GapPrompt[] = [];
  const productionPrompts: GapPrompt[] = [];

  for (const prompt of prompts) {
    const phase = classifyPromptPhase(prompt);
    if (phase === 'input') inputPrompts.push(prompt);
    else if (phase === 'guided') guidedPrompts.push(prompt);
    else productionPrompts.push(prompt);
  }

  const shuffledInput = shuffleArray(inputPrompts);
  const shuffledGuided = shuffleArray(guidedPrompts);
  const shuffledProduction = shuffleArray(productionPrompts);

  const totalAvailable = shuffledInput.length + shuffledGuided.length + shuffledProduction.length;
  const targetTotal = Math.min(maxPrompts, totalAvailable);

  const inputTarget = Math.ceil(targetTotal * 0.35);
  const guidedTarget = Math.ceil(targetTotal * 0.35);
  const productionTarget = targetTotal - inputTarget - guidedTarget;

  const finalInput = shuffledInput.slice(0, Math.max(inputTarget, 1));
  const finalGuided = shuffledGuided.slice(0, Math.max(guidedTarget, 1));
  const finalProduction = shuffledProduction.slice(0, Math.max(productionTarget, 1));

  let structured = [...finalInput, ...finalGuided, ...finalProduction];

  if (structured.length < targetTotal) {
    const used = new Set(structured.map(p => p.id));
    const remaining = prompts.filter(p => !used.has(p.id));
    structured = [...structured, ...shuffleArray(remaining).slice(0, targetTotal - structured.length)];
  }

  return structured.slice(0, maxPrompts);
}

export function generateGapLesson(
  gaps: GapItem[],
  category: GapCategory | 'mixed' = 'mixed',
  maxPrompts: number = 25
): GapLesson | null {
  const activeGaps = gaps.filter(gap => !gap.masteredAt);
  
  const filteredByCategory = category === 'mixed' 
    ? activeGaps 
    : activeGaps.filter(gap => gap.category === category);
  
  if (filteredByCategory.length === 0) {
    return null;
  }

  const learnerLevel = estimateLearnerLevel(gaps);
  const cefrFiltered = filterByCefr(filteredByCategory, learnerLevel);

  const gapsToUse = cefrFiltered.sort((a, b) => getPriorityScore(b) - getPriorityScore(a));

  const allPrompts: GapPrompt[] = [];
  const gapIds = new Set<string>();
  
  for (const gap of gapsToUse) {
    const gapPrompts = generatePromptsForGap(gap, activeGaps);
    allPrompts.push(...gapPrompts);
    if (gapPrompts.length > 0) {
      gapIds.add(gap.id);
    }
  }
  
  let validatedPrompts = validateGapPromptBatch(allPrompts);

  if (validatedPrompts.length < 6) {
    console.log('[GapLessonGen] Only', validatedPrompts.length, 'prompts, using templates to bulk up');
    const highPriorityGaps = gapsToUse.slice(0, 4);
    for (const hpGap of highPriorityGaps) {
      if (validatedPrompts.length >= 6) break;
      const needed = Math.min(4, 6 - validatedPrompts.length);
      const templateQuestions = generateTemplateQuestions(hpGap, activeGaps, needed);
      const templatePrompts = templateQuestionsToGapPrompts(templateQuestions, hpGap.id, hpGap.category);
      const validated = validateGapPromptBatch(templatePrompts);
      validatedPrompts.push(...validated);
      if (validated.length > 0) {
        gapIds.add(hpGap.id);
      }
    }
  }

  if (validatedPrompts.length === 0) {
    return null;
  }
  
  if (validatedPrompts.length < 3) {
    console.log('[GapLessonGen] Still under 3 prompts after template bulk, emergency backfill');
    const emergencyGaps = gapsToUse.slice(0, 3);
    for (const eGap of emergencyGaps) {
      if (validatedPrompts.length >= 6) break;
      const needed = Math.min(3, 6 - validatedPrompts.length);
      const tq = generateTemplateQuestions(eGap, activeGaps, needed);
      const tp = templateQuestionsToGapPrompts(tq, eGap.id, eGap.category);
      const v = validateGapPromptBatch(tp);
      validatedPrompts.push(...v);
      if (v.length > 0) gapIds.add(eGap.id);
    }
  }

  const finalPrompts = structureLessonPrompts(validatedPrompts, maxPrompts);
  console.log('[GapLesson] Final prompt count after fallback:', finalPrompts.length);

  const lessonCategoryLabels: Record<GapCategory | 'mixed', string> = {
    vocabulary: 'Vocabulary',
    grammar: 'Grammar',
    pronunciation: 'Pronunciation',
    phrasing: 'Phrasing',
    register: 'Register',
    mixed: 'Mixed Practice',
  };

  return {
    id: generateId(),
    title: `${lessonCategoryLabels[category]} Practice`,
    category,
    gapIds: Array.from(gapIds),
    prompts: finalPrompts,
    createdAt: new Date().toISOString(),
    correctCount: 0,
    totalCount: finalPrompts.length,
  };
}

export function generateQuickQuiz(
  allGaps: GapItem[],
  targetGapIds?: string[],
  maxPrompts: number = 8
): GapLesson | null {
  const activeGaps = allGaps.filter(gap => !gap.masteredAt);

  let gapsToQuiz: GapItem[];
  if (targetGapIds && targetGapIds.length > 0) {
    gapsToQuiz = activeGaps.filter(g => targetGapIds.includes(g.id));
  } else {
    gapsToQuiz = selectPriorityGaps(allGaps, 15);
    if (gapsToQuiz.length === 0) {
      gapsToQuiz = activeGaps;
    }
  }

  if (gapsToQuiz.length === 0) return null;

  gapsToQuiz.sort((a, b) => getPriorityScore(b) - getPriorityScore(a));

  const allPrompts: GapPrompt[] = [];
  const gapIds = new Set<string>();

  for (const gap of gapsToQuiz) {
    const gapPrompts = generatePromptsForGap(gap, activeGaps);
    allPrompts.push(...gapPrompts);
    if (gapPrompts.length > 0) {
      gapIds.add(gap.id);
    }
  }

  if (allPrompts.length === 0) return null;

  const finalPrompts = structureLessonPrompts(allPrompts, maxPrompts);

  return {
    id: generateId(),
    title: 'Quick Review',
    category: 'mixed',
    gapIds: Array.from(gapIds),
    prompts: finalPrompts,
    createdAt: new Date().toISOString(),
    correctCount: 0,
    totalCount: finalPrompts.length,
  };
}

export function generateInjectionQuiz(
  allGaps: GapItem[],
  injectionGaps: GapItem[],
  maxPrompts: number = 6
): GapLesson | null {
  if (injectionGaps.length === 0) return null;

  const activeGaps = allGaps.filter(gap => !gap.masteredAt);
  const allPrompts: GapPrompt[] = [];
  const gapIds = new Set<string>();

  for (const gap of injectionGaps) {
    const gapPrompts = generatePromptsForGap(gap, activeGaps);
    allPrompts.push(...gapPrompts);
    if (gapPrompts.length > 0) {
      gapIds.add(gap.id);
    }
  }

  if (allPrompts.length === 0) return null;

  const finalPrompts = structureLessonPrompts(allPrompts, maxPrompts);

  const hasCritical = injectionGaps.some(g => {
    const info = classifyGapUrgency(g);
    return info.urgency === 'critical';
  });

  return {
    id: generateId(),
    title: hasCritical ? 'Gap Review' : 'Quick Warm-up',
    category: 'mixed',
    gapIds: Array.from(gapIds),
    prompts: finalPrompts,
    createdAt: new Date().toISOString(),
    correctCount: 0,
    totalCount: finalPrompts.length,
  };
}

export function getCategoryStats(gaps: GapItem[]): Record<GapCategory, { active: number; mastered: number; total: number }> {
  const stats: Record<GapCategory, { active: number; mastered: number; total: number }> = {
    vocabulary: { active: 0, mastered: 0, total: 0 },
    grammar: { active: 0, mastered: 0, total: 0 },
    pronunciation: { active: 0, mastered: 0, total: 0 },
    phrasing: { active: 0, mastered: 0, total: 0 },
    register: { active: 0, mastered: 0, total: 0 },
  };

  gaps.forEach(gap => {
    stats[gap.category].total++;
    if (gap.masteredAt) {
      stats[gap.category].mastered++;
    } else {
      stats[gap.category].active++;
    }
  });

  return stats;
}

export const categoryLabels: Record<GapCategory, string> = {
  vocabulary: 'Vocabulary',
  grammar: 'Grammar',
  pronunciation: 'Pronunciation',
  phrasing: 'Phrasing',
  register: 'Register',
};

export const categoryDescriptions: Record<GapCategory, string> = {
  vocabulary: 'Words and phrases you need to learn',
  grammar: 'Conjugations, tenses, and agreement errors',
  pronunciation: 'Sounds and speech patterns to practice',
  phrasing: 'More natural ways to express ideas',
  register: 'Formal vs informal language usage',
};
