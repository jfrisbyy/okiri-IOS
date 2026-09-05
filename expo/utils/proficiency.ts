import { CEFRLevel, ModuleId } from '@/types';

export const CEFR_LEVEL_ORDER: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export const CEFR_LEVEL_NAMES: Record<CEFRLevel, string> = {
  'A1': 'Beginner',
  'A2': 'Elementary',
  'B1': 'Intermediate',
  'B2': 'Upper Intermediate',
  'C1': 'Advanced',
  'C2': 'Mastery',
};

export const CEFR_LEVEL_DESCRIPTIONS: Record<CEFRLevel, string> = {
  'A1': 'Understand basic everyday expressions',
  'A2': 'Communicate in simple routine tasks',
  'B1': 'Handle most situations while traveling',
  'B2': 'Interact with fluency and spontaneity',
  'C1': 'Express ideas fluently and precisely',
  'C2': 'Understand virtually everything',
};

export const CEFR_LEVEL_COLORS: Record<CEFRLevel, { bg: string; text: string; accent: string; gradient: [string, string] }> = {
  'A1': { bg: '#DBEAFE', text: '#1E40AF', accent: '#3B82F6', gradient: ['#3B82F6', '#2563EB'] },
  'A2': { bg: '#D1FAE5', text: '#065F46', accent: '#10B981', gradient: ['#10B981', '#059669'] },
  'B1': { bg: '#FEF3C7', text: '#92400E', accent: '#F59E0B', gradient: ['#F59E0B', '#D97706'] },
  'B2': { bg: '#FED7AA', text: '#9A3412', accent: '#F97316', gradient: ['#F97316', '#EA580C'] },
  'C1': { bg: '#EDE9FE', text: '#5B21B6', accent: '#7C3AED', gradient: ['#7C3AED', '#6D28D9'] },
  'C2': { bg: '#FCE7F3', text: '#9D174D', accent: '#EC4899', gradient: ['#EC4899', '#DB2777'] },
};

export interface CEFRGate {
  afterModule: ModuleId;
  testLevel: CEFRLevel;
  nextModule: ModuleId;
}

export const CEFR_GATES: CEFRGate[] = [
  { afterModule: 'module-1', testLevel: 'A1', nextModule: 'module-2' },
  { afterModule: 'module-3', testLevel: 'A2', nextModule: 'module-4' },
  { afterModule: 'module-4', testLevel: 'B1', nextModule: 'module-5' },
  { afterModule: 'module-5', testLevel: 'B2', nextModule: 'module-6' },
  { afterModule: 'module-7', testLevel: 'C1', nextModule: 'module-8' },
];

export const MODULE_TO_CEFR: Record<ModuleId, CEFRLevel> = {
  'module-1': 'A1',
  'module-2': 'A2',
  'module-3': 'A2',
  'module-4': 'B1',
  'module-5': 'B2',
  'module-6': 'C1',
  'module-7': 'C1',
  'module-8': 'C2',
};

export const PASS_THRESHOLD = 70;

export function getRequiredCertificationForModule(moduleId: ModuleId): CEFRLevel | null {
  const gate = CEFR_GATES.find(g => g.nextModule === moduleId);
  return gate?.testLevel ?? null;
}

export function getCurrentCertifiedLevel(certifiedLevels: CEFRLevel[]): CEFRLevel | null {
  for (let i = CEFR_LEVEL_ORDER.length - 1; i >= 0; i--) {
    if (certifiedLevels.includes(CEFR_LEVEL_ORDER[i])) {
      return CEFR_LEVEL_ORDER[i];
    }
  }
  return null;
}

export function getNextTestableLevel(
  completedModules: ModuleId[],
  certifiedLevels: CEFRLevel[],
): CEFRLevel | null {
  if (completedModules.includes('module-1') && !certifiedLevels.includes('A1')) return 'A1';
  if (completedModules.includes('module-3') && certifiedLevels.includes('A1') && !certifiedLevels.includes('A2')) return 'A2';
  if (completedModules.includes('module-4') && certifiedLevels.includes('A2') && !certifiedLevels.includes('B1')) return 'B1';
  if (completedModules.includes('module-5') && certifiedLevels.includes('B1') && !certifiedLevels.includes('B2')) return 'B2';
  if (completedModules.includes('module-7') && certifiedLevels.includes('B2') && !certifiedLevels.includes('C1')) return 'C1';
  if (completedModules.includes('module-8') && certifiedLevels.includes('C1') && !certifiedLevels.includes('C2')) return 'C2';
  return null;
}

export function isUserBelowB2(certifiedLevels: CEFRLevel[]): boolean {
  const b2Index = CEFR_LEVEL_ORDER.indexOf('B2');
  const currentLevel = getCurrentCertifiedLevel(certifiedLevels);
  if (!currentLevel) return true;
  return CEFR_LEVEL_ORDER.indexOf(currentLevel) < b2Index;
}

export function isModuleGatedByProficiency(
  moduleId: ModuleId,
  certifiedLevels: CEFRLevel[],
): boolean {
  const requiredLevel = getRequiredCertificationForModule(moduleId);
  if (!requiredLevel) return false;
  return !certifiedLevels.includes(requiredLevel);
}

export function getGateForModule(moduleId: ModuleId): CEFRGate | null {
  return CEFR_GATES.find(g => g.nextModule === moduleId) ?? null;
}

export function getGateAfterModule(moduleId: ModuleId): CEFRGate | null {
  return CEFR_GATES.find(g => g.afterModule === moduleId) ?? null;
}

export function getLevelProgressInfo(
  completedModules: ModuleId[],
  currentModuleId: ModuleId,
  certifiedLevels: CEFRLevel[],
): { certifiedLevel: CEFRLevel | null; workingLevel: CEFRLevel; progressPercent: number } {
  const certifiedLevel = getCurrentCertifiedLevel(certifiedLevels);
  const workingLevel = MODULE_TO_CEFR[currentModuleId] || 'A1';

  const modulesForLevel: Record<CEFRLevel, ModuleId[]> = {
    'A1': ['module-1'],
    'A2': ['module-2', 'module-3'],
    'B1': ['module-4'],
    'B2': ['module-5'],
    'C1': ['module-6', 'module-7'],
    'C2': ['module-8'],
  };

  const levelModules = modulesForLevel[workingLevel];
  const completedInLevel = levelModules.filter(m => completedModules.includes(m)).length;
  const progressPercent = levelModules.length > 0 ? Math.round((completedInLevel / levelModules.length) * 100) : 0;

  return { certifiedLevel, workingLevel, progressPercent };
}

export interface ProficiencyQuestion {
  type: 'multiple_choice' | 'fill_blank' | 'translation';
  question: string;
  correctAnswer: string;
  choices?: string[];
  skill: 'vocabulary' | 'grammar' | 'comprehension' | 'production';
}

export function getTestPromptForLevel(level: CEFRLevel): string {
  const prompts: Record<CEFRLevel, string> = {
    'A1': `Generate exactly 10 French proficiency test questions for CEFR A1 level (Beginner).
Topics: greetings, introductions, numbers, present tense être/avoir, café interactions, basic adjectives.
Include: 4 multiple_choice (4 choices each), 3 fill_blank (verb conjugation, basic phrases), 3 translation (French-to-English).
Keep sentences short. All clearly answerable by A1 learner.`,

    'A2': `Generate exactly 10 French proficiency test questions for CEFR A2 level (Elementary).
Topics: describing people/family, reflexive verbs, daily routines, food ordering, directions, futur proche, connectors (mais, parce que, donc).
Include: 4 multiple_choice (4 choices each), 3 fill_blank, 3 translation (mix FR→EN and EN→FR).
Require A2 knowledge, not just A1 basics.`,

    'B1': `Generate exactly 10 French proficiency test questions for CEFR B1 level (Intermediate).
Topics: discourse markers (en fait, du coup, quand même), imparfait vs passé composé, polite complaints, storytelling structure, conversation management.
Include: 3 multiple_choice (4 choices each), 4 fill_blank (imparfait/passé composé), 3 translation.
Must test B1 proficiency clearly.`,

    'B2': `Generate exactly 10 French proficiency test questions for CEFR B2 level (Upper Intermediate).
Topics: subjunctive mood, conditional tense, relative pronouns (qui/que/dont/où), idioms, register shifts.
Include: 3 multiple_choice (4 choices each), 4 fill_blank (subjunctive/conditional), 3 translation of complex sentences.
Test sophisticated B2-level grammar.`,

    'C1': `Generate exactly 10 French proficiency test questions for CEFR C1 level (Advanced).
Topics: literary tenses (passé simple, plus-que-parfait), advanced subjunctive, formal connectors (néanmoins, en revanche), proverbs, nuanced professional language.
Include: 3 multiple_choice (4 choices each), 4 fill_blank, 3 translation.
Must test C1 sophistication.`,

    'C2': `Generate exactly 10 French proficiency test questions for CEFR C2 level (Mastery).
Topics: literary style, contemporary slang/verlan, regional variations, complex tense sequences, academic register.
Include: 3 multiple_choice (4 choices each), 4 fill_blank, 3 translation.
Test near-native command.`,
  };

  return prompts[level] + `

IMPORTANT FORMAT RULES:
- For multiple_choice: provide exactly 4 choices including the correct answer
- For fill_blank: the question should contain "___" where the answer goes
- For translation: clearly indicate the direction (translate to French / translate to English)
- correctAnswer must be a single exact string
- skill must be one of: vocabulary, grammar, comprehension, production
- Each question object must have: type, question, correctAnswer, skill
- multiple_choice questions MUST have a "choices" array`;
}

export interface ContinuousCEFRScore {
  overallScore: number;
  level: CEFRLevel;
  progressInLevel: number;
  skillScores: {
    reading: number;
    writing: number;
    listening: number;
    speaking: number;
  };
}

const LEVEL_BASE_SCORES: Record<CEFRLevel, number> = {
  'A1': 0,
  'A2': 100,
  'B1': 200,
  'B2': 300,
  'C1': 400,
  'C2': 500,
};

const VOCAB_THRESHOLDS: Record<CEFRLevel, number> = {
  'A1': 30,
  'A2': 80,
  'B1': 180,
  'B2': 350,
  'C1': 600,
  'C2': 1000,
};

export interface CEFRCalculationInput {
  vocabMasteredCount: number;
  totalGaps: number;
  grammarGapsResolved: number;
  totalGrammarGaps: number;
  pronunciationAvgScore: number;
  readingAccuracy: number;
  readingSessions: number;
  listeningComprehension: number;
  speakingMinutes: number;
  certifiedLevels: CEFRLevel[];
  currentModuleId: ModuleId;
  completedModules: ModuleId[];
}

export function calculateContinuousCEFR(input: CEFRCalculationInput): ContinuousCEFRScore {
  const certifiedLevel = getCurrentCertifiedLevel(input.certifiedLevels);
  const certifiedIndex = certifiedLevel ? CEFR_LEVEL_ORDER.indexOf(certifiedLevel) : -1;
  const baseFromCert = certifiedLevel ? LEVEL_BASE_SCORES[certifiedLevel] : 0;

  const workingLevel = MODULE_TO_CEFR[input.currentModuleId] || 'A1';
  const workingIndex = CEFR_LEVEL_ORDER.indexOf(workingLevel);
  const effectiveIndex = Math.max(certifiedIndex, workingIndex);
  const effectiveLevel = CEFR_LEVEL_ORDER[Math.min(effectiveIndex, CEFR_LEVEL_ORDER.length - 1)];

  const vocabScore = calculateVocabScore(input.vocabMasteredCount);
  const grammarScore = input.totalGrammarGaps > 0
    ? Math.min(100, (input.grammarGapsResolved / input.totalGrammarGaps) * 100)
    : 20;
  const pronScore = Math.min(100, input.pronunciationAvgScore);
  const readingScore = calculateReadingScore(input.readingAccuracy, input.readingSessions);
  const listeningScore = Math.min(100, input.listeningComprehension);
  const speakingScore = calculateSpeakingScore(input.speakingMinutes);

  const writingScore = Math.round((grammarScore * 0.6 + vocabScore * 0.4));

  const compositeProgress = (
    vocabScore * 0.25 +
    grammarScore * 0.25 +
    readingScore * 0.2 +
    listeningScore * 0.15 +
    speakingScore * 0.1 +
    pronScore * 0.05
  );

  const levelProgress = Math.min(100, Math.round(compositeProgress));
  const overallScore = Math.round(baseFromCert + levelProgress);

  console.log('[CEFR] Calculated continuous score:', {
    overallScore,
    level: effectiveLevel,
    levelProgress,
    vocab: vocabScore,
    grammar: grammarScore,
    reading: readingScore,
    listening: listeningScore,
    speaking: speakingScore,
    pron: pronScore,
  });

  return {
    overallScore,
    level: effectiveLevel,
    progressInLevel: levelProgress,
    skillScores: {
      reading: Math.round(readingScore),
      writing: Math.round(writingScore),
      listening: Math.round(listeningScore),
      speaking: Math.round(speakingScore),
    },
  };
}

function calculateVocabScore(masteredCount: number): number {
  if (masteredCount <= 0) return 5;
  const levels = Object.entries(VOCAB_THRESHOLDS);
  for (let i = levels.length - 1; i >= 0; i--) {
    const [, threshold] = levels[i];
    if (masteredCount >= threshold) {
      const nextThreshold = i < levels.length - 1 ? levels[i + 1][1] : threshold * 1.5;
      const progress = (masteredCount - threshold) / (nextThreshold - threshold);
      return Math.min(100, Math.round(((i + 1) / levels.length) * 100 + progress * (100 / levels.length)));
    }
  }
  const firstThreshold = levels[0][1];
  return Math.min(100, Math.round((masteredCount / firstThreshold) * (100 / levels.length)));
}

function calculateReadingScore(accuracy: number, sessions: number): number {
  const sessionBonus = Math.min(30, sessions * 3);
  const accuracyComponent = Math.min(70, accuracy * 0.7);
  return Math.min(100, Math.round(accuracyComponent + sessionBonus));
}

function calculateSpeakingScore(minutes: number): number {
  if (minutes <= 0) return 5;
  if (minutes < 10) return Math.round(15 + (minutes / 10) * 20);
  if (minutes < 60) return Math.round(35 + ((minutes - 10) / 50) * 30);
  if (minutes < 300) return Math.round(65 + ((minutes - 60) / 240) * 25);
  return Math.min(100, Math.round(90 + ((minutes - 300) / 700) * 10));
}

export function getCEFRLevelFromScore(score: number): CEFRLevel {
  if (score >= 500) return 'C2';
  if (score >= 400) return 'C1';
  if (score >= 300) return 'B2';
  if (score >= 200) return 'B1';
  if (score >= 100) return 'A2';
  return 'A1';
}

export function getScorePositionPercent(score: number): number {
  const maxScore = 600;
  return Math.min(100, Math.max(0, (score / maxScore) * 100));
}

export interface CEFRLevelUpInfo {
  previousLevel: CEFRLevel | null;
  newLevel: CEFRLevel;
  skillsUnlocked: string[];
}

export const LEVEL_UNLOCKS: Record<CEFRLevel, string[]> = {
  'A1': ['Basic conversations', 'Simple greetings', 'Numbers & time'],
  'A2': ['Daily routines', 'Simple stories', 'Restaurant ordering'],
  'B1': ['Travel situations', 'Opinion sharing', 'Storytelling'],
  'B2': ['Debates & arguments', 'Complex texts', 'Professional French'],
  'C1': ['Academic writing', 'Literary analysis', 'Nuanced expression'],
  'C2': ['Native-level fluency', 'Cultural mastery', 'Any context'],
};

export function getFallbackQuestions(level: CEFRLevel): ProficiencyQuestion[] {
  const fallbacks: Record<CEFRLevel, ProficiencyQuestion[]> = {
    'A1': [
      { type: 'multiple_choice', question: 'How do you say "Hello" in French?', correctAnswer: 'Bonjour', choices: ['Bonjour', 'Merci', 'Au revoir', 'Bonsoir'], skill: 'vocabulary' },
      { type: 'multiple_choice', question: 'Complete: Je ___ français. (I am French)', correctAnswer: 'suis', choices: ['suis', 'est', 'ai', 'as'], skill: 'grammar' },
      { type: 'multiple_choice', question: 'What does "merci beaucoup" mean?', correctAnswer: 'Thank you very much', choices: ['Thank you very much', 'Goodbye', 'Please', 'You\'re welcome'], skill: 'vocabulary' },
      { type: 'multiple_choice', question: 'Choose the correct form: Nous ___ un chat. (We have a cat)', correctAnswer: 'avons', choices: ['avons', 'avez', 'ont', 'a'], skill: 'grammar' },
      { type: 'fill_blank', question: 'Il ___ étudiant. (He is a student) - conjugate être', correctAnswer: 'est', skill: 'grammar' },
      { type: 'fill_blank', question: 'Vous ___ trois enfants. (You have three children) - conjugate avoir', correctAnswer: 'avez', skill: 'grammar' },
      { type: 'fill_blank', question: 'Je m\'appelle Marie. ___ suis de Paris. (I am from Paris)', correctAnswer: 'Je', skill: 'grammar' },
      { type: 'translation', question: 'Translate to English: "Je voudrais un café, s\'il vous plaît."', correctAnswer: 'I would like a coffee, please.', skill: 'comprehension' },
      { type: 'translation', question: 'Translate to English: "Comment allez-vous?"', correctAnswer: 'How are you?', skill: 'comprehension' },
      { type: 'translation', question: 'Translate to English: "Il fait beau aujourd\'hui."', correctAnswer: 'The weather is nice today.', skill: 'comprehension' },
    ],
    'A2': [
      { type: 'multiple_choice', question: 'Choose the correct reflexive verb: Elle ___ à 7 heures. (She wakes up at 7)', correctAnswer: 'se réveille', choices: ['se réveille', 'réveille', 'se réveiller', 'me réveille'], skill: 'grammar' },
      { type: 'multiple_choice', question: 'Complete: Je vais ___ au cinéma demain. (futur proche)', correctAnswer: 'aller', choices: ['aller', 'allé', 'allons', 'irai'], skill: 'grammar' },
      { type: 'multiple_choice', question: 'Which connector means "because"?', correctAnswer: 'parce que', choices: ['parce que', 'mais', 'donc', 'alors'], skill: 'vocabulary' },
      { type: 'multiple_choice', question: 'Choose: Ma sœur est ___ que mon frère. (taller)', correctAnswer: 'plus grande', choices: ['plus grande', 'plus grand', 'la grande', 'très grande'], skill: 'grammar' },
      { type: 'fill_blank', question: 'Nous nous ___ tous les matins à 6h. (se lever - present)', correctAnswer: 'levons', skill: 'grammar' },
      { type: 'fill_blank', question: 'Il fait ___ aujourd\'hui, je vais mettre un manteau. (cold)', correctAnswer: 'froid', skill: 'vocabulary' },
      { type: 'fill_blank', question: 'Je voudrais ___ une table pour deux personnes. (to reserve)', correctAnswer: 'réserver', skill: 'vocabulary' },
      { type: 'translation', question: 'Translate to English: "Je me brosse les dents avant de dormir."', correctAnswer: 'I brush my teeth before sleeping.', skill: 'comprehension' },
      { type: 'translation', question: 'Translate to French: "Turn left at the traffic light."', correctAnswer: 'Tournez à gauche au feu.', skill: 'production' },
      { type: 'translation', question: 'Translate to English: "On va manger au restaurant ce soir."', correctAnswer: 'We are going to eat at the restaurant tonight.', skill: 'comprehension' },
    ],
    'B1': [
      { type: 'multiple_choice', question: 'Choose the correct past tense: Quand j\'étais petit, je ___ au parc chaque jour.', correctAnswer: 'jouais', choices: ['jouais', 'ai joué', 'joue', 'jouerai'], skill: 'grammar' },
      { type: 'multiple_choice', question: 'Which discourse marker means "actually/in fact"?', correctAnswer: 'en fait', choices: ['en fait', 'du coup', 'quand même', 'pourtant'], skill: 'vocabulary' },
      { type: 'multiple_choice', question: 'Complete: Hier, il ___ quand je suis sorti. (It was raining when I went out)', correctAnswer: 'pleuvait', choices: ['pleuvait', 'a plu', 'pleut', 'pleuvra'], skill: 'grammar' },
      { type: 'fill_blank', question: 'J\'___ (habiter - imparfait) à Lyon quand j\'étais étudiant.', correctAnswer: 'habitais', skill: 'grammar' },
      { type: 'fill_blank', question: 'Nous sommes ___ (arriver - passé composé) à la gare à midi.', correctAnswer: 'arrivés', skill: 'grammar' },
      { type: 'fill_blank', question: 'Elle a ___ (prendre - passé composé) le train de 8 heures.', correctAnswer: 'pris', skill: 'grammar' },
      { type: 'fill_blank', question: 'Je suis désolé, ___ même, je ne peux pas accepter. (nevertheless)', correctAnswer: 'quand', skill: 'vocabulary' },
      { type: 'translation', question: 'Translate to English: "Je voudrais signaler un problème avec ma chambre."', correctAnswer: 'I would like to report a problem with my room.', skill: 'comprehension' },
      { type: 'translation', question: 'Translate to English: "Du coup, on a décidé de changer nos plans."', correctAnswer: 'So, we decided to change our plans.', skill: 'comprehension' },
      { type: 'translation', question: 'Translate to French: "When I was young, I used to play guitar every day."', correctAnswer: 'Quand j\'étais jeune, je jouais de la guitare tous les jours.', skill: 'production' },
    ],
    'B2': [
      { type: 'multiple_choice', question: 'Complete: Il faut que tu ___ plus attention. (faire - subjunctive)', correctAnswer: 'fasses', choices: ['fasses', 'fais', 'feras', 'ferais'], skill: 'grammar' },
      { type: 'multiple_choice', question: 'Choose the correct conditional: Si j\'avais le temps, je ___ en France.', correctAnswer: 'voyagerais', choices: ['voyagerais', 'voyage', 'voyagerai', 'ai voyagé'], skill: 'grammar' },
      { type: 'multiple_choice', question: 'Which relative pronoun fits: La ville ___ je viens est petite.', correctAnswer: "d'où", choices: ["d'où", 'qui', 'que', 'dont'], skill: 'grammar' },
      { type: 'fill_blank', question: 'Bien qu\'il ___ (être - subjunctive) fatigué, il continue de travailler.', correctAnswer: 'soit', skill: 'grammar' },
      { type: 'fill_blank', question: 'Si nous ___ (pouvoir - imparfait) recommencer, nous ferions les choses différemment.', correctAnswer: 'pouvions', skill: 'grammar' },
      { type: 'fill_blank', question: 'C\'est le livre ___ (relative pronoun) je t\'ai parlé hier.', correctAnswer: 'dont', skill: 'grammar' },
      { type: 'fill_blank', question: 'Il vaut mieux que vous ___ (partir - subjunctive) maintenant.', correctAnswer: 'partiez', skill: 'grammar' },
      { type: 'translation', question: 'Translate to English: "Quoi qu\'il arrive, je serai là pour toi."', correctAnswer: 'Whatever happens, I will be there for you.', skill: 'comprehension' },
      { type: 'translation', question: 'Translate to English: "Il a beau essayer, il n\'y arrive pas."', correctAnswer: 'No matter how hard he tries, he can\'t manage it.', skill: 'comprehension' },
      { type: 'translation', question: 'Translate to French: "I wish you would come to the party."', correctAnswer: 'J\'aimerais que tu viennes à la fête.', skill: 'production' },
    ],
    'C1': [
      { type: 'multiple_choice', question: 'Identify the literary tense: "Il entra dans la salle et regarda autour de lui."', correctAnswer: 'Passé simple', choices: ['Passé simple', 'Passé composé', 'Imparfait', 'Plus-que-parfait'], skill: 'grammar' },
      { type: 'multiple_choice', question: 'Complete: ___ les circonstances, nous devons reporter la réunion.', correctAnswer: 'Eu égard à', choices: ['Eu égard à', 'Parce que', 'Comme', 'Vu'], skill: 'vocabulary' },
      { type: 'multiple_choice', question: 'Which proverb means "better late than never"?', correctAnswer: 'Mieux vaut tard que jamais', choices: ['Mieux vaut tard que jamais', 'Qui vivra verra', 'Pierre qui roule n\'amasse pas mousse', 'Après la pluie, le beau temps'], skill: 'vocabulary' },
      { type: 'fill_blank', question: 'Il avait ___ (finir - plus-que-parfait) son travail avant que nous arrivions.', correctAnswer: 'fini', skill: 'grammar' },
      { type: 'fill_blank', question: 'Quoiqu\'il en ___ (être - subjunctive), la décision est prise.', correctAnswer: 'soit', skill: 'grammar' },
      { type: 'fill_blank', question: 'Il s\'agit ___ (preposition) une question fondamentale.', correctAnswer: "d'", skill: 'grammar' },
      { type: 'fill_blank', question: 'Ce rapport met en ___ (light/evidence) les faiblesses du système.', correctAnswer: 'lumière', skill: 'vocabulary' },
      { type: 'translation', question: 'Translate to English: "Force est de constater que les résultats ne sont pas à la hauteur."', correctAnswer: 'One must acknowledge that the results are not up to standard.', skill: 'comprehension' },
      { type: 'translation', question: 'Translate to English: "Néanmoins, il convient de nuancer cette affirmation."', correctAnswer: 'Nevertheless, this claim should be qualified.', skill: 'comprehension' },
      { type: 'translation', question: 'Translate to French: "Had I known earlier, I would have acted differently."', correctAnswer: 'Si j\'avais su plus tôt, j\'aurais agi différemment.', skill: 'production' },
    ],
    'C2': [
      { type: 'multiple_choice', question: 'What does the verlan word "meuf" mean?', correctAnswer: 'femme (woman)', choices: ['femme (woman)', 'mère (mother)', 'fille (girl)', 'amie (friend)'], skill: 'vocabulary' },
      { type: 'multiple_choice', question: 'Identify the Québécois expression: "J\'ai le goût d\'aller magasiner."', correctAnswer: 'I feel like going shopping', choices: ['I feel like going shopping', 'I have good taste in clothes', 'I need to buy groceries', 'I like to try things'], skill: 'comprehension' },
      { type: 'multiple_choice', question: 'Which literary device is used: "Cette obscure clarté qui tombe des étoiles"?', correctAnswer: 'Oxymoron', choices: ['Oxymoron', 'Metaphor', 'Synecdoche', 'Litotes'], skill: 'comprehension' },
      { type: 'fill_blank', question: 'Eût-il ___ (savoir - past subjunctive) la vérité, il aurait agi autrement.', correctAnswer: 'su', skill: 'grammar' },
      { type: 'fill_blank', question: 'Il n\'est pas sans ___ que cette décision aura des conséquences. (to know)', correctAnswer: 'savoir', skill: 'grammar' },
      { type: 'fill_blank', question: 'Le gouvernement a ___ les mesures d\'austérité. (to tighten/reinforce)', correctAnswer: 'renforcé', skill: 'vocabulary' },
      { type: 'fill_blank', question: 'Toujours est-il ___ la situation reste préoccupante.', correctAnswer: 'que', skill: 'grammar' },
      { type: 'translation', question: 'Translate to English: "La France d\'en bas aspire à une reconnaissance que les élites peinent à lui accorder."', correctAnswer: 'Working-class France aspires to recognition that the elites struggle to grant it.', skill: 'comprehension' },
      { type: 'translation', question: 'Translate to English: "C\'est un travail de titan qui n\'a pas manqué de susciter la polémique."', correctAnswer: 'It is a monumental task that has not failed to spark controversy.', skill: 'comprehension' },
      { type: 'translation', question: 'Translate to French: "The more one analyzes this phenomenon, the more its underlying complexity becomes apparent."', correctAnswer: 'Plus on analyse ce phénomène, plus sa complexité sous-jacente devient apparente.', skill: 'production' },
    ],
  };

  return fallbacks[level] || fallbacks['A1'];
}
