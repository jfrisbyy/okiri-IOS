import { useState, useCallback } from 'react';

export interface GrammarError {
  id: string;
  message: string;
  shortMessage: string;
  offset: number;
  length: number;
  context: string;
  contextOffset: number;
  sentence: string;
  incorrectText: string;
  replacements: string[];
  ruleId: string;
  ruleCategory: string;
  ruleDescription: string;
}

interface LanguageToolMatch {
  message: string;
  shortMessage?: string;
  offset: number;
  length: number;
  context: {
    text: string;
    offset: number;
    length: number;
  };
  sentence: string;
  replacements: { value: string }[];
  rule: {
    id: string;
    category: {
      id: string;
      name: string;
    };
    description: string;
  };
}

interface UseGrammarCheckReturn {
  errors: GrammarError[];
  isChecking: boolean;
  checkText: (text: string) => Promise<GrammarError[]>;
  clearErrors: () => void;
  error: string | null;
}

const LANGUAGETOOL_API = 'https://api.languagetool.org/v2/check';
const MAX_TEXT_LENGTH = 10000;

const ALLOWED_CATEGORIES = new Set([
  'GRAMMAR',
  'CONFUSED_WORDS', 
  'GENDER',
]);

const EXCLUDED_CATEGORIES = new Set([
  'PUNCTUATION',
  'TYPOGRAPHY',
  'CASING',
  'TYPOS',
  'REDUNDANCY',
  'STYLE',
  'MISC',
  'SEMANTICS',
  'COLLOCATIONS',
]);

function shouldIncludeError(categoryId: string, ruleId: string): boolean {
  if (EXCLUDED_CATEGORIES.has(categoryId)) {
    return false;
  }
  if (ALLOWED_CATEGORIES.has(categoryId)) {
    return true;
  }
  const ruleUpper = ruleId.toUpperCase();
  if (ruleUpper.includes('VERB') || ruleUpper.includes('TENSE') || 
      ruleUpper.includes('ACCORD') || ruleUpper.includes('CONJUGATION') ||
      ruleUpper.includes('SUBJONCTIF') || ruleUpper.includes('CONDITIONNEL') ||
      ruleUpper.includes('IMPARFAIT') || ruleUpper.includes('PASSE')) {
    return true;
  }
  return false;
}

export function useGrammarCheck(): UseGrammarCheckReturn {
  const [errors, setErrors] = useState<GrammarError[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkText = useCallback(async (text: string): Promise<GrammarError[]> => {
    if (!text.trim()) {
      setErrors([]);
      return [];
    }

    setIsChecking(true);
    setError(null);

    try {
      const chunks = splitTextIntoChunks(text, MAX_TEXT_LENGTH);
      const allErrors: GrammarError[] = [];
      let offsetAdjustment = 0;

      for (const chunk of chunks) {
        const formData = new URLSearchParams();
        formData.append('text', chunk);
        formData.append('language', 'fr');
        formData.append('enabledOnly', 'false');

        const response = await fetch(LANGUAGETOOL_API, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formData.toString(),
        });

        if (!response.ok) {
          if (response.status === 429) {
            setError('Rate limit reached. Please try again in a moment.');
            break;
          }
          throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        
        const chunkErrors: GrammarError[] = data.matches
          .filter((match: LanguageToolMatch) => shouldIncludeError(match.rule.category.id, match.rule.id))
          .map((match: LanguageToolMatch, index: number) => ({
            id: `error-${Date.now()}-${index}-${match.offset}`,
            message: getEnglishExplanation(match.rule.category.id, match.rule.id, match.message),
            shortMessage: match.shortMessage || getRuleShortMessage(match.rule.category.id),
            offset: match.offset + offsetAdjustment,
            length: match.length,
            context: match.context.text,
            contextOffset: match.context.offset,
            sentence: match.sentence,
            incorrectText: text.substring(match.offset + offsetAdjustment, match.offset + offsetAdjustment + match.length),
            replacements: match.replacements.slice(0, 3).map(r => r.value),
            ruleId: match.rule.id,
            ruleCategory: match.rule.category.id,
            ruleDescription: match.rule.description,
          }));

        allErrors.push(...chunkErrors);
        offsetAdjustment += chunk.length;
      }

      setErrors(allErrors);
      return allErrors;
    } catch (e: any) {
      console.error('Grammar check error:', e);
      setError(e.message || 'Failed to check grammar');
      return [];
    } finally {
      setIsChecking(false);
    }
  }, []);

  const clearErrors = useCallback(() => {
    setErrors([]);
    setError(null);
  }, []);

  return {
    errors,
    isChecking,
    checkText,
    clearErrors,
    error,
  };
}

function splitTextIntoChunks(text: string, maxLength: number): string[] {
  if (text.length <= maxLength) {
    return [text];
  }

  const chunks: string[] = [];
  let currentIndex = 0;

  while (currentIndex < text.length) {
    let endIndex = currentIndex + maxLength;
    
    if (endIndex < text.length) {
      const sentenceEnd = text.lastIndexOf('.', endIndex);
      const paragraphEnd = text.lastIndexOf('\n', endIndex);
      const breakPoint = Math.max(sentenceEnd, paragraphEnd);
      
      if (breakPoint > currentIndex) {
        endIndex = breakPoint + 1;
      }
    }

    chunks.push(text.substring(currentIndex, endIndex));
    currentIndex = endIndex;
  }

  return chunks;
}

function getRuleShortMessage(categoryId: string): string {
  const messages: Record<string, string> = {
    GRAMMAR: 'Grammar',
    TYPOS: 'Spelling',
    PUNCTUATION: 'Punctuation',
    CASING: 'Capitalization',
    CONFUSED_WORDS: 'Word choice',
    REDUNDANCY: 'Redundancy',
    GENDER: 'Gender agreement',
    STYLE: 'Style',
    TYPOGRAPHY: 'Typography',
    MISC: 'Miscellaneous',
  };
  
  return messages[categoryId] || 'Error';
}

function getEnglishExplanation(categoryId: string, ruleId: string, originalMessage: string): string {
  const ruleUpper = ruleId.toUpperCase();
  
  if (categoryId === 'GENDER' || ruleUpper.includes('ACCORD') || ruleUpper.includes('GENRE')) {
    return 'Gender agreement: In French, adjectives and articles must match the gender (masculine/feminine) of the noun they describe. Check if the word needs to be in masculine or feminine form.';
  }
  
  if (ruleUpper.includes('VERB') || ruleUpper.includes('CONJUGATION') || ruleUpper.includes('CONJUGAISON')) {
    return 'Verb conjugation: The verb form doesn\'t match the subject. French verbs change their endings based on the subject (je, tu, il/elle, nous, vous, ils/elles) and tense.';
  }
  
  if (ruleUpper.includes('SUBJONCTIF')) {
    return 'Subjunctive mood: After certain expressions (like "il faut que", "je veux que"), French requires the subjunctive form of the verb, which has different conjugations than the regular indicative.';
  }
  
  if (ruleUpper.includes('CONDITIONNEL')) {
    return 'Conditional tense: The conditional is used for hypothetical situations ("would" in English). Check if the verb ending should be -ais, -ais, -ait, -ions, -iez, or -aient.';
  }
  
  if (ruleUpper.includes('IMPARFAIT')) {
    return 'Imperfect tense: The imparfait describes ongoing or habitual past actions. It uses endings like -ais, -ais, -ait, -ions, -iez, -aient added to the stem.';
  }
  
  if (ruleUpper.includes('PASSE') || ruleUpper.includes('PARTICIPE')) {
    return 'Past tense: Check the past participle agreement or the choice between passé composé and imparfait. Past participles may need to agree in gender and number.';
  }
  
  if (ruleUpper.includes('TENSE') || ruleUpper.includes('TEMPS')) {
    return 'Tense usage: The verb tense doesn\'t fit the context. Consider whether you need present, past (passé composé, imparfait), future, or conditional tense.';
  }
  
  if (categoryId === 'CONFUSED_WORDS') {
    return 'Word confusion: These words are often mixed up in French. They may sound similar or have related meanings, but they\'re used differently. Check which one fits your intended meaning.';
  }
  
  if (categoryId === 'GRAMMAR') {
    return 'Grammar rule: There\'s a grammatical structure issue here. This could involve word order, agreement, or the choice of grammatical form.';
  }
  
  return originalMessage;
}
