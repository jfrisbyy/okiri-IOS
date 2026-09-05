import { GapItem, GapPrompt, GapCategory, ContentType } from '@/types';
import type { EngagingQuestion, EngagingQuestionType, ConceptMasteryItem } from '@/utils/masteryEngine';
import { inferContentType, getValidExerciseTypes } from '@/utils/exerciseTypeRouter';
import { validateQuestion } from '@/utils/questionValidator';
import { getSmartDistractors } from '@/utils/distractorBank';

const TAG = '[ExerciseTemplates]';

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

interface DataProfile {
  hasFrench: boolean;
  hasEnglish: boolean;
  hasExample: boolean;
  hasExampleTranslation: boolean;
  hasExplanation: boolean;
  hasPronunciation: boolean;
  hasConceptData: boolean;
  contentType: ContentType;
  frenchWordCount: number;
  exampleWordCount: number;
}

function assessDataProfile(gap: GapItem): DataProfile {
  const exSentence = gap.exampleSentence || '';
  const exWords = exSentence.split(/\s+/).filter(w => w.length > 0);
  const frWords = (gap.frenchWord || '').split(/\s+/).filter(w => w.length > 0);
  return {
    hasFrench: !!(gap.frenchWord && gap.frenchWord.trim().length > 0),
    hasEnglish: !!(gap.englishTranslation && gap.englishTranslation.trim().length > 0),
    hasExample: exSentence.length >= 10,
    hasExampleTranslation: !!(gap.exampleTranslation && gap.exampleTranslation.trim().length > 0),
    hasExplanation: !!(gap.explanation && gap.explanation.trim().length >= 10),
    hasPronunciation: !!(gap.pronunciation && gap.pronunciation.trim().length > 0),
    hasConceptData: !!(gap.conceptData && gap.conceptData.canonicalExamples && gap.conceptData.canonicalExamples.length > 0),
    contentType: gap.contentType || inferContentType(gap.category, gap.explanation || '', gap.frenchWord),
    frenchWordCount: frWords.length,
    exampleWordCount: exWords.length,
  };
}

// --- Distractor Helper ---

const FRENCH_FALLBACKS = ['le', 'une', 'est', 'avoir', 'faire', 'bien', 'très', 'avec', 'dans', 'pour', 'aussi', 'mais', 'encore', 'toujours', 'jamais'];
const ENGLISH_FALLBACKS = ['the', 'a', 'to be', 'to have', 'good', 'very', 'with', 'for', 'this', 'that', 'also', 'but', 'still', 'always', 'never'];

export function selectDistractors(
  correctAnswer: string,
  candidates: string[],
  count: number,
  preferSimilar: boolean = false,
  context?: { contentType?: string; category?: string; cefrLevel?: string; answerLanguage?: 'french' | 'english' },
): string[] {
  const normalCA = correctAnswer.toLowerCase().trim();
  const seen = new Set<string>([normalCA]);
  const fromGaps: string[] = [];

  for (const c of candidates) {
    const norm = c.toLowerCase().trim();
    if (norm.length === 0 || seen.has(norm)) continue;
    seen.add(norm);
    fromGaps.push(c);
  }

  const gapDistractors = preferSimilar && fromGaps.length > count
    ? [...fromGaps].sort((a, b) => similarityScore(b, correctAnswer) - similarityScore(a, correctAnswer)).slice(0, Math.min(2, count))
    : shuffleArray(fromGaps).slice(0, Math.min(2, count));

  const result = [...gapDistractors];
  for (const r of result) seen.add(r.toLowerCase().trim());

  if (result.length < count) {
    const isLikelyFrench = /[éèêëàâäùûüôöîïç]/.test(correctAnswer) || correctAnswer.length <= 3;
    const lang = context?.answerLanguage || (isLikelyFrench ? 'french' : 'english');
    const bankDistractors = getSmartDistractors({
      correctAnswer,
      answerLanguage: lang,
      count: count - result.length,
      contentType: context?.contentType,
      category: context?.category,
      cefrLevel: context?.cefrLevel,
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

  if (result.length < count) {
    const isLikelyFrench = /[éèêëàâäùûüôöîïç]/.test(correctAnswer) || correctAnswer.length <= 3;
    const fallbacks = isLikelyFrench ? FRENCH_FALLBACKS : ENGLISH_FALLBACKS;
    for (const fb of fallbacks) {
      if (result.length >= count) break;
      const norm = fb.toLowerCase().trim();
      if (!seen.has(norm)) {
        seen.add(norm);
        result.push(fb);
      }
    }
  }

  return result.slice(0, count);
}

function similarityScore(a: string, b: string): number {
  const al = a.toLowerCase().trim();
  const bl = b.toLowerCase().trim();
  let score = 0;
  if (al[0] === bl[0]) score += 2;
  if (Math.abs(al.length - bl.length) <= 3) score += 1;
  if (Math.abs(al.length - bl.length) <= 1) score += 1;
  return score;
}

// --- Builder functions ---

function buildMultipleChoiceFrenchToEnglish(gap: GapItem, otherGaps: GapItem[]): EngagingQuestion | null {
  const candidates = otherGaps
    .filter(g => g.englishTranslation && g.englishTranslation.trim().length > 0)
    .map(g => g.englishTranslation);
  const profile = assessDataProfile(gap);
  const distractors = selectDistractors(gap.englishTranslation, candidates, 3, true, {
    contentType: profile.contentType,
    category: gap.category,
    cefrLevel: gap.cefrLevel,
    answerLanguage: 'english',
  });
  if (distractors.length < 2) return null;

  return {
    id: generateId(),
    type: 'multiple_choice',
    conceptId: '',
    content: `What does "${gap.frenchWord}" mean?`,
    correctAnswer: gap.englishTranslation,
    choices: shuffleArray([gap.englishTranslation, ...distractors]),
    hint: gap.explanation || gap.exampleSentence || undefined,
  };
}

function buildMultipleChoiceEnglishToFrench(gap: GapItem, otherGaps: GapItem[]): EngagingQuestion | null {
  const candidates = otherGaps
    .filter(g => g.frenchWord && g.frenchWord.trim().length > 0)
    .map(g => g.frenchWord);
  const profile = assessDataProfile(gap);
  const distractors = selectDistractors(gap.frenchWord, candidates, 3, true, {
    contentType: profile.contentType,
    category: gap.category,
    cefrLevel: gap.cefrLevel,
    answerLanguage: 'french',
  });
  if (distractors.length < 2) return null;

  const hintText = gap.exampleSentence ? gap.exampleSentence.split(/\s+/).slice(0, 3).join(' ') + '...' : undefined;

  return {
    id: generateId(),
    type: 'multiple_choice',
    conceptId: '',
    content: `How do you say "${gap.englishTranslation}" in French?`,
    correctAnswer: gap.frenchWord,
    choices: shuffleArray([gap.frenchWord, ...distractors]),
    hint: hintText,
  };
}

function buildMultipleChoiceAboutRule(gap: GapItem, otherGaps: GapItem[]): EngagingQuestion | null {
  const explanation = gap.explanation || '';
  const firstSentence = explanation.split(/[.!?]/).filter(s => s.trim().length > 5)[0]?.trim();
  if (!firstSentence || firstSentence.length < 10) return null;

  const otherExplanations = otherGaps
    .filter(g => g.explanation && g.explanation.trim().length >= 10 && g.explanation !== explanation)
    .map(g => {
      const s = (g.explanation || '').split(/[.!?]/).filter(s => s.trim().length > 5)[0]?.trim();
      return s || g.explanation || '';
    })
    .filter(s => s.length > 5);

  const distractors = selectDistractors(firstSentence, otherExplanations, 3, false);
  if (distractors.length < 2) return null;

  return {
    id: generateId(),
    type: 'multiple_choice',
    conceptId: '',
    content: `Which statement about "${gap.frenchWord}" is correct?`,
    correctAnswer: firstSentence,
    choices: shuffleArray([firstSentence, ...distractors]),
    hint: `Think about how "${gap.frenchWord}" is used.`,
  };
}

function findWordInSentence(sentence: string, word: string): { found: boolean; matchedForm: string; blanked: string } {
  const lower = sentence.toLowerCase();
  const wordLower = word.toLowerCase();

  const idx = lower.indexOf(wordLower);
  if (idx !== -1) {
    const matchedForm = sentence.substring(idx, idx + word.length);
    const blanked = sentence.substring(0, idx) + '___' + sentence.substring(idx + word.length);
    return { found: true, matchedForm, blanked };
  }

  if (word.length >= 4) {
    const stem = wordLower.substring(0, Math.ceil(wordLower.length * 0.6));
    const words = sentence.split(/\s+/);
    for (let i = 0; i < words.length; i++) {
      const w = words[i].replace(/[.,!?;:«»'"]/g, '');
      if (w.toLowerCase().startsWith(stem) && w.length >= stem.length) {
        const blankedWords = [...words];
        blankedWords[i] = '___';
        return { found: true, matchedForm: w, blanked: blankedWords.join(' ') };
      }
    }
  }

  return { found: false, matchedForm: '', blanked: '' };
}

function buildFillBlank(gap: GapItem): EngagingQuestion | null {
  const sentence = gap.exampleSentence || '';
  if (sentence.length < 10) return null;

  const result = findWordInSentence(sentence, gap.frenchWord);
  if (!result.found) return null;

  return {
    id: generateId(),
    type: 'fill_blank',
    conceptId: '',
    content: `Complete the sentence:\n\n"${result.blanked}"`,
    correctAnswer: result.matchedForm,
    hint: gap.englishTranslation || 'Fill in the missing French word',
  };
}

function buildTrueFalseVocabulary(gap: GapItem, otherGaps: GapItem[]): EngagingQuestion | null {
  const isTrue = Math.random() > 0.5;

  if (isTrue) {
    return {
      id: generateId(),
      type: 'true_false',
      conceptId: '',
      content: 'Is this translation correct?',
      correctAnswer: 'true',
      statement: `"${gap.frenchWord}" means "${gap.englishTranslation}"`,
      isTrue: true,
      explanation: gap.explanation || undefined,
    };
  }

  const wrongGap = otherGaps.find(
    g => g.englishTranslation &&
    g.englishTranslation.toLowerCase().trim() !== gap.englishTranslation.toLowerCase().trim() &&
    g.frenchWord.toLowerCase().trim() !== gap.frenchWord.toLowerCase().trim()
  );
  if (!wrongGap) return null;

  return {
    id: generateId(),
    type: 'true_false',
    conceptId: '',
    content: 'Is this translation correct?',
    correctAnswer: 'false',
    statement: `"${gap.frenchWord}" means "${wrongGap.englishTranslation}"`,
    isTrue: false,
    explanation: `"${gap.frenchWord}" actually means "${gap.englishTranslation}"`,
  };
}

function buildTrueFalseGrammar(gap: GapItem): EngagingQuestion | null {
  const explanation = gap.explanation || '';
  if (explanation.length < 15) return null;

  return {
    id: generateId(),
    type: 'true_false',
    conceptId: '',
    content: 'Is this rule correct?',
    correctAnswer: 'true',
    statement: explanation,
    isTrue: true,
    explanation: explanation,
  };
}

function buildTranslationSentence(gap: GapItem): EngagingQuestion | null {
  return {
    id: generateId(),
    type: 'translation',
    conceptId: '',
    content: `Translate to English:\n\n"${gap.exampleSentence}"`,
    correctAnswer: gap.exampleTranslation || gap.englishTranslation,
    hint: `The key word "${gap.frenchWord}" means "${gap.englishTranslation}"`,
  };
}

function buildTranslationWord(gap: GapItem): EngagingQuestion | null {
  return {
    id: generateId(),
    type: 'translation',
    conceptId: '',
    content: `Translate to French:\n\n"${gap.englishTranslation}"`,
    correctAnswer: gap.frenchWord,
    hint: gap.exampleSentence || undefined,
  };
}

function buildWordOrder(gap: GapItem): EngagingQuestion | null {
  const sentence = gap.exampleSentence || '';
  const clean = sentence.replace(/[.,!?;:«»'"]/g, '').trim();
  const words = clean.split(/\s+/).filter(w => w.length > 0);
  if (words.length < 3) return null;

  let scrambled = shuffleArray([...words]);
  let attempts = 0;
  while (scrambled.join(' ') === words.join(' ') && attempts < 5) {
    scrambled = shuffleArray([...words]);
    attempts++;
  }
  if (scrambled.join(' ') === words.join(' ')) return null;

  return {
    id: generateId(),
    type: 'word_order',
    conceptId: '',
    content: gap.exampleTranslation
      ? `"${gap.exampleTranslation}"`
      : 'Arrange into a correct French sentence:',
    correctAnswer: words.join(' '),
    scrambledWords: scrambled,
    hint: gap.exampleTranslation || gap.englishTranslation,
  };
}

function buildSpotTheError(gap: GapItem): EngagingQuestion | null {
  const sentence = gap.exampleSentence || '';
  if (sentence.length < 10) return null;

  const sentenceWords = sentence.split(/\s+/);
  if (sentenceWords.length < 3) return null;

  const articles: Record<string, string[]> = {
    'le': ['la', 'les'], 'la': ['le', 'les'], 'les': ['le', 'la'],
    'un': ['une', 'des'], 'une': ['un', 'des'], 'des': ['un', 'une'],
    'du': ['de', 'au'], 'de': ['du', 'au'], 'au': ['du', 'de'],
    'aux': ['au', 'du'],
  };

  for (let i = 0; i < sentenceWords.length; i++) {
    const w = sentenceWords[i].toLowerCase();
    if (articles[w]) {
      const replacement = articles[w][0];
      const errorWords = [...sentenceWords];
      errorWords[i] = replacement;
      const errorSentence = errorWords.join(' ');
      if (errorSentence !== sentence) {
        return {
          id: generateId(),
          type: 'spot_the_error',
          conceptId: '',
          content: 'Find and fix the error:',
          correctAnswer: sentence,
          errorSentence,
          correctedSentence: sentence,
          hint: 'There is one error in this sentence. Find and fix it.',
        };
      }
    }
  }

  const frenchLower = gap.frenchWord.toLowerCase();
  for (let i = 0; i < sentenceWords.length; i++) {
    const wClean = sentenceWords[i].replace(/[.,!?;:]/g, '').toLowerCase();
    if (wClean === frenchLower && wClean.length >= 3) {
      const chars = sentenceWords[i].split('');
      if (chars.length >= 3) {
        const swapIdx = Math.floor(Math.random() * (chars.length - 1));
        [chars[swapIdx], chars[swapIdx + 1]] = [chars[swapIdx + 1], chars[swapIdx]];
        const errorWords = [...sentenceWords];
        errorWords[i] = chars.join('');
        if (errorWords[i] !== sentenceWords[i]) {
          return {
            id: generateId(),
            type: 'spot_the_error',
            conceptId: '',
            content: 'Find and fix the error:',
            correctAnswer: sentence,
            errorSentence: errorWords.join(' '),
            correctedSentence: sentence,
            hint: 'There is one error in this sentence. Find and fix it.',
          };
        }
      }
    }
  }

  return null;
}

function buildListenType(gap: GapItem): EngagingQuestion | null {
  return {
    id: generateId(),
    type: 'listen_type',
    conceptId: '',
    content: 'Listen and type what you hear:',
    correctAnswer: gap.frenchWord,
    audioText: gap.frenchWord,
    hint: 'Type what you hear in French',
  };
}

function buildProduction(gap: GapItem): EngagingQuestion | null {
  const firstLetter = gap.frenchWord.charAt(0);
  return {
    id: generateId(),
    type: 'production',
    conceptId: '',
    content: `How do you say "${gap.englishTranslation}" in French?`,
    correctAnswer: gap.frenchWord,
    hint: `${firstLetter}...`,
  };
}

function buildSentenceBuild(gap: GapItem): EngagingQuestion | null {
  const sentence = gap.exampleSentence || '';
  const clean = sentence.replace(/[.,!?;:«»'"]/g, '').trim();
  const words = clean.split(/\s+/).filter(w => w.length > 0);
  if (words.length < 4) return null;

  const distractorPool = ['aussi', 'très', 'mais', 'encore', 'toujours', 'jamais', 'peut-être', 'bien', 'souvent', 'déjà'];
  const distractors = distractorPool
    .filter(w => !words.map(x => x.toLowerCase()).includes(w.toLowerCase()))
    .slice(0, Math.min(3, Math.ceil(words.length * 0.4)));

  return {
    id: generateId(),
    type: 'sentence_build',
    conceptId: '',
    content: gap.exampleTranslation
      ? `Build: "${gap.exampleTranslation}"`
      : `Build a sentence using "${gap.frenchWord}":`,
    correctAnswer: words.join(' '),
    wordBank: shuffleArray([...words, ...distractors]),
    hint: gap.exampleTranslation || gap.englishTranslation,
  };
}

function buildMatchPairs(gap: GapItem, otherGaps: GapItem[]): EngagingQuestion | null {
  const eligible = [gap, ...otherGaps].filter(
    g => g.frenchWord && g.englishTranslation &&
    g.frenchWord.trim().length > 0 && g.englishTranslation.trim().length > 0
  );

  const seen = new Set<string>();
  const unique: GapItem[] = [];
  for (const g of eligible) {
    const key = g.frenchWord.toLowerCase().trim() + '|' + g.englishTranslation.toLowerCase().trim();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(g);
    }
  }

  if (unique.length < 3) return null;

  const selected = shuffleArray(unique).slice(0, Math.min(4, unique.length));
  const pairs = selected.map(g => ({ french: g.frenchWord, english: g.englishTranslation }));

  return {
    id: generateId(),
    type: 'match_pairs',
    conceptId: '',
    content: 'Match the French words with their meanings:',
    correctAnswer: pairs.map(p => `${p.french}=${p.english}`).join(','),
    pairs: shuffleArray(pairs),
  };
}

function buildSoundToLetter(gap: GapItem, otherGaps: GapItem[]): EngagingQuestion | null {
  if (gap.frenchWord.trim().length > 3) return null;

  const candidates = otherGaps
    .filter(g => g.frenchWord.trim().length <= 3 && g.frenchWord.trim().length > 0)
    .map(g => g.frenchWord.trim());
  const profile = assessDataProfile(gap);
  const distractors = selectDistractors(gap.frenchWord, candidates, 3, false, {
    contentType: profile.contentType,
    category: gap.category,
    cefrLevel: gap.cefrLevel,
    answerLanguage: 'french',
  });
  if (distractors.length < 2) return null;

  return {
    id: generateId(),
    type: 'sound_to_letter',
    conceptId: '',
    content: 'Listen and pick the letter',
    correctAnswer: gap.frenchWord,
    choices: shuffleArray([gap.frenchWord, ...distractors]),
    audioText: gap.pronunciation || gap.frenchWord,
  };
}

function buildLetterToSound(gap: GapItem, otherGaps: GapItem[]): EngagingQuestion | null {
  if (gap.frenchWord.trim().length > 3) return null;
  const pronun = gap.pronunciation || gap.frenchWord;

  const candidates = otherGaps
    .filter(g => g.frenchWord.trim().length <= 3)
    .map(g => g.pronunciation || g.frenchWord);
  const profile = assessDataProfile(gap);
  const distractors = selectDistractors(pronun, candidates, 3, false, {
    contentType: profile.contentType,
    category: gap.category,
    cefrLevel: gap.cefrLevel,
    answerLanguage: 'french',
  });
  if (distractors.length < 2) return null;

  return {
    id: generateId(),
    type: 'letter_to_sound',
    conceptId: '',
    content: gap.frenchWord,
    correctAnswer: pronun,
    choices: shuffleArray([pronun, ...distractors]),
  };
}

// --- Type feasibility and ordering ---

type ExerciseCategory = 'recognition' | 'guided' | 'production';

const TYPE_CATEGORY: Record<EngagingQuestionType, ExerciseCategory> = {
  multiple_choice: 'recognition',
  true_false: 'recognition',
  match_pairs: 'recognition',
  sound_to_letter: 'recognition',
  letter_to_sound: 'recognition',
  alphabet_sequence: 'recognition',
  fill_blank: 'guided',
  word_order: 'guided',
  sentence_build: 'guided',
  spot_the_error: 'guided',
  listen_type: 'production',
  translation: 'production',
  production: 'production',
  speak_to_answer: 'production',
};

interface FeasibleType {
  type: EngagingQuestionType;
  category: ExerciseCategory;
  builder: (gap: GapItem, otherGaps: GapItem[]) => EngagingQuestion | null;
  label: string;
}

function determineFeasibleTypes(profile: DataProfile, gap: GapItem, otherGaps: GapItem[]): FeasibleType[] {
  const validTypes = new Set(getValidExerciseTypes(profile.contentType));
  const feasible: FeasibleType[] = [];

  const gapsWithEnglish = otherGaps.filter(g => g.englishTranslation && g.englishTranslation.trim().length > 0);
  const gapsWithFrench = otherGaps.filter(g => g.frenchWord && g.frenchWord.trim().length > 0);
  const gapsWithBoth = otherGaps.filter(g => g.frenchWord && g.englishTranslation);

  if (validTypes.has('multiple_choice') && profile.hasFrench && profile.hasEnglish && gapsWithEnglish.length >= 2) {
    feasible.push({ type: 'multiple_choice', category: 'recognition', builder: (g, o) => buildMultipleChoiceFrenchToEnglish(g, o), label: 'mc_fr_en' });
  }
  if (validTypes.has('multiple_choice') && profile.hasFrench && profile.hasEnglish && gapsWithFrench.length >= 2) {
    feasible.push({ type: 'multiple_choice', category: 'recognition', builder: (g, o) => buildMultipleChoiceEnglishToFrench(g, o), label: 'mc_en_fr' });
  }
  if (validTypes.has('multiple_choice') && profile.hasExplanation) {
    feasible.push({ type: 'multiple_choice', category: 'recognition', builder: (g, o) => buildMultipleChoiceAboutRule(g, o), label: 'mc_rule' });
  }
  if (validTypes.has('true_false') && profile.hasFrench && profile.hasEnglish) {
    feasible.push({ type: 'true_false', category: 'recognition', builder: (g, o) => buildTrueFalseVocabulary(g, o), label: 'tf_vocab' });
  }
  if (validTypes.has('true_false') && profile.hasExplanation) {
    feasible.push({ type: 'true_false', category: 'recognition', builder: (g, _o) => buildTrueFalseGrammar(g), label: 'tf_grammar' });
  }
  if (validTypes.has('match_pairs') && gapsWithBoth.length >= 2) {
    feasible.push({ type: 'match_pairs', category: 'recognition', builder: (g, o) => buildMatchPairs(g, o), label: 'match' });
  }
  if (validTypes.has('sound_to_letter') && profile.hasFrench && profile.frenchWordCount === 1 && gap.frenchWord.trim().length <= 3) {
    feasible.push({ type: 'sound_to_letter', category: 'recognition', builder: (g, o) => buildSoundToLetter(g, o), label: 's2l' });
  }
  if (validTypes.has('letter_to_sound') && profile.hasFrench && profile.frenchWordCount === 1 && gap.frenchWord.trim().length <= 3) {
    feasible.push({ type: 'letter_to_sound', category: 'recognition', builder: (g, o) => buildLetterToSound(g, o), label: 'l2s' });
  }

  if (validTypes.has('fill_blank') && profile.hasExample && profile.hasFrench) {
    feasible.push({ type: 'fill_blank', category: 'guided', builder: (g, _o) => buildFillBlank(g), label: 'fill' });
  }
  if (validTypes.has('word_order') && profile.hasExample && profile.exampleWordCount >= 3) {
    feasible.push({ type: 'word_order', category: 'guided', builder: (g, _o) => buildWordOrder(g), label: 'wo' });
  }
  if (validTypes.has('sentence_build') && profile.hasExample && profile.exampleWordCount >= 4) {
    feasible.push({ type: 'sentence_build', category: 'guided', builder: (g, _o) => buildSentenceBuild(g), label: 'sb' });
  }
  if (validTypes.has('spot_the_error') && profile.hasExample && profile.hasFrench && profile.exampleWordCount >= 3) {
    feasible.push({ type: 'spot_the_error', category: 'guided', builder: (g, _o) => buildSpotTheError(g), label: 'ste' });
  }

  if ((validTypes.has('translation') || validTypes.has('listen_and_type')) && profile.hasExample && profile.hasExampleTranslation) {
    feasible.push({ type: 'translation', category: 'production', builder: (g, _o) => buildTranslationSentence(g), label: 'trans_sent' });
  }
  if (validTypes.has('translation') && profile.hasFrench && profile.hasEnglish) {
    feasible.push({ type: 'translation', category: 'production', builder: (g, _o) => buildTranslationWord(g), label: 'trans_word' });
  }
  if ((validTypes.has('listen_and_type') || validTypes.has('multiple_choice')) && profile.hasFrench) {
    feasible.push({ type: 'listen_type', category: 'production', builder: (g, _o) => buildListenType(g), label: 'listen' });
  }
  if (validTypes.has('production') && profile.hasEnglish && profile.hasFrench) {
    feasible.push({ type: 'production', category: 'production', builder: (g, _o) => buildProduction(g), label: 'prod' });
  }

  return feasible;
}

function getCategoryDistribution(gap: GapItem): Record<ExerciseCategory, number> {
  const reviewCount = gap.reviewCount || 0;
  const consecutiveCorrect = gap.consecutiveCorrect || 0;

  if (consecutiveCorrect === 0 && reviewCount > 0) {
    return { recognition: 0.6, guided: 0.3, production: 0.1 };
  }
  if (reviewCount <= 1) {
    return { recognition: 0.6, guided: 0.3, production: 0.1 };
  }
  if (reviewCount <= 5) {
    return { recognition: 0.3, guided: 0.4, production: 0.3 };
  }
  return { recognition: 0.1, guided: 0.3, production: 0.6 };
}

export function generateTemplateQuestions(
  gap: GapItem,
  otherGaps: GapItem[],
  maxQuestions: number,
): EngagingQuestion[] {
  const profile = assessDataProfile(gap);
  const feasible = determineFeasibleTypes(profile, gap, otherGaps);

  if (feasible.length === 0) {
    console.warn(`${TAG} No feasible types for gap "${gap.frenchWord}" (contentType: ${profile.contentType})`);
    return [];
  }

  const distribution = getCategoryDistribution(gap);
  const recTarget = Math.max(1, Math.round(maxQuestions * distribution.recognition));
  const guidedTarget = Math.max(1, Math.round(maxQuestions * distribution.guided));
  const prodTarget = Math.max(0, maxQuestions - recTarget - guidedTarget);

  const recTypes = feasible.filter(f => f.category === 'recognition');
  const guidedTypes = feasible.filter(f => f.category === 'guided');
  const prodTypes = feasible.filter(f => f.category === 'production');

  const questions: EngagingQuestion[] = [];
  const usedLabels = new Set<string>();

  const tryBuild = (types: FeasibleType[], target: number) => {
    let built = 0;
    for (const ft of shuffleArray(types)) {
      if (built >= target) break;
      if (usedLabels.has(ft.label)) continue;
      const q = ft.builder(gap, otherGaps);
      if (q) {
        const validated = validateQuestion(q);
        if (validated) {
          questions.push(validated);
          usedLabels.add(ft.label);
          built++;
        }
      }
    }

    if (built < target) {
      for (const ft of shuffleArray(types)) {
        if (built >= target) break;
        if (!usedLabels.has(ft.label)) continue;
        const q = ft.builder(gap, otherGaps);
        if (q) {
          q.id = generateId();
          const validated = validateQuestion(q);
          if (validated) {
            questions.push(validated);
            built++;
          }
        }
      }
    }
    return built;
  };

  tryBuild(recTypes, recTarget);
  tryBuild(guidedTypes, guidedTarget);
  tryBuild(prodTypes, prodTarget);

  if (questions.length < maxQuestions) {
    const allTypes = shuffleArray(feasible);
    for (const ft of allTypes) {
      if (questions.length >= maxQuestions) break;
      const q = ft.builder(gap, otherGaps);
      if (q) {
        q.id = generateId();
        const validated = validateQuestion(q);
        if (validated) {
          questions.push(validated);
        }
      }
    }
  }

  const recQ = questions.filter(q => TYPE_CATEGORY[q.type] === 'recognition');
  const guidQ = questions.filter(q => TYPE_CATEGORY[q.type] === 'guided');
  const prodQ = questions.filter(q => TYPE_CATEGORY[q.type] === 'production');
  const ordered = [...shuffleArray(recQ), ...shuffleArray(guidQ), ...shuffleArray(prodQ)];

  console.log(`${TAG} Generated ${ordered.length}/${maxQuestions} for "${gap.frenchWord}" (rec:${recQ.length} guided:${guidQ.length} prod:${prodQ.length})`);

  return ordered.slice(0, maxQuestions);
}

export function generateTemplateQuestionsFromConcept(
  concept: ConceptMasteryItem,
  allConcepts: ConceptMasteryItem[],
  maxQuestions: number,
): EngagingQuestion[] {
  const pseudoGap: GapItem = {
    id: concept.relatedGapId || concept.id,
    frenchWord: concept.french,
    englishTranslation: concept.english,
    explanation: concept.explanation,
    exampleSentence: concept.exampleSentence,
    exampleTranslation: concept.exampleTranslation,
    pronunciation: undefined,
    sourceType: 'foundation',
    gapType: 'vocab',
    category: 'vocabulary',
    difficulty: 'okay',
    reviewCount: concept.totalAttempts,
    consecutiveCorrect: concept.consecutiveCorrect,
    nextReviewAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    easeFactor: 2.5,
    currentInterval: 1,
    contentType: concept.contentType,
  };

  const otherGaps: GapItem[] = allConcepts
    .filter(c => c.id !== concept.id)
    .map(c => ({
      id: c.relatedGapId || c.id,
      frenchWord: c.french,
      englishTranslation: c.english,
      explanation: c.explanation,
      exampleSentence: c.exampleSentence,
      exampleTranslation: c.exampleTranslation,
      sourceType: 'foundation' as const,
      gapType: 'vocab' as const,
      category: 'vocabulary' as const,
      difficulty: 'okay' as const,
      reviewCount: c.totalAttempts,
      consecutiveCorrect: c.consecutiveCorrect,
      nextReviewAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      easeFactor: 2.5,
      currentInterval: 1,
      contentType: c.contentType,
    }));

  const questions = generateTemplateQuestions(pseudoGap, otherGaps, maxQuestions);
  return questions.map(q => ({ ...q, conceptId: concept.id, relatedGapId: concept.relatedGapId }));
}

export function templateQuestionsToGapPrompts(
  questions: EngagingQuestion[],
  gapId: string,
  category: GapCategory,
): GapPrompt[] {
  return questions.map(q => {
    const prompt: GapPrompt = {
      id: q.id,
      gapId,
      type: q.type as any,
      question: q.content,
      correctAnswer: q.correctAnswer,
      choices: q.choices,
      hint: q.hint,
      category,
    };
    return prompt;
  });
}
