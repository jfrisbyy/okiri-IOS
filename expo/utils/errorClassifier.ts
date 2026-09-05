import type { ErrorType } from './errorHistoryStore';

const FRENCH_ARTICLES = ['le', 'la', 'les', 'l\'', 'un', 'une', 'des', 'du', 'de', 'au', 'aux'];
const FRENCH_PREPOSITIONS = ['à', 'de', 'en', 'dans', 'sur', 'sous', 'avec', 'pour', 'par', 'chez', 'entre', 'vers', 'sans'];
const _FRENCH_AUXILIARIES = ['ai', 'as', 'a', 'avons', 'avez', 'ont', 'suis', 'es', 'est', 'sommes', 'êtes', 'sont'];
const _ACCENT_CHARS = 'àâäéèêëïîôùûüÿçœæ';
const UNACCENTED_MAP: Record<string, string> = {
  'à': 'a', 'â': 'a', 'ä': 'a',
  'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e',
  'ï': 'i', 'î': 'i',
  'ô': 'o',
  'ù': 'u', 'û': 'u', 'ü': 'u',
  'ÿ': 'y', 'ç': 'c',
};

const FALSE_COGNATES: string[] = [
  'actuellement', 'assister', 'attendre', 'blesser', 'bras',
  'caméra', 'chair', 'coin', 'conductor', 'entrée',
  'figure', 'formidable', 'journée', 'librairie', 'location',
  'monnaie', 'phrase', 'prune', 'raisin', 'regarder',
  'résumer', 'roman', 'sympathique', 'travail',
];

const VERB_ENDINGS = [
  'er', 'ir', 'oir', 're',
  'e', 'es', 'ons', 'ez', 'ent',
  'ais', 'ait', 'ions', 'iez', 'aient',
  'ai', 'as', 'a', 'âmes', 'âtes', 'èrent',
  'erai', 'eras', 'era', 'erons', 'erez', 'eront',
  'isse', 'isses', 'ît', 'issions', 'issiez', 'issent',
];

function normalize(text: string): string {
  return text.toLowerCase().trim().replace(/[.,!?;:'"«»\u2018\u2019\u201C\u201D\-()]/g, '').replace(/\s+/g, ' ');
}

function removeAccents(text: string): string {
  let result = '';
  for (const ch of text) {
    result += UNACCENTED_MAP[ch] || ch;
  }
  return result;
}

function getWords(text: string): string[] {
  return normalize(text).split(' ').filter(w => w.length > 0);
}

function hasAccentDifference(wrong: string, correct: string): boolean {
  const w = normalize(wrong);
  const c = normalize(correct);
  if (removeAccents(w) === removeAccents(c) && w !== c) return true;

  const wWords = getWords(wrong);
  const cWords = getWords(correct);
  if (wWords.length !== cWords.length) return false;
  for (let i = 0; i < wWords.length; i++) {
    if (removeAccents(wWords[i]) === removeAccents(cWords[i]) && wWords[i] !== cWords[i]) {
      return true;
    }
  }
  return false;
}

function detectArticleError(wrongWords: string[], correctWords: string[]): boolean {
  const wrongArticles = wrongWords.filter(w => FRENCH_ARTICLES.includes(w));
  const correctArticles = correctWords.filter(w => FRENCH_ARTICLES.includes(w));

  if (wrongArticles.length !== correctArticles.length) return true;

  for (let i = 0; i < Math.min(wrongWords.length, correctWords.length); i++) {
    if (FRENCH_ARTICLES.includes(correctWords[i]) || FRENCH_ARTICLES.includes(wrongWords[i])) {
      if (wrongWords[i] !== correctWords[i]) return true;
    }
  }
  return false;
}

function detectPrepositionError(wrongWords: string[], correctWords: string[]): boolean {
  for (let i = 0; i < Math.min(wrongWords.length, correctWords.length); i++) {
    const wIsPrep = FRENCH_PREPOSITIONS.includes(wrongWords[i]);
    const cIsPrep = FRENCH_PREPOSITIONS.includes(correctWords[i]);
    if ((wIsPrep || cIsPrep) && wrongWords[i] !== correctWords[i]) return true;
  }
  return false;
}

function detectGenderAgreement(wrongWords: string[], correctWords: string[]): boolean {
  for (let i = 0; i < Math.min(wrongWords.length, correctWords.length); i++) {
    const w = wrongWords[i];
    const c = correctWords[i];
    if (w === c) continue;

    if (
      (w.endsWith('e') && c === w.slice(0, -1)) ||
      (c.endsWith('e') && w === c.slice(0, -1))
    ) return true;

    if (
      (w.endsWith('le') && c.endsWith('la')) ||
      (w.endsWith('la') && c.endsWith('le'))
    ) return true;

    const genderPairs = [
      ['il', 'elle'], ['ils', 'elles'],
      ['un', 'une'], ['le', 'la'],
      ['mon', 'ma'], ['ton', 'ta'], ['son', 'sa'],
      ['ce', 'cette'], ['ces', 'ces'],
      ['beau', 'belle'], ['nouveau', 'nouvelle'], ['vieux', 'vieille'],
    ];
    for (const [a, b] of genderPairs) {
      if ((w === a && c === b) || (w === b && c === a)) return true;
    }
  }
  return false;
}

function detectAuxiliaryConfusion(wrongWords: string[], correctWords: string[]): boolean {
  const avoirForms = ['ai', 'as', 'a', 'avons', 'avez', 'ont'];
  const etreForms = ['suis', 'es', 'est', 'sommes', 'êtes', 'sont'];

  for (let i = 0; i < Math.min(wrongWords.length, correctWords.length); i++) {
    const wIsAvoir = avoirForms.includes(wrongWords[i]);
    const wIsEtre = etreForms.includes(wrongWords[i]);
    const cIsAvoir = avoirForms.includes(correctWords[i]);
    const cIsEtre = etreForms.includes(correctWords[i]);

    if ((wIsAvoir && cIsEtre) || (wIsEtre && cIsAvoir)) return true;
  }
  return false;
}

function detectVerbConjugation(wrongWords: string[], correctWords: string[]): boolean {
  for (let i = 0; i < Math.min(wrongWords.length, correctWords.length); i++) {
    const w = wrongWords[i];
    const c = correctWords[i];
    if (w === c) continue;

    const wHasVerbEnding = VERB_ENDINGS.some(e => w.endsWith(e) && w.length > e.length + 1);
    const cHasVerbEnding = VERB_ENDINGS.some(e => c.endsWith(e) && c.length > e.length + 1);

    if (wHasVerbEnding && cHasVerbEnding) {
      const wRoot = w.slice(0, Math.max(2, w.length - 4));
      const cRoot = c.slice(0, Math.max(2, c.length - 4));
      if (wRoot === cRoot || levenshtein(wRoot, cRoot) <= 2) return true;
    }
  }
  return false;
}

function detectTenseConfusion(wrongWords: string[], correctWords: string[]): boolean {
  const presentEndings = ['e', 'es', 'ons', 'ez', 'ent'];
  const imparfaitEndings = ['ais', 'ait', 'ions', 'iez', 'aient'];
  const passeSimpleEndings = ['ai', 'as', 'a', 'âmes', 'âtes', 'èrent'];
  const futurEndings = ['erai', 'eras', 'era', 'erons', 'erez', 'eront'];

  function getTenseGroup(word: string): string | null {
    if (imparfaitEndings.some(e => word.endsWith(e))) return 'imparfait';
    if (futurEndings.some(e => word.endsWith(e))) return 'futur';
    if (passeSimpleEndings.some(e => word.endsWith(e))) return 'passe_simple';
    if (presentEndings.some(e => word.endsWith(e))) return 'present';
    return null;
  }

  for (let i = 0; i < Math.min(wrongWords.length, correctWords.length); i++) {
    const wTense = getTenseGroup(wrongWords[i]);
    const cTense = getTenseGroup(correctWords[i]);
    if (wTense && cTense && wTense !== cTense) {
      const wRoot = wrongWords[i].slice(0, Math.max(2, wrongWords[i].length - 5));
      const cRoot = correctWords[i].slice(0, Math.max(2, correctWords[i].length - 5));
      if (wRoot === cRoot || levenshtein(wRoot, cRoot) <= 2) return true;
    }
  }
  return false;
}

function detectWordOrder(wrongWords: string[], correctWords: string[]): boolean {
  if (wrongWords.length !== correctWords.length) return false;
  const sortedW = [...wrongWords].sort();
  const sortedC = [...correctWords].sort();
  if (sortedW.join(' ') === sortedC.join(' ') && wrongWords.join(' ') !== correctWords.join(' ')) {
    return true;
  }
  return false;
}

function detectFalseCognate(wrongWords: string[]): boolean {
  return wrongWords.some(w => FALSE_COGNATES.includes(w));
}

function detectSpelling(wrong: string, correct: string): boolean {
  const w = normalize(wrong);
  const c = normalize(correct);
  if (w === c) return false;
  const dist = levenshtein(w, c);
  const maxLen = Math.max(w.length, c.length);
  return dist <= Math.max(2, Math.floor(maxLen * 0.3));
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

export function classifyError(
  wrongAnswer: string,
  correctAnswer: string,
  questionType: string,
): ErrorType {
  if (!wrongAnswer || !correctAnswer) return 'unknown';

  const wrongWords = getWords(wrongAnswer);
  const correctWords = getWords(correctAnswer);

  if (hasAccentDifference(wrongAnswer, correctAnswer)) {
    console.log('[ErrorClassifier] Detected accent_missing');
    return 'accent_missing';
  }

  if (detectArticleError(wrongWords, correctWords)) {
    if (detectGenderAgreement(wrongWords, correctWords)) {
      console.log('[ErrorClassifier] Detected gender_agreement');
      return 'gender_agreement';
    }
    console.log('[ErrorClassifier] Detected article_error');
    return 'article_error';
  }

  if (detectGenderAgreement(wrongWords, correctWords)) {
    console.log('[ErrorClassifier] Detected gender_agreement');
    return 'gender_agreement';
  }

  if (detectAuxiliaryConfusion(wrongWords, correctWords)) {
    console.log('[ErrorClassifier] Detected auxiliary_confusion');
    return 'auxiliary_confusion';
  }

  if (detectPrepositionError(wrongWords, correctWords)) {
    console.log('[ErrorClassifier] Detected preposition_error');
    return 'preposition_error';
  }

  if (detectWordOrder(wrongWords, correctWords)) {
    console.log('[ErrorClassifier] Detected word_order');
    return 'word_order';
  }

  if (detectTenseConfusion(wrongWords, correctWords)) {
    console.log('[ErrorClassifier] Detected tense_confusion');
    return 'tense_confusion';
  }

  if (detectVerbConjugation(wrongWords, correctWords)) {
    console.log('[ErrorClassifier] Detected verb_conjugation');
    return 'verb_conjugation';
  }

  if (detectFalseCognate(wrongWords)) {
    console.log('[ErrorClassifier] Detected false_cognate');
    return 'false_cognate';
  }

  if (questionType === 'multiple_choice' || questionType === 'true_false') {
    console.log('[ErrorClassifier] Detected vocabulary_confusion (from MC/TF)');
    return 'vocabulary_confusion';
  }

  if (detectSpelling(wrongAnswer, correctAnswer)) {
    console.log('[ErrorClassifier] Detected spelling');
    return 'spelling';
  }

  console.log('[ErrorClassifier] Could not classify, returning unknown');
  return 'unknown';
}
