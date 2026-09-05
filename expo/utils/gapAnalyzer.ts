import { GapItem, GapCategory, CEFRLevel, ConceptCluster } from '@/types';
import { classifyGapUrgency } from '@/utils/gapScheduler';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
  'french', 'vs', 'and', 'or', 'using', 'basic', 'advanced', 'how',
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de',
]);

function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-zàâäéèêëïîôùûüÿç\s'\-]/g, '')
    .split(/[\s\-_,./\\()]+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

function normalizeConceptKey(label: string): string {
  const keywords = extractKeywords(label);
  return keywords.sort().join('_');
}

function keywordOverlap(keywords1: string[], keywords2: string[]): number {
  if (keywords1.length === 0 || keywords2.length === 0) return 0;
  const set2 = new Set(keywords2);
  let overlap = 0;
  for (const w of keywords1) {
    if (set2.has(w)) overlap++;
  }
  return overlap / Math.min(keywords1.length, keywords2.length);
}

const FALLBACK_NAMES: Record<string, string> = {
  'vocabulary_vocab': 'Vocabulary Building',
  'vocabulary_general': 'General Vocabulary',
  'grammar_grammar': 'Grammar Patterns',
  'grammar_general': 'Grammar Fundamentals',
  'pronunciation_pronunciation': 'Pronunciation Practice',
  'pronunciation_general': 'Sound Patterns',
  'phrasing_connector': 'Connectors & Flow',
  'phrasing_filler': 'Filler Words & Fluency',
  'phrasing_general': 'Natural Phrasing',
  'register_politeness': 'Formal & Polite French',
  'register_general': 'Register & Tone',
};

const FALLBACK_DESCRIPTIONS: Record<string, string> = {
  'vocabulary_vocab': 'Build your French word bank with targeted practice',
  'vocabulary_general': 'Expand your French vocabulary',
  'grammar_grammar': 'Master French grammar rules and conjugations',
  'grammar_general': 'Strengthen your grammar foundations',
  'pronunciation_pronunciation': 'Refine your French pronunciation',
  'pronunciation_general': 'Work on French sound patterns',
  'phrasing_connector': 'Link your ideas more naturally in French',
  'phrasing_filler': 'Sound more fluent with natural fillers',
  'phrasing_general': 'Express yourself more naturally in French',
  'register_politeness': 'Navigate formal and polite French with confidence',
  'register_general': 'Master the right tone for every situation',
};

function calculateWeaknessScore(gaps: GapItem[]): number {
  if (gaps.length === 0) return 0;

  let totalScore = 0;
  for (const gap of gaps) {
    const correctRatio = Math.min(gap.consecutiveCorrect, 5) / 5;
    const baseWeakness = (1 - correctRatio) * 60;

    const urgency = classifyGapUrgency(gap);
    let urgencyBoost = 0;
    if (urgency.urgency === 'critical') urgencyBoost = 30;
    else if (urgency.urgency === 'due') urgencyBoost = 15;
    else if (urgency.urgency === 'upcoming') urgencyBoost = 5;

    const newGapBoost = gap.reviewCount === 0 ? 10 : 0;

    totalScore += Math.min(100, baseWeakness + urgencyBoost + newGapBoost);
  }

  return Math.round(totalScore / gaps.length);
}

function getMajorityCategory(gaps: GapItem[]): GapCategory {
  const counts: Record<GapCategory, number> = {
    vocabulary: 0, grammar: 0, pronunciation: 0, phrasing: 0, register: 0,
  };
  gaps.forEach(g => counts[g.category]++);

  let maxCat: GapCategory = 'vocabulary';
  let maxCount = 0;
  for (const [cat, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count;
      maxCat = cat as GapCategory;
    }
  }
  return maxCat;
}

function getMajorityCefrLevel(gaps: GapItem[]): CEFRLevel | undefined {
  const counts: Record<string, number> = {};
  gaps.forEach(g => {
    if (g.cefrLevel) counts[g.cefrLevel] = (counts[g.cefrLevel] || 0) + 1;
  });

  let maxLevel: string | undefined;
  let maxCount = 0;
  for (const [level, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count;
      maxLevel = level;
    }
  }
  return maxLevel as CEFRLevel | undefined;
}

export function analyzeGapConcepts(gaps: GapItem[]): ConceptCluster[] {
  const activeGaps = gaps.filter(g => !g.masteredAt);

  if (activeGaps.length === 0) return [];

  const conceptGroups = new Map<string, { gaps: GapItem[]; labels: string[] }>();
  const ungrouped: GapItem[] = [];

  for (const gap of activeGaps) {
    if (gap.conceptData?.conceptLabel) {
      const key = normalizeConceptKey(gap.conceptData.conceptLabel);
      const existing = conceptGroups.get(key);
      if (existing) {
        existing.gaps.push(gap);
        if (!existing.labels.includes(gap.conceptData.conceptLabel)) {
          existing.labels.push(gap.conceptData.conceptLabel);
        }
      } else {
        conceptGroups.set(key, {
          gaps: [gap],
          labels: [gap.conceptData.conceptLabel],
        });
      }
    } else {
      ungrouped.push(gap);
    }
  }

  const keys = Array.from(conceptGroups.keys());
  const merged = new Set<string>();

  for (let i = 0; i < keys.length; i++) {
    if (merged.has(keys[i])) continue;
    const keywords1 = keys[i].split('_');

    for (let j = i + 1; j < keys.length; j++) {
      if (merged.has(keys[j])) continue;
      const keywords2 = keys[j].split('_');

      if (keywordOverlap(keywords1, keywords2) >= 0.5) {
        const group1 = conceptGroups.get(keys[i])!;
        const group2 = conceptGroups.get(keys[j])!;
        group1.gaps.push(...group2.gaps);
        group1.labels.push(...group2.labels.filter(l => !group1.labels.includes(l)));
        conceptGroups.delete(keys[j]);
        merged.add(keys[j]);
      }
    }
  }

  const categoryGroups = new Map<string, GapItem[]>();
  for (const gap of ungrouped) {
    const key = `${gap.category}_${gap.gapType}`;
    const existing = categoryGroups.get(key) || [];
    existing.push(gap);
    categoryGroups.set(key, existing);
  }

  const clusters: ConceptCluster[] = [];

  for (const [_key, group] of conceptGroups) {
    const category = getMajorityCategory(group.gaps);
    const cefrLevel = getMajorityCefrLevel(group.gaps);
    const primaryLabel = group.labels[0] || 'Practice';

    clusters.push({
      id: `concept_${generateId()}`,
      name: primaryLabel,
      description: group.gaps[0]?.conceptData?.teachingFocus || `Practice ${primaryLabel.toLowerCase()} with targeted exercises`,
      category,
      cefrLevel,
      gapIds: group.gaps.map(g => g.id),
      weaknessScore: calculateWeaknessScore(group.gaps),
      sampleItems: group.gaps.slice(0, 3).map(g => ({
        french: g.frenchWord,
        english: g.englishTranslation,
      })),
      conceptLabels: group.labels,
      gapCount: group.gaps.length,
    });
  }

  for (const [key, gapList] of categoryGroups) {
    if (gapList.length === 0) continue;

    const category = getMajorityCategory(gapList);
    const cefrLevel = getMajorityCefrLevel(gapList);
    const name = FALLBACK_NAMES[key] || `${category.charAt(0).toUpperCase() + category.slice(1)} Practice`;
    const description = FALLBACK_DESCRIPTIONS[key] || `Strengthen your ${category} skills`;

    clusters.push({
      id: `cat_${generateId()}`,
      name,
      description,
      category,
      cefrLevel,
      gapIds: gapList.map(g => g.id),
      weaknessScore: calculateWeaknessScore(gapList),
      sampleItems: gapList.slice(0, 3).map(g => ({
        french: g.frenchWord,
        english: g.englishTranslation,
      })),
      conceptLabels: [],
      gapCount: gapList.length,
    });
  }

  clusters.sort((a, b) => b.weaknessScore - a.weaknessScore);

  return clusters;
}

export function getClusterForGaps(
  clusterId: string,
  gaps: GapItem[],
  allClusters: ConceptCluster[],
): ConceptCluster | null {
  return allClusters.find(c => c.id === clusterId) || null;
}
