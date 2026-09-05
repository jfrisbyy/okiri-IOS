import { CEFRLevel, Difficulty } from '@/types';
import { getCurrentCertifiedLevel } from '@/utils/proficiency';

export type DurationOption = {
  value: number;
  label: string;
  description: string;
};

export function getUserCEFRLevel(certifiedLevels: CEFRLevel[]): CEFRLevel {
  const level = getCurrentCertifiedLevel(certifiedLevels);
  return level ?? 'A1';
}

export function getRecommendedSpeakDurations(
  certifiedLevels: CEFRLevel[],
  totalSpeakingMinutes: number
): DurationOption[] {
  const level = getUserCEFRLevel(certifiedLevels);

  if (totalSpeakingMinutes < 10) {
    return [
      { value: 2, label: '2 min', description: 'Quick start' },
      { value: 3, label: '3 min', description: 'Short practice' },
      { value: 5, label: '5 min', description: 'Standard' },
    ];
  }

  const configs: Record<CEFRLevel, DurationOption[]> = {
    'A1': [
      { value: 2, label: '2 min', description: 'Quick warm-up' },
      { value: 5, label: '5 min', description: 'Standard' },
      { value: 8, label: '8 min', description: 'Challenge' },
    ],
    'A2': [
      { value: 3, label: '3 min', description: 'Quick warm-up' },
      { value: 5, label: '5 min', description: 'Standard' },
      { value: 10, label: '10 min', description: 'Extended' },
    ],
    'B1': [
      { value: 5, label: '5 min', description: 'Warm-up' },
      { value: 10, label: '10 min', description: 'Standard' },
      { value: 15, label: '15 min', description: 'Extended' },
    ],
    'B2': [
      { value: 5, label: '5 min', description: 'Quick session' },
      { value: 10, label: '10 min', description: 'Standard' },
      { value: 20, label: '20 min', description: 'Deep practice' },
    ],
    'C1': [
      { value: 10, label: '10 min', description: 'Standard' },
      { value: 20, label: '20 min', description: 'Extended' },
      { value: 30, label: '30 min', description: 'Marathon' },
    ],
    'C2': [
      { value: 10, label: '10 min', description: 'Standard' },
      { value: 20, label: '20 min', description: 'Extended' },
      { value: 30, label: '30 min', description: 'Marathon' },
    ],
  };

  return configs[level];
}

export function getGuidedPromptDuration(certifiedLevels: CEFRLevel[]): number {
  const level = getUserCEFRLevel(certifiedLevels);
  const map: Record<CEFRLevel, number> = {
    'A1': 2,
    'A2': 3,
    'B1': 5,
    'B2': 7,
    'C1': 10,
    'C2': 10,
  };
  return map[level];
}

export const CATEGORY_CEFR_LEVELS: Record<string, CEFRLevel> = {
  'describe': 'A1',
  'social': 'A1',
  'emotions': 'A2',
  'storytelling': 'B1',
  'opinions': 'B1',
  'hypothetical': 'B2',
};

export function isCategoryRecommended(categoryId: string, userLevel: CEFRLevel): boolean {
  const catLevel = CATEGORY_CEFR_LEVELS[categoryId];
  if (!catLevel) return false;
  const order: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  const catIndex = order.indexOf(catLevel);
  const userIndex = order.indexOf(userLevel);
  return catIndex <= userIndex && userIndex - catIndex <= 1;
}

export function getTextSessionConfig(certifiedLevels: CEFRLevel[]): {
  maxTokens: number;
  temperature: number;
} {
  const level = getUserCEFRLevel(certifiedLevels);
  const configs: Record<CEFRLevel, { maxTokens: number; temperature: number }> = {
    'A1': { maxTokens: 150, temperature: 0.7 },
    'A2': { maxTokens: 200, temperature: 0.8 },
    'B1': { maxTokens: 300, temperature: 0.85 },
    'B2': { maxTokens: 400, temperature: 0.9 },
    'C1': { maxTokens: 500, temperature: 0.9 },
    'C2': { maxTokens: 500, temperature: 0.95 },
  };
  return configs[level];
}

export function cefrToDifficulty(certifiedLevels: CEFRLevel[]): Difficulty {
  const level = getUserCEFRLevel(certifiedLevels);
  const map: Record<CEFRLevel, Difficulty> = {
    'A1': 'beginner',
    'A2': 'easy',
    'B1': 'medium',
    'B2': 'hard',
    'C1': 'university',
    'C2': 'university',
  };
  return map[level];
}
