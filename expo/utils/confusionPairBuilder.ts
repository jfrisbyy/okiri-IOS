import { GapItem, GapPromptType } from '@/types';
import { ConfusionPair } from '@/utils/confusionModel';

export interface ConfusionQuestion {
  id: string;
  type: GapPromptType;
  question: string;
  correctAnswer: string;
  choices: string[];
  hint?: string;
  relatedGapId: string;
  partnerGapId: string;
  explanation: string;
}

function makeId(): string {
  return 'conf_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function buildConfusionQuestions(
  pair: ConfusionPair,
  maxQuestions: number = 3,
): ConfusionQuestion[] {
  const { gapA, gapB } = pair;
  const out: ConfusionQuestion[] = [];

  if (gapA.englishTranslation && gapB.englishTranslation && gapA.frenchWord && gapB.frenchWord) {
    const choices = shuffle([gapA.frenchWord, gapB.frenchWord]);
    out.push({
      id: makeId(),
      type: 'multiple_choice',
      question: `Which word means "${gapA.englishTranslation}"?`,
      correctAnswer: gapA.frenchWord,
      choices,
      hint: `Don't confuse with "${gapB.frenchWord}" (${gapB.englishTranslation})`,
      relatedGapId: gapA.id,
      partnerGapId: gapB.id,
      explanation: `"${gapA.frenchWord}" means "${gapA.englishTranslation}", while "${gapB.frenchWord}" means "${gapB.englishTranslation}".`,
    });
    out.push({
      id: makeId(),
      type: 'multiple_choice',
      question: `Which word means "${gapB.englishTranslation}"?`,
      correctAnswer: gapB.frenchWord,
      choices: shuffle([gapA.frenchWord, gapB.frenchWord]),
      hint: `Don't confuse with "${gapA.frenchWord}" (${gapA.englishTranslation})`,
      relatedGapId: gapB.id,
      partnerGapId: gapA.id,
      explanation: `"${gapB.frenchWord}" means "${gapB.englishTranslation}", while "${gapA.frenchWord}" means "${gapA.englishTranslation}".`,
    });
  }

  const fillBlank = buildFillBlankContrast(gapA, gapB);
  if (fillBlank) out.push(fillBlank);

  const trueFalse = buildTrueFalseContrast(gapA, gapB);
  if (trueFalse) out.push(trueFalse);

  return out.slice(0, maxQuestions);
}

function buildFillBlankContrast(a: GapItem, b: GapItem): ConfusionQuestion | null {
  const sentence = a.exampleSentence;
  if (!sentence || sentence.length < 10) return null;
  const re = new RegExp(`\\b${escapeRe(a.frenchWord)}\\b`, 'i');
  if (!re.test(sentence)) return null;
  const content = sentence.replace(re, '___');
  const choices = shuffle([a.frenchWord, b.frenchWord]);
  return {
    id: makeId(),
    type: 'fill_blank',
    question: content,
    correctAnswer: a.frenchWord,
    choices,
    hint: `Choose between "${a.frenchWord}" and "${b.frenchWord}"`,
    relatedGapId: a.id,
    partnerGapId: b.id,
    explanation: `Here "${a.frenchWord}" (${a.englishTranslation}) fits — not "${b.frenchWord}" (${b.englishTranslation}).`,
  };
}

function buildTrueFalseContrast(a: GapItem, b: GapItem): ConfusionQuestion | null {
  if (!a.frenchWord || !b.englishTranslation) return null;
  const makeFalse = Math.random() < 0.5;
  const statement = makeFalse
    ? `"${a.frenchWord}" means "${b.englishTranslation}"`
    : `"${a.frenchWord}" means "${a.englishTranslation}"`;
  return {
    id: makeId(),
    type: 'true_false',
    question: statement,
    correctAnswer: makeFalse ? 'false' : 'true',
    choices: ['True', 'False'],
    hint: `Remember the difference between "${a.frenchWord}" and "${b.frenchWord}".`,
    relatedGapId: a.id,
    partnerGapId: b.id,
    explanation: `"${a.frenchWord}" actually means "${a.englishTranslation}". "${b.frenchWord}" means "${b.englishTranslation}".`,
  };
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
