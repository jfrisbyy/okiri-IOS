import { vocabularyThemes } from '@/data/vocabularyData';
import { essentialVerbs, grammarRules } from '@/data/grammarData';
import { frenchIdioms } from '@/data/idiomsData';
import { pronunciationCategories } from '@/data/pronunciationData';

const TAG = '[DistractorBank]';

interface DistractorEntry {
  french: string;
  english: string;
  theme?: string;
  cefrLevel?: string;
  category?: string;
}

interface ConjugationEntry {
  infinitive: string;
  english: string;
  tense: string;
  person: string;
  form: string;
}

interface IdiomEntry {
  french: string;
  meaning: string;
  literal: string;
  category: string;
}

let vocabularyByTheme: Map<string, DistractorEntry[]> = new Map();
let vocabularyByCefr: Map<string, DistractorEntry[]> = new Map();
let verbInfinitives: DistractorEntry[] = [];
let conjugationsByTense: Map<string, ConjugationEntry[]> = new Map();
let grammarTerms: string[] = [];
let idiomEntries: IdiomEntry[] = [];
let genericPool: DistractorEntry[] = [];
let pronunciationEntries: DistractorEntry[] = [];
let initialized = false;

const HARDCODED_FRENCH_ENGLISH: DistractorEntry[] = [
  { french: 'bonjour', english: 'hello' },
  { french: 'merci', english: 'thank you' },
  { french: 'maison', english: 'house' },
  { french: 'livre', english: 'book' },
  { french: 'chat', english: 'cat' },
  { french: 'chien', english: 'dog' },
  { french: 'eau', english: 'water' },
  { french: 'pain', english: 'bread' },
  { french: 'rouge', english: 'red' },
  { french: 'bleu', english: 'blue' },
  { french: 'grand', english: 'big' },
  { french: 'petit', english: 'small' },
  { french: 'manger', english: 'to eat' },
  { french: 'boire', english: 'to drink' },
  { french: 'aller', english: 'to go' },
  { french: 'être', english: 'to be' },
  { french: 'avoir', english: 'to have' },
  { french: 'faire', english: 'to do' },
  { french: 'jour', english: 'day' },
  { french: 'nuit', english: 'night' },
];

function initializeBank(): void {
  if (initialized) return;

  try {
    if (Array.isArray(vocabularyThemes)) {
      for (const theme of vocabularyThemes) {
        const themeEntries: DistractorEntry[] = [];
        if (Array.isArray(theme.items)) {
          for (const item of theme.items) {
            const entry: DistractorEntry = {
              french: item.french,
              english: item.english,
              theme: theme.id,
              cefrLevel: theme.cefrLevel,
              category: 'vocabulary',
            };
            themeEntries.push(entry);
            genericPool.push(entry);

            const cefrKey = theme.cefrLevel || 'unknown';
            const cefrList = vocabularyByCefr.get(cefrKey) || [];
            cefrList.push(entry);
            vocabularyByCefr.set(cefrKey, cefrList);
          }
        }
        vocabularyByTheme.set(theme.id, themeEntries);
      }
    }

    if (Array.isArray(essentialVerbs)) {
      const tenseKeys: { key: string; label: string }[] = [
        { key: 'present', label: 'present' },
        { key: 'imparfait', label: 'imparfait' },
        { key: 'futurSimple', label: 'futurSimple' },
        { key: 'conditional', label: 'conditional' },
        { key: 'subjunctive', label: 'subjunctive' },
      ];

      for (const verb of essentialVerbs) {
        const entry: DistractorEntry = {
          french: verb.infinitive,
          english: verb.english,
          category: 'verb',
        };
        verbInfinitives.push(entry);
        genericPool.push(entry);

        for (const { key, label } of tenseKeys) {
          const tenseData = (verb as any)[key];
          if (tenseData && typeof tenseData === 'object') {
            const tenseList = conjugationsByTense.get(label) || [];
            for (const [person, form] of Object.entries(tenseData)) {
              if (typeof form === 'string') {
                tenseList.push({
                  infinitive: verb.infinitive,
                  english: verb.english,
                  tense: label,
                  person,
                  form: form as string,
                });
              }
            }
            conjugationsByTense.set(label, tenseList);
          }
        }
      }
    }

    if (Array.isArray(grammarRules)) {
      for (const rule of grammarRules) {
        if (rule.title) grammarTerms.push(rule.title);
        if (rule.explanation) grammarTerms.push(rule.explanation);
        if (Array.isArray(rule.examples)) {
          for (const ex of rule.examples) {
            genericPool.push({
              french: ex.french,
              english: ex.english,
              category: 'grammar',
              cefrLevel: rule.cefrLevel,
            });
          }
        }
      }
    }

    if (Array.isArray(frenchIdioms)) {
      for (const idiom of frenchIdioms) {
        idiomEntries.push({
          french: idiom.french,
          meaning: idiom.meaning,
          literal: idiom.literal,
          category: idiom.category,
        });
        genericPool.push({
          french: idiom.french,
          english: idiom.meaning,
          category: 'idiom',
        });
      }
    }

    if (Array.isArray(pronunciationCategories)) {
      for (const cat of pronunciationCategories) {
        if (Array.isArray(cat.words)) {
          for (const w of cat.words) {
            const entry: DistractorEntry = {
              french: w.word,
              english: w.translation,
              category: 'pronunciation',
            };
            pronunciationEntries.push(entry);
            genericPool.push(entry);
          }
        }
      }
    }

    for (const hc of HARDCODED_FRENCH_ENGLISH) {
      const exists = genericPool.some(
        e => e.french.toLowerCase().trim() === hc.french.toLowerCase().trim()
      );
      if (!exists) genericPool.push(hc);
    }

    initialized = true;
    console.log(
      `${TAG} Initialized — vocabulary: ${vocabularyByTheme.size} themes, verbs: ${verbInfinitives.length}, conjugations: ${conjugationsByTense.size} tenses, idioms: ${idiomEntries.length}, pronunciation: ${pronunciationEntries.length}, total generic: ${genericPool.length}`
    );
  } catch (e) {
    console.error(`${TAG} Error initializing:`, e);
    initialized = true;
  }
}

function computePlausibilityScore(
  candidate: string,
  correctAnswer: string,
  candidateCefr?: string,
  targetCefr?: string,
): number {
  const cl = candidate.toLowerCase().trim();
  const al = correctAnswer.toLowerCase().trim();
  let score = 50;

  if (Math.abs(cl.length - al.length) <= 3) score += 20;
  if (cl.length > 0 && al.length > 0 && cl[0] === al[0]) score += 15;

  const candidateArticle = cl.match(/^(le|la|les|l'|un|une|des)\s/)?.[1] || '';
  const correctArticle = al.match(/^(le|la|les|l'|un|une|des)\s/)?.[1] || '';
  if (candidateArticle && correctArticle && candidateArticle === correctArticle) score += 10;

  const candidateWords = cl.split(/\s+/).length;
  const correctWords = al.split(/\s+/).length;
  if (candidateWords === correctWords) score += 10;

  if (candidateCefr && targetCefr) {
    const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    const ci = levels.indexOf(candidateCefr);
    const ti = levels.indexOf(targetCefr);
    if (ci >= 0 && ti >= 0) {
      const diff = Math.abs(ci - ti);
      if (diff === 0) score += 15;
      else if (diff === 1) score += 8;
    }
  }

  let sharedChars = 0;
  const shortLen = Math.min(cl.length, al.length);
  for (let i = 0; i < shortLen; i++) {
    if (cl.includes(al[i])) sharedChars++;
  }
  const similarity = shortLen > 0 ? sharedChars / shortLen : 0;
  if (similarity > 0.8) score -= 30;

  score += Math.floor(Math.random() * 11) - 5;

  return Math.max(0, Math.min(100, score));
}

function findThemeForWord(frenchWord: string): string | null {
  const lower = frenchWord.toLowerCase().trim();
  for (const [themeId, entries] of vocabularyByTheme) {
    for (const entry of entries) {
      if (entry.french.toLowerCase().trim() === lower) return themeId;
      if (entry.french.toLowerCase().includes(lower) || lower.includes(entry.french.toLowerCase())) return themeId;
    }
  }
  return null;
}

export interface SmartDistractorParams {
  correctAnswer: string;
  answerLanguage: 'french' | 'english';
  count: number;
  contentType?: string;
  category?: string;
  cefrLevel?: string;
  avoidList?: string[];
}

export function getSmartDistractors(params: SmartDistractorParams): string[] {
  try {
    initializeBank();

    const {
      correctAnswer,
      answerLanguage,
      count,
      contentType,
      category,
      cefrLevel,
      avoidList = [],
    } = params;

    if (!correctAnswer || correctAnswer.trim().length === 0) {
      return getHardcodedFallback(answerLanguage, count, []);
    }

    const normalizedAvoid = new Set<string>(
      [...avoidList, correctAnswer].map(s => s.toLowerCase().trim())
    );

    const field = answerLanguage === 'french' ? 'french' : 'english';

    const isCandidate = (entry: DistractorEntry): boolean => {
      const val = entry[field];
      if (!val || val.trim().length === 0) return false;
      return !normalizedAvoid.has(val.toLowerCase().trim());
    };

    let candidates: { value: string; cefr?: string }[] = [];
    let source = 'generic';

    if (contentType === 'vocabulary' || (!contentType && !category)) {
      const theme = category || findThemeForWord(correctAnswer);
      if (theme) {
        const themeEntries = vocabularyByTheme.get(theme);
        if (themeEntries) {
          const themeCandidates = themeEntries
            .filter(isCandidate)
            .map(e => ({ value: e[field], cefr: e.cefrLevel }));
          if (themeCandidates.length >= count) {
            candidates = themeCandidates;
            source = 'same_theme';
          }
        }
      }
    }

    if (contentType === 'verb_conjugation') {
      const verbCandidates = verbInfinitives
        .filter(isCandidate)
        .map(e => ({ value: e[field], cefr: e.cefrLevel }));
      if (verbCandidates.length >= count) {
        candidates = verbCandidates;
        source = 'verb_infinitives';
      }
    }

    if (contentType === 'expressions_idioms') {
      const idiomCandidates = idiomEntries
        .filter(e => {
          const val = answerLanguage === 'french' ? e.french : e.meaning;
          if (!val || val.trim().length === 0) return false;
          return !normalizedAvoid.has(val.toLowerCase().trim());
        })
        .map(e => ({
          value: answerLanguage === 'french' ? e.french : e.meaning,
          cefr: undefined,
        }));
      if (idiomCandidates.length >= count) {
        if (category) {
          const sameCat = idiomEntries
            .filter(e => {
              if (e.category !== category) return false;
              const val = answerLanguage === 'french' ? e.french : e.meaning;
              return val ? !normalizedAvoid.has(val.toLowerCase().trim()) : false;
            })
            .map(e => ({
              value: answerLanguage === 'french' ? e.french : e.meaning,
              cefr: undefined,
            }));
          if (sameCat.length >= count) {
            candidates = sameCat;
            source = 'same_idiom_category';
          } else {
            candidates = idiomCandidates;
            source = 'idioms';
          }
        } else {
          candidates = idiomCandidates;
          source = 'idioms';
        }
      }
    }

    if (candidates.length < count && cefrLevel) {
      const cefrEntries = vocabularyByCefr.get(cefrLevel);
      if (cefrEntries) {
        const cefrCandidates = cefrEntries
          .filter(isCandidate)
          .map(e => ({ value: e[field], cefr: e.cefrLevel }));
        if (cefrCandidates.length >= count) {
          candidates = [...candidates, ...cefrCandidates];
          if (source === 'generic') source = 'same_cefr';
        }
      }
    }

    if (candidates.length < count) {
      let typePool: DistractorEntry[] = [];
      if (contentType === 'vocabulary') {
        typePool = genericPool.filter(e => e.category === 'vocabulary');
      } else if (contentType === 'verb_conjugation') {
        typePool = [...verbInfinitives, ...genericPool.filter(e => e.category === 'verb')];
      } else if (contentType === 'grammar_rule') {
        typePool = genericPool.filter(e => e.category === 'grammar' || e.category === 'vocabulary');
      } else if (contentType === 'expressions_idioms') {
        typePool = genericPool.filter(e => e.category === 'idiom');
      } else if (contentType === 'pronunciation_rules' || contentType === 'alphabet_phonetics') {
        typePool = pronunciationEntries;
      }

      const typeCandidates = typePool
        .filter(isCandidate)
        .map(e => ({ value: e[field], cefr: e.cefrLevel }));
      candidates = [...candidates, ...typeCandidates];
      if (source === 'generic' && typeCandidates.length > 0) source = 'same_type';
    }

    if (candidates.length < count) {
      const allCandidates = genericPool
        .filter(isCandidate)
        .map(e => ({ value: e[field], cefr: e.cefrLevel }));
      candidates = [...candidates, ...allCandidates];
      if (source === 'generic') source = 'generic';
    }

    const uniqueMap = new Map<string, { value: string; cefr?: string }>();
    for (const c of candidates) {
      const key = c.value.toLowerCase().trim();
      if (!uniqueMap.has(key) && !normalizedAvoid.has(key)) {
        uniqueMap.set(key, c);
      }
    }

    const uniqueCandidates = Array.from(uniqueMap.values());

    const scored = uniqueCandidates.map(c => ({
      ...c,
      score: computePlausibilityScore(c.value, correctAnswer, c.cefr, cefrLevel),
    }));
    scored.sort((a, b) => b.score - a.score);

    const result = scored.slice(0, count).map(s => s.value);

    if (result.length < count) {
      const fallbacks = getHardcodedFallback(answerLanguage, count - result.length, [
        ...Array.from(normalizedAvoid),
        ...result.map(r => r.toLowerCase().trim()),
      ]);
      result.push(...fallbacks);
    }

    console.log(
      `${TAG} Selected ${result.length} distractors from [${source}] for correct answer: "${correctAnswer.substring(0, 30)}"`
    );

    return result.slice(0, count);
  } catch (e) {
    console.error(`${TAG} Error in getSmartDistractors:`, e);
    return getHardcodedFallback(
      params.answerLanguage,
      params.count,
      [...(params.avoidList || []), params.correctAnswer].map(s => s.toLowerCase().trim()),
    );
  }
}

function getHardcodedFallback(
  language: 'french' | 'english',
  count: number,
  avoid: string[],
): string[] {
  const avoidSet = new Set(avoid.map(a => a.toLowerCase().trim()));
  const pool = HARDCODED_FRENCH_ENGLISH
    .map(e => language === 'french' ? e.french : e.english)
    .filter(v => !avoidSet.has(v.toLowerCase().trim()));

  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export function getVerbConjugationDistractors(
  correctForm: string,
  tense: string,
  person: string,
  count: number,
  avoidList: string[] = [],
): string[] {
  try {
    initializeBank();

    const normalizedAvoid = new Set(
      [...avoidList, correctForm].map(s => s.toLowerCase().trim())
    );

    const tenseEntries = conjugationsByTense.get(tense) || [];
    const sameTensePerson = tenseEntries.filter(
      e => e.person === person && !normalizedAvoid.has(e.form.toLowerCase().trim())
    );

    const unique = new Map<string, string>();
    for (const e of sameTensePerson) {
      const key = e.form.toLowerCase().trim();
      if (!unique.has(key)) unique.set(key, e.form);
    }

    const result = Array.from(unique.values()).slice(0, count);

    if (result.length < count) {
      const sameTense = tenseEntries.filter(
        e => !normalizedAvoid.has(e.form.toLowerCase().trim()) &&
          !result.some(r => r.toLowerCase().trim() === e.form.toLowerCase().trim())
      );
      for (const e of sameTense) {
        if (result.length >= count) break;
        result.push(e.form);
      }
    }

    if (result.length < count) {
      const extras = getSmartDistractors({
        correctAnswer: correctForm,
        answerLanguage: 'french',
        count: count - result.length,
        contentType: 'verb_conjugation',
        avoidList: [...avoidList, correctForm, ...result],
      });
      result.push(...extras);
    }

    return result.slice(0, count);
  } catch (e) {
    console.error(`${TAG} Error in getVerbConjugationDistractors:`, e);
    return getHardcodedFallback('french', count, [...avoidList, correctForm]);
  }
}

export function getIdiomDistractors(
  correctMeaning: string,
  idiomCategory: string | undefined,
  count: number,
  avoidList: string[] = [],
): string[] {
  try {
    initializeBank();

    const normalizedAvoid = new Set(
      [...avoidList, correctMeaning].map(s => s.toLowerCase().trim())
    );

    let candidates: string[] = [];

    if (idiomCategory) {
      candidates = idiomEntries
        .filter(e => e.category === idiomCategory && !normalizedAvoid.has(e.meaning.toLowerCase().trim()))
        .map(e => e.meaning);
    }

    if (candidates.length < count) {
      const allMeanings = idiomEntries
        .filter(e => !normalizedAvoid.has(e.meaning.toLowerCase().trim()) &&
          !candidates.some(c => c.toLowerCase().trim() === e.meaning.toLowerCase().trim()))
        .map(e => e.meaning);
      candidates = [...candidates, ...allMeanings];
    }

    const unique = [...new Set(candidates.map(c => c.toLowerCase().trim()))]
      .map(key => candidates.find(c => c.toLowerCase().trim() === key)!)
      .filter(Boolean);

    return unique.slice(0, count);
  } catch (e) {
    console.error(`${TAG} Error in getIdiomDistractors:`, e);
    return [];
  }
}

export function getPoolStats(): Record<string, number> {
  initializeBank();
  let conjugationCount = 0;
  for (const [, entries] of conjugationsByTense) {
    conjugationCount += entries.length;
  }
  return {
    vocabularyThemes: vocabularyByTheme.size,
    vocabularyByCefr: vocabularyByCefr.size,
    verbInfinitives: verbInfinitives.length,
    conjugations: conjugationCount,
    grammarTerms: grammarTerms.length,
    idioms: idiomEntries.length,
    pronunciation: pronunciationEntries.length,
    genericTotal: genericPool.length,
  };
}
