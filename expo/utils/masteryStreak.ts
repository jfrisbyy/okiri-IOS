import type { GapItem } from '@/types';

export interface MasteryStreakInfo {
  current: number;
  longest: number;
  masteryDays: string[];
  last7: { date: string; mastered: boolean; count: number }[];
  masteredToday: number;
}

function toDateKey(iso: string): string {
  return new Date(iso).toISOString().split('T')[0];
}

function isYesterday(dateKey: string, today: string): boolean {
  const d = new Date(dateKey);
  const t = new Date(today);
  const diff = t.getTime() - d.getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  return diff > 0 && diff <= dayMs * 1.5;
}

export function computeMasteryStreak(gaps: GapItem[]): MasteryStreakInfo {
  const masteryDaySet = new Set<string>();
  const dayCounts: Record<string, number> = {};

  for (const g of gaps) {
    if (!g.masteredAt) continue;
    const key = toDateKey(g.masteredAt);
    masteryDaySet.add(key);
    dayCounts[key] = (dayCounts[key] || 0) + 1;
  }

  const days = Array.from(masteryDaySet).sort();
  const today = new Date().toISOString().split('T')[0];

  let longest = 0;
  let running = 0;
  let prev: string | null = null;
  for (const day of days) {
    if (prev === null) {
      running = 1;
    } else {
      const prevDate = new Date(prev);
      const curDate = new Date(day);
      const diff = (curDate.getTime() - prevDate.getTime()) / (24 * 60 * 60 * 1000);
      if (diff <= 1.5) running += 1;
      else running = 1;
    }
    if (running > longest) longest = running;
    prev = day;
  }

  let current = 0;
  if (days.length > 0) {
    const lastDay = days[days.length - 1];
    if (lastDay === today || isYesterday(lastDay, today)) {
      current = 1;
      for (let i = days.length - 2; i >= 0; i--) {
        const a = new Date(days[i]);
        const b = new Date(days[i + 1]);
        const diff = (b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000);
        if (diff <= 1.5) current += 1;
        else break;
      }
      if (lastDay !== today && !isYesterday(lastDay, today)) current = 0;
    }
  }

  const last7: { date: string; mastered: boolean; count: number }[] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    last7.push({
      date: key,
      mastered: masteryDaySet.has(key),
      count: dayCounts[key] || 0,
    });
  }

  return {
    current,
    longest: Math.max(longest, current),
    masteryDays: days,
    last7,
    masteredToday: dayCounts[today] || 0,
  };
}
