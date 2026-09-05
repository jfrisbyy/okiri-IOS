export type UserLevel = 'none' | 'basics' | 'simple_texts';
export type UserGoal = 'travel' | 'conversation' | 'work' | 'curious';
export type Difficulty = 'beginner' | 'easy' | 'medium' | 'hard' | 'university';
export type Region = 'france' | 'martinique' | 'guadeloupe' | 'senegal' | 'morocco' | 'quebec' | 'belgium' | 'switzerland' | 'ivory-coast' | 'cameroon' | 'haiti' | 'drc' | 'general';
export type ContentCategory = 'dialogue' | 'article' | 'story' | 'fiction' | 'news' | 'culture' | 'history' | 'literature' | 'science' | 'travel' | 'food' | 'music' | 'sports';
export type GapDifficulty = 'hard' | 'okay' | 'easy';
export type GapType = 'vocab' | 'grammar' | 'pronunciation' | 'politeness' | 'connector' | 'filler';
export type GapCategory = 'vocabulary' | 'grammar' | 'pronunciation' | 'phrasing' | 'register';
export type GapPromptType = 'multiple_choice' | 'fill_blank' | 'correction' | 'production' | 'translation' | 'tap_what_you_hear' | 'sentence_build' | 'spot_the_error' | 'true_false' | 'match_pairs' | 'word_order' | 'listen_and_type' | 'speak_to_answer' | 'sound_to_letter' | 'letter_to_sound' | 'alphabet_sequence';

export type ContentType =
  | 'alphabet_phonetics'
  | 'pronunciation_rules'
  | 'vocabulary'
  | 'grammar_rule'
  | 'verb_conjugation'
  | 'numbers_dates_time'
  | 'expressions_idioms'
  | 'sentence_structure'
  | 'cultural_context'
  | 'listening_comprehension';
export type PronunciationScore = 'clear' | 'understandable' | 'unclear';
export type ModuleId = 'module-1' | 'module-2' | 'module-3' | 'module-4' | 'module-5' | 'module-6' | 'module-7' | 'module-8';
export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export interface LearningModule {
  id: ModuleId;
  title: string;
  subtitle: string;
  cefrLevel: CEFRLevel;
  description: string;
  outcomes: string[];
  lessonIds: string[];
  requiredLessonsToPass: number;
  checkpointPrompts: string[];
  difficulties: Difficulty[];
  order: number;
}

export interface ModuleProgress {
  currentModuleId: ModuleId;
  completedModules: ModuleId[];
  moduleCheckpoints: Record<ModuleId, {
    passed: boolean;
    attempts: number;
    lastAttemptAt?: string;
  }>;
  isConversational: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  level: UserLevel;
  goal: UserGoal;
  isPro: boolean;
  foundationCompleted: boolean;
  createdAt: string;
}

export interface CanonicalExample {
  french: string;
  english: string;
}

export interface GeneratedQuestion {
  type: GapPromptType;
  question: string;
  correctAnswer: string;
  choices?: string[];
  hint?: string;
}

export interface ConceptData {
  conceptLabel: string;
  teachingFocus: string;
  canonicalExamples: CanonicalExample[];
  questionPool: GeneratedQuestion[];
  cefrLevel?: CEFRLevel;
  extractedAt: string;
  contentType?: ContentType;
}

export interface FsrsState {
  stability: number;
  difficulty: number;
  reps: number;
  lapses: number;
  lastReviewAt?: string;
  dueAt: string;
}

export interface OriginalContext {
  sentence: string;
  translation?: string;
  sourceTab: 'read' | 'watch' | 'speak' | 'deck' | 'foundation' | 'listening';
  sourceContentId?: string;
  capturedAt: string;
  lastReExposedAt?: string;
  reExposureCount: number;
}

export interface ConfusionLink {
  partnerGapId: string;
  wrongPicks: number;
  lastConfusedAt: string;
  strength: number;
}

export interface GapItem {
  id: string;
  frenchWord: string;
  englishTranslation: string;
  explanation: string;
  exampleSentence: string;
  exampleTranslation: string;
  pronunciation?: string;
  userNote?: string;
  sourceContentId?: string;
  sourceType: 'reading' | 'speech' | 'foundation' | 'listening';
  gapType: GapType;
  category: GapCategory;
  difficulty: GapDifficulty;
  reviewCount: number;
  consecutiveCorrect: number;
  lastReviewedAt?: string;
  nextReviewAt: string;
  masteredAt?: string;
  createdAt: string;
  cefrLevel?: CEFRLevel;
  easeFactor: number;
  currentInterval: number;
  conceptData?: ConceptData;
  isFluencySuggestion?: boolean;
  contentType?: ContentType;
  pronunciationData?: {
    targetPhrase: string;
    slowAudioUrl?: string;
    syllableBreakdown?: string;
    tip?: string;
    problemSound?: string;
    attempts: number;
    lastScore?: PronunciationScore;
  };
  fsrs?: FsrsState;
  irtDifficulty?: number;
  originalContext?: OriginalContext;
  confusionLinks?: ConfusionLink[];
}

export interface ExerciseTypeStats {
  attempts: number;
  correct: number;
  delayedCorrect: number;
  delayedAttempts: number;
  lastUsedAt?: string;
}

export interface AdaptiveLearnerProfile {
  abilityTheta: number;
  thetaSamples: number;
  exerciseTypeStats: Partial<Record<GapPromptType, ExerciseTypeStats>>;
  lastUpdatedAt: string;
}

export interface GapPrompt {
  id: string;
  gapId: string;
  type: GapPromptType;
  question: string;
  correctAnswer: string;
  choices?: string[];
  hint?: string;
  category: GapCategory;
}

export interface GapLesson {
  id: string;
  title: string;
  category: GapCategory | 'mixed';
  gapIds: string[];
  prompts: GapPrompt[];
  createdAt: string;
  completedAt?: string;
  correctCount: number;
  totalCount: number;
}

export interface ContentItem {
  id: string;
  title: string;
  subtitle?: string;
  difficulty: Difficulty;
  estimatedMinutes: number;
  content: string;
  category: ContentCategory;
  region: Region;
  moduleId?: ModuleId;
  tags?: string[];
  author?: string;
  source?: string;
  isCompleted?: boolean;
  readingStats?: {
    gapsCreated: number;
    percentageWithoutHelp: number;
  };
}

export interface LessonReadingPassage {
  title: string;
  content: string;
  comprehensionQuestions: { question: string; answer: string; choices: string[] }[];
}

export interface LessonListeningPrompt {
  text: string;
  comprehensionQuestions: { question: string; answer: string; choices: string[] }[];
}

export type LessonPhase = 'learn' | 'listen' | 'read' | 'speak' | 'write' | 'gap_review';

export interface FoundationLesson {
  id: string;
  moduleId: ModuleId;
  title: string;
  subtitle: string;
  items: FoundationItem[];
  isCompleted: boolean;
  order: number;
  estimatedMinutes: number;
  speakingPrompts?: string[];
  writingTask?: {
    prompt: string;
    exampleResponse?: string;
  };
  pronunciationFocus?: string[];
  readingPassage?: LessonReadingPassage;
  listeningPrompt?: LessonListeningPrompt;
  phases: LessonPhase[];
}

export interface FoundationItem {
  id: string;
  french: string;
  english: string;
  audio?: string;
  type: 'phrase' | 'verb' | 'connector' | 'pattern' | 'politeness' | 'filler';
  pronunciationTip?: string;
  problemSounds?: string[];
  requiresPronunciationCheck?: boolean;
  contentType?: ContentType;
}

export interface SpeechSession {
  id: string;
  duration: number;
  actualDuration: number;
  gapsCaptured: string[];
  createdAt: string;
}

export interface SpeechGrammarError {
  id: string;
  incorrectText: string;
  correctedText: string;
  ruleName: string;
  ruleExplanation: string;
  sentence: string;
  exampleWhereOriginalWorks?: string;
  category: string;
  addedToDeck: boolean;
}

export interface SpeechFluencySuggestion {
  id: string;
  originalPhrase: string;
  suggestedPhrase: string;
  explanation: string;
  fullSentence: string;
  exampleWhereOriginalWorks: string;
  category: 'more_natural' | 'more_formal' | 'more_casual' | 'idiomatic' | 'clearer';
  isGrammarError: boolean;
  addedToDeck: boolean;
}

export interface UserProgress {
  readingSessions: number;
  averageReadingWithoutHelp: number;
  totalSpeakingMinutes: number;
  gapsCreated: number;
  gapsMastered: number;
  weeklyStats: {
    readingSessions: number;
    speakingMinutes: number;
    gapsCreated: number;
    gapsMastered: number;
  };
}

export interface SpeechRecordingLog {
  id: string;
  createdAt: string;
  prompt: string;
  duration: number;
  actualDuration: number;
  transcript: string;
  grammarErrors: SpeechGrammarError[];
  fluencySuggestions: SpeechFluencySuggestion[];
  gapsCaptured: number;
  audioData?: string;
}

export interface ProficiencyRecord {
  level: CEFRLevel;
  certifiedAt: string;
  score: number;
  attempts: number;
}

export interface ProficiencyState {
  certifiedLevels: CEFRLevel[];
  records: ProficiencyRecord[];
}

export interface ConceptCluster {
  id: string;
  name: string;
  description: string;
  category: GapCategory;
  cefrLevel?: CEFRLevel;
  gapIds: string[];
  weaknessScore: number;
  sampleItems: { french: string; english: string }[];
  conceptLabels: string[];
  gapCount: number;
  contentType?: ContentType;
}

export interface DynamicLessonTeachItem {
  type: 'explanation' | 'example' | 'tip';
  content: string;
  french?: string;
  english?: string;
}

export interface MatchPair {
  left: string;
  right: string;
}

export interface WildEncounterInfo {
  sourceTab: 'read' | 'watch' | 'speak' | 'deck' | 'foundation';
  context: string;
  daysAgo: number;
  contentId: string;
}

export interface DynamicLessonQuestion {
  id: string;
  type: GapPromptType;
  content: string;
  correctAnswer: string;
  choices?: string[];
  hint?: string;
  relatedGapId?: string;
  words?: string[];
  errorSentence?: string;
  correctedSentence?: string;
  pairs?: MatchPair[];
  scrambledWords?: string[];
  statement?: string;
  isTrue?: boolean;
  sourceText?: string;
  targetLanguage?: string;
  acceptableAnswers?: string[];
  listenText?: string;
  englishPrompt?: string;
  expectedFrench?: string;
  wildEncounter?: WildEncounterInfo;
  sequence?: string[];
  blankIndex?: number;
  audioText?: string;
}

export interface DynamicLesson {
  id: string;
  clusterId: string;
  title: string;
  subtitle: string;
  teachItems: DynamicLessonTeachItem[];
  practiceItems: DynamicLessonQuestion[];
  challengeItems: DynamicLessonQuestion[];
  createdAt: string;
  connectedWordsCount?: number;
}

export type WatchCategory = 'all' | 'news' | 'culture' | 'conversation' | 'cooking' | 'music' | 'documentary' | 'interview' | 'education';

export interface TranscriptSegment {
  id: string;
  text: string;
  start: number;
  duration: number;
}

export interface WatchVideo {
  id: string;
  youtubeId: string;
  title: string;
  channel: string;
  thumbnailUrl: string;
  durationSeconds: number;
  difficulty: Difficulty;
  region: Region;
  category: WatchCategory;
  description: string;
  tags: string[];
  isFeatured?: boolean;
}

export interface ConversationScenario {
  id: string;
  title: string;
  titleTranslated: string;
  description: string;
  icon: string;
  category: 'daily' | 'travel' | 'work' | 'social' | 'free';
  requiredLevel: CEFRLevel;
}

export interface ConversationMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  textContent: string;
  audioUrl?: string;
  pronunciationScore?: number;
  grammarErrors?: GrammarError[];
  vocabularyHighlights?: VocabularyHighlight[];
  fluencyMetrics?: FluencyMetrics;
  sequenceNumber: number;
  createdAt: string;
}

export interface ConversationSession {
  id: string;
  userId: string;
  scenarioId: string;
  targetLanguage: string;
  cefrLevelAtStart: CEFRLevel;
  durationSeconds: number;
  totalMessages: number;
  pronunciationScoreAvg: number;
  grammarScoreAvg: number;
  fluencyScoreAvg: number;
  overallScore: number;
  newVocabularyCount: number;
  status: 'active' | 'completed' | 'abandoned';
  createdAt: string;
  endedAt?: string;
  messages: ConversationMessage[];
}

export interface GrammarError {
  original: string;
  corrected: string;
  explanation: string;
  rule: string;
}

export interface VocabularyHighlight {
  word: string;
  translation: string;
  isNew: boolean;
  cefrLevel: CEFRLevel;
}

export interface FluencyMetrics {
  wordsPerMinute: number;
  hesitationCount: number;
  fillerWordCount: number;
  averageResponseTime: number;
}

export interface ConversationState {
  currentSession: ConversationSession | null;
  isRecording: boolean;
  isAiSpeaking: boolean;
  isProcessing: boolean;
  partialTranscript: string;
  messages: ConversationMessage[];
}
