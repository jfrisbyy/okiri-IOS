import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'error_history_global';
const MAX_GLOBAL_ERRORS = 200;
const MAX_CONCEPT_ERRORS = 50;

export type ErrorType =
  | 'gender_agreement'
  | 'verb_conjugation'
  | 'tense_confusion'
  | 'auxiliary_confusion'
  | 'accent_missing'
  | 'word_order'
  | 'spelling'
  | 'vocabulary_confusion'
  | 'article_error'
  | 'preposition_error'
  | 'false_cognate'
  | 'unknown';

export interface ErrorEntry {
  errorType: ErrorType;
  wrongAnswer: string;
  correctAnswer: string;
  questionType: string;
  conceptId: string;
  timestamp: string;
}

export interface ErrorPattern {
  errorType: ErrorType;
  count: number;
  examples: { wrong: string; correct: string }[];
}

async function loadErrors(): Promise<ErrorEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('[ErrorHistoryStore] Failed to load errors:', e);
    return [];
  }
}

async function saveErrors(errors: ErrorEntry[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(errors));
  } catch (e) {
    console.error('[ErrorHistoryStore] Failed to save errors:', e);
  }
}

export async function addError(entry: ErrorEntry): Promise<void> {
  const errors = await loadErrors();
  errors.unshift(entry);

  const trimmed = errors.slice(0, MAX_GLOBAL_ERRORS);

  const conceptCounts: Record<string, number> = {};
  const filtered: ErrorEntry[] = [];
  for (const err of trimmed) {
    const count = conceptCounts[err.conceptId] || 0;
    if (count < MAX_CONCEPT_ERRORS) {
      filtered.push(err);
      conceptCounts[err.conceptId] = count + 1;
    }
  }

  await saveErrors(filtered);
  console.log('[ErrorHistoryStore] Added error:', entry.errorType, 'for concept:', entry.conceptId, 'total:', filtered.length);
}

export async function getErrorsForConcept(conceptId: string): Promise<ErrorEntry[]> {
  const errors = await loadErrors();
  return errors.filter(e => e.conceptId === conceptId);
}

export async function getRecentErrors(limit: number = 20): Promise<ErrorEntry[]> {
  const errors = await loadErrors();
  return errors.slice(0, limit);
}

export async function getErrorPatterns(limit: number = 10): Promise<ErrorPattern[]> {
  const errors = await loadErrors();

  const grouped: Record<ErrorType, { count: number; examples: { wrong: string; correct: string }[] }> = {} as any;

  for (const err of errors) {
    if (!grouped[err.errorType]) {
      grouped[err.errorType] = { count: 0, examples: [] };
    }
    grouped[err.errorType].count++;
    if (grouped[err.errorType].examples.length < 3) {
      grouped[err.errorType].examples.push({
        wrong: err.wrongAnswer,
        correct: err.correctAnswer,
      });
    }
  }

  const patterns: ErrorPattern[] = Object.entries(grouped)
    .map(([errorType, data]) => ({
      errorType: errorType as ErrorType,
      count: data.count,
      examples: data.examples,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);

  return patterns;
}

export async function clearErrorHistory(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
  console.log('[ErrorHistoryStore] Cleared all error history');
}
