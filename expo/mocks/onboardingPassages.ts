import { UserLevel } from '@/types';

export interface OnboardingPassage {
  level: UserLevel;
  title: string;
  french: string;
  englishFull: string;
  vocabulary: OnboardingWord[];
}

export interface OnboardingWord {
  french: string;
  english: string;
  explanation: string;
  exampleSentence: string;
  exampleTranslation: string;
  distractors: string[];
}

const nonePassage: OnboardingPassage = {
  level: 'none',
  title: 'Bienvenue',
  french: `Bonjour ! Bienvenue dans Okiri. Je suis votre guide pour apprendre le français. Chaque jour, vous allez lire, écouter et parler un peu. Ne vous inquiétez pas si vous ne comprenez pas tout. C'est normal ! Ensemble, nous allons découvrir le français pas à pas. Êtes-vous prêt ? Allons-y !`,
  englishFull: `Hello! Welcome to Okiri. I am your guide for learning French. Every day, you will read, listen and speak a little. Don't worry if you don't understand everything. That's normal! Together, we are going to discover French step by step. Are you ready? Let's go!`,
  vocabulary: [
    {
      french: 'Bonjour',
      english: 'Hello / Good day',
      explanation: 'The standard French greeting used during daytime.',
      exampleSentence: 'Bonjour, comment allez-vous ?',
      exampleTranslation: 'Hello, how are you?',
      distractors: ['Goodbye', 'Thank you', 'Please'],
    },
    {
      french: 'Bienvenue',
      english: 'Welcome',
      explanation: 'Used to greet someone arriving at a place.',
      exampleSentence: 'Bienvenue en France !',
      exampleTranslation: 'Welcome to France!',
      distractors: ['Farewell', 'Sorry', 'Excuse me'],
    },
    {
      french: 'apprendre',
      english: 'to learn',
      explanation: 'A common verb meaning to learn or to study something new.',
      exampleSentence: "J'aime apprendre de nouvelles choses.",
      exampleTranslation: 'I like to learn new things.',
      distractors: ['to teach', 'to forget', 'to read'],
    },
    {
      french: 'Chaque',
      english: 'Each / Every',
      explanation: 'An adjective meaning each or every, used before nouns.',
      exampleSentence: 'Chaque matin, je bois un café.',
      exampleTranslation: 'Every morning, I drink a coffee.',
      distractors: ['Some', 'No', 'Which'],
    },
    {
      french: 'jour',
      english: 'day',
      explanation: 'A masculine noun meaning day.',
      exampleSentence: "C'est un beau jour.",
      exampleTranslation: 'It is a beautiful day.',
      distractors: ['night', 'week', 'hour'],
    },
    {
      french: 'lire',
      english: 'to read',
      explanation: 'An irregular French verb meaning to read.',
      exampleSentence: "J'aime lire des livres.",
      exampleTranslation: 'I like to read books.',
      distractors: ['to write', 'to speak', 'to sing'],
    },
    {
      french: 'écouter',
      english: 'to listen',
      explanation: 'A regular -er verb meaning to listen to.',
      exampleSentence: "J'écoute de la musique.",
      exampleTranslation: 'I listen to music.',
      distractors: ['to watch', 'to hear', 'to talk'],
    },
    {
      french: 'parler',
      english: 'to speak',
      explanation: 'A regular -er verb meaning to speak or talk.',
      exampleSentence: 'Elle parle français couramment.',
      exampleTranslation: 'She speaks French fluently.',
      distractors: ['to whisper', 'to shout', 'to write'],
    },
    {
      french: 'inquiétez',
      english: 'worry',
      explanation: "From 's'inquiéter' — a reflexive verb meaning to worry. 'Ne vous inquiétez pas' means 'don't worry'.",
      exampleSentence: 'Ne vous inquiétez pas, tout va bien.',
      exampleTranslation: "Don't worry, everything is fine.",
      distractors: ['hurry', 'forget', 'remember'],
    },
    {
      french: 'comprenez',
      english: 'understand',
      explanation: "From 'comprendre' — an irregular verb meaning to understand. 'Vous comprenez' = you understand.",
      exampleSentence: 'Vous comprenez le français ?',
      exampleTranslation: 'Do you understand French?',
      distractors: ['speak', 'forget', 'repeat'],
    },
    {
      french: 'tout',
      english: 'everything / all',
      explanation: 'Can mean everything, all, or entirely depending on context.',
      exampleSentence: 'Je comprends tout maintenant.',
      exampleTranslation: 'I understand everything now.',
      distractors: ['nothing', 'some', 'never'],
    },
    {
      french: 'normal',
      english: 'normal / natural',
      explanation: "Same as English! Used in French the same way. \"C'est normal\" = it's normal/expected.",
      exampleSentence: "C'est tout à fait normal.",
      exampleTranslation: "It's perfectly normal.",
      distractors: ['strange', 'difficult', 'impossible'],
    },
    {
      french: 'Ensemble',
      english: 'Together',
      explanation: 'An adverb meaning together or jointly.',
      exampleSentence: 'Nous travaillons ensemble.',
      exampleTranslation: 'We work together.',
      distractors: ['Alone', 'Apart', 'Sometimes'],
    },
    {
      french: 'découvrir',
      english: 'to discover',
      explanation: 'An irregular verb meaning to discover, uncover, or find out.',
      exampleSentence: "J'adore découvrir de nouveaux endroits.",
      exampleTranslation: 'I love discovering new places.',
      distractors: ['to hide', 'to cover', 'to lose'],
    },
    {
      french: 'prêt',
      english: 'ready',
      explanation: "An adjective meaning ready or prepared. 'Êtes-vous prêt ?' = Are you ready?",
      exampleSentence: 'Je suis prêt à partir.',
      exampleTranslation: "I'm ready to leave.",
      distractors: ['tired', 'late', 'hungry'],
    },
    {
      french: 'Allons-y',
      english: "Let's go!",
      explanation: "An expression meaning 'let's go' or 'let's do it'. Very common in spoken French.",
      exampleSentence: "C'est l'heure, allons-y !",
      exampleTranslation: "It's time, let's go!",
      distractors: ['Stop!', 'Wait!', 'Come back!'],
    },
  ],
};

const basicsPassage: OnboardingPassage = {
  level: 'basics',
  title: 'Votre aventure commence',
  french: `Bonjour et bienvenue ! Vous avez décidé d'apprendre le français — c'est une excellente idée. Avec Okiri, vous allez progresser en lisant des textes authentiques et en pratiquant chaque jour. Quand vous rencontrez un mot que vous ne connaissez pas, touchez-le simplement. Nous transformerons vos difficultés en leçons personnalisées. Au fil du temps, vous remarquerez que vous comprenez de plus en plus. N'hésitez pas à faire des erreurs — c'est comme ça qu'on apprend ! Commençons votre première leçon maintenant.`,
  englishFull: `Hello and welcome! You have decided to learn French — that's an excellent idea. With Okiri, you will progress by reading authentic texts and practicing every day. When you encounter a word you don't know, simply touch it. We will transform your difficulties into personalized lessons. Over time, you will notice that you understand more and more. Don't hesitate to make mistakes — that's how you learn! Let's start your first lesson now.`,
  vocabulary: [
    {
      french: 'décidé',
      english: 'decided',
      explanation: "Past participle of 'décider' — to decide. Used with 'avoir' to form the past tense.",
      exampleSentence: "J'ai décidé de rester.",
      exampleTranslation: 'I decided to stay.',
      distractors: ['forgotten', 'refused', 'promised'],
    },
    {
      french: 'excellente',
      english: 'excellent',
      explanation: 'An adjective meaning excellent. Uses the feminine form here because it agrees with "idée" (feminine).',
      exampleSentence: "C'est une excellente nouvelle !",
      exampleTranslation: "That's excellent news!",
      distractors: ['terrible', 'ordinary', 'small'],
    },
    {
      french: 'progresser',
      english: 'to progress / improve',
      explanation: 'A regular -er verb meaning to make progress or advance.',
      exampleSentence: 'Tu vas progresser rapidement.',
      exampleTranslation: 'You will progress quickly.',
      distractors: ['to regress', 'to stop', 'to rest'],
    },
    {
      french: 'authentiques',
      english: 'authentic / genuine',
      explanation: 'An adjective meaning authentic or real. Same in English!',
      exampleSentence: 'Ce sont des produits authentiques.',
      exampleTranslation: 'These are authentic products.',
      distractors: ['fake', 'simple', 'modern'],
    },
    {
      french: 'pratiquant',
      english: 'practicing',
      explanation: "Present participle of 'pratiquer'. 'En pratiquant' = by practicing.",
      exampleSentence: "En pratiquant, on s'améliore.",
      exampleTranslation: 'By practicing, we improve.',
      distractors: ['forgetting', 'avoiding', 'watching'],
    },
    {
      french: 'rencontrez',
      english: 'encounter / meet',
      explanation: "From 'rencontrer' — to meet or encounter. 'Vous rencontrez' = you encounter.",
      exampleSentence: "Quand vous rencontrez un problème, demandez de l'aide.",
      exampleTranslation: 'When you encounter a problem, ask for help.',
      distractors: ['avoid', 'forget', 'create'],
    },
    {
      french: 'connaissez',
      english: 'know (are familiar with)',
      explanation: "From 'connaître' — to know/be familiar with (people, places, things). Different from 'savoir' (to know facts).",
      exampleSentence: 'Vous connaissez cette chanson ?',
      exampleTranslation: 'Do you know this song?',
      distractors: ['ignore', 'dislike', 'remember'],
    },
    {
      french: 'touchez',
      english: 'touch / tap',
      explanation: "From 'toucher' — to touch. Imperative form: 'touchez-le' = touch it.",
      exampleSentence: "Touchez l'écran pour continuer.",
      exampleTranslation: 'Touch the screen to continue.',
      distractors: ['release', 'shake', 'break'],
    },
    {
      french: 'simplement',
      english: 'simply',
      explanation: "Adverb formed from 'simple' + -ment (like English -ly).",
      exampleSentence: 'Dites-le simplement.',
      exampleTranslation: 'Say it simply.',
      distractors: ['quickly', 'loudly', 'rarely'],
    },
    {
      french: 'transformerons',
      english: 'will transform',
      explanation: "Future tense of 'transformer'. 'Nous transformerons' = we will transform.",
      exampleSentence: 'Nous transformerons ce projet.',
      exampleTranslation: 'We will transform this project.',
      distractors: ['will destroy', 'will hide', 'will keep'],
    },
    {
      french: 'difficultés',
      english: 'difficulties / challenges',
      explanation: 'Feminine plural noun meaning difficulties or challenges.',
      exampleSentence: 'Les difficultés nous rendent plus forts.',
      exampleTranslation: 'Difficulties make us stronger.',
      distractors: ['successes', 'memories', 'habits'],
    },
    {
      french: 'personnalisées',
      english: 'personalized',
      explanation: 'Adjective meaning personalized or customized. Feminine plural form.',
      exampleSentence: 'Des leçons personnalisées pour vous.',
      exampleTranslation: 'Personalized lessons for you.',
      distractors: ['generic', 'random', 'shared'],
    },
    {
      french: 'Au fil du temps',
      english: 'Over time',
      explanation: "An idiomatic expression meaning 'over time' or 'as time goes by'.",
      exampleSentence: 'Au fil du temps, tout devient plus facile.',
      exampleTranslation: 'Over time, everything becomes easier.',
      distractors: ['Right now', 'Never again', 'Once upon a time'],
    },
    {
      french: 'remarquerez',
      english: 'will notice',
      explanation: "Future tense of 'remarquer' — to notice or observe.",
      exampleSentence: 'Vous remarquerez la différence.',
      exampleTranslation: 'You will notice the difference.',
      distractors: ['will ignore', 'will forget', 'will deny'],
    },
    {
      french: 'hésitez',
      english: 'hesitate',
      explanation: "From 'hésiter' — to hesitate. 'N'hésitez pas' = don't hesitate.",
      exampleSentence: "N'hésitez pas à poser des questions.",
      exampleTranslation: "Don't hesitate to ask questions.",
      distractors: ['rush', 'refuse', 'agree'],
    },
    {
      french: 'erreurs',
      english: 'mistakes / errors',
      explanation: 'Feminine plural noun meaning mistakes or errors.',
      exampleSentence: 'Faire des erreurs est humain.',
      exampleTranslation: 'Making mistakes is human.',
      distractors: ['successes', 'choices', 'rules'],
    },
    {
      french: 'Commençons',
      english: "Let's start",
      explanation: "First person plural imperative of 'commencer' — to start. Means 'let's begin'.",
      exampleSentence: 'Commençons le travail !',
      exampleTranslation: "Let's start the work!",
      distractors: ["Let's stop", "Let's wait", "Let's leave"],
    },
  ],
};

const simpleTextsPassage: OnboardingPassage = {
  level: 'simple_texts',
  title: 'Un nouveau chapitre',
  french: `Félicitations ! Vous maîtrisez déjà les bases du français, ce qui est formidable. Avec Okiri, nous allons aller plus loin ensemble. Notre approche est différente : au lieu de suivre un programme rigide, nous vous proposons des lectures variées — articles, dialogues, histoires — et nous identifions précisément là où vous butez. Ces points faibles deviennent alors vos leçons prioritaires. C'est ainsi que l'apprentissage devient vraiment efficace. Vous serez surpris de voir à quel point cette méthode accélère vos progrès. Prêt à relever le défi ? Montrez-nous ce que vous savez déjà !`,
  englishFull: `Congratulations! You already master the basics of French, which is wonderful. With Okiri, we are going to go further together. Our approach is different: instead of following a rigid program, we offer you varied readings — articles, dialogues, stories — and we precisely identify where you stumble. These weak points then become your priority lessons. This is how learning becomes truly effective. You will be surprised to see how much this method accelerates your progress. Ready to take on the challenge? Show us what you already know!`,
  vocabulary: [
    {
      french: 'Félicitations',
      english: 'Congratulations',
      explanation: 'An exclamation used to congratulate someone.',
      exampleSentence: 'Félicitations pour votre succès !',
      exampleTranslation: 'Congratulations on your success!',
      distractors: ['Apologies', 'Greetings', 'Condolences'],
    },
    {
      french: 'maîtrisez',
      english: 'master / have mastery of',
      explanation: "From 'maîtriser' — to master or to have control over.",
      exampleSentence: 'Vous maîtrisez bien ce sujet.',
      exampleTranslation: 'You have a good mastery of this subject.',
      distractors: ['struggle with', 'avoid', 'ignore'],
    },
    {
      french: 'formidable',
      english: 'wonderful / great',
      explanation: "In French, 'formidable' means wonderful or amazing — not 'fearsome' like in English.",
      exampleSentence: "C'est un résultat formidable !",
      exampleTranslation: "That's a wonderful result!",
      distractors: ['terrible', 'ordinary', 'frightening'],
    },
    {
      french: 'approche',
      english: 'approach / method',
      explanation: 'A feminine noun meaning approach, method, or way of doing things.',
      exampleSentence: "Notre approche est innovante.",
      exampleTranslation: 'Our approach is innovative.',
      distractors: ['exit', 'problem', 'distance'],
    },
    {
      french: 'au lieu de',
      english: 'instead of',
      explanation: "A common phrase meaning 'instead of' or 'in place of'.",
      exampleSentence: 'Au lieu de dormir, il étudie.',
      exampleTranslation: 'Instead of sleeping, he studies.',
      distractors: ['because of', 'in addition to', 'thanks to'],
    },
    {
      french: 'suivre',
      english: 'to follow',
      explanation: 'An irregular verb meaning to follow, to attend, or to take (a course).',
      exampleSentence: 'Je vais suivre ce cours.',
      exampleTranslation: "I'm going to take this course.",
      distractors: ['to leave', 'to avoid', 'to lead'],
    },
    {
      french: 'rigide',
      english: 'rigid / strict',
      explanation: 'An adjective meaning rigid, strict, or inflexible.',
      exampleSentence: 'Les règles sont trop rigides.',
      exampleTranslation: 'The rules are too rigid.',
      distractors: ['flexible', 'simple', 'popular'],
    },
    {
      french: 'proposons',
      english: 'offer / suggest',
      explanation: "From 'proposer' — to propose, offer, or suggest. 'Nous proposons' = we offer.",
      exampleSentence: 'Nous vous proposons une solution.',
      exampleTranslation: 'We offer you a solution.',
      distractors: ['demand', 'refuse', 'hide'],
    },
    {
      french: 'variées',
      english: 'varied / diverse',
      explanation: 'Adjective meaning varied or diverse. Feminine plural form.',
      exampleSentence: 'Des activités variées pour tous.',
      exampleTranslation: 'Varied activities for everyone.',
      distractors: ['identical', 'boring', 'limited'],
    },
    {
      french: 'identifions',
      english: 'identify',
      explanation: "From 'identifier' — to identify. 'Nous identifions' = we identify.",
      exampleSentence: 'Nous identifions les problèmes rapidement.',
      exampleTranslation: 'We identify problems quickly.',
      distractors: ['ignore', 'create', 'hide'],
    },
    {
      french: 'précisément',
      english: 'precisely / exactly',
      explanation: "Adverb meaning precisely. Formed from 'précis' + -ment.",
      exampleSentence: "C'est précisément ce que je voulais dire.",
      exampleTranslation: "That's precisely what I meant.",
      distractors: ['roughly', 'barely', 'rarely'],
    },
    {
      french: 'butez',
      english: 'stumble / get stuck',
      explanation: "From 'buter' — to stumble or get stuck on something. Colloquial usage.",
      exampleSentence: 'Là où vous butez, nous vous aidons.',
      exampleTranslation: 'Where you stumble, we help you.',
      distractors: ['succeed', 'rush', 'skip'],
    },
    {
      french: 'points faibles',
      english: 'weak points / weaknesses',
      explanation: "A common expression meaning weak points. 'Point' = point, 'faible' = weak.",
      exampleSentence: 'Travaillez sur vos points faibles.',
      exampleTranslation: 'Work on your weak points.',
      distractors: ['strong suits', 'main ideas', 'bad habits'],
    },
    {
      french: 'prioritaires',
      english: 'priority / high-priority',
      explanation: 'Adjective meaning having priority or being of primary importance.',
      exampleSentence: 'Ce sont des tâches prioritaires.',
      exampleTranslation: 'These are priority tasks.',
      distractors: ['optional', 'secondary', 'forbidden'],
    },
    {
      french: 'apprentissage',
      english: 'learning / the learning process',
      explanation: 'A masculine noun meaning learning or the process of learning.',
      exampleSentence: "L'apprentissage demande de la patience.",
      exampleTranslation: 'Learning requires patience.',
      distractors: ['forgetting', 'teaching', 'entertainment'],
    },
    {
      french: 'efficace',
      english: 'effective / efficient',
      explanation: 'An adjective meaning effective or efficient.',
      exampleSentence: "C'est une méthode très efficace.",
      exampleTranslation: "It's a very effective method.",
      distractors: ['useless', 'slow', 'complicated'],
    },
    {
      french: 'surpris',
      english: 'surprised',
      explanation: "Past participle of 'surprendre' — to surprise. Also used as an adjective.",
      exampleSentence: 'Je suis surpris par le résultat.',
      exampleTranslation: "I'm surprised by the result.",
      distractors: ['bored', 'disappointed', 'confused'],
    },
    {
      french: 'accélère',
      english: 'accelerates / speeds up',
      explanation: "From 'accélérer' — to accelerate or speed up.",
      exampleSentence: "La technologie accélère l'apprentissage.",
      exampleTranslation: 'Technology speeds up learning.',
      distractors: ['slows down', 'stops', 'complicates'],
    },
    {
      french: 'relever le défi',
      english: 'take on the challenge',
      explanation: "An expression meaning to take on or accept a challenge. 'Relever' = to take up, 'défi' = challenge.",
      exampleSentence: 'Es-tu prêt à relever le défi ?',
      exampleTranslation: 'Are you ready to take on the challenge?',
      distractors: ['give up', 'run away', 'ignore the problem'],
    },
  ],
};

export function getOnboardingPassage(level: UserLevel): OnboardingPassage {
  switch (level) {
    case 'none':
      return nonePassage;
    case 'basics':
      return basicsPassage;
    case 'simple_texts':
      return simpleTextsPassage;
    default:
      return nonePassage;
  }
}

export function generateQuizQuestions(words: OnboardingWord[]): QuizQuestion[] {
  const questions: QuizQuestion[] = [];

  for (const word of words) {
    questions.push({
      id: `mc-${word.french}`,
      type: 'multiple_choice',
      question: `What does "${word.french}" mean?`,
      correctAnswer: word.english,
      choices: shuffleArray([word.english, ...word.distractors.slice(0, 3)]),
      hint: word.explanation,
      wordFrench: word.french,
    });
  }

  for (const word of words) {
    questions.push({
      id: `trans-${word.french}`,
      type: 'translation',
      question: `Translate: "${word.exampleSentence}"`,
      correctAnswer: word.exampleTranslation,
      hint: `"${word.french}" means "${word.english}"`,
      wordFrench: word.french,
    });
  }

  const mixed = shuffleArray(questions);

  const seen = new Set<string>();
  const unique: QuizQuestion[] = [];
  for (const q of mixed) {
    const key = `${q.type}-${q.wordFrench}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(q);
    }
  }

  return unique;
}

export interface QuizQuestion {
  id: string;
  type: 'multiple_choice' | 'translation';
  question: string;
  correctAnswer: string;
  choices?: string[];
  hint?: string;
  wordFrench: string;
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
