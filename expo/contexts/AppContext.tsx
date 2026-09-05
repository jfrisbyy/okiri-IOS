import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  User, 
  GapItem, 
  UserLevel, 
  UserGoal, 
  GapDifficulty,
  GapType,
  GapCategory,
  UserProgress,
  ModuleProgress,
  ModuleId,
  SpeechRecordingLog,
  SpeechGrammarError,
  SpeechFluencySuggestion,
  CEFRLevel,
  ProficiencyRecord,
  ProficiencyState,
} from '@/types';
import { extractConceptFromGap, reExtractConceptsForAllGaps } from '@/utils/conceptExtractor';
import { EarnedAchievement } from '@/data/achievements';
import { checkAchievements, buildCheckState, loadAchievements, saveAchievements, loadCounters, AchievementCounters, incrementCounter } from '@/utils/achievementChecker';
import { ExercisePerformance, recordExerciseResult } from '@/utils/exerciseSelector';
import type { ConversationSession } from '@/types';
import { saveAudioToFile, deleteAudioFile, migrateBase64ToFile, isBase64DataUrl, isSegmentJson } from '@/utils/audioFileStorage';
import { getRequiredCertificationForModule } from '@/utils/proficiency';
import { updateSrsData, mapCorrectnessToQuality, updateSrsAnki, SrsQuality } from '@/utils/srs';
import { updateFsrs, mapCorrectnessToGrade, initialFsrs } from '@/utils/fsrs';
import type { AdaptiveLearnerProfile, GapPromptType } from '@/types';
import { defaultProfile as defaultAdaptiveProfile, initialDifficultyForGap, updateIrt } from '@/utils/irtCalibration';
import { recordImmediate as banditRecordImmediate, recordDelayed as banditRecordDelayed, isDelayedWindow } from '@/utils/exerciseTypeBandit';
import { recordConfusion } from '@/utils/confusionModel';
import { markReExposed, captureOriginalContext } from '@/utils/contextReExposure';
import type { OriginalContext } from '@/types';
import {
  getGapScheduleSummary,
  classifyGapUrgency,
  shouldForceGapReview,
  getReactivationData,
  getGapHealthScore,
  getGapsForLessonInjection,
  GapScheduleSummary,
  GapUrgencyInfo,
  LessonInjection,
} from '@/utils/gapScheduler';
import { useAuth } from '@/contexts/AuthContext';
import {
  syncProfileToSupabase,
  loadProfileFromSupabase,
  syncGapItemsToSupabase,
  loadGapItemsFromSupabase,
  syncGameStateToSupabase,
  loadGameStateFromSupabase,
  syncUserProgressToSupabase,
  loadUserProgressFromSupabase,
  syncModuleProgressToSupabase,
  loadModuleProgressFromSupabase,
  syncSpeechRecordingsToSupabase,
  loadSpeechRecordingsFromSupabase,
  syncAchievementsToSupabase,
  loadAchievementsFromSupabase,
  syncProficiencyToSupabase,
  loadProficiencyFromSupabase,
  syncAllToSupabase,
  syncConversationSessionToSupabase,
  syncConversationMessagesToSupabase,
  syncErrorHistoryToSupabase,
  loadErrorHistoryFromSupabase,
} from '@/lib/supabaseSync';
import { getRecentErrors, addError as addErrorToStore } from '@/utils/errorHistoryStore';

function mapGapTypeToCategory(gapType: GapType): GapCategory {
  switch (gapType) {
    case 'vocab':
      return 'vocabulary';
    case 'grammar':
      return 'grammar';
    case 'pronunciation':
      return 'pronunciation';
    case 'politeness':
      return 'register';
    case 'connector':
    case 'filler':
      return 'phrasing';
    default:
      return 'vocabulary';
  }
}

function migrateGapItem(gap: any): GapItem {
  const reviewCount = gap.reviewCount ?? 0;
  const consecutiveCorrect = gap.consecutiveCorrect ?? 0;

  let nextReviewAt = gap.nextReviewAt;
  if (!nextReviewAt) {
    if (reviewCount > 0 && gap.lastReviewedAt) {
      const lastReview = new Date(gap.lastReviewedAt);
      lastReview.setDate(lastReview.getDate() + Math.max(1, reviewCount));
      nextReviewAt = lastReview.toISOString();
    } else {
      nextReviewAt = new Date().toISOString();
    }
  }

  const cefrLevel = gap.cefrLevel || (gap.conceptData?.cefrLevel) || undefined;

  return {
    ...gap,
    category: gap.category || mapGapTypeToCategory(gap.gapType || 'vocab'),
    reviewCount,
    consecutiveCorrect,
    easeFactor: gap.easeFactor ?? 2.5,
    currentInterval: gap.currentInterval ?? (reviewCount > 0 ? Math.max(1, reviewCount) : 0),
    nextReviewAt,
    cefrLevel,
    fsrs: gap.fsrs ?? (gap.reviewCount > 0 ? {
      stability: Math.max(1, gap.currentInterval || 1),
      difficulty: 5,
      reps: gap.reviewCount,
      lapses: 0,
      lastReviewAt: gap.lastReviewedAt,
      dueAt: nextReviewAt,
    } : initialFsrs()),
    irtDifficulty: gap.irtDifficulty,
    originalContext: gap.originalContext,
    confusionLinks: gap.confusionLinks ?? [],
  };
}

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

const DEFAULT_GAME_STATE: GameState = {
  totalXP: 0,
  dailyXP: 0,
  streakCount: 0,
  lastActiveDate: '',
  hearts: 5,
  dailyGoalXP: 50,
  personalBests: {},
  lessonsCompletedToday: 0,
  comboMultiplier: 1,
  lastHeartLostAt: '',
  milestonesShown: {},
  previousStreakCount: 0,
  streakBrokenAcknowledged: true,
};

const STORAGE_KEYS = {
  user: 'okiri_user',
  gaps: 'okiri_gaps',
  progress: 'okiri_progress',
  completedContent: 'okiri_completed_content',
  foundationProgress: 'okiri_foundation',
  moduleProgress: 'okiri_module_progress',
  recordingLogs: 'okiri_recording_logs',
  proficiency: 'okiri_proficiency',
  pronFoundation: 'okiri_pron_foundation',
  gameState: 'okiri_game_state',
  exercisePerformance: 'okiri_exercise_performance',
  achievements: 'okiri_achievements',
  achievementCounters: 'okiri_achievement_counters',
  adaptiveProfile: 'okiri_adaptive_profile',
};

function isConsecutiveDay(lastDate: string, today: string): boolean {
  if (!lastDate) return false;
  const last = new Date(lastDate);
  const now = new Date(today);
  const diff = now.getTime() - last.getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  return diff > 0 && diff <= dayMs;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function getNextReviewDate(difficulty: GapDifficulty, reviewCount: number): string {
  const now = new Date();
  let daysToAdd = 1;
  
  if (difficulty === 'easy') {
    daysToAdd = Math.min(7 * (reviewCount + 1), 30);
  } else if (difficulty === 'okay') {
    daysToAdd = Math.min(3 * (reviewCount + 1), 14);
  } else {
    daysToAdd = 1;
  }
  
  now.setDate(now.getDate() + daysToAdd);
  return now.toISOString();
}

const MIGRATION_KEY = 'okiri_supabase_migrated';

export const [AppProvider, useApp] = createContextHook(() => {
  const { user: authUser, isAuthenticated } = useAuth();
  const authUserIdRef = useRef<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [gaps, setGaps] = useState<GapItem[]>([]);
  const [progress, setProgress] = useState<UserProgress>({
    readingSessions: 0,
    averageReadingWithoutHelp: 0,
    totalSpeakingMinutes: 0,
    gapsCreated: 0,
    gapsMastered: 0,
    weeklyStats: {
      readingSessions: 0,
      speakingMinutes: 0,
      gapsCreated: 0,
      gapsMastered: 0,
    },
  });
  const [completedContentIds, setCompletedContentIds] = useState<string[]>([]);
  const [completedFoundationIds, setCompletedFoundationIds] = useState<string[]>([]);
  const [moduleProgress, setModuleProgress] = useState<ModuleProgress>({
    currentModuleId: 'module-1',
    completedModules: [],
    moduleCheckpoints: {
      'module-1': { passed: false, attempts: 0 },
      'module-2': { passed: false, attempts: 0 },
      'module-3': { passed: false, attempts: 0 },
      'module-4': { passed: false, attempts: 0 },
      'module-5': { passed: false, attempts: 0 },
      'module-6': { passed: false, attempts: 0 },
      'module-7': { passed: false, attempts: 0 },
      'module-8': { passed: false, attempts: 0 },
    },
    isConversational: false,
  });
  const [recordingLogs, setRecordingLogs] = useState<SpeechRecordingLog[]>([]);
  const [proficiency, setProficiency] = useState<ProficiencyState>({
    certifiedLevels: [],
    records: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [pronFoundation, setPronFoundation] = useState<Record<string, { score: number; completedAt: string; attempts: number }>>({});
  const [gameState, setGameState] = useState<GameState>(DEFAULT_GAME_STATE);
  const [exercisePerformance, setExercisePerformance] = useState<ExercisePerformance>({});
  const [achievements, setAchievements] = useState<EarnedAchievement[]>([]);
  const [achievementCounters, setAchievementCounters] = useState<AchievementCounters>({ perfectLessons: 0, maxConsecutiveCorrect: 0, videosWatched: 0 });
  const [adaptiveProfile, setAdaptiveProfile] = useState<AdaptiveLearnerProfile>(defaultAdaptiveProfile());
  const [pendingAchievements, setPendingAchievements] = useState<EarnedAchievement[]>([]);
  const _syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasMigratedRef = useRef(false);

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      void AsyncStorage.setItem(STORAGE_KEYS.gameState, JSON.stringify(gameState));
      if (isAuthenticated && authUser?.id) {
        syncGameStateToSupabase(authUser.id, gameState).catch(e => console.log('[SupaSync] GameState sync error:', e));
      }
      console.log('[GameState] Saved game state, totalXP:', gameState.totalXP, 'hearts:', gameState.hearts);
    }
  }, [gameState, isLoading, isAuthenticated, authUser?.id]);

  const debouncedSupaSync = useCallback((syncFn: () => Promise<void>) => {
    if (!isAuthenticated || !authUser?.id) return;
    syncFn().catch(e => console.log('[SupaSync] Background sync error:', e));
  }, [isAuthenticated, authUser?.id]);

  useEffect(() => {
    if (!isAuthenticated || !authUser?.id || isLoading) return;
    if (authUserIdRef.current === authUser.id) return;
    authUserIdRef.current = authUser.id;
    console.log('[AppContext] Auth user detected, loading from Supabase...');
    void loadFromSupabase(authUser.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, authUser?.id, isLoading]);

  const loadFromSupabase = async (userId: string) => {
    try {
      const migrationDone = await AsyncStorage.getItem(MIGRATION_KEY + '_' + userId);
      
      if (!migrationDone && !hasMigratedRef.current) {
        console.log('[AppContext] First login - migrating local data to Supabase');
        hasMigratedRef.current = true;
        
        const hasLocalData = user || gaps.length > 0 || progress.gapsCreated > 0;
        if (hasLocalData) {
          await syncAllToSupabase(userId, {
            user: user || undefined,
            gaps: gaps.length > 0 ? gaps : undefined,
            gameState,
            progress,
            moduleProgress,
            recordings: recordingLogs.length > 0 ? recordingLogs : undefined,
            achievements: achievements.length > 0 ? achievements : undefined,
            achievementCounters,
            proficiency,
          });
          console.log('[AppContext] Local data migrated to Supabase');
        }
        await AsyncStorage.setItem(MIGRATION_KEY + '_' + userId, 'true');
      }

      const [cloudProfile, cloudGaps, cloudGameState, cloudProgress, cloudModuleProgress, cloudRecordings, cloudAchievements, cloudProficiency, cloudErrors] = await Promise.all([
        loadProfileFromSupabase(userId),
        loadGapItemsFromSupabase(userId),
        loadGameStateFromSupabase(userId),
        loadUserProgressFromSupabase(userId),
        loadModuleProgressFromSupabase(userId),
        loadSpeechRecordingsFromSupabase(userId),
        loadAchievementsFromSupabase(userId),
        loadProficiencyFromSupabase(userId),
        loadErrorHistoryFromSupabase(userId),
      ]);

      if (cloudProfile) {
        setUser(cloudProfile);
        await AsyncStorage.setItem(STORAGE_KEYS.user, JSON.stringify(cloudProfile));
      }
      if (cloudGaps && cloudGaps.length > 0) {
        const migrated = cloudGaps.map(migrateGapItem);
        setGaps(migrated);
        await AsyncStorage.setItem(STORAGE_KEYS.gaps, JSON.stringify(migrated));
      }
      if (cloudGameState) {
        const today = new Date().toISOString().split('T')[0];
        if (cloudGameState.lastActiveDate !== today) {
          const resetState = {
            ...cloudGameState,
            dailyXP: 0,
            lessonsCompletedToday: 0,
            comboMultiplier: 1,
            hearts: 5,
            streakCount: isConsecutiveDay(cloudGameState.lastActiveDate, today) ? cloudGameState.streakCount : 0,
          };
          setGameState(resetState);
        } else {
          setGameState(cloudGameState);
        }
      }
      if (cloudProgress) {
        setProgress(cloudProgress);
        await AsyncStorage.setItem(STORAGE_KEYS.progress, JSON.stringify(cloudProgress));
      }
      if (cloudModuleProgress) {
        const allModuleIds: ModuleId[] = ['module-1', 'module-2', 'module-3', 'module-4', 'module-5', 'module-6', 'module-7', 'module-8'];
        for (const mid of allModuleIds) {
          if (!cloudModuleProgress.moduleCheckpoints[mid]) {
            cloudModuleProgress.moduleCheckpoints[mid] = { passed: false, attempts: 0 };
          }
        }
        setModuleProgress(cloudModuleProgress);
        await AsyncStorage.setItem(STORAGE_KEYS.moduleProgress, JSON.stringify(cloudModuleProgress));
      }
      if (cloudRecordings && cloudRecordings.length > 0) {
        setRecordingLogs(cloudRecordings);
        await AsyncStorage.setItem(STORAGE_KEYS.recordingLogs, JSON.stringify(cloudRecordings));
      }
      if (cloudAchievements) {
        setAchievements(cloudAchievements.achievements);
        setAchievementCounters(cloudAchievements.counters);
      }
      if (cloudProficiency) {
        setProficiency(cloudProficiency);
        await AsyncStorage.setItem(STORAGE_KEYS.proficiency, JSON.stringify(cloudProficiency));
      }

      if (cloudErrors && cloudErrors.length > 0) {
        const localErrors = await getRecentErrors(200);
        const localTimestamps = new Set(localErrors.map(e => e.timestamp));
        const newFromCloud = cloudErrors.filter(e => !localTimestamps.has(e.timestamp));
        for (const err of newFromCloud) {
          await addErrorToStore(err);
        }
        if (newFromCloud.length > 0) {
          console.log('[AppContext] Merged', newFromCloud.length, 'cloud errors into local store');
        }
      }

      const localErrors = await getRecentErrors(200);
      if (localErrors.length > 0) {
        syncErrorHistoryToSupabase(userId, localErrors).catch(e => console.log('[SupaSync] Error history initial sync error:', e));
      }

      console.log('[AppContext] Supabase data loaded successfully');
    } catch (e) {
      console.log('[AppContext] Error loading from Supabase, using local data:', e);
    }
  };

  const loadData = async () => {
    try {
      const [userData, gapsData, progressData, contentData, foundationData, moduleData, logsData, proficiencyData, pronFoundationData, gameStateData, exercisePerfData] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.user),
        AsyncStorage.getItem(STORAGE_KEYS.gaps),
        AsyncStorage.getItem(STORAGE_KEYS.progress),
        AsyncStorage.getItem(STORAGE_KEYS.completedContent),
        AsyncStorage.getItem(STORAGE_KEYS.foundationProgress),
        AsyncStorage.getItem(STORAGE_KEYS.moduleProgress),
        AsyncStorage.getItem(STORAGE_KEYS.recordingLogs),
        AsyncStorage.getItem(STORAGE_KEYS.proficiency),
        AsyncStorage.getItem(STORAGE_KEYS.pronFoundation),
        AsyncStorage.getItem(STORAGE_KEYS.gameState),
        AsyncStorage.getItem(STORAGE_KEYS.exercisePerformance),
      ]);

      if (userData) setUser(JSON.parse(userData));
      if (gapsData) {
        const parsedGaps = JSON.parse(gapsData);
        const migratedGaps = parsedGaps.map(migrateGapItem);
        setGaps(migratedGaps);
      }
      if (progressData) setProgress(JSON.parse(progressData));
      if (contentData) setCompletedContentIds(JSON.parse(contentData));
      if (foundationData) setCompletedFoundationIds(JSON.parse(foundationData));
      if (moduleData) {
        const parsed = JSON.parse(moduleData) as ModuleProgress;
        const allModuleIds: ModuleId[] = ['module-1', 'module-2', 'module-3', 'module-4', 'module-5', 'module-6', 'module-7', 'module-8'];
        for (const mid of allModuleIds) {
          if (!parsed.moduleCheckpoints[mid]) {
            parsed.moduleCheckpoints[mid] = { passed: false, attempts: 0 };
          }
        }
        setModuleProgress(parsed);
      }
      if (logsData) {
        const parsedLogs = JSON.parse(logsData) as SpeechRecordingLog[];
        setRecordingLogs(parsedLogs);
        void migrateExistingLogs(parsedLogs);
      }
      if (proficiencyData) {
        const parsed = JSON.parse(proficiencyData) as ProficiencyState;
        setProficiency({
          certifiedLevels: parsed.certifiedLevels || [],
          records: parsed.records || [],
        });
      }
      if (pronFoundationData) setPronFoundation(JSON.parse(pronFoundationData));
      if (gameStateData) {
        const parsed = { ...DEFAULT_GAME_STATE, ...JSON.parse(gameStateData) } as GameState;
        const today = new Date().toISOString().split('T')[0];
        if (parsed.lastActiveDate !== today) {
          setGameState({
            ...parsed,
            dailyXP: 0,
            lessonsCompletedToday: 0,
            comboMultiplier: 1,
            hearts: 5,
            streakCount: isConsecutiveDay(parsed.lastActiveDate, today) ? parsed.streakCount : 0,
          });
          console.log('[GameState] New day detected, reset daily progress');
        } else {
          setGameState(parsed);
        }
      }
      if (exercisePerfData) {
        setExercisePerformance(JSON.parse(exercisePerfData));
        console.log('[ExercisePerformance] Loaded from storage');
      }
      const adaptiveRaw = await AsyncStorage.getItem(STORAGE_KEYS.adaptiveProfile);
      if (adaptiveRaw) {
        try {
          const parsed = JSON.parse(adaptiveRaw) as AdaptiveLearnerProfile;
          setAdaptiveProfile({ ...defaultAdaptiveProfile(), ...parsed });
          console.log('[Adaptive] Loaded profile, theta=', parsed.abilityTheta);
        } catch {}
      }

      const [achievementsData, countersData] = await Promise.all([
        loadAchievements(),
        loadCounters(),
      ]);
      setAchievements(achievementsData);
      setAchievementCounters(countersData);
      console.log('[Achievements] Loaded', achievementsData.length, 'earned achievements');
    } catch (error) {
      console.log('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveUser = async (newUser: User) => {
    setUser(newUser);
    await AsyncStorage.setItem(STORAGE_KEYS.user, JSON.stringify(newUser));
    if (isAuthenticated && authUser?.id) {
      debouncedSupaSync(() => syncProfileToSupabase(authUser.id, newUser));
    }
  };

  const createUser = useCallback(async (name: string, email: string, level: UserLevel, goal: UserGoal) => {
    const newUser: User = {
      id: generateId(),
      name,
      email,
      level,
      goal,
      isPro: false,
      foundationCompleted: level !== 'none',
      createdAt: new Date().toISOString(),
    };
    await saveUser(newUser);
    return newUser;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, authUser?.id, debouncedSupaSync]);

  const addGap = useCallback(async (
    frenchWord: string,
    englishTranslation: string,
    explanation: string,
    exampleSentence: string,
    exampleTranslation: string,
    sourceType: 'reading' | 'speech' | 'foundation' | 'listening',
    sourceContentId?: string,
    pronunciation?: string,
    userNote?: string,
    gapType: GapType = 'vocab',
    pronunciationData?: GapItem['pronunciationData'],
    isFluencySuggestion: boolean = false
  ) => {
    const category = mapGapTypeToCategory(gapType);
    
    const newGap: GapItem = {
      id: generateId(),
      frenchWord,
      englishTranslation,
      explanation,
      exampleSentence,
      exampleTranslation,
      pronunciation,
      userNote,
      sourceContentId,
      sourceType,
      gapType,
      category,
      pronunciationData,
      isFluencySuggestion,
      difficulty: 'hard',
      reviewCount: 0,
      consecutiveCorrect: 0,
      easeFactor: 2.5,
      currentInterval: 0,
      nextReviewAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      fsrs: initialFsrs(),
    };

    const sourceTabMap: Record<typeof sourceType, OriginalContext['sourceTab']> = {
      reading: 'read',
      speech: 'speak',
      foundation: 'foundation',
      listening: 'listening',
    };
    const ctx = captureOriginalContext(
      exampleSentence,
      sourceTabMap[sourceType],
      exampleTranslation,
      sourceContentId,
    );
    if (ctx) newGap.originalContext = ctx;

    if (sourceType === 'speech' || sourceType === 'foundation' || sourceType === 'listening') {
      try {
        const conceptData = await extractConceptFromGap(newGap);
        if (conceptData) {
          newGap.conceptData = conceptData;
          if (conceptData.cefrLevel) {
            newGap.cefrLevel = conceptData.cefrLevel;
          }
        }
      } catch (error) {
        console.error('Failed to extract concept for gap:', error);
      }
    }

    const updatedGaps = [...gaps, newGap];
    setGaps(updatedGaps);
    await AsyncStorage.setItem(STORAGE_KEYS.gaps, JSON.stringify(updatedGaps));

    const updatedProgress = {
      ...progress,
      gapsCreated: progress.gapsCreated + 1,
      weeklyStats: {
        ...progress.weeklyStats,
        gapsCreated: progress.weeklyStats.gapsCreated + 1,
      },
    };
    setProgress(updatedProgress);
    await AsyncStorage.setItem(STORAGE_KEYS.progress, JSON.stringify(updatedProgress));

    if (isAuthenticated && authUser?.id) {
      debouncedSupaSync(async () => {
        await syncGapItemsToSupabase(authUser.id, updatedGaps);
        await syncUserProgressToSupabase(authUser.id, updatedProgress);
      });
    }

    return newGap;
  }, [gaps, progress, isAuthenticated, authUser?.id, debouncedSupaSync]);

  const reviewGap = useCallback(async (gapId: string, rating: GapDifficulty) => {
    const updatedGaps = gaps.map(gap => {
      if (gap.id === gapId) {
        const newReviewCount = gap.reviewCount + 1;
        const isMastered = rating === 'easy' && newReviewCount >= 3;
        
        return {
          ...gap,
          difficulty: rating,
          reviewCount: newReviewCount,
          lastReviewedAt: new Date().toISOString(),
          nextReviewAt: getNextReviewDate(rating, newReviewCount),
          masteredAt: isMastered ? new Date().toISOString() : gap.masteredAt,
        };
      }
      return gap;
    });

    setGaps(updatedGaps);
    await AsyncStorage.setItem(STORAGE_KEYS.gaps, JSON.stringify(updatedGaps));
    if (isAuthenticated && authUser?.id) {
      debouncedSupaSync(() => syncGapItemsToSupabase(authUser.id, updatedGaps));
    }
  }, [gaps, isAuthenticated, authUser?.id, debouncedSupaSync]);

  const recordGapAttempt = useCallback(async (gapId: string, isCorrect: boolean, meta?: { exerciseType?: GapPromptType; pickedText?: string; wasReExposure?: boolean }) => {
    let newlyMastered = false;
    const quality = mapCorrectnessToQuality(isCorrect);
    const grade = mapCorrectnessToGrade(isCorrect);
    const now = new Date();

    let updatedGaps = gaps.map(gap => {
      if (gap.id === gapId) {
        const baseUpdated = updateSrsData(gap, quality);
        const fsrs = updateFsrs(gap.fsrs, grade, now);
        const { newDifficulty } = updateIrt(adaptiveProfile.abilityTheta, initialDifficultyForGap(gap), isCorrect);
        const reExposed = meta?.wasReExposure ? markReExposed(baseUpdated) : baseUpdated;
        const updated: GapItem = {
          ...reExposed,
          fsrs,
          irtDifficulty: newDifficulty,
          nextReviewAt: fsrs.dueAt,
        };
        if (updated.masteredAt && !gap.masteredAt) newlyMastered = true;
        return updated;
      }
      return gap;
    });

    if (!isCorrect && meta?.pickedText) {
      updatedGaps = recordConfusion(updatedGaps, { correctGapId: gapId, pickedText: meta.pickedText });
    }

    const targetGap = gaps.find(g => g.id === gapId);
    if (targetGap) {
      const b = initialDifficultyForGap(targetGap);
      const { newTheta } = updateIrt(adaptiveProfile.abilityTheta, b, isCorrect);
      let nextProfile: AdaptiveLearnerProfile = {
        ...adaptiveProfile,
        abilityTheta: newTheta,
        thetaSamples: adaptiveProfile.thetaSamples + 1,
        lastUpdatedAt: new Date().toISOString(),
      };
      if (meta?.exerciseType) {
        nextProfile = banditRecordImmediate(nextProfile, meta.exerciseType, isCorrect);
        const priorStats = adaptiveProfile.exerciseTypeStats[meta.exerciseType];
        if (priorStats && isDelayedWindow(priorStats.lastUsedAt) && (targetGap.reviewCount ?? 0) > 0) {
          nextProfile = banditRecordDelayed(nextProfile, meta.exerciseType, isCorrect);
        }
      }
      setAdaptiveProfile(nextProfile);
      await AsyncStorage.setItem(STORAGE_KEYS.adaptiveProfile, JSON.stringify(nextProfile));
    }

    setGaps(updatedGaps);
    await AsyncStorage.setItem(STORAGE_KEYS.gaps, JSON.stringify(updatedGaps));

    if (newlyMastered) {
      const updatedProgress = {
        ...progress,
        gapsMastered: progress.gapsMastered + 1,
        weeklyStats: {
          ...progress.weeklyStats,
          gapsMastered: progress.weeklyStats.gapsMastered + 1,
        },
      };
      setProgress(updatedProgress);
      await AsyncStorage.setItem(STORAGE_KEYS.progress, JSON.stringify(updatedProgress));
      if (isAuthenticated && authUser?.id) {
        debouncedSupaSync(() => syncUserProgressToSupabase(authUser.id, updatedProgress));
      }
    }
    if (isAuthenticated && authUser?.id) {
      debouncedSupaSync(() => syncGapItemsToSupabase(authUser.id, updatedGaps));
    }

    return { isCorrect, newlyMastered };
  }, [gaps, progress, isAuthenticated, authUser?.id, debouncedSupaSync]);

  const completeContent = useCallback(async (contentId: string, gapsCreated: number, percentWithoutHelp: number) => {
    if (!completedContentIds.includes(contentId)) {
      const updated = [...completedContentIds, contentId];
      setCompletedContentIds(updated);
      await AsyncStorage.setItem(STORAGE_KEYS.completedContent, JSON.stringify(updated));
    }

    const updatedProgress = {
      ...progress,
      readingSessions: progress.readingSessions + 1,
      averageReadingWithoutHelp: Math.round(
        (progress.averageReadingWithoutHelp * progress.readingSessions + percentWithoutHelp) / 
        (progress.readingSessions + 1)
      ),
      weeklyStats: {
        ...progress.weeklyStats,
        readingSessions: progress.weeklyStats.readingSessions + 1,
      },
    };
    setProgress(updatedProgress);
    await AsyncStorage.setItem(STORAGE_KEYS.progress, JSON.stringify(updatedProgress));
    if (isAuthenticated && authUser?.id) {
      debouncedSupaSync(() => syncUserProgressToSupabase(authUser.id, updatedProgress));
    }
  }, [completedContentIds, progress, isAuthenticated, authUser?.id, debouncedSupaSync]);

  const advanceToNextModule = useCallback(async () => {
    const moduleOrder: ModuleId[] = ['module-1', 'module-2', 'module-3', 'module-4', 'module-5', 'module-6', 'module-7', 'module-8'];
    const currentIndex = moduleOrder.indexOf(moduleProgress.currentModuleId);
    
    if (moduleProgress.completedModules.includes(moduleProgress.currentModuleId)) {
      return;
    }
    
    if (currentIndex < moduleOrder.length - 1) {
      const nextModuleId = moduleOrder[currentIndex + 1];
      const updated: ModuleProgress = {
        ...moduleProgress,
        currentModuleId: nextModuleId,
        completedModules: [...moduleProgress.completedModules, moduleProgress.currentModuleId],
      };
      setModuleProgress(updated);
      await AsyncStorage.setItem(STORAGE_KEYS.moduleProgress, JSON.stringify(updated));
      if (isAuthenticated && authUser?.id) {
        debouncedSupaSync(() => syncModuleProgressToSupabase(authUser.id, updated));
      }
    } else {
      if (!moduleProgress.isConversational) {
        const updated: ModuleProgress = {
          ...moduleProgress,
          completedModules: [...moduleProgress.completedModules, moduleProgress.currentModuleId],
          isConversational: true,
        };
        setModuleProgress(updated);
        await AsyncStorage.setItem(STORAGE_KEYS.moduleProgress, JSON.stringify(updated));
        if (isAuthenticated && authUser?.id) {
          debouncedSupaSync(() => syncModuleProgressToSupabase(authUser.id, updated));
        }
      }
    }
  }, [moduleProgress, isAuthenticated, authUser?.id, debouncedSupaSync]);

  const completeFoundationLesson = useCallback(async (lessonId: string) => {
    if (!completedFoundationIds.includes(lessonId)) {
      const updated = [...completedFoundationIds, lessonId];
      setCompletedFoundationIds(updated);
      await AsyncStorage.setItem(STORAGE_KEYS.foundationProgress, JSON.stringify(updated));

      if (updated.length >= 3 && user) {
        const updatedUser = { ...user, foundationCompleted: true };
        await saveUser(updatedUser);
      }

      // Check if current module is complete and advance if needed
      const { foundationLessons } = await import('@/mocks/content');
      const { learningModules } = await import('@/mocks/modules');
      
      const currentModule = learningModules.find(m => m.id === moduleProgress.currentModuleId);
      if (currentModule) {
        const moduleLessons = foundationLessons.filter(l => l.moduleId === currentModule.id);
        const completedInModule = moduleLessons.filter(l => updated.includes(l.id)).length;
        
        if (completedInModule >= currentModule.requiredLessonsToPass) {
          // Module is complete, advance to next module
          await advanceToNextModule();
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completedFoundationIds, user, moduleProgress, advanceToNextModule, isAuthenticated, authUser?.id, debouncedSupaSync]);

  const addSpeechSession = useCallback(async (minutes: number) => {
    const updatedProgress = {
      ...progress,
      totalSpeakingMinutes: progress.totalSpeakingMinutes + minutes,
      weeklyStats: {
        ...progress.weeklyStats,
        speakingMinutes: progress.weeklyStats.speakingMinutes + minutes,
      },
    };
    setProgress(updatedProgress);
    await AsyncStorage.setItem(STORAGE_KEYS.progress, JSON.stringify(updatedProgress));
    if (isAuthenticated && authUser?.id) {
      debouncedSupaSync(() => syncUserProgressToSupabase(authUser.id, updatedProgress));
    }
  }, [progress, isAuthenticated, authUser?.id, debouncedSupaSync]);

  const addRecordingLog = useCallback(async (
    prompt: string,
    duration: number,
    actualDuration: number,
    transcript: string,
    grammarErrors: SpeechGrammarError[],
    fluencySuggestions: SpeechFluencySuggestion[],
    gapsCaptured: number,
    audioData?: string
  ) => {
    const logId = generateId();

    let storedAudioRef: string | undefined;
    if (audioData) {
      try {
        storedAudioRef = await saveAudioToFile(audioData, logId);
        console.log('[AppContext] Audio saved to file for log', logId);
      } catch (e) {
        console.log('[AppContext] Failed to save audio file, skipping:', e);
        storedAudioRef = undefined;
      }
    }

    const newLog: SpeechRecordingLog = {
      id: logId,
      createdAt: new Date().toISOString(),
      prompt,
      duration,
      actualDuration,
      transcript,
      grammarErrors,
      fluencySuggestions,
      gapsCaptured,
      audioData: storedAudioRef,
    };

    const updatedLogs = [newLog, ...recordingLogs].slice(0, 50);
    setRecordingLogs(updatedLogs);
    await AsyncStorage.setItem(STORAGE_KEYS.recordingLogs, JSON.stringify(updatedLogs));
    if (isAuthenticated && authUser?.id) {
      debouncedSupaSync(() => syncSpeechRecordingsToSupabase(authUser.id, updatedLogs));
    }
    return newLog;
  }, [recordingLogs, isAuthenticated, authUser?.id, debouncedSupaSync]);

  const deleteRecordingLog = useCallback(async (logId: string) => {
    const logToDelete = recordingLogs.find(log => log.id === logId);
    if (logToDelete?.audioData) {
      try {
        await deleteAudioFile(logToDelete.audioData);
      } catch (e) {
        console.log('[AppContext] Failed to delete audio file:', e);
      }
    }
    const updatedLogs = recordingLogs.filter(log => log.id !== logId);
    setRecordingLogs(updatedLogs);
    await AsyncStorage.setItem(STORAGE_KEYS.recordingLogs, JSON.stringify(updatedLogs));
    if (isAuthenticated && authUser?.id) {
      debouncedSupaSync(() => syncSpeechRecordingsToSupabase(authUser.id, updatedLogs));
    }
  }, [recordingLogs, isAuthenticated, authUser?.id, debouncedSupaSync]);

  const migrateExistingLogs = async (logs: SpeechRecordingLog[]) => {
    let needsUpdate = false;
    const migrated = await Promise.all(
      logs.map(async (log) => {
        if (log.audioData && (isBase64DataUrl(log.audioData) || (isSegmentJson(log.audioData) && log.audioData.includes('data:')))) {
          const newPath = await migrateBase64ToFile(log.audioData, log.id);
          if (newPath !== log.audioData) {
            needsUpdate = true;
            return { ...log, audioData: newPath };
          }
        }
        return log;
      })
    );

    if (needsUpdate) {
      setRecordingLogs(migrated);
      await AsyncStorage.setItem(STORAGE_KEYS.recordingLogs, JSON.stringify(migrated));
      console.log('[AppContext] Migrated existing recording logs from base64 to files');
    }
  };

  const todayGaps = useMemo(() => {
    const now = new Date();
    return gaps.filter(gap => {
      const nextReview = new Date(gap.nextReviewAt);
      return nextReview <= now && !gap.masteredAt;
    });
  }, [gaps]);

  const newGaps = useMemo(() => {
    const today = new Date().toDateString();
    return gaps.filter(gap => new Date(gap.createdAt).toDateString() === today);
  }, [gaps]);

  const masteredGaps = useMemo(() => {
    return gaps.filter(gap => gap.masteredAt);
  }, [gaps]);

  const recordCheckpointAttempt = useCallback(async (moduleId: ModuleId, passed: boolean) => {
    const currentCheckpoint = moduleProgress.moduleCheckpoints[moduleId];
    const updated: ModuleProgress = {
      ...moduleProgress,
      moduleCheckpoints: {
        ...moduleProgress.moduleCheckpoints,
        [moduleId]: {
          passed: passed || currentCheckpoint.passed,
          attempts: currentCheckpoint.attempts + 1,
          lastAttemptAt: new Date().toISOString(),
        },
      },
    };
    setModuleProgress(updated);
    await AsyncStorage.setItem(STORAGE_KEYS.moduleProgress, JSON.stringify(updated));
    if (isAuthenticated && authUser?.id) {
      debouncedSupaSync(() => syncModuleProgressToSupabase(authUser.id, updated));
    }
    
    if (passed) {
      await advanceToNextModule();
    }
  }, [moduleProgress, advanceToNextModule, isAuthenticated, authUser?.id, debouncedSupaSync]);

  const certifyLevel = useCallback(async (level: CEFRLevel, score: number) => {
    const existingRecord = proficiency.records.find(r => r.level === level);
    const attempts = existingRecord ? existingRecord.attempts + 1 : 1;

    const newRecord: ProficiencyRecord = {
      level,
      certifiedAt: new Date().toISOString(),
      score,
      attempts,
    };

    const updatedRecords = [
      ...proficiency.records.filter(r => r.level !== level),
      newRecord,
    ];

    const updatedCertifiedLevels = proficiency.certifiedLevels.includes(level)
      ? proficiency.certifiedLevels
      : [...proficiency.certifiedLevels, level];

    const updated: ProficiencyState = { certifiedLevels: updatedCertifiedLevels, records: updatedRecords };
    setProficiency(updated);
    await AsyncStorage.setItem(STORAGE_KEYS.proficiency, JSON.stringify(updated));
    if (isAuthenticated && authUser?.id) {
      debouncedSupaSync(() => syncProficiencyToSupabase(authUser.id, updated));
    }
    console.log(`[Proficiency] Certified level ${level} with score ${score}%`);
  }, [proficiency, isAuthenticated, authUser?.id, debouncedSupaSync]);

  const completePronLesson = useCallback(async (lessonId: string, score: number) => {
    const existing = pronFoundation[lessonId];
    const updated = {
      ...pronFoundation,
      [lessonId]: {
        score: Math.max(score, existing?.score ?? 0),
        completedAt: new Date().toISOString(),
        attempts: (existing?.attempts ?? 0) + 1,
      }
    };
    setPronFoundation(updated);
    await AsyncStorage.setItem(STORAGE_KEYS.pronFoundation, JSON.stringify(updated));
    console.log(`[PronFoundation] Saved lesson ${lessonId} with score ${score}%`);
  }, [pronFoundation]);

  const recordProficiencyAttempt = useCallback(async (level: CEFRLevel, score: number) => {
    const existingRecord = proficiency.records.find(r => r.level === level);
    const attempts = existingRecord ? existingRecord.attempts + 1 : 1;

    let updatedRecords: ProficiencyRecord[];
    if (existingRecord) {
      updatedRecords = proficiency.records.map(r =>
        r.level === level ? { ...r, attempts, score: Math.max(r.score, score) } : r
      );
    } else {
      updatedRecords = [...proficiency.records, { level, certifiedAt: '', score, attempts }];
    }

    const updated: ProficiencyState = { ...proficiency, records: updatedRecords };
    setProficiency(updated);
    await AsyncStorage.setItem(STORAGE_KEYS.proficiency, JSON.stringify(updated));
    if (isAuthenticated && authUser?.id) {
      debouncedSupaSync(() => syncProficiencyToSupabase(authUser.id, updated));
    }
    console.log(`[Proficiency] Recorded attempt for ${level}: ${score}% (attempt #${attempts})`);
  }, [proficiency, isAuthenticated, authUser?.id, debouncedSupaSync]);

  const isModuleUnlocked = useCallback((moduleId: ModuleId): boolean => {
    if (moduleId === 'module-1') return true;
    const moduleOrder: ModuleId[] = ['module-1', 'module-2', 'module-3', 'module-4', 'module-5', 'module-6', 'module-7', 'module-8'];
    const moduleIndex = moduleOrder.indexOf(moduleId);
    if (moduleIndex <= 0) return true;

    const previousModuleId = moduleOrder[moduleIndex - 1];
    const previousCompleted = moduleProgress.completedModules.includes(previousModuleId);
    if (!previousCompleted) return false;

    const requiredCertification = getRequiredCertificationForModule(moduleId);
    if (requiredCertification && !proficiency.certifiedLevels.includes(requiredCertification)) {
      return false;
    }

    return true;
  }, [moduleProgress, proficiency]);

  const pronunciationGaps = useMemo(() => {
    return gaps.filter(gap => gap.gapType === 'pronunciation');
  }, [gaps]);

  const activeGaps = useMemo(() => {
    return gaps.filter(gap => !gap.masteredAt);
  }, [gaps]);

  const gapsByCategory = useMemo(() => {
    const categories: Record<GapCategory, GapItem[]> = {
      vocabulary: [],
      grammar: [],
      pronunciation: [],
      phrasing: [],
      register: [],
    };
    
    gaps.forEach(gap => {
      if (!gap.masteredAt) {
        categories[gap.category].push(gap);
      }
    });
    
    return categories;
  }, [gaps]);

  const gapSchedule = useMemo((): GapScheduleSummary => {
    return getGapScheduleSummary(gaps);
  }, [gaps]);

  const gapHealth = useMemo(() => {
    return getGapHealthScore(gaps);
  }, [gaps]);

  const forceReviewCheck = useMemo(() => {
    return shouldForceGapReview(gaps);
  }, [gaps]);

  const getGapUrgency = useCallback((gapId: string): GapUrgencyInfo | null => {
    const gap = gaps.find(g => g.id === gapId);
    if (!gap) return null;
    return classifyGapUrgency(gap);
  }, [gaps]);

  const getLessonInjection = useCallback((modId: ModuleId): LessonInjection => {
    return getGapsForLessonInjection(gaps, modId);
  }, [gaps]);

  const reactivateGap = useCallback(async (gapId: string) => {
    const updatedGaps = gaps.map(gap => {
      if (gap.id === gapId) {
        const reactivation = getReactivationData(gap);
        return { ...gap, ...reactivation };
      }
      return gap;
    });

    setGaps(updatedGaps);
    await AsyncStorage.setItem(STORAGE_KEYS.gaps, JSON.stringify(updatedGaps));

    const updatedProgress = {
      ...progress,
      gapsMastered: Math.max(0, progress.gapsMastered - 1),
      weeklyStats: {
        ...progress.weeklyStats,
        gapsMastered: Math.max(0, progress.weeklyStats.gapsMastered - 1),
      },
    };
    setProgress(updatedProgress);
    await AsyncStorage.setItem(STORAGE_KEYS.progress, JSON.stringify(updatedProgress));
    if (isAuthenticated && authUser?.id) {
      debouncedSupaSync(async () => {
        await syncGapItemsToSupabase(authUser.id, updatedGaps);
        await syncUserProgressToSupabase(authUser.id, updatedProgress);
      });
    }
  }, [gaps, progress, isAuthenticated, authUser?.id, debouncedSupaSync]);

  const reviewGapAnki = useCallback(async (gapId: string, quality: SrsQuality) => {
    let newlyMastered = false;

    const updatedGaps = gaps.map(gap => {
      if (gap.id === gapId) {
        const updated = updateSrsAnki(gap, quality);
        if (updated.masteredAt && !gap.masteredAt) {
          newlyMastered = true;
        }
        return updated;
      }
      return gap;
    });

    setGaps(updatedGaps);
    await AsyncStorage.setItem(STORAGE_KEYS.gaps, JSON.stringify(updatedGaps));

    if (newlyMastered) {
      const updatedProgress = {
        ...progress,
        gapsMastered: progress.gapsMastered + 1,
        weeklyStats: {
          ...progress.weeklyStats,
          gapsMastered: progress.weeklyStats.gapsMastered + 1,
        },
      };
      setProgress(updatedProgress);
      await AsyncStorage.setItem(STORAGE_KEYS.progress, JSON.stringify(updatedProgress));
      if (isAuthenticated && authUser?.id) {
        debouncedSupaSync(() => syncUserProgressToSupabase(authUser.id, updatedProgress));
      }
    }
    if (isAuthenticated && authUser?.id) {
      debouncedSupaSync(() => syncGapItemsToSupabase(authUser.id, updatedGaps));
    }

    return { newlyMastered };
  }, [gaps, progress, isAuthenticated, authUser?.id, debouncedSupaSync]);

  const handleCheckinResult = useCallback(async (gapId: string, isCorrect: boolean) => {
    if (isCorrect) {
      const updatedGaps = gaps.map(gap => {
        if (gap.id === gapId) {
          return {
            ...gap,
            lastReviewedAt: new Date().toISOString(),
            nextReviewAt: (() => {
              const d = new Date();
              d.setDate(d.getDate() + 30);
              return d.toISOString();
            })(),
          };
        }
        return gap;
      });
      setGaps(updatedGaps);
      await AsyncStorage.setItem(STORAGE_KEYS.gaps, JSON.stringify(updatedGaps));
      if (isAuthenticated && authUser?.id) {
        debouncedSupaSync(() => syncGapItemsToSupabase(authUser.id, updatedGaps));
      }
    } else {
      await reactivateGap(gapId);
    }
  }, [gaps, reactivateGap, isAuthenticated, authUser?.id, debouncedSupaSync]);

  const refreshGapConcepts = useCallback(async (forceRefresh: boolean = true): Promise<number> => {
    const gapsToRefresh = gaps.filter(g => !g.masteredAt);
    
    if (gapsToRefresh.length === 0) {
      return 0;
    }

    const conceptMap = await reExtractConceptsForAllGaps(gapsToRefresh, forceRefresh);
    
    if (conceptMap.size === 0) {
      return 0;
    }

    const updatedGaps = gaps.map(gap => {
      const newConcept = conceptMap.get(gap.id);
      if (newConcept) {
        return { ...gap, conceptData: newConcept };
      }
      return gap;
    });

    setGaps(updatedGaps);
    await AsyncStorage.setItem(STORAGE_KEYS.gaps, JSON.stringify(updatedGaps));
    if (isAuthenticated && authUser?.id) {
      debouncedSupaSync(() => syncGapItemsToSupabase(authUser.id, updatedGaps));
    }
    
    return conceptMap.size;
  }, [gaps, isAuthenticated, authUser?.id, debouncedSupaSync]);

  const awardXP = useCallback((amount: number) => {
    setGameState(prev => {
      const today = new Date().toISOString().split('T')[0];
      const xpWithMultiplier = Math.round(amount * prev.comboMultiplier);
      console.log('[GameState] Awarding XP:', amount, 'x', prev.comboMultiplier, '=', xpWithMultiplier);
      return {
        ...prev,
        totalXP: prev.totalXP + xpWithMultiplier,
        dailyXP: prev.dailyXP + xpWithMultiplier,
        lastActiveDate: today,
      };
    });
  }, []);

  const loseHeart = useCallback(() => {
    setGameState(prev => {
      const newHearts = Math.max(0, prev.hearts - 1);
      console.log('[GameState] Lost heart, remaining:', newHearts);
      return { ...prev, hearts: newHearts, lastHeartLostAt: new Date().toISOString() };
    });
  }, []);

  const restoreHearts = useCallback(() => {
    setGameState(prev => {
      console.log('[GameState] Hearts restored to 5');
      return { ...prev, hearts: 5 };
    });
  }, []);

  const updateStreak = useCallback(() => {
    setGameState(prev => {
      const today = new Date().toISOString().split('T')[0];
      if (prev.lastActiveDate === today) return prev;
      const consecutive = isConsecutiveDay(prev.lastActiveDate, today);
      const newStreak = consecutive ? prev.streakCount + 1 : 1;
      const streakBroken = !consecutive && prev.streakCount > 0 && prev.lastActiveDate !== '';
      console.log('[GameState] Streak updated:', newStreak, consecutive ? '(consecutive)' : '(reset)');
      return {
        ...prev,
        streakCount: newStreak,
        lastActiveDate: today,
        previousStreakCount: streakBroken ? prev.streakCount : prev.previousStreakCount,
        streakBrokenAcknowledged: streakBroken ? false : prev.streakBrokenAcknowledged,
        milestonesShown: streakBroken ? {} : prev.milestonesShown,
      };
    });
  }, []);

  const updatePersonalBest = useCallback((lessonId: string, accuracy: number, streak: number) => {
    setGameState(prev => {
      const existing = prev.personalBests[lessonId];
      if (existing && existing.bestAccuracy >= accuracy && existing.bestStreak >= streak) {
        return prev;
      }
      const best = {
        bestAccuracy: Math.max(accuracy, existing?.bestAccuracy ?? 0),
        bestStreak: Math.max(streak, existing?.bestStreak ?? 0),
      };
      console.log('[GameState] Personal best updated for', lessonId, best);
      return {
        ...prev,
        personalBests: { ...prev.personalBests, [lessonId]: best },
      };
    });
  }, []);

  const resetDailyProgress = useCallback(() => {
    setGameState(prev => {
      console.log('[GameState] Daily progress reset');
      return {
        ...prev,
        dailyXP: 0,
        lessonsCompletedToday: 0,
        comboMultiplier: 1,
        hearts: 5,
      };
    });
  }, []);

  const acknowledgeStreakBroken = useCallback(() => {
    setGameState(prev => ({ ...prev, streakBrokenAcknowledged: true }));
  }, []);

  const markMilestoneShown = useCallback((milestone: string) => {
    setGameState(prev => ({
      ...prev,
      milestonesShown: { ...prev.milestonesShown, [milestone]: true },
    }));
  }, []);

  const runAchievementCheck = useCallback(() => {
    const state = buildCheckState({
      streakCount: gameState.streakCount,
      totalXP: gameState.totalXP,
      dailyXP: gameState.dailyXP,
      lessonsCompletedToday: gameState.lessonsCompletedToday,
      gaps,
      readingSessions: progress.readingSessions,
      totalSpeakingMinutes: progress.totalSpeakingMinutes,
      recordingLogs: recordingLogs.length,
      completedFoundationIds,
      completedContentIds,
      certifiedLevels: proficiency.certifiedLevels,
      pronFoundationCompleted: Object.keys(pronFoundation).length,
      modulesCompleted: moduleProgress.completedModules,
      counters: achievementCounters,
      exercisePerformance,
    });

    const newlyEarned = checkAchievements(state, achievements);
    if (newlyEarned.length > 0) {
      const updated = [...achievements, ...newlyEarned];
      setAchievements(updated);
      void saveAchievements(updated);
      setPendingAchievements(prev => [...prev, ...newlyEarned]);
      const totalXpReward = newlyEarned.reduce((sum, a) => sum + a.xpAwarded, 0);
      if (totalXpReward > 0) {
        awardXP(totalXpReward);
      }
      if (isAuthenticated && authUser?.id) {
        debouncedSupaSync(() => syncAchievementsToSupabase(authUser.id, updated, achievementCounters));
      }
      console.log('[Achievements] Newly earned:', newlyEarned.map(a => a.id).join(', '));
    }
  }, [gameState, gaps, progress, recordingLogs, completedFoundationIds, completedContentIds, proficiency, pronFoundation, moduleProgress, achievementCounters, exercisePerformance, achievements, awardXP, isAuthenticated, authUser?.id, debouncedSupaSync]);

  const dismissAchievement = useCallback(() => {
    setPendingAchievements(prev => prev.slice(1));
  }, []);

  const recordPerfectLesson = useCallback(async () => {
    const updated = await incrementCounter('perfectLessons');
    setAchievementCounters(updated);
  }, []);

  const recordConsecutiveCorrect = useCallback(async (count: number) => {
    const updated = await incrementCounter('maxConsecutiveCorrect', count);
    setAchievementCounters(updated);
  }, []);

  const recordVideoWatched = useCallback(async () => {
    const updated = await incrementCounter('videosWatched');
    setAchievementCounters(updated);
  }, []);

  const trackExerciseResult = useCallback((exerciseType: string, isCorrect: boolean) => {
    setExercisePerformance(prev => {
      const updated = recordExerciseResult(prev, exerciseType as any, isCorrect);
      void AsyncStorage.setItem(STORAGE_KEYS.exercisePerformance, JSON.stringify(updated));
      console.log('[ExercisePerformance] Tracked:', exerciseType, isCorrect ? 'correct' : 'wrong');
      return updated;
    });
  }, []);

  const syncErrorHistory = useCallback(async () => {
    if (!isAuthenticated || !authUser?.id) return;
    try {
      const localErrors = await getRecentErrors(200);
      if (localErrors.length > 0) {
        await syncErrorHistoryToSupabase(authUser.id, localErrors);
      }
    } catch (e) {
      console.log('[AppContext] Error syncing error history:', e);
    }
  }, [isAuthenticated, authUser?.id]);

  const regenerateHeart = useCallback(() => {
    setGameState(prev => {
      if (prev.hearts >= 5) return prev;
      const newHearts = Math.min(5, prev.hearts + 1);
      console.log('[GameState] Heart regenerated, now:', newHearts);
      return { ...prev, hearts: newHearts };
    });
  }, []);

  const addConversationSession = useCallback(async (session: ConversationSession) => {
    const minutes = Math.ceil(session.durationSeconds / 60);
    const updatedProgress = {
      ...progress,
      totalSpeakingMinutes: progress.totalSpeakingMinutes + minutes,
      weeklyStats: {
        ...progress.weeklyStats,
        speakingMinutes: progress.weeklyStats.speakingMinutes + minutes,
      },
    };
    setProgress(updatedProgress);
    await AsyncStorage.setItem(STORAGE_KEYS.progress, JSON.stringify(updatedProgress));

    if (isAuthenticated && authUser?.id) {
      debouncedSupaSync(async () => {
        await syncUserProgressToSupabase(authUser.id, updatedProgress);
        await syncConversationSessionToSupabase(authUser.id, {
          id: session.id,
          scenarioId: session.scenarioId,
          targetLanguage: session.targetLanguage,
          cefrLevelAtStart: session.cefrLevelAtStart,
          durationSeconds: session.durationSeconds,
          totalMessages: session.totalMessages,
          pronunciationScoreAvg: session.pronunciationScoreAvg,
          grammarScoreAvg: session.grammarScoreAvg,
          fluencyScoreAvg: session.fluencyScoreAvg,
          overallScore: session.overallScore,
          newVocabularyCount: session.newVocabularyCount,
          status: session.status,
          createdAt: session.createdAt,
          endedAt: session.endedAt,
        });
        if (session.messages.length > 0) {
          await syncConversationMessagesToSupabase(session.messages);
        }
      });
    }
    console.log('[AppContext] Conversation session recorded, duration:', minutes, 'min, score:', session.overallScore);
  }, [progress, isAuthenticated, authUser?.id, debouncedSupaSync]);

  const incrementLessonsCompleted = useCallback(() => {
    setGameState(prev => {
      const newCount = prev.lessonsCompletedToday + 1;
      const newMultiplier = Math.min(1 + newCount * 0.1, 2);
      console.log('[GameState] Lessons completed today:', newCount, 'combo:', newMultiplier);
      return {
        ...prev,
        lessonsCompletedToday: newCount,
        comboMultiplier: newMultiplier,
      };
    });
  }, []);

  const logout = useCallback(async () => {
    if (isAuthenticated && authUser?.id) {
      await syncAllToSupabase(authUser.id, {
        user: user || undefined,
        gaps,
        gameState,
        progress,
        moduleProgress,
        recordings: recordingLogs,
        achievements,
        achievementCounters,
        proficiency,
      }).catch(e => console.log('[SupaSync] Final sync on logout error:', e));
    }
    authUserIdRef.current = null;
    await AsyncStorage.multiRemove(Object.values(STORAGE_KEYS));
    setUser(null);
    setGaps([]);
    setGameState(DEFAULT_GAME_STATE);
    setProgress({
      readingSessions: 0,
      averageReadingWithoutHelp: 0,
      totalSpeakingMinutes: 0,
      gapsCreated: 0,
      gapsMastered: 0,
      weeklyStats: {
        readingSessions: 0,
        speakingMinutes: 0,
        gapsCreated: 0,
        gapsMastered: 0,
      },
    });
    setCompletedContentIds([]);
    setCompletedFoundationIds([]);
    setModuleProgress({
      currentModuleId: 'module-1',
      completedModules: [],
      moduleCheckpoints: {
        'module-1': { passed: false, attempts: 0 },
        'module-2': { passed: false, attempts: 0 },
        'module-3': { passed: false, attempts: 0 },
        'module-4': { passed: false, attempts: 0 },
        'module-5': { passed: false, attempts: 0 },
        'module-6': { passed: false, attempts: 0 },
        'module-7': { passed: false, attempts: 0 },
        'module-8': { passed: false, attempts: 0 },
      },
      isConversational: false,
    });
    setProficiency({ certifiedLevels: [], records: [] });
    setPronFoundation({});
  }, [isAuthenticated, authUser?.id, user, gaps, gameState, progress, moduleProgress, recordingLogs, achievements, achievementCounters, proficiency]);

  return useMemo(() => ({
    user,
    gaps,
    progress,
    completedContentIds,
    completedFoundationIds,
    moduleProgress,
    recordingLogs,
    isLoading,
    createUser,
    addGap,
    reviewGap,
    recordGapAttempt,
    adaptiveProfile,
    completeContent,
    completeFoundationLesson,
    addSpeechSession,
    addRecordingLog,
    deleteRecordingLog,
    advanceToNextModule,
    recordCheckpointAttempt,
    isModuleUnlocked,
    todayGaps,
    newGaps,
    masteredGaps,
    activeGaps,
    gapsByCategory,
    pronunciationGaps,
    gapSchedule,
    gapHealth,
    forceReviewCheck,
    getGapUrgency,
    getLessonInjection,
    reactivateGap,
    handleCheckinResult,
    reviewGapAnki,
    refreshGapConcepts,
    proficiency,
    pronFoundation,
    completePronLesson,
    exercisePerformance,
    trackExerciseResult,
    gameState,
    awardXP,
    loseHeart,
    restoreHearts,
    updateStreak,
    updatePersonalBest,
    resetDailyProgress,
    incrementLessonsCompleted,
    acknowledgeStreakBroken,
    markMilestoneShown,
    regenerateHeart,
    certifyLevel,
    recordProficiencyAttempt,
    achievements,
    pendingAchievements,
    runAchievementCheck,
    dismissAchievement,
    recordPerfectLesson,
    recordConsecutiveCorrect,
    recordVideoWatched,
    addConversationSession,
    syncErrorHistory,
    logout,
  }), [
    user, gaps, progress, completedContentIds, completedFoundationIds,
    moduleProgress, recordingLogs, isLoading, createUser, addGap, reviewGap,
    recordGapAttempt, adaptiveProfile, completeContent, completeFoundationLesson, addSpeechSession,
    addRecordingLog, deleteRecordingLog, advanceToNextModule, recordCheckpointAttempt,
    isModuleUnlocked, todayGaps, newGaps, masteredGaps, activeGaps, gapsByCategory,
    pronunciationGaps, gapSchedule, gapHealth, forceReviewCheck, getGapUrgency,
    getLessonInjection, reactivateGap, handleCheckinResult, reviewGapAnki,
    refreshGapConcepts, proficiency, pronFoundation, completePronLesson,
    exercisePerformance, trackExerciseResult,
    gameState, awardXP, loseHeart, restoreHearts, updateStreak, updatePersonalBest,
    resetDailyProgress, incrementLessonsCompleted, acknowledgeStreakBroken, markMilestoneShown,
    regenerateHeart, certifyLevel, recordProficiencyAttempt,
    achievements, pendingAchievements, runAchievementCheck, dismissAchievement,
    recordPerfectLesson, recordConsecutiveCorrect, recordVideoWatched,
    addConversationSession,
    syncErrorHistory,
    logout,
  ]);
});
