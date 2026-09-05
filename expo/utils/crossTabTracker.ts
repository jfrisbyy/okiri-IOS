import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'crossTabEncounters';
const MAX_ENCOUNTERS = 5000;

export type SourceTab = 'read' | 'watch' | 'speak' | 'deck' | 'foundation';

export interface WordEncounter {
  word: string;
  context: string;
  sourceTab: SourceTab;
  contentId: string;
  timestamp: string;
}

export interface EncounterFrequency {
  word: string;
  count: number;
  lastSeen: string;
  sources: SourceTab[];
  contexts: string[];
}

let cachedEncounters: WordEncounter[] | null = null;

async function loadEncounters(): Promise<WordEncounter[]> {
  if (cachedEncounters) return cachedEncounters;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    cachedEncounters = raw ? JSON.parse(raw) : [];
    return cachedEncounters!;
  } catch (e) {
    console.log('[CrossTabTracker] Failed to load encounters:', e);
    cachedEncounters = [];
    return [];
  }
}

async function saveEncounters(encounters: WordEncounter[]): Promise<void> {
  const trimmed = encounters.length > MAX_ENCOUNTERS
    ? encounters.slice(encounters.length - MAX_ENCOUNTERS)
    : encounters;
  cachedEncounters = trimmed;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.log('[CrossTabTracker] Failed to save encounters:', e);
  }
}

function normalizeWord(word: string): string {
  return word
    .toLowerCase()
    .replace(/[.,;:!?'"()«»\-…\d]/g, '')
    .trim();
}

export async function logEncounter(
  word: string,
  context: string,
  sourceTab: SourceTab,
  contentId: string
): Promise<void> {
  const normalized = normalizeWord(word);
  if (!normalized || normalized.length < 2) return;

  const encounters = await loadEncounters();

  const isDuplicate = encounters.some(
    (e) =>
      normalizeWord(e.word) === normalized &&
      e.sourceTab === sourceTab &&
      e.contentId === contentId
  );
  if (isDuplicate) {
    console.log(`[CrossTabTracker] Skipping duplicate: "${normalized}" from ${sourceTab}/${contentId}`);
    return;
  }

  const encounter: WordEncounter = {
    word: normalized,
    context: context.slice(0, 200),
    sourceTab,
    contentId,
    timestamp: new Date().toISOString(),
  };

  encounters.push(encounter);
  await saveEncounters(encounters);
  console.log(`[CrossTabTracker] Logged "${normalized}" from ${sourceTab} (total: ${encounters.length})`);
}

export async function logEncounterBatch(
  words: string[],
  context: string,
  sourceTab: SourceTab,
  contentId: string
): Promise<void> {
  const encounters = await loadEncounters();
  let added = 0;

  for (const word of words) {
    const normalized = normalizeWord(word);
    if (!normalized || normalized.length < 2) continue;

    const isDuplicate = encounters.some(
      (e) =>
        normalizeWord(e.word) === normalized &&
        e.sourceTab === sourceTab &&
        e.contentId === contentId
    );
    if (isDuplicate) continue;

    encounters.push({
      word: normalized,
      context: context.slice(0, 200),
      sourceTab,
      contentId,
      timestamp: new Date().toISOString(),
    });
    added++;
  }

  if (added > 0) {
    await saveEncounters(encounters);
    console.log(`[CrossTabTracker] Batch logged ${added} words from ${sourceTab}/${contentId}`);
  }
}

export async function getRecentEncounters(days: number = 7): Promise<EncounterFrequency[]> {
  const encounters = await loadEncounters();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString();

  const recent = encounters.filter((e) => e.timestamp >= cutoffStr);

  const freqMap = new Map<string, EncounterFrequency>();
  for (const e of recent) {
    const key = normalizeWord(e.word);
    const existing = freqMap.get(key);
    if (existing) {
      existing.count++;
      if (e.timestamp > existing.lastSeen) existing.lastSeen = e.timestamp;
      if (!existing.sources.includes(e.sourceTab)) existing.sources.push(e.sourceTab);
      if (existing.contexts.length < 3 && !existing.contexts.includes(e.context)) {
        existing.contexts.push(e.context);
      }
    } else {
      freqMap.set(key, {
        word: key,
        count: 1,
        lastSeen: e.timestamp,
        sources: [e.sourceTab],
        contexts: [e.context],
      });
    }
  }

  return Array.from(freqMap.values()).sort((a, b) => b.count - a.count);
}

export async function getUntestedEncounters(
  gapWords: string[]
): Promise<EncounterFrequency[]> {
  const gapSet = new Set(gapWords.map(normalizeWord));
  const recent = await getRecentEncounters(30);
  return recent.filter((e) => !gapSet.has(e.word));
}

export async function getAllEncounters(): Promise<WordEncounter[]> {
  return loadEncounters();
}

export async function getEncounterStats(): Promise<{
  totalEncounters: number;
  uniqueWords: number;
  bySource: Record<SourceTab, number>;
}> {
  const encounters = await loadEncounters();
  const uniqueWords = new Set(encounters.map((e) => normalizeWord(e.word)));
  const bySource: Record<SourceTab, number> = {
    read: 0,
    watch: 0,
    speak: 0,
    deck: 0,
    foundation: 0,
  };
  for (const e of encounters) {
    bySource[e.sourceTab]++;
  }
  return {
    totalEncounters: encounters.length,
    uniqueWords: uniqueWords.size,
    bySource,
  };
}

export function invalidateCache(): void {
  cachedEncounters = null;
}
