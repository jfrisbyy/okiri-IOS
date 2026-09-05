import type { EngagingQuestion, EngagingQuestionType } from '@/utils/masteryEngine';
import { validateQuestion } from '@/utils/questionValidator';
import { getSmartDistractors } from '@/utils/distractorBank';

const TAG = '[AIRepair]';

const VALID_TYPES: EngagingQuestionType[] = [
  'multiple_choice', 'fill_blank', 'word_order', 'match_pairs',
  'listen_type', 'sentence_build', 'translation', 'production',
  'spot_the_error', 'true_false', 'speak_to_answer',
  'sound_to_letter', 'letter_to_sound', 'alphabet_sequence',
];

const TYPE_ALIASES: Record<string, EngagingQuestionType> = {
  'multiple_choices': 'multiple_choice',
  'multi_choice': 'multiple_choice',
  'multiplechoice': 'multiple_choice',
  'multiple-choice': 'multiple_choice',
  'true-false': 'true_false',
  'truefalse': 'true_false',
  'true_or_false': 'true_false',
  'fill-blank': 'fill_blank',
  'fillblank': 'fill_blank',
  'fill_in_blank': 'fill_blank',
  'fill_in_the_blank': 'fill_blank',
  'word-order': 'word_order',
  'wordorder': 'word_order',
  'sentence-build': 'sentence_build',
  'sentencebuild': 'sentence_build',
  'spot-the-error': 'spot_the_error',
  'spottheerror': 'spot_the_error',
  'match-pairs': 'match_pairs',
  'matchpairs': 'match_pairs',
  'listen-type': 'listen_type',
  'listentype': 'listen_type',
  'listen_and_type': 'listen_type',
  'speak-to-answer': 'speak_to_answer',
  'speaktoanswer': 'speak_to_answer',
  'sound-to-letter': 'sound_to_letter',
  'soundtoletter': 'sound_to_letter',
  'letter-to-sound': 'letter_to_sound',
  'lettertosound': 'letter_to_sound',
  'alphabet-sequence': 'alphabet_sequence',
  'alphabetsequence': 'alphabet_sequence',
};

const VAGUE_PATTERNS = [
  /^is this correct\??$/i,
  /^is this rule correct\??$/i,
  /^is this right\??$/i,
  /^do you understand\??$/i,
  /^do you know\??$/i,
  /^true or false\??$/i,
  /^is this true\??$/i,
  /^is this false\??$/i,
];

function hasFrenchContent(text: string): boolean {
  return /[éèêëàâäùûüôöîïç]/.test(text) ||
    /\b(le|la|les|un|une|des|je|tu|il|elle|nous|vous|ils|elles|est|sont|être|avoir)\b/i.test(text);
}

function isVagueQuestion(text: string): boolean {
  if (!text) return true;
  const trimmed = text.trim();
  if (trimmed.length < 5) return true;
  if (hasFrenchContent(trimmed)) return false;
  return VAGUE_PATTERNS.some(p => p.test(trimmed));
}

function repairType(raw: any): EngagingQuestionType | null {
  if (typeof raw.type === 'string') {
    const t = raw.type.toLowerCase().trim();
    if (VALID_TYPES.includes(t as EngagingQuestionType)) return t as EngagingQuestionType;
    if (TYPE_ALIASES[t]) {
      console.log(`${TAG} Fixed type alias "${raw.type}" → "${TYPE_ALIASES[t]}"`);
      return TYPE_ALIASES[t];
    }
  }

  if (Array.isArray(raw.options) && raw.options.length === 2) {
    const opts = raw.options.map((o: any) => String(o).toLowerCase().trim());
    if (opts.includes('true') && opts.includes('false')) {
      console.log(`${TAG} Inferred type "true_false" from options`);
      return 'true_false';
    }
  }
  if (Array.isArray(raw.options) && raw.options.length >= 3) {
    console.log(`${TAG} Inferred type "multiple_choice" from options array`);
    return 'multiple_choice';
  }
  if (Array.isArray(raw.choices) && raw.choices.length >= 3) {
    console.log(`${TAG} Inferred type "multiple_choice" from choices array`);
    return 'multiple_choice';
  }
  const content = raw.content || raw.question || '';
  if (typeof content === 'string' && content.includes('___')) {
    console.log(`${TAG} Inferred type "fill_blank" from blank in content`);
    return 'fill_blank';
  }

  return null;
}

function repairCorrectAnswer(raw: any, type: EngagingQuestionType): boolean {
  const options = raw.choices || raw.options;

  if (type === 'multiple_choice') {
    if (typeof raw.correctAnswer === 'string' && Array.isArray(options)) {
      const idx = options.findIndex((o: string) =>
        typeof o === 'string' && o.toLowerCase().trim() === raw.correctAnswer.toLowerCase().trim()
      );
      if (idx >= 0) return true;

      const numParsed = parseInt(raw.correctAnswer, 10);
      if (!isNaN(numParsed) && numParsed >= 0 && numParsed < options.length) {
        raw.correctAnswer = options[numParsed];
        console.log(`${TAG} Converted numeric string correctAnswer "${numParsed}" to option text`);
        return true;
      }
    }
    if (typeof raw.correctAnswer === 'number' && Array.isArray(options)) {
      const idx = raw.correctAnswer;
      if (idx >= 0 && idx < options.length) {
        raw.correctAnswer = options[idx];
        console.log(`${TAG} Converted numeric correctAnswer ${idx} to option text for multiple_choice`);
        return true;
      }
      raw.correctAnswer = options[0] || '';
      console.warn(`${TAG} correctAnswer index out of bounds, defaulting to first option`);
      return !!options[0];
    }
    return true;
  }

  if (type === 'true_false') {
    const ca = raw.correctAnswer;
    if (ca === true || ca === 'true' || ca === 'True' || ca === 'TRUE' || ca === 0 || ca === '0') {
      raw.correctAnswer = 'true';
      raw.isTrue = true;
      return true;
    }
    if (ca === false || ca === 'false' || ca === 'False' || ca === 'FALSE' || ca === 1 || ca === '1') {
      raw.correctAnswer = 'false';
      raw.isTrue = false;
      return true;
    }
    if (typeof ca === 'string') {
      const lower = ca.toLowerCase().trim();
      if (lower === 'true') { raw.correctAnswer = 'true'; raw.isTrue = true; return true; }
      if (lower === 'false') { raw.correctAnswer = 'false'; raw.isTrue = false; return true; }
    }
    return false;
  }

  if (type === 'fill_blank') {
    if (typeof raw.correctAnswer === 'number') {
      raw.correctAnswer = String(raw.correctAnswer);
      return true;
    }
    if (Array.isArray(raw.correctAnswer) && raw.correctAnswer.length > 0) {
      raw.acceptableAnswers = raw.correctAnswer;
      raw.correctAnswer = raw.correctAnswer[0];
      return true;
    }
  }

  return true;
}

function repairOptions(raw: any, type: EngagingQuestionType): boolean {
  if (type === 'true_false') {
    raw.options = ['True', 'False'];
    if (!raw.statement && raw.content) raw.statement = raw.content;
    if (!raw.statement && raw.question) raw.statement = raw.question;
    return true;
  }

  if (type === 'multiple_choice') {
    let options = raw.choices || raw.options;
    if (!Array.isArray(options)) options = [];

    options = options.filter((o: any) => typeof o === 'string' && o.trim().length > 0);

    const seen = new Set<string>();
    const deduped: string[] = [];
    for (const o of options) {
      const key = o.toLowerCase().trim();
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(o);
      }
    }
    options = deduped;

    const correctAnswer = typeof raw.correctAnswer === 'string' ? raw.correctAnswer.trim() : '';
    const hasCorrect = options.some((o: string) => o.toLowerCase().trim() === correctAnswer.toLowerCase().trim());

    if (!hasCorrect && correctAnswer.length > 0) {
      options = [correctAnswer, ...options];
    }

    if (options.length < 4) {
      try {
        const needed = 4 - options.length;
        const bankDistractors = getSmartDistractors({
          correctAnswer,
          answerLanguage: hasFrenchContent(correctAnswer) ? 'french' : 'english',
          count: needed,
          avoidList: options.map((o: string) => o.toLowerCase().trim()),
        });
        options = [...options, ...bankDistractors];
      } catch (e) {
        console.warn(`${TAG} Failed to get bank distractors for padding:`, e);
      }
    }

    if (options.length > 6) {
      const correctIdx = options.findIndex((o: string) => o.toLowerCase().trim() === correctAnswer.toLowerCase().trim());
      const kept = [options[correctIdx >= 0 ? correctIdx : 0]];
      for (const o of options) {
        if (kept.length >= 4) break;
        if (!kept.includes(o)) kept.push(o);
      }
      options = kept;
    }

    for (let i = 0; i < options.length; i++) {
      if (!options[i] || typeof options[i] !== 'string' || options[i].trim().length === 0) {
        try {
          const replacements = getSmartDistractors({
            correctAnswer,
            answerLanguage: hasFrenchContent(correctAnswer) ? 'french' : 'english',
            count: 1,
            avoidList: options.filter((o: string) => o && o.trim().length > 0).map((o: string) => o.toLowerCase().trim()),
          });
          options[i] = replacements[0] || `Option ${i + 1}`;
        } catch {
          options[i] = `Option ${i + 1}`;
        }
      }
    }

    raw.choices = options;
    raw.options = undefined;

    const finalCorrectIdx = raw.choices.findIndex((o: string) =>
      typeof o === 'string' && o.toLowerCase().trim() === correctAnswer.toLowerCase().trim()
    );
    if (finalCorrectIdx < 0 && correctAnswer.length > 0) {
      raw.choices[0] = correctAnswer;
    }

    return raw.choices.length >= 2;
  }

  return true;
}

function repairMissingFields(raw: any): void {
  if ((!raw.content || (typeof raw.content === 'string' && raw.content.trim().length === 0)) && raw.question) {
    raw.content = raw.question;
  }
  if ((!raw.content || (typeof raw.content === 'string' && raw.content.trim().length === 0)) && raw.listenText) {
    raw.content = raw.listenText;
  }
  if ((!raw.content || (typeof raw.content === 'string' && raw.content.trim().length === 0)) && raw.audioText) {
    raw.content = raw.audioText;
  }

  if (!raw.explanation || (typeof raw.explanation === 'string' && raw.explanation.trim().length === 0)) {
    raw.explanation = 'Review this concept and try again.';
  }

  if (!raw.difficulty || (typeof raw.difficulty === 'string' && raw.difficulty.trim().length === 0)) {
    raw.difficulty = 'intermediate';
  }

  if (!raw.id) {
    raw.id = Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  if (!raw.conceptId) {
    raw.conceptId = '';
  }
}

function repairFillBlankContent(raw: any): void {
  if (raw.type !== 'fill_blank') return;

  const content = raw.content || '';
  if (typeof content === 'string' && !content.includes('___')) {
    if (content.includes('__')) {
      raw.content = content.replace(/__+/g, '___');
      console.log(`${TAG} Fixed fill_blank: normalized underscores to ___`);
    } else if (content.includes('[blank]') || content.includes('(blank)')) {
      raw.content = content.replace(/\[blank\]|\(blank\)/gi, '___');
      console.log(`${TAG} Fixed fill_blank: replaced [blank]/(blank) with ___`);
    } else if (content.includes('...') || content.includes('…')) {
      raw.content = content.replace(/\.{3}|…/g, '___');
      console.log(`${TAG} Fixed fill_blank: replaced ellipsis with ___`);
    }
  }

  if (typeof raw.content === 'string' && !raw.content.includes('___') && raw.question && typeof raw.question === 'string' && raw.question.includes('___')) {
    const temp = raw.content;
    raw.content = raw.question;
    raw.question = temp;
    console.log(`${TAG} Fixed fill_blank: swapped content and question (question had ___)`);
  }
}

function repairVagueQuestionText(raw: any): boolean {
  const questionText = raw.content || raw.question || '';
  if (!isVagueQuestion(questionText)) return true;

  const correctAnswer = raw.correctAnswer || '';
  if (typeof correctAnswer === 'string' && correctAnswer.length > 2) {
    if (raw.type === 'multiple_choice') {
      if (hasFrenchContent(correctAnswer)) {
        raw.content = `Which of the following is correct?`;
      } else {
        raw.content = `What is the correct answer?`;
      }
      console.log(`${TAG} Rewrote vague question text for ${raw.type}`);
      return true;
    }
    if (raw.type === 'true_false') {
      if (raw.statement && typeof raw.statement === 'string' && raw.statement.trim().length >= 10) {
        raw.content = raw.statement;
        console.log(`${TAG} Used statement as content for vague true_false`);
        return true;
      }
    }
  }

  if (raw.type === 'true_false' && raw.statement && typeof raw.statement === 'string' && raw.statement.trim().length >= 10) {
    raw.content = raw.statement;
    return true;
  }

  console.warn(`${TAG} Cannot repair vague question: "${questionText.substring(0, 50)}"`);
  return false;
}

export function repairAIQuestion(rawQuestion: any): EngagingQuestion | null {
  try {
    if (!rawQuestion || typeof rawQuestion !== 'object') return null;

    const raw = { ...rawQuestion };

    const repairedType = repairType(raw);
    if (!repairedType) {
      console.warn(`${TAG} Cannot determine type for question, dropping`);
      return null;
    }
    raw.type = repairedType;

    if (!repairCorrectAnswer(raw, repairedType)) {
      console.warn(`${TAG} Cannot repair correctAnswer for ${repairedType}`);
      return null;
    }

    if (!repairOptions(raw, repairedType)) {
      console.warn(`${TAG} Cannot repair options for ${repairedType}`);
      return null;
    }

    repairMissingFields(raw);
    repairFillBlankContent(raw);

    if (!repairVagueQuestionText(raw)) {
      return null;
    }

    const validated = validateQuestion(raw);
    if (validated) {
      console.log(`${TAG} Successfully repaired question type="${repairedType}"`);
    }
    return validated;
  } catch (e) {
    console.error(`${TAG} Error repairing question:`, e);
    return null;
  }
}

export function repairAILesson(rawLesson: any): { teach: any[]; practice: any[]; challenge: any[] } {
  try {
    if (!rawLesson || typeof rawLesson !== 'object') {
      return { teach: [], practice: [], challenge: [] };
    }

    const teach = Array.isArray(rawLesson.teach) ? rawLesson.teach : [];
    const rawPractice = Array.isArray(rawLesson.practice) ? rawLesson.practice : [];
    const rawChallenge = Array.isArray(rawLesson.challenge) ? rawLesson.challenge : [];

    let practiceRepaired = 0;
    let practiceDropped = 0;
    let challengeRepaired = 0;
    let challengeDropped = 0;

    const practice: any[] = [];
    for (const item of rawPractice) {
      const repaired = repairAIQuestion(item);
      if (repaired) {
        practice.push(repaired);
        practiceRepaired++;
      } else {
        practiceDropped++;
      }
    }

    const challenge: any[] = [];
    for (const item of rawChallenge) {
      const repaired = repairAIQuestion(item);
      if (repaired) {
        challenge.push(repaired);
        challengeRepaired++;
      } else {
        challengeDropped++;
      }
    }

    console.log(
      `${TAG} Repaired ${practiceRepaired}/${rawPractice.length} practice, ${challengeRepaired}/${rawChallenge.length} challenge. Dropped ${practiceDropped + challengeDropped} unfixable.`
    );

    return { teach, practice, challenge };
  } catch (e) {
    console.error(`${TAG} Error repairing lesson:`, e);
    return { teach: [], practice: [], challenge: [] };
  }
}
