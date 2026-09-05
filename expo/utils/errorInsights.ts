import type { ErrorPattern, ErrorType } from '@/utils/errorHistoryStore';

export interface ErrorInsight {
  id: ErrorType;
  title: string;
  subtitle: string;
  explanation: string;
  category: 'grammar' | 'vocabulary' | 'pronunciation' | 'spelling';
  color: string;
  bg: string;
  count: number;
  percentage: number;
  examples: { wrong: string; correct: string }[];
}

const ERROR_META: Record<ErrorType, {
  title: string;
  subtitle: string;
  explanation: string;
  category: ErrorInsight['category'];
}> = {
  gender_agreement: {
    title: 'Gender agreement',
    subtitle: 'You mix up masculine and feminine forms',
    explanation: 'French nouns have grammatical gender. Every le/la, un/une, bon/bonne must match the noun. When you\'re unsure, the ending is a clue — words ending in -e are often feminine, but there are many exceptions. Learn gender with the article, not the word alone.',
    category: 'grammar',
  },
  verb_conjugation: {
    title: 'Verb conjugation',
    subtitle: 'Endings don\'t match the subject',
    explanation: 'Each pronoun (je, tu, il/elle, nous, vous, ils/elles) needs a specific ending. Focus on one tense at a time and drill the six forms until they feel automatic.',
    category: 'grammar',
  },
  tense_confusion: {
    title: 'Tense confusion',
    subtitle: 'You pick the wrong tense for the moment',
    explanation: 'Passé composé is for completed actions. Imparfait describes ongoing states or repeated past actions. If it answers "what happened?", use passé composé. If it answers "what was going on?", use imparfait.',
    category: 'grammar',
  },
  auxiliary_confusion: {
    title: 'Être vs avoir',
    subtitle: 'You pick the wrong helping verb',
    explanation: 'Most verbs use avoir in passé composé. A small set — movement and reflexive verbs like aller, venir, partir, se laver — use être, and the past participle agrees with the subject.',
    category: 'grammar',
  },
  accent_missing: {
    title: 'Missing accents',
    subtitle: 'You drop é, è, à, ç, and others',
    explanation: 'Accents aren\'t optional in French — they change meaning and pronunciation. "a" (has) vs "à" (to), "ou" (or) vs "où" (where). Train your eye to see them as part of the letter.',
    category: 'spelling',
  },
  word_order: {
    title: 'Word order',
    subtitle: 'Sentence structure gets tangled',
    explanation: 'French places adjectives after most nouns, object pronouns before the verb, and negation wraps the verb with ne…pas. Build sentences from a simple skeleton: subject → verb → object.',
    category: 'grammar',
  },
  spelling: {
    title: 'Spelling',
    subtitle: 'Small letter slips add up',
    explanation: 'Silent endings, doubled consonants, and accents are the usual culprits. Type the word slowly and say each syllable — most spelling errors vanish when you slow down.',
    category: 'spelling',
  },
  vocabulary_confusion: {
    title: 'Vocabulary confusion',
    subtitle: 'You pick a similar but wrong word',
    explanation: 'Some words look or sound alike but mean different things (faux amis like "librairie" = bookshop, not library). Learn pairs together and a short example sentence to anchor the meaning.',
    category: 'vocabulary',
  },
  article_error: {
    title: 'Articles (le/la/les/un/une)',
    subtitle: 'You drop or swap articles',
    explanation: 'French almost always needs an article — even in general statements ("j\'aime le café"). Pick the article based on gender, number, and whether the noun is specific or general.',
    category: 'grammar',
  },
  preposition_error: {
    title: 'Prepositions',
    subtitle: 'Wrong à, de, en, dans…',
    explanation: 'Prepositions rarely translate 1:1. "Je vais à Paris" but "je viens de Paris". Memorise prepositions with the verbs and places they attach to, not on their own.',
    category: 'grammar',
  },
  false_cognate: {
    title: 'False friends',
    subtitle: 'Words that look English but aren\'t',
    explanation: '"Actuellement" = currently (not "actually"), "assister" = to attend (not "to assist"). When a French word looks too familiar, double-check — it\'s often a trap.',
    category: 'vocabulary',
  },
  unknown: {
    title: 'Other slips',
    subtitle: 'Mixed small mistakes',
    explanation: 'A mix of small errors that don\'t fit one category. Review your recent mistakes to spot patterns.',
    category: 'spelling',
  },
};

const CATEGORY_COLORS: Record<ErrorInsight['category'], { color: string; bg: string }> = {
  grammar: { color: '#8B5CF6', bg: '#F5F3FF' },
  vocabulary: { color: '#3B82F6', bg: '#EFF6FF' },
  pronunciation: { color: '#EC4899', bg: '#FDF2F8' },
  spelling: { color: '#F59E0B', bg: '#FFFBEB' },
};

export function buildErrorInsights(patterns: ErrorPattern[]): ErrorInsight[] {
  const total = patterns.reduce((sum, p) => sum + p.count, 0);
  if (total === 0) return [];

  return patterns.map(p => {
    const meta = ERROR_META[p.errorType] || ERROR_META.unknown;
    const colors = CATEGORY_COLORS[meta.category];
    return {
      id: p.errorType,
      title: meta.title,
      subtitle: meta.subtitle,
      explanation: meta.explanation,
      category: meta.category,
      color: colors.color,
      bg: colors.bg,
      count: p.count,
      percentage: Math.round((p.count / total) * 100),
      examples: p.examples,
    };
  });
}

export function buildInsightHeadline(insight: ErrorInsight): string {
  if (insight.percentage >= 40) {
    return `${insight.title} is your #1 blocker — ${insight.percentage}% of your mistakes.`;
  }
  if (insight.percentage >= 20) {
    return `${insight.title} shows up in ${insight.percentage}% of your errors.`;
  }
  return `${insight.count} recent mistake${insight.count === 1 ? '' : 's'} in ${insight.title.toLowerCase()}.`;
}
