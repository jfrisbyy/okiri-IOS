export interface Conjugation {
  je: string;
  tu: string;
  il: string;
  nous: string;
  vous: string;
  ils: string;
}

export interface VerbConjugations {
  infinitive: string;
  meaning: string;
  group: 'er' | 'ir' | 're' | 'irregular';
  tenses: {
    [tenseName: string]: Conjugation;
  };
}

export interface TenseInfo {
  name: string;
  frenchName: string;
  description: string;
  usage: string;
  example: string;
}

export const tenseInfo: TenseInfo[] = [
  {
    name: 'Present',
    frenchName: 'Présent',
    description: 'Actions happening now or habitual actions',
    usage: 'Daily routines, current states, general truths',
    example: 'Je parle français. (I speak French.)',
  },
  {
    name: 'Passé Composé',
    frenchName: 'Passé Composé',
    description: 'Completed past actions',
    usage: 'Single events in the past, completed actions',
    example: "J'ai mangé une pomme. (I ate an apple.)",
  },
  {
    name: 'Imparfait',
    frenchName: 'Imparfait',
    description: 'Ongoing or habitual past actions',
    usage: 'Descriptions, background, repeated past actions',
    example: 'Je mangeais souvent là. (I often ate there.)',
  },
  {
    name: 'Futur Simple',
    frenchName: 'Futur Simple',
    description: 'Future actions',
    usage: 'Plans, predictions, promises',
    example: 'Je parlerai demain. (I will speak tomorrow.)',
  },
  {
    name: 'Conditionnel',
    frenchName: 'Conditionnel Présent',
    description: 'Hypothetical or polite requests',
    usage: 'Wishes, polite requests, hypothetical situations',
    example: 'Je voudrais un café. (I would like a coffee.)',
  },
  {
    name: 'Subjonctif',
    frenchName: 'Subjonctif Présent',
    description: 'Doubt, emotion, necessity',
    usage: 'After "que" with emotions, wishes, doubt',
    example: 'Il faut que je parle. (I must speak.)',
  },
];

export const commonVerbs: VerbConjugations[] = [
  {
    infinitive: 'être',
    meaning: 'to be',
    group: 'irregular',
    tenses: {
      'Present': { je: 'suis', tu: 'es', il: 'est', nous: 'sommes', vous: 'êtes', ils: 'sont' },
      'Passé Composé': { je: 'ai été', tu: 'as été', il: 'a été', nous: 'avons été', vous: 'avez été', ils: 'ont été' },
      'Imparfait': { je: 'étais', tu: 'étais', il: 'était', nous: 'étions', vous: 'étiez', ils: 'étaient' },
      'Futur Simple': { je: 'serai', tu: 'seras', il: 'sera', nous: 'serons', vous: 'serez', ils: 'seront' },
      'Conditionnel': { je: 'serais', tu: 'serais', il: 'serait', nous: 'serions', vous: 'seriez', ils: 'seraient' },
      'Subjonctif': { je: 'sois', tu: 'sois', il: 'soit', nous: 'soyons', vous: 'soyez', ils: 'soient' },
    },
  },
  {
    infinitive: 'avoir',
    meaning: 'to have',
    group: 'irregular',
    tenses: {
      'Present': { je: 'ai', tu: 'as', il: 'a', nous: 'avons', vous: 'avez', ils: 'ont' },
      'Passé Composé': { je: 'ai eu', tu: 'as eu', il: 'a eu', nous: 'avons eu', vous: 'avez eu', ils: 'ont eu' },
      'Imparfait': { je: 'avais', tu: 'avais', il: 'avait', nous: 'avions', vous: 'aviez', ils: 'avaient' },
      'Futur Simple': { je: 'aurai', tu: 'auras', il: 'aura', nous: 'aurons', vous: 'aurez', ils: 'auront' },
      'Conditionnel': { je: 'aurais', tu: 'aurais', il: 'aurait', nous: 'aurions', vous: 'auriez', ils: 'auraient' },
      'Subjonctif': { je: 'aie', tu: 'aies', il: 'ait', nous: 'ayons', vous: 'ayez', ils: 'aient' },
    },
  },
  {
    infinitive: 'aller',
    meaning: 'to go',
    group: 'irregular',
    tenses: {
      'Present': { je: 'vais', tu: 'vas', il: 'va', nous: 'allons', vous: 'allez', ils: 'vont' },
      'Passé Composé': { je: 'suis allé(e)', tu: 'es allé(e)', il: 'est allé', nous: 'sommes allé(e)s', vous: 'êtes allé(e)(s)', ils: 'sont allés' },
      'Imparfait': { je: 'allais', tu: 'allais', il: 'allait', nous: 'allions', vous: 'alliez', ils: 'allaient' },
      'Futur Simple': { je: 'irai', tu: 'iras', il: 'ira', nous: 'irons', vous: 'irez', ils: 'iront' },
      'Conditionnel': { je: 'irais', tu: 'irais', il: 'irait', nous: 'irions', vous: 'iriez', ils: 'iraient' },
      'Subjonctif': { je: 'aille', tu: 'ailles', il: 'aille', nous: 'allions', vous: 'alliez', ils: 'aillent' },
    },
  },
  {
    infinitive: 'faire',
    meaning: 'to do/make',
    group: 'irregular',
    tenses: {
      'Present': { je: 'fais', tu: 'fais', il: 'fait', nous: 'faisons', vous: 'faites', ils: 'font' },
      'Passé Composé': { je: 'ai fait', tu: 'as fait', il: 'a fait', nous: 'avons fait', vous: 'avez fait', ils: 'ont fait' },
      'Imparfait': { je: 'faisais', tu: 'faisais', il: 'faisait', nous: 'faisions', vous: 'faisiez', ils: 'faisaient' },
      'Futur Simple': { je: 'ferai', tu: 'feras', il: 'fera', nous: 'ferons', vous: 'ferez', ils: 'feront' },
      'Conditionnel': { je: 'ferais', tu: 'ferais', il: 'ferait', nous: 'ferions', vous: 'feriez', ils: 'feraient' },
      'Subjonctif': { je: 'fasse', tu: 'fasses', il: 'fasse', nous: 'fassions', vous: 'fassiez', ils: 'fassent' },
    },
  },
  {
    infinitive: 'pouvoir',
    meaning: 'to be able to',
    group: 'irregular',
    tenses: {
      'Present': { je: 'peux', tu: 'peux', il: 'peut', nous: 'pouvons', vous: 'pouvez', ils: 'peuvent' },
      'Passé Composé': { je: 'ai pu', tu: 'as pu', il: 'a pu', nous: 'avons pu', vous: 'avez pu', ils: 'ont pu' },
      'Imparfait': { je: 'pouvais', tu: 'pouvais', il: 'pouvait', nous: 'pouvions', vous: 'pouviez', ils: 'pouvaient' },
      'Futur Simple': { je: 'pourrai', tu: 'pourras', il: 'pourra', nous: 'pourrons', vous: 'pourrez', ils: 'pourront' },
      'Conditionnel': { je: 'pourrais', tu: 'pourrais', il: 'pourrait', nous: 'pourrions', vous: 'pourriez', ils: 'pourraient' },
      'Subjonctif': { je: 'puisse', tu: 'puisses', il: 'puisse', nous: 'puissions', vous: 'puissiez', ils: 'puissent' },
    },
  },
  {
    infinitive: 'vouloir',
    meaning: 'to want',
    group: 'irregular',
    tenses: {
      'Present': { je: 'veux', tu: 'veux', il: 'veut', nous: 'voulons', vous: 'voulez', ils: 'veulent' },
      'Passé Composé': { je: 'ai voulu', tu: 'as voulu', il: 'a voulu', nous: 'avons voulu', vous: 'avez voulu', ils: 'ont voulu' },
      'Imparfait': { je: 'voulais', tu: 'voulais', il: 'voulait', nous: 'voulions', vous: 'vouliez', ils: 'voulaient' },
      'Futur Simple': { je: 'voudrai', tu: 'voudras', il: 'voudra', nous: 'voudrons', vous: 'voudrez', ils: 'voudront' },
      'Conditionnel': { je: 'voudrais', tu: 'voudrais', il: 'voudrait', nous: 'voudrions', vous: 'voudriez', ils: 'voudraient' },
      'Subjonctif': { je: 'veuille', tu: 'veuilles', il: 'veuille', nous: 'voulions', vous: 'vouliez', ils: 'veuillent' },
    },
  },
  {
    infinitive: 'savoir',
    meaning: 'to know',
    group: 'irregular',
    tenses: {
      'Present': { je: 'sais', tu: 'sais', il: 'sait', nous: 'savons', vous: 'savez', ils: 'savent' },
      'Passé Composé': { je: 'ai su', tu: 'as su', il: 'a su', nous: 'avons su', vous: 'avez su', ils: 'ont su' },
      'Imparfait': { je: 'savais', tu: 'savais', il: 'savait', nous: 'savions', vous: 'saviez', ils: 'savaient' },
      'Futur Simple': { je: 'saurai', tu: 'sauras', il: 'saura', nous: 'saurons', vous: 'saurez', ils: 'sauront' },
      'Conditionnel': { je: 'saurais', tu: 'saurais', il: 'saurait', nous: 'saurions', vous: 'sauriez', ils: 'sauraient' },
      'Subjonctif': { je: 'sache', tu: 'saches', il: 'sache', nous: 'sachions', vous: 'sachiez', ils: 'sachent' },
    },
  },
  {
    infinitive: 'venir',
    meaning: 'to come',
    group: 'irregular',
    tenses: {
      'Present': { je: 'viens', tu: 'viens', il: 'vient', nous: 'venons', vous: 'venez', ils: 'viennent' },
      'Passé Composé': { je: 'suis venu(e)', tu: 'es venu(e)', il: 'est venu', nous: 'sommes venu(e)s', vous: 'êtes venu(e)(s)', ils: 'sont venus' },
      'Imparfait': { je: 'venais', tu: 'venais', il: 'venait', nous: 'venions', vous: 'veniez', ils: 'venaient' },
      'Futur Simple': { je: 'viendrai', tu: 'viendras', il: 'viendra', nous: 'viendrons', vous: 'viendrez', ils: 'viendront' },
      'Conditionnel': { je: 'viendrais', tu: 'viendrais', il: 'viendrait', nous: 'viendrions', vous: 'viendriez', ils: 'viendraient' },
      'Subjonctif': { je: 'vienne', tu: 'viennes', il: 'vienne', nous: 'venions', vous: 'veniez', ils: 'viennent' },
    },
  },
  {
    infinitive: 'prendre',
    meaning: 'to take',
    group: 're',
    tenses: {
      'Present': { je: 'prends', tu: 'prends', il: 'prend', nous: 'prenons', vous: 'prenez', ils: 'prennent' },
      'Passé Composé': { je: 'ai pris', tu: 'as pris', il: 'a pris', nous: 'avons pris', vous: 'avez pris', ils: 'ont pris' },
      'Imparfait': { je: 'prenais', tu: 'prenais', il: 'prenait', nous: 'prenions', vous: 'preniez', ils: 'prenaient' },
      'Futur Simple': { je: 'prendrai', tu: 'prendras', il: 'prendra', nous: 'prendrons', vous: 'prendrez', ils: 'prendront' },
      'Conditionnel': { je: 'prendrais', tu: 'prendrais', il: 'prendrait', nous: 'prendrions', vous: 'prendriez', ils: 'prendraient' },
      'Subjonctif': { je: 'prenne', tu: 'prennes', il: 'prenne', nous: 'prenions', vous: 'preniez', ils: 'prennent' },
    },
  },
  {
    infinitive: 'parler',
    meaning: 'to speak',
    group: 'er',
    tenses: {
      'Present': { je: 'parle', tu: 'parles', il: 'parle', nous: 'parlons', vous: 'parlez', ils: 'parlent' },
      'Passé Composé': { je: 'ai parlé', tu: 'as parlé', il: 'a parlé', nous: 'avons parlé', vous: 'avez parlé', ils: 'ont parlé' },
      'Imparfait': { je: 'parlais', tu: 'parlais', il: 'parlait', nous: 'parlions', vous: 'parliez', ils: 'parlaient' },
      'Futur Simple': { je: 'parlerai', tu: 'parleras', il: 'parlera', nous: 'parlerons', vous: 'parlerez', ils: 'parleront' },
      'Conditionnel': { je: 'parlerais', tu: 'parlerais', il: 'parlerait', nous: 'parlerions', vous: 'parleriez', ils: 'parleraient' },
      'Subjonctif': { je: 'parle', tu: 'parles', il: 'parle', nous: 'parlions', vous: 'parliez', ils: 'parlent' },
    },
  },
  {
    infinitive: 'manger',
    meaning: 'to eat',
    group: 'er',
    tenses: {
      'Present': { je: 'mange', tu: 'manges', il: 'mange', nous: 'mangeons', vous: 'mangez', ils: 'mangent' },
      'Passé Composé': { je: 'ai mangé', tu: 'as mangé', il: 'a mangé', nous: 'avons mangé', vous: 'avez mangé', ils: 'ont mangé' },
      'Imparfait': { je: 'mangeais', tu: 'mangeais', il: 'mangeait', nous: 'mangions', vous: 'mangiez', ils: 'mangeaient' },
      'Futur Simple': { je: 'mangerai', tu: 'mangeras', il: 'mangera', nous: 'mangerons', vous: 'mangerez', ils: 'mangeront' },
      'Conditionnel': { je: 'mangerais', tu: 'mangerais', il: 'mangerait', nous: 'mangerions', vous: 'mangeriez', ils: 'mangeraient' },
      'Subjonctif': { je: 'mange', tu: 'manges', il: 'mange', nous: 'mangions', vous: 'mangiez', ils: 'mangent' },
    },
  },
  {
    infinitive: 'finir',
    meaning: 'to finish',
    group: 'ir',
    tenses: {
      'Present': { je: 'finis', tu: 'finis', il: 'finit', nous: 'finissons', vous: 'finissez', ils: 'finissent' },
      'Passé Composé': { je: 'ai fini', tu: 'as fini', il: 'a fini', nous: 'avons fini', vous: 'avez fini', ils: 'ont fini' },
      'Imparfait': { je: 'finissais', tu: 'finissais', il: 'finissait', nous: 'finissions', vous: 'finissiez', ils: 'finissaient' },
      'Futur Simple': { je: 'finirai', tu: 'finiras', il: 'finira', nous: 'finirons', vous: 'finirez', ils: 'finiront' },
      'Conditionnel': { je: 'finirais', tu: 'finirais', il: 'finirait', nous: 'finirions', vous: 'finiriez', ils: 'finiraient' },
      'Subjonctif': { je: 'finisse', tu: 'finisses', il: 'finisse', nous: 'finissions', vous: 'finissiez', ils: 'finissent' },
    },
  },
];

export const pronouns = ['je', 'tu', 'il/elle/on', 'nous', 'vous', 'ils/elles'] as const;
export const pronounKeys = ['je', 'tu', 'il', 'nous', 'vous', 'ils'] as const;
