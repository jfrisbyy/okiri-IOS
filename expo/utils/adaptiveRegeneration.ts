import { generateText } from '@rork-ai/toolkit-sdk';
import type { ErrorType } from '@/utils/errorHistoryStore';
import type { EngagingQuestion, EngagingQuestionType } from '@/utils/masteryEngine';
import { validateQuestion, validateQuestionBatch } from '@/utils/questionValidator';
import { repairAIQuestion } from '@/utils/aiResponseRepair';

export interface SessionError {
  errorType: ErrorType;
  wrongAnswer: string;
  correctAnswer: string;
  questionType: string;
  conceptId: string;
  isCorrect: boolean;
}

export interface AdaptationResult {
  type: 'remediation' | 'mini_teach' | 'skip_easy';
  questions?: EngagingQuestion[];
  skipCount?: number;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function getConsecutiveWrongTail(errors: SessionError[]): SessionError[] {
  const tail: SessionError[] = [];
  for (let i = errors.length - 1; i >= 0; i--) {
    if (!errors[i].isCorrect) {
      tail.unshift(errors[i]);
    } else {
      break;
    }
  }
  return tail;
}

function getConsecutiveCorrectTail(errors: SessionError[]): number {
  let count = 0;
  for (let i = errors.length - 1; i >= 0; i--) {
    if (errors[i].isCorrect) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

function countErrorsByType(errors: SessionError[]): Map<ErrorType, SessionError[]> {
  const map = new Map<ErrorType, SessionError[]>();
  for (const err of errors) {
    if (err.isCorrect) continue;
    const existing = map.get(err.errorType) || [];
    existing.push(err);
    map.set(err.errorType, existing);
  }
  return map;
}

const ERROR_TYPE_LABELS: Partial<Record<ErrorType, string>> = {
  gender_agreement: 'Gender Agreement',
  verb_conjugation: 'Verb Conjugation',
  tense_confusion: 'Tense Usage',
  auxiliary_confusion: 'Auxiliary Verbs (être/avoir)',
  accent_missing: 'French Accents',
  word_order: 'Word Order',
  spelling: 'Spelling',
  vocabulary_confusion: 'Vocabulary',
  article_error: 'Articles (le/la/les)',
  preposition_error: 'Prepositions',
  false_cognate: 'False Cognates',
};

const REMEDIATION_PROMPT = `You are an expert French tutor. The learner just made a specific error and needs ONE targeted remediation exercise.

You MUST respond with ONLY valid JSON, no other text. The JSON must be a single exercise object with a valid "type" field that is one of: multiple_choice, fill_blank, true_false, spot_the_error. The exercise MUST have all required fields fully filled — no empty strings, no missing fields.

ERROR CONTEXT:
- Error type: {errorType} ({errorLabel})
- The learner wrote: "{wrongAnswer}"
- The correct answer was: "{correctAnswer}"
- This occurred in a {questionType} exercise.
- Concept being studied: {conceptId}

Generate ONE exercise that directly targets this exact error pattern. The exercise should:
1. Use the same or very similar words/phrases from the error
2. Be a difficulty level BELOW what caused the error (easier format)
3. Help the learner understand WHY their answer was wrong

STRUCTURAL REQUIREMENTS:
- If type is "multiple_choice": provide "choices" (array of 4 non-empty strings) and "correctAnswer" (a string that EXACTLY matches one of the choices). All 4 choices must be plausible.
- If type is "fill_blank": provide "content" (sentence with ___) and "correctAnswer" (the word for the blank).
- If type is "true_false": provide "statement" (a declarative claim about French), "correctAnswer" ("true" or "false"), "isTrue" (boolean).
- If type is "spot_the_error": provide "errorSentence" (sentence with one error), "correctedSentence" (fixed version), "correctAnswer" (same as correctedSentence).
- ALWAYS provide "explanation" (1-2 sentences explaining WHY the learner's original answer was wrong and what the correct answer means).
- ALWAYS provide "hint" (a helpful nudge, not the answer itself).
- The exercise MUST target the SPECIFIC error the learner made.
- "content" must be a specific question about French, NEVER a vague "Is this correct?" or "Is this right?".

OUTPUT (valid JSON only, no markdown):
{
  "type": "multiple_choice",
  "content": "question text about specific French content",
  "correctAnswer": "correct answer matching one choice",
  "choices": ["choice a", "choice b", "choice c", "choice d"],
  "hint": "helpful hint referencing the specific rule",
  "explanation": "brief explanation of why the correct answer is right"
}`;

const MINI_TEACH_PROMPT = `You are an expert French tutor. The learner is repeatedly making the same type of error and needs a brief rule explanation plus practice.

ERROR PATTERN:
- Error type: {errorType} ({errorLabel})
- Examples of their mistakes:
{errorExamples}
- Concept: {conceptId}

Generate a mini-teach card (explanation) and ONE practice exercise targeting this specific error pattern.

OUTPUT (valid JSON only, no markdown):
{
  "teach": {
    "content": "Clear 2-3 sentence explanation of the rule they keep breaking, with a specific example using their mistake words"
  },
  "exercise": {
    "type": "fill_blank",
    "content": "question with ___",
    "correctAnswer": "correct answer",
    "hint": "rule reminder",
    "explanation": "why this is correct"
  }
}`;

function parseRemediationResponse(raw: string, conceptId: string): EngagingQuestion | null {
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.type || !parsed.correctAnswer) return null;

    const validTypes: EngagingQuestionType[] = ['multiple_choice', 'fill_blank', 'true_false', 'spot_the_error'];
    const type = validTypes.includes(parsed.type) ? parsed.type : 'multiple_choice';

    if (type === 'multiple_choice' && parsed.choices) {
      const hasCorrect = parsed.choices.some((c: string) =>
        typeof c === 'string' && c.toLowerCase().trim() === parsed.correctAnswer.toLowerCase().trim()
      );
      if (!hasCorrect) {
        parsed.choices = [parsed.correctAnswer, ...parsed.choices.slice(0, 3)];
      }
    }

    if (type === 'true_false') {
      parsed.choices = undefined;
      if (!parsed.statement && parsed.content) parsed.statement = parsed.content;
      const ca = String(parsed.correctAnswer).toLowerCase().trim();
      if (ca === 'true' || ca === '0') {
        parsed.correctAnswer = 'true';
        parsed.isTrue = true;
      } else if (ca === 'false' || ca === '1') {
        parsed.correctAnswer = 'false';
        parsed.isTrue = false;
      }
    }

    if (!parsed.explanation || (typeof parsed.explanation === 'string' && parsed.explanation.trim().length === 0)) {
      parsed.explanation = 'Review this concept carefully and try again.';
    }

    const candidate = {
      id: generateId(),
      type,
      conceptId,
      content: parsed.content || '',
      correctAnswer: parsed.correctAnswer,
      choices: parsed.choices,
      hint: parsed.hint,
      explanation: parsed.explanation,
      statement: parsed.statement,
      isTrue: parsed.isTrue,
      errorSentence: parsed.errorSentence,
      correctedSentence: parsed.correctedSentence,
    };

    const repaired = repairAIQuestion(candidate);
    if (repaired) return repaired;

    return validateQuestion(candidate);
  } catch (e) {
    console.error('[AdaptiveRegen] Failed to parse remediation response:', e);
    return null;
  }
}

function parseMiniTeachResponse(raw: string, conceptId: string): EngagingQuestion[] {
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return [];
    const parsed = JSON.parse(jsonMatch[0]);

    const questions: any[] = [];

    if (parsed.teach?.content) {
      questions.push({
        id: generateId(),
        type: 'true_false',
        conceptId,
        content: parsed.teach.content,
        correctAnswer: 'true',
        statement: parsed.teach.content,
        isTrue: true,
        hint: 'Read the explanation carefully',
        explanation: parsed.teach.content,
      });
    }

    if (parsed.exercise) {
      const ex = parsed.exercise;
      const validTypes: EngagingQuestionType[] = ['multiple_choice', 'fill_blank', 'true_false', 'spot_the_error'];
      const type = validTypes.includes(ex.type) ? ex.type : 'fill_blank';

      if (type === 'multiple_choice' && ex.choices) {
        const hasCorrect = ex.choices.some((c: string) =>
          c.toLowerCase().trim() === ex.correctAnswer.toLowerCase().trim()
        );
        if (!hasCorrect) {
          ex.choices = [ex.correctAnswer, ...ex.choices.slice(0, 3)];
        }
      }

      questions.push({
        id: generateId(),
        type,
        conceptId,
        content: ex.content,
        correctAnswer: ex.correctAnswer,
        choices: ex.choices,
        hint: ex.hint,
        explanation: ex.explanation,
      });
    }

    return validateQuestionBatch(questions);
  } catch (e) {
    console.error('[AdaptiveRegen] Failed to parse mini-teach response:', e);
    return [];
  }
}

export async function evaluateAndAdapt(
  sessionErrors: SessionError[],
  remainingQuestionCount: number,
  conceptId: string,
): Promise<AdaptationResult | null> {
  if (sessionErrors.length < 2) return null;

  const correctTail = getConsecutiveCorrectTail(sessionErrors);
  if (correctTail >= 4 && remainingQuestionCount > 3) {
    console.log('[AdaptiveRegen] Trigger 3: 4+ correct in a row, signaling skip');
    return {
      type: 'skip_easy',
      skipCount: Math.min(2, remainingQuestionCount - 2),
    };
  }

  const consecutiveWrong = getConsecutiveWrongTail(sessionErrors);
  if (consecutiveWrong.length >= 2) {
    const errorTypes = consecutiveWrong.map(e => e.errorType);
    const sharedType = errorTypes.find(t =>
      errorTypes.filter(et => et === t).length >= 2 && t !== 'unknown'
    );

    if (sharedType) {
      console.log('[AdaptiveRegen] Trigger 1: 2+ consecutive wrong with shared error type:', sharedType);
      const lastError = consecutiveWrong[consecutiveWrong.length - 1];

      try {
        const prompt = REMEDIATION_PROMPT
          .replace('{errorType}', sharedType)
          .replace('{errorLabel}', ERROR_TYPE_LABELS[sharedType] || sharedType)
          .replace('{wrongAnswer}', lastError.wrongAnswer)
          .replace('{correctAnswer}', lastError.correctAnswer)
          .replace('{questionType}', lastError.questionType)
          .replace('{conceptId}', conceptId);

        const response = await generateText({
          messages: [{ role: 'user', content: prompt }],
        });

        const question = parseRemediationResponse(response, conceptId);
        if (question) {
          console.log('[AdaptiveRegen] Generated remediation exercise:', question.type);
          return { type: 'remediation', questions: [question] };
        }

      } catch (e) {
        console.error('[AdaptiveRegen] Failed to generate remediation:', e);
      }

      return buildFallbackRemediation(sharedType, lastError, conceptId);
    }
  }

  const errorsByType = countErrorsByType(sessionErrors);
  for (const [errorType, errors] of errorsByType) {
    if (errors.length >= 3 && errorType !== 'unknown') {
      console.log('[AdaptiveRegen] Trigger 2: 3+ total errors of type:', errorType, 'count:', errors.length);

      const errorExamples = errors.slice(0, 3).map(e =>
        `  - wrote "${e.wrongAnswer}" instead of "${e.correctAnswer}" (in ${e.questionType})`
      ).join('\n');

      try {
        const prompt = MINI_TEACH_PROMPT
          .replace('{errorType}', errorType)
          .replace('{errorLabel}', ERROR_TYPE_LABELS[errorType] || errorType)
          .replace('{errorExamples}', errorExamples)
          .replace('{conceptId}', conceptId);

        const response = await generateText({
          messages: [{ role: 'user', content: prompt }],
        });

        const questions = parseMiniTeachResponse(response, conceptId);
        if (questions.length > 0) {
          console.log('[AdaptiveRegen] Generated mini-teach with', questions.length, 'validated items');
          return { type: 'mini_teach', questions };
        }
      } catch (e) {
        console.error('[AdaptiveRegen] Failed to generate mini-teach:', e);
      }

      return buildFallbackMiniTeach(errorType, errors, conceptId);
    }
  }

  return null;
}

function buildFallbackRemediation(
  errorType: ErrorType,
  lastError: SessionError,
  conceptId: string,
): AdaptationResult {
  const label = ERROR_TYPE_LABELS[errorType] || 'this concept';
  const candidate = {
    id: generateId(),
    type: 'true_false' as const,
    conceptId,
    content: `The correct form is "${lastError.correctAnswer}" (not "${lastError.wrongAnswer}"). This is a ${label} rule.`,
    correctAnswer: 'true',
    statement: `"${lastError.correctAnswer}" is the correct form.`,
    isTrue: true,
    hint: `Pay attention to ${label.toLowerCase()}`,
    explanation: `"${lastError.wrongAnswer}" was incorrect. The correct answer is "${lastError.correctAnswer}".`,
  };
  const valid = validateQuestion(candidate);
  console.log('[AdaptiveRegen] Built fallback remediation (true_false)');
  return { type: 'remediation', questions: valid ? [valid] : [] };
}

function buildFallbackMiniTeach(
  errorType: ErrorType,
  errors: SessionError[],
  conceptId: string,
): AdaptationResult {
  const label = ERROR_TYPE_LABELS[errorType] || 'this concept';
  const lastError = errors[errors.length - 1];
  const questions: EngagingQuestion[] = [];

  questions.push({
    id: generateId(),
    type: 'true_false',
    conceptId,
    content: `Quick review: ${label}. You've made this mistake ${errors.length} times. The correct form of "${lastError.wrongAnswer}" is "${lastError.correctAnswer}".`,
    correctAnswer: 'true',
    statement: `"${lastError.correctAnswer}" is correct French.`,
    isTrue: true,
    hint: `Focus on ${label.toLowerCase()}`,
    explanation: `Remember: ${label} is important in French. "${lastError.correctAnswer}" is the correct form.`,
  });

  if (errors.length >= 2) {
    const secondError = errors[errors.length - 2];
    questions.push({
      id: generateId(),
      type: 'multiple_choice',
      conceptId,
      content: `Which is the correct French form?`,
      correctAnswer: secondError.correctAnswer,
      choices: [
        secondError.correctAnswer,
        secondError.wrongAnswer,
        lastError.wrongAnswer !== secondError.wrongAnswer ? lastError.wrongAnswer : secondError.correctAnswer + ' ',
        errors[0].wrongAnswer !== secondError.wrongAnswer ? errors[0].wrongAnswer : secondError.correctAnswer + '  ',
      ].slice(0, 4),
      hint: `Think about ${label.toLowerCase()}`,
      explanation: `"${secondError.correctAnswer}" is correct. "${secondError.wrongAnswer}" was your previous mistake.`,
    });
  }

  const validated = validateQuestionBatch(questions);
  console.log('[AdaptiveRegen] Built fallback mini-teach with', validated.length, 'items');
  return { type: 'mini_teach', questions: validated };
}
