import { GapItem, ConceptCluster, GapPromptType, FoundationItem, ContentType } from '@/types';
import { getValidExerciseTypes, inferContentType } from '@/utils/exerciseTypeRouter';
import { classifyError } from '@/utils/errorClassifier';
import { addError } from '@/utils/errorHistoryStore';
import { validateQuestionBatch, validateQuestion } from '@/utils/questionValidator';
import { generateTemplateQuestionsFromConcept } from '@/utils/exerciseTemplates';
import { getSmartDistractors } from '@/utils/distractorBank';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function escapeRegExp(str: string): string {
  return str.split('').map(char => {
    const specials = '.^$*+?()[]{}|';
    if (specials.includes(char) || char === String.fromCharCode(92)) {
      return String.fromCharCode(92) + char;
    }
    return char;
  }).join('');
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export type EngagingQuestionType =
  | 'multiple_choice'
  | 'fill_blank'
  | 'word_order'
  | 'match_pairs'
  | 'listen_type'
  | 'sentence_build'
  | 'translation'
  | 'production'
  | 'spot_the_error'
  | 'true_false'
  | 'speak_to_answer'
  | 'sound_to_letter'
  | 'letter_to_sound'
  | 'alphabet_sequence';

export interface EngagingQuestion {
  id: string;
  type: EngagingQuestionType;
  conceptId: string;
  content: string;
  correctAnswer: string;
  choices?: string[];
  scrambledWords?: string[];
  wordBank?: string[];
  pairs?: { french: string; english: string }[];
  audioText?: string;
  hint?: string;
  explanation?: string;
  relatedGapId?: string;
  involvedConceptIds?: string[];
  errorSentence?: string;
  correctedSentence?: string;
  statement?: string;
  isTrue?: boolean;
  sequence?: string[];
  blankIndex?: number;
}

export interface ConceptMasteryItem {
  id: string;
  label: string;
  french: string;
  english: string;
  explanation: string;
  exampleSentence: string;
  exampleTranslation: string;
  consecutiveCorrect: number;
  totalAttempts: number;
  totalCorrect: number;
  mastered: boolean;
  relatedGapId: string;
  questionBank: EngagingQuestion[];
  contentType?: ContentType;
}

export interface LessonIntro {
  title: string;
  description: string;
  conceptPreviews: { french: string; english: string }[];
  conceptCount: number;
}

export const MASTERY_THRESHOLD = 3;
export const MAX_QUESTIONS_LIMIT = 200;
export const SESSION_BREAK_INTERVAL = 20;

const FORMAT_DIFFICULTY: Record<EngagingQuestionType, number> = {
  match_pairs: 1,
  multiple_choice: 1,
  true_false: 1,
  sound_to_letter: 1,
  letter_to_sound: 1,
  alphabet_sequence: 1,
  fill_blank: 2,
  word_order: 2,
  spot_the_error: 2,
  sentence_build: 3,
  listen_type: 3,
  speak_to_answer: 3,
  translation: 4,
  production: 4,
};

const QUESTION_TYPE_LABELS: Record<EngagingQuestionType, string> = {
  multiple_choice: 'Choose the correct answer',
  fill_blank: 'Fill in the blank',
  word_order: 'Arrange the words',
  match_pairs: 'Match the pairs',
  listen_type: 'Listen & type',
  speak_to_answer: 'Speak your answer',
  sentence_build: 'Build the sentence',
  translation: 'Translate to French',
  production: 'Write your answer',
  spot_the_error: 'Spot the error',
  true_false: 'True or false',
  sound_to_letter: 'Sound to letter',
  letter_to_sound: 'Letter to sound',
  alphabet_sequence: 'Complete the sequence',
};

export function getQuestionTypeLabel(type: EngagingQuestionType): string {
  return QUESTION_TYPE_LABELS[type] || 'Answer';
}

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,!?;:'"\-()«»\u2018\u2019\u201C\u201D]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function checkQuestionAnswer(question: EngagingQuestion, userAnswer: string): boolean {
  if (question.type === 'match_pairs') return true;
  if (question.type === 'spot_the_error') return true;
  if (question.type === 'true_false') return true;
  if (question.type === 'sound_to_letter') return true;
  if (question.type === 'letter_to_sound') return true;
  if (question.type === 'alphabet_sequence') {
    return normalizeText(userAnswer) === normalizeText(question.correctAnswer);
  }

  const normalizedUser = normalizeText(userAnswer);
  const normalizedCorrect = normalizeText(question.correctAnswer);

  if (!normalizedUser) return false;
  if (normalizedUser === normalizedCorrect) return true;

  if (question.type === 'production') {
    if (normalizedUser.length >= 3) {
      const correctWords = normalizedCorrect.split(' ').filter(w => w.length > 1);
      const userWords = normalizedUser.split(' ');
      const matchCount = correctWords.filter(w =>
        userWords.some(uw => uw === w || (uw.length > 2 && w.includes(uw)))
      ).length;
      return matchCount >= Math.ceil(correctWords.length * 0.5);
    }
  }

  if (question.type === 'translation' || question.type === 'fill_blank') {
    if (normalizedCorrect.includes(normalizedUser) && normalizedUser.length >= 3) return true;
    if (normalizedUser.includes(normalizedCorrect) && normalizedCorrect.length >= 3) return true;
  }

  if (question.type === 'word_order' || question.type === 'sentence_build') {
    const userWords = normalizedUser.split(' ').filter(w => w.length > 0);
    const correctWords = normalizedCorrect.split(' ').filter(w => w.length > 0);
    if (userWords.length === correctWords.length && userWords.every((w, i) => w === correctWords[i])) {
      return true;
    }
  }

  return false;
}

function generateQuestionBank(
  concept: ConceptMasteryItem,
  allConcepts: ConceptMasteryItem[],
  allGaps: GapItem[]
): EngagingQuestion[] {
  const questions: EngagingQuestion[] = [];
  const otherConcepts = allConcepts.filter(c => c.id !== concept.id);

  const gap = allGaps.find(g => g.id === concept.relatedGapId);
  if (gap?.conceptData?.questionPool) {
    for (const q of gap.conceptData.questionPool) {
      const validTypes: GapPromptType[] = ['multiple_choice', 'fill_blank', 'correction', 'translation', 'production'];
      if (!validTypes.includes(q.type)) continue;

      let mappedChoices = q.choices;
      if (q.type === 'multiple_choice' && q.choices) {
        const hasCorrect = q.choices.some(c => normalizeText(c) === normalizeText(q.correctAnswer));
        if (!hasCorrect) {
          mappedChoices = shuffleArray([q.correctAnswer, ...q.choices.slice(0, 3)]);
        } else {
          mappedChoices = shuffleArray([...q.choices]);
        }
      }

      const mappedType: EngagingQuestionType = q.type === 'correction' ? 'fill_blank' : q.type as EngagingQuestionType;

      questions.push({
        id: generateId(),
        type: mappedType,
        conceptId: concept.id,
        content: q.question,
        correctAnswer: q.correctAnswer,
        choices: mappedChoices,
        hint: q.hint,
        relatedGapId: concept.relatedGapId,
      });
    }
  }

  const englishFromConcepts = otherConcepts
    .map(c => c.english)
    .filter(t => t && t !== concept.english && t.length > 1);

  const englishBankDistractors = getSmartDistractors({
    correctAnswer: concept.english,
    answerLanguage: 'english',
    count: 3,
    contentType: concept.contentType,
    cefrLevel: gap?.cefrLevel,
    avoidList: [concept.english],
  });
  const mergedEnglish = [...new Set([...englishFromConcepts.slice(0, 2), ...englishBankDistractors])]
    .filter(d => d.toLowerCase().trim() !== concept.english.toLowerCase().trim())
    .slice(0, 3);

  if (mergedEnglish.length >= 2) {
    questions.push({
      id: generateId(),
      type: 'multiple_choice',
      conceptId: concept.id,
      content: `What does "${concept.french}" mean?`,
      correctAnswer: concept.english,
      choices: shuffleArray([concept.english, ...mergedEnglish.slice(0, 3)]),
      hint: concept.explanation || undefined,
      relatedGapId: concept.relatedGapId,
    });
  }

  const frenchFromConcepts = otherConcepts
    .map(c => c.french)
    .filter(t => t && t !== concept.french && t.length > 1);

  const frenchBankDistractors = getSmartDistractors({
    correctAnswer: concept.french,
    answerLanguage: 'french',
    count: 3,
    contentType: concept.contentType,
    cefrLevel: gap?.cefrLevel,
    avoidList: [concept.french],
  });
  const mergedFrench = [...new Set([...frenchFromConcepts.slice(0, 2), ...frenchBankDistractors])]
    .filter(d => d.toLowerCase().trim() !== concept.french.toLowerCase().trim())
    .slice(0, 3);

  if (mergedFrench.length >= 2) {
    questions.push({
      id: generateId(),
      type: 'multiple_choice',
      conceptId: concept.id,
      content: `Which French word means "${concept.english}"?`,
      correctAnswer: concept.french,
      choices: shuffleArray([concept.french, ...mergedFrench.slice(0, 3)]),
      hint: concept.explanation || undefined,
      relatedGapId: concept.relatedGapId,
    });
  }

  if (concept.exampleSentence) {
    const escaped = escapeRegExp(concept.french);
    const regex = new RegExp(escaped, 'i');
    if (regex.test(concept.exampleSentence)) {
      const blank = concept.exampleSentence.replace(regex, '___');
      questions.push({
        id: generateId(),
        type: 'fill_blank',
        conceptId: concept.id,
        content: `Complete the sentence:\n\n"${blank}"`,
        correctAnswer: concept.french,
        hint: concept.exampleTranslation || concept.explanation || undefined,
        relatedGapId: concept.relatedGapId,
      });
    }
  }

  if (concept.exampleSentence) {
    const clean = concept.exampleSentence.replace(/[.,!?;:«»\u2018\u2019\u201C\u201D]/g, '').trim();
    const words = clean.split(/\s+/).filter(w => w.length > 0);
    if (words.length >= 3 && words.length <= 10) {
      let scrambled = shuffleArray([...words]);
      let attempts = 0;
      while (scrambled.join(' ') === words.join(' ') && attempts < 5) {
        scrambled = shuffleArray([...words]);
        attempts++;
      }
      if (scrambled.join(' ') !== words.join(' ')) {
        questions.push({
          id: generateId(),
          type: 'word_order',
          conceptId: concept.id,
          content: concept.exampleTranslation
            ? `"${concept.exampleTranslation}"`
            : 'Arrange into a correct French sentence:',
          correctAnswer: words.join(' '),
          scrambledWords: scrambled,
          hint: concept.explanation || undefined,
          relatedGapId: concept.relatedGapId,
        });
      }
    }
  }

  if (concept.exampleSentence) {
    const clean = concept.exampleSentence.replace(/[.,!?;:«»\u2018\u2019\u201C\u201D]/g, '').trim();
    const words = clean.split(/\s+/).filter(w => w.length > 0);
    if (words.length >= 3 && words.length <= 8) {
      const distractorPool = ['aussi', 'très', 'mais', 'encore', 'toujours', 'jamais', 'peut-être', 'bien', 'souvent', 'déjà', 'ici', 'là'];
      const distractors = distractorPool
        .filter(w => !words.map(x => x.toLowerCase()).includes(w.toLowerCase()))
        .slice(0, Math.min(3, Math.ceil(words.length * 0.4)));

      questions.push({
        id: generateId(),
        type: 'sentence_build',
        conceptId: concept.id,
        content: concept.exampleTranslation
          ? `Build: "${concept.exampleTranslation}"`
          : `Build a sentence using "${concept.french}":`,
        correctAnswer: words.join(' '),
        wordBank: shuffleArray([...words, ...distractors]),
        hint: concept.explanation || undefined,
        relatedGapId: concept.relatedGapId,
      });
    }
  }

  if (concept.exampleSentence && concept.exampleSentence.split(/\s+/).length >= 3) {
    questions.push({
      id: generateId(),
      type: 'listen_type',
      conceptId: concept.id,
      content: 'Listen and type what you hear:',
      correctAnswer: concept.exampleSentence,
      audioText: concept.exampleSentence,
      hint: `This sentence uses "${concept.french}"`,
      relatedGapId: concept.relatedGapId,
    });
  } else if (concept.french && concept.french.length >= 2) {
    questions.push({
      id: generateId(),
      type: 'listen_type',
      conceptId: concept.id,
      content: 'Listen and type what you hear:',
      correctAnswer: concept.french,
      audioText: concept.french,
      hint: `This means "${concept.english}"`,
      relatedGapId: concept.relatedGapId,
    });
  }

  if (concept.exampleSentence && concept.exampleTranslation) {
    questions.push({
      id: generateId(),
      type: 'speak_to_answer',
      conceptId: concept.id,
      content: concept.exampleTranslation,
      correctAnswer: concept.exampleSentence,
      hint: `Use "${concept.french}"`,
      relatedGapId: concept.relatedGapId,
    });
  } else if (concept.english && concept.french) {
    questions.push({
      id: generateId(),
      type: 'speak_to_answer',
      conceptId: concept.id,
      content: concept.english,
      correctAnswer: concept.french,
      hint: concept.explanation || undefined,
      relatedGapId: concept.relatedGapId,
    });
  }

  questions.push({
    id: generateId(),
    type: 'translation',
    conceptId: concept.id,
    content: `Translate to French:\n\n"${concept.english}"`,
    correctAnswer: concept.french,
    hint: concept.explanation || undefined,
    relatedGapId: concept.relatedGapId,
  });

  if (concept.exampleSentence) {
    questions.push({
      id: generateId(),
      type: 'production',
      conceptId: concept.id,
      content: `Write a French sentence using "${concept.french}":`,
      correctAnswer: concept.exampleSentence,
      hint: `Meaning: "${concept.english}"`,
      explanation: concept.explanation,
      relatedGapId: concept.relatedGapId,
    });
  }

  let validated = validateQuestionBatch(shuffleArray(questions));

  if (validated.length < 5) {
    console.log('[MasteryEngine] Only', validated.length, 'questions for', concept.label, '— using template backfill');
    const needed = 5 - validated.length;
    const templateQ = generateTemplateQuestionsFromConcept(concept, allConcepts, needed);
    validated.push(...templateQ);
  }

  return validated;
}

export function generateMatchPairsQuestion(concepts: ConceptMasteryItem[]): EngagingQuestion | null {
  const eligible = concepts.filter(c => !c.mastered && c.french && c.english);
  if (eligible.length < 3) return null;

  const selected = shuffleArray(eligible).slice(0, Math.min(4, eligible.length));

  return {
    id: generateId(),
    type: 'match_pairs',
    conceptId: selected[0].id,
    content: 'Match the French words with their meanings:',
    correctAnswer: '',
    pairs: selected.map(c => ({ french: c.french, english: c.english })),
    relatedGapId: selected[0].relatedGapId,
    involvedConceptIds: selected.map(c => c.id),
  };
}

export function initializeLesson(
  cluster: ConceptCluster,
  gaps: GapItem[]
): { concepts: ConceptMasteryItem[]; intro: LessonIntro } | null {
  const clusterGaps = gaps.filter(g => cluster.gapIds.includes(g.id) && !g.masteredAt);

  if (clusterGaps.length === 0) {
    console.log('[MasteryEngine] No active gaps for cluster:', cluster.name);
    return null;
  }

  const selectedGaps = clusterGaps
    .sort((a, b) => a.consecutiveCorrect - b.consecutiveCorrect)
    .slice(0, 6);

  console.log('[MasteryEngine] Initializing', selectedGaps.length, 'concepts for:', cluster.name);

  const concepts: ConceptMasteryItem[] = selectedGaps.map(gap => ({
    id: `concept_${generateId()}`,
    label: gap.conceptData?.conceptLabel || gap.frenchWord,
    french: gap.frenchWord,
    english: gap.englishTranslation,
    explanation: gap.explanation || gap.conceptData?.teachingFocus || '',
    exampleSentence: gap.exampleSentence || '',
    exampleTranslation: gap.exampleTranslation || '',
    consecutiveCorrect: 0,
    totalAttempts: 0,
    totalCorrect: 0,
    mastered: false,
    relatedGapId: gap.id,
    questionBank: [],
  }));

  for (const concept of concepts) {
    concept.questionBank = generateQuestionBank(concept, concepts, clusterGaps);
    console.log('[MasteryEngine] Generated', concept.questionBank.length, 'questions for:', concept.label);
  }

  const intro: LessonIntro = {
    title: cluster.name,
    description: cluster.description || concepts[0]?.explanation || 'Practice and master these concepts',
    conceptPreviews: concepts.map(c => ({ french: c.french, english: c.english })),
    conceptCount: concepts.length,
  };

  return { concepts, intro };
}

export function getNextQuestion(
  concepts: ConceptMasteryItem[],
  lastFormatUsed: EngagingQuestionType | null,
  questionsAnswered: number
): EngagingQuestion | null {
  const unmastered = concepts.filter(c => !c.mastered);
  if (unmastered.length === 0) return null;
  if (questionsAnswered >= MAX_QUESTIONS_LIMIT) return null;

  if (questionsAnswered > 0 && questionsAnswered % 5 === 0 && unmastered.length >= 3) {
    const matchQ = generateMatchPairsQuestion(unmastered);
    if (matchQ) {
      console.log('[MasteryEngine] Inserting match_pairs round');
      return matchQ;
    }
  }

  const sorted = [...unmastered].sort((a, b) => {
    if (a.totalAttempts !== b.totalAttempts) return a.totalAttempts - b.totalAttempts;
    return a.consecutiveCorrect - b.consecutiveCorrect;
  });

  const target = sorted[0];

  let targetDiff: number;
  if (target.totalAttempts === 0) targetDiff = 1;
  else if (target.consecutiveCorrect === 0) targetDiff = 2;
  else targetDiff = 3;

  const bank = target.questionBank;

  let candidates = bank.filter(q => {
    const d = FORMAT_DIFFICULTY[q.type];
    return Math.abs(d - targetDiff) <= 1 && q.type !== lastFormatUsed;
  });

  if (candidates.length === 0) {
    candidates = bank.filter(q => Math.abs(FORMAT_DIFFICULTY[q.type] - targetDiff) <= 1);
  }

  if (candidates.length === 0) {
    candidates = bank.filter(q => q.type !== lastFormatUsed);
  }

  if (candidates.length === 0) {
    candidates = bank;
  }

  if (candidates.length > 0) {
    for (const candidate of candidates) {
      const valid = validateQuestion(candidate);
      if (valid) {
        target.questionBank = target.questionBank.filter(q => q.id !== candidate.id);
        console.log('[MasteryEngine] Serving', valid.type, 'for:', target.label, '| Bank remaining:', target.questionBank.length);
        return valid;
      }
      target.questionBank = target.questionBank.filter(q => q.id !== candidate.id);
      console.warn('[MasteryEngine] Skipped invalid question from bank for:', target.label);
    }
  }

  console.log('[MasteryEngine] Regenerating bank for:', target.label);
  const newBank = generateQuestionBank(target, concepts, []);
  target.questionBank = newBank;

  if (newBank.length > 0) {
    for (const candidate of newBank) {
      const valid = validateQuestion(candidate);
      if (valid) {
        target.questionBank = newBank.filter(q => q.id !== candidate.id);
        return valid;
      }
    }
    target.questionBank = [];
  }

  return {
    id: generateId(),
    type: 'translation',
    conceptId: target.id,
    content: `Translate to French:\n\n"${target.english}"`,
    correctAnswer: target.french,
    hint: target.explanation,
    relatedGapId: target.relatedGapId,
  };
}

export function processConceptAnswer(
  concepts: ConceptMasteryItem[],
  conceptId: string,
  isCorrect: boolean,
  wrongAnswer?: string,
  questionType?: string,
): { newlyMastered: boolean; conceptLabel: string } {
  const concept = concepts.find(c => c.id === conceptId);
  if (!concept) return { newlyMastered: false, conceptLabel: '' };

  concept.totalAttempts++;

  if (isCorrect) {
    concept.consecutiveCorrect++;
    concept.totalCorrect++;
  } else {
    concept.consecutiveCorrect = 0;

    if (wrongAnswer && questionType) {
      const errorType = classifyError(wrongAnswer, concept.french || '', questionType);
      addError({
        errorType,
        wrongAnswer,
        correctAnswer: concept.french || '',
        questionType,
        conceptId,
        timestamp: new Date().toISOString(),
      }).catch(e => console.error('[MasteryEngine] Failed to store error:', e));
      console.log('[MasteryEngine] Classified error:', errorType, 'wrong:', wrongAnswer, 'correct:', concept.french);
    }
  }

  let newlyMastered = false;
  if (concept.consecutiveCorrect >= MASTERY_THRESHOLD && !concept.mastered) {
    concept.mastered = true;
    newlyMastered = true;
    console.log('[MasteryEngine] Concept MASTERED:', concept.label);
  }

  return { newlyMastered, conceptLabel: concept.label };
}

export function isLessonComplete(concepts: ConceptMasteryItem[], questionsAnswered: number): boolean {
  return concepts.every(c => c.mastered) || questionsAnswered >= MAX_QUESTIONS_LIMIT;
}

export function shouldSuggestBreak(questionsAnswered: number, concepts: ConceptMasteryItem[]): boolean {
  if (questionsAnswered === 0) return false;
  if (concepts.every(c => c.mastered)) return false;
  return questionsAnswered % SESSION_BREAK_INTERVAL === 0;
}

export function getSessionProgress(concepts: ConceptMasteryItem[]): { mastered: number; total: number; percentage: number } {
  const total = concepts.length;
  const mastered = concepts.filter(c => c.mastered).length;
  return { mastered, total, percentage: Math.round((mastered / total) * 100) };
}

export function getMasteredCount(concepts: ConceptMasteryItem[]): number {
  return concepts.filter(c => c.mastered).length;
}

const FRENCH_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const FRENCH_LETTER_PHONETICS: Record<string, string> = {
  A: 'ah', B: 'bay', C: 'say', D: 'day', E: 'euh', F: 'eff',
  G: 'zhay', H: 'ash', I: 'ee', J: 'zhee', K: 'kah', L: 'ell',
  M: 'em', N: 'en', O: 'oh', P: 'pay', Q: 'kü', R: 'air',
  S: 'ess', T: 'tay', U: 'ü', V: 'vay', W: 'doo-bluh-vay',
  X: 'eeks', Y: 'ee-grek', Z: 'zed',
};

function resolveContentType(concept: ConceptMasteryItem): ContentType {
  if (concept.contentType) return concept.contentType;
  return inferContentType('vocabulary', concept.explanation || '', concept.french);
}

function generatePhoneticQuestions(
  concept: ConceptMasteryItem,
  allConcepts: ConceptMasteryItem[],
): EngagingQuestion[] {
  const questions: EngagingQuestion[] = [];
  const letter = concept.french.trim().toUpperCase();
  const phonetic = FRENCH_LETTER_PHONETICS[letter];
  const others = allConcepts.filter(c => c.id !== concept.id);

  if (phonetic) {
    const otherLetters = others
      .map(c => c.french.trim().toUpperCase())
      .filter(l => l.length <= 2 && l !== letter && FRENCH_LETTER_PHONETICS[l]);
    const distractors = shuffleArray(otherLetters.length > 0 ? otherLetters : FRENCH_ALPHABET.filter(l => l !== letter)).slice(0, 3);

    questions.push({
      id: generateId(),
      type: 'sound_to_letter',
      conceptId: concept.id,
      content: `Listen and pick the letter`,
      correctAnswer: letter,
      choices: shuffleArray([letter, ...distractors]),
      audioText: concept.french,
    });

    const otherPhonetics = otherLetters
      .map(l => FRENCH_LETTER_PHONETICS[l])
      .filter((p): p is string => !!p && p !== phonetic);
    const phoneticDistractors = shuffleArray(
      otherPhonetics.length >= 3
        ? otherPhonetics
        : Object.values(FRENCH_LETTER_PHONETICS).filter(p => p !== phonetic)
    ).slice(0, 3);

    questions.push({
      id: generateId(),
      type: 'letter_to_sound',
      conceptId: concept.id,
      content: letter,
      correctAnswer: phonetic,
      choices: shuffleArray([phonetic, ...phoneticDistractors]),
    });
  }

  const letterIdx = FRENCH_ALPHABET.indexOf(letter);
  if (letterIdx >= 1 && letterIdx < FRENCH_ALPHABET.length - 1) {
    const seqStart = Math.max(0, letterIdx - 2);
    const seqEnd = Math.min(FRENCH_ALPHABET.length, seqStart + 5);
    const sequence = FRENCH_ALPHABET.slice(seqStart, seqEnd);
    const blankPos = letterIdx - seqStart;
    questions.push({
      id: generateId(),
      type: 'alphabet_sequence',
      conceptId: concept.id,
      content: 'What letter is missing?',
      correctAnswer: letter.toLowerCase(),
      sequence: sequence.map((l, i) => i === blankPos ? '_' : l),
      blankIndex: blankPos,
    });
  }

  if (concept.french.length >= 1) {
    questions.push({
      id: generateId(),
      type: 'listen_type',
      conceptId: concept.id,
      content: 'Listen and type the letter you hear:',
      correctAnswer: concept.french,
      audioText: concept.french,
      hint: phonetic ? `Sounds like "${phonetic}"` : undefined,
    });
  }

  const englishDistractors = others
    .map(c => c.english)
    .filter(t => t && t !== concept.english && t.length > 1);
  if (englishDistractors.length >= 2) {
    questions.push({
      id: generateId(),
      type: 'multiple_choice',
      conceptId: concept.id,
      content: `The French letter "${letter}" is pronounced like:`,
      correctAnswer: concept.english || phonetic || letter,
      choices: shuffleArray([concept.english || phonetic || letter, ...shuffleArray(englishDistractors).slice(0, 3)]),
    });
  }

  questions.push({
    id: generateId(),
    type: 'true_false',
    conceptId: concept.id,
    content: `Is this correct?`,
    correctAnswer: 'true',
    statement: `The French letter "${letter}" is pronounced "${phonetic || concept.english}"`,
    isTrue: true,
  });

  let validated = validateQuestionBatch(shuffleArray(questions));

  if (validated.length < 5) {
    console.log('[FoundationQBank] Only', validated.length, 'questions, template backfill for:', concept.french);
    const needed = 5 - validated.length;
    const templateQ = generateTemplateQuestionsFromConcept(concept, allConcepts, needed);
    validated.push(...templateQ);
  }

  return validated;
}

function generateGrammarQuestions(
  concept: ConceptMasteryItem,
  allConcepts: ConceptMasteryItem[],
): EngagingQuestion[] {
  const questions: EngagingQuestion[] = [];
  const others = allConcepts.filter(c => c.id !== concept.id);
  const cleanFrench = concept.french.replace(/[.,!?;:«»\u2018\u2019\u201C\u201D]/g, '').trim();
  const words = cleanFrench.split(/\s+/).filter(w => w.length > 0);

  if (words.length >= 2) {
    const substantialWords = words.filter(w => w.length > 2);
    if (substantialWords.length > 0) {
      const blankWord = substantialWords[Math.floor(Math.random() * substantialWords.length)];
      const blanked = words.map(w => w === blankWord ? '___' : w).join(' ');
      questions.push({
        id: generateId(),
        type: 'fill_blank',
        conceptId: concept.id,
        content: `Complete the expression:\n\n"${blanked}"`,
        correctAnswer: blankWord,
        hint: `Full meaning: "${concept.english}"`,
      });
    }
  }

  if (concept.exampleSentence) {
    const sentenceLower = concept.exampleSentence.toLowerCase();
    const frenchLower = concept.french.toLowerCase();
    if (sentenceLower.includes(frenchLower)) {
      const errorVariants = ['le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'au', 'aux'];
      const sentenceWords = concept.exampleSentence.split(/\s+/);
      const articlesInSentence = sentenceWords.filter(w => errorVariants.includes(w.toLowerCase()));
      if (articlesInSentence.length > 0) {
        const targetWord = articlesInSentence[0];
        const replacement = errorVariants.find(v => v !== targetWord.toLowerCase()) || 'le';
        const errorSentence = concept.exampleSentence.replace(new RegExp(`\\b${targetWord}\\b`, 'i'), replacement);
        if (errorSentence !== concept.exampleSentence) {
          questions.push({
            id: generateId(),
            type: 'spot_the_error',
            conceptId: concept.id,
            content: 'Find and fix the error:',
            correctAnswer: concept.exampleSentence,
            errorSentence,
            correctedSentence: concept.exampleSentence,
            hint: concept.explanation || undefined,
          });
        }
      }
    }
  }

  questions.push({
    id: generateId(),
    type: 'true_false',
    conceptId: concept.id,
    content: 'Is this rule correct?',
    correctAnswer: 'true',
    statement: concept.explanation || `"${concept.french}" means "${concept.english}"`,
    isTrue: true,
  });

  const grammarFrenchFromOthers = others
    .map(c => c.french)
    .filter(t => t && t !== concept.french && t.length > 1);
  const grammarFrenchBank = getSmartDistractors({
    correctAnswer: concept.french,
    answerLanguage: 'french',
    count: 3,
    contentType: concept.contentType || 'grammar_rule',
    avoidList: [concept.french],
  });
  const grammarMergedFrench = [...new Set([...grammarFrenchFromOthers.slice(0, 2), ...grammarFrenchBank])]
    .filter(d => d.toLowerCase().trim() !== concept.french.toLowerCase().trim())
    .slice(0, 3);
  if (grammarMergedFrench.length >= 2) {
    questions.push({
      id: generateId(),
      type: 'multiple_choice',
      conceptId: concept.id,
      content: `Which is the correct form for: "${concept.english}"?`,
      correctAnswer: concept.french,
      choices: shuffleArray([concept.french, ...grammarMergedFrench.slice(0, 3)]),
    });
  }

  if (words.length >= 3 && words.length <= 10) {
    let scrambled = shuffleArray([...words]);
    let attempts = 0;
    while (scrambled.join(' ') === words.join(' ') && attempts < 5) {
      scrambled = shuffleArray([...words]);
      attempts++;
    }
    if (scrambled.join(' ') !== words.join(' ')) {
      questions.push({
        id: generateId(),
        type: 'word_order',
        conceptId: concept.id,
        content: `Arrange the words: "${concept.english}"`,
        correctAnswer: words.join(' '),
        scrambledWords: scrambled,
      });
    }
  }

  if (words.length >= 3 && words.length <= 8) {
    const distractorPool = ['aussi', 'très', 'mais', 'encore', 'toujours', 'jamais', 'peut-être', 'bien', 'souvent', 'déjà'];
    const distractors = distractorPool
      .filter(w => !words.map(x => x.toLowerCase()).includes(w.toLowerCase()))
      .slice(0, Math.min(3, Math.ceil(words.length * 0.4)));
    questions.push({
      id: generateId(),
      type: 'sentence_build',
      conceptId: concept.id,
      content: `Build: "${concept.english}"`,
      correctAnswer: words.join(' '),
      wordBank: shuffleArray([...words, ...distractors]),
    });
  }

  let grammarValidated = validateQuestionBatch(shuffleArray(questions));

  if (grammarValidated.length < 5) {
    console.log('[MasteryEngine] Grammar questions only', grammarValidated.length, 'for', concept.french, '— template backfill');
    const needed = 5 - grammarValidated.length;
    const templateQ = generateTemplateQuestionsFromConcept(concept, allConcepts, needed);
    grammarValidated.push(...templateQ);
  }

  return grammarValidated;
}

function generateFoundationQuestionBank(
  concept: ConceptMasteryItem,
  allConcepts: ConceptMasteryItem[]
): EngagingQuestion[] {
  const contentType = resolveContentType(concept);
  const validTypes = getValidExerciseTypes(contentType);
  const validSet = new Set(validTypes);

  console.log('[FoundationQBank] contentType:', contentType, 'validTypes:', validTypes.join(','), 'for:', concept.french);

  if (contentType === 'alphabet_phonetics') {
    return generatePhoneticQuestions(concept, allConcepts);
  }

  if (contentType === 'grammar_rule' || contentType === 'verb_conjugation' || contentType === 'sentence_structure') {
    return generateGrammarQuestions(concept, allConcepts);
  }

  const questions: EngagingQuestion[] = [];
  const others = allConcepts.filter(c => c.id !== concept.id);

  const foundEnglishFromOthers = others
    .map(c => c.english)
    .filter(t => t && t !== concept.english && t.length > 1);
  const foundEnglishBank = getSmartDistractors({
    correctAnswer: concept.english,
    answerLanguage: 'english',
    count: 3,
    contentType: contentType,
    avoidList: [concept.english],
  });
  const foundMergedEnglish = [...new Set([...foundEnglishFromOthers.slice(0, 2), ...foundEnglishBank])]
    .filter(d => d.toLowerCase().trim() !== concept.english.toLowerCase().trim())
    .slice(0, 3);

  if (validSet.has('multiple_choice') && foundMergedEnglish.length >= 2) {
    questions.push({
      id: generateId(),
      type: 'multiple_choice',
      conceptId: concept.id,
      content: `What does "${concept.french}" mean?`,
      correctAnswer: concept.english,
      choices: shuffleArray([concept.english, ...foundMergedEnglish.slice(0, 3)]),
    });
  }

  const foundFrenchFromOthers = others
    .map(c => c.french)
    .filter(t => t && t !== concept.french && t.length > 1);
  const foundFrenchBank = getSmartDistractors({
    correctAnswer: concept.french,
    answerLanguage: 'french',
    count: 3,
    contentType: contentType,
    avoidList: [concept.french],
  });
  const foundMergedFrench = [...new Set([...foundFrenchFromOthers.slice(0, 2), ...foundFrenchBank])]
    .filter(d => d.toLowerCase().trim() !== concept.french.toLowerCase().trim())
    .slice(0, 3);

  if (validSet.has('multiple_choice') && foundMergedFrench.length >= 2) {
    questions.push({
      id: generateId(),
      type: 'multiple_choice',
      conceptId: concept.id,
      content: `Which French expression means "${concept.english}"?`,
      correctAnswer: concept.french,
      choices: shuffleArray([concept.french, ...foundMergedFrench.slice(0, 3)]),
    });
  }

  const cleanFrench = concept.french.replace(/[.,!?;:«»\u2018\u2019\u201C\u201D]/g, '').trim();
  const words = cleanFrench.split(/\s+/).filter(w => w.length > 0);

  if (validSet.has('fill_blank') && words.length >= 2) {
    const substantialWords = words.filter(w => w.length > 2);
    if (substantialWords.length > 0) {
      const blankWord = substantialWords[Math.floor(Math.random() * substantialWords.length)];
      const blanked = words.map(w => w === blankWord ? '___' : w).join(' ');
      questions.push({
        id: generateId(),
        type: 'fill_blank',
        conceptId: concept.id,
        content: `Complete the expression:\n\n"${blanked}"`,
        correctAnswer: blankWord,
        hint: `Full meaning: "${concept.english}"`,
      });
    }
  }

  if (validSet.has('word_order') && words.length >= 3 && words.length <= 10) {
    let scrambled = shuffleArray([...words]);
    let attempts = 0;
    while (scrambled.join(' ') === words.join(' ') && attempts < 5) {
      scrambled = shuffleArray([...words]);
      attempts++;
    }
    if (scrambled.join(' ') !== words.join(' ')) {
      questions.push({
        id: generateId(),
        type: 'word_order',
        conceptId: concept.id,
        content: `Arrange the words: "${concept.english}"`,
        correctAnswer: words.join(' '),
        scrambledWords: scrambled,
      });
    }
  }

  if (validSet.has('sentence_build') && words.length >= 3 && words.length <= 8) {
    const distractorPool = ['aussi', 'très', 'mais', 'encore', 'toujours', 'jamais', 'peut-être', 'bien', 'souvent', 'déjà', 'ici', 'là'];
    const distractors = distractorPool
      .filter(w => !words.map(x => x.toLowerCase()).includes(w.toLowerCase()))
      .slice(0, Math.min(3, Math.ceil(words.length * 0.4)));
    questions.push({
      id: generateId(),
      type: 'sentence_build',
      conceptId: concept.id,
      content: `Build: "${concept.english}"`,
      correctAnswer: words.join(' '),
      wordBank: shuffleArray([...words, ...distractors]),
    });
  }

  if (validSet.has('listen_and_type') && concept.french.length >= 2) {
    questions.push({
      id: generateId(),
      type: 'listen_type',
      conceptId: concept.id,
      content: 'Listen and type what you hear:',
      correctAnswer: concept.french,
      audioText: concept.french,
      hint: `This means "${concept.english}"`,
    });
  }

  if (validSet.has('translation')) {
    questions.push({
      id: generateId(),
      type: 'translation',
      conceptId: concept.id,
      content: `Translate to French:\n\n"${concept.english}"`,
      correctAnswer: concept.french,
      hint: concept.explanation || undefined,
    });
  }

  if (validSet.has('production')) {
    questions.push({
      id: generateId(),
      type: 'production',
      conceptId: concept.id,
      content: `Write the French for "${concept.english}":`,
      correctAnswer: concept.french,
      hint: concept.explanation || undefined,
    });
  }

  if (validSet.has('speak_to_answer') && concept.english && concept.french) {
    questions.push({
      id: generateId(),
      type: 'speak_to_answer',
      conceptId: concept.id,
      content: concept.english,
      correctAnswer: concept.french,
      hint: concept.explanation || undefined,
    });
  }

  if (validSet.has('true_false')) {
    questions.push({
      id: generateId(),
      type: 'true_false',
      conceptId: concept.id,
      content: 'Is this correct?',
      correctAnswer: 'true',
      statement: `"${concept.french}" means "${concept.english}"`,
      isTrue: true,
    });
  }

  let foundationValidated = validateQuestionBatch(shuffleArray(questions));

  if (foundationValidated.length < 5) {
    console.log('[FoundationQBank] Foundation questions only', foundationValidated.length, 'for', concept.french, '— template backfill');
    const needed = 5 - foundationValidated.length;
    const templateQ = generateTemplateQuestionsFromConcept(concept, allConcepts, needed);
    foundationValidated.push(...templateQ);
  }

  return foundationValidated;
}

export function initializeFoundationMasteryLesson(
  items: FoundationItem[],
  lessonTitle: string,
): { concepts: ConceptMasteryItem[]; intro: LessonIntro } | null {
  if (items.length === 0) {
    console.log('[FoundationMastery] No items provided');
    return null;
  }

  const concepts: ConceptMasteryItem[] = items.map(item => {
    const ct = item.contentType || inferContentType(
      item.type === 'phrase' || item.type === 'politeness' || item.type === 'filler' ? 'phrasing' :
      item.type === 'verb' ? 'grammar' :
      item.type === 'connector' || item.type === 'pattern' ? 'vocabulary' : 'vocabulary',
      item.pronunciationTip || '',
      item.french,
    );
    return {
      id: `fnd_${item.id}`,
      label: item.french,
      french: item.french,
      english: item.english,
      explanation: item.pronunciationTip || '',
      exampleSentence: '',
      exampleTranslation: '',
      consecutiveCorrect: 0,
      totalAttempts: 0,
      totalCorrect: 0,
      mastered: false,
      relatedGapId: '',
      questionBank: [],
      contentType: ct,
    };
  });

  for (const concept of concepts) {
    concept.questionBank = generateFoundationQuestionBank(concept, concepts);
    console.log('[FoundationMastery] Generated', concept.questionBank.length, 'questions for:', concept.label);
  }

  const intro: LessonIntro = {
    title: lessonTitle,
    description: `Master ${concepts.length} new expressions through interactive practice`,
    conceptPreviews: concepts.slice(0, 8).map(c => ({ french: c.french, english: c.english })),
    conceptCount: concepts.length,
  };

  return { concepts, intro };
}
