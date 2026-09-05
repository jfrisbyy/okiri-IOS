import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const STORAGE_KEYS = {
  notificationPrefs: 'okiri_notification_prefs',
  lastNotificationDate: 'okiri_last_notification_date',
  notificationsSentToday: 'okiri_notifications_sent_today',
};

export interface NotificationPreferences {
  dailyReminder: boolean;
  streakAlerts: boolean;
  reviewReminders: boolean;
  milestoneAlerts: boolean;
  reminderHour: number;
  reminderMinute: number;
  permissionGranted: boolean;
}

const DEFAULT_PREFS: NotificationPreferences = {
  dailyReminder: true,
  streakAlerts: true,
  reviewReminders: true,
  milestoneAlerts: true,
  reminderHour: 9,
  reminderMinute: 0,
  permissionGranted: false,
};

const DAILY_REMINDER_ID = 'daily-reminder';
const STREAK_RISK_ID = 'streak-risk';
const REVIEW_DUE_ID = 'review-due';

const DAILY_MESSAGES = [
  { title: 'Bonjour! 🇫🇷', body: 'Your French is waiting. Even 5 minutes keeps the momentum going.' },
  { title: 'Time to practice!', body: 'A quick lesson today keeps the forgetting curve at bay.' },
  { title: 'Your words miss you', body: 'New vocabulary sticks best with daily review. Jump in!' },
  { title: 'Petit à petit...', body: "Little by little, the bird builds its nest. Let's add a twig today." },
  { title: 'Ready for French?', body: "Your personalized lesson is waiting. Let's make today count." },
  { title: 'Consistency wins 🏆', body: 'The best learners practice daily. Your turn!' },
];

const STREAK_MESSAGES = [
  (streak: number) => ({ title: `Don't lose your ${streak}-day streak!`, body: "There's still time today. A quick review is all it takes." }),
  (streak: number) => ({ title: `${streak} days strong 💪`, body: "Your streak is at risk — hop in for a fast session before bed." }),
  (streak: number) => ({ title: 'Streak check ⚡', body: `You've been consistent for ${streak} days. Keep the chain going!` }),
];

const REVIEW_MESSAGES = [
  (count: number) => ({ title: `${count} words due for review`, body: '5 minutes is all you need to lock them in.' }),
  (count: number) => ({ title: 'Review time 📚', body: `${count} words are ready for spaced repetition. Quick session?` }),
  (count: number) => ({ title: "Your deck needs you", body: `${count} overdue reviews — catch up before they slip away.` }),
];

const MILESTONE_MESSAGES: Record<string, { title: string; body: string }> = {
  xp_100: { title: 'First 100 XP! 🎉', body: "You're off to a great start. Keep the momentum!" },
  xp_500: { title: '500 XP milestone! ⭐', body: "Seriously impressive. You're building real skills." },
  xp_1000: { title: '1,000 XP! 🏆', body: "You just hit a thousand. That's dedication." },
  xp_2500: { title: '2,500 XP! 🔥', body: "You're in the top tier of learners. Magnifique!" },
  xp_5000: { title: '5,000 XP! 🚀', body: 'Half a grand in XP. Your French is transforming.' },
  streak_7: { title: '7-day streak! 🔥', body: 'A full week of daily practice. Incredible consistency.' },
  streak_30: { title: '30-day streak! 💎', body: "A whole month! You've built a real habit." },
  streak_100: { title: '100-day streak! 🏅', body: "Triple digits. You're unstoppable." },
  words_10: { title: '10 words mastered!', body: "Your first ten are locked in. More to come!" },
  words_50: { title: '50 words mastered! 📖', body: "Fifty words deep. You're building real vocabulary." },
  words_100: { title: '100 words mastered! 🎓', body: 'A hundred words — enough for basic conversations!' },
};

function setupNotificationChannel() {
  if (Platform.OS === 'android') {
    void Notifications.setNotificationChannelAsync('learning-reminders', {
      name: 'Learning Reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#F97316',
    });
  }
}

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') {
    console.log('[Notifications] Web platform — skipping permissions');
    return false;
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    const granted = finalStatus === 'granted';
    console.log('[Notifications] Permission:', granted ? 'granted' : 'denied');

    const prefs = await getNotificationPreferences();
    await saveNotificationPreferences({ ...prefs, permissionGranted: granted });

    if (granted) {
      setupNotificationChannel();
    }

    return granted;
  } catch (error) {
    console.log('[Notifications] Error requesting permissions:', error);
    return false;
  }
}

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEYS.notificationPrefs);
    if (stored) {
      return { ...DEFAULT_PREFS, ...JSON.parse(stored) };
    }
    return DEFAULT_PREFS;
  } catch (error) {
    console.log('[Notifications] Error loading preferences:', error);
    return DEFAULT_PREFS;
  }
}

export async function saveNotificationPreferences(prefs: NotificationPreferences): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.notificationPrefs, JSON.stringify(prefs));
    console.log('[Notifications] Preferences saved:', JSON.stringify(prefs));
    await rescheduleAllNotifications(prefs);
  } catch (error) {
    console.log('[Notifications] Error saving preferences:', error);
  }
}

async function getNotificationsSentToday(): Promise<number> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const stored = await AsyncStorage.getItem(STORAGE_KEYS.notificationsSentToday);
    if (stored) {
      const data = JSON.parse(stored) as { date: string; count: number };
      if (data.date === today) return data.count;
    }
    return 0;
  } catch {
    return 0;
  }
}

async function incrementNotificationCount(): Promise<boolean> {
  const today = new Date().toISOString().split('T')[0];
  const count = await getNotificationsSentToday();
  if (count >= 2) {
    console.log('[Notifications] Daily limit reached (2), skipping');
    return false;
  }
  await AsyncStorage.setItem(
    STORAGE_KEYS.notificationsSentToday,
    JSON.stringify({ date: today, count: count + 1 })
  );
  return true;
}

async function rescheduleAllNotifications(prefs: NotificationPreferences): Promise<void> {
  if (Platform.OS === 'web') return;
  if (!prefs.permissionGranted) return;

  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('[Notifications] Cancelled all existing notifications');

    if (prefs.dailyReminder) {
      await scheduleDailyReminder(prefs.reminderHour, prefs.reminderMinute);
    }
  } catch (error) {
    console.log('[Notifications] Error rescheduling:', error);
  }
}

async function scheduleDailyReminder(hour: number, minute: number): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    const message = DAILY_MESSAGES[Math.floor(Math.random() * DAILY_MESSAGES.length)];

    await Notifications.scheduleNotificationAsync({
      content: {
        title: message.title,
        body: message.body,
        sound: 'default',
        categoryIdentifier: 'learning-reminders',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
      identifier: DAILY_REMINDER_ID,
    });

    console.log(`[Notifications] Daily reminder scheduled for ${hour}:${String(minute).padStart(2, '0')}`);
  } catch (error) {
    console.log('[Notifications] Error scheduling daily reminder:', error);
  }
}

export async function checkAndSendStreakRiskNotification(
  streakCount: number,
  hasPracticedToday: boolean
): Promise<void> {
  if (Platform.OS === 'web') return;
  if (streakCount <= 0 || hasPracticedToday) return;

  const prefs = await getNotificationPreferences();
  if (!prefs.streakAlerts || !prefs.permissionGranted) return;

  const now = new Date();
  const currentHour = now.getHours();
  if (currentHour < 18) return;

  const canSend = await incrementNotificationCount();
  if (!canSend) return;

  try {
    const messageFn = STREAK_MESSAGES[Math.floor(Math.random() * STREAK_MESSAGES.length)];
    const message = messageFn(streakCount);

    await Notifications.scheduleNotificationAsync({
      content: {
        title: message.title,
        body: message.body,
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 5,
      },
      identifier: STREAK_RISK_ID,
    });

    console.log('[Notifications] Streak risk notification scheduled for streak:', streakCount);
  } catch (error) {
    console.log('[Notifications] Error sending streak risk notification:', error);
  }
}

export async function checkAndSendReviewNotification(overdueCount: number): Promise<void> {
  if (Platform.OS === 'web') return;
  if (overdueCount < 5) return;

  const prefs = await getNotificationPreferences();
  if (!prefs.reviewReminders || !prefs.permissionGranted) return;

  const canSend = await incrementNotificationCount();
  if (!canSend) return;

  try {
    const messageFn = REVIEW_MESSAGES[Math.floor(Math.random() * REVIEW_MESSAGES.length)];
    const message = messageFn(overdueCount);

    await Notifications.scheduleNotificationAsync({
      content: {
        title: message.title,
        body: message.body,
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 5,
      },
      identifier: REVIEW_DUE_ID,
    });

    console.log('[Notifications] Review notification sent for', overdueCount, 'overdue items');
  } catch (error) {
    console.log('[Notifications] Error sending review notification:', error);
  }
}

export async function sendMilestoneNotification(milestoneKey: string): Promise<void> {
  if (Platform.OS === 'web') return;

  const prefs = await getNotificationPreferences();
  if (!prefs.milestoneAlerts || !prefs.permissionGranted) return;

  const message = MILESTONE_MESSAGES[milestoneKey];
  if (!message) return;

  const canSend = await incrementNotificationCount();
  if (!canSend) return;

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: message.title,
        body: message.body,
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 2,
      },
    });

    console.log('[Notifications] Milestone notification sent:', milestoneKey);
  } catch (error) {
    console.log('[Notifications] Error sending milestone notification:', error);
  }
}

export function checkXPMilestones(totalXP: number, shownMilestones: Record<string, boolean>): string | null {
  const thresholds = [
    { key: 'xp_5000', xp: 5000 },
    { key: 'xp_2500', xp: 2500 },
    { key: 'xp_1000', xp: 1000 },
    { key: 'xp_500', xp: 500 },
    { key: 'xp_100', xp: 100 },
  ];

  for (const t of thresholds) {
    if (totalXP >= t.xp && !shownMilestones[t.key]) {
      return t.key;
    }
  }
  return null;
}

export function checkStreakMilestones(streakCount: number, shownMilestones: Record<string, boolean>): string | null {
  const thresholds = [
    { key: 'streak_100', streak: 100 },
    { key: 'streak_30', streak: 30 },
    { key: 'streak_7', streak: 7 },
  ];

  for (const t of thresholds) {
    if (streakCount >= t.streak && !shownMilestones[t.key]) {
      return t.key;
    }
  }
  return null;
}

export function checkWordsMilestones(masteredCount: number, shownMilestones: Record<string, boolean>): string | null {
  const thresholds = [
    { key: 'words_100', count: 100 },
    { key: 'words_50', count: 50 },
    { key: 'words_10', count: 10 },
  ];

  for (const t of thresholds) {
    if (masteredCount >= t.count && !shownMilestones[t.key]) {
      return t.key;
    }
  }
  return null;
}

export async function initializeNotifications(): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });

    setupNotificationChannel();

    const prefs = await getNotificationPreferences();
    if (prefs.permissionGranted) {
      await rescheduleAllNotifications(prefs);
    }

    console.log('[Notifications] Initialized successfully');
  } catch (error) {
    console.log('[Notifications] Initialization error:', error);
  }
}
