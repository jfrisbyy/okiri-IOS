import type { EngagingQuestion, EngagingQuestionType } from '@/utils/masteryEngine';
import type { GapPrompt, GapPromptType } from '@/types';

const TAG = '[QuestionValidator]';

const KNOWN_ENGAGING_TYPES: EngagingQuestionType[] = [
  'multiple_choice', 'fill_blank', 'word_order', 'match_pairs',
  'listen_type', 'sentence_build', 'translation', 'production',
  'spot_the_error', 'true_false', 'speak_to_answer',
  'sound_to_letter', 'letter_to_sound', 'alphabet_sequence',
];

const KNOWN_GAP_TYPES: GapPromptType[] = [
  'multiple_choice', 'fill_blank', 'correction', 'production',
  'translation', 'tap_what_you_hear', 'sentence_build',
  'spot_the_error', 'true_false', 'match_pairs', 'word_order',
  'listen_and_type', 'speak_to_answer', 'sound_to_letter',
  'letter_to_sound', 'alphabet_sequence',
];

function generateFallbackId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function isNonEmptyString(val: unknown, minLength: number = 1): val is string {
  return typeof val === 'string' && val.trim().length >= minLength;
}

function isNonEmptyArray(val: unknown, minLength: number = 1): val is unknown[] {
  return Array.isArray(val) && val.length >= minLength;
}

function truncate(s: string, len: number = 50): string {
  if (s.length <= len) return s;
  return s.substring(0, len) + '...';
}

function reject(type: string, reason: string, content?: string): null {
  const snippet = content ? ` content="${truncate(content)}"` : '';
  console.warn(`${TAG} REJECTED type="${type}" reason="${reason}"${snippet}`);
  return null;
}

function caseInsensitiveMatch(a: string, b: string): boolean {
  return a.toLowerCase().trim() === b.toLowerCase().trim();
}

function deduplicateStrings(arr: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of arr) {
    const key = item.toLowerCase().trim();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  return result;
}

function validateMultipleChoice(q: any): boolean {
  const content = q.question || q.content || '';
  if (!isNonEmptyString(content, 5)) {
    reject('multiple_choice', 'missing or too-short question/content', content);
    return false;
  }

  if (!isNonEmptyArray(q.choices, 2) || q.choices.length > 8) {
    reject('multiple_choice', `choices invalid (length=${q.choices?.length})`, content);
    return false;
  }

  for (const c of q.choices) {
    if (!isNonEmptyString(c)) {
      reject('multiple_choice', 'empty choice in array', content);
      return false;
    }
  }

  if (!isNonEmptyString(q.correctAnswer)) {
    reject('multiple_choice', 'missing correctAnswer', content);
    return false;
  }

  q.choices = deduplicateStrings(q.choices);
  if (q.choices.length < 2) {
    reject('multiple_choice', 'less than 2 unique choices after dedup', content);
    return false;
  }

  const ca = q.correctAnswer.trim();
  let found = q.choices.some((c: string) => caseInsensitiveMatch(c, ca));

  if (!found) {
    const partial = q.choices.find((c: string) =>
      c.toLowerCase().trim().includes(ca.toLowerCase()) ||
      ca.toLowerCase().includes(c.toLowerCase().trim())
    );
    if (partial) {
      q.correctAnswer = partial;
      found = true;
    }
  }

  if (!found && isNonEmptyString(q.answer) && q.choices.some((c: string) => caseInsensitiveMatch(c, q.answer))) {
    q.correctAnswer = q.answer;
    found = true;
  }

  if (!found) {
    reject('multiple_choice', 'correctAnswer not in choices', content);
    return false;
  }

  q.correctAnswer = q.correctAnswer.trim();
  return true;
}

function validateFillBlank(q: any): boolean {
  const content = q.content || '';
  if (!isNonEmptyString(content, 10)) {
    reject('fill_blank', 'content too short or missing', content);
    return false;
  }

  const blankIndicators = ['___', '…', 'blank', '__', ' _ '];
  const hasBlank = blankIndicators.some(b => content.toLowerCase().includes(b));
  if (!hasBlank) {
    reject('fill_blank', 'no blank indicator in content', content);
    return false;
  }

  if (!isNonEmptyString(q.correctAnswer)) {
    reject('fill_blank', 'missing correctAnswer', content);
    return false;
  }

  q.correctAnswer = q.correctAnswer.trim();
  return true;
}

function validateTrueFalse(q: any): boolean {
  const statement = q.statement || q.content || '';
  if (!isNonEmptyString(statement, 10)) {
    reject('true_false', 'statement/content too short', statement);
    return false;
  }

  if (!isNonEmptyString(q.correctAnswer)) {
    reject('true_false', 'missing correctAnswer', statement);
    return false;
  }

  const normalized = q.correctAnswer.toLowerCase().trim();
  if (normalized !== 'true' && normalized !== 'false') {
    reject('true_false', `correctAnswer not true/false: "${q.correctAnswer}"`, statement);
    return false;
  }

  q.correctAnswer = normalized;
  if (q.isTrue === undefined) {
    q.isTrue = normalized === 'true';
  }
  if (!q.statement && q.content) {
    q.statement = q.content;
  }

  return true;
}

function validateWordOrder(q: any): boolean {
  const words = q.words || q.scrambledWords;
  if (!isNonEmptyArray(words, 3)) {
    reject('word_order', 'words/scrambledWords missing or < 3', q.content || '');
    return false;
  }

  for (const w of words) {
    if (!isNonEmptyString(w)) {
      reject('word_order', 'empty word in array', q.content || '');
      return false;
    }
  }

  if (!isNonEmptyString(q.correctAnswer)) {
    reject('word_order', 'missing correctAnswer', q.content || '');
    return false;
  }

  q.correctAnswer = q.correctAnswer.trim();
  if (!q.scrambledWords && q.words) {
    q.scrambledWords = q.words;
  }
  return true;
}

function validateSentenceBuild(q: any): boolean {
  const words = q.words || q.wordBank;
  if (!isNonEmptyArray(words, 3)) {
    reject('sentence_build', 'words/wordBank missing or < 3', q.content || '');
    return false;
  }

  for (const w of words) {
    if (!isNonEmptyString(w)) {
      reject('sentence_build', 'empty word in array', q.content || '');
      return false;
    }
  }

  if (!isNonEmptyString(q.correctAnswer)) {
    reject('sentence_build', 'missing correctAnswer', q.content || '');
    return false;
  }

  q.correctAnswer = q.correctAnswer.trim();
  if (!q.wordBank && q.words) {
    q.wordBank = q.words;
  }
  return true;
}

function validateTranslation(q: any): boolean {
  const content = q.content || q.sourceText || '';
  if (!isNonEmptyString(content)) {
    reject('translation', 'missing content/sourceText', '');
    return false;
  }

  if (!isNonEmptyString(q.correctAnswer)) {
    reject('translation', 'missing correctAnswer', content);
    return false;
  }

  q.correctAnswer = q.correctAnswer.trim();
  if (q.acceptableAnswers && !Array.isArray(q.acceptableAnswers)) {
    q.acceptableAnswers = undefined;
  }
  return true;
}

function validateProduction(q: any): boolean {
  const content = q.content || q.question || '';
  if (!isNonEmptyString(content)) {
    reject('production', 'missing content/question', '');
    return false;
  }

  if (!isNonEmptyString(q.correctAnswer)) {
    reject('production', 'missing correctAnswer', content);
    return false;
  }

  q.correctAnswer = q.correctAnswer.trim();
  return true;
}

function validateSpotTheError(q: any): boolean {
  const content = q.content || q.errorSentence || '';
  if (!isNonEmptyString(content, 10)) {
    reject('spot_the_error', 'content/errorSentence too short', content);
    return false;
  }

  if (!isNonEmptyString(q.correctAnswer)) {
    reject('spot_the_error', 'missing correctAnswer', content);
    return false;
  }

  q.correctAnswer = q.correctAnswer.trim();
  if (!q.errorSentence && q.content) {
    q.errorSentence = q.content;
  }
  if (!q.correctedSentence) {
    q.correctedSentence = q.correctAnswer;
  }
  return true;
}

function validateMatchPairs(q: any): boolean {
  if (!isNonEmptyArray(q.pairs, 2)) {
    reject('match_pairs', `pairs missing or < 2 (len=${q.pairs?.length})`, q.content || '');
    return false;
  }

  for (let i = 0; i < q.pairs.length; i++) {
    const pair = q.pairs[i];
    if (!pair || typeof pair !== 'object') {
      reject('match_pairs', `pair[${i}] is not an object`, q.content || '');
      return false;
    }
    const left = pair.french || pair.left || pair.source || '';
    const right = pair.english || pair.right || pair.target || '';
    if (!isNonEmptyString(left) || !isNonEmptyString(right)) {
      reject('match_pairs', `pair[${i}] has empty fields`, q.content || '');
      return false;
    }
    pair.french = left;
    pair.english = right;
    if (!pair.left) pair.left = left;
    if (!pair.right) pair.right = right;
  }

  return true;
}

function validateListenType(q: any): boolean {
  const audioText = q.audioText || q.content || '';
  if (!isNonEmptyString(audioText)) {
    reject('listen_type', 'missing audioText/content', '');
    return false;
  }

  if (!isNonEmptyString(q.correctAnswer)) {
    reject('listen_type', 'missing correctAnswer', audioText);
    return false;
  }

  q.correctAnswer = q.correctAnswer.trim();
  if (!q.audioText) {
    q.audioText = q.content || q.correctAnswer;
  }
  return true;
}

function validateSoundToLetter(q: any): boolean {
  if (!isNonEmptyString(q.audioText)) {
    reject('sound_to_letter', 'missing audioText', q.content || '');
    return false;
  }

  if (!isNonEmptyArray(q.choices, 2)) {
    reject('sound_to_letter', 'choices missing or < 2', q.audioText);
    return false;
  }

  if (!isNonEmptyString(q.correctAnswer)) {
    reject('sound_to_letter', 'missing correctAnswer', q.audioText);
    return false;
  }

  const found = q.choices.some((c: string) => caseInsensitiveMatch(c, q.correctAnswer));
  if (!found) {
    reject('sound_to_letter', 'correctAnswer not in choices', q.audioText);
    return false;
  }

  q.correctAnswer = q.correctAnswer.trim();
  return true;
}

function validateLetterToSound(q: any): boolean {
  if (!isNonEmptyString(q.content)) {
    reject('letter_to_sound', 'missing content (letter)', '');
    return false;
  }

  if (!isNonEmptyArray(q.choices, 2)) {
    reject('letter_to_sound', 'choices missing or < 2', q.content);
    return false;
  }

  if (!isNonEmptyString(q.correctAnswer)) {
    reject('letter_to_sound', 'missing correctAnswer', q.content);
    return false;
  }

  const found = q.choices.some((c: string) => caseInsensitiveMatch(c, q.correctAnswer));
  if (!found) {
    reject('letter_to_sound', 'correctAnswer not in choices', q.content);
    return false;
  }

  q.correctAnswer = q.correctAnswer.trim();
  return true;
}

function validateAlphabetSequence(q: any): boolean {
  if (!isNonEmptyArray(q.sequence, 3)) {
    reject('alphabet_sequence', 'sequence missing or < 3', q.content || '');
    return false;
  }

  if (!isNonEmptyString(q.correctAnswer)) {
    reject('alphabet_sequence', 'missing correctAnswer', q.content || '');
    return false;
  }

  if (typeof q.blankIndex !== 'number') {
    reject('alphabet_sequence', 'missing blankIndex', q.content || '');
    return false;
  }

  q.correctAnswer = q.correctAnswer.trim();
  return true;
}

function validateSpeakToAnswer(q: any): boolean {
  const content = q.content || q.question || '';
  if (!isNonEmptyString(content)) {
    reject('speak_to_answer', 'missing content/question', '');
    return false;
  }

  if (!isNonEmptyString(q.correctAnswer)) {
    reject('speak_to_answer', 'missing correctAnswer', content);
    return false;
  }

  q.correctAnswer = q.correctAnswer.trim();
  return true;
}

export function validateQuestion(question: any): EngagingQuestion | null {
  if (!question || typeof question !== 'object') {
    console.warn(`${TAG} REJECTED: question is null or not an object`);
    return null;
  }

  const type = question.type;
  if (typeof type !== 'string' || !KNOWN_ENGAGING_TYPES.includes(type as EngagingQuestionType)) {
    reject(String(type || 'undefined'), 'unknown or missing type', question.content || '');
    return null;
  }

  if (!question.id || typeof question.id !== 'string') {
    question.id = generateFallbackId();
  }

  const hasContent = isNonEmptyString(question.content) ||
    isNonEmptyString(question.question) ||
    isNonEmptyString(question.statement) ||
    isNonEmptyString(question.audioText) ||
    isNonEmptyString(question.errorSentence);

  if (!hasContent) {
    reject(type, 'no text content at all', '');
    return null;
  }

  let valid = false;
  switch (type) {
    case 'multiple_choice': valid = validateMultipleChoice(question); break;
    case 'fill_blank': valid = validateFillBlank(question); break;
    case 'true_false': valid = validateTrueFalse(question); break;
    case 'word_order': valid = validateWordOrder(question); break;
    case 'sentence_build': valid = validateSentenceBuild(question); break;
    case 'translation': valid = validateTranslation(question); break;
    case 'production': valid = validateProduction(question); break;
    case 'spot_the_error': valid = validateSpotTheError(question); break;
    case 'match_pairs': valid = validateMatchPairs(question); break;
    case 'listen_type': valid = validateListenType(question); break;
    case 'sound_to_letter': valid = validateSoundToLetter(question); break;
    case 'letter_to_sound': valid = validateLetterToSound(question); break;
    case 'alphabet_sequence': valid = validateAlphabetSequence(question); break;
    case 'speak_to_answer': valid = validateSpeakToAnswer(question); break;
    default:
      reject(type, 'unhandled type in validator', question.content || '');
      return null;
  }

  if (!valid) return null;

  return question as EngagingQuestion;
}

export function validateQuestionBatch(questions: any[]): EngagingQuestion[] {
  if (!Array.isArray(questions)) {
    console.warn(`${TAG} validateQuestionBatch received non-array`);
    return [];
  }

  const validated: EngagingQuestion[] = [];
  for (const q of questions) {
    const result = validateQuestion(q);
    if (result) {
      validated.push(result);
    }
  }

  if (questions.length > 0 && validated.length === 0) {
    console.warn(`${TAG} ALL ${questions.length} questions rejected in batch`);
  } else if (validated.length < questions.length) {
    console.warn(`${TAG} Batch: ${validated.length}/${questions.length} passed validation`);
  }

  return validated;
}

export function validateGapPrompt(prompt: any): GapPrompt | null {
  if (!prompt || typeof prompt !== 'object') {
    console.warn(`${TAG} REJECTED GapPrompt: null or not an object`);
    return null;
  }

  if (typeof prompt.type !== 'string' || !KNOWN_GAP_TYPES.includes(prompt.type as GapPromptType)) {
    console.warn(`${TAG} REJECTED GapPrompt: unknown type="${prompt.type}"`);
    return null;
  }

  if (!isNonEmptyString(prompt.question, 5)) {
    console.warn(`${TAG} REJECTED GapPrompt type="${prompt.type}": question too short or missing, got="${truncate(prompt.question || '')}"`);
    return null;
  }

  if (!isNonEmptyString(prompt.correctAnswer)) {
    console.warn(`${TAG} REJECTED GapPrompt type="${prompt.type}": missing correctAnswer`);
    return null;
  }

  if (prompt.type === 'multiple_choice' || prompt.type === 'correction') {
    if (!isNonEmptyArray(prompt.choices, 2)) {
      console.warn(`${TAG} REJECTED GapPrompt type="${prompt.type}": choices missing or < 2`);
      return null;
    }
    const found = prompt.choices.some((c: string) =>
      caseInsensitiveMatch(c, prompt.correctAnswer)
    );
    if (!found) {
      console.warn(`${TAG} REJECTED GapPrompt type="${prompt.type}": correctAnswer not in choices`);
      return null;
    }
  }

  prompt.correctAnswer = prompt.correctAnswer.trim();

  return prompt as GapPrompt;
}

export function validateGapPromptBatch(prompts: any[]): GapPrompt[] {
  if (!Array.isArray(prompts)) return [];
  const validated: GapPrompt[] = [];
  for (const p of prompts) {
    const result = validateGapPrompt(p);
    if (result) validated.push(result);
  }
  if (prompts.length > 0 && validated.length < prompts.length) {
    console.warn(`${TAG} GapPrompt batch: ${validated.length}/${prompts.length} passed`);
  }
  return validated;
}
