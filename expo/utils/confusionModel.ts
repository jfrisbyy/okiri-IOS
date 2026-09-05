import { ConfusionLink, GapItem } from '@/types';

const MIN_STRENGTH_TO_SURFACE = 2;

export interface ConfusionEvent {
  correctGapId: string;
  pickedText: string;
  timestamp?: string;
}

function normalize(s: string): string {
  return (s || '').trim().toLowerCase();
}

function findPartnerByPick(
  pickedText: string,
  candidates: GapItem[],
): GapItem | null {
  const p = normalize(pickedText);
  if (!p) return null;
  for (const g of candidates) {
    if (normalize(g.frenchWord) === p || normalize(g.englishTranslation) === p) return g;
  }
  for (const g of candidates) {
    const fw = normalize(g.frenchWord);
    const et = normalize(g.englishTranslation);
    if ((fw && p.includes(fw)) || (et && p.includes(et))) return g;
  }
  return null;
}

export function recordConfusion(
  gaps: GapItem[],
  event: ConfusionEvent,
): GapItem[] {
  const target = gaps.find(g => g.id === event.correctGapId);
  if (!target) return gaps;
  const partner = findPartnerByPick(
    event.pickedText,
    gaps.filter(g => g.id !== target.id),
  );
  if (!partner) return gaps;

  const now = event.timestamp ?? new Date().toISOString();

  return gaps.map(g => {
    if (g.id === target.id) return upsertLink(g, partner.id, now);
    if (g.id === partner.id) return upsertLink(g, target.id, now);
    return g;
  });
}

function upsertLink(gap: GapItem, partnerId: string, now: string): GapItem {
  const links = [...(gap.confusionLinks ?? [])];
  const idx = links.findIndex(l => l.partnerGapId === partnerId);
  if (idx >= 0) {
    const prev = links[idx];
    links[idx] = {
      ...prev,
      wrongPicks: prev.wrongPicks + 1,
      lastConfusedAt: now,
      strength: Math.min(10, prev.strength + 1),
    };
  } else {
    links.push({ partnerGapId: partnerId, wrongPicks: 1, lastConfusedAt: now, strength: 1 });
  }
  return { ...gap, confusionLinks: links };
}

export interface ConfusionPair {
  gapA: GapItem;
  gapB: GapItem;
  strength: number;
  wrongPicks: number;
  lastConfusedAt: string;
}

export function getTopConfusionPairs(gaps: GapItem[], limit: number = 5): ConfusionPair[] {
  const seen = new Set<string>();
  const out: ConfusionPair[] = [];
  for (const g of gaps) {
    for (const l of g.confusionLinks ?? []) {
      if (l.strength < MIN_STRENGTH_TO_SURFACE) continue;
      const partner = gaps.find(x => x.id === l.partnerGapId);
      if (!partner) continue;
      const key = [g.id, partner.id].sort().join(':');
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        gapA: g,
        gapB: partner,
        strength: l.strength,
        wrongPicks: l.wrongPicks,
        lastConfusedAt: l.lastConfusedAt,
      });
    }
  }
  return out.sort((a, b) => b.strength - a.strength).slice(0, limit);
}

export function findConfusionPartner(gap: GapItem, gaps: GapItem[]): GapItem | null {
  const links = gap.confusionLinks ?? [];
  if (links.length === 0) return findCategoryNeighbor(gap, gaps);
  const top = [...links].sort((a, b) => b.strength - a.strength)[0];
  return gaps.find(g => g.id === top.partnerGapId) ?? findCategoryNeighbor(gap, gaps);
}

function findCategoryNeighbor(gap: GapItem, gaps: GapItem[]): GapItem | null {
  const sameCat = gaps.filter(g =>
    g.id !== gap.id &&
    g.category === gap.category &&
    (g.contentType ?? null) === (gap.contentType ?? null),
  );
  if (sameCat.length === 0) return null;
  return sameCat[Math.floor(Math.random() * sameCat.length)];
}
