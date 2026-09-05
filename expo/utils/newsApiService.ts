import { RawNewsArticle } from '@/utils/perplexity';

const EVENT_REGISTRY_BASE = 'https://eventregistry.org/api/v1';

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  politics: ['politique', 'gouvernement', 'élection', 'parlement', 'ministre', 'président', 'loi', 'sénat'],
  culture: ['culture', 'art', 'musique', 'cinéma', 'festival', 'théâtre', 'exposition', 'livre'],
  sports: ['football', 'rugby', 'tennis', 'sport', 'match', 'champion', 'ligue', 'coupe', 'olympi'],
  science: ['scientifique', 'recherche', 'découverte', 'espace', 'médecine', 'étude', 'vaccin'],
  economy: ['économie', 'finance', 'banque', 'emploi', 'entreprise', 'marché', 'inflation', 'bourse'],
  technology: ['technologie', 'numérique', 'intelligence artificielle', 'startup', 'cyber', 'robot'],
  environment: ['environnement', 'climat', 'écologie', 'pollution', 'énergie', 'durable', 'carbone'],
  society: ['société', 'éducation', 'santé', 'immigration', 'sécurité', 'justice', 'hôpital', 'école'],
};

const CATEGORY_ER_URIS: Record<string, string[]> = {
  politics: ['news/Politics'],
  sports: ['news/Sports'],
  economy: ['news/Business'],
  technology: ['news/Technology'],
  science: ['news/Science'],
  culture: ['news/Arts_and_Entertainment'],
  environment: ['news/Environment'],
  society: ['news/Health', 'news/Education'],
};

const REGION_SOURCE_URIS: Record<string, string[]> = {
  africa: [
    'rfi.fr',
    'jeuneafrique.com',
    'lemonde.fr',
    'lesoleil.sn',
    'seneweb.com',
    'dakaractu.com',
    'apanews.net',
    'cameroon-tribune.cm',
    'journalducameroun.com',
    'camerounweb.com',
    'fratmat.info',
    'abidjan.net',
    'linfodrome.com',
    'radiookapi.net',
    'actualite.cd',
    'mediacongo.net',
    'leaders.com.tn',
    'webmanagercenter.com',
    'tsa-algerie.com',
    'elwatan.com',
    'maliweb.net',
    'bamada.net',
    'lefaso.net',
    'madagascar-tribune.com',
    'midi-madagasikara.mg',
    'guinee360.com',
    'guineenews.org',
    'anp.ne',
    'niameyetles2jours.com',
    'alwihdainfo.com',
    'tchadinfos.com',
    'gabonreview.com',
    'togofirst.com',
    'republicoftogo.com',
    'lanouvelletribune.info',
    'beninwebtv.com',
    'africa1.com',
    'afrik.com',
    'africanews.com',
    'voaafrique.com',
    'lemonde.fr',
    'france24.com',
    'tv5monde.com',
    'slateafrique.com',
    'koaci.com',
    'connection.media',
    'financialafrik.com',
    'agenceecofin.com',
    'aib.media',
    'lequotidien.sn',
    'rewmi.com',
    'infomediaire.net',
    'hespress.com',
    'le360.ma',
    'medias24.com',
    'blfrondaison.com',
    'malijet.com',
    'journaldumali.com',
  ],
  caribbean: [
    'lenouvelliste.com',
    'haitilibre.com',
    'alterpresse.org',
    'loophaiti.com',
    'martinique.franceantilles.fr',
    'guadeloupe.franceantilles.fr',
    'franceantilles.fr',
    'la1ere.francetvinfo.fr',
    'rci.fm',
    'guadeloupe.orange.fr',
    'guyane.franceantilles.fr',
    'outremers360.com',
    'france24.com',
    'rfi.fr',
    'domactu.com',
    'caribbeannewsglobal.com',
    'zinfos974.com',
    'ipreunion.com',
    'linfo.re',
    'clicanoo.re',
  ],
  canada: [
    'ici.radio-canada.ca',
    'radio-canada.ca',
    'lapresse.ca',
    'ledevoir.com',
    'journaldemontreal.com',
    'journaldequebec.com',
    'tvanouvelles.ca',
    'lametropole.com',
    'lactualite.com',
    'lesoleil.com',
    'ledroit.com',
    'latribune.ca',
    'rcinet.ca',
    'onfr.tfo.org',
    'lereflet.qc.ca',
    'lanouvelle.net',
    'lecourrierdusud.ca',
    'lejournaldesainthubert.com',
    'fm93.com',
    'cogeco.ca',
    'sympatico.ca',
    'meteomedia.com',
    'fr.canoe.ca',
    'noovo.info',
    'msn.com',
  ],
};

const REGION_SOURCE_LOCATIONS: Record<string, string[]> = {
  africa: [
    'http://en.wikipedia.org/wiki/Senegal',
    'http://en.wikipedia.org/wiki/Morocco',
    'http://en.wikipedia.org/wiki/Cameroon',
    'http://en.wikipedia.org/wiki/Ivory_Coast',
    'http://en.wikipedia.org/wiki/Democratic_Republic_of_the_Congo',
    'http://en.wikipedia.org/wiki/Tunisia',
    'http://en.wikipedia.org/wiki/Algeria',
    'http://en.wikipedia.org/wiki/Mali',
    'http://en.wikipedia.org/wiki/Burkina_Faso',
    'http://en.wikipedia.org/wiki/Madagascar',
    'http://en.wikipedia.org/wiki/Guinea',
    'http://en.wikipedia.org/wiki/Niger',
    'http://en.wikipedia.org/wiki/Chad',
    'http://en.wikipedia.org/wiki/Gabon',
    'http://en.wikipedia.org/wiki/Togo',
    'http://en.wikipedia.org/wiki/Benin',
  ],
  caribbean: [
    'http://en.wikipedia.org/wiki/Haiti',
    'http://en.wikipedia.org/wiki/Martinique',
    'http://en.wikipedia.org/wiki/Guadeloupe',
    'http://en.wikipedia.org/wiki/French_Guiana',
  ],
  canada: [
    'http://en.wikipedia.org/wiki/Canada',
    'http://en.wikipedia.org/wiki/Quebec',
  ],
};

const REGION_KEYWORDS: Record<string, string[]> = {
  africa: ['Afrique', 'Sénégal', 'Maroc', 'Cameroun', 'Côte d\'Ivoire', 'Congo', 'Tunisie', 'Algérie', 'Mali', 'Burkina', 'Madagascar', 'Guinée', 'Niger', 'Tchad', 'Gabon', 'Togo', 'Bénin', 'Dakar', 'Abidjan', 'Yaoundé'],
  caribbean: ['Haïti', 'Martinique', 'Guadeloupe', 'Guyane', 'Antilles', 'Caraïbes', 'Port-au-Prince', 'Fort-de-France'],
  canada: ['Québec', 'Canada', 'Montréal', 'Ottawa', 'canadien', 'québécois', 'Radio-Canada', 'Toronto'],
};

const _REGION_FORCED_LABELS: Record<string, string> = {
  africa: 'Africa',
  caribbean: 'Caribbean',
  canada: 'Canada',
};

function generateArticleId(headline: string, source: string): string {
  const str = `${headline}-${source}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function inferCategory(title: string, description: string): string {
  const text = `${title} ${description}`.toLowerCase();

  const categorySignals: Record<string, string[]> = {
    sports: ['football', 'rugby', 'tennis', 'sport', 'ligue', 'match', 'champion', 'olympi', 'coupe', 'joueur', 'équipe', 'goal', 'finale'],
    technology: ['tech', 'numérique', 'intelligence artificielle', 'ia ', ' ai ', 'startup', 'app', 'cyber', 'logiciel', 'données', 'robot', 'algorithme'],
    science: ['scientifique', 'recherche', 'étude', 'découverte', 'espace', 'nasa', 'climat', 'médecine', 'vaccin', 'adn'],
    environment: ['environnement', 'climat', 'écolog', 'pollution', 'carbone', 'renouvelable', 'biodiversité', 'réchauffement', 'durable'],
    economy: ['économi', 'financ', 'banque', 'bourse', 'emploi', 'entreprise', 'marché', 'inflation', 'croissance', 'budget', 'dette', 'euro', 'pib'],
    politics: ['politi', 'gouvernement', 'président', 'ministre', 'parlement', 'élection', 'sénat', 'assemblée', 'macron', 'réforme', 'loi', 'démocratie'],
    culture: ['culture', 'cinéma', 'film', 'musique', 'art', 'exposition', 'festival', 'livre', 'théâtre', 'musée', 'concert', 'littérature'],
    society: ['société', 'éducation', 'santé', 'hôpital', 'école', 'logement', 'justice', 'police', 'immigration', 'sécurité', 'manifestation'],
  };

  let bestCategory = 'society';
  let bestScore = 0;

  for (const [cat, keywords] of Object.entries(categorySignals)) {
    let score = 0;
    for (const kw of keywords) {
      if (text.includes(kw)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestCategory = cat;
    }
  }

  return bestCategory;
}

const SOURCE_TO_REGION: Record<string, string> = {
  'rfi.fr': 'Africa',
  'jeuneafrique.com': 'Africa',
  'lesoleil.sn': 'Senegal',
  'seneweb.com': 'Senegal',
  'dakaractu.com': 'Senegal',
  'apanews.net': 'Africa',
  'cameroon-tribune.cm': 'Cameroon',
  'journalducameroun.com': 'Cameroon',
  'camerounweb.com': 'Cameroon',
  'fratmat.info': 'Ivory Coast',
  'abidjan.net': 'Ivory Coast',
  'linfodrome.com': 'Ivory Coast',
  'radiookapi.net': 'DR Congo',
  'actualite.cd': 'DR Congo',
  'mediacongo.net': 'DR Congo',
  'leaders.com.tn': 'Tunisia',
  'webmanagercenter.com': 'Tunisia',
  'tsa-algerie.com': 'Algeria',
  'elwatan.com': 'Algeria',
  'maliweb.net': 'Mali',
  'bamada.net': 'Mali',
  'lefaso.net': 'Burkina Faso',
  'madagascar-tribune.com': 'Madagascar',
  'midi-madagasikara.mg': 'Madagascar',
  'guinee360.com': 'Guinea',
  'guineenews.org': 'Guinea',
  'anp.ne': 'Niger',
  'niameyetles2jours.com': 'Niger',
  'alwihdainfo.com': 'Chad',
  'tchadinfos.com': 'Chad',
  'gabonreview.com': 'Gabon',
  'togofirst.com': 'Togo',
  'republicoftogo.com': 'Togo',
  'lanouvelletribune.info': 'Benin',
  'beninwebtv.com': 'Benin',
  'africa1.com': 'Africa',
  'afrik.com': 'Africa',
  'africanews.com': 'Africa',
  'voaafrique.com': 'Africa',
  'lenouvelliste.com': 'Haiti',
  'haitilibre.com': 'Haiti',
  'alterpresse.org': 'Haiti',
  'loophaiti.com': 'Haiti',
  'martinique.franceantilles.fr': 'Martinique',
  'guadeloupe.franceantilles.fr': 'Guadeloupe',
  'franceantilles.fr': 'Martinique',
  'la1ere.francetvinfo.fr': 'Caribbean',
  'rci.fm': 'Martinique',
  'outremers360.com': 'Caribbean',
  'guyane.franceantilles.fr': 'French Guiana',
  'ici.radio-canada.ca': 'Canada',
  'radio-canada.ca': 'Canada',
  'lapresse.ca': 'Canada',
  'ledevoir.com': 'Canada',
  'journaldemontreal.com': 'Canada',
  'journaldequebec.com': 'Canada',
  'tvanouvelles.ca': 'Canada',
  'lametropole.com': 'Canada',
  'lactualite.com': 'Canada',
  'lesoleil.com': 'Canada',
  'ledroit.com': 'Canada',
  'latribune.ca': 'Canada',
  'rcinet.ca': 'Canada',
  'onfr.tfo.org': 'Canada',
};

function inferRegionFromSource(sourceUri: string): string | null {
  if (!sourceUri) return null;
  const uri = sourceUri.toLowerCase();
  for (const [domain, region] of Object.entries(SOURCE_TO_REGION)) {
    if (uri.includes(domain)) return region;
  }
  return null;
}

function inferRegion(sourceName: string, title: string, description: string, sourceUri?: string): string {
  if (sourceUri) {
    const fromSource = inferRegionFromSource(sourceUri);
    if (fromSource) return fromSource;
  }

  const text = `${sourceName} ${title} ${description}`.toLowerCase();

  if (text.includes('québec') || text.includes('quebec') || text.includes('montréal') || text.includes('montreal') || text.includes('radio-canada') || text.includes('la presse') || text.includes('le devoir') || text.includes('ottawa') || text.includes('canadien')) return 'Canada';
  if (text.includes('rtbf') || text.includes('belgique') || text.includes('bruxelles') || text.includes('walloni')) return 'Belgium';
  if (text.includes('suisse') || text.includes('genève') || text.includes('zurich') || text.includes('rts')) return 'Switzerland';
  if (text.includes('sénégal') || text.includes('senegal') || text.includes('dakar')) return 'Senegal';
  if (text.includes('maroc') || text.includes('morocco') || text.includes('rabat') || text.includes('casablanca')) return 'Morocco';
  if (text.includes('cameroun') || text.includes('cameroon') || text.includes('yaoundé') || text.includes('douala')) return 'Cameroon';
  if (text.includes('côte d\'ivoire') || text.includes('ivory coast') || text.includes('abidjan') || text.includes('ivoirien')) return 'Ivory Coast';
  if (text.includes('congo') || text.includes('kinshasa') || text.includes('congolais')) return 'DR Congo';
  if (text.includes('tunisie') || text.includes('tunisia') || text.includes('tunis')) return 'Tunisia';
  if (text.includes('algérie') || text.includes('algeria') || text.includes('alger')) return 'Algeria';
  if (text.includes('haïti') || text.includes('haiti') || text.includes('port-au-prince')) return 'Haiti';
  if (text.includes('mali') || text.includes('bamako') || text.includes('malien')) return 'Mali';
  if (text.includes('burkina') || text.includes('ouagadougou') || text.includes('burkinabè')) return 'Burkina Faso';
  if (text.includes('madagascar') || text.includes('antananarivo') || text.includes('malgache')) return 'Madagascar';
  if (text.includes('guinée') || text.includes('guinea') || text.includes('conakry')) return 'Guinea';
  if ((text.includes('niger') && !text.includes('nigeria')) || text.includes('niamey') || text.includes('nigérien')) return 'Niger';
  if (text.includes('tchad') || text.includes('chad') || text.includes('n\'djamena') || text.includes('tchadien')) return 'Chad';
  if (text.includes('gabon') || text.includes('libreville') || text.includes('gabonais')) return 'Gabon';
  if (text.includes('togo') || text.includes('lomé') || text.includes('togolais')) return 'Togo';
  if (text.includes('bénin') || text.includes('benin') || text.includes('cotonou') || text.includes('béninois')) return 'Benin';
  if (text.includes('martinique') || text.includes('fort-de-france')) return 'Martinique';
  if (text.includes('guadeloupe') || text.includes('pointe-à-pitre') || text.includes('basse-terre')) return 'Guadeloupe';
  if (text.includes('guyane') || text.includes('cayenne') || text.includes('french guiana')) return 'French Guiana';
  if (text.includes('antilles') || text.includes('caraïbe') || text.includes('caribéen')) return 'Haiti';
  if (text.includes('afrique') || text.includes('africain')) return 'Senegal';

  return 'France';
}

interface ERArticle {
  uri: string;
  lang: string;
  title: string;
  body: string;
  url: string;
  image: string | null;
  date: string;
  time: string;
  dateTime: string;
  dateTimePub: string;
  source: {
    uri: string;
    title: string;
  };
  isDuplicate: boolean;
  categories?: Array<{ uri: string; label: string }>;
}

interface ERResponse {
  articles: {
    results: ERArticle[];
    totalResults: number;
    page: number;
    count: number;
    pages: number;
  };
}

function mapERArticle(article: ERArticle, forcedCategory?: string, forcedRegion?: string): RawNewsArticle | null {
  if (!article.title || !article.title.trim()) return null;
  if (article.isDuplicate) return null;

  const sourceName = article.source?.title || article.source?.uri || 'Unknown';
  const sourceUri = article.source?.uri || '';
  const description = (article.body || '').substring(0, 500);

  return {
    id: generateArticleId(article.title, sourceName),
    headline: article.title,
    summary: description.replace(/\n/g, ' ').trim() || article.title,
    source: sourceName,
    sourceUrl: article.url || '',
    imageUrl: article.image || '',
    region: forcedRegion || inferRegion(sourceName, article.title, description, sourceUri),
    category: forcedCategory || inferCategory(article.title, description),
    publishedDate: article.date || new Date().toISOString().split('T')[0],
  };
}

function getApiKey(): string {
  const key = (process.env.EXPO_PUBLIC_NEWSAPI_KEY || '').trim();
  if (!key) {
    console.log('[EventRegistry] MISSING: EXPO_PUBLIC_NEWSAPI_KEY is not set');
    throw new Error('News API key not configured. Please add EXPO_PUBLIC_NEWSAPI_KEY.');
  }
  console.log(`[EventRegistry] API key loaded: ${key.substring(0, 8)}...${key.substring(key.length - 4)}`);
  return key;
}

function getDateRange(daysBack: number = 7): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getTime() - daysBack * 24 * 60 * 60 * 1000);
  return {
    from: from.toISOString().split('T')[0],
    to: to.toISOString().split('T')[0],
  };
}

async function queryEventRegistry(body: Record<string, unknown>): Promise<ERResponse> {
  const apiKey = getApiKey();
  const requestBody = {
    ...body,
    apiKey,
    action: 'getArticles',
  };

  const logBody = { ...requestBody, apiKey: '***' };
  console.log('[EventRegistry] POST /article/getArticles', JSON.stringify(logBody).substring(0, 600));

  let res: Response;
  try {
    res = await fetch(`${EVENT_REGISTRY_BASE}/article/getArticles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });
  } catch (fetchErr) {
    console.log('[EventRegistry] Network fetch error:', (fetchErr as Error)?.message);
    throw new Error(`Network error connecting to news API: ${(fetchErr as Error)?.message}`);
  }

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    console.log(`[EventRegistry] HTTP Error: ${res.status} ${errBody.substring(0, 300)}`);
    if (res.status === 401 || res.status === 403) {
      throw new Error('News API key is invalid. Please check EXPO_PUBLIC_NEWSAPI_KEY.');
    }
    if (res.status === 429) {
      throw new Error('News API rate limit reached. Please wait and try again.');
    }
    throw new Error(`News API error (HTTP ${res.status})`);
  }

  let data: ERResponse;
  try {
    data = await res.json() as ERResponse;
  } catch (jsonErr) {
    console.log('[EventRegistry] JSON parse error:', (jsonErr as Error)?.message);
    throw new Error('Failed to parse news API response');
  }

  if (!data.articles) {
    console.log('[EventRegistry] Unexpected response shape:', JSON.stringify(data).substring(0, 300));
    throw new Error('Unexpected response from news API');
  }

  console.log(`[EventRegistry] Response OK: ${data.articles.results.length} results, total: ${data.articles.totalResults}, page: ${data.articles.page}`);
  return data;
}

function mergeArticles(existing: RawNewsArticle[], incoming: RawNewsArticle[]): RawNewsArticle[] {
  const ids = new Set(existing.map(a => a.id));
  const unique = incoming.filter(a => !ids.has(a.id));
  return [...existing, ...unique];
}

async function fetchBySourceUris(
  sourceUris: string[],
  page: number,
  pageSize: number,
  daysBack: number,
  forcedCategory?: string,
  forcedRegion?: string,
  categoryUris?: string[],
): Promise<RawNewsArticle[]> {
  const { from } = getDateRange(daysBack);

  const body: Record<string, unknown> = {
    lang: 'fra',
    articlesPage: page,
    articlesCount: Math.min(pageSize, 100),
    articlesSortBy: 'date',
    articlesSortByAsc: false,
    dataType: ['news'],
    dateStart: from,
    isDuplicateFilter: 'skipDuplicates',
    sourceUri: sourceUris,
  };

  if (categoryUris && categoryUris.length > 0) {
    body.categoryUri = categoryUris.length === 1 ? categoryUris[0] : categoryUris;
  }

  console.log(`[EventRegistry] Fetching by sourceUri (${sourceUris.length} sources), page=${page}, days=${daysBack}, catUris=${categoryUris?.length ?? 0}, forcedRegion=${forcedRegion ?? 'none'}`);

  const data = await queryEventRegistry(body);
  return data.articles.results
    .map(a => mapERArticle(a, forcedCategory, forcedRegion))
    .filter((a): a is RawNewsArticle => a !== null);
}

async function fetchByCategoryUri(
  categoryUris: string[],
  page: number,
  pageSize: number,
  daysBack: number,
  forcedCategory?: string,
  sourceLocationUris?: string[],
): Promise<RawNewsArticle[]> {
  const { from } = getDateRange(daysBack);

  const body: Record<string, unknown> = {
    lang: 'fra',
    articlesPage: page,
    articlesCount: Math.min(pageSize, 100),
    articlesSortBy: 'date',
    articlesSortByAsc: false,
    dataType: ['news'],
    dateStart: from,
    isDuplicateFilter: 'skipDuplicates',
    categoryUri: categoryUris.length === 1 ? categoryUris[0] : categoryUris,
  };

  if (sourceLocationUris && sourceLocationUris.length > 0) {
    body.sourceLocationUri = sourceLocationUris;
  }

  console.log(`[EventRegistry] Fetching by categoryUri: ${categoryUris.join(', ')}, page=${page}, days=${daysBack}, locations=${sourceLocationUris?.length ?? 0}`);

  const data = await queryEventRegistry(body);
  return data.articles.results
    .map(a => mapERArticle(a, forcedCategory))
    .filter((a): a is RawNewsArticle => a !== null);
}

async function fetchByKeyword(
  keywords: string[],
  page: number,
  pageSize: number,
  daysBack: number,
  forcedCategory?: string,
  sourceLocationUris?: string[],
  sourceUris?: string[],
): Promise<RawNewsArticle[]> {
  const { from } = getDateRange(daysBack);

  const body: Record<string, unknown> = {
    lang: 'fra',
    articlesPage: page,
    articlesCount: Math.min(pageSize, 100),
    articlesSortBy: 'date',
    articlesSortByAsc: false,
    dataType: ['news'],
    dateStart: from,
    isDuplicateFilter: 'skipDuplicates',
    keyword: keywords.join(' OR '),
    keywordOper: 'or',
  };

  if (sourceLocationUris && sourceLocationUris.length > 0) {
    body.sourceLocationUri = sourceLocationUris;
  }
  if (sourceUris && sourceUris.length > 0) {
    body.sourceUri = sourceUris;
  }

  console.log(`[EventRegistry] Fetching by keywords: "${keywords.slice(0, 4).join(', ')}...", page=${page}, days=${daysBack}, locations=${sourceLocationUris?.length ?? 0}, sources=${sourceUris?.length ?? 0}`);

  const data = await queryEventRegistry(body);
  return data.articles.results
    .map(a => mapERArticle(a, forcedCategory))
    .filter((a): a is RawNewsArticle => a !== null);
}

async function fetchRegionArticles(
  regionKey: string,
  page: number,
  pageSize: number,
  daysBack: number,
  categoryUris?: string[],
  forcedCategory?: string,
): Promise<RawNewsArticle[]> {
  const sourceUris = REGION_SOURCE_URIS[regionKey];
  const locationUris = REGION_SOURCE_LOCATIONS[regionKey];
  const regionKws = REGION_KEYWORDS[regionKey];
  if (!sourceUris && !locationUris && !regionKws) return [];

  const effectiveDays = Math.max(daysBack, 21);
  const effectivePageSize = Math.max(pageSize, 50);

  const forcedRegionLabel = _REGION_FORCED_LABELS[regionKey];

  const strategies: Promise<RawNewsArticle[]>[] = [];

  if (sourceUris && sourceUris.length > 0) {
    const half = Math.ceil(sourceUris.length / 2);
    strategies.push(
      fetchBySourceUris(
        sourceUris.slice(0, half),
        page,
        Math.min(effectivePageSize, 100),
        effectiveDays,
        forcedCategory,
        forcedRegionLabel,
      ).catch(err => {
        console.log(`[EventRegistry] sourceUri batch1 failed for "${regionKey}":`, (err as Error).message);
        return [] as RawNewsArticle[];
      })
    );
    strategies.push(
      fetchBySourceUris(
        sourceUris.slice(half),
        page,
        Math.min(effectivePageSize, 100),
        effectiveDays,
        forcedCategory,
        forcedRegionLabel,
      ).catch(err => {
        console.log(`[EventRegistry] sourceUri batch2 failed for "${regionKey}":`, (err as Error).message);
        return [] as RawNewsArticle[];
      })
    );
  }

  if (locationUris) {
    const locationDays = Math.min(effectiveDays * 2, 45);
    const { from } = getDateRange(locationDays);
    strategies.push(
      queryEventRegistry({
        lang: 'fra',
        articlesPage: page,
        articlesCount: Math.min(effectivePageSize, 100),
        articlesSortBy: 'date',
        articlesSortByAsc: false,
        dataType: ['news'],
        dateStart: from,
        isDuplicateFilter: 'skipDuplicates',
        sourceLocationUri: locationUris,
      }).then(data =>
        data.articles.results
          .map(a => mapERArticle(a, forcedCategory, forcedRegionLabel))
          .filter((a): a is RawNewsArticle => a !== null)
      ).catch(err => {
        console.log(`[EventRegistry] sourceLocationUri failed for "${regionKey}":`, (err as Error).message);
        return [] as RawNewsArticle[];
      })
    );
  }

  if (regionKws) {
    strategies.push(
      fetchByKeyword(
        regionKws.slice(0, 10),
        page,
        Math.min(effectivePageSize, 100),
        45,
        forcedCategory,
      ).then(articles =>
        articles.map(a => ({ ...a, region: a.region === 'France' ? (forcedRegionLabel || a.region) : a.region }))
      ).catch(err => {
        console.log(`[EventRegistry] keyword fetch failed for "${regionKey}":`, (err as Error).message);
        return [] as RawNewsArticle[];
      })
    );
  }

  console.log(`[EventRegistry] Running ${strategies.length} parallel strategies for region "${regionKey}"`);
  const results = await Promise.all(strategies);

  let articles: RawNewsArticle[] = [];
  for (const batch of results) {
    articles = mergeArticles(articles, batch);
  }

  console.log(`[EventRegistry] Region "${regionKey}" total after parallel merge: ${articles.length} (from ${results.map(r => r.length).join('+')} batches)`);
  return articles;
}

export async function fetchCategoryArticles(
  category?: string,
  page: number = 1,
  pageSize: number = 25,
  existingHeadlines: string[] = [],
): Promise<RawNewsArticle[]> {
  const cat = category?.toLowerCase();
  const isAll = !cat || cat === 'all';

  let articles: RawNewsArticle[] = [];

  if (isAll) {
    console.log(`[EventRegistry] Fetching ALL French news with regional diversity, page=${page}`);
    const { from } = getDateRange(7);

    const mainFetchPromise = queryEventRegistry({
      lang: 'fra',
      articlesPage: page,
      articlesCount: Math.min(Math.ceil(pageSize * 0.4), 50),
      articlesSortBy: 'date',
      articlesSortByAsc: false,
      dataType: ['news'],
      dateStart: from,
      isDuplicateFilter: 'skipDuplicates',
    }).then(data =>
      data.articles.results
        .map(a => mapERArticle(a))
        .filter((a): a is RawNewsArticle => a !== null)
    ).catch(err => {
      console.log('[EventRegistry] Main "all" fetch failed:', (err as Error).message);
      return [] as RawNewsArticle[];
    });

    const regionSize = Math.max(30, Math.ceil(pageSize * 0.5));
    const regionPromises = (['africa', 'caribbean', 'canada'] as const).map(regionKey =>
      fetchRegionArticles(regionKey, page, regionSize, 30).catch(err => {
        console.log(`[EventRegistry] Region "${regionKey}" fetch failed for "all":`, (err as Error).message);
        return [] as RawNewsArticle[];
      })
    );

    const [mainArticles, ...regionResults] = await Promise.all([mainFetchPromise, ...regionPromises]);

    const allIds = new Set<string>();
    const merged: RawNewsArticle[] = [];

    for (const a of mainArticles) {
      if (!allIds.has(a.id)) { allIds.add(a.id); merged.push(a); }
    }
    for (const regionArticles of regionResults) {
      for (const a of regionArticles) {
        if (!allIds.has(a.id)) { allIds.add(a.id); merged.push(a); }
      }
    }

    articles = merged;
    const regionCounts = regionResults.map((r, i) => `${['africa', 'caribbean', 'canada'][i]}=${r.length}`);
    console.log(`[EventRegistry] Merged "all": ${mainArticles.length} main + ${regionCounts.join(', ')} region = ${articles.length} total`);
  } else {
    const categoryUris = CATEGORY_ER_URIS[cat];
    const keywords = CATEGORY_KEYWORDS[cat];

    if (categoryUris) {
      try {
        articles = await fetchByCategoryUri(categoryUris, page, pageSize, 7, cat);
        console.log(`[EventRegistry] categoryUri fetch for "${cat}": ${articles.length} articles`);
      } catch (err) {
        console.log(`[EventRegistry] categoryUri fetch failed for "${cat}":`, (err as Error).message);
      }
    }

    if (articles.length < 8 && keywords) {
      console.log(`[EventRegistry] Only ${articles.length} from categoryUri for "${cat}", trying keyword fallback (14 days)...`);
      try {
        const keywordArticles = await fetchByKeyword(keywords, page, pageSize, 14, cat);
        articles = mergeArticles(articles, keywordArticles);
        console.log(`[EventRegistry] After keyword fallback for "${cat}": ${articles.length} total`);
      } catch (err) {
        console.log(`[EventRegistry] Keyword fallback failed for "${cat}":`, (err as Error).message);
      }
    }

    const regionSize = Math.max(30, Math.ceil(pageSize * 0.5));
    const regionPromises = (['africa', 'caribbean', 'canada'] as const).map(regionKey =>
      fetchRegionArticles(regionKey, 1, regionSize, 30, categoryUris, cat).catch(err => {
        console.log(`[EventRegistry] Region "${regionKey}" fetch failed for "${cat}":`, (err as Error).message);
        return [] as RawNewsArticle[];
      })
    );

    const regionResults = await Promise.all(regionPromises);
    for (const regionArticles of regionResults) {
      articles = mergeArticles(articles, regionArticles);
    }
    const regionCounts = regionResults.map((r, i) => `${['africa', 'caribbean', 'canada'][i]}=${r.length}`);
    console.log(`[EventRegistry] After region enrichment for "${cat}": ${articles.length} total (${regionCounts.join(', ')})`);

    if (articles.length < 5) {
      console.log(`[EventRegistry] Only ${articles.length} articles for "${cat}" after region enrichment, trying broader date range (30 days)...`);
      try {
        if (categoryUris && articles.length === 0) {
          const broadCat = await fetchByCategoryUri(categoryUris, page, pageSize, 30, cat);
          articles = mergeArticles(articles, broadCat);
        }
        if (articles.length < 5 && keywords) {
          const broadKw = await fetchByKeyword(keywords.slice(0, 5), page, pageSize, 30, cat);
          articles = mergeArticles(articles, broadKw);
        }
      } catch (err) {
        console.log(`[EventRegistry] Broad fallback failed for "${cat}":`, (err as Error).message);
      }
    }
  }

  if (existingHeadlines.length > 0) {
    const existingSet = new Set(existingHeadlines.map(h => h.toLowerCase()));
    const before = articles.length;
    articles = articles.filter(a => !existingSet.has(a.headline.toLowerCase()));
    console.log(`[EventRegistry] After dedup: ${articles.length} new articles (removed ${before - articles.length})`);
  }

  console.log(`[EventRegistry] Final result for "${cat || 'all'}": ${articles.length} articles`);
  return articles;
}

export async function searchNewsApi(query: string): Promise<RawNewsArticle[]> {
  console.log(`[EventRegistry] Searching: "${query}"`);

  const data = await queryEventRegistry({
    keyword: query,
    lang: 'fra',
    articlesPage: 1,
    articlesCount: 25,
    articlesSortBy: 'rel',
    articlesSortByAsc: false,
    dataType: ['news'],
    dateStart: getDateRange(30).from,
    isDuplicateFilter: 'skipDuplicates',
  });

  const articles = data.articles.results
    .map(a => mapERArticle(a))
    .filter((a): a is RawNewsArticle => a !== null);

  console.log(`[EventRegistry] Search found ${articles.length} results for "${query}"`);
  return articles;
}
