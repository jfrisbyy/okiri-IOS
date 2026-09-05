export interface PronunciationWord {
  id: string;
  word: string;
  ipa: string;
  translation: string;
  audioHint: string;
  targetPhonemes: string[];
}

export interface PronunciationCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  tips: string[];
  words: PronunciationWord[];
}

export const pronunciationCategories: PronunciationCategory[] = [
  {
    id: 'nasal-vowels',
    name: 'Nasal Vowels',
    description: 'Master the unique French nasal sounds',
    icon: '👃',
    color: '#8B5CF6',
    difficulty: 'intermediate',
    tips: [
      'Let air flow through your nose while making the sound',
      'Don\'t pronounce the final "n" or "m" - they just nasalize the vowel',
      'Practice humming while making the vowel sound'
    ],
    words: [
      { id: 'n1', word: 'bon', ipa: '/bɔ̃/', translation: 'good', audioHint: 'The "on" is nasal - no "n" sound at end', targetPhonemes: ['ɔ̃'] },
      { id: 'n2', word: 'vin', ipa: '/vɛ̃/', translation: 'wine', audioHint: 'The "in" is nasal like "van" but through nose', targetPhonemes: ['ɛ̃'] },
      { id: 'n3', word: 'blanc', ipa: '/blɑ̃/', translation: 'white', audioHint: 'The "an" is a deep nasal "ah"', targetPhonemes: ['ɑ̃'] },
      { id: 'n4', word: 'un', ipa: '/œ̃/', translation: 'one/a', audioHint: 'Round your lips like "uh" but nasal', targetPhonemes: ['œ̃'] },
      { id: 'n5', word: 'jambon', ipa: '/ʒɑ̃.bɔ̃/', translation: 'ham', audioHint: 'Two nasal vowels: "an" then "on"', targetPhonemes: ['ɑ̃', 'ɔ̃'] },
      { id: 'n6', word: 'enfant', ipa: '/ɑ̃.fɑ̃/', translation: 'child', audioHint: 'Same nasal "an" sound twice', targetPhonemes: ['ɑ̃'] },
      { id: 'n7', word: 'pain', ipa: '/pɛ̃/', translation: 'bread', audioHint: 'The "ain" sounds like nasal "an"', targetPhonemes: ['ɛ̃'] },
      { id: 'n8', word: 'monde', ipa: '/mɔ̃d/', translation: 'world', audioHint: 'Nasal "on" followed by soft "d"', targetPhonemes: ['ɔ̃'] },
      { id: 'n9', word: 'pendant', ipa: '/pɑ̃.dɑ̃/', translation: 'during', audioHint: 'Two "an" nasal sounds', targetPhonemes: ['ɑ̃'] },
      { id: 'n10', word: 'important', ipa: '/ɛ̃.pɔʁ.tɑ̃/', translation: 'important', audioHint: 'Starts with nasal "in", ends with nasal "an"', targetPhonemes: ['ɛ̃', 'ɑ̃'] },
      { id: 'n11', word: 'maintenant', ipa: '/mɛ̃t.nɑ̃/', translation: 'now', audioHint: 'Nasal "ain" then nasal "an"', targetPhonemes: ['ɛ̃', 'ɑ̃'] },
      { id: 'n12', word: 'longtemps', ipa: '/lɔ̃.tɑ̃/', translation: 'a long time', audioHint: 'Two different nasal vowels', targetPhonemes: ['ɔ̃', 'ɑ̃'] },
    ]
  },
  {
    id: 'french-r',
    name: 'French R',
    description: 'The guttural R sound from the throat',
    icon: '🗣️',
    color: '#EC4899',
    difficulty: 'advanced',
    tips: [
      'The sound comes from the back of your throat, not the front',
      'It\'s like a gentle gargling sound',
      'Practice saying "h" from deep in your throat',
      'Think of clearing your throat very gently'
    ],
    words: [
      { id: 'r1', word: 'rue', ipa: '/ʁy/', translation: 'street', audioHint: 'Start with throat R, then round lips for "u"', targetPhonemes: ['ʁ', 'y'] },
      { id: 'r2', word: 'rouge', ipa: '/ʁuʒ/', translation: 'red', audioHint: 'Throat R then "oozh"', targetPhonemes: ['ʁ'] },
      { id: 'r3', word: 'Paris', ipa: '/pa.ʁi/', translation: 'Paris', audioHint: 'The R is between the vowels', targetPhonemes: ['ʁ'] },
      { id: 'r4', word: 'regarder', ipa: '/ʁə.ɡaʁ.de/', translation: 'to look', audioHint: 'R at start and middle', targetPhonemes: ['ʁ'] },
      { id: 'r5', word: 'merci', ipa: '/mɛʁ.si/', translation: 'thank you', audioHint: 'R comes after "meh"', targetPhonemes: ['ʁ'] },
      { id: 'r6', word: 'arriver', ipa: '/a.ʁi.ve/', translation: 'to arrive', audioHint: 'Double R sound in middle', targetPhonemes: ['ʁ'] },
      { id: 'r7', word: 'travailler', ipa: '/tʁa.va.je/', translation: 'to work', audioHint: 'TR blend at start', targetPhonemes: ['ʁ'] },
      { id: 'r8', word: 'première', ipa: '/pʁə.mjɛʁ/', translation: 'first (fem)', audioHint: 'PR at start, R at end', targetPhonemes: ['ʁ'] },
      { id: 'r9', word: 'restaurant', ipa: '/ʁɛs.to.ʁɑ̃/', translation: 'restaurant', audioHint: 'R at start and in middle', targetPhonemes: ['ʁ'] },
      { id: 'r10', word: 'partir', ipa: '/paʁ.tiʁ/', translation: 'to leave', audioHint: 'R in middle and at end', targetPhonemes: ['ʁ'] },
      { id: 'r11', word: 'très', ipa: '/tʁɛ/', translation: 'very', audioHint: 'TR blend - tongue stays down', targetPhonemes: ['ʁ'] },
      { id: 'r12', word: 'grand', ipa: '/ɡʁɑ̃/', translation: 'big/tall', audioHint: 'GR blend with nasal ending', targetPhonemes: ['ʁ'] },
    ]
  },
  {
    id: 'u-ou',
    name: 'U vs OU',
    description: 'Distinguish the tight "u" from the round "ou"',
    icon: '👄',
    color: '#06B6D4',
    difficulty: 'intermediate',
    tips: [
      'For "u" (/y/): say "ee" but round your lips tightly',
      'For "ou" (/u/): like English "oo" in "food"',
      'The French "u" doesn\'t exist in English - it\'s unique!',
      'Keep your tongue high for "u", relaxed for "ou"'
    ],
    words: [
      { id: 'u1', word: 'tu', ipa: '/ty/', translation: 'you', audioHint: 'Tight lips, tongue high - NOT "too"', targetPhonemes: ['y'] },
      { id: 'u2', word: 'tout', ipa: '/tu/', translation: 'all/everything', audioHint: 'Like English "too"', targetPhonemes: ['u'] },
      { id: 'u3', word: 'dessus', ipa: '/də.sy/', translation: 'on top', audioHint: 'End with tight French "u"', targetPhonemes: ['y'] },
      { id: 'u4', word: 'dessous', ipa: '/də.su/', translation: 'underneath', audioHint: 'End with round "oo"', targetPhonemes: ['u'] },
      { id: 'u5', word: 'rue', ipa: '/ʁy/', translation: 'street', audioHint: 'Tight French "u" after R', targetPhonemes: ['y'] },
      { id: 'u6', word: 'roue', ipa: '/ʁu/', translation: 'wheel', audioHint: 'Round "oo" after R', targetPhonemes: ['u'] },
      { id: 'u7', word: 'vu', ipa: '/vy/', translation: 'seen', audioHint: 'Tight "u" sound', targetPhonemes: ['y'] },
      { id: 'u8', word: 'vous', ipa: '/vu/', translation: 'you (formal)', audioHint: 'Round "oo" like "voo"', targetPhonemes: ['u'] },
      { id: 'u9', word: 'sur', ipa: '/syʁ/', translation: 'on/over', audioHint: 'Starts with tight "u"', targetPhonemes: ['y'] },
      { id: 'u10', word: 'sourd', ipa: '/suʁ/', translation: 'deaf', audioHint: 'Round "oo" sound', targetPhonemes: ['u'] },
      { id: 'u11', word: 'plus', ipa: '/ply/', translation: 'more', audioHint: 'End with tight French "u"', targetPhonemes: ['y'] },
      { id: 'u12', word: 'jouer', ipa: '/ʒu.e/', translation: 'to play', audioHint: 'Round "oo" in middle', targetPhonemes: ['u'] },
    ]
  },
  {
    id: 'liaisons',
    name: 'Liaisons',
    description: 'Connect words smoothly in French',
    icon: '🔗',
    color: '#10B981',
    difficulty: 'advanced',
    tips: [
      'Liaisons connect a silent consonant to the next vowel',
      'The "s" becomes a "z" sound in liaisons',
      'The "d" becomes a "t" sound in liaisons',
      'Practice phrases as single flowing units'
    ],
    words: [
      { id: 'l1', word: 'les amis', ipa: '/le.z‿a.mi/', translation: 'the friends', audioHint: '"Les" connects with Z sound to "amis"', targetPhonemes: ['z'] },
      { id: 'l2', word: 'vous avez', ipa: '/vu.z‿a.ve/', translation: 'you have', audioHint: 'S becomes Z before "avez"', targetPhonemes: ['z'] },
      { id: 'l3', word: 'petit ami', ipa: '/pə.ti.t‿a.mi/', translation: 'boyfriend', audioHint: 'T connects to "ami"', targetPhonemes: ['t'] },
      { id: 'l4', word: 'c\'est un', ipa: '/sɛ.t‿œ̃/', translation: 'it\'s a', audioHint: 'T sound connects to "un"', targetPhonemes: ['t'] },
      { id: 'l5', word: 'deux heures', ipa: '/dø.z‿œʁ/', translation: 'two hours', audioHint: 'X becomes Z before "heures"', targetPhonemes: ['z'] },
      { id: 'l6', word: 'très important', ipa: '/tʁɛ.z‿ɛ̃.pɔʁ.tɑ̃/', translation: 'very important', audioHint: 'S becomes Z before vowel', targetPhonemes: ['z'] },
      { id: 'l7', word: 'un an', ipa: '/œ̃.n‿ɑ̃/', translation: 'one year', audioHint: 'N connects to "an"', targetPhonemes: ['n'] },
      { id: 'l8', word: 'quand il', ipa: '/kɑ̃.t‿il/', translation: 'when he', audioHint: 'D becomes T before "il"', targetPhonemes: ['t'] },
      { id: 'l9', word: 'nous avons', ipa: '/nu.z‿a.vɔ̃/', translation: 'we have', audioHint: 'S becomes Z', targetPhonemes: ['z'] },
      { id: 'l10', word: 'en hiver', ipa: '/ɑ̃.n‿i.vɛʁ/', translation: 'in winter', audioHint: 'N connects across', targetPhonemes: ['n'] },
      { id: 'l11', word: 'mon ami', ipa: '/mɔ̃.n‿a.mi/', translation: 'my friend', audioHint: 'N liaison to "ami"', targetPhonemes: ['n'] },
      { id: 'l12', word: 'chez elle', ipa: '/ʃe.z‿ɛl/', translation: 'at her place', audioHint: 'Z connects to "elle"', targetPhonemes: ['z'] },
    ]
  },
  {
    id: 'silent-letters',
    name: 'Silent Letters',
    description: 'Know when NOT to pronounce letters',
    icon: '🤫',
    color: '#F59E0B',
    difficulty: 'beginner',
    tips: [
      'Most final consonants are silent (except C, R, F, L - "CaReFuL")',
      'The final "e" is usually silent',
      'H is always silent in French',
      'Double letters usually sound like single letters'
    ],
    words: [
      { id: 's1', word: 'petit', ipa: '/pə.ti/', translation: 'small', audioHint: 'The final "t" is silent', targetPhonemes: ['i'] },
      { id: 's2', word: 'beaucoup', ipa: '/bo.ku/', translation: 'a lot', audioHint: 'The "p" is silent', targetPhonemes: ['u'] },
      { id: 's3', word: 'temps', ipa: '/tɑ̃/', translation: 'time', audioHint: 'Both "p" and "s" are silent', targetPhonemes: ['ɑ̃'] },
      { id: 's4', word: 'heure', ipa: '/œʁ/', translation: 'hour', audioHint: 'H is always silent in French', targetPhonemes: ['œ', 'ʁ'] },
      { id: 's5', word: 'homme', ipa: '/ɔm/', translation: 'man', audioHint: 'H is silent, double M sounds single', targetPhonemes: ['ɔ', 'm'] },
      { id: 's6', word: 'parlez', ipa: '/paʁ.le/', translation: 'speak', audioHint: 'The "z" ending is silent', targetPhonemes: ['e'] },
      { id: 's7', word: 'français', ipa: '/fʁɑ̃.sɛ/', translation: 'French', audioHint: 'The "s" at end is silent', targetPhonemes: ['ɛ'] },
      { id: 's8', word: 'nuit', ipa: '/nɥi/', translation: 'night', audioHint: 'The "t" is silent', targetPhonemes: ['ɥ', 'i'] },
      { id: 's9', word: 'gentil', ipa: '/ʒɑ̃.ti/', translation: 'kind/nice', audioHint: 'The "l" is silent here', targetPhonemes: ['i'] },
      { id: 's10', word: 'chocolat', ipa: '/ʃɔ.kɔ.la/', translation: 'chocolate', audioHint: 'The final "t" is silent', targetPhonemes: ['a'] },
      { id: 's11', word: 'trois', ipa: '/tʁwa/', translation: 'three', audioHint: 'The "s" is silent', targetPhonemes: ['wa'] },
      { id: 's12', word: 'doigt', ipa: '/dwa/', translation: 'finger', audioHint: 'The "g" and "t" are silent', targetPhonemes: ['wa'] },
    ]
  },
  {
    id: 'vowel-sounds',
    name: 'French Vowels',
    description: 'Pure, crisp French vowel sounds',
    icon: '🎵',
    color: '#EF4444',
    difficulty: 'beginner',
    tips: [
      'French vowels are "pure" - they don\'t glide like English vowels',
      'Keep your mouth position steady throughout the sound',
      'The é is like "ay" but cut short',
      'The è is like "eh" in "bed"'
    ],
    words: [
      { id: 'v1', word: 'été', ipa: '/e.te/', translation: 'summer', audioHint: 'Both vowels are pure "ay" sounds', targetPhonemes: ['e'] },
      { id: 'v2', word: 'père', ipa: '/pɛʁ/', translation: 'father', audioHint: 'Open "eh" sound like in "bed"', targetPhonemes: ['ɛ'] },
      { id: 'v3', word: 'beau', ipa: '/bo/', translation: 'beautiful', audioHint: 'Pure "oh" - lips rounded, no glide', targetPhonemes: ['o'] },
      { id: 'v4', word: 'eau', ipa: '/o/', translation: 'water', audioHint: 'Same pure "oh" as "beau"', targetPhonemes: ['o'] },
      { id: 'v5', word: 'peu', ipa: '/pø/', translation: 'little/few', audioHint: 'Round lips, say "uh"', targetPhonemes: ['ø'] },
      { id: 'v6', word: 'peur', ipa: '/pœʁ/', translation: 'fear', audioHint: 'Like "peu" but more open', targetPhonemes: ['œ'] },
      { id: 'v7', word: 'deux', ipa: '/dø/', translation: 'two', audioHint: 'Round lips for "eu"', targetPhonemes: ['ø'] },
      { id: 'v8', word: 'café', ipa: '/ka.fe/', translation: 'coffee', audioHint: 'End with crisp "ay"', targetPhonemes: ['e'] },
      { id: 'v9', word: 'lait', ipa: '/lɛ/', translation: 'milk', audioHint: 'Open "eh" sound', targetPhonemes: ['ɛ'] },
      { id: 'v10', word: 'feu', ipa: '/fø/', translation: 'fire', audioHint: 'Rounded "eu" sound', targetPhonemes: ['ø'] },
      { id: 'v11', word: 'bleu', ipa: '/blø/', translation: 'blue', audioHint: 'Same rounded "eu"', targetPhonemes: ['ø'] },
      { id: 'v12', word: 'je', ipa: '/ʒə/', translation: 'I', audioHint: 'Schwa - unstressed "uh"', targetPhonemes: ['ə'] },
    ]
  }
];
