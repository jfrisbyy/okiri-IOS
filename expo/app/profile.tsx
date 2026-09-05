import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import MasteryStreakCard from '@/components/MasteryStreakCard';
import RetentionCard from '@/components/RetentionCard';
import ErrorPatternCard from '@/components/ErrorPatternCard';
import { computeMasteryStreak } from '@/utils/masteryStreak';
import { computeRetentionStats } from '@/utils/retentionAnalytics';
import { buildErrorInsights, type ErrorInsight } from '@/utils/errorInsights';
import { getErrorPatterns } from '@/utils/errorHistoryStore';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Alert,
  Dimensions,
  Switch,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  ArrowLeft,
  User,
  Flame,
  BookOpen,
  Mic,
  Headphones,
  GraduationCap,
  ChevronRight,
  Shield,
  RotateCcw,
  Trash2,
  Clock,
  Target,
  TrendingUp,
  Zap,
  Map,
  Bell,
  BellOff,
  Trophy,
  CalendarClock,
} from 'lucide-react-native';
import {
  NotificationPreferences,
  getNotificationPreferences,
  saveNotificationPreferences,
  requestNotificationPermissions,
} from '@/utils/notificationScheduler';
import Colors from '@/constants/colors';
import { USE_NATIVE_DRIVER } from '@/constants/animation';
import { useApp } from '@/contexts/AppContext';
import { AchievementCategory } from '@/data/achievements';
import AchievementsGallery from '@/components/AchievementsGallery';
import ShareableStatCard, { ShareProgressButton } from '@/components/ShareableStatCard';
import { foundationLessons } from '@/mocks/content';
import { learningModules } from '@/mocks/modules';
import { pronStages, PRON_PASS_SCORE } from '@/data/foundationPronunciation';
import {
  getCurrentCertifiedLevel,
  CEFR_LEVEL_COLORS,
} from '@/utils/proficiency';
import AnimatedProgressBar from '@/components/AnimatedProgressBar';
import CEFRProgressCard from '@/components/CEFRProgressCard';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ProfileScreen() {
  const router = useRouter();
  const {
    user,
    gaps,
    progress,
    completedFoundationIds,
    moduleProgress,
    recordingLogs,
    proficiency,
    pronFoundation,
    gameState,
    achievements,
    logout,
  } = useApp();

  const [selectedAchievementCategory, setSelectedAchievementCategory] = useState<AchievementCategory | 'all'>('all');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnims = useRef(
    Array.from({ length: 11 }, () => new Animated.Value(30))
  ).current;
  const opacityAnims = useRef(
    Array.from({ length: 11 }, () => new Animated.Value(0))
  ).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();

    slideAnims.forEach((anim, i) => {
      Animated.timing(anim, {
        toValue: 0,
        duration: 400,
        delay: 80 + i * 50,
        useNativeDriver: USE_NATIVE_DRIVER,
      }).start();
    });
    opacityAnims.forEach((anim, i) => {
      Animated.timing(anim, {
        toValue: 1,
        duration: 350,
        delay: 80 + i * 50,
        useNativeDriver: USE_NATIVE_DRIVER,
      }).start();
    });
  }, [fadeAnim, slideAnims, opacityAnims]);

  const [showShareCard, setShowShareCard] = useState(false);
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences | null>(null);
  const [errorInsights, setErrorInsights] = useState<ErrorInsight[]>([]);

  useEffect(() => {
    void (async () => {
      const patterns = await getErrorPatterns(20);
      setErrorInsights(buildErrorInsights(patterns));
    })();
  }, [gaps.length]);

  const masteryStreak = useMemo(() => computeMasteryStreak(gaps), [gaps]);
  const retentionStats = useMemo(() => computeRetentionStats(gaps), [gaps]);
  const topInsights = useMemo(() => errorInsights.slice(0, 3), [errorInsights]);

  useEffect(() => {
    void getNotificationPreferences().then(setNotifPrefs);
  }, []);

  const updateNotifPref = useCallback(async (key: keyof NotificationPreferences, value: boolean) => {
    if (!notifPrefs) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const updated = { ...notifPrefs, [key]: value };
    setNotifPrefs(updated);
    await saveNotificationPreferences(updated);
  }, [notifPrefs]);

  const handleEnableNotifications = useCallback(async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const granted = await requestNotificationPermissions();
    if (granted) {
      const prefs = await getNotificationPreferences();
      setNotifPrefs(prefs);
    } else {
      Alert.alert(
        'Notifications Disabled',
        'Please enable notifications in your device settings to receive reminders.'
      );
    }
  }, []);

  const cycleReminderTime = useCallback(async () => {
    if (!notifPrefs) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const presets = [
      { hour: 7, minute: 0 },
      { hour: 8, minute: 0 },
      { hour: 9, minute: 0 },
      { hour: 10, minute: 0 },
      { hour: 12, minute: 0 },
      { hour: 17, minute: 0 },
      { hour: 18, minute: 0 },
      { hour: 19, minute: 0 },
      { hour: 20, minute: 0 },
      { hour: 21, minute: 0 },
    ];
    const currentIdx = presets.findIndex(
      p => p.hour === notifPrefs.reminderHour && p.minute === notifPrefs.reminderMinute
    );
    const nextIdx = (currentIdx + 1) % presets.length;
    const next = presets[nextIdx];
    const updated = { ...notifPrefs, reminderHour: next.hour, reminderMinute: next.minute };
    setNotifPrefs(updated);
    await saveNotificationPreferences(updated);
  }, [notifPrefs]);

  const formatNotifTime = (hour: number, minute: number): string => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const h = hour % 12 || 12;
    const m = String(minute).padStart(2, '0');
    return `${h}:${m} ${period}`;
  };

  const isWeb = Platform.OS === 'web';

  const certifiedLevel = useMemo(
    () => getCurrentCertifiedLevel(proficiency.certifiedLevels),
    [proficiency.certifiedLevels]
  );

  const activeGapCount = useMemo(() => gaps.filter((g) => !g.masteredAt).length, [gaps]);
  const masteredGapCount = useMemo(() => gaps.filter((g) => g.masteredAt).length, [gaps]);
  const totalGaps = gaps.length;

  const pronAllLessons = useMemo(() => pronStages.flatMap((s) => s.lessons), []);
  const pronCompletedCount = useMemo(
    () =>
      pronAllLessons.filter(
        (l) => (pronFoundation[l.id]?.score ?? 0) >= PRON_PASS_SCORE
      ).length,
    [pronAllLessons, pronFoundation]
  );

  const speakingHours = useMemo(() => {
    const totalMinutes =
      progress.totalSpeakingMinutes +
      recordingLogs.reduce((sum, log) => sum + (log.actualDuration || 0) / 60, 0);
    return totalMinutes / 60;
  }, [progress.totalSpeakingMinutes, recordingLogs]);

  const readingHours = useMemo(() => {
    return (progress.readingSessions * 8) / 60;
  }, [progress.readingSessions]);

  const lessonHours = useMemo(() => {
    const completedLessons = foundationLessons.filter((l) =>
      completedFoundationIds.includes(l.id)
    );
    const totalMinutes = completedLessons.reduce(
      (sum, l) => sum + (l.estimatedMinutes || 10),
      0
    );
    const pronMinutes = pronCompletedCount * 5;
    return (totalMinutes + pronMinutes) / 60;
  }, [completedFoundationIds, pronCompletedCount]);

  const listeningHours = useMemo(() => {
    return (progress.weeklyStats.speakingMinutes * 0.3) / 60;
  }, [progress.weeklyStats.speakingMinutes]);

  const totalHours = useMemo(
    () => speakingHours + readingHours + lessonHours + listeningHours,
    [speakingHours, readingHours, lessonHours, listeningHours]
  );

  const moduleBreakdown = useMemo(() => {
    const items = [
      {
        label: 'Speaking',
        hours: speakingHours,
        color: '#F59E0B',
        icon: <Mic size={16} color="#F59E0B" />,
      },
      {
        label: 'Reading',
        hours: readingHours,
        color: '#10B981',
        icon: <BookOpen size={16} color="#10B981" />,
      },
      {
        label: 'Lessons',
        hours: lessonHours,
        color: '#0D9488',
        icon: <GraduationCap size={16} color="#0D9488" />,
      },
      {
        label: 'Listening',
        hours: listeningHours,
        color: '#8B5CF6',
        icon: <Headphones size={16} color="#8B5CF6" />,
      },
    ];
    const maxHours = Math.max(...items.map((i) => i.hours), 0.1);
    return items.map((item) => ({
      ...item,
      percentage: (item.hours / maxHours) * 100,
    }));
  }, [speakingHours, readingHours, lessonHours, listeningHours]);

  const memberSince = useMemo(() => {
    if (!user?.createdAt) return '';
    const date = new Date(user.createdAt);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [user?.createdAt]);

  const currentModule = useMemo(
    () => learningModules.find((m) => m.id === moduleProgress.currentModuleId),
    [moduleProgress.currentModuleId]
  );

  const gapMasteryPercent = useMemo(() => {
    if (totalGaps === 0) return 0;
    return Math.round((masteredGapCount / totalGaps) * 100);
  }, [masteredGapCount, totalGaps]);

  const handleRestartOnboarding = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Restart Onboarding',
      'This will reset your profile and take you back to the onboarding flow. Your learning data will be preserved. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restart',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/welcome');
          },
        },
      ]
    );
  };

  const handleResetAllData = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      'Reset All Data',
      'This will permanently delete all your progress, gaps, recordings, and settings. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/welcome');
          },
        },
      ]
    );
  };

  const formatHours = (h: number): string => {
    if (h < 0.1) return '0m';
    if (h < 1) return `${Math.round(h * 60)}m`;
    const hrs = Math.floor(h);
    const mins = Math.round((h - hrs) * 60);
    if (mins === 0) return `${hrs}h`;
    return `${hrs}h ${mins}m`;
  };

  const renderAnimatedSection = (index: number, children: React.ReactNode) => (
    <Animated.View
      style={{
        opacity: opacityAnims[index],
        transform: [{ translateY: slideAnims[index] }],
      }}
    >
      {children}
    </Animated.View>
  );

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeTop}>
        <View style={styles.navBar}>
          <Pressable
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }}
            style={styles.backBtn}
            testID="profile-back"
          >
            <ArrowLeft size={22} color={Colors.text} />
          </Pressable>
          <Text style={styles.navTitle}>Profile</Text>
          <View style={styles.navSpacer} />
        </View>
      </SafeAreaView>

      <Animated.ScrollView
        style={[styles.scrollView, { opacity: fadeAnim }]}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {renderAnimatedSection(
          0,
          <View style={styles.profileHeader}>
            <View style={styles.avatarContainer}>
              <View style={styles.avatar}>
                <User size={32} color={Colors.primary} />
              </View>
              {certifiedLevel && (
                <View
                  style={[
                    styles.cefrBadgeFloat,
                    {
                      backgroundColor:
                        CEFR_LEVEL_COLORS[certifiedLevel]?.bg ?? Colors.primaryLight,
                    },
                  ]}
                >
                  <Shield
                    size={10}
                    color={CEFR_LEVEL_COLORS[certifiedLevel]?.accent ?? Colors.primary}
                  />
                  <Text
                    style={[
                      styles.cefrBadgeFloatText,
                      {
                        color:
                          CEFR_LEVEL_COLORS[certifiedLevel]?.text ?? Colors.primary,
                      },
                    ]}
                  >
                    {certifiedLevel}
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.userName}>{user?.name || 'Learner'}</Text>
            <Text style={styles.memberSince}>
              {memberSince ? `Member since ${memberSince}` : 'Getting started'}
            </Text>
            {currentModule && (
              <View style={styles.currentModuleChip}>
                <TrendingUp size={12} color={Colors.primary} />
                <Text style={styles.currentModuleText}>
                  {currentModule.cefrLevel} · {currentModule.title}
                </Text>
              </View>
            )}
          </View>
        )}

        {renderAnimatedSection(
          1,
          <View style={styles.totalHoursCard}>
            <View style={styles.totalHoursLeft}>
              <Clock size={20} color="#fff" />
              <Text style={styles.totalHoursLabel}>Total Learning Time</Text>
            </View>
            <Text style={styles.totalHoursValue}>{formatHours(totalHours)}</Text>
          </View>
        )}

        {renderAnimatedSection(
          2,
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <View style={[styles.statIconBg, { backgroundColor: '#FEF3C7' }]}>
                <Flame size={18} color="#F59E0B" />
              </View>
              <Text style={styles.statValue}>{totalGaps}</Text>
              <Text style={styles.statLabel}>Total Gaps</Text>
            </View>
            <View style={styles.statCard}>
              <View style={[styles.statIconBg, { backgroundColor: '#ECFDF5' }]}>
                <Target size={18} color="#10B981" />
              </View>
              <Text style={styles.statValue}>{masteredGapCount}</Text>
              <Text style={styles.statLabel}>Mastered</Text>
            </View>
            <View style={styles.statCard}>
              <View style={[styles.statIconBg, { backgroundColor: '#EDE9FE' }]}>
                <Zap size={18} color="#8B5CF6" />
              </View>
              <Text style={styles.statValue}>{activeGapCount}</Text>
              <Text style={styles.statLabel}>Active</Text>
            </View>
            <View style={styles.statCard}>
              <View style={[styles.statIconBg, { backgroundColor: '#CFFAFE' }]}>
                <BookOpen size={18} color="#06B6D4" />
              </View>
              <Text style={styles.statValue}>{progress.readingSessions}</Text>
              <Text style={styles.statLabel}>Articles</Text>
            </View>
          </View>
        )}

        {renderAnimatedSection(
          2,
          <View style={styles.section}>
            <MasteryStreakCard info={masteryStreak} />
          </View>
        )}

        {renderAnimatedSection(
          2,
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Retention</Text>
            <RetentionCard
              stats={retentionStats}
              onPress={() => router.push('/retention' as any)}
              onReviewDue={() => router.push('/srs-review' as any)}
            />
          </View>
        )}

        {renderAnimatedSection(
          3,
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Gap Mastery</Text>
            <View style={styles.masteryCard}>
              <View style={styles.masteryRow}>
                <View style={styles.masteryRing}>
                  <Text style={styles.masteryPercent}>{gapMasteryPercent}%</Text>
                </View>
                <View style={styles.masteryDetails}>
                  <View style={styles.masteryItem}>
                    <View style={[styles.masteryDot, { backgroundColor: '#10B981' }]} />
                    <Text style={styles.masteryItemText}>
                      {masteredGapCount} mastered
                    </Text>
                  </View>
                  <View style={styles.masteryItem}>
                    <View style={[styles.masteryDot, { backgroundColor: '#F59E0B' }]} />
                    <Text style={styles.masteryItemText}>
                      {activeGapCount} in progress
                    </Text>
                  </View>
                  <View style={styles.masteryItem}>
                    <View style={[styles.masteryDot, { backgroundColor: '#E5E7EB' }]} />
                    <Text style={styles.masteryItemText}>
                      {recordingLogs.length} recordings
                    </Text>
                  </View>
                </View>
              </View>
              <View style={styles.masteryBar}>
                <View
                  style={[
                    styles.masteryBarFill,
                    {
                      width: `${gapMasteryPercent}%` as any,
                      backgroundColor: '#10B981',
                    },
                  ]}
                />
                <View
                  style={[
                    styles.masteryBarFill,
                    {
                      width: `${totalGaps > 0 ? ((activeGapCount / totalGaps) * 100) : 0}%` as any,
                      backgroundColor: '#F59E0B',
                    },
                  ]}
                />
              </View>
              <Pressable
                style={({ pressed }) => [
                  styles.weaknessMapBtn,
                  pressed && { opacity: 0.85 },
                ]}
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push('/weakness-map' as any);
                }}
                testID="weakness-map-btn"
              >
                <Map size={16} color={Colors.primary} />
                <Text style={styles.weaknessMapBtnText}>View Weakness Map</Text>
                <ChevronRight size={14} color={Colors.textMuted} />
              </Pressable>
            </View>
          </View>
        )}

        {topInsights.length > 0 && renderAnimatedSection(
          3,
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>Your patterns</Text>
              {errorInsights.length > 3 && (
                <Pressable
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push('/error-patterns' as any);
                  }}
                  testID="see-all-patterns"
                >
                  <Text style={styles.seeAllText}>See all</Text>
                </Pressable>
              )}
            </View>
            {topInsights.map(insight => (
              <ErrorPatternCard
                key={insight.id}
                insight={insight}
                onPress={() => router.push(`/error-pattern/${insight.id}` as any)}
              />
            ))}
          </View>
        )}

        {renderAnimatedSection(
          4,
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Time by Activity</Text>
            <View style={styles.breakdownCard}>
              {moduleBreakdown.map((item) => (
                <View key={item.label} style={styles.breakdownRow}>
                  <View style={styles.breakdownLeft}>
                    {item.icon}
                    <Text style={styles.breakdownLabel}>{item.label}</Text>
                  </View>
                  <View style={styles.breakdownBarContainer}>
                    <AnimatedProgressBar
                      progress={item.percentage}
                      color={item.color}
                      trackColor={Colors.borderLight}
                      height={8}
                      borderRadius={4}
                      style={{ flex: 1 }}
                      delay={400}
                    />
                  </View>
                  <Text style={styles.breakdownTime}>{formatHours(item.hours)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {renderAnimatedSection(
          5,
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>CEFR Progress</Text>
            <CEFRProgressCard />
          </View>
        )}



        {renderAnimatedSection(
          7,
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notifications</Text>
            {!isWeb && notifPrefs && !notifPrefs.permissionGranted ? (
              <Pressable
                style={({ pressed }) => [
                  styles.enableNotifBtn,
                  pressed && { opacity: 0.85 },
                ]}
                onPress={handleEnableNotifications}
                testID="enable-notifications"
              >
                <Bell size={20} color="#fff" />
                <View style={styles.enableNotifTextWrap}>
                  <Text style={styles.enableNotifTitle}>Enable Notifications</Text>
                  <Text style={styles.enableNotifSub}>Get streak reminders, review alerts & celebrations</Text>
                </View>
                <ChevronRight size={18} color="rgba(255,255,255,0.7)" />
              </Pressable>
            ) : notifPrefs ? (
              <View style={styles.notifCard}>
                <View style={styles.notifRow}>
                  <View style={styles.notifRowLeft}>
                    <View style={[styles.settingsIconBg, { backgroundColor: '#FEF3C7' }]}>
                      <Clock size={16} color="#F59E0B" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.settingsLabel}>Daily Reminder</Text>
                      <Pressable onPress={cycleReminderTime}>
                        <Text style={styles.notifTimeText}>
                          {formatNotifTime(notifPrefs.reminderHour, notifPrefs.reminderMinute)} · Tap to change
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                  <Switch
                    value={notifPrefs.dailyReminder}
                    onValueChange={(v) => void updateNotifPref('dailyReminder', v)}
                    trackColor={{ false: Colors.border, true: Colors.primaryLight }}
                    thumbColor={notifPrefs.dailyReminder ? Colors.primary : '#f4f4f4'}
                    testID="toggle-daily-reminder"
                  />
                </View>

                <View style={styles.settingsDivider} />

                <View style={styles.notifRow}>
                  <View style={styles.notifRowLeft}>
                    <View style={[styles.settingsIconBg, { backgroundColor: '#FEF2F2' }]}>
                      <Flame size={16} color="#EF4444" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.settingsLabel}>Streak Alerts</Text>
                      <Text style={styles.settingsHint}>Warns when your streak is at risk</Text>
                    </View>
                  </View>
                  <Switch
                    value={notifPrefs.streakAlerts}
                    onValueChange={(v) => void updateNotifPref('streakAlerts', v)}
                    trackColor={{ false: Colors.border, true: Colors.primaryLight }}
                    thumbColor={notifPrefs.streakAlerts ? Colors.primary : '#f4f4f4'}
                    testID="toggle-streak-alerts"
                  />
                </View>

                <View style={styles.settingsDivider} />

                <View style={styles.notifRow}>
                  <View style={styles.notifRowLeft}>
                    <View style={[styles.settingsIconBg, { backgroundColor: '#EDE9FE' }]}>
                      <CalendarClock size={16} color="#8B5CF6" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.settingsLabel}>Review Reminders</Text>
                      <Text style={styles.settingsHint}>When overdue SRS reviews pile up</Text>
                    </View>
                  </View>
                  <Switch
                    value={notifPrefs.reviewReminders}
                    onValueChange={(v) => void updateNotifPref('reviewReminders', v)}
                    trackColor={{ false: Colors.border, true: Colors.primaryLight }}
                    thumbColor={notifPrefs.reviewReminders ? Colors.primary : '#f4f4f4'}
                    testID="toggle-review-reminders"
                  />
                </View>

                <View style={styles.settingsDivider} />

                <View style={styles.notifRow}>
                  <View style={styles.notifRowLeft}>
                    <View style={[styles.settingsIconBg, { backgroundColor: '#ECFDF5' }]}>
                      <Trophy size={16} color="#10B981" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.settingsLabel}>Milestones</Text>
                      <Text style={styles.settingsHint}>Celebrate XP, streak & mastery goals</Text>
                    </View>
                  </View>
                  <Switch
                    value={notifPrefs.milestoneAlerts}
                    onValueChange={(v) => void updateNotifPref('milestoneAlerts', v)}
                    trackColor={{ false: Colors.border, true: Colors.primaryLight }}
                    thumbColor={notifPrefs.milestoneAlerts ? Colors.primary : '#f4f4f4'}
                    testID="toggle-milestone-alerts"
                  />
                </View>

                <View style={[styles.settingsDivider, { marginLeft: 0 }]} />

                <View style={styles.notifFooter}>
                  <BellOff size={12} color={Colors.textMuted} />
                  <Text style={styles.notifFooterText}>Max 2 notifications per day</Text>
                </View>
              </View>
            ) : (
              <View style={styles.notifCard}>
                <Text style={styles.notifLoadingText}>Loading notification settings...</Text>
              </View>
            )}
          </View>
        )}

        {renderAnimatedSection(
          8,
          <AchievementsGallery
            achievements={achievements}
            selectedCategory={selectedAchievementCategory}
            onCategoryChange={setSelectedAchievementCategory}
          />
        )}

        {renderAnimatedSection(
          9,
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Settings</Text>
            <View style={styles.settingsCard}>
              <Pressable
                style={({ pressed }) => [
                  styles.settingsRow,
                  pressed && styles.settingsRowPressed,
                ]}
                onPress={handleRestartOnboarding}
                testID="restart-onboarding"
              >
                <View style={styles.settingsRowLeft}>
                  <View
                    style={[styles.settingsIconBg, { backgroundColor: '#FEF3C7' }]}
                  >
                    <RotateCcw size={16} color="#F59E0B" />
                  </View>
                  <View>
                    <Text style={styles.settingsLabel}>Restart Onboarding</Text>
                    <Text style={styles.settingsHint}>
                      Go through setup again (for testing)
                    </Text>
                  </View>
                </View>
                <ChevronRight size={16} color={Colors.textMuted} />
              </Pressable>

              <View style={styles.settingsDivider} />

              <Pressable
                style={({ pressed }) => [
                  styles.settingsRow,
                  pressed && styles.settingsRowPressed,
                ]}
                onPress={handleResetAllData}
                testID="reset-all-data"
              >
                <View style={styles.settingsRowLeft}>
                  <View
                    style={[styles.settingsIconBg, { backgroundColor: '#FEF2F2' }]}
                  >
                    <Trash2 size={16} color="#EF4444" />
                  </View>
                  <View>
                    <Text style={[styles.settingsLabel, { color: '#EF4444' }]}>
                      Reset All Data
                    </Text>
                    <Text style={styles.settingsHint}>
                      Delete all progress permanently
                    </Text>
                  </View>
                </View>
                <ChevronRight size={16} color={Colors.textMuted} />
              </Pressable>
            </View>
          </View>
        )}

        {renderAnimatedSection(
          10,
          <ShareProgressButton
            onPress={() => setShowShareCard(true)}
            variant="primary"
            style={{ marginBottom: 20 }}
          />
        )}

        <View style={{ height: 40 }} />
      </Animated.ScrollView>

      <ShareableStatCard
        userName={user?.name || 'French Learner'}
        streakCount={gameState?.streakCount ?? 0}
        totalXP={gameState?.totalXP ?? 0}
        cefrLevel={certifiedLevel}
        wordsLearned={masteredGapCount}
        visible={showShareCard}
        onClose={() => setShowShareCard(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  safeTop: {
    backgroundColor: Colors.background,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  navSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: Colors.primary,
  },
  cefrBadgeFloat: {
    position: 'absolute',
    bottom: -4,
    right: -8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.background,
  },
  cefrBadgeFloatText: {
    fontSize: 10,
    fontWeight: '700' as const,
  },
  userName: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.text,
    letterSpacing: -0.3,
  },
  memberSince: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 2,
  },
  currentModuleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
  },
  currentModuleText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  totalHoursCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 18,
    marginBottom: 16,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  totalHoursLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  totalHoursLabel: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.9)',
  },
  totalHoursValue: {
    fontSize: 28,
    fontWeight: '800' as const,
    color: '#fff',
    letterSpacing: -0.5,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    minWidth: (SCREEN_WIDTH - 50) / 2 - 5,
    backgroundColor: Colors.backgroundCard,
    borderRadius: 14,
    padding: 14,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  statIconBg: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.text,
    letterSpacing: -0.3,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 10,
    letterSpacing: -0.2,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  masteryCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  masteryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    marginBottom: 16,
  },
  masteryRing: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 5,
    borderColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECFDF5',
  },
  masteryPercent: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: '#059669',
  },
  masteryDetails: {
    flex: 1,
    gap: 8,
  },
  masteryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  masteryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  masteryItemText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  masteryBar: {
    flexDirection: 'row',
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
  },
  masteryBarFill: {
    height: '100%',
  },
  breakdownCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 16,
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  breakdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: 90,
  },
  breakdownLabel: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  breakdownBarContainer: {
    flex: 1,
  },
  breakdownTime: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    width: 50,
    textAlign: 'right' as const,
  },

  settingsCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    overflow: 'hidden',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  settingsRowPressed: {
    backgroundColor: Colors.backgroundSecondary,
  },
  settingsRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  settingsIconBg: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsLabel: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  settingsHint: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 1,
  },
  settingsDivider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginLeft: 62,
  },
  weaknessMapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: Colors.primaryLight,
    borderRadius: 10,
  },
  weaknessMapBtnText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  enableNotifBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 14,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  enableNotifTextWrap: {
    flex: 1,
  },
  enableNotifTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#fff',
  },
  enableNotifSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  notifCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    overflow: 'hidden',
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  notifRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 10,
  },
  notifTimeText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '500' as const,
    marginTop: 2,
  },
  notifFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.backgroundSecondary,
  },
  notifFooterText: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  notifLoadingText: {
    fontSize: 13,
    color: Colors.textMuted,
    padding: 20,
    textAlign: 'center' as const,
  },
});
