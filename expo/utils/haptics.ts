import * as Haptics from 'expo-haptics';

export const haptics = {
  light: () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  medium: () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  heavy: () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
  success: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  error: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
  warning: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
  selection: () => void Haptics.selectionAsync(),

  correctAnswer: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  wrongAnswer: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
  buttonPress: () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  achievementUnlock: () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
  streakMilestone: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  levelUp: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  cardFlip: () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
};
