import { GapItem, ConceptData, GapCategory, GeneratedQuestion, CanonicalExample, CEFRLevel } from '@/types';
import { generateText } from '@rork-ai/toolkit-sdk';
import { repairAIQuestion } from '@/utils/aiResponseRepair';

interface ExtractionResult {
  conceptLabel: string;
  teachingFocus: string;
  category: GapCategory;
  cefrLevel?: CEFRLevel;
  canonicalExamples: CanonicalExample[];
  questions: GeneratedQuestion[];
}

const EXTRACTION_PROMPT = `# ROLE: Senior AI Language Tutor

# CONTEXT
You are an expert AI language tutor for a French learning app. Your task is to analyze a learner's "gap" and create a structured, pedagogically sound learning object from it.

# PROCESS

## Step 1: Concept Identification
- Identify the single, core linguistic concept the learner is struggling with.
- Output a short, clear conceptLabel (e.g., "French negation with rien", "Passé composé vs imparfait").
- Infer what the learner was TRYING to express. Do NOT judge the attempt as "invalid".

## Step 2: Teaching Focus
- Write a one-sentence teachingFocus explaining the concept clearly.

## Step 3: Canonical Examples
- Generate 2-3 clean, correct, native-speaker-quality example sentences demonstrating the concept.
- These must be grammatically correct and diverse in context (different subjects, verbs, situations).
- NEVER reuse the learner's original incorrect phrase.

## Step 4: CEFR Level Assessment
- Classify the linguistic concept according to CEFR levels (A1, A2, B1, B2, C1, C2).
- Output a single cefrLevel string.
- Guidelines:
  - A1: Basic greetings, simple present tense, articles, numbers, common nouns
  - A2: Past tense basics, reflexive verbs, comparatives, prepositions
  - B1: Subjunctive basics, conditional, relative pronouns, idiomatic expressions
  - B2: Complex subjunctive, literary tenses, nuanced register shifts
  - C1: Stylistic refinement, rare constructions, advanced idioms
  - C2: Near-native nuance, literary French, very rare structures

## Step 5: Practice Question Generation
- Generate practice questions based on the CEFR level:
  - For A1/A2 concepts: generate 3-4 questions
  - For B1+ concepts: generate 5-6 questions
- CRITICAL: Do NOT reuse the learner's original incorrect phrase in any question.
- Each question MUST use a DIFFERENT sentence context (different subjects, verbs, situations).

SPECIAL MODES:
- If "isFluencySuggestion" is true: This is NOT an error. Phrase questions positively ("A more natural way to say...", "Which phrase sounds more fluent?").
- If sourceType is "listening": Generate comprehension-focused questions ("What does this phrase mean?", "Translate what you heard").

ALLOWED QUESTION TYPES:
- multiple_choice: Meaning/comprehension OR choose correct form. The "choices" array MUST contain the "correctAnswer" exactly. Provide 3-4 total choices. For English meaning questions: ALL choices in English. For French form questions: ALL choices in French.
- fill_blank: Sentence completion with missing word
- correction: Fix a deliberately flawed sentence YOU create
- translation: Translate English to French using the concept
- production: Type the correct French form

# OUTPUT FORMAT
Respond with a single, valid JSON object:
{
  "conceptLabel": "Brief concept name",
  "teachingFocus": "One sentence explaining the concept",
  "category": "vocabulary" | "grammar" | "pronunciation" | "phrasing" | "register",
  "cefrLevel": "A1" | "A2" | "B1" | "B2" | "C1" | "C2",
  "canonicalExamples": [
    { "french": "Correct French sentence", "english": "English translation" }
  ],
  "questions": [
    {
      "type": "multiple_choice" | "fill_blank" | "correction" | "translation" | "production",
      "question": "The question text",
      "correctAnswer": "The correct answer",
      "choices": ["option1", "option2", "option3", "option4"],
      "hint": "A helpful hint"
    }
  ]
}

# INPUT
Learner's French attempt: "{frenchAttempt}"
What they intended (English): "{englishIntent}"
Error context: "{explanation}"
Category: {category}
Source type: {sourceType}
Is fluency suggestion (not an error): {isFluencySuggestion}

# QUESTION GENERATION RULES
- Every generated question MUST be a SPECIFIC language question, never a vague meta-question.
- BAD examples (NEVER do this): "Is this rule correct?", "Do you understand this concept?", "Is this right?", "True or false about this rule?"
- GOOD examples: "What does [specific French word] mean?", "Which sentence uses the [specific grammar rule] correctly?", "Fill in: Je ___ au magasin (aller, present tense)"
- Every question MUST have all structural fields filled:
  - For multiple_choice: "choices" must be an array of 3-4 non-empty strings, "correctAnswer" must be a string that EXACTLY matches one choice.
  - For fill_blank: "question" must contain a sentence with ___, "correctAnswer" is the missing word.
  - For correction: "question" has the incorrect sentence, "correctAnswer" has the corrected version.
  - For translation: "question" has the text to translate, "correctAnswer" has the translation.
  - For production: "question" has the prompt, "correctAnswer" has the expected response.
- Questions must test the SPECIFIC concept being extracted, using the ACTUAL French words/phrases from the user's encounter.
- "hint" should be helpful but not reveal the answer. If unsure, use "Think about the meaning carefully."

# QUALITY CHECK (STRICT)
Before finalizing, verify:
- Every multiple_choice question has correctAnswer inside choices
- All French examples are grammatically correct
- Questions teach the CONCEPT using VARIED contexts, not the original phrase
- Mix of recognition and production question types
- Each question uses different subject/verb combinations
- NO question repeats the learner's exact original attempt
- cefrLevel is appropriate for the concept complexity
- NO question text is a vague meta-question like "Is this correct?"`;

function normalizeForComparison(text: string): string {
  return text
    .toLowerCase()
    .replace(/[''`]/g, "'")
    .replace(/[""]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractKeyPhrases(text: string): string[] {
  const normalized = normalizeForComparison(text);
  const words = normalized.split(/\s+/).filter(w => w.length > 2);
  
  const phrases: string[] = [];
  for (let i = 0; i < words.length - 1; i++) {
    phrases.push(words.slice(i, i + 2).join(' '));
    if (i < words.length - 2) {
      phrases.push(words.slice(i, i + 3).join(' '));
    }
  }
  return phrases;
}

function textContainsOriginalAttempt(
  text: string,
  originalAttempt: string,
  originalPhrases: string[]
): boolean {
  const normalizedOriginal = normalizeForComparison(originalAttempt);
  const normalizedText = normalizeForComparison(text);
  
  if (normalizedText.includes(normalizedOriginal)) {
    return true;
  }
  
  let matchCount = 0;
  for (const phrase of originalPhrases) {
    if (normalizedText.includes(phrase)) {
      matchCount++;
    }
  }
  
  return matchCount >= 2;
}

function questionContainsOriginalAttempt(
  question: GeneratedQuestion,
  originalAttempt: string
): boolean {
  if (!originalAttempt || originalAttempt.length < 5) return false;
  
  const originalPhrases = extractKeyPhrases(originalAttempt)
    .filter(p => p.split(' ').length >= 2);
  
  if (textContainsOriginalAttempt(question.question, originalAttempt, originalPhrases)) {
    return true;
  }
  
  if (textContainsOriginalAttempt(question.correctAnswer, originalAttempt, originalPhrases)) {
    return true;
  }
  
  if (question.choices && Array.isArray(question.choices)) {
    for (const choice of question.choices) {
      if (textContainsOriginalAttempt(choice, originalAttempt, originalPhrases)) {
        return true;
      }
    }
  }
  
  return false;
}

function extractSubjectVerb(text: string): string {
  const normalized = normalizeForComparison(text);
  
  const subjectPatterns = [
    /\b(je|j'|tu|il|elle|on|nous|vous|ils|elles)\b/i,
  ];
  
  const verbPatterns = [
    /\b(ai|as|a|avons|avez|ont)\s+(\w+)/i,
    /\b(suis|es|est|sommes|êtes|sont)\s+(\w+)/i,
    /\b(veux|voulais|voulu|voudrait|veut|voulons|voulez|veulent)\b/i,
    /\b(peux|pouvais|pu|pourrait|peut|pouvons|pouvez|peuvent)\b/i,
    /\b(fais|faisais|fait|fera|ferait|faisons|faites|font)\b/i,
    /\b(dis|disais|dit|dira|dirait|disons|dites|disent)\b/i,
  ];
  
  let subject = '';
  for (const pattern of subjectPatterns) {
    const match = normalized.match(pattern);
    if (match) {
      subject = match[1].toLowerCase();
      break;
    }
  }
  
  let verb = '';
  for (const pattern of verbPatterns) {
    const match = normalized.match(pattern);
    if (match) {
      verb = match[1].toLowerCase();
      break;
    }
  }
  
  return `${subject}-${verb}`;
}

function ensureQuestionDiversity(questions: GeneratedQuestion[]): GeneratedQuestion[] {
  const seenPatterns = new Set<string>();
  const diverse: GeneratedQuestion[] = [];
  
  for (const q of questions) {
    const normalized = normalizeForComparison(q.question);
    const firstWords = normalized.split(/\s+/).slice(0, 6).join(' ');
    
    const subjectVerb = extractSubjectVerb(q.question + ' ' + q.correctAnswer);
    
    const patternKey = `${firstWords}|${subjectVerb}`;
    
    const isDuplicate = Array.from(seenPatterns).some(existing => {
      const [existingWords, existingSV] = existing.split('|');
      
      if (existingWords === firstWords) return true;
      
      if (existingSV === subjectVerb && subjectVerb !== '-') return true;
      
      return false;
    });
    
    if (!isDuplicate) {
      seenPatterns.add(patternKey);
      diverse.push(q);
    }
  }
  
  return diverse;
}

export async function extractConceptFromGap(gap: GapItem): Promise<ConceptData | null> {
  const originalAttempt = gap.frenchWord || gap.exampleSentence || '';

  try {
    const filledPrompt = EXTRACTION_PROMPT
      .replace('{frenchAttempt}', originalAttempt)
      .replace('{englishIntent}', gap.englishTranslation || '')
      .replace('{explanation}', gap.explanation || '')
      .replace('{category}', gap.category)
      .replace('{sourceType}', gap.sourceType || 'speech')
      .replace('{isFluencySuggestion}', String(gap.isFluencySuggestion || false));

    const rawResponse = await generateText({
      messages: [{ role: 'user', content: filledPrompt }],
    });

    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[ConceptExtractor] No JSON found in response');
      return null;
    }

    const result: ExtractionResult = JSON.parse(jsonMatch[0]);

    if (!result.conceptLabel || !result.canonicalExamples || !result.questions) {
      console.error('Invalid extraction result structure');
      return null;
    }

    if (!Array.isArray(result.questions) || result.questions.length === 0) {
      console.error('No questions generated by AI');
      return null;
    }

    if (!Array.isArray(result.canonicalExamples) || result.canonicalExamples.length === 0) {
      console.error('No canonical examples generated by AI');
      return null;
    }

    const validQuestionTypes: GeneratedQuestion['type'][] = [
      'multiple_choice', 'fill_blank', 'correction', 'production', 'translation'
    ];

    const repairedQuestions: GeneratedQuestion[] = [];
    for (const q of result.questions) {
      const repaired = repairAIQuestion({
        id: 'ext_' + Date.now().toString(36) + Math.random().toString(36).substr(2),
        type: q.type,
        conceptId: '',
        content: q.question,
        correctAnswer: q.correctAnswer,
        choices: q.choices,
        hint: q.hint,
      });
      if (repaired) {
        repairedQuestions.push({
          type: repaired.type as GeneratedQuestion['type'],
          question: repaired.content,
          correctAnswer: repaired.correctAnswer,
          choices: repaired.choices,
          hint: repaired.hint,
        });
      }
    }

    const filteredQuestions = repairedQuestions
      .filter(q => 
        q.question && 
        q.correctAnswer && 
        validQuestionTypes.includes(q.type as GeneratedQuestion['type']) &&
        q.question.length > 5 &&
        q.correctAnswer.length > 0 &&
        !questionContainsOriginalAttempt(q, originalAttempt)
      );

    const diverseQuestions = ensureQuestionDiversity(filteredQuestions);
    const validatedQuestions = diverseQuestions.slice(0, 8);

    if (validatedQuestions.length === 0) {
      console.error('No valid questions after validation - all contained original attempt or lacked diversity');
      return null;
    }

    const validatedExamples = result.canonicalExamples
      .filter(ex => ex.french && ex.english && ex.french.length > 2 && ex.english.length > 2)
      .slice(0, 5);

    const validCefrLevels: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    const cefrLevel = validCefrLevels.includes(result.cefrLevel as CEFRLevel) 
      ? result.cefrLevel as CEFRLevel 
      : undefined;

    return {
      conceptLabel: result.conceptLabel.slice(0, 100),
      teachingFocus: (result.teachingFocus || '').slice(0, 200),
      canonicalExamples: validatedExamples,
      questionPool: validatedQuestions.map(q => ({
        type: q.type as GeneratedQuestion['type'],
        question: q.question,
        correctAnswer: q.correctAnswer,
        choices: q.choices,
        hint: q.hint,
      })),
      cefrLevel,
      extractedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error extracting concept:', error);
    return null;
  }
}

export async function extractConceptsForGaps(gaps: GapItem[]): Promise<Map<string, ConceptData>> {
  const results = new Map<string, ConceptData>();
  
  const unstableGaps = gaps.filter(g => 
    g.sourceType !== 'reading' && 
    !g.conceptData &&
    !g.masteredAt
  );

  for (const gap of unstableGaps) {
    const conceptData = await extractConceptFromGap(gap);
    if (conceptData) {
      results.set(gap.id, conceptData);
    }
  }

  return results;
}

export async function reExtractConceptsForAllGaps(
  gaps: GapItem[], 
  forceRefresh: boolean = false
): Promise<Map<string, ConceptData>> {
  const results = new Map<string, ConceptData>();
  
  const gapsToProcess = gaps.filter(g => 
    g.sourceType !== 'reading' && 
    !g.masteredAt &&
    (forceRefresh || !g.conceptData)
  );

  for (const gap of gapsToProcess) {
    const conceptData = await extractConceptFromGap(gap);
    if (conceptData) {
      results.set(gap.id, conceptData);
    }
  }

  return results;
}

export function isEnglishText(text: string): boolean {
  if (!text || text.length < 3) return false;
  
  const frenchIndicators = [
    /\bje\b/i, /\btu\b/i, /\bil\b/i, /\belle\b/i, /\bnous\b/i, /\bvous\b/i, /\bils\b/i,
    /\ble\b/i, /\bla\b/i, /\bles\b/i, /\bun\b/i, /\bune\b/i, /\bdes\b/i,
    /\best\b/i, /\bsont\b/i, /\bêtre\b/i, /\bavoir\b/i,
    /\bne\b.*\bpas\b/i, /\bne\b.*\brien\b/i, /\bne\b.*\bjamais\b/i,
    /\bpour\b/i, /\bavec\b/i, /\bdans\b/i, /\bsur\b/i,
    /\bqu[ie]/i, /\bque\b/i, /\bqui\b/i,
    /[éèêëàâäùûüôöîïç]/i,
  ];

  let frenchScore = 0;
  for (const pattern of frenchIndicators) {
    if (pattern.test(text)) {
      frenchScore++;
    }
  }

  return frenchScore < 3;
}

export function validateGapFields(gap: Partial<GapItem>): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  if (gap.englishTranslation && !isEnglishText(gap.englishTranslation)) {
    issues.push('englishTranslation contains French text');
  }

  if (!gap.frenchWord || gap.frenchWord.length < 1) {
    issues.push('frenchWord is missing or empty');
  }

  if (!gap.englishTranslation || gap.englishTranslation.length < 1) {
    issues.push('englishTranslation is missing or empty');
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}
