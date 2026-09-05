export type FrenchRegionId = 'fr-FR' | 'fr-CA' | 'fr-BE' | 'fr-CH';

export interface RegionalVoice {
  name: string;
  gender: 'female' | 'male';
  azureVoiceId: string;
}

export interface RegionalPhrase {
  id: string;
  standard: string;
  regional: string;
  english: string;
  note: string;
}

export interface RegionalSound {
  id: string;
  sound: string;
  ipa: string;
  standardIpa: string;
  description: string;
  examples: { word: string; standardPronunciation: string; regionalPronunciation: string }[];
}

export interface ComparisonPhrase {
  id: string;
  french: string;
  english: string;
  ipa: Record<string, string>;
}

export interface FrenchRegion {
  id: FrenchRegionId;
  name: string;
  shortName: string;
  flag: string;
  azureLocale: string;
  color: string;
  description: string;
  accentIdentity: string;
  spokenIn: string[];
  speakerCount: string;
  voices: RegionalVoice[];
  characteristicSounds: RegionalSound[];
  uniqueVocabulary: RegionalPhrase[];
  culturalNotes: string[];
  practiceWords: { word: string; ipa: string; translation: string; audioHint: string }[];
}

export const comparisonPhrases: ComparisonPhrase[] = [
  {
    id: 'cp-1',
    french: "Je ne sais pas pourquoi il a décidé de partir si tôt ce matin sans rien dire à personne.",
    english: "I don't know why he decided to leave so early this morning without saying anything to anyone.",
    ipa: {
      'fr-FR': '/ʒə nə sɛ pa puʁ.kwa il a de.si.de də paʁ.tiʁ si to sə ma.tɛ̃ sɑ̃ ʁjɛ̃ diʁ a pɛʁ.sɔn/',
      'fr-CA': '/ʃə nə sɛ pa puʁ.kwa il a de.tsi.de də paʁ.tsiʁ si to sə ma.tsɛ̃ sɑ̃ ʁjɛ̃ dziʁ a pɛʁ.sɔn/',
      'fr-BE': '/ʒə nə sɛ pa puʁ.kwa il a de.si.de də paʁ.tiːʁ si toː sə ma.tɛ̃ sɑ̃ ʁjɛ̃ diʁ a pɛʁ.sɔn/',
      'fr-CH': '/ʒə nə sɛ pa puːʁ.kwa il a de.si.de də paːʁ.tiːʁ si toː sə ma.tɛ̃ sɑ̃ ʁjɛ̃ diːʁ a pɛːʁ.sɔn/',
    },
  },
  {
    id: 'cp-2',
    french: "Est-ce que tu pourrais me passer le petit sac qui se trouve sur la table de la cuisine, s'il te plaît?",
    english: "Could you pass me the small bag that's on the kitchen table, please?",
    ipa: {
      'fr-FR': '/ɛs kə ty pu.ʁɛ mə pa.se lə pə.ti sak ki sə tʁuv syʁ la tabl də la kɥi.zin sil tə plɛ/',
      'fr-CA': '/ɛs kə tsy pu.ʁɛ mə pa.se lə pə.tsi sak ki sə tʁuv syʁ la tabl də la kɥi.zɪn sɪl tə plɛ/',
      'fr-BE': '/ɛs kə ty pu.ʁɛː mə pa.se lə pə.ti sak ki sə tʁuːv syːʁ la taːbl də la kɥi.zin sil tə plɛː/',
      'fr-CH': '/ɛs kə ty pu.ʁɛː mə pa.se lə pə.ti sak ki sə tʁuːv syːʁ la taːblə də la kɥi.zinə sil tə plɛː/',
    },
  },
  {
    id: 'cp-3',
    french: "Il fait vraiment très froid dehors aujourd'hui, je crois qu'on devrait rester à la maison ce soir.",
    english: "It's really very cold outside today, I think we should stay home tonight.",
    ipa: {
      'fr-FR': '/il fɛ vʁɛ.mɑ̃ tʁɛ fʁwa dəɔʁ o.ʒuʁ.dɥi ʒə kʁwa kɔ̃ də.vʁɛ ʁɛs.te a la mɛ.zɔ̃ sə swaʁ/',
      'fr-CA': '/i fɛ vʁɛ.mɑ̃ tʁɛ fʁɛt dəɔːʁ o.ʒuʁ.dɥi ʒə kʁwa kɔ̃ də.vʁaɪ ʁɛs.te a la mɛ.zɔ̃ sə swaːʁ/',
      'fr-BE': '/il fɛ vʁɛː.mɑ̃ tʁɛː fʁwa dəɔːʁ o.ʒuʁ.dɥi ʒə kʁwaː kɔ̃ də.vʁɛː ʁɛs.te a la mɛ.zɔ̃ sə swaːʁ/',
      'fr-CH': '/il fɛ vʁɛː.mɑ̃ tʁɛː fʁwa dəɔːʁ o.ʒuːʁ.dɥi ʒə kʁwaː kɔ̃ də.vʁɛː ʁɛs.te a la mɛ.zɔ̃ sə swaːʁ/',
    },
  },
  {
    id: 'cp-4',
    french: "Ma grand-mère prépare toujours un excellent repas le dimanche, surtout quand toute la famille est réunie.",
    english: "My grandmother always prepares an excellent meal on Sundays, especially when the whole family is together.",
    ipa: {
      'fr-FR': '/ma ɡʁɑ̃.mɛʁ pʁe.paʁ tu.ʒuʁ ɛ̃.n‿ɛk.se.lɑ̃ ʁə.pa lə di.mɑ̃ʃ syʁ.tu kɑ̃ tut la fa.mij ɛ ʁe.y.ni/',
      'fr-CA': '/ma ɡʁɑ̃.maɪʁ pʁe.paʁ tu.ʒuːʁ ɛ̃.n‿ɛk.se.lɑ̃ ʁə.pa lə dzi.mɑ̃ʃ syʁ.tʊt kɑ̃ tsʊt la fa.mij ɛ ʁe.y.ni/',
      'fr-BE': '/ma ɡʁɑ̃.mɛːʁ pʁe.paːʁ tu.ʒuːʁ ɛ̃.n‿ɛk.se.lɑ̃ ʁə.paː lə di.mɑ̃ʃ syʁ.tuː kɑ̃ tuːt la fa.miːj ɛ ʁe.y.ni/',
      'fr-CH': '/ma ɡʁɑ̃.mɛːʁ pʁe.paːʁ tu.ʒuːʁ ɛ̃.n‿ɛk.se.lɑ̃ ʁə.paː lə di.mɑ̃ʃə syːʁ.tuː kɑ̃ tuːtə la fa.miːjə ɛ ʁe.y.ni/',
    },
  },
  {
    id: 'cp-5',
    french: "Excusez-moi, est-ce que vous savez où se trouve la boulangerie la plus proche d'ici? J'aimerais acheter du pain frais.",
    english: "Excuse me, do you know where the nearest bakery is from here? I'd like to buy some fresh bread.",
    ipa: {
      'fr-FR': '/ɛk.sky.ze mwa ɛs kə vu sa.ve u sə tʁuv la bu.lɑ̃ʒ.ʁi la ply pʁɔʃ di.si ʒɛ.mə.ʁɛ aʃ.te dy pɛ̃ fʁɛ/',
      'fr-CA': '/ɛk.sky.ze mwa ɛs kə vu sa.ve u sə tʁuv la bu.lɑ̃ʒ.ʁi la plʏs pʁɔʃ dzi.si ʒɛ.mə.ʁaɪ aʃ.te dzy pɛ̃ fʁɛ/',
      'fr-BE': '/ɛk.sky.ze mwa ɛs kə vu sa.ve uː sə tʁuːv la bu.lɑ̃ʒ.ʁi la plyːs pʁɔʃ di.si ʒɛː.mə.ʁɛː aʃ.te dy pɛ̃ fʁɛː/',
      'fr-CH': '/ɛk.sky.ze mwa ɛs kə vu sa.ve uː sə tʁuːvə la bu.lɑ̃ʒ.ʁi la plyːs pʁɔʃ di.si ʒɛː.mə.ʁɛː aʃ.te dy pɛ̃ fʁɛː/',
    },
  },
  {
    id: 'cp-6',
    french: "Quatre-vingt-dix personnes sont venues à la fête hier soir, c'était vraiment une belle soirée avec de la bonne musique.",
    english: "Ninety people came to the party last night, it was really a lovely evening with good music.",
    ipa: {
      'fr-FR': '/katʁ.vɛ̃.dis pɛʁ.sɔn sɔ̃ və.ny a la fɛt jɛʁ swaʁ se.tɛ vʁɛ.mɑ̃ yn bɛl swa.ʁe a.vɛk də la bɔn my.zik/',
      'fr-CA': '/katʁ.vɛ̃.dɪs pɛʁ.sɔn sɔ̃ və.ny a la faɪt jɛʁ swaːʁ se.taɪ vʁɛ.mɑ̃ yn bɛl swa.ʁe a.vɛk də la bɔn my.zɪk/',
      'fr-BE': '/nɔ.nɑ̃t pɛʁ.sɔn sɔ̃ və.nyː a la fɛːt jɛːʁ swaːʁ se.tɛː vʁɛː.mɑ̃ yn bɛːl swa.ʁeː a.vɛk də la bɔn my.zik/',
      'fr-CH': '/nɔ.nɑ̃t pɛːʁ.sɔn sɔ̃ və.nyː a la fɛːt jɛːʁ swaːʁ se.tɛː vʁɛː.mɑ̃ yn bɛːlə swa.ʁeː a.vɛk də la bɔnə my.zikə/',
    },
  },
];

export const frenchRegions: FrenchRegion[] = [
  {
    id: 'fr-FR',
    name: 'Metropolitan French',
    shortName: 'France',
    flag: '\u{1F1EB}\u{1F1F7}',
    azureLocale: 'fr-FR',
    color: '#2563EB',
    description: 'The prestige standard accent originating from the Ile-de-France region around Paris. This is the accent you hear in French news broadcasts, formal speeches, and most textbooks worldwide. It sets the baseline against which all other French accents are measured.',
    accentIdentity: 'What makes Metropolitan French instantly recognizable is its smooth, connected flow with the signature uvular R (the throaty "gh" sound), crisp nasal vowels that stay clearly distinct from each other, and a rapid cadence where syllables glide together through liaison. Parisian speakers tend to drop the "schwa" (the unstable /\u0259/) aggressively, compressing words like "je ne sais pas" into "chais pas" in casual speech. The intonation rises gently at the end of phrases, giving it that characteristic elegant lilt. Compared to other varieties, Metropolitan French sounds fast, fluid, and slightly clipped.',
    spokenIn: ['France', 'Monaco'],
    speakerCount: '~67 million',
    voices: [
      { name: 'Denise', gender: 'female', azureVoiceId: 'fr-FR-DeniseNeural' },
      { name: 'Henri', gender: 'male', azureVoiceId: 'fr-FR-HenriNeural' },
    ],
    characteristicSounds: [
      {
        id: 'fr-r',
        sound: 'Uvular R',
        ipa: '/\u0281/',
        standardIpa: '/\u0281/',
        description: 'The hallmark French R, produced by vibrating the uvula at the back of the throat. It sounds like a soft gargle or a gentle "gh". This is the sound that makes French sound "French" to most foreigners, and it is the reference R for all other varieties.',
        examples: [
          { word: 'rouge', standardPronunciation: '/\u0281u\u0292/', regionalPronunciation: '/\u0281u\u0292/' },
          { word: 'Paris', standardPronunciation: '/pa.\u0281i/', regionalPronunciation: '/pa.\u0281i/' },
          { word: 'regarder', standardPronunciation: '/\u0281\u0259.\u0261a\u0281.de/', regionalPronunciation: '/\u0281\u0259.\u0261a\u0281.de/' },
        ],
      },
      {
        id: 'fr-nasal',
        sound: 'Crisp Nasal Vowels',
        ipa: '/\u0251\u0303, \u025B\u0303, \u0254\u0303/',
        standardIpa: '/\u0251\u0303, \u025B\u0303, \u0254\u0303/',
        description: 'Metropolitan French maintains three distinct nasal vowels that are purely nasal \u2014 the air flows only through the nose, with no "n" or "m" consonant heard after them. Modern Parisian French has merged /\u025B\u0303/ and /\u0153\u0303/ (so "brin" and "brun" sound the same), but the other nasals stay distinct.',
        examples: [
          { word: 'bon', standardPronunciation: '/b\u0254\u0303/', regionalPronunciation: '/b\u0254\u0303/' },
          { word: 'vin', standardPronunciation: '/v\u025B\u0303/', regionalPronunciation: '/v\u025B\u0303/' },
          { word: 'enfant', standardPronunciation: '/\u0251\u0303.f\u0251\u0303/', regionalPronunciation: '/\u0251\u0303.f\u0251\u0303/' },
        ],
      },
      {
        id: 'fr-liaison',
        sound: 'Frequent Liaison & Enchaînement',
        ipa: '/z/, /t/, /n/',
        standardIpa: '\u2014',
        description: 'Metropolitan French links words together aggressively. A normally silent final consonant is pronounced when the next word starts with a vowel: "les enfants" becomes /le.z\u0251\u0303.f\u0251\u0303/. This creates the characteristic fluid, almost breathless flow of Parisian speech.',
        examples: [
          { word: 'les enfants', standardPronunciation: '/le \u0251\u0303.f\u0251\u0303/', regionalPronunciation: '/le.z\u0251\u0303.f\u0251\u0303/' },
          { word: 'petit ami', standardPronunciation: '/p\u0259.ti a.mi/', regionalPronunciation: '/p\u0259.ti.t\u200Ba.mi/' },
        ],
      },
      {
        id: 'fr-schwa',
        sound: 'Schwa Dropping',
        ipa: '/\u0259/ \u2192 \u2205',
        standardIpa: '/\u0259/',
        description: 'In casual Parisian speech, the unstable "e" (/\u0259/) is routinely dropped. "Je ne sais pas" becomes "j\'sais pas" or even "ch\'ais pas". "Samedi" becomes "sam\'di". This compression makes Parisian French sound rapid and clipped to non-native ears.',
        examples: [
          { word: 'je ne sais pas', standardPronunciation: '/\u0292\u0259 n\u0259 s\u025B pa/', regionalPronunciation: '/\u0283\u025B pa/' },
          { word: 'samedi', standardPronunciation: '/sam.di/', regionalPronunciation: '/sam.di/' },
        ],
      },
    ],
    uniqueVocabulary: [
      { id: 'fr-v1', standard: 'petit d\u00E9jeuner', regional: 'petit d\u00E9jeuner', english: 'breakfast', note: 'Standard term used throughout France' },
      { id: 'fr-v2', standard: 'soixante-dix', regional: 'soixante-dix', english: 'seventy', note: 'Base-20 counting: literally "sixty-ten"' },
      { id: 'fr-v3', standard: 'quatre-vingts', regional: 'quatre-vingts', english: 'eighty', note: 'Literally "four twenties" \u2014 the famously complex French number system' },
      { id: 'fr-v4', standard: 'quatre-vingt-dix', regional: 'quatre-vingt-dix', english: 'ninety', note: '"Four-twenty-ten" \u2014 Belgium and Switzerland simplified this' },
      { id: 'fr-v5', standard: 'chocolatine', regional: 'pain au chocolat', english: 'chocolate pastry', note: 'The great French debate! Paris says "pain au chocolat"' },
    ],
    culturalNotes: [
      'Parisian French is considered the "neutral" accent for media, education, and international diplomacy.',
      'Regional accents within France (Marseillais, Alsatian, Ch\'ti) still exist but are fading in younger generations.',
      'The Acad\u00E9mie fran\u00E7aise, based in Paris, has regulated the French language since 1635.',
      'Casual Parisian speech (le fran\u00E7ais familier) sounds very different from formal French \u2014 heavy contraction, slang (verlan), and speed.',
    ],
    practiceWords: [
      { word: "Je voudrais un croissant et un caf\u00E9 au lait, s'il vous pla\u00EEt.", ipa: '/\u0292\u0259 vu.d\u0281\u025B \u025B\u0303 k\u0281wa.s\u0251\u0303 e \u025B\u0303 ka.fe o l\u025B sil vu pl\u025B/', translation: "I'd like a croissant and a caf\u00E9 au lait, please.", audioHint: 'Smooth liaison, throat R, nasal vowels' },
      { word: "Regardez comme c'est beau, les lumi\u00E8res de la Tour Eiffel ce soir!", ipa: '/\u0281\u0259.\u0261a\u0281.de k\u0254m s\u025B bo le ly.mj\u025B\u0281 d\u0259 la tu\u0281 \u025B.f\u025Bl s\u0259 swa\u0281/', translation: 'Look how beautiful the Eiffel Tower lights are tonight!', audioHint: 'Multiple uvular Rs, flowing liaison' },
      { word: "On ne peut pas toujours faire ce qu'on veut dans la vie, malheureusement.", ipa: '/\u0254\u0303 n\u0259 p\u00F8 pa tu.\u0292u\u0281 f\u025B\u0281 s\u0259 k\u0254\u0303 v\u00F8 d\u0251\u0303 la vi ma.l\u00F8.\u0281\u00F8z.m\u0251\u0303/', translation: "You can't always do what you want in life, unfortunately.", audioHint: 'Schwa dropping in casual delivery, nasal contrasts' },
      { word: "La boulangerie au coin de la rue fait les meilleurs pains au chocolat du quartier.", ipa: '/la bu.l\u0251\u0303\u0292.\u0281i o kw\u025B\u0303 d\u0259 la \u0281y f\u025B le m\u025B.j\u00F8\u0281 p\u025B\u0303 o \u0283\u0254.k\u0254.la dy ka\u0281.tje/', translation: 'The bakery on the corner of the street makes the best pain au chocolat in the neighborhood.', audioHint: 'Nasal "an" in boulangerie, throat R throughout' },
      { word: "Franchement, je trouve que la nouvelle collection d'automne est magnifique cette ann\u00E9e.", ipa: '/f\u0281\u0251\u0303\u0283.m\u0251\u0303 \u0292\u0259 t\u0281uv k\u0259 la nu.v\u025Bl k\u0254.l\u025Bk.sj\u0254\u0303 do.t\u0254n \u025B ma.\u0272i.fik s\u025Bt a.ne/', translation: 'Honestly, I think the new fall collection is magnificent this year.', audioHint: 'Fast connected speech, multiple nasals and Rs' },
    ],
  },
  {
    id: 'fr-CA',
    name: 'Qu\u00E9b\u00E9cois French',
    shortName: 'Qu\u00E9bec',
    flag: '\u{1F1E8}\u{1F1E6}',
    azureLocale: 'fr-CA',
    color: '#DC2626',
    description: 'The most distinctively different variety of French in the world. Qu\u00E9b\u00E9cois preserves features of 17th-century Norman and Poitevin French brought by the original colonists, mixed with centuries of independent evolution in North America. Even native French speakers from Paris can struggle to understand rapid Qu\u00E9b\u00E9cois.',
    accentIdentity: 'The dead giveaway of Qu\u00E9b\u00E9cois is affrication: T and D before "i" and "u" become "ts" and "dz", so "tu" sounds like "tsu" and "dire" like "dzire". This alone makes it immediately identifiable. On top of that, long vowels get diphthongized \u2014 "f\u00EAte" sounds like "faite", "p\u00E8re" like "paire". Short high vowels (/i/, /u/, /y/) are relaxed in closed syllables, so "vite" sounds closer to English "vit". The overall effect is a warmer, more muscular sound compared to the sleek Parisian delivery. Qu\u00E9b\u00E9cois also has a distinctive intonation pattern with rising-falling contours that give it an animated, expressive quality. And they use unique sacres (swear words from church terms) as intensifiers.',
    spokenIn: ['Quebec', 'Ontario', 'New Brunswick', 'Manitoba'],
    speakerCount: '~7.3 million',
    voices: [
      { name: 'Sylvie', gender: 'female', azureVoiceId: 'fr-CA-SylvieNeural' },
      { name: 'Antoine', gender: 'male', azureVoiceId: 'fr-CA-AntoineNeural' },
    ],
    characteristicSounds: [
      {
        id: 'ca-affric',
        sound: 'Affrication of T/D',
        ipa: '/ts/, /dz/',
        standardIpa: '/t/, /d/',
        description: 'The single most distinctive feature of Qu\u00E9b\u00E9cois. Before high front vowels "i" and "u", T becomes "ts" and D becomes "dz". This is completely automatic and unconscious for Qu\u00E9b\u00E9cois speakers. "Tu dis" sounds like "tsu dzis". It happens in every word, every time \u2014 it\'s the quickest way to identify a Qu\u00E9b\u00E9cois speaker.',
        examples: [
          { word: 'tu', standardPronunciation: '/ty/', regionalPronunciation: '/tsy/' },
          { word: 'petit', standardPronunciation: '/p\u0259.ti/', regionalPronunciation: '/p\u0259.tsi/' },
          { word: 'dire', standardPronunciation: '/di\u0281/', regionalPronunciation: '/dzi\u0281/' },
          { word: 'difficile', standardPronunciation: '/di.fi.sil/', regionalPronunciation: '/dzi.fi.sil/' },
        ],
      },
      {
        id: 'ca-dipth',
        sound: 'Diphthongized Long Vowels',
        ipa: '/a\u026A/, /a\u028A/, /\u0254\u028A/',
        standardIpa: '/\u025B/, /o/, /\u0254/',
        description: 'Long vowels split into two sounds (diphthongs), giving Qu\u00E9b\u00E9cois its characteristic melodic, almost musical quality. "F\u00EAte" (party) sounds like "faite", "p\u00E8re" (father) like "paire". This feature came from 17th-century Norman French and has been preserved while Metropolitan French simplified these vowels.',
        examples: [
          { word: 'f\u00EAte', standardPronunciation: '/f\u025Bt/', regionalPronunciation: '/fa\u026At/' },
          { word: 'p\u00E8re', standardPronunciation: '/p\u025B\u0281/', regionalPronunciation: '/pa\u026A\u0281/' },
          { word: 'c\u00F4te', standardPronunciation: '/kot/', regionalPronunciation: '/k\u0254\u028At/' },
          { word: 'encore', standardPronunciation: '/\u0251\u0303.k\u0254\u0281/', regionalPronunciation: '/\u0251\u0303.k\u0254\u028A\u0281/' },
        ],
      },
      {
        id: 'ca-lax',
        sound: 'Lax (Relaxed) High Vowels',
        ipa: '/\u026A/, /\u028A/, /\u028F/',
        standardIpa: '/i/, /u/, /y/',
        description: 'In closed syllables (ending in a consonant), Qu\u00E9b\u00E9cois relaxes the high vowels. /i/ becomes /\u026A/ (like English "bit"), /u/ becomes /\u028A/ (like English "book"), /y/ becomes /\u028F/. "Vite" sounds like English "vit", "toute" sounds closer to "tout" with a short vowel. This gives Qu\u00E9b\u00E9cois a noticeably different vowel color.',
        examples: [
          { word: 'vite', standardPronunciation: '/vit/', regionalPronunciation: '/v\u026At/' },
          { word: 'toute', standardPronunciation: '/tut/', regionalPronunciation: '/t\u028At/' },
          { word: 'minute', standardPronunciation: '/mi.nyt/', regionalPronunciation: '/m\u026A.n\u028Ft/' },
          { word: 'ridicule', standardPronunciation: '/\u0281i.di.kyl/', regionalPronunciation: '/\u0281\u026A.dz\u026A.k\u028Fl/' },
        ],
      },
      {
        id: 'ca-ouvert',
        sound: 'Open "a" Retained',
        ipa: '/\u0251/',
        standardIpa: '/a/',
        description: 'Qu\u00E9b\u00E9cois preserves the back "a" (/\u0251/) in words where Metropolitan French has shifted to front "a" (/a/). "P\u00E2te" and "patte" are clearly distinct in Qu\u00E9bec but identical in modern Paris. This is a 17th-century feature that Metropolitan French abandoned.',
        examples: [
          { word: 'p\u00E2te', standardPronunciation: '/pat/', regionalPronunciation: '/p\u0251\u02D0t/' },
          { word: 'l\u00E0-bas', standardPronunciation: '/la.ba/', regionalPronunciation: '/l\u0251.b\u0251/' },
        ],
      },
    ],
    uniqueVocabulary: [
      { id: 'ca-v1', standard: 'voiture', regional: 'char', english: 'car', note: 'From old French "char" (chariot), not English' },
      { id: 'ca-v2', standard: 'petit ami/copain', regional: 'chum', english: 'boyfriend', note: 'Borrowed from English, universally used' },
      { id: 'ca-v3', standard: 'petit d\u00E9jeuner', regional: 'd\u00E9jeuner', english: 'breakfast', note: 'Meals are shifted: d\u00E9jeuner/d\u00EEner/souper instead of petit d\u00E9j/d\u00E9jeuner/d\u00EEner' },
      { id: 'ca-v4', standard: 'faire du shopping', regional: 'magasiner', english: 'to go shopping', note: 'Qu\u00E9bec actively creates French words instead of borrowing English' },
      { id: 'ca-v5', standard: "c'est amusant", regional: "c'est le fun", english: "it's fun", note: 'Ironic exception: this English word is everywhere in Qu\u00E9b\u00E9cois' },
      { id: 'ca-v6', standard: 'au revoir', regional: 'bonjour / bye', english: 'goodbye', note: '"Bonjour" is used for both hello AND goodbye in Qu\u00E9bec' },
    ],
    culturalNotes: [
      'Qu\u00E9b\u00E9cois has unique sacres (swear words) derived from Catholic church terminology: "tabarnac", "c\u00E2lice", "ostie" are the big three.',
      'The Office qu\u00E9b\u00E9cois de la langue fran\u00E7aise actively promotes French alternatives to English words \u2014 Qu\u00E9bec French often has LESS English than France French.',
      'Joual is the working-class dialect of Montreal, with even more extreme affrication and vowel shifts.',
      'Qu\u00E9b\u00E9cois preserves many pronunciation features from 17th-century Norman French that Metropolitan French has since lost.',
      '"T\'sais" (contraction of "tu sais") is the universal filler word, like English "you know".',
    ],
    practiceWords: [
      { word: "Tu sais, j'ai d\u00E9cid\u00E9 de prendre le char pour aller magasiner au centre-ville.", ipa: '/tsy s\u025B \u0292\u025B de.tsi.de d\u0259 p\u0281\u0251\u0303d\u0281 l\u0259 \u0283a\u0281 pu\u0281 a.le ma.\u0261a.zi.ne o s\u0251\u0303t\u0281.vɪl/', translation: "You know, I decided to take the car to go shopping downtown.", audioHint: 'Listen for "tsu" affrication and the Qu\u00E9b\u00E9cois vocab' },
      { word: "Il fait vraiment fr\u00E8te dehors, on devrait rester icitte \u00E0 soir.", ipa: '/\u026Al f\u025B v\u0281\u025B.m\u0251\u0303 f\u0281\u025Bt d\u0259\u0254\u0281 \u0254\u0303 d\u0259.v\u0281a\u026A \u0281\u025Bs.te \u026A.s\u026At a swa\u0281/', translation: "It's really cold outside, we should stay here tonight.", audioHint: '"Fr\u00E8te" not "froid", "icitte" not "ici", "a soir" not "ce soir"' },
      { word: "Ma blonde pis moi on va au d\u00E9panneur chercher de la bi\u00E8re pour la soir\u00E9e.", ipa: '/ma bl\u0254\u0303d pi mwa \u0254\u0303 va o de.pa.n\u0153\u0281 \u0283\u025B\u0281.\u0283e d\u0259 la bj\u025B\u0281 pu\u0281 la swa.\u0281e/', translation: 'My girlfriend and I are going to the corner store to get beer for the evening.', audioHint: '"Blonde" = girlfriend, "d\u00E9panneur" = corner store, "pis" = et' },
      { word: "Pantoute! C'est pas correct de dire \u00E7a, tu devrais t'excuser au plus sacrant.", ipa: '/p\u0251\u0303.t\u028At s\u025B pa k\u0254.\u0281\u025Bkt d\u0259 dzi\u0281 sa tsy d\u0259.v\u0281a\u026A t\u025Bk.sky.ze o ply sa.k\u0281\u0251\u0303/', translation: "Not at all! It's not okay to say that, you should apologize right away.", audioHint: '"Pantoute" = pas du tout, multiple affricated T/D sounds' },
      { word: "L\u00E2che pas la patate! On est capables de finir le projet \u00E0 temps, c'est s\u00FBr.", ipa: '/l\u0251\u02D0\u0283 pa la pa.t\u0251t \u0254\u0303.n\u025B ka.p\u0251bl d\u0259 fi.ni\u0281 l\u0259 p\u0281\u0254.\u0292\u025B a t\u0251\u0303 s\u025B sy\u0281/', translation: "Don't give up! We can finish the project on time, for sure.", audioHint: 'Classic Qu\u00E9b\u00E9cois expression, back "a" vowels throughout' },
    ],
  },
  {
    id: 'fr-BE',
    name: 'Belgian French',
    shortName: 'Belgium',
    flag: '\u{1F1E7}\u{1F1EA}',
    azureLocale: 'fr-BE',
    color: '#F59E0B',
    description: 'Spoken in Wallonia and Brussels, Belgian French is the closest relative to Metropolitan French but with subtle, elegant differences. It has a reputation for clarity, warmth, and a slightly more deliberate delivery than the rapid Parisian style.',
    accentIdentity: 'Belgian French stands out through its preserved vowel length distinctions: long vowels are noticeably held, giving speech a more measured, slightly rounded quality. Where a Parisian rushes through "f\u00EAte", a Belgian lets the vowel breathe: "f\u025B\u02D0t". The intonation is softer and more melodic than Parisian French, with a gentle rise-fall pattern influenced by proximity to Dutch-speaking Flanders. Belgian speakers also maintain the /w/ vs /\u0265/ distinction more clearly, and "huit" may sound more like "wit". The most famous difference is the number system: septante (70), huitante/octante (80, though Belgium uses quatre-vingts), nonante (90) \u2014 a logical base-10 system that makes Belgians feel smugly superior to French mathematicians. The overall feel is of standard French spoken with more warmth, less rush, and more precision.',
    spokenIn: ['Wallonia', 'Brussels', 'Luxembourg (partly)'],
    speakerCount: '~4.5 million',
    voices: [
      { name: 'Charline', gender: 'female', azureVoiceId: 'fr-BE-CharlineNeural' },
      { name: 'G\u00E9rard', gender: 'male', azureVoiceId: 'fr-BE-GerardNeural' },
    ],
    characteristicSounds: [
      {
        id: 'be-long',
        sound: 'Preserved Vowel Length',
        ipa: '/a\u02D0/, /o\u02D0/, /\u025B\u02D0/',
        standardIpa: '/a/, /o/, /\u025B/',
        description: 'The most defining phonetic trait of Belgian French. Vowel length distinctions that Parisian French has almost entirely lost are alive and well in Belgium. "P\u00E2te" (dough) has a noticeably longer vowel than "patte" (paw). "F\u00EAte" rings out with a sustained /\u025B\u02D0/. This gives Belgian French its measured, elegant quality \u2014 words feel more spacious and deliberate.',
        examples: [
          { word: 'p\u00E2te', standardPronunciation: '/pat/', regionalPronunciation: '/pa\u02D0t/' },
          { word: 'f\u00EAte', standardPronunciation: '/f\u025Bt/', regionalPronunciation: '/f\u025B\u02D0t/' },
          { word: 'r\u00EAve', standardPronunciation: '/\u0281\u025Bv/', regionalPronunciation: '/\u0281\u025B\u02D0v/' },
          { word: 'dr\u00F4le', standardPronunciation: '/d\u0281ol/', regionalPronunciation: '/d\u0281o\u02D0l/' },
        ],
      },
      {
        id: 'be-w',
        sound: 'Rounded /w/ Sound',
        ipa: '/w/',
        standardIpa: '/\u0265/',
        description: 'Belgian French often uses a stronger, more rounded /w/ where Parisian French has the labio-palatal /\u0265/. "Huit" (eight) tends toward "wit" rather than the Parisian "\u0265it". "Lui" may sound slightly more like "lwi". This gives certain words a rounder, more open quality.',
        examples: [
          { word: 'oui', standardPronunciation: '/wi/', regionalPronunciation: '/w\u026A/' },
          { word: 'huit', standardPronunciation: '/\u0265it/', regionalPronunciation: '/w\u026At/' },
          { word: 'lui', standardPronunciation: '/l\u0265i/', regionalPronunciation: '/lwi/' },
        ],
      },
      {
        id: 'be-intonation',
        sound: 'Melodic Intonation',
        ipa: '\u2014',
        standardIpa: '\u2014',
        description: 'Belgian French has a gentler, more musical intonation contour than Parisian French. Where Parisians often use a flat-then-rising pattern, Belgians tend to use softer rises and falls, giving their speech a warmer, more approachable quality. This is partly influenced by contact with Dutch-speaking Flanders.',
        examples: [
          { word: 'Bonjour, comment allez-vous?', standardPronunciation: 'flat \u2192 sharp rise', regionalPronunciation: 'gentle rise \u2192 soft fall' },
        ],
      },
      {
        id: 'be-final-e',
        sound: 'Pronounced Final Schwa',
        ipa: '/\u0259/',
        standardIpa: '\u2205',
        description: 'Belgian speakers are more likely to pronounce the final "e" that Parisians drop. "Table" gets its full two syllables /ta\u02D0bl\u0259/ rather than the Parisian clipped /tabl/. "Une petite chose" has more syllables in Belgium than in Paris.',
        examples: [
          { word: 'table', standardPronunciation: '/tabl/', regionalPronunciation: '/ta\u02D0bl\u0259/' },
          { word: 'porte', standardPronunciation: '/p\u0254\u0281t/', regionalPronunciation: '/p\u0254\u02D0\u0281t\u0259/' },
        ],
      },
    ],
    uniqueVocabulary: [
      { id: 'be-v1', standard: 'soixante-dix', regional: 'septante', english: 'seventy', note: 'Logical base-10! sept + ante = 70. Makes way more sense.' },
      { id: 'be-v2', standard: 'quatre-vingt-dix', regional: 'nonante', english: 'ninety', note: 'Much simpler than "four-twenty-ten"' },
      { id: 'be-v3', standard: 'd\u00EEner', regional: 'souper', english: 'dinner (evening)', note: 'Meal names are shifted like Qu\u00E9bec' },
      { id: 'be-v4', standard: 'serpilli\u00E8re', regional: 'torchon', english: 'mop/floor cloth', note: 'Different household vocabulary' },
      { id: 'be-v5', standard: 'portable', regional: 'GSM', english: 'mobile phone', note: 'Always "GSM" in Belgium, never "portable"' },
      { id: 'be-v6', standard: '\u00E0 tout \u00E0 l\'heure', regional: '\u00E0 tant\u00F4t', english: 'see you later', note: 'Very common Belgian farewell' },
    ],
    culturalNotes: [
      'Belgian French coexists with Dutch (Flemish) and German in a trilingual country, creating unique linguistic awareness.',
      'The number system (septante, nonante) is shared with Swiss French and considered far more logical than the French system.',
      'Brussels is officially bilingual (French/Dutch), creating fascinating code-switching and mixed vocabulary.',
      'Belgian French has Walloon dialect influence, adding warmth and local color to everyday expressions.',
      'Belgians are known for self-deprecating humor about their accent \u2014 but linguists consider it clearer than Parisian French.',
    ],
    practiceWords: [
      { word: "Il est septante-trois heures \u00E0 la montre, on devrait commencer \u00E0 pr\u00E9parer le souper bient\u00F4t.", ipa: '/il \u025B s\u025Bp.t\u0251\u0303t t\u0281wa\u02D0 z\u0153\u0281 a la m\u0254\u0303t\u0281 \u0254\u0303 d\u0259.v\u0281\u025B\u02D0 k\u0254.m\u0251\u0303.se a p\u0281e.pa.\u0281e l\u0259 su.pe bj\u025B\u0303.to\u02D0/', translation: "It's 73 on the clock, we should start preparing dinner soon.", audioHint: '"Septante" for 70s, "souper" for dinner, elongated vowels' },
      { word: "Tu veux une couque au beurre avec ton caf\u00E9? La boulangerie en a des toutes fra\u00EEches.", ipa: '/ty v\u00F8 yn ku\u02D0k o b\u0153\u02D0\u0281 a.v\u025Bk t\u0254\u0303 ka.fe la bu.l\u0251\u0303\u0292.\u0281i \u0251\u0303.n\u200Ba de tu\u02D0t f\u0281\u025B\u02D0\u0283/', translation: 'Do you want a butter pastry with your coffee? The bakery has very fresh ones.', audioHint: '"Couque" is Belgian for pastry, long vowels throughout' },
      { word: "Il fait une drache terrible dehors, prends ton parapluie avant de sortir sinon tu seras tremp\u00E9.", ipa: '/il f\u025B yn d\u0281a\u02D0\u0283 t\u025B.\u0281ibl\u0259 d\u0259.\u0254\u02D0\u0281 p\u0281\u0251\u0303 t\u0254\u0303 pa.\u0281a.ply\u02D0i a.v\u0251\u0303 d\u0259 s\u0254\u0281.ti\u0281 si.n\u0254\u0303 ty s\u0259.\u0281a t\u0281\u0251\u0303.pe/', translation: "It's raining terribly outside, take your umbrella before going out or you'll be soaked.", audioHint: '"Drache" = heavy rain, classic Belgian word, measured delivery' },
      { word: "\u00C0 tant\u00F4t! On se retrouve au Grand-Place vers nonante minutes, d'accord?", ipa: '/a t\u0251\u0303.to\u02D0 \u0254\u0303 s\u0259 \u0281\u0259.t\u0281u\u02D0v o \u0261\u0281\u0251\u0303 pla\u02D0s v\u025B\u0281 n\u0254.n\u0251\u0303t mi.ny\u02D0t da.k\u0254\u0281/', translation: "See you later! We'll meet at Grand-Place in about ninety minutes, okay?", audioHint: '"A tant\u00F4t" = see you, "nonante" = 90, gentle intonation' },
      { word: "Savoir parler trois langues, c'est tout \u00E0 fait normal en Belgique, on apprend \u00E7a \u00E0 l'\u00E9cole.", ipa: '/sa.vwa\u02D0\u0281 pa\u0281.le t\u0281wa\u02D0 l\u0251\u0303\u0261 s\u025B tu\u02D0 a f\u025B n\u0254\u0281.mal \u0251\u0303 b\u025Bl.\u0292ik \u0254\u0303.n\u200Ba.p\u0281\u0251\u0303 sa a le.k\u0254\u02D0l/', translation: "Being able to speak three languages is completely normal in Belgium, you learn it at school.", audioHint: '"Savoir" used for ability (not "pouvoir"), elongated vowels on key words' },
    ],
  },
  {
    id: 'fr-CH',
    name: 'Swiss French',
    shortName: 'Switzerland',
    flag: '\u{1F1E8}\u{1F1ED}',
    azureLocale: 'fr-CH',
    color: '#EF4444',
    description: 'Spoken in Romandie (western Switzerland), Swiss French is known for its crisp precision, unhurried pace, and a deliberate clarity that reflects Swiss culture itself. It shares some features with Belgian French but has its own distinctive character shaped by German and Italian neighbors.',
    accentIdentity: 'Swiss French is the "slow-motion" French. Compared to the rapid-fire Parisian delivery, Swiss speakers take their time \u2014 each syllable gets its due, final schwas are more often pronounced, and there is a measured, almost metronomic rhythm. This is NOT a lack of fluency; it is the natural cadence, influenced by the rhythmic patterns of Swiss German. The preserved vowel length (shared with Belgian French) means long vowels are genuinely sustained. The number system is the most logical of any French variety: septante (70), huitante (80 \u2014 unique to Switzerland!), nonante (90). "Huitante" alone is a dead giveaway of Swiss French. The overall impression is of extraordinary clarity \u2014 Swiss French is often considered the easiest variety for learners to understand, precisely because nothing is swallowed or rushed.',
    spokenIn: ['Geneva', 'Lausanne', 'Neuch\u00E2tel', 'Fribourg', 'Valais', 'Jura'],
    speakerCount: '~2 million',
    voices: [
      { name: 'Ariane', gender: 'female', azureVoiceId: 'fr-CH-ArianeNeural' },
      { name: 'Fabrice', gender: 'male', azureVoiceId: 'fr-CH-FabriceNeural' },
    ],
    characteristicSounds: [
      {
        id: 'ch-rhythm',
        sound: 'Measured, Deliberate Rhythm',
        ipa: '\u2014',
        standardIpa: '\u2014',
        description: 'The most immediately noticeable feature. Swiss French has a slower, more even speech rhythm where each syllable gets more equal weight. Where a Parisian compresses "exactement" into three quick syllables, a Swiss speaker gives all four their full value. This creates a clear, precise delivery that is the phonetic equivalent of a Swiss watch.',
        examples: [
          { word: 'exactement', standardPronunciation: '/\u025B\u0261.zak.tm\u0251\u0303/', regionalPronunciation: '/\u025B\u0261.zak.t\u0259.m\u0251\u0303/' },
          { word: 'naturellement', standardPronunciation: '/na.ty\u0281\u025Bl.m\u0251\u0303/', regionalPronunciation: '/na.ty.\u0281\u025Bl.l\u0259.m\u0251\u0303/' },
          { word: 'simplement', standardPronunciation: '/s\u025B\u0303.pl\u0259.m\u0251\u0303/', regionalPronunciation: '/s\u025B\u0303p.l\u0259.m\u0251\u0303/' },
        ],
      },
      {
        id: 'ch-vowel',
        sound: 'Sustained Vowel Length',
        ipa: '/a\u02D0/, /e\u02D0/, /\u025B\u02D0/',
        standardIpa: '/a/, /e/, /\u025B/',
        description: 'Like Belgian French, Swiss French preserves long/short vowel contrasts. But Swiss speakers often sustain them even more than Belgians. "P\u00E2te" vs "patte", "f\u00EAte" vs "faite" \u2014 these pairs that sound identical in Paris are clearly distinct in Romandie. Combined with the slower tempo, vowels feel spacious and deliberate.',
        examples: [
          { word: 'p\u00E2te', standardPronunciation: '/pat/', regionalPronunciation: '/pa\u02D0t/' },
          { word: 'f\u00EAte', standardPronunciation: '/f\u025Bt/', regionalPronunciation: '/f\u025B\u02D0t/' },
          { word: 'ch\u00E2teau', standardPronunciation: '/\u0283a.to/', regionalPronunciation: '/\u0283a\u02D0.to\u02D0/' },
          { word: 't\u00EAte', standardPronunciation: '/t\u025Bt/', regionalPronunciation: '/t\u025B\u02D0t/' },
        ],
      },
      {
        id: 'ch-schwa',
        sound: 'Preserved Final Schwa',
        ipa: '/\u0259/',
        standardIpa: '\u2205',
        description: 'Swiss French consistently pronounces final schwas that Parisians drop. "Table" is two full syllables /ta\u02D0bl\u0259/, "autre" is /o\u02D0t\u0281\u0259/. This is a major contributor to the perception of Swiss French being "slower" \u2014 it actually has more pronounced syllables per word.',
        examples: [
          { word: 'table', standardPronunciation: '/tabl/', regionalPronunciation: '/ta\u02D0bl\u0259/' },
          { word: 'autre', standardPronunciation: '/ot\u0281/', regionalPronunciation: '/o\u02D0t\u0281\u0259/' },
          { word: 'possible', standardPronunciation: '/p\u0254.sibl/', regionalPronunciation: '/p\u0254.si\u02D0bl\u0259/' },
        ],
      },
      {
        id: 'ch-num',
        sound: 'Unique Number Words',
        ipa: '/\u0265i.t\u0251\u0303t/',
        standardIpa: '/kat\u0281.v\u025B\u0303/',
        description: 'Switzerland is the ONLY French-speaking region that uses "huitante" for 80 (in cantons of Vaud, Valais, and Fribourg). Combined with "septante" (70) and "nonante" (90), Swiss French has the most completely logical number system in the Francophone world.',
        examples: [
          { word: 'huitante', standardPronunciation: '/kat\u0281.v\u025B\u0303/', regionalPronunciation: '/\u0265i.t\u0251\u0303t/' },
          { word: 'septante', standardPronunciation: '/swa.s\u0251\u0303t.dis/', regionalPronunciation: '/s\u025Bp.t\u0251\u0303t/' },
          { word: 'nonante', standardPronunciation: '/kat\u0281.v\u025B\u0303.dis/', regionalPronunciation: '/n\u0254.n\u0251\u0303t/' },
        ],
      },
    ],
    uniqueVocabulary: [
      { id: 'ch-v1', standard: 'soixante-dix', regional: 'septante', english: 'seventy', note: 'Shared with Belgium \u2014 simple, logical' },
      { id: 'ch-v2', standard: 'quatre-vingts', regional: 'huitante', english: 'eighty', note: 'UNIQUE to Switzerland! The most distinctive Swiss French word.' },
      { id: 'ch-v3', standard: 'quatre-vingt-dix', regional: 'nonante', english: 'ninety', note: 'Shared with Belgium' },
      { id: 'ch-v4', standard: 'd\u00E9jeuner', regional: 'd\u00EEner', english: 'lunch', note: 'Shifted meal names \u2014 d\u00EEner is lunch, souper is dinner' },
      { id: 'ch-v5', standard: 't\u00E9l\u00E9phone portable', regional: 'natel', english: 'mobile phone', note: 'From the Swisscom brand "Natel" \u2014 uniquely Swiss' },
      { id: 'ch-v6', standard: 'sac plastique', regional: 'cornet', english: 'plastic bag', note: 'Ask for a "cornet" at the shop, not a "sac"' },
    ],
    culturalNotes: [
      'Romandie borders France and German-speaking Switzerland, making Swiss French speakers naturally multicultural and often trilingual.',
      'Swiss French is considered the clearest, most easily understood variety of French \u2014 ideal for learners.',
      '"Huitante" for 80 is unique to cantons of Vaud, Valais, and Fribourg. Geneva actually uses "quatre-vingts" like France!',
      'Geneva is home to the UN, Red Cross, and WHO \u2014 Swiss French is heavily used in international diplomacy.',
      'The slower pace is cultural, not a limitation \u2014 Swiss value precision and clarity in all things, including speech.',
    ],
    practiceWords: [
      { word: "On a rendez-vous \u00E0 huitante-cinq heures devant la gare, tu penses que c'est possible d'arriver \u00E0 temps?", ipa: '/\u0254\u0303.n\u200Ba \u0281\u0251\u0303.de.vu\u02D0 a \u0265i.t\u0251\u0303t s\u025B\u0303k \u0153\u02D0\u0281 d\u0259.v\u0251\u0303 la \u0261a\u02D0\u0281\u0259 ty p\u0251\u0303s\u0259 k\u0259 s\u025B p\u0254.si\u02D0bl\u0259 da.\u0281i.ve a t\u0251\u0303/', translation: "We have a meeting at 85 hours in front of the station, do you think it's possible to arrive on time?", audioHint: '"Huitante" for 80s, measured pace, final schwas pronounced' },
      { word: "Passe-moi le natel, je dois appeler le m\u00E9decin pour prendre un rendez-vous cette semaine.", ipa: '/pa\u02D0s mwa l\u0259 na.t\u025Bl \u0292\u0259 dwa\u02D0 a.p\u0259.le l\u0259 med.s\u025B\u0303 pu\u0281 p\u0281\u0251\u0303d\u0281\u0259 \u025B\u0303 \u0281\u0251\u0303.de.vu\u02D0 s\u025Bt\u0259 s\u0259.m\u025Bn\u0259/', translation: "Pass me the phone, I need to call the doctor to make an appointment this week.", audioHint: '"Natel" for phone, deliberate syllable timing, sustained vowels' },
      { word: "Le ch\u00E2teau de Chillon est vraiment magnifique, surtout quand on le visite au coucher du soleil.", ipa: '/l\u0259 \u0283a\u02D0.to\u02D0 d\u0259 \u0283i.j\u0254\u0303 \u025B v\u0281\u025B\u02D0.m\u0251\u0303 ma.\u0272i.fi\u02D0k\u0259 sy\u02D0\u0281.tu\u02D0 k\u0251\u0303 \u0254\u0303 l\u0259 vi.zi\u02D0t\u0259 o ku.\u0283e dy s\u0254.l\u025B\u02D0j/', translation: "The Ch\u00E2teau de Chillon is truly magnificent, especially when you visit it at sunset.", audioHint: 'Long vowels on ch\u00E2teau, magnifique; Swiss precision throughout' },
      { word: "Prends un cornet pour les commissions, on va acheter du fromage et du chocolat au march\u00E9.", ipa: '/p\u0281\u0251\u0303 \u025B\u0303 k\u0254\u0281.n\u025B pu\u0281 le k\u0254.mi.sj\u0254\u0303 \u0254\u0303 va a.\u0283\u0259.te dy f\u0281\u0254.ma\u02D0\u0292\u0259 e dy \u0283\u0254.k\u0254.la\u02D0 o ma\u0281.\u0283e/', translation: "Take a bag for the groceries, we're going to buy cheese and chocolate at the market.", audioHint: '"Cornet" = bag, "commissions" = groceries, full syllable delivery' },
      { word: "C'est naturellement tr\u00E8s agr\u00E9able de vivre en Suisse, m\u00EAme si le co\u00FBt de la vie est \u00E9lev\u00E9.", ipa: '/s\u025B na.ty.\u0281\u025Bl.l\u0259.m\u0251\u0303 t\u0281\u025B\u02D0 a.\u0261\u0281e.a\u02D0bl\u0259 d\u0259 vi\u02D0v\u0281\u0259 \u0251\u0303 s\u0265is m\u025B\u02D0m si l\u0259 ku\u02D0 d\u0259 la vi\u02D0 \u025B.t\u200Be.l\u0259.ve/', translation: "It's naturally very pleasant to live in Switzerland, even if the cost of living is high.", audioHint: 'Full "naturellement" with every syllable, sustained vowels, unhurried' },
    ],
  },
];

export function getRegionById(id: FrenchRegionId): FrenchRegion | undefined {
  return frenchRegions.find(r => r.id === id);
}

export function getAzureLocaleForRegion(id: FrenchRegionId): string {
  const region = getRegionById(id);
  return region?.azureLocale || 'fr-FR';
}

export function getVoicesForRegion(id: FrenchRegionId): RegionalVoice[] {
  const region = getRegionById(id);
  return region?.voices || [];
}
