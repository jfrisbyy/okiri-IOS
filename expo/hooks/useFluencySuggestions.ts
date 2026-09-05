import { useState, useCallback } from 'react';
import { generateText } from '@rork-ai/toolkit-sdk';

export interface FluencySuggestion {
  id: string;
  originalPhrase: string;
  suggestedPhrase: string;
  explanation: string;
  fullSentence: string;
  exampleWhereOriginalWorks: string;
  category: 'more_natural' | 'more_formal' | 'more_casual' | 'idiomatic' | 'clearer';
  isGrammarError: boolean;
}

interface UseFluencySuggestionsReturn {
  suggestions: FluencySuggestion[];
  isAnalyzing: boolean;
  analyzeText: (text: string) => Promise<FluencySuggestion[]>;
  clearSuggestions: () => void;
  error: string | null;
}

export function useFluencySuggestions(): UseFluencySuggestionsReturn {
  const [suggestions, setSuggestions] = useState<FluencySuggestion[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyzeText = useCallback(async (text: string): Promise<FluencySuggestion[]> => {
    if (!text.trim() || text.trim().split(' ').length < 3) {
      setSuggestions([]);
      return [];
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const prompt = `You are a French language coach helping an English speaker improve their spoken French.

Analyze this transcribed French speech and identify TWO types of issues:

1. GRAMMAR ERRORS (isGrammarError: true):
   - Using the wrong verb (e.g., "je suis faim" instead of "j'ai faim")
   - Incorrect verb conjugations (wrong endings for the subject)
   - Wrong tense usage
   - Gender/number agreement errors
   - Using être when avoir is required (faim, soif, chaud, froid, peur, raison, tort, besoin, envie, sommeil, honte, mal)
   - Incorrect prepositions or articles

2. FLUENCY SUGGESTIONS (isGrammarError: false):
   - Phrases that are grammatically CORRECT but sound non-native
   - More idiomatic ways to express the same idea
   - Word choices that could sound more natural in conversation
   - Repetitive phrasing that could be simplified

DO NOT flag:
- Punctuation issues (this is transcribed speech)
- Minor pronunciation variations in transcription

For EACH issue, provide:
1. originalPhrase: The specific word/phrase that has the issue
2. suggestedPhrase: The corrected or improved version
3. fullSentence: The COMPLETE sentence from the speech containing this error (for context)
4. explanation: A detailed explanation in English of WHY this is wrong/better and WHEN to use the correct form
5. exampleWhereOriginalWorks: A different example sentence where the user's original form WOULD be correct (to help them understand the pattern). For grammar errors, show when that conjugation/form is actually appropriate.
6. isGrammarError: true for grammar errors, false for fluency suggestions

Speech to analyze:
"${text}"

Respond with a JSON array. If no issues found, return an empty array [].
Format:
[
  {
    "originalPhrase": "the specific error word/phrase",
    "suggestedPhrase": "corrected version",
    "fullSentence": "the complete sentence from speech containing this error",
    "explanation": "detailed English explanation of the rule and when to use each form",
    "exampleWhereOriginalWorks": "Example sentence where the user's form would be correct, e.g., 'Il faisait beau hier' for 'faisait'",
    "category": "more_natural" | "idiomatic" | "clearer",
    "isGrammarError": true or false
  }
]

Return ONLY the JSON array, no other text.`;

      const response = await generateText({ messages: [{ role: 'user', content: prompt }] });
      
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const formattedSuggestions: FluencySuggestion[] = parsed.map((item: any, index: number) => ({
          id: `suggestion-${Date.now()}-${index}`,
          originalPhrase: item.originalPhrase || '',
          suggestedPhrase: item.suggestedPhrase || '',
          explanation: item.explanation || '',
          fullSentence: item.fullSentence || '',
          exampleWhereOriginalWorks: item.exampleWhereOriginalWorks || '',
          category: item.category || 'more_natural',
          isGrammarError: item.isGrammarError === true,
        })).filter((s: FluencySuggestion) => s.originalPhrase && s.suggestedPhrase);

        setSuggestions(formattedSuggestions);
        return formattedSuggestions;
      }

      setSuggestions([]);
      return [];
    } catch (e: any) {
      console.error('Fluency analysis error:', e);
      setError(e.message || 'Failed to analyze fluency');
      return [];
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const clearSuggestions = useCallback(() => {
    setSuggestions([]);
    setError(null);
  }, []);

  return {
    suggestions,
    isAnalyzing,
    analyzeText,
    clearSuggestions,
    error,
  };
}
