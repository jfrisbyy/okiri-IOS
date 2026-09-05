import { ContentType, GapCategory, GapPromptType, Difficulty } from '@/types';

export const CONTENT_TYPE_EXERCISES: Record<ContentType, GapPromptType[]> = {
  alphabet_phonetics: [
    'sound_to_letter', 'letter_to_sound', 'alphabet_sequence',
    'multiple_choice', 'true_false', 'listen_and_type',
  ],
  pronunciation_rules: [
    'sound_to_letter', 'letter_to_sound', 'listen_and_type',
    'multiple_choice', 'true_false', 'speak_to_answer',
  ],
  vocabulary: [
    'multiple_choice', 'fill_blank', 'match_pairs', 'translation',
    'listen_and_type', 'speak_to_answer', 'word_order',
  ],
  grammar_rule: [
    'fill_blank', 'correction', 'spot_the_error', 'sentence_build',
    'word_order', 'multiple_choice', 'true_false',
  ],
  verb_conjugation: [
    'fill_blank', 'multiple_choice', 'production', 'spot_the_error',
    'match_pairs', 'true_false', 'sentence_build',
  ],
  numbers_dates_time: [
    'multiple_choice', 'fill_blank', 'listen_and_type',
    'translation', 'true_false', 'production',
  ],
  expressions_idioms: [
    'multiple_choice', 'match_pairs', 'translation', 'fill_blank',
    'sentence_build', 'production', 'speak_to_answer',
  ],
  sentence_structure: [
    'sentence_build', 'word_order', 'spot_the_error', 'fill_blank',
    'translation', 'production', 'correction',
  ],
  cultural_context: [
    'multiple_choice', 'true_false', 'match_pairs',
    'translation', 'fill_blank', 'production',
  ],
  listening_comprehension: [
    'listen_and_type', 'multiple_choice', 'true_false',
    'fill_blank', 'speak_to_answer', 'sound_to_letter',
  ],
};

export const BLOCKED_COMBINATIONS: Record<ContentType, GapPromptType[]> = {
  alphabet_phonetics: [
    'sentence_build', 'word_order', 'translation', 'production',
    'spot_the_error', 'correction',
  ],
  pronunciation_rules: [
    'translation', 'sentence_build', 'word_order', 'production',
    'spot_the_error', 'correction',
  ],
  vocabulary: [
    'sound_to_letter', 'letter_to_sound', 'alphabet_sequence',
  ],
  grammar_rule: [
    'sound_to_letter', 'letter_to_sound', 'alphabet_sequence',
  ],
  verb_conjugation: [
    'sound_to_letter', 'letter_to_sound', 'alphabet_sequence',
  ],
  numbers_dates_time: [
    'sound_to_letter', 'letter_to_sound', 'alphabet_sequence',
    'spot_the_error', 'correction',
  ],
  expressions_idioms: [
    'sound_to_letter', 'letter_to_sound', 'alphabet_sequence',
  ],
  sentence_structure: [
    'sound_to_letter', 'letter_to_sound', 'alphabet_sequence',
  ],
  cultural_context: [
    'sound_to_letter', 'letter_to_sound', 'alphabet_sequence',
    'sentence_build', 'word_order',
  ],
  listening_comprehension: [
    'letter_to_sound', 'alphabet_sequence',
    'sentence_build', 'word_order', 'spot_the_error',
  ],
};

export function getValidExerciseTypes(contentType: ContentType): GapPromptType[] {
  const valid = CONTENT_TYPE_EXERCISES[contentType] || [];
  const blocked = BLOCKED_COMBINATIONS[contentType] || [];
  const blockedSet = new Set(blocked);
  return valid.filter(t => !blockedSet.has(t));
}

export function getPreferredExerciseTypes(
  contentType: ContentType,
  difficulty: Difficulty,
): GapPromptType[] {
  const valid = getValidExerciseTypes(contentType);

  const SIMPLE: GapPromptType[] = [
    'multiple_choice', 'true_false', 'match_pairs',
    'sound_to_letter', 'letter_to_sound', 'alphabet_sequence',
  ];
  const INTERMEDIATE: GapPromptType[] = [
    'fill_blank', 'word_order', 'spot_the_error', 'listen_and_type',
  ];
  const ADVANCED: GapPromptType[] = [
    'translation', 'production', 'sentence_build', 'speak_to_answer', 'correction',
  ];

  let preferred: GapPromptType[];

  switch (difficulty) {
    case 'beginner':
      preferred = valid.filter(t => SIMPLE.includes(t));
      if (preferred.length < 2) {
        preferred.push(...valid.filter(t => INTERMEDIATE.includes(t)).slice(0, 2));
      }
      break;
    case 'easy':
      preferred = valid.filter(t => SIMPLE.includes(t) || INTERMEDIATE.includes(t));
      break;
    case 'medium':
      preferred = valid.filter(t => INTERMEDIATE.includes(t) || ADVANCED.includes(t));
      if (preferred.length < 2) {
        preferred.push(...valid.filter(t => SIMPLE.includes(t)).slice(0, 2));
      }
      break;
    case 'hard':
    case 'university':
      preferred = valid.filter(t => ADVANCED.includes(t));
      if (preferred.length < 2) {
        preferred.push(...valid.filter(t => INTERMEDIATE.includes(t)).slice(0, 2));
      }
      break;
    default:
      preferred = valid;
  }

  return preferred.length > 0 ? preferred : valid.slice(0, 3);
}

const SINGLE_LETTER_REGEX = /^[a-zA-ZàâäéèêëïîôùûüÿçœæÀÂÄÉÈÊËÏÎÔÙÛÜŸÇŒÆ]{1,3}$/;

export function inferContentType(
  category: GapCategory,
  description: string,
  frenchText: string,
): ContentType {
  const descLower = (description || '').toLowerCase();
  const frenchLower = (frenchText || '').toLowerCase();

  if (category === 'pronunciation' && SINGLE_LETTER_REGEX.test(frenchText.trim())) {
    return 'alphabet_phonetics';
  }

  if (category === 'pronunciation') {
    if (descLower.includes('alphabet') || descLower.includes('letter')) {
      return 'alphabet_phonetics';
    }
    return 'pronunciation_rules';
  }

  if (category === 'grammar') {
    if (
      descLower.includes('conjugat') ||
      descLower.includes('tense') ||
      descLower.includes('verb form') ||
      descLower.includes('indicat') ||
      descLower.includes('subjunctive') ||
      descLower.includes('imperfect') ||
      descLower.includes('passé')
    ) {
      return 'verb_conjugation';
    }
    if (
      descLower.includes('sentence structure') ||
      descLower.includes('word order') ||
      descLower.includes('syntax')
    ) {
      return 'sentence_structure';
    }
    return 'grammar_rule';
  }

  if (category === 'vocabulary') {
    if (
      descLower.includes('number') ||
      descLower.includes('date') ||
      descLower.includes('time') ||
      descLower.includes('heure') ||
      frenchLower.match(/^\d/) ||
      descLower.includes('count')
    ) {
      return 'numbers_dates_time';
    }
    if (
      descLower.includes('culture') ||
      descLower.includes('tradition') ||
      descLower.includes('custom')
    ) {
      return 'cultural_context';
    }
    return 'vocabulary';
  }

  if (category === 'phrasing') {
    if (
      descLower.includes('idiom') ||
      descLower.includes('expression') ||
      descLower.includes('proverb')
    ) {
      return 'expressions_idioms';
    }
    return 'sentence_structure';
  }

  if (category === 'register') {
    if (
      descLower.includes('culture') ||
      descLower.includes('polite') ||
      descLower.includes('formal')
    ) {
      return 'cultural_context';
    }
    return 'expressions_idioms';
  }

  if (descLower.includes('listen') || descLower.includes('audio') || descLower.includes('hear')) {
    return 'listening_comprehension';
  }

  return 'vocabulary';
}
