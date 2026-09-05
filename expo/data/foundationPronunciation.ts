import type { PronunciationResult } from '@/utils/azurePronunciation';

export interface PronItem {
  id: string;
  text: string;
  ipa: string;
  meaning?: string;
  hint: string;
  type: 'sound' | 'syllable' | 'word' | 'phrase' | 'sentence' | 'paragraph';
}

export interface PronLesson {
  id: string;
  title: string;
  subtitle: string;
  items: PronItem[];
  passScore: number;
}

export interface PronStage {
  id: string;
  order: number;
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  color: string;
  lessons: PronLesson[];
}

export const PRON_PASS_SCORE = 70;

const PHONEME_TIPS: Record<string, string> = {
  'ʁ': 'The French R comes from the back of your throat — like a gentle gargle.',
  'y': 'Say "ee" but round your lips tight like whistling. This sound doesn\'t exist in English.',
  'ɑ̃': 'Say "ah" but push air through your nose. Don\'t pronounce the "n".',
  'ɛ̃': 'Like "eh" but nasalized — push air through your nose.',
  'ɔ̃': 'Round your lips for "oh" and push air through your nose.',
  'œ̃': 'Slightly rounded lips, push "uh" through your nose.',
  'ø': 'Say "ay" but with rounded lips — keep your tongue high.',
  'œ': 'Like "uh" with slightly rounded, relaxed lips.',
  'ʒ': 'Like the "s" in English "measure" — a voiced "sh" sound.',
  'ɥ': 'Quick round-to-spread — lips go from "u" position to "ee" rapidly.',
  'ə': 'Unstressed "uh" — keep it very short and relaxed.',
  'ɛ': 'Open "eh" like in English "bed" — keep it pure, no glide.',
  'e': 'Like "ay" in "say" but cut short — no glide to "ee".',
  'o': 'Pure "oh" — round lips and hold steady, don\'t glide to "w".',
  'u': 'Like "oo" in "food" — round lips into a tube.',
  'i': 'Wide smile, pure "ee" sound.',
  'a': 'Wide open mouth, say "ah".',
  'ʃ': 'Like English "sh" — push lips forward slightly.',
};

export function generateSuggestions(
  result: PronunciationResult,
  itemType: PronItem['type'],
): string[] {
  const suggestions: string[] = [];

  if (!result.words || result.words.length === 0) {
    if (result.pronunciationScore < 30) {
      suggestions.push('No clear speech detected. Speak directly into the microphone and try again.');
    }
    return suggestions.length > 0 ? suggestions : ['Listen to the native audio and try matching the sound.'];
  }

  const weakPhonemes = result.words
    .flatMap(w => w.phonemes)
    .filter(p => p.accuracyScore < 60);

  const seen = new Set<string>();
  for (const wp of weakPhonemes) {
    if (seen.has(wp.phoneme) || suggestions.length >= 3) break;
    seen.add(wp.phoneme);
    const tip = PHONEME_TIPS[wp.phoneme];
    if (tip) {
      suggestions.push(`/${wp.phoneme}/: ${tip}`);
    } else if (wp.nBestPhonemes && wp.nBestPhonemes.length > 0) {
      const heard = wp.nBestPhonemes[0];
      if (heard.phoneme !== wp.phoneme) {
        const targetTip = PHONEME_TIPS[wp.phoneme];
        suggestions.push(
          `Your /${wp.phoneme}/ sounded like /${heard.phoneme}/.${targetTip ? ' ' + targetTip : ''}`
        );
      }
    }
  }

  const omitted = result.words.filter(w => w.errorType === 'Omission');
  if (omitted.length > 0) {
    suggestions.push(`Missing: ${omitted.map(w => `"${w.word}"`).join(', ')}. Pronounce every part clearly.`);
  }

  if ((itemType === 'sentence' || itemType === 'paragraph') && result.fluencyScore < 70) {
    suggestions.push('Connect your words more smoothly — French flows like a stream without pauses between words.');
  }

  if (result.completenessScore < 70 && itemType !== 'sound') {
    suggestions.push('Some sounds were incomplete. Try speaking a bit slower and more deliberately.');
  }

  if (suggestions.length === 0 && result.pronunciationScore >= 70) {
    suggestions.push('Solid pronunciation! Keep practicing to make it even more natural.');
  } else if (suggestions.length === 0) {
    suggestions.push('Listen to the native audio again and try to match the rhythm and sounds.');
  }

  return suggestions;
}

export function getStageForLesson(lessonId: string): PronStage | undefined {
  return pronStages.find(s => s.lessons.some(l => l.id === lessonId));
}

export const pronStages: PronStage[] = [
  {
    id: 'stage-1',
    order: 1,
    title: 'Les Sons',
    subtitle: 'Pure Sounds',
    description: 'Make the individual French sounds. No words yet — just noise.',
    icon: '🎵',
    color: '#3B82F6',
    lessons: [
      {
        id: 'pron-1-1',
        title: 'Mouth Shapes',
        subtitle: 'Core French vowels',
        passScore: 70,
        items: [
          { id: 'p1-1', text: 'chat', ipa: '/ʃa/', meaning: 'cat', hint: 'Open wide for the "a" — like saying "ah" at the doctor', type: 'sound' },
          { id: 'p1-2', text: 'été', ipa: '/e.te/', meaning: 'summer', hint: 'Smile slightly. Say "ay" but cut it short — no glide', type: 'sound' },
          { id: 'p1-3', text: 'sel', ipa: '/sɛl/', meaning: 'salt', hint: 'Open mouth for "eh" like in English "bed"', type: 'sound' },
          { id: 'p1-4', text: 'vie', ipa: '/vi/', meaning: 'life', hint: 'Wide smile. Pure "ee" — hold it steady', type: 'sound' },
          { id: 'p1-5', text: 'mot', ipa: '/mo/', meaning: 'word', hint: 'Round your lips. Pure "oh" — don\'t let it glide to "w"', type: 'sound' },
          { id: 'p1-6', text: 'vous', ipa: '/vu/', meaning: 'you', hint: 'Round lips like a tube. "oo" as in "food"', type: 'sound' },
          { id: 'p1-7', text: 'tu', ipa: '/ty/', meaning: 'you (informal)', hint: 'Say "ee" but ROUND your lips tight. This doesn\'t exist in English!', type: 'sound' },
        ],
      },
      {
        id: 'pron-1-2',
        title: 'Through the Nose',
        subtitle: 'Nasal vowels',
        passScore: 70,
        items: [
          { id: 'p1-8', text: 'bon', ipa: '/bɔ̃/', meaning: 'good', hint: 'Round lips, say "oh" through your nose — no "n" at the end', type: 'sound' },
          { id: 'p1-9', text: 'vin', ipa: '/vɛ̃/', meaning: 'wine', hint: 'Say "eh" through your nose. The "n" just nasalizes it', type: 'sound' },
          { id: 'p1-10', text: 'blanc', ipa: '/blɑ̃/', meaning: 'white', hint: 'Deep nasal "ah" — feel it vibrate in your nose', type: 'sound' },
          { id: 'p1-11', text: 'brun', ipa: '/bʁœ̃/', meaning: 'brown', hint: 'Round lips slightly, push "uh" through your nose', type: 'sound' },
          { id: 'p1-12', text: 'pain', ipa: '/pɛ̃/', meaning: 'bread', hint: 'Same nasal as "vin" — the "ain" is nasal "eh"', type: 'sound' },
          { id: 'p1-13', text: 'monde', ipa: '/mɔ̃d/', meaning: 'world', hint: 'Nasal "on" followed by a soft "d"', type: 'sound' },
        ],
      },
      {
        id: 'pron-1-3',
        title: 'Uniquely French',
        subtitle: 'Sounds that don\'t exist in English',
        passScore: 70,
        items: [
          { id: 'p1-14', text: 'rue', ipa: '/ʁy/', meaning: 'street', hint: 'Gentle gargle for "r" then tight rounded "u"', type: 'sound' },
          { id: 'p1-15', text: 'rouge', ipa: '/ʁuʒ/', meaning: 'red', hint: 'Throat "r" then round "ou" then soft "zh"', type: 'sound' },
          { id: 'p1-16', text: 'je', ipa: '/ʒə/', meaning: 'I', hint: 'Like "zh" — the sound in English "measure"', type: 'sound' },
          { id: 'p1-17', text: 'nuit', ipa: '/nɥi/', meaning: 'night', hint: 'Quick "n" then lips round-to-spread: "wee"', type: 'sound' },
          { id: 'p1-18', text: 'peu', ipa: '/pø/', meaning: 'little', hint: 'Round your lips like "oh" but tongue says "ay"', type: 'sound' },
          { id: 'p1-19', text: 'peur', ipa: '/pœʁ/', meaning: 'fear', hint: 'Like "peu" but more open, followed by throat "r"', type: 'sound' },
        ],
      },
    ],
  },
  {
    id: 'stage-2',
    order: 2,
    title: 'Les Syllabes',
    subtitle: 'Syllable Patterns',
    description: 'Combine sounds smoothly into syllable patterns and rhythm.',
    icon: '🔤',
    color: '#8B5CF6',
    lessons: [
      {
        id: 'pron-2-1',
        title: 'Open Syllables',
        subtitle: 'Flowing vowel endings',
        passScore: 70,
        items: [
          { id: 'p2-1', text: 'papa', ipa: '/pa.pa/', meaning: 'dad', hint: 'Two identical open syllables — keep rhythm even', type: 'syllable' },
          { id: 'p2-2', text: 'café', ipa: '/ka.fe/', meaning: 'coffee', hint: 'Stress the second syllable: ka-FÉ', type: 'syllable' },
          { id: 'p2-3', text: 'bébé', ipa: '/be.be/', meaning: 'baby', hint: 'Two "ay" sounds — keep them pure and identical', type: 'syllable' },
          { id: 'p2-4', text: 'musique', ipa: '/my.zik/', meaning: 'music', hint: 'First syllable has tight French "u": mü-zik', type: 'syllable' },
          { id: 'p2-5', text: 'facile', ipa: '/fa.sil/', meaning: 'easy', hint: 'Three syllables, stress the last: fa-SEEL', type: 'syllable' },
        ],
      },
      {
        id: 'pron-2-2',
        title: 'Closed Syllables',
        subtitle: 'Consonant endings',
        passScore: 70,
        items: [
          { id: 'p2-6', text: 'pardon', ipa: '/paʁ.dɔ̃/', meaning: 'sorry', hint: 'Throat "r" in first syllable, nasal in second', type: 'syllable' },
          { id: 'p2-7', text: 'merci', ipa: '/mɛʁ.si/', meaning: 'thank you', hint: 'Open "eh" then throat "r", finish with "see"', type: 'syllable' },
          { id: 'p2-8', text: 'dormir', ipa: '/dɔʁ.miʁ/', meaning: 'to sleep', hint: 'Two syllables each ending with throat "r"', type: 'syllable' },
          { id: 'p2-9', text: 'partir', ipa: '/paʁ.tiʁ/', meaning: 'to leave', hint: 'Clean "r" sounds — gentle throat vibration', type: 'syllable' },
          { id: 'p2-10', text: 'journal', ipa: '/ʒuʁ.nal/', meaning: 'newspaper', hint: '"zh" start, throat "r", then nasal "al"', type: 'syllable' },
        ],
      },
      {
        id: 'pron-2-3',
        title: 'Complex Blends',
        subtitle: 'Consonant clusters and transitions',
        passScore: 70,
        items: [
          { id: 'p2-11', text: 'trois', ipa: '/tʁwa/', meaning: 'three', hint: 'TR blend from the throat, then "wa"', type: 'syllable' },
          { id: 'p2-12', text: 'fleur', ipa: '/flœʁ/', meaning: 'flower', hint: 'FL blend then the "eu" vowel and throat "r"', type: 'syllable' },
          { id: 'p2-13', text: 'grand', ipa: '/ɡʁɑ̃/', meaning: 'big', hint: 'GR blend from the throat into nasal "an"', type: 'syllable' },
          { id: 'p2-14', text: 'chocolat', ipa: '/ʃɔ.kɔ.la/', meaning: 'chocolate', hint: 'Three syllables — silent final "t"', type: 'syllable' },
          { id: 'p2-15', text: 'croissant', ipa: '/kʁwa.sɑ̃/', meaning: 'croissant', hint: 'KR blend then "wa", finish with nasal "an"', type: 'syllable' },
        ],
      },
    ],
  },
  {
    id: 'stage-3',
    order: 3,
    title: 'Les Mots',
    subtitle: 'Complete Words',
    description: 'Pronounce everyday French words with confidence.',
    icon: '📖',
    color: '#EC4899',
    lessons: [
      {
        id: 'pron-3-1',
        title: 'Everyday Words',
        subtitle: 'Common French vocabulary sounds',
        passScore: 70,
        items: [
          { id: 'p3-1', text: 'bonjour', ipa: '/bɔ̃.ʒuʁ/', meaning: 'hello', hint: 'Nasal "on", soft "zh", round "ou", throat "r"', type: 'word' },
          { id: 'p3-2', text: 'merci beaucoup', ipa: '/mɛʁ.si bo.ku/', meaning: 'thank you very much', hint: 'Merge the words smoothly. Silent "p" at the end', type: 'word' },
          { id: 'p3-3', text: 'aujourd\'hui', ipa: '/o.ʒuʁ.dɥi/', meaning: 'today', hint: 'Four syllables flowing: oh-zhoor-dwee', type: 'word' },
          { id: 'p3-4', text: 'restaurant', ipa: '/ʁɛs.to.ʁɑ̃/', meaning: 'restaurant', hint: 'Throat "r" at start and in middle, nasal ending', type: 'word' },
          { id: 'p3-5', text: 'maintenant', ipa: '/mɛ̃t.nɑ̃/', meaning: 'now', hint: 'Nasal "ain" then nasal "an" — two different nasals', type: 'word' },
        ],
      },
      {
        id: 'pron-3-2',
        title: 'Tricky Sounds',
        subtitle: 'Words that trip up English speakers',
        passScore: 70,
        items: [
          { id: 'p3-6', text: 'écureuil', ipa: '/e.ky.ʁœj/', meaning: 'squirrel', hint: 'Three syllables: ay-kü-ruhj — tight "u" in middle', type: 'word' },
          { id: 'p3-7', text: 'grenouille', ipa: '/ɡʁə.nuj/', meaning: 'frog', hint: 'GR blend, schwa, then "nooy" — silent final "e"', type: 'word' },
          { id: 'p3-8', text: 'feuille', ipa: '/fœj/', meaning: 'leaf', hint: 'One syllable: "fuh" with a "y" glide at end', type: 'word' },
          { id: 'p3-9', text: 'serrure', ipa: '/sɛ.ʁyʁ/', meaning: 'lock', hint: 'Two throat "r" sounds with tight "u" between', type: 'word' },
          { id: 'p3-10', text: 'ouvrir', ipa: '/u.vʁiʁ/', meaning: 'to open', hint: '"oo" then VR blend then tight "ee" and throat "r"', type: 'word' },
        ],
      },
      {
        id: 'pron-3-3',
        title: 'Longer Words',
        subtitle: 'Multi-syllable pronunciation flow',
        passScore: 70,
        items: [
          { id: 'p3-11', text: 'malheureusement', ipa: '/ma.lœ.ʁøz.mɑ̃/', meaning: 'unfortunately', hint: 'Five syllables — stress the last. Keep flowing', type: 'word' },
          { id: 'p3-12', text: 'environnement', ipa: '/ɑ̃.vi.ʁɔ.nə.mɑ̃/', meaning: 'environment', hint: 'Start with nasal "an", end with nasal "an"', type: 'word' },
          { id: 'p3-13', text: 'développement', ipa: '/de.vlɔp.mɑ̃/', meaning: 'development', hint: 'Silent final "ent" — just nasal "an"', type: 'word' },
          { id: 'p3-14', text: 'communication', ipa: '/kɔ.my.ni.ka.sjɔ̃/', meaning: 'communication', hint: 'Five syllables with French "u" and nasal ending', type: 'word' },
          { id: 'p3-15', text: 'extraordinaire', ipa: '/ɛks.tʁa.ɔʁ.di.nɛʁ/', meaning: 'extraordinary', hint: 'Five syllables — every "r" is from the throat', type: 'word' },
        ],
      },
    ],
  },
  {
    id: 'stage-4',
    order: 4,
    title: 'Les Expressions',
    subtitle: 'Short Phrases',
    description: 'Connect words together with natural French flow.',
    icon: '💬',
    color: '#10B981',
    lessons: [
      {
        id: 'pron-4-1',
        title: 'Common Phrases',
        subtitle: 'Everyday expressions',
        passScore: 70,
        items: [
          { id: 'p4-1', text: 'S\'il vous plaît', ipa: '/sil vu plɛ/', meaning: 'please', hint: 'Three words merged into one smooth phrase', type: 'phrase' },
          { id: 'p4-2', text: 'Excusez-moi', ipa: '/ɛks.ky.ze mwa/', meaning: 'excuse me', hint: 'French "u" in the middle, "mwa" at end', type: 'phrase' },
          { id: 'p4-3', text: 'C\'est la vie', ipa: '/sɛ la vi/', meaning: 'that\'s life', hint: 'Smooth and flowing — three short syllables', type: 'phrase' },
          { id: 'p4-4', text: 'Il fait beau', ipa: '/il fɛ bo/', meaning: 'it\'s nice weather', hint: 'Liaison: the "l" of "il" connects to "fait"', type: 'phrase' },
        ],
      },
      {
        id: 'pron-4-2',
        title: 'Connected Speech',
        subtitle: 'Liaisons and enchaînement',
        passScore: 70,
        items: [
          { id: 'p4-5', text: 'les amis', ipa: '/le.z‿a.mi/', meaning: 'the friends', hint: 'The "s" of "les" becomes "z" before the vowel', type: 'phrase' },
          { id: 'p4-6', text: 'nous avons', ipa: '/nu.z‿a.vɔ̃/', meaning: 'we have', hint: 'Connect with "z" sound: "noozavon"', type: 'phrase' },
          { id: 'p4-7', text: 'c\'est un ami', ipa: '/sɛ.t‿œ̃.n‿a.mi/', meaning: 'he\'s a friend', hint: 'Double liaison: T links to "un", N links to "ami"', type: 'phrase' },
          { id: 'p4-8', text: 'petit à petit', ipa: '/pə.ti.t‿a pə.ti/', meaning: 'little by little', hint: 'T liaison in the first "petit à", no liaison in second', type: 'phrase' },
        ],
      },
      {
        id: 'pron-4-3',
        title: 'Emotions & Questions',
        subtitle: 'Intonation patterns',
        passScore: 70,
        items: [
          { id: 'p4-9', text: 'Comment allez-vous ?', ipa: '/kɔ.mɑ̃.t‿a.le vu/', meaning: 'how are you?', hint: 'Voice rises at the end for the question', type: 'phrase' },
          { id: 'p4-10', text: 'Quelle surprise !', ipa: '/kɛl syʁ.pʁiz/', meaning: 'what a surprise!', hint: 'Animated tone — let the exclamation come through', type: 'phrase' },
          { id: 'p4-11', text: 'C\'est pas possible !', ipa: '/sɛ pa pɔ.sibl/', meaning: 'that\'s not possible!', hint: 'Express disbelief — French intonation rises then falls', type: 'phrase' },
          { id: 'p4-12', text: 'Où est la gare ?', ipa: '/u ɛ la ɡaʁ/', meaning: 'where is the station?', hint: 'Rising intonation on "gare" for the question', type: 'phrase' },
        ],
      },
    ],
  },
  {
    id: 'stage-5',
    order: 5,
    title: 'Les Phrases',
    subtitle: 'Full Sentences',
    description: 'Speak complete sentences with natural rhythm and intonation.',
    icon: '🗣️',
    color: '#F59E0B',
    lessons: [
      {
        id: 'pron-5-1',
        title: 'Simple Statements',
        subtitle: 'Declarative sentences',
        passScore: 70,
        items: [
          { id: 'p5-1', text: 'Je voudrais un café, s\'il vous plaît.', ipa: '/ʒə vu.dʁɛ œ̃ ka.fe sil vu plɛ/', meaning: 'I would like a coffee, please.', hint: 'Flow naturally — no pauses between words except at the comma', type: 'sentence' },
          { id: 'p5-2', text: 'Il fait très beau aujourd\'hui.', ipa: '/il fɛ tʁɛ bo o.ʒuʁ.dɥi/', meaning: 'The weather is very nice today.', hint: 'Liaison on "très" + keep the rhythm smooth', type: 'sentence' },
          { id: 'p5-3', text: 'Je ne comprends pas très bien.', ipa: '/ʒə nə kɔ̃.pʁɑ̃ pa tʁɛ bjɛ̃/', meaning: 'I don\'t understand very well.', hint: 'Nasal vowels in "comprends" and "bien" — keep air flowing', type: 'sentence' },
        ],
      },
      {
        id: 'pron-5-2',
        title: 'Complex Sentences',
        subtitle: 'Longer, flowing speech',
        passScore: 70,
        items: [
          { id: 'p5-4', text: 'Quand j\'étais petit, j\'aimais beaucoup jouer dans le jardin.', ipa: '/kɑ̃ ʒe.tɛ pə.ti ʒɛ.mɛ bo.ku ʒu.e dɑ̃ lə ʒaʁ.dɛ̃/', meaning: 'When I was little, I loved playing in the garden.', hint: 'Past tense rhythm — pause at the comma then continue flowing', type: 'sentence' },
          { id: 'p5-5', text: 'Si vous avez des questions, n\'hésitez pas à me demander.', ipa: '/si vu.z‿a.ve de kɛs.tjɔ̃ ne.zi.te pa a mə də.mɑ̃.de/', meaning: 'If you have questions, don\'t hesitate to ask me.', hint: 'Liaison in "vous avez" — maintain formal, polite tone', type: 'sentence' },
          { id: 'p5-6', text: 'Je pense que la France est un pays magnifique avec une culture très riche.', ipa: '/ʒə pɑ̃s kə la fʁɑ̃s ɛ.t‿œ̃ pe.i ma.ɲi.fik a.vɛk yn kyl.tyʁ tʁɛ ʁiʃ/', meaning: 'I think France is a magnificent country with a very rich culture.', hint: 'Let the sentence breathe — slight pauses at natural breaks', type: 'sentence' },
        ],
      },
      {
        id: 'pron-5-3',
        title: 'Expressive Speech',
        subtitle: 'Emotion and emphasis',
        passScore: 70,
        items: [
          { id: 'p5-7', text: 'C\'est absolument incroyable, je n\'en reviens pas !', ipa: '/sɛ.t‿ap.sɔ.ly.mɑ̃ ɛ̃.kʁwa.jabl ʒə nɑ̃ ʁə.vjɛ̃ pa/', meaning: 'It\'s absolutely incredible, I can\'t believe it!', hint: 'Express genuine amazement — French emphasis falls on final syllables', type: 'sentence' },
          { id: 'p5-8', text: 'Mais non, ce n\'est pas du tout ce que je voulais dire !', ipa: '/mɛ nɔ̃ sə nɛ pa dy tu sə kə ʒə vu.lɛ diʁ/', meaning: 'No no, that\'s not at all what I meant!', hint: 'Frustrated correction — emphasis on "pas du tout"', type: 'sentence' },
          { id: 'p5-9', text: 'Oh là là, c\'est vraiment trop gentil de votre part.', ipa: '/o la la sɛ vʁɛ.mɑ̃ tʁo ʒɑ̃.ti də vɔtʁ paʁ/', meaning: 'Oh my, that\'s really too kind of you.', hint: 'Warm, appreciative tone — "oh là là" is gentle, not panicked', type: 'sentence' },
        ],
      },
    ],
  },
  {
    id: 'stage-6',
    order: 6,
    title: 'Les Paragraphes',
    subtitle: 'Read Aloud',
    description: 'Read full paragraphs with a convincing French accent — even without knowing what it all means.',
    icon: '📃',
    color: '#EF4444',
    lessons: [
      {
        id: 'pron-6-1',
        title: 'Short Passage',
        subtitle: 'Your first paragraph',
        passScore: 70,
        items: [
          { id: 'p6-1', text: 'Bonjour, je m\'appelle Marie. J\'habite à Paris depuis trois ans. J\'aime beaucoup la ville, les cafés et les parcs.', ipa: '', meaning: 'Hello, my name is Marie. I\'ve lived in Paris for three years. I really like the city, the cafés and the parks.', hint: 'Read naturally — pause at periods, slight pause at commas. Keep the French rhythm flowing.', type: 'paragraph' },
          { id: 'p6-2', text: 'Le matin, je me lève à sept heures. Je prends mon petit déjeuner dans la cuisine. Après, je vais au travail en métro.', ipa: '', meaning: 'In the morning, I get up at seven o\'clock. I have breakfast in the kitchen. Then, I go to work by metro.', hint: 'Three sentences, each with its own rhythm. Connect words within each sentence smoothly.', type: 'paragraph' },
        ],
      },
      {
        id: 'pron-6-2',
        title: 'Descriptive Passage',
        subtitle: 'Painting a picture with sounds',
        passScore: 70,
        items: [
          { id: 'p6-3', text: 'La France est un pays magnifique avec une histoire riche et une culture fascinante. Chaque région a ses propres traditions, sa cuisine et son accent. Des montagnes des Alpes aux plages de la Côte d\'Azur, il y a toujours quelque chose à découvrir.', ipa: '', meaning: 'France is a magnificent country with a rich history and fascinating culture. Each region has its own traditions, cuisine and accent. From the mountains of the Alps to the beaches of the Côte d\'Azur, there is always something to discover.', hint: 'Longer passage — maintain consistent rhythm. Let the nasals ring and the Rs flow from your throat.', type: 'paragraph' },
          { id: 'p6-4', text: 'Le dimanche, les Français aiment se retrouver en famille pour un grand repas. On commence par l\'apéritif, puis l\'entrée, le plat principal, la salade, le fromage, et enfin le dessert. C\'est un moment de partage et de convivialité.', ipa: '', meaning: 'On Sundays, the French like to get together with family for a big meal. You start with aperitif, then the starter, the main course, the salad, the cheese, and finally dessert. It\'s a moment of sharing and conviviality.', hint: 'The list creates natural rhythm — each food item gets equal weight. Finish with warmth.', type: 'paragraph' },
        ],
      },
      {
        id: 'pron-6-3',
        title: 'Final Challenge',
        subtitle: 'Read like a native',
        passScore: 70,
        items: [
          { id: 'p6-5', text: 'Quand on apprend une nouvelle langue, le plus important n\'est pas de tout comprendre immédiatement. Il faut d\'abord s\'habituer aux sons, aux rythmes et à la mélodie de la langue. Avec le temps et la pratique, les mots commencent à avoir du sens, et un jour, on se rend compte qu\'on comprend sans même y penser. C\'est un moment magique.', ipa: '', meaning: 'When learning a new language, the most important thing isn\'t to understand everything immediately. First you need to get used to the sounds, rhythms and melody of the language. With time and practice, words start to make sense, and one day, you realize you understand without even thinking about it. It\'s a magical moment.', hint: 'The ultimate test — a full paragraph about YOUR journey. Read it with conviction and let the French sounds flow naturally from you.', type: 'paragraph' },
        ],
      },
    ],
  },
];
