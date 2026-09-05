import { supabase } from '@/lib/supabase';
import type {
  User,
  GapItem,
  UserProgress,
  ModuleProgress,
  SpeechRecordingLog,
  ProficiencyState,
  ProficiencyRecord,
} from '@/types';
import type { ErrorEntry } from '@/utils/errorHistoryStore';
import type { EarnedAchievement } from '@/data/achievements';
import type { AchievementCounters } from '@/utils/achievementChecker';

interface GameState {
  totalXP: number;
  dailyXP: number;
  streakCount: number;
  lastActiveDate: string;
  hearts: number;
  dailyGoalXP: number;
  personalBests: Record<string, { bestAccuracy: number; bestStreak: number }>;
  lessonsCompletedToday: number;
  comboMultiplier: number;
  lastHeartLostAt: string;
  milestonesShown: Record<string, boolean>;
  previousStreakCount: number;
  streakBrokenAcknowledged: boolean;
}

export async function syncProfileToSupabase(userId: string, userData: User): Promise<void> {
  try {
    const { error } = await supabase.from('profiles').upsert({
      id: userId,
      name: userData.name,
      email: userData.email,
      level: userData.level,
      goal: userData.goal,
      is_pro: userData.isPro,
      foundation_completed: userData.foundationCompleted,
      created_at: userData.createdAt,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });
    if (error) throw error;
    console.log('[SupaSync] Profile synced');
  } catch (e) {
    console.log('[SupaSync] Error syncing profile:', e);
  }
}

export async function loadProfileFromSupabase(userId: string): Promise<User | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (error || !data) return null;
    return {
      id: data.id,
      name: data.name || '',
      email: data.email || '',
      level: data.level || 'none',
      goal: data.goal || 'curious',
      isPro: data.is_pro || false,
      foundationCompleted: data.foundation_completed || false,
      createdAt: data.created_at || new Date().toISOString(),
    };
  } catch (e) {
    console.log('[SupaSync] Error loading profile:', e);
    return null;
  }
}

export async function syncGapItemsToSupabase(userId: string, gaps: GapItem[]): Promise<void> {
  try {
    if (gaps.length === 0) return;
    const rows = gaps.map(gap => ({
      id: gap.id,
      user_id: userId,
      french_word: gap.frenchWord,
      english_translation: gap.englishTranslation,
      explanation: gap.explanation,
      example_sentence: gap.exampleSentence,
      example_translation: gap.exampleTranslation,
      pronunciation: gap.pronunciation || null,
      user_note: gap.userNote || null,
      source_content_id: gap.sourceContentId || null,
      source_type: gap.sourceType,
      gap_type: gap.gapType,
      category: gap.category,
      difficulty: gap.difficulty,
      review_count: gap.reviewCount,
      consecutive_correct: gap.consecutiveCorrect,
      ease_factor: gap.easeFactor,
      current_interval: gap.currentInterval,
      next_review_at: gap.nextReviewAt,
      last_reviewed_at: gap.lastReviewedAt || null,
      mastered_at: gap.masteredAt || null,
      created_at: gap.createdAt,
      cefr_level: gap.cefrLevel || null,
      concept_data: gap.conceptData || null,
      is_fluency_suggestion: gap.isFluencySuggestion || false,
      pronunciation_data: gap.pronunciationData || null,
    }));

    const batchSize = 100;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const { error } = await supabase.from('gap_items').upsert(batch, { onConflict: 'id,user_id' });
      if (error) throw error;
    }
    console.log('[SupaSync] Gap items synced:', gaps.length);
  } catch (e) {
    console.log('[SupaSync] Error syncing gap items:', e);
  }
}

export async function loadGapItemsFromSupabase(userId: string): Promise<GapItem[] | null> {
  try {
    const { data, error } = await supabase
      .from('gap_items')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    if (!data || data.length === 0) return null;
    return data.map((row: any) => ({
      id: row.id,
      frenchWord: row.french_word,
      englishTranslation: row.english_translation,
      explanation: row.explanation,
      exampleSentence: row.example_sentence,
      exampleTranslation: row.example_translation,
      pronunciation: row.pronunciation || undefined,
      userNote: row.user_note || undefined,
      sourceContentId: row.source_content_id || undefined,
      sourceType: row.source_type,
      gapType: row.gap_type,
      category: row.category,
      difficulty: row.difficulty,
      reviewCount: row.review_count || 0,
      consecutiveCorrect: row.consecutive_correct || 0,
      easeFactor: row.ease_factor ?? 2.5,
      currentInterval: row.current_interval ?? 0,
      nextReviewAt: row.next_review_at || new Date().toISOString(),
      lastReviewedAt: row.last_reviewed_at || undefined,
      masteredAt: row.mastered_at || undefined,
      createdAt: row.created_at,
      cefrLevel: row.cefr_level || undefined,
      conceptData: row.concept_data || undefined,
      isFluencySuggestion: row.is_fluency_suggestion || false,
      pronunciationData: row.pronunciation_data || undefined,
    }));
  } catch (e) {
    console.log('[SupaSync] Error loading gap items:', e);
    return null;
  }
}

export async function syncGameStateToSupabase(userId: string, gameState: GameState): Promise<void> {
  try {
    const { error } = await supabase.from('game_state').upsert({
      user_id: userId,
      total_xp: gameState.totalXP,
      daily_xp: gameState.dailyXP,
      streak_count: gameState.streakCount,
      last_active_date: gameState.lastActiveDate,
      hearts: gameState.hearts,
      daily_goal_xp: gameState.dailyGoalXP,
      personal_bests: gameState.personalBests,
      lessons_completed_today: gameState.lessonsCompletedToday,
      combo_multiplier: gameState.comboMultiplier,
      last_heart_lost_at: gameState.lastHeartLostAt,
      milestones_shown: gameState.milestonesShown,
      previous_streak_count: gameState.previousStreakCount,
      streak_broken_acknowledged: gameState.streakBrokenAcknowledged,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    if (error) throw error;
    console.log('[SupaSync] Game state synced');
  } catch (e) {
    console.log('[SupaSync] Error syncing game state:', e);
  }
}

export async function loadGameStateFromSupabase(userId: string): Promise<GameState | null> {
  try {
    const { data, error } = await supabase
      .from('game_state')
      .select('*')
      .eq('user_id', userId)
      .single();
    if (error || !data) return null;
    return {
      totalXP: data.total_xp || 0,
      dailyXP: data.daily_xp || 0,
      streakCount: data.streak_count || 0,
      lastActiveDate: data.last_active_date || '',
      hearts: data.hearts ?? 5,
      dailyGoalXP: data.daily_goal_xp || 50,
      personalBests: data.personal_bests || {},
      lessonsCompletedToday: data.lessons_completed_today || 0,
      comboMultiplier: data.combo_multiplier || 1,
      lastHeartLostAt: data.last_heart_lost_at || '',
      milestonesShown: data.milestones_shown || {},
      previousStreakCount: data.previous_streak_count || 0,
      streakBrokenAcknowledged: data.streak_broken_acknowledged ?? true,
    };
  } catch (e) {
    console.log('[SupaSync] Error loading game state:', e);
    return null;
  }
}

export async function syncUserProgressToSupabase(userId: string, progress: UserProgress): Promise<void> {
  try {
    const { error } = await supabase.from('user_progress').upsert({
      user_id: userId,
      reading_sessions: progress.readingSessions,
      average_reading_without_help: progress.averageReadingWithoutHelp,
      total_speaking_minutes: progress.totalSpeakingMinutes,
      gaps_created: progress.gapsCreated,
      gaps_mastered: progress.gapsMastered,
      weekly_stats: progress.weeklyStats,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    if (error) throw error;
    console.log('[SupaSync] User progress synced');
  } catch (e) {
    console.log('[SupaSync] Error syncing user progress:', e);
  }
}

export async function loadUserProgressFromSupabase(userId: string): Promise<UserProgress | null> {
  try {
    const { data, error } = await supabase
      .from('user_progress')
      .select('*')
      .eq('user_id', userId)
      .single();
    if (error || !data) return null;
    return {
      readingSessions: data.reading_sessions || 0,
      averageReadingWithoutHelp: data.average_reading_without_help || 0,
      totalSpeakingMinutes: data.total_speaking_minutes || 0,
      gapsCreated: data.gaps_created || 0,
      gapsMastered: data.gaps_mastered || 0,
      weeklyStats: data.weekly_stats || {
        readingSessions: 0,
        speakingMinutes: 0,
        gapsCreated: 0,
        gapsMastered: 0,
      },
    };
  } catch (e) {
    console.log('[SupaSync] Error loading user progress:', e);
    return null;
  }
}

export async function syncModuleProgressToSupabase(userId: string, moduleProgress: ModuleProgress): Promise<void> {
  try {
    const { error } = await supabase.from('module_progress').upsert({
      user_id: userId,
      current_module_id: moduleProgress.currentModuleId,
      completed_modules: moduleProgress.completedModules,
      module_checkpoints: moduleProgress.moduleCheckpoints,
      is_conversational: moduleProgress.isConversational,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    if (error) throw error;
    console.log('[SupaSync] Module progress synced');
  } catch (e) {
    console.log('[SupaSync] Error syncing module progress:', e);
  }
}

export async function loadModuleProgressFromSupabase(userId: string): Promise<ModuleProgress | null> {
  try {
    const { data, error } = await supabase
      .from('module_progress')
      .select('*')
      .eq('user_id', userId)
      .single();
    if (error || !data) return null;
    return {
      currentModuleId: data.current_module_id || 'module-1',
      completedModules: data.completed_modules || [],
      moduleCheckpoints: data.module_checkpoints || {},
      isConversational: data.is_conversational || false,
    };
  } catch (e) {
    console.log('[SupaSync] Error loading module progress:', e);
    return null;
  }
}

export async function syncSpeechRecordingsToSupabase(userId: string, recordings: SpeechRecordingLog[]): Promise<void> {
  try {
    if (recordings.length === 0) return;
    const rows = recordings.map(rec => ({
      id: rec.id,
      user_id: userId,
      created_at: rec.createdAt,
      prompt: rec.prompt,
      duration: rec.duration,
      actual_duration: rec.actualDuration,
      transcript: rec.transcript,
      grammar_errors: rec.grammarErrors,
      fluency_suggestions: rec.fluencySuggestions,
      gaps_captured: rec.gapsCaptured,
      audio_data: rec.audioData || null,
    }));

    const batchSize = 50;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const { error } = await supabase.from('speech_recordings').upsert(batch, { onConflict: 'id,user_id' });
      if (error) throw error;
    }
    console.log('[SupaSync] Speech recordings synced:', recordings.length);
  } catch (e) {
    console.log('[SupaSync] Error syncing speech recordings:', e);
  }
}

export async function loadSpeechRecordingsFromSupabase(userId: string): Promise<SpeechRecordingLog[] | null> {
  try {
    const { data, error } = await supabase
      .from('speech_recordings')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    if (!data || data.length === 0) return null;
    return data.map((row: any) => ({
      id: row.id,
      createdAt: row.created_at,
      prompt: row.prompt,
      duration: row.duration,
      actualDuration: row.actual_duration,
      transcript: row.transcript,
      grammarErrors: row.grammar_errors || [],
      fluencySuggestions: row.fluency_suggestions || [],
      gapsCaptured: row.gaps_captured || 0,
      audioData: row.audio_data || undefined,
    }));
  } catch (e) {
    console.log('[SupaSync] Error loading speech recordings:', e);
    return null;
  }
}

export async function syncAchievementsToSupabase(
  userId: string,
  achievements: EarnedAchievement[],
  counters: AchievementCounters
): Promise<void> {
  try {
    if (achievements.length > 0) {
      const rows = achievements.map(a => ({
        id: a.id,
        user_id: userId,
        earned_at: a.earnedAt,
        xp_awarded: a.xpAwarded,
      }));

      const batchSize = 50;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const { error } = await supabase.from('achievements').upsert(batch, { onConflict: 'id,user_id' });
        if (error) throw error;
      }
    }

    const { error: counterError } = await supabase.from('achievement_counters').upsert({
      user_id: userId,
      perfect_lessons: counters.perfectLessons,
      max_consecutive_correct: counters.maxConsecutiveCorrect,
      videos_watched: counters.videosWatched,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    if (counterError) throw counterError;

    console.log('[SupaSync] Achievements synced:', achievements.length);
  } catch (e) {
    console.log('[SupaSync] Error syncing achievements:', e);
  }
}

export async function loadAchievementsFromSupabase(userId: string): Promise<{ achievements: EarnedAchievement[]; counters: AchievementCounters } | null> {
  try {
    const [achievementsResult, countersResult] = await Promise.all([
      supabase.from('achievements').select('*').eq('user_id', userId),
      supabase.from('achievement_counters').select('*').eq('user_id', userId).single(),
    ]);

    if (achievementsResult.error && countersResult.error) return null;

    const achievements: EarnedAchievement[] = (achievementsResult.data || []).map((row: any) => ({
      id: row.id,
      earnedAt: row.earned_at,
      xpAwarded: row.xp_awarded || 0,
    }));

    const counters: AchievementCounters = countersResult.data ? {
      perfectLessons: countersResult.data.perfect_lessons || 0,
      maxConsecutiveCorrect: countersResult.data.max_consecutive_correct || 0,
      videosWatched: countersResult.data.videos_watched || 0,
    } : { perfectLessons: 0, maxConsecutiveCorrect: 0, videosWatched: 0 };

    return { achievements, counters };
  } catch (e) {
    console.log('[SupaSync] Error loading achievements:', e);
    return null;
  }
}

export async function syncProficiencyToSupabase(userId: string, proficiency: ProficiencyState): Promise<void> {
  try {
    const { error: stateError } = await supabase.from('proficiency_state').upsert({
      user_id: userId,
      certified_levels: proficiency.certifiedLevels,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    if (stateError) throw stateError;

    if (proficiency.records.length > 0) {
      const rows = proficiency.records.map(r => ({
        user_id: userId,
        level: r.level,
        certified_at: r.certifiedAt,
        score: r.score,
        attempts: r.attempts,
      }));
      const { error: recError } = await supabase
        .from('proficiency_records')
        .upsert(rows, { onConflict: 'user_id,level' });
      if (recError) throw recError;
    }

    console.log('[SupaSync] Proficiency synced');
  } catch (e) {
    console.log('[SupaSync] Error syncing proficiency:', e);
  }
}

export async function loadProficiencyFromSupabase(userId: string): Promise<ProficiencyState | null> {
  try {
    const [stateResult, recordsResult] = await Promise.all([
      supabase.from('proficiency_state').select('*').eq('user_id', userId).single(),
      supabase.from('proficiency_records').select('*').eq('user_id', userId),
    ]);

    if (stateResult.error && recordsResult.error) return null;

    const certifiedLevels = stateResult.data?.certified_levels || [];
    const records: ProficiencyRecord[] = (recordsResult.data || []).map((row: any) => ({
      level: row.level,
      certifiedAt: row.certified_at || '',
      score: row.score || 0,
      attempts: row.attempts || 0,
    }));

    return { certifiedLevels, records };
  } catch (e) {
    console.log('[SupaSync] Error loading proficiency:', e);
    return null;
  }
}

export async function syncConversationSessionToSupabase(
  userId: string,
  session: {
    id: string;
    scenarioId: string;
    targetLanguage: string;
    cefrLevelAtStart: string;
    durationSeconds: number;
    totalMessages: number;
    pronunciationScoreAvg: number;
    grammarScoreAvg: number;
    fluencyScoreAvg: number;
    overallScore: number;
    newVocabularyCount: number;
    status: string;
    createdAt: string;
    endedAt?: string;
  }
): Promise<void> {
  try {
    const { error } = await supabase.from('conversation_sessions').upsert({
      id: session.id,
      user_id: userId,
      scenario_id: session.scenarioId,
      target_language: session.targetLanguage,
      cefr_level_at_start: session.cefrLevelAtStart,
      duration_seconds: session.durationSeconds,
      total_messages: session.totalMessages,
      pronunciation_score_avg: session.pronunciationScoreAvg,
      grammar_score_avg: session.grammarScoreAvg,
      fluency_score_avg: session.fluencyScoreAvg,
      overall_score: session.overallScore,
      new_vocabulary_count: session.newVocabularyCount,
      status: session.status,
      created_at: session.createdAt,
      ended_at: session.endedAt || null,
    }, { onConflict: 'id' });
    if (error) throw error;
    console.log('[SupaSync] Conversation session synced:', session.id);
  } catch (e) {
    console.log('[SupaSync] Error syncing conversation session:', e);
  }
}

export async function syncConversationMessagesToSupabase(
  messages: {
    id: string;
    sessionId: string;
    role: string;
    textContent: string;
    pronunciationScore?: number;
    grammarErrors?: unknown;
    vocabularyHighlights?: unknown;
    fluencyMetrics?: unknown;
    sequenceNumber: number;
    createdAt: string;
  }[]
): Promise<void> {
  try {
    if (messages.length === 0) return;
    const rows = messages.map(m => ({
      id: m.id,
      session_id: m.sessionId,
      role: m.role,
      text_content: m.textContent,
      pronunciation_score: m.pronunciationScore ?? null,
      grammar_errors: m.grammarErrors ?? null,
      vocabulary_highlights: m.vocabularyHighlights ?? null,
      fluency_metrics: m.fluencyMetrics ?? null,
      sequence_number: m.sequenceNumber,
      created_at: m.createdAt,
    }));

    const batchSize = 50;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const { error } = await supabase.from('conversation_messages').upsert(batch, { onConflict: 'id' });
      if (error) throw error;
    }
    console.log('[SupaSync] Conversation messages synced:', messages.length);
  } catch (e) {
    console.log('[SupaSync] Error syncing conversation messages:', e);
  }
}

const ERROR_SYNC_KEY = 'okiri_error_sync_timestamp';

export async function syncErrorHistoryToSupabase(userId: string, errors: ErrorEntry[]): Promise<void> {
  try {
    if (errors.length === 0) return;

    const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
    const lastSyncRaw = await AsyncStorage.getItem(ERROR_SYNC_KEY + '_' + userId);
    const lastSyncTimestamp = lastSyncRaw || '1970-01-01T00:00:00.000Z';

    const newErrors = errors.filter(e => e.timestamp > lastSyncTimestamp);
    if (newErrors.length === 0) {
      console.log('[SupaSync] No new errors to sync');
      return;
    }

    const rows = newErrors.map(err => ({
      user_id: userId,
      concept_id: err.conceptId,
      error_type: err.errorType,
      wrong_answer: err.wrongAnswer,
      correct_answer: err.correctAnswer,
      question_type: err.questionType,
      created_at: err.timestamp,
    }));

    const batchSize = 50;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const { error } = await supabase.from('error_history').insert(batch);
      if (error) throw error;
    }

    await AsyncStorage.setItem(ERROR_SYNC_KEY + '_' + userId, new Date().toISOString());
    console.log('[SupaSync] Error history synced:', newErrors.length, 'new errors');
  } catch (e) {
    console.log('[SupaSync] Error syncing error history:', e);
  }
}

export async function loadErrorHistoryFromSupabase(userId: string): Promise<ErrorEntry[] | null> {
  try {
    const { data, error } = await supabase
      .from('error_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw error;
    if (!data || data.length === 0) return null;
    return data.map((row: any) => ({
      errorType: row.error_type,
      wrongAnswer: row.wrong_answer,
      correctAnswer: row.correct_answer,
      questionType: row.question_type,
      conceptId: row.concept_id,
      timestamp: row.created_at,
    }));
  } catch (e) {
    console.log('[SupaSync] Error loading error history:', e);
    return null;
  }
}

export async function syncAllToSupabase(
  userId: string,
  data: {
    user?: User;
    gaps?: GapItem[];
    gameState?: GameState;
    progress?: UserProgress;
    moduleProgress?: ModuleProgress;
    recordings?: SpeechRecordingLog[];
    achievements?: EarnedAchievement[];
    achievementCounters?: AchievementCounters;
    proficiency?: ProficiencyState;
  }
): Promise<void> {
  const promises: Promise<void>[] = [];

  if (data.user) promises.push(syncProfileToSupabase(userId, data.user));
  if (data.gaps) promises.push(syncGapItemsToSupabase(userId, data.gaps));
  if (data.gameState) promises.push(syncGameStateToSupabase(userId, data.gameState));
  if (data.progress) promises.push(syncUserProgressToSupabase(userId, data.progress));
  if (data.moduleProgress) promises.push(syncModuleProgressToSupabase(userId, data.moduleProgress));
  if (data.recordings) promises.push(syncSpeechRecordingsToSupabase(userId, data.recordings));
  if (data.achievements && data.achievementCounters) {
    promises.push(syncAchievementsToSupabase(userId, data.achievements, data.achievementCounters));
  }
  if (data.proficiency) promises.push(syncProficiencyToSupabase(userId, data.proficiency));

  await Promise.allSettled(promises);
  console.log('[SupaSync] Full sync complete');
}
