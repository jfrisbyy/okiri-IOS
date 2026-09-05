export type AchievementCategory = 'streak' | 'mastery' | 'exploration' | 'milestone' | 'special';

export interface AchievementDefinition {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: AchievementCategory;
  hint: string;
  xpReward: number;
  condition: (state: AchievementCheckState) => boolean;
}

export interface EarnedAchievement {
  id: string;
  earnedAt: string;
  xpAwarded: number;
}

export interface AchievementCheckState {
  streakCount: number;
  totalXP: number;
  masteredCount: number;
  totalGaps: number;
  lessonsCompleted: number;
  readingSessions: number;
  totalSpeakingMinutes: number;
  recordingLogs: number;
  completedFoundationIds: string[];
  completedContentIds: string[];
  certifiedLevels: string[];
  pronFoundationCompleted: number;
  modulesCompleted: string[];
  tabsUsed: Set<string>;
  perfectLessons: number;
  maxConsecutiveCorrect: number;
  currentHour: number;
  dailyXP: number;
  lessonsCompletedToday: number;
  videosWatched: number;
  exercisePerformance: Record<string, { correct: number; total: number }>;
}

export const ACHIEVEMENTS: AchievementDefinition[] = [
  // === STREAK ===
  {
    id: 'streak_3',
    title: 'Getting Started',
    description: '3-day learning streak',
    icon: '🔥',
    category: 'streak',
    hint: 'Practice 3 days in a row',
    xpReward: 25,
    condition: (s) => s.streakCount >= 3,
  },
  {
    id: 'streak_7',
    title: 'Week Warrior',
    description: '7-day learning streak',
    icon: '🗓️',
    category: 'streak',
    hint: 'Practice 7 days in a row',
    xpReward: 50,
    condition: (s) => s.streakCount >= 7,
  },
  {
    id: 'streak_14',
    title: 'Fortnight Focus',
    description: '14-day learning streak',
    icon: '⚡',
    category: 'streak',
    hint: 'Practice 14 days in a row',
    xpReward: 100,
    condition: (s) => s.streakCount >= 14,
  },
  {
    id: 'streak_30',
    title: 'Monthly Master',
    description: '30-day learning streak',
    icon: '🌟',
    category: 'streak',
    hint: 'Practice 30 days in a row',
    xpReward: 200,
    condition: (s) => s.streakCount >= 30,
  },
  {
    id: 'streak_60',
    title: 'Two-Month Titan',
    description: '60-day learning streak',
    icon: '💎',
    category: 'streak',
    hint: 'Practice 60 days in a row',
    xpReward: 400,
    condition: (s) => s.streakCount >= 60,
  },
  {
    id: 'streak_100',
    title: 'Century Club',
    description: '100-day learning streak',
    icon: '👑',
    category: 'streak',
    hint: 'Practice 100 days in a row',
    xpReward: 750,
    condition: (s) => s.streakCount >= 100,
  },

  // === MASTERY ===
  {
    id: 'master_5',
    title: 'First Victories',
    description: 'Mastered 5 words',
    icon: '🌱',
    category: 'mastery',
    hint: 'Master 5 gap items through reviews',
    xpReward: 20,
    condition: (s) => s.masteredCount >= 5,
  },
  {
    id: 'master_10',
    title: 'Word Collector',
    description: 'Mastered 10 words',
    icon: '📖',
    category: 'mastery',
    hint: 'Master 10 gap items',
    xpReward: 40,
    condition: (s) => s.masteredCount >= 10,
  },
  {
    id: 'master_25',
    title: 'Vocabulary Builder',
    description: 'Mastered 25 words',
    icon: '📚',
    category: 'mastery',
    hint: 'Master 25 gap items',
    xpReward: 80,
    condition: (s) => s.masteredCount >= 25,
  },
  {
    id: 'master_50',
    title: 'Lexicon Legend',
    description: 'Mastered 50 words',
    icon: '🏅',
    category: 'mastery',
    hint: 'Master 50 gap items',
    xpReward: 150,
    condition: (s) => s.masteredCount >= 50,
  },
  {
    id: 'master_100',
    title: 'Word Wizard',
    description: 'Mastered 100 words',
    icon: '🧙',
    category: 'mastery',
    hint: 'Master 100 gap items',
    xpReward: 300,
    condition: (s) => s.masteredCount >= 100,
  },
  {
    id: 'master_200',
    title: 'Polyglot Power',
    description: 'Mastered 200 words',
    icon: '🦅',
    category: 'mastery',
    hint: 'Master 200 gap items',
    xpReward: 500,
    condition: (s) => s.masteredCount >= 200,
  },
  {
    id: 'gaps_50',
    title: 'Gap Hunter',
    description: 'Discovered 50 learning gaps',
    icon: '🔍',
    category: 'mastery',
    hint: 'Create 50 gap items from reading or speaking',
    xpReward: 60,
    condition: (s) => s.totalGaps >= 50,
  },

  // === EXPLORATION ===
  {
    id: 'first_read',
    title: 'Page Turner',
    description: 'Completed your first reading',
    icon: '📰',
    category: 'exploration',
    hint: 'Read your first article',
    xpReward: 15,
    condition: (s) => s.readingSessions >= 1,
  },
  {
    id: 'read_10',
    title: 'Avid Reader',
    description: 'Read 10 articles',
    icon: '📑',
    category: 'exploration',
    hint: 'Complete 10 reading sessions',
    xpReward: 75,
    condition: (s) => s.readingSessions >= 10,
  },
  {
    id: 'read_25',
    title: 'Bookworm',
    description: 'Read 25 articles',
    icon: '🐛',
    category: 'exploration',
    hint: 'Complete 25 reading sessions',
    xpReward: 150,
    condition: (s) => s.readingSessions >= 25,
  },
  {
    id: 'first_speak',
    title: 'Finding Your Voice',
    description: 'Completed your first speaking session',
    icon: '🎤',
    category: 'exploration',
    hint: 'Complete a speaking session',
    xpReward: 15,
    condition: (s) => s.totalSpeakingMinutes >= 1,
  },
  {
    id: 'speak_30',
    title: 'Conversationalist',
    description: '30 minutes of speaking practice',
    icon: '💬',
    category: 'exploration',
    hint: 'Accumulate 30 minutes of speaking',
    xpReward: 75,
    condition: (s) => s.totalSpeakingMinutes >= 30,
  },
  {
    id: 'speak_120',
    title: 'Chatterbox',
    description: '2 hours of speaking practice',
    icon: '🗣️',
    category: 'exploration',
    hint: 'Accumulate 2 hours of speaking',
    xpReward: 200,
    condition: (s) => s.totalSpeakingMinutes >= 120,
  },
  {
    id: 'first_video',
    title: 'Tuned In',
    description: 'Watched your first French video',
    icon: '📺',
    category: 'exploration',
    hint: 'Watch a video in the Watch tab',
    xpReward: 15,
    condition: (s) => s.videosWatched >= 1,
  },
  {
    id: 'video_10',
    title: 'Binge Watcher',
    description: 'Watched 10 French videos',
    icon: '🎬',
    category: 'exploration',
    hint: 'Watch 10 videos',
    xpReward: 100,
    condition: (s) => s.videosWatched >= 10,
  },
  {
    id: 'pron_5',
    title: 'Sound Student',
    description: 'Completed 5 pronunciation lessons',
    icon: '🔊',
    category: 'exploration',
    hint: 'Pass 5 pronunciation lessons',
    xpReward: 60,
    condition: (s) => s.pronFoundationCompleted >= 5,
  },
  {
    id: 'first_recording',
    title: 'On the Record',
    description: 'Made your first recording',
    icon: '🎙️',
    category: 'exploration',
    hint: 'Record yourself speaking French',
    xpReward: 15,
    condition: (s) => s.recordingLogs >= 1,
  },

  // === MILESTONE ===
  {
    id: 'xp_500',
    title: 'Rising Star',
    description: 'Earned 500 XP',
    icon: '⭐',
    category: 'milestone',
    hint: 'Accumulate 500 XP',
    xpReward: 25,
    condition: (s) => s.totalXP >= 500,
  },
  {
    id: 'xp_1000',
    title: 'XP Thousandaire',
    description: 'Earned 1,000 XP',
    icon: '🌠',
    category: 'milestone',
    hint: 'Accumulate 1,000 XP',
    xpReward: 50,
    condition: (s) => s.totalXP >= 1000,
  },
  {
    id: 'xp_5000',
    title: 'XP Mogul',
    description: 'Earned 5,000 XP',
    icon: '💰',
    category: 'milestone',
    hint: 'Accumulate 5,000 XP',
    xpReward: 150,
    condition: (s) => s.totalXP >= 5000,
  },
  {
    id: 'xp_10000',
    title: 'XP Legend',
    description: 'Earned 10,000 XP',
    icon: '🏆',
    category: 'milestone',
    hint: 'Accumulate 10,000 XP',
    xpReward: 300,
    condition: (s) => s.totalXP >= 10000,
  },
  {
    id: 'cert_a2',
    title: 'A2 Certified',
    description: 'Reached A2 proficiency level',
    icon: '🎓',
    category: 'milestone',
    hint: 'Pass the A2 proficiency test',
    xpReward: 200,
    condition: (s) => s.certifiedLevels.includes('A2'),
  },
  {
    id: 'cert_b1',
    title: 'B1 Breakthrough',
    description: 'Reached B1 proficiency level',
    icon: '🎖️',
    category: 'milestone',
    hint: 'Pass the B1 proficiency test',
    xpReward: 400,
    condition: (s) => s.certifiedLevels.includes('B1'),
  },
  {
    id: 'cert_b2',
    title: 'B2 Independent',
    description: 'Reached B2 proficiency level',
    icon: '🏛️',
    category: 'milestone',
    hint: 'Pass the B2 proficiency test',
    xpReward: 750,
    condition: (s) => s.certifiedLevels.includes('B2'),
  },
  {
    id: 'module_complete',
    title: 'Module Graduate',
    description: 'Completed your first learning module',
    icon: '🎒',
    category: 'milestone',
    hint: 'Finish all lessons in a module',
    xpReward: 100,
    condition: (s) => s.modulesCompleted.length >= 1,
  },

  // === SPECIAL ===
  {
    id: 'perfect_lesson',
    title: 'Flawless',
    description: 'Scored 100% on a lesson',
    icon: '💯',
    category: 'special',
    hint: 'Get every answer right in a lesson',
    xpReward: 50,
    condition: (s) => s.perfectLessons >= 1,
  },
  {
    id: 'ten_streak',
    title: 'On Fire',
    description: '10 correct answers in a row',
    icon: '🔥',
    category: 'special',
    hint: 'Get 10 consecutive correct answers',
    xpReward: 40,
    condition: (s) => s.maxConsecutiveCorrect >= 10,
  },
  {
    id: 'night_owl',
    title: 'Night Owl',
    description: 'Practiced after midnight',
    icon: '🦉',
    category: 'special',
    hint: 'Study between midnight and 4 AM',
    xpReward: 30,
    condition: (s) => s.currentHour >= 0 && s.currentHour < 4 && s.lessonsCompletedToday > 0,
  },
  {
    id: 'early_bird',
    title: 'Early Bird',
    description: 'Practiced before 6 AM',
    icon: '🐦',
    category: 'special',
    hint: 'Study between 4 AM and 6 AM',
    xpReward: 30,
    condition: (s) => s.currentHour >= 4 && s.currentHour < 6 && s.lessonsCompletedToday > 0,
  },
  {
    id: 'daily_overachiever',
    title: 'Overachiever',
    description: 'Earned 200+ XP in a single day',
    icon: '🚀',
    category: 'special',
    hint: 'Earn over 200 XP in one day',
    xpReward: 60,
    condition: (s) => s.dailyXP >= 200,
  },
  {
    id: 'triple_threat',
    title: 'Triple Threat',
    description: 'Read, spoke, and reviewed in one day',
    icon: '🎯',
    category: 'special',
    hint: 'Use reading, speaking, and review in the same day',
    xpReward: 50,
    condition: (s) => s.lessonsCompletedToday >= 1 && s.readingSessions >= 1 && s.totalSpeakingMinutes >= 1,
  },
];

export const ACHIEVEMENT_CATEGORIES: { id: AchievementCategory; label: string; color: string }[] = [
  { id: 'streak', label: 'Streak', color: '#F59E0B' },
  { id: 'mastery', label: 'Mastery', color: '#10B981' },
  { id: 'exploration', label: 'Exploration', color: '#3B82F6' },
  { id: 'milestone', label: 'Milestone', color: '#8B5CF6' },
  { id: 'special', label: 'Special', color: '#EF4444' },
];
