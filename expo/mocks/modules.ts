import { LearningModule, ModuleId } from '@/types';

export const learningModules: LearningModule[] = [
  {
    id: 'module-1',
    title: 'Sounds & Survival',
    subtitle: 'Master French sounds and basic interactions',
    cefrLevel: 'A1',
    description: 'Learn to pronounce French clearly and handle basic social situations like greetings, introductions, and simple requests.',
    outcomes: [
      'Pronounce all key French sounds so you are understandable',
      'Master the French alphabet, accents, and nasal vowels',
      'Introduce yourself, count, tell time, and know the calendar',
      'Conjugate être and avoir in present tense',
      'Handle simple interactions in cafés and shops',
    ],
    lessonIds: [
      'foundation-1', 'foundation-2', 'foundation-3', 'foundation-4', 'foundation-5',
      'foundation-41', 'foundation-42'
    ],
    requiredLessonsToPass: 5,
    checkpointPrompts: [
      'Introduce yourself in French',
      'Order something at a café',
    ],
    difficulties: ['beginner'],
    order: 1,
  },
  {
    id: 'module-2',
    title: 'Everyday Life',
    subtitle: 'Talk about routines, people, and plans',
    cefrLevel: 'A2',
    description: 'Learn to describe people, discuss daily routines with reflexive verbs, navigate food and directions, and make plans.',
    outcomes: [
      'Describe family members and people using adjectives',
      'Talk about daily routine using reflexive verbs',
      'Order food at restaurants and navigate directions',
      'Make plans and link ideas with connectors',
      'Use "on" as everyday "we" in French',
    ],
    lessonIds: [
      'foundation-6', 'foundation-7', 'foundation-8', 'foundation-9', 'foundation-10',
      'foundation-43', 'foundation-44'
    ],
    requiredLessonsToPass: 5,
    checkpointPrompts: [
      'Describe your typical weekday',
      'Order a meal at a restaurant',
      'Make weekend plans with a friend',
    ],
    difficulties: ['beginner', 'easy'],
    order: 2,
  },
  {
    id: 'module-3',
    title: 'Past, Future & Opinions',
    subtitle: 'Tell stories and share your views',
    cefrLevel: 'A2',
    description: 'Master passé composé with both avoir and être, talk about future plans, compare things, express opinions, and form questions and negations.',
    outcomes: [
      'Use passé composé with avoir for common verbs',
      'Use passé composé with être for movement verbs',
      'Talk about future plans using futur proche',
      'Compare things and express opinions with reasons',
      'Form negations (ne...pas/jamais/rien/personne) and questions',
    ],
    lessonIds: [
      'foundation-11', 'foundation-12', 'foundation-13', 'foundation-14', 'foundation-15',
      'foundation-45', 'foundation-46'
    ],
    requiredLessonsToPass: 5,
    checkpointPrompts: [
      'Tell the story of your last weekend',
      'Describe your plans for the next few months',
      'Give your opinion on a topic and explain why',
    ],
    difficulties: ['easy', 'medium'],
    order: 3,
  },
  {
    id: 'module-4',
    title: 'Real Conversations',
    subtitle: 'Sound natural and handle problems',
    cefrLevel: 'B1',
    description: 'Sound like a real French speaker with discourse markers, master imparfait for scene-setting, handle complaints politely, and tell structured stories.',
    outcomes: [
      'Use discourse markers and fillers naturally',
      'Use imparfait for descriptions, habits, and scene-setting',
      'Handle complaints and problems politely',
      'Manage conversation breakdowns gracefully',
      'Tell structured stories with beginning, middle, and end',
    ],
    lessonIds: [
      'foundation-16', 'foundation-17', 'foundation-18', 'foundation-19', 'foundation-20',
      'foundation-47', 'foundation-48'
    ],
    requiredLessonsToPass: 5,
    checkpointPrompts: [
      'Tell about a mistake you made and what you learned',
      'Explain a problem at a hotel and ask for help',
      'Discuss the pros and cons of living in your city',
    ],
    difficulties: ['medium'],
    order: 4,
  },
  {
    id: 'module-5',
    title: 'Nuance & Expression',
    subtitle: 'Express complex ideas with sophistication',
    cefrLevel: 'B2',
    description: 'Master the subjunctive mood, conditional tense, relative pronouns for complex sentences, French idioms, and register shifts between formal and casual.',
    outcomes: [
      'Use the subjunctive mood for wishes, doubts, and emotions',
      'Form conditional sentences for hypotheticals and advice',
      'Build complex sentences with relative pronouns (qui, que, dont, où)',
      'Use common French idioms and fixed expressions naturally',
      'Shift between formal, standard, and casual registers',
    ],
    lessonIds: [
      'foundation-21', 'foundation-22', 'foundation-23', 'foundation-24', 'foundation-25',
      'foundation-49', 'foundation-50'
    ],
    requiredLessonsToPass: 5,
    checkpointPrompts: [
      'Express what you wish would change in the world using subjunctive',
      'Give advice to a friend about a difficult decision using conditional',
      'Describe a complex situation using relative pronouns',
      'Use idioms naturally in a conversation about daily life',
    ],
    difficulties: ['medium', 'hard'],
    order: 5,
  },
  {
    id: 'module-6',
    title: 'Mastery & Fluency',
    subtitle: 'Achieve near-native sophistication',
    cefrLevel: 'C1',
    description: 'Understand literary tenses, master advanced subjunctive usage, build compelling arguments, use cultural proverbs, and navigate any conversation with elegance.',
    outcomes: [
      'Recognize and understand literary tenses (passé simple, plus-que-parfait)',
      'Use advanced subjunctive constructions confidently',
      'Build structured arguments with formal connectors',
      'Use French proverbs and cultural expressions in context',
      'Navigate any social or professional conversation with sophistication',
    ],
    lessonIds: [
      'foundation-26', 'foundation-27', 'foundation-28', 'foundation-29', 'foundation-30',
      'foundation-51', 'foundation-52'
    ],
    requiredLessonsToPass: 5,
    checkpointPrompts: [
      'Retell a historical event using literary past tenses',
      'Debate both sides of a controversial topic with nuance',
      'Give a short speech about something important to you',
      'Lead a group discussion on a complex social issue',
    ],
    difficulties: ['hard', 'university'],
    order: 6,
  },
  {
    id: 'module-7',
    title: 'Advanced Fluency',
    subtitle: 'Professional and cultural command',
    cefrLevel: 'C1',
    description: 'Master business French, complex tense sequences, humor and wordplay, and advanced debate techniques for professional and social fluency.',
    outcomes: [
      'Use nuanced connectors and transitions for polished speech',
      'Master complex tense sequences (plus-que-parfait, futur antérieur)',
      'Navigate professional French in meetings and emails',
      'Understand and use French humor, irony, and wordplay',
      'Structure and deliver compelling arguments in debates',
    ],
    lessonIds: [
      'foundation-31', 'foundation-32', 'foundation-33', 'foundation-34', 'foundation-35',
      'foundation-53', 'foundation-54'
    ],
    requiredLessonsToPass: 5,
    checkpointPrompts: [
      'Lead a professional meeting in French',
      'Tell a joke or funny story using French humor conventions',
      'Debate a complex topic using advanced connectors and rhetoric',
    ],
    difficulties: ['hard', 'university'],
    order: 7,
  },
  {
    id: 'module-8',
    title: 'Near-Native Expression',
    subtitle: 'Speak like a native in any context',
    cefrLevel: 'C2',
    description: 'Achieve near-native command with literary style, contemporary slang, regional awareness, and the ability to adapt fluidly to any social or professional context.',
    outcomes: [
      'Write with literary elegance and stylistic awareness',
      'Understand and use contemporary slang and verlan',
      'Recognize regional French variations across the Francophone world',
      'Deliver polished presentations and public speeches',
      'Self-assess and consolidate mastery across all skills',
    ],
    lessonIds: [
      'foundation-36', 'foundation-37', 'foundation-38', 'foundation-39', 'foundation-40',
      'foundation-55', 'foundation-56'
    ],
    requiredLessonsToPass: 5,
    checkpointPrompts: [
      'Write a short essay with literary style and sophisticated vocabulary',
      'Have a casual conversation using slang and informal register',
      'Give a 3-minute presentation on a complex topic',
      'Demonstrate understanding of at least 3 regional French variations',
    ],
    difficulties: ['university'],
    order: 8,
  },
];

export const getModuleById = (id: ModuleId): LearningModule | undefined => {
  return learningModules.find(m => m.id === id);
};

export const getNextModule = (currentId: ModuleId): LearningModule | undefined => {
  const current = learningModules.find(m => m.id === currentId);
  if (!current) return undefined;
  return learningModules.find(m => m.order === current.order + 1);
};

export const getModulesForDifficulty = (difficulty: string): LearningModule[] => {
  return learningModules.filter(m => m.difficulties.includes(difficulty as any));
};

export const pronunciationTips: Record<string, { sound: string; tip: string; example: string }> = {
  'nasal-an': {
    sound: 'an/en',
    tip: 'Push air through your nose while keeping your mouth relaxed. Think of saying "ahn" without the n.',
    example: 'enfant, pendant, enchanté',
  },
  'nasal-in': {
    sound: 'in/ain/ein',
    tip: 'Similar to nasal-an but with a more closed mouth. Like saying "an" but with your lips slightly spread.',
    example: 'vin, pain, plein',
  },
  'nasal-on': {
    sound: 'on',
    tip: 'Round your lips like saying "oh" but push air through your nose.',
    example: 'bon, maison, pardon',
  },
  'nasal-un': {
    sound: 'un',
    tip: 'Like nasal-in but with rounded lips. Not common in all French accents.',
    example: 'un, brun, parfum',
  },
  'u-vs-ou': {
    sound: 'u vs ou',
    tip: 'For "u" (tu), purse your lips tightly like whistling. For "ou" (tout), relax and round your lips more.',
    example: 'tu vs tout, rue vs roue, vu vs vous',
  },
  'french-r': {
    sound: 'r /ʁ/',
    tip: 'The French r comes from the back of your throat. Try gargling without water to feel the position.',
    example: 'merci, bonjour, parler',
  },
  'silent-letters': {
    sound: 'Silent final consonants',
    tip: 'Most final consonants are silent in French. Remember: C-R-F-L are often pronounced (CaReFuL).',
    example: 'petit (puh-TEE), vous (voo), parlent (parl)',
  },
  'liaison': {
    sound: 'Liaison',
    tip: 'Connect final consonants to following vowels in common phrases.',
    example: 'les amis (lay-za-mee), petit ami, nous avons',
  },
};
