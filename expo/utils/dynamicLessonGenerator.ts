import { GapItem, ConceptCluster, DynamicLesson, DynamicLessonTeachItem, DynamicLessonQuestion, GapPromptType, Difficulty, WildEncounterInfo } from '@/types';
import { ExercisePerformance, selectExerciseDistribution } from '@/utils/exerciseSelector';
import { generateText } from '@rork-ai/toolkit-sdk';
import { getRecentEncounters, EncounterFrequency } from '@/utils/crossTabTracker';
import { inferContentType, getValidExerciseTypes } from '@/utils/exerciseTypeRouter';
import { buildLearnerProfile, formatProfileForPrompt, buildPedagogicalInstructions, buildScaffoldingInstructions, LearnerProfileSnapshot } from '@/utils/learnerProfileBuilder';
import { validateQuestionBatch } from '@/utils/questionValidator';
import { generateTemplateQuestions } from '@/utils/exerciseTemplates';
import { ensureLessonQuestions } from '@/utils/fallbackChain';
import { repairAILesson } from '@/utils/aiResponseRepair';
import type { AdaptiveLearnerProfile } from '@/types';
import { buildAdaptiveLessonBrief, badgeText } from '@/utils/adaptiveSelector';
import { buildConfusionQuestions } from '@/utils/confusionPairBuilder';
import { getTopConfusionPairs } from '@/utils/confusionModel';
import { buildReExposureQuestion, isGapEligibleForReExposure } from '@/utils/contextReExposure';
import { pickOptionCountForTheta, distractorTightnessForTheta } from '@/utils/irtCalibration';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

const VALID_QUESTION_TYPES: GapPromptType[] = [
  'multiple_choice', 'fill_blank', 'correction', 'translation', 'production',
  'sentence_build', 'spot_the_error', 'true_false', 'match_pairs', 'word_order',
  'tap_what_you_hear', 'listen_and_type', 'speak_to_answer',
];

function tryFastGeneration(cluster: ConceptCluster, gaps: GapItem[]): DynamicLesson | null {
  const clusterGaps = gaps.filter(g => cluster.gapIds.includes(g.id));
  const gapsWithConcepts = clusterGaps.filter(
    g => g.conceptData?.questionPool && g.conceptData.questionPool.length > 0
  );

  if (gapsWithConcepts.length === 0) return null;

  const teachItems: DynamicLessonTeachItem[] = [];
  const seenFocuses = new Set<string>();

  for (const gap of gapsWithConcepts) {
    if (gap.conceptData?.teachingFocus && !seenFocuses.has(gap.conceptData.teachingFocus)) {
      seenFocuses.add(gap.conceptData.teachingFocus);
      teachItems.push({ type: 'explanation', content: gap.conceptData.teachingFocus });
    }

    if (gap.conceptData?.canonicalExamples) {
      for (const example of gap.conceptData.canonicalExamples.slice(0, 2)) {
        teachItems.push({
          type: 'example',
          content: '',
          french: example.french,
          english: example.english,
        });
      }
    }
  }

  if (teachItems.length < 2) return null;

  const allQuestions: DynamicLessonQuestion[] = [];

  for (const gap of gapsWithConcepts) {
    if (!gap.conceptData?.questionPool) continue;

    for (const q of gap.conceptData.questionPool) {
      if (!VALID_QUESTION_TYPES.includes(q.type as GapPromptType)) continue;

      if (q.type === 'multiple_choice' && q.choices) {
        const hasCorrect = q.choices.some(
          c => c.toLowerCase().trim() === q.correctAnswer.toLowerCase().trim()
        );
        if (!hasCorrect) continue;
      }

      allQuestions.push({
        id: generateId(),
        type: q.type as GapPromptType,
        content: q.question,
        correctAnswer: q.correctAnswer,
        choices: q.choices,
        hint: q.hint,
        relatedGapId: gap.id,
      });
    }

    const frenchWord = gap.frenchWord;
    const englishTranslation = gap.englishTranslation;
    const exampleSentence = gap.exampleSentence || '';

    if (exampleSentence) {
      const sentenceWords = exampleSentence.split(/\s+/);
      if (sentenceWords.length >= 3) {
        allQuestions.push({
          id: generateId(),
          type: 'sentence_build',
          content: `Build the sentence: "${gap.exampleTranslation || englishTranslation}"`,
          correctAnswer: exampleSentence,
          words: shuffleArray(sentenceWords),
          hint: `Uses "${frenchWord}"`,
          relatedGapId: gap.id,
        });

        allQuestions.push({
          id: generateId(),
          type: 'word_order',
          content: `Arrange these words into a correct French sentence:`,
          correctAnswer: exampleSentence,
          scrambledWords: shuffleArray(sentenceWords),
          hint: `Translation: "${gap.exampleTranslation || englishTranslation}"`,
          relatedGapId: gap.id,
        });
      }
    }

    allQuestions.push({
      id: generateId(),
      type: 'true_false',
      content: `"${frenchWord}" means "${englishTranslation}"`,
      correctAnswer: 'true',
      statement: `"${frenchWord}" means "${englishTranslation}"`,
      isTrue: true,
      hint: gap.explanation || undefined,
      relatedGapId: gap.id,
    });

    if (gap.exampleTranslation) {
      allQuestions.push({
        id: generateId(),
        type: 'translation',
        content: `Translate to French: "${gap.exampleTranslation}"`,
        correctAnswer: exampleSentence || frenchWord,
        sourceText: gap.exampleTranslation,
        targetLanguage: 'French',
        acceptableAnswers: [exampleSentence, frenchWord].filter(Boolean),
        hint: `Use "${frenchWord}"`,
        relatedGapId: gap.id,
      });
    }

    if (exampleSentence && exampleSentence.split(/\s+/).length >= 3) {
      allQuestions.push({
        id: generateId(),
        type: 'listen_and_type',
        content: 'Listen and type what you hear',
        correctAnswer: exampleSentence,
        listenText: exampleSentence,
        hint: `This sentence uses "${frenchWord}"`,
        relatedGapId: gap.id,
      });
    }

    if (gap.exampleTranslation) {
      allQuestions.push({
        id: generateId(),
        type: 'speak_to_answer',
        content: gap.exampleTranslation || englishTranslation,
        correctAnswer: exampleSentence || frenchWord,
        englishPrompt: gap.exampleTranslation || englishTranslation,
        expectedFrench: exampleSentence || frenchWord,
        hint: `Use "${frenchWord}"`,
        relatedGapId: gap.id,
      });
    }
  }

  if (gapsWithConcepts.length >= 2) {
    const pairGaps = gapsWithConcepts.slice(0, 4);
    if (pairGaps.length >= 2) {
      allQuestions.push({
        id: generateId(),
        type: 'match_pairs',
        content: 'Match the French words to their English translations',
        correctAnswer: pairGaps.map(g => `${g.frenchWord}=${g.englishTranslation}`).join(','),
        pairs: pairGaps.map(g => ({ left: g.frenchWord, right: g.englishTranslation })),
        hint: 'Match each word to its meaning',
      });
    }
  }

  if (allQuestions.length < 4) return null;

  const shuffled = shuffleArray(allQuestions);

  const practiceTypes: GapPromptType[] = ['multiple_choice', 'fill_blank', 'correction', 'true_false', 'spot_the_error', 'tap_what_you_hear'];
  const challengeTypes: GapPromptType[] = ['translation', 'production', 'sentence_build', 'match_pairs', 'word_order'];

  const practiceItems = shuffled.filter(q => practiceTypes.includes(q.type));
  const challengeItems = shuffled.filter(q => challengeTypes.includes(q.type));

  if (challengeItems.length < 2 && practiceItems.length > 4) {
    challengeItems.push(...practiceItems.splice(practiceItems.length - 2, 2));
  }

  if (practiceItems.length < 3 && challengeItems.length > 2) {
    practiceItems.unshift(...challengeItems.splice(0, 2));
  }

  console.log('[DynamicLessonGen] Fast path:', teachItems.length, 'teach,', practiceItems.length, 'practice,', challengeItems.length, 'challenge');

  return {
    id: generateId(),
    clusterId: cluster.id,
    title: cluster.name,
    subtitle: cluster.description,
    teachItems: teachItems.slice(0, 6),
    practiceItems: practiceItems.slice(0, 8),
    challengeItems: challengeItems.slice(0, 5),
    createdAt: new Date().toISOString(),
  };
}

const EXERCISE_FORMAT_RULES = `=== CRITICAL OUTPUT RULES (READ FIRST) ===
- You MUST output valid JSON and NOTHING else. No markdown, no commentary, no explanation outside the JSON.
- Every question MUST have ALL required fields filled with real content. An empty string "" is NOT valid content.
- Every multiple_choice question MUST have a "choices" array with EXACTLY 4 items, and "correctAnswer" must be a STRING that EXACTLY matches one of the choices.
- Every true_false question MUST have "correctAnswer" as either "true" or "false" (lowercase string), plus a "statement" field with a declarative claim (NOT a question).
- Every fill_blank question MUST have a "content" field containing a sentence with ___ (triple underscore) in it, AND a "correctAnswer" field with the word that fills the blank.
- NEVER generate a question where the question text is a vague meta-question like "Is this correct?", "Is this rule right?", "Do you know this?". Every question must ask about SPECIFIC French language content.
- NEVER generate a question with zero or missing choices/options when the type requires them.
- No two choices in a multiple_choice question may be identical.
- The correctAnswer MUST actually appear in the choices array for multiple_choice.

=== EXERCISE TYPE SPECIFICATIONS ===

multiple_choice:
  Required: type, content (clear specific question, min 10 chars), choices (array of exactly 4 non-empty strings), correctAnswer (string matching one choice exactly), explanation (1-2 sentences), hint
  Example: { "type": "multiple_choice", "content": "What does 'la maison' mean in English?", "choices": ["the house", "the car", "the book", "the garden"], "correctAnswer": "the house", "hint": "Think about where you live", "explanation": "'La maison' means 'the house' in French." }

fill_blank:
  Required: type, content (sentence with exactly one ___), correctAnswer (the missing word), explanation, hint
  Example: { "type": "fill_blank", "content": "Je ___ au magasin hier.", "correctAnswer": "suis allé", "hint": "Past tense of aller with être", "explanation": "With movement verbs, use être in passé composé." }

true_false:
  Required: type, content (a DECLARATIVE STATEMENT to evaluate, NOT a question), correctAnswer ("true" or "false"), statement (same as content), isTrue (boolean), explanation, hint
  The statement must be a specific claim about French. Mix true and false statements roughly evenly.
  Example: { "type": "true_false", "content": "'Le chat' means 'the cat' in English.", "statement": "'Le chat' means 'the cat' in English.", "correctAnswer": "true", "isTrue": true, "hint": "Think about common animals", "explanation": "'Le chat' indeed means 'the cat'." }

word_order:
  Required: type, content (instruction or translation hint), scrambledWords (array of shuffled words), correctAnswer (correct sentence), explanation, hint

sentence_build:
  Required: type, content (instruction), words (array of word tiles, shuffled), correctAnswer (the built sentence), explanation, hint

spot_the_error:
  Required: type, content ("Find and fix the error"), errorSentence (sentence WITH one error), correctedSentence (correct version), correctAnswer (same as correctedSentence), explanation, hint

match_pairs:
  Required: type, content (instruction), pairs (array of 4 {left, right} objects), correctAnswer (summary), explanation, hint

translation:
  Required: type, content ("Translate to French/English: ..."), correctAnswer (the translation), sourceText, targetLanguage, acceptableAnswers (array), explanation, hint

production:
  Required: type, content (prompt asking learner to write), correctAnswer (example correct response), acceptableAnswers (array), explanation, hint

listen_and_type:
  Required: type, content ("Listen and type what you hear"), correctAnswer (French text), listenText (same as correctAnswer), audioText (same), explanation, hint

speak_to_answer:
  Required: type, content (English prompt), correctAnswer (expected French), englishPrompt, expectedFrench, explanation, hint

=== CONTENT QUALITY RULES ===
- All French text must be grammatically correct with proper accents (é, è, ê, ë, à, â, ç, ù, û, ü, ô, î, ï).
- Every question must use the SPECIFIC vocabulary or grammar concept from the gap data. If the gap is about "découvert", the question MUST involve "découvert".
- Explanations must be 1-2 sentences explaining WHY the answer is correct. Never empty.
- Hints should nudge without revealing the answer. Use "Think about the meaning carefully." if stuck.
- Difficulty must match the CEFR level. Don't repeat the same question structure across questions.
- Practice section: use at least 3 different question types. Challenge section: use at least 2 different types.`;

const JSON_OUTPUT_TEMPLATE = `OUTPUT (valid JSON only, no markdown, no code blocks).
Here is an EXAMPLE of correct structure with real values:
{
  "title": "Mastering French Greetings",
  "subtitle": "Learn essential French greeting phrases",
  "teach": [
    { "type": "explanation", "content": "In French, greetings change based on the time of day and formality level. 'Bonjour' is used during the day, while 'bonsoir' is for evenings." },
    { "type": "example", "french": "Bonjour, comment allez-vous ?", "english": "Hello, how are you?" },
    { "type": "example", "french": "Bonsoir, enchanté de vous rencontrer.", "english": "Good evening, pleased to meet you." },
    { "type": "tip", "content": "Remember: 'Bonjour' literally means 'good day' — use it from morning until late afternoon." }
  ],
  "practice": [
    { "type": "multiple_choice", "content": "What does 'bonjour' mean in English?", "choices": ["good morning/hello", "goodbye", "good night", "thank you"], "correctAnswer": "good morning/hello", "hint": "Think about what you say when you first see someone", "explanation": "'Bonjour' is the standard French greeting meaning 'hello' or 'good morning'." },
    { "type": "true_false", "content": "'Bonsoir' is used as a greeting in the evening.", "statement": "'Bonsoir' is used as a greeting in the evening.", "correctAnswer": "true", "isTrue": true, "hint": "Think about the word 'soir'", "explanation": "'Soir' means 'evening', so 'bonsoir' means 'good evening'." },
    { "type": "fill_blank", "content": "___, comment allez-vous ?", "correctAnswer": "Bonjour", "hint": "A standard French greeting", "explanation": "'Bonjour' is the appropriate greeting to begin a polite conversation." }
  ],
  "challenge": [
    { "type": "translation", "content": "Translate to French: 'Good evening, how are you?'", "correctAnswer": "Bonsoir, comment allez-vous ?", "sourceText": "Good evening, how are you?", "targetLanguage": "French", "acceptableAnswers": ["Bonsoir, comment allez-vous ?", "Bonsoir, comment vas-tu ?"], "hint": "Use the formal greeting", "explanation": "'Bonsoir' for evening + 'comment allez-vous' for the formal 'how are you'." },
    { "type": "production", "content": "Write a French greeting you would use when meeting someone in the morning.", "correctAnswer": "Bonjour", "acceptableAnswers": ["Bonjour", "Bonjour, comment allez-vous ?", "Bonjour, enchanté"], "hint": "Think about the time of day", "explanation": "'Bonjour' is the standard morning/daytime greeting." }
  ]
}

This is an EXAMPLE of correct structure only. Generate content about the learner's specific gaps described above, NOT about the example topic. Follow this EXACT structure. Every field shown is REQUIRED.`;

function buildAdaptivePrompt(
  profile: LearnerProfileSnapshot | null,
  conceptName: string,
  category: string,
  cefrLevel: string,
  description: string,
  contentType: string,
  validExerciseTypes: string[],
  gapDetails: string,
  exerciseHint: string,
): string {
  const sections: string[] = [];

  sections.push(`[SECTION 1 — SYSTEM ROLE]
You are an expert French language tutor with deep knowledge of second-language acquisition. You adapt your teaching to each individual learner based on their performance data. You never generate generic exercises — every question you create has a specific pedagogical purpose tied to this learner's needs.`);

  sections.push(`[SECTION 2 — LEARNER PROFILE]`);
  if (profile) {
    sections.push(formatProfileForPrompt(profile));
  } else {
    sections.push(`No learner profile data available yet — this is an early session. Generate a balanced mix of exercise types to establish a baseline.`);
  }

  sections.push(`CONCEPT: ${conceptName}
CATEGORY: ${category}
CEFR LEVEL: ${cefrLevel}
DESCRIPTION: ${description}
CONTENT TYPE: ${contentType}`);

  if (gapDetails) {
    sections.push(`The learner has these specific gaps (words/phrases they struggle with):
${gapDetails}`);
  }

  if (exerciseHint) {
    sections.push(exerciseHint);
  }

  sections.push(`[SECTION 3 — PEDAGOGICAL INSTRUCTIONS]`);
  if (profile) {
    sections.push(buildPedagogicalInstructions(profile));
  } else {
    sections.push(`Generate a balanced introductory lesson. Use a variety of recognition and production exercises. Start with easier types and build toward harder ones.`);
  }

  sections.push(`[SECTION 4 — SCAFFOLDING INSTRUCTIONS]`);
  if (profile) {
    sections.push(buildScaffoldingInstructions(profile));
  } else {
    sections.push(`Order exercises from easy to hard. Start with 2-3 recognition exercises (multiple_choice, true_false). Then 2-3 intermediate exercises (fill_blank, word_order). End with 2-3 production challenges (translation, production, sentence_build).`);
  }

  sections.push(`EXERCISE TYPE RESTRICTION (MUST FOLLOW):
For this content type (${contentType}), ONLY use these exercise types: ${validExerciseTypes.join(', ')}
Do NOT use any exercise types not in the above list. Match the CEFR ${cefrLevel} level in difficulty.`);

  sections.push(`[SECTION 5 — EXERCISE FORMAT AND JSON OUTPUT]`);
  sections.push(`Generate a structured JSON lesson with exactly three sections (teach, practice, challenge). The lesson should teach the BROADER CONCEPT, not just the specific gap items. Use the gap items as starting points but expand to cover the full concept.\nUse a MIX of at least 4 different question types across practice and challenge sections.`);
  sections.push(EXERCISE_FORMAT_RULES);
  sections.push(JSON_OUTPUT_TEMPLATE);

  sections.push(`=== FINAL CHECKLIST (verify before outputting) ===
1. Is the output valid JSON? No trailing commas, no comments, all strings properly quoted?
2. Does every multiple_choice question have exactly 4 choices and a correctAnswer string that matches one choice?
3. Does every true_false question have correctAnswer "true" or "false" and a statement that is a declarative claim?
4. Does every fill_blank question have content with ___ and a non-empty correctAnswer?
5. Is every question text a SPECIFIC language question (not a vague 'is this correct?' type)?
6. Does every question have a non-empty explanation?
7. Are there at least 3 different exercise types used across the lesson?
8. Does every question use the actual French vocabulary/grammar from the learner's gap data?
If any check fails, fix it before outputting.`);

  return sections.join('\n\n');
}

async function generateWithAI(
  cluster: ConceptCluster,
  gaps: GapItem[],
  exerciseHint?: string,
  exercisePerformance?: ExercisePerformance,
): Promise<DynamicLesson | null> {
  const clusterGaps = gaps.filter(g => cluster.gapIds.includes(g.id));

  const gapDetails = clusterGaps.slice(0, 8).map(g =>
    `- "${g.frenchWord}" (${g.englishTranslation})${g.explanation ? ` — ${g.explanation}` : ''}`
  ).join('\n');

  const cefrLevel = cluster.cefrLevel || 'A2';

  const contentType = cluster.contentType || inferContentType(
    cluster.category,
    cluster.description,
    clusterGaps[0]?.frenchWord || '',
  );
  const validTypes = getValidExerciseTypes(contentType);

  console.log('[DynamicLessonGen] contentType:', contentType, 'validTypes:', validTypes.join(','));

  let profile: LearnerProfileSnapshot | null = null;
  try {
    const conceptId = clusterGaps[0]?.id || cluster.id;
    profile = await buildLearnerProfile(
      conceptId, cefrLevel, clusterGaps, exercisePerformance,
    );
    console.log('[DynamicLessonGen] Built learner profile — accuracy:', profile.conceptAccuracy,
      'attempts:', profile.conceptAttemptCount,
      'strong:', profile.strongExerciseTypes.join(','),
      'weak:', profile.weakExerciseTypes.join(','),
      'errors:', profile.recentErrors.length,
      'patterns:', profile.commonMistakePatterns.map(p => p.errorType).join(','),
    );
  } catch (e) {
    console.warn('[DynamicLessonGen] Failed to build learner profile, using default:', e);
  }

  const prompt = buildAdaptivePrompt(
    profile,
    cluster.name,
    cluster.category,
    cefrLevel,
    cluster.description,
    contentType,
    validTypes,
    gapDetails,
    exerciseHint || '',
  );

  try {
    console.log('[DynamicLessonGen] AI generation for:', cluster.name);

    const rawResponse = await generateText({
      messages: [{ role: 'user', content: prompt }],
    });

    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[DynamicLessonGen] No JSON in response');
      return null;
    }

    const rawResult = JSON.parse(jsonMatch[0]);

    if (!rawResult.teach && !rawResult.practice) {
      console.error('[DynamicLessonGen] Invalid structure');
      return null;
    }

    const repaired = repairAILesson(rawResult);

    const teachItems: DynamicLessonTeachItem[] = (repaired.teach || [])
      .filter((item: any) => item.type && (item.content || item.french))
      .map((item: any) => ({
        type: item.type as 'explanation' | 'example' | 'tip',
        content: item.content || '',
        french: item.french,
        english: item.english,
      }));

    const mapQuestions = (items: any[]): DynamicLessonQuestion[] => {
      const mapped = (items || [])
        .filter((item: any) => item.type && VALID_QUESTION_TYPES.includes(item.type))
        .map((item: any) => ({
          id: generateId(),
          type: item.type as GapPromptType,
          content: item.content || item.question || '',
          correctAnswer: item.correctAnswer || '',
          choices: item.choices ? shuffleArray(item.choices) : undefined,
          hint: item.hint,
          words: item.words,
          errorSentence: item.errorSentence,
          correctedSentence: item.correctedSentence,
          pairs: item.pairs,
          scrambledWords: item.scrambledWords,
          statement: item.statement,
          isTrue: item.isTrue,
          sourceText: item.sourceText,
          targetLanguage: item.targetLanguage,
          acceptableAnswers: item.acceptableAnswers,
          listenText: item.listenText,
          englishPrompt: item.englishPrompt,
          expectedFrench: item.expectedFrench,
          audioText: item.listenText || item.audioText,
        }));
      return validateQuestionBatch(mapped) as DynamicLessonQuestion[];
    };

    const practiceItems = mapQuestions(repaired.practice);
    const challengeItems = mapQuestions(repaired.challenge);

    if (teachItems.length === 0 && practiceItems.length === 0 && challengeItems.length === 0) {
      console.error('[DynamicLessonGen] No valid items after validation');
      return null;
    }

    console.log('[DynamicLessonGen] AI generated (post-validation):', teachItems.length, 'teach,', practiceItems.length, 'practice,', challengeItems.length, 'challenge');

    return {
      id: generateId(),
      clusterId: cluster.id,
      title: rawResult.title || cluster.name,
      subtitle: rawResult.subtitle || cluster.description,
      teachItems,
      practiceItems,
      challengeItems,
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[DynamicLessonGen] Error:', error);
    return null;
  }
}

function buildTemplateFallbackLesson(
  cluster: ConceptCluster,
  gaps: GapItem[],
): DynamicLesson | null {
  const clusterGaps = gaps.filter(g => cluster.gapIds.includes(g.id));
  if (clusterGaps.length === 0) return null;

  const activeGaps = gaps.filter(g => !g.masteredAt);
  const allQuestions: DynamicLessonQuestion[] = [];

  for (const gap of clusterGaps.slice(0, 6)) {
    const templateQ = generateTemplateQuestions(gap, activeGaps, 5);
    for (const q of templateQ) {
      allQuestions.push({
        id: q.id,
        type: q.type as any,
        content: q.content,
        correctAnswer: q.correctAnswer,
        choices: q.choices,
        hint: q.hint,
        relatedGapId: gap.id,
        words: q.wordBank,
        scrambledWords: q.scrambledWords,
        errorSentence: q.errorSentence,
        correctedSentence: q.correctedSentence,
        pairs: q.pairs?.map(p => ({ left: p.french, right: p.english })),
        statement: q.statement,
        isTrue: q.isTrue,
        audioText: q.audioText,
      });
    }
  }

  if (allQuestions.length < 4) return null;

  const teachItems: DynamicLessonTeachItem[] = clusterGaps.slice(0, 3).map(g => ({
    type: 'explanation' as const,
    content: g.explanation || `"${g.frenchWord}" means "${g.englishTranslation}".`,
    french: g.exampleSentence || g.frenchWord,
    english: g.exampleTranslation || g.englishTranslation,
  }));

  const practiceTypes = new Set(['multiple_choice', 'fill_blank', 'correction', 'true_false', 'spot_the_error', 'match_pairs']);
  const practiceItems = allQuestions.filter(q => practiceTypes.has(q.type));
  const challengeItems = allQuestions.filter(q => !practiceTypes.has(q.type));

  console.log('[DynamicLessonGen] Template fallback:', teachItems.length, 'teach,', practiceItems.length, 'practice,', challengeItems.length, 'challenge');

  return {
    id: generateId(),
    clusterId: cluster.id,
    title: cluster.name,
    subtitle: cluster.description,
    teachItems: teachItems.slice(0, 6),
    practiceItems: practiceItems.slice(0, 8),
    challengeItems: challengeItems.slice(0, 5),
    createdAt: new Date().toISOString(),
  };
}

function normalizeForMatch(word: string): string {
  return word
    .toLowerCase()
    .replace(/[.,;:!?'"()«»\-…\d]/g, '')
    .trim();
}

function findEncounterForQuestion(
  question: DynamicLessonQuestion,
  encounters: EncounterFrequency[],
  gaps: GapItem[],
): WildEncounterInfo | undefined {
  const wordsToCheck: string[] = [];

  if (question.relatedGapId) {
    const gap = gaps.find(g => g.id === question.relatedGapId);
    if (gap) {
      wordsToCheck.push(normalizeForMatch(gap.frenchWord));
      if (gap.englishTranslation) wordsToCheck.push(normalizeForMatch(gap.englishTranslation));
    }
  }

  const contentWords = question.correctAnswer.split(/\s+/).filter(w => w.length > 3);
  for (const w of contentWords) {
    wordsToCheck.push(normalizeForMatch(w));
  }

  for (const encounter of encounters) {
    const encWord = normalizeForMatch(encounter.word);
    if (wordsToCheck.includes(encWord)) {
      const daysAgo = Math.max(
        0,
        Math.floor((Date.now() - new Date(encounter.lastSeen).getTime()) / (1000 * 60 * 60 * 24))
      );
      return {
        sourceTab: encounter.sources[0],
        context: encounter.contexts[0] || '',
        daysAgo,
        contentId: encounter.word,
      };
    }
  }

  return undefined;
}

async function annotateWithEncounters(
  lesson: DynamicLesson,
  gaps: GapItem[],
): Promise<DynamicLesson> {
  try {
    const encounters = await getRecentEncounters(14);
    if (encounters.length === 0) {
      console.log('[DynamicLessonGen] No recent cross-tab encounters found');
      return lesson;
    }

    console.log('[DynamicLessonGen] Found', encounters.length, 'recent cross-tab encounters, annotating lesson...');
    let connectedCount = 0;

    const annotateQuestions = (questions: DynamicLessonQuestion[]): DynamicLessonQuestion[] =>
      questions.map(q => {
        const encounter = findEncounterForQuestion(q, encounters, gaps);
        if (encounter) {
          connectedCount++;
          return { ...q, wildEncounter: encounter };
        }
        return q;
      });

    const annotated: DynamicLesson = {
      ...lesson,
      practiceItems: annotateQuestions(lesson.practiceItems),
      challengeItems: annotateQuestions(lesson.challengeItems),
      connectedWordsCount: connectedCount,
    };

    console.log('[DynamicLessonGen] Annotated', connectedCount, 'questions with wild encounters');
    return annotated;
  } catch (e) {
    console.error('[DynamicLessonGen] Failed to annotate encounters:', e);
    return lesson;
  }
}

function buildAdaptiveBriefSection(adaptive: AdaptiveLearnerProfile | undefined, gaps: GapItem[]): string {
  if (!adaptive) return '';
  const theta = adaptive.abilityTheta;
  const optionCount = pickOptionCountForTheta(theta);
  const tightness = distractorTightnessForTheta(theta);
  const confusionPairs = getTopConfusionPairs(gaps, 3);
  const reExposureGaps = gaps.filter(isGapEligibleForReExposure).slice(0, 2);
  const bestTypeEntries = Object.entries(adaptive.exerciseTypeStats)
    .filter(([, s]) => (s?.attempts ?? 0) >= 3)
    .sort((a, b) => ((b[1]?.correct ?? 0) / Math.max(1, b[1]?.attempts ?? 1)) - ((a[1]?.correct ?? 0) / Math.max(1, a[1]?.attempts ?? 1)));
  const bestTypes = bestTypeEntries.slice(0, 3).map(([t]) => t).join(', ');

  const lines: string[] = ['[ADAPTIVE BRIEF — tuned to this learner]'];
  lines.push(`Ability (θ): ${theta.toFixed(2)} — target each question at ~75% predicted success.`);
  lines.push(`Options per multiple_choice: ${optionCount}. Distractor tightness: ${tightness} (loose=obviously different, tight=subtly similar same-category items).`);
  if (bestTypes) lines.push(`Prefer exercise types with best retention for this learner: ${bestTypes}.`);
  if (confusionPairs.length > 0) {
    lines.push('CONFUSION PAIRS TO TARGET (build at least one contrast question using both sides of a pair):');
    confusionPairs.forEach(p => {
      lines.push(`  - "${p.gapA.frenchWord}" (${p.gapA.englishTranslation}) vs "${p.gapB.frenchWord}" (${p.gapB.englishTranslation}) — confused ${p.wrongPicks}x`);
    });
  }
  if (reExposureGaps.length > 0) {
    lines.push('WILD-CONTEXT RE-EXPOSURE (re-use these exact original sentences in a fill_blank or translation):');
    reExposureGaps.forEach(g => {
      if (g.originalContext) lines.push(`  - from ${g.originalContext.sourceTab}: "${g.originalContext.sentence}" (target word: ${g.frenchWord})`);
    });
  }
  return lines.join('\n');
}

export async function generateDynamicLesson(
  cluster: ConceptCluster,
  gaps: GapItem[],
  exercisePerformance?: ExercisePerformance,
  difficulty?: Difficulty,
  adaptive?: AdaptiveLearnerProfile,
): Promise<DynamicLesson | null> {
  let exerciseHint = '';
  if (exercisePerformance && difficulty) {
    const distribution = selectExerciseDistribution(gaps, exercisePerformance, difficulty);
    exerciseHint = distribution.promptHint;
    console.log('[DynamicLessonGen] Exercise distribution applied for difficulty:', difficulty);
  }

  const clusterGapsForBrief = gaps.filter(g => cluster.gapIds.includes(g.id));
  const adaptiveSection = buildAdaptiveBriefSection(adaptive, clusterGapsForBrief);
  if (adaptiveSection) {
    exerciseHint = [exerciseHint, adaptiveSection].filter(Boolean).join('\n\n');
    console.log('[DynamicLessonGen] Adaptive brief injected, θ=', adaptive?.abilityTheta?.toFixed(2));
  }

  let lesson: DynamicLesson | null = null;

  const fastLesson = tryFastGeneration(cluster, gaps);
  if (fastLesson && fastLesson.practiceItems.length >= 3) {
    lesson = fastLesson;
  } else {
    console.log('[DynamicLessonGen] Fast path insufficient, using AI for:', cluster.name);
    lesson = await generateWithAI(cluster, gaps, exerciseHint, exercisePerformance);
  }

  if (!lesson || (lesson.practiceItems.length + lesson.challengeItems.length) < 4) {
    console.log('[DynamicLessonGen] Insufficient questions, trying template fallback');
    const fallback = buildTemplateFallbackLesson(cluster, gaps);
    if (fallback) {
      lesson = fallback;
    }
  }

  if (lesson) {
    const clusterGaps = gaps.filter(g => cluster.gapIds.includes(g.id));
    const allQuestionsCombined: DynamicLessonQuestion[] = [
      ...lesson.practiceItems,
      ...lesson.challengeItems,
    ];
    const ensured = ensureLessonQuestions(
      clusterGaps,
      allQuestionsCombined as any[],
      Math.max(6, allQuestionsCombined.length),
      { contentType: cluster.contentType, cefrLevel: cluster.cefrLevel },
    );

    const practiceTypes = new Set(['multiple_choice', 'fill_blank', 'correction', 'true_false', 'spot_the_error', 'match_pairs']);
    const ensuredPractice = ensured.filter(q => practiceTypes.has(q.type));
    const ensuredChallenge = ensured.filter(q => !practiceTypes.has(q.type));

    lesson = {
      ...lesson,
      practiceItems: (ensuredPractice.length > 0 ? ensuredPractice : ensured.slice(0, Math.ceil(ensured.length / 2))) as DynamicLessonQuestion[],
      challengeItems: (ensuredChallenge.length > 0 ? ensuredChallenge : ensured.slice(Math.ceil(ensured.length / 2))) as DynamicLessonQuestion[],
    };

    console.log('[DynamicLessonGen] After fallback chain:', lesson.practiceItems.length, 'practice,', lesson.challengeItems.length, 'challenge');

    if (adaptive) {
      const injected: DynamicLessonQuestion[] = [];
      const pairs = getTopConfusionPairs(clusterGaps, 2);
      for (const p of pairs) {
        const qs = buildConfusionQuestions(p, 1);
        for (const q of qs) {
          injected.push({
            id: q.id,
            type: q.type,
            content: q.question,
            correctAnswer: q.correctAnswer,
            choices: q.choices,
            hint: q.hint,
            relatedGapId: q.relatedGapId,
            statement: q.type === 'true_false' ? q.question : undefined,
            isTrue: q.type === 'true_false' ? q.correctAnswer === 'true' : undefined,
          });
        }
      }
      for (const g of clusterGaps.filter(isGapEligibleForReExposure).slice(0, 2)) {
        const rq = buildReExposureQuestion(g);
        if (rq) {
          injected.push({
            id: rq.id,
            type: rq.type,
            content: rq.content,
            correctAnswer: rq.correctAnswer,
            hint: rq.hint,
            relatedGapId: rq.relatedGapId,
            wildEncounter: rq.wildEncounter,
            sourceText: rq.type === 'translation' ? rq.content : undefined,
            targetLanguage: rq.type === 'translation' ? 'English' : undefined,
          });
        }
      }
      if (injected.length > 0) {
        lesson = {
          ...lesson,
          challengeItems: [...injected, ...lesson.challengeItems].slice(0, 6),
        };
        console.log('[DynamicLessonGen] Injected', injected.length, 'adaptive (confusion/re-exposure) questions');
      }
    }

    lesson = await annotateWithEncounters(lesson, gaps);
  }

  return lesson;
}
