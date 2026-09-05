import { generateObject, generateText } from '@rork-ai/toolkit-sdk';
import { z } from 'zod';
import { CEFRLevel } from '@/types';
import { getKeywordImage, getCategoryGradient } from '@/constants/keywordImages';


export interface RawNewsArticle {
  id: string;
  headline: string;
  summary: string;
  source: string;
  sourceUrl: string;
  region: string;
  category: string;
  publishedDate: string;
  imageUrl?: string;
}

export interface AdaptedNewsArticle extends RawNewsArticle {
  frenchTitle: string;
  frenchContent: string;
  englishSummary: string;
  cefrLevel: CEFRLevel;
  vocabulary: Array<{ french: string; english: string }>;
  adaptedAt: string;
}

export interface NewsCacheData {
  articles: RawNewsArticle[];
  fetchedAt: string;
  fetchDate: string;
  adaptedArticles: Record<string, AdaptedNewsArticle>;
  categoryFetchCounts: Record<string, number>;
  categoryArticles?: Record<string, RawNewsArticle[]>;
  categoryFetchDates?: Record<string, string>;
  categoryFetchTimestamps?: Record<string, string>;
}


export function getRegionFlag(region: string): string {
  const r = region.toLowerCase();
  if (r.includes('france')) return '🇫🇷';
  if (r.includes('belgium') || r.includes('belgi')) return '🇧🇪';
  if (r.includes('canada') || r.includes('quebec') || r.includes('québec')) return '🇨🇦';
  if (r.includes('senegal') || r.includes('sénégal')) return '🇸🇳';
  if (r.includes('morocco') || r.includes('maroc')) return '🇲🇦';
  if (r.includes('ivory') || r.includes('côte')) return '🇨🇮';
  if (r.includes('cameroon') || r.includes('cameroun')) return '🇨🇲';
  if (r.includes('haiti') || r.includes('haïti')) return '🇭🇹';
  if (r.includes('switzerland') || r.includes('suisse')) return '🇨🇭';
  if (r.includes('congo')) return '🇨🇩';
  if (r.includes('tunisia') || r.includes('tunis')) return '🇹🇳';
  if (r.includes('algeria') || r.includes('algér')) return '🇩🇿';
  if (r.includes('mali')) return '🇲🇱';
  if (r.includes('burkina')) return '🇧🇫';
  if (r.includes('madagascar')) return '🇲🇬';
  if (r.includes('guinea') || r.includes('guinée')) return '🇬🇳';
  if (r.includes('niger') && !r.includes('nigeria')) return '🇳🇪';
  if (r.includes('chad') || r.includes('tchad')) return '🇹🇩';
  if (r.includes('gabon')) return '🇬🇦';
  if (r.includes('togo')) return '🇹🇬';
  if (r.includes('benin') || r.includes('bénin')) return '🇧🇯';
  if (r.includes('martinique')) return '🇲🇶';
  if (r.includes('guadeloupe')) return '🇬🇵';
  if (r.includes('guiana') || r.includes('guyane')) return '🇬🇫';
  return '🌍';
}

export const NEWS_CATEGORY_COLORS: Record<string, string> = {
  politics: '#DC2626',
  culture: '#8B5CF6',
  sports: '#059669',
  science: '#2563EB',
  economy: '#D97706',
  society: '#EC4899',
  environment: '#10B981',
  technology: '#6366F1',
};

const CATEGORY_IMAGES: Record<string, string[]> = {
  politics: [
    'https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1555848962-6e79363ec58f?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1575320181282-9afab399332c?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1577415124269-fc1140a69e91?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1464692805480-a69dfaafdb0d?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&h=500&fit=crop&q=80',
  ],
  culture: [
    'https://images.unsplash.com/photo-1499781350541-7783f6c6a0c8?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1545987796-200d7b122008?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1547891654-e66ed7ebb968?w=800&h=500&fit=crop&q=80',
  ],
  sports: [
    'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1461896836934-bd45ba8fcb67?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1530549387789-4c1017266635?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1551958219-acbc608c6377?w=800&h=500&fit=crop&q=80',
  ],
  science: [
    'https://images.unsplash.com/photo-1507413245164-6160d8298b31?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1614935151651-0bea6508db6b?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1576086213369-97a306d36557?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1582719471384-894fbb16e074?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1564325724739-bae0bd08762c?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1557821552-17105176677c?w=800&h=500&fit=crop&q=80',
  ],
  economy: [
    'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1604594849809-dfedbc827105?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1560472355-536de3962603?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1444653614773-995cb1ef9efa?w=800&h=500&fit=crop&q=80',
  ],
  society: [
    'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1491438590914-bc09fcaaf77a?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1559027615-cd4628902d4a?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1509099836639-18ba1795216d?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1544027993-37dbfe43562a?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1531206715517-5c0ba140b2b8?w=800&h=500&fit=crop&q=80',
  ],
  environment: [
    'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1473448912268-2022ce9509d8?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1497436072909-60f360e1d4b1?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1611273426858-450d8e3c9fce?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1518173946687-a3e06b3083e2?w=800&h=500&fit=crop&q=80',
  ],
  technology: [
    'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1535378917042-10a22c95931a?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1504639725590-34d0984388bd?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800&h=500&fit=crop&q=80',
  ],
  dialogue: [
    'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1543269865-cbf427effbad?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1517048676732-d65bc937f952?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1516321497487-e288fb19713f?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1507537297725-24a1c029d3ca?w=800&h=500&fit=crop&q=80',
  ],
  story: [
    'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1506880018603-83d5b814b5a6?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1474366521946-c3b8a031dafd?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1502759683299-cdcd6974244f?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1468276311594-df7cb65d8df6?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=800&h=500&fit=crop&q=80',
  ],
  fiction: [
    'https://images.unsplash.com/photo-1532012197267-da84d127e765?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1516979187457-637abb4f9353?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1513001900722-370f803f498d?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1476275466078-4007374efbbe?w=800&h=500&fit=crop&q=80',
  ],
  history: [
    'https://images.unsplash.com/photo-1461360370896-922624d12a74?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1553028826-f4804a6dba3b?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1564399580075-5dfe19c205f3?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1547981609-4b6bfe67ca0b?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1548407260-da850faa41e8?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1572883454516-a3e47f79769d?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1571115764595-644a1f56a55c?w=800&h=500&fit=crop&q=80',
  ],
  literature: [
    'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1519682337058-a94d519337bc?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1550399105-c4db5fb85c18?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1491841550275-ad7854e35ca6?w=800&h=500&fit=crop&q=80',
  ],
  food: [
    'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1482049016688-2d3e1b311543?w=800&h=500&fit=crop&q=80',
  ],
  music: [
    'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1571330735066-03aaa9429d89?w=800&h=500&fit=crop&q=80',
  ],
  travel: [
    'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1500835556837-99ac94a94552?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1530789253388-582c481c54b0?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1528127269322-539801943592?w=800&h=500&fit=crop&q=80',
  ],
  news: [
    'https://images.unsplash.com/photo-1504711434969-e33886168d9c?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1495020689067-958852a7765e?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1478829364721-be5e9e543e3c?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1553729459-afe8f2e2ed08?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1586339949916-3e9457bef6d3?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1503694978374-8a2fa686963a?w=800&h=500&fit=crop&q=80',
  ],
  article: [
    'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1471107340929-a87cd0f5b5f3?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1501504905252-473c47e087f8?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1488190211105-8b0e65b80b4e?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=800&h=500&fit=crop&q=80',
  ],
};

const REGION_IMAGES: Record<string, string[]> = {
  france: [
    'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1431274172761-fca41d930114?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1503917988258-f87a78e3c995?w=800&h=500&fit=crop&q=80',
  ],
  senegal: [
    'https://images.unsplash.com/photo-1489392191049-fc10c97e64b6?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1504197885068-7bebc16e16fa?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1523805009345-7448845a9e53?w=800&h=500&fit=crop&q=80',
  ],
  morocco: [
    'https://images.unsplash.com/photo-1539020140153-e479b8c6e3ed?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1493246507139-91e8fad9978e?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1548018560-c7196e060b5a?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1545042679-3eaa44bc6cef?w=800&h=500&fit=crop&q=80',
  ],
  quebec: [
    'https://images.unsplash.com/photo-1519178614-68673b201f36?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1503614472-8c93d56e92ce?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1517935706615-2717063c2225?w=800&h=500&fit=crop&q=80',
  ],
  canada: [
    'https://images.unsplash.com/photo-1519178614-68673b201f36?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1503614472-8c93d56e92ce?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1551524559-8af4e6624178?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1509023464722-18d996393ca8?w=800&h=500&fit=crop&q=80',
  ],
  montreal: [
    'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1519178614-68673b201f36?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1551524559-8af4e6624178?w=800&h=500&fit=crop&q=80',
  ],
  'new brunswick': [
    'https://images.unsplash.com/photo-1503614472-8c93d56e92ce?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1509023464722-18d996393ca8?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1517935706615-2717063c2225?w=800&h=500&fit=crop&q=80',
  ],
  belgium: [
    'https://images.unsplash.com/photo-1516706669454-f4d79b5793f9?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1491557345352-5929e343eb89?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=800&h=500&fit=crop&q=80',
  ],
  switzerland: [
    'https://images.unsplash.com/photo-1530122037265-a5f1f91d3b99?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1527668752968-14dc70a27c95?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1504218727796-db522606b16f?w=800&h=500&fit=crop&q=80',
  ],
  cameroon: [
    'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1523805009345-7448845a9e53?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=800&h=500&fit=crop&q=80',
  ],
  haiti: [
    'https://images.unsplash.com/photo-1580237541049-2d715a09486e?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1548013146-72479768bada?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&h=500&fit=crop&q=80',
  ],
  martinique: [
    'https://images.unsplash.com/photo-1590523741831-ab7e8b8f9c7f?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&h=500&fit=crop&q=80',
  ],
  guadeloupe: [
    'https://images.unsplash.com/photo-1548013146-72479768bada?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&h=500&fit=crop&q=80',
  ],
  'french guiana': [
    'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&h=500&fit=crop&q=80',
  ],
  guyane: [
    'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&h=500&fit=crop&q=80',
  ],
  'ivory-coast': [
    'https://images.unsplash.com/photo-1504197885068-7bebc16e16fa?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1523805009345-7448845a9e53?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?w=800&h=500&fit=crop&q=80',
  ],
  'ivory coast': [
    'https://images.unsplash.com/photo-1504197885068-7bebc16e16fa?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1523805009345-7448845a9e53?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?w=800&h=500&fit=crop&q=80',
  ],
  drc: [
    'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1489392191049-fc10c97e64b6?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?w=800&h=500&fit=crop&q=80',
  ],
  congo: [
    'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1489392191049-fc10c97e64b6?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?w=800&h=500&fit=crop&q=80',
  ],
  tunisia: [
    'https://images.unsplash.com/photo-1518537999906-7d6f18fdb0e4?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1548018560-c7196e060b5a?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1545042679-3eaa44bc6cef?w=800&h=500&fit=crop&q=80',
  ],
  algeria: [
    'https://images.unsplash.com/photo-1583339793403-3d9b0c8d94b7?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1548018560-c7196e060b5a?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1493246507139-91e8fad9978e?w=800&h=500&fit=crop&q=80',
  ],
  mali: [
    'https://images.unsplash.com/photo-1489392191049-fc10c97e64b6?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1523805009345-7448845a9e53?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1504197885068-7bebc16e16fa?w=800&h=500&fit=crop&q=80',
  ],
  'burkina faso': [
    'https://images.unsplash.com/photo-1489392191049-fc10c97e64b6?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1523805009345-7448845a9e53?w=800&h=500&fit=crop&q=80',
  ],
  madagascar: [
    'https://images.unsplash.com/photo-1504197885068-7bebc16e16fa?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=800&h=500&fit=crop&q=80',
  ],
  guinea: [
    'https://images.unsplash.com/photo-1489392191049-fc10c97e64b6?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1504197885068-7bebc16e16fa?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?w=800&h=500&fit=crop&q=80',
  ],
  niger: [
    'https://images.unsplash.com/photo-1523805009345-7448845a9e53?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1489392191049-fc10c97e64b6?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1504197885068-7bebc16e16fa?w=800&h=500&fit=crop&q=80',
  ],
  chad: [
    'https://images.unsplash.com/photo-1489392191049-fc10c97e64b6?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1523805009345-7448845a9e53?w=800&h=500&fit=crop&q=80',
  ],
  gabon: [
    'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&h=500&fit=crop&q=80',
  ],
  togo: [
    'https://images.unsplash.com/photo-1504197885068-7bebc16e16fa?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?w=800&h=500&fit=crop&q=80',
  ],
  benin: [
    'https://images.unsplash.com/photo-1523805009345-7448845a9e53?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1489392191049-fc10c97e64b6?w=800&h=500&fit=crop&q=80',
  ],
  general: [
    'https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&h=500&fit=crop&q=80',
    'https://images.unsplash.com/photo-1500835556837-99ac94a94552?w=800&h=500&fit=crop&q=80',
  ],
};

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getRegionImagePool(regionKey: string): string[] {
  const lower = regionKey.toLowerCase();
  for (const [key, urls] of Object.entries(REGION_IMAGES)) {
    if (lower.includes(key) || key.includes(lower)) {
      return urls;
    }
  }
  return REGION_IMAGES.general;
}

export interface ArticleImageResult {
  primary: string;
  fallback: string;
  gradient: [string, string, string];
}

export function getArticleImageResult(article: RawNewsArticle, smartImages?: Record<string, string>): ArticleImageResult {
  const gradient = getCategoryGradient(article.category);
  const combinedHash = simpleHash(article.id + article.headline + article.category);
  const regionPool = getRegionImagePool(article.region);
  const catImages = CATEGORY_IMAGES[article.category] || CATEGORY_IMAGES.society;
  const allPool = [...new Set([...regionPool, ...catImages])];
  const poolFallback = allPool[combinedHash % allPool.length];

  const keywordImg = getKeywordImage(article.headline + ' ' + article.summary, article.id);

  if (smartImages?.[article.id]) {
    return { primary: smartImages[article.id], fallback: keywordImg || poolFallback, gradient };
  }
  if (article.imageUrl && article.imageUrl.startsWith('http')) {
    return { primary: article.imageUrl, fallback: keywordImg || poolFallback, gradient };
  }
  if (keywordImg) {
    return { primary: keywordImg, fallback: poolFallback, gradient };
  }
  return { primary: poolFallback, fallback: poolFallback, gradient };
}

export function getArticleImage(article: RawNewsArticle, smartImages?: Record<string, string>): string {
  return getArticleImageResult(article, smartImages).primary;
}

export interface LibraryImageResult {
  primary: string;
  fallback: string;
  gradient: [string, string, string];
}

export function getLibraryImageResult(title: string, region: string, category: string, id: string, smartImages?: Record<string, string>): LibraryImageResult {
  const gradient = getCategoryGradient(category);
  const combinedHash = simpleHash(id + region + category);
  const regionPool = REGION_IMAGES[region] || REGION_IMAGES[region.toLowerCase()] || REGION_IMAGES.general;
  const catImages = CATEGORY_IMAGES[category] || CATEGORY_IMAGES.culture;
  const allPool = [...new Set([...regionPool, ...catImages])];
  const poolFallback = allPool[combinedHash % allPool.length];

  const keywordImg = getKeywordImage(title, id);

  if (smartImages?.[id]) {
    return { primary: smartImages[id], fallback: keywordImg || poolFallback, gradient };
  }
  if (keywordImg) {
    return { primary: keywordImg, fallback: poolFallback, gradient };
  }
  return { primary: poolFallback, fallback: poolFallback, gradient };
}

export function getLibraryImage(region: string, category: string, id: string, smartImages?: Record<string, string>): string {
  return getLibraryImageResult('', region, category, id, smartImages).primary;
}

import { fetchCategoryArticles as newsApiFetchCategory, searchNewsApi } from '@/utils/newsApiService';





export async function fetchFrenchNews(): Promise<RawNewsArticle[]> {
  console.log('[News] Fetching French news via NewsAPI...');
  const articles = await newsApiFetchCategory(undefined, 1, 60);
  console.log(`[News] NewsAPI returned ${articles.length} articles`);
  return articles;
}

export async function fetchMoreForCategory(
  category?: string,
  _regionKey?: string,
  existingHeadlines: string[] = []
): Promise<RawNewsArticle[]> {
  console.log(`[News] fetchMoreForCategory via NewsAPI: category=${category || 'all'}`);
  const page = Math.max(1, Math.ceil((existingHeadlines.length + 1) / 40));
  const articles = await newsApiFetchCategory(category, page, 50, existingHeadlines);
  console.log(`[News] NewsAPI returned ${articles.length} articles for category "${category || 'all'}"`);
  return articles;
}

async function translateQueryToFrench(query: string): Promise<{ translated: string; wasTranslated: boolean }> {
  const frenchPattern = /[àâäéèêëïîôùûüÿçœæ]/i;
  const commonFrenchWords = ['le', 'la', 'les', 'des', 'du', 'un', 'une', 'et', 'est', 'dans', 'pour', 'avec', 'sur', 'que', 'qui', 'pas', 'sont', 'mais', 'ou', 'donc', 'ni', 'car'];
  const queryWords = query.toLowerCase().split(/\s+/);
  const frenchWordCount = queryWords.filter(w => commonFrenchWords.includes(w)).length;

  if (frenchPattern.test(query) || frenchWordCount >= 2) {
    console.log(`[News Search] Query "${query}" appears to be French already, skipping translation`);
    return { translated: query, wasTranslated: false };
  }

  try {
    console.log(`[News Search] Translating query to French: "${query}"`);
    const result = await generateText({
      messages: [
        {
          role: 'user',
          content: `Translate this English search query to French. Return ONLY the French translation, nothing else. Keep it concise as a search query.\n\nQuery: ${query}`,
        },
      ],
    });

    const translated = result.trim().replace(/^["']|["']$/g, '');
    if (!translated || translated.length > query.length * 4) {
      console.log(`[News Search] Translation result invalid, using original`);
      return { translated: query, wasTranslated: false };
    }

    console.log(`[News Search] Translated: "${query}" → "${translated}"`);
    return { translated, wasTranslated: true };
  } catch (err) {
    console.log(`[News Search] Translation failed, using original query:`, (err as Error)?.message);
    return { translated: query, wasTranslated: false };
  }
}

export interface SearchNewsResult {
  articles: RawNewsArticle[];
  translatedQuery: string | null;
}

export async function searchNews(query: string): Promise<SearchNewsResult> {
  console.log(`[News Search] Searching via NewsAPI for: "${query}"`);

  const { translated, wasTranslated } = await translateQueryToFrench(query);

  const frenchResults = await searchNewsApi(translated);
  console.log(`[News Search] French search returned ${frenchResults.length} results for "${translated}"`);

  let allArticles = frenchResults;

  if (wasTranslated && frenchResults.length < 10) {
    console.log(`[News Search] Few French results, also searching original English query`);
    const englishResults = await searchNewsApi(query);
    const existingIds = new Set(allArticles.map(a => a.id));
    const unique = englishResults.filter(a => !existingIds.has(a.id));
    allArticles = [...allArticles, ...unique];
    console.log(`[News Search] Combined: ${allArticles.length} total (${frenchResults.length} French + ${unique.length} English)`);
  }

  return {
    articles: allArticles,
    translatedQuery: wasTranslated ? translated : null,
  };
}

const LEVEL_GUIDANCE: Record<CEFRLevel, string> = {
  'A1': "Use ONLY present tense. Very short sentences (5-8 words). Only the 300 most common French words. Simple subject-verb-object. Use il y a, c'est, être, avoir frequently.",
  'A2': 'Present tense and passé composé. Simple connectors (et, mais, aussi, parce que). 8-12 word sentences. Common everyday vocabulary.',
  'B1': 'Passé composé, imparfait, futur proche. Discourse markers (cependant, en effet). Natural paragraphs. Some idiomatic expressions.',
  'B2': 'All major tenses including conditional and some subjunctive. Complex sentences with relative clauses. Formal register. Varied vocabulary.',
  'C1': 'Near-native journalistic French. Advanced subjunctive, literary connectors (néanmoins, toutefois). Nuanced vocabulary. Professional style.',
  'C2': 'Full native-level journalistic French. Literary register. Complex syntax, specialized vocabulary, cultural references.',
};

function fixJsonNewlines(text: string): string {
  let result = '';
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (escaped) { result += ch; escaped = false; continue; }
    if (ch === '\\') { result += ch; escaped = true; continue; }
    if (ch === '"') { inString = !inString; result += ch; continue; }
    if (inString && ch === '\n') { result += '\\n'; continue; }
    if (inString && ch === '\r') { result += '\\r'; continue; }
    if (inString && ch === '\t') { result += '\\t'; continue; }
    result += ch;
  }
  return result;
}

function tryParseAdaptedJson(raw: string): { frenchTitle: string; frenchContent: string; englishSummary: string; vocabulary: Array<{ french: string; english: string }> } | null {
  const cleaned = raw.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;

  try {
    const parsed = JSON.parse(match[0]);
    if (parsed.frenchTitle && parsed.frenchContent) return parsed;
  } catch {
    console.log('[News] Direct JSON parse failed, trying newline fix...');
  }

  try {
    const fixed = fixJsonNewlines(match[0]);
    const parsed = JSON.parse(fixed);
    if (parsed.frenchTitle && parsed.frenchContent) return parsed;
  } catch {
    console.log('[News] Fixed JSON parse also failed');
  }

  return null;
}

function parseVocabLines(raw: string): Array<{ french: string; english: string }> {
  const vocabulary: Array<{ french: string; english: string }> = [];
  raw.trim().split('\n').forEach(line => {
    const trimmed = line.replace(/^[-\d.•*]+\s*/, '').trim();
    if (!trimmed) return;
    const sep = trimmed.includes('|') ? '|' : trimmed.includes(' - ') ? ' - ' : trimmed.includes(': ') ? ': ' : trimmed.includes('→') ? '→' : null;
    if (sep) {
      const parts = trimmed.split(sep).map(s => s.trim().replace(/^["']|["']$/g, ''));
      if (parts.length >= 2 && parts[0] && parts[1]) {
        vocabulary.push({ french: parts[0], english: parts[1] });
      }
    }
  });
  return vocabulary;
}

function parseDelimiterResponse(text: string): { frenchTitle: string; frenchContent: string; englishSummary: string; vocabulary: Array<{ french: string; english: string }> } | null {
  const norm = text
    .replace(/={2,}\s*FRENCH[\s_-]*TITLE\s*={2,}/gi, '§§§TITLE§§§')
    .replace(/={2,}\s*FRENCH[\s_-]*CONTENT\s*={2,}/gi, '§§§CONTENT§§§')
    .replace(/={2,}\s*ENGLISH[\s_-]*SUMMARY\s*={2,}/gi, '§§§SUMMARY§§§')
    .replace(/={2,}\s*VOCAB(?:ULARY)?\s*={2,}/gi, '§§§VOCAB§§§');

  let titleMatch = norm.match(/§§§TITLE§§§\s*([\s\S]*?)\s*§§§CONTENT§§§/);
  let contentMatch = norm.match(/§§§CONTENT§§§\s*([\s\S]*?)\s*§§§SUMMARY§§§/);
  let summaryMatch = norm.match(/§§§SUMMARY§§§\s*([\s\S]*?)\s*§§§VOCAB§§§/);
  let vocabMatch = norm.match(/§§§VOCAB§§§\s*([\s\S]*?)$/);

  if (!titleMatch || !contentMatch || !summaryMatch) {
    console.log('[News] Normalized delimiters failed, trying original strict match');
    titleMatch = text.match(/===FRENCH_TITLE===\s*([\s\S]*?)\s*===/);
    contentMatch = text.match(/===FRENCH_CONTENT===\s*([\s\S]*?)\s*===ENGLISH/);
    summaryMatch = text.match(/===ENGLISH_SUMMARY===\s*([\s\S]*?)\s*===VOCAB/);
    vocabMatch = text.match(/===VOCABULARY===\s*([\s\S]*?)$/);
  }

  const frenchTitle = titleMatch?.[1]?.trim();
  const frenchContent = contentMatch?.[1]?.trim();
  const englishSummary = summaryMatch?.[1]?.trim();

  if (!frenchTitle || !frenchContent) {
    console.log('[News] Delimiter parsing: missing title or content');
    return null;
  }

  const vocabulary = parseVocabLines(vocabMatch?.[1] || '');
  return {
    frenchTitle,
    frenchContent,
    englishSummary: englishSummary || '',
    vocabulary,
  };
}

function extractContentFromFreeText(
  text: string,
  article: RawNewsArticle,
): { frenchTitle: string; frenchContent: string; englishSummary: string; vocabulary: Array<{ french: string; english: string }> } | null {
  const frenchCharPattern = /[àâäéèêëîïôùûüçœæÀÂÄÉÈÊËÎÏÔÙÛÜÇŒÆ]/;
  const cleaned = text.replace(/```[\s\S]*?```/g, '').replace(/^#+\s*/gm, '').trim();
  const lines = cleaned.split('\n').map(l => l.trim()).filter(l => l.length > 2);

  const frenchLines: string[] = [];
  const englishLines: string[] = [];

  for (const line of lines) {
    if (frenchCharPattern.test(line) || /^(Le |La |Les |Un |Une |Des |Il |Elle |Ils |Elles |Ce |Cette |En |Au |Aux |Dans |Sur |Pour |Avec |Par )/.test(line)) {
      frenchLines.push(line);
    } else if (/^[A-Z]/.test(line) && !frenchCharPattern.test(line)) {
      englishLines.push(line);
    } else {
      frenchLines.push(line);
    }
  }

  const frenchContent = frenchLines.join('\n\n');
  if (frenchContent.length < 80) {
    console.log('[News] Free text extraction: not enough French content found');
    return null;
  }

  const frenchTitle = frenchLines[0]?.length < 120 ? frenchLines[0] : article.headline;
  const contentBody = frenchLines[0]?.length < 120 ? frenchLines.slice(1).join('\n\n') : frenchContent;
  const englishSummary = englishLines.length > 0 ? englishLines.slice(0, 3).join(' ') : article.summary;

  console.log(`[News] Free text extraction: found ${frenchLines.length} French lines, ${contentBody.length} chars`);
  return {
    frenchTitle,
    frenchContent: contentBody || frenchContent,
    englishSummary,
    vocabulary: [],
  };
}

export async function adaptArticleForLevel(
  article: RawNewsArticle,
  cefrLevel: CEFRLevel
): Promise<AdaptedNewsArticle> {
  console.log(`[News] Adapting "${article.headline}" for ${cefrLevel}...`);

  const basePrompt = `Rewrite this real news article in French for a ${cefrLevel} language learner.

ORIGINAL:
Headline: ${article.headline}
Summary: ${article.summary}
Source: ${article.source}, ${article.region}

LEVEL (${cefrLevel}): ${LEVEL_GUIDANCE[cefrLevel]}`;

  try {
    const adaptedSchema = z.object({
      frenchTitle: z.string(),
      frenchContent: z.string(),
      englishSummary: z.string(),
      vocabulary: z.array(z.object({
        french: z.string(),
        english: z.string(),
      })),
    });

    const objPrompt = `${basePrompt}\n\nReturn:\n- frenchTitle: Headline in French at ${cefrLevel} level\n- frenchContent: 3-5 paragraphs of French text at ${cefrLevel} level, separated by double newlines. At least 150 words for A1/A2, 250+ for B1+.\n- englishSummary: 2-3 sentence English summary for context\n- vocabulary: 6-8 key French words/phrases with English translations.`;

    const result = await generateObject({
      messages: [{ role: 'user', content: objPrompt }],
      schema: adaptedSchema,
    });

    console.log(`[News] generateObject returned for "${article.headline}", checking fields...`);

    if (result?.frenchTitle?.trim() && result?.frenchContent?.trim() && result?.englishSummary?.trim()) {
      console.log(`[News] Adapted via generateObject OK`);
      return {
        ...article,
        frenchTitle: result.frenchTitle.trim(),
        frenchContent: result.frenchContent.trim(),
        englishSummary: result.englishSummary.trim(),
        cefrLevel,
        vocabulary: Array.isArray(result.vocabulary) ? result.vocabulary : [],
        adaptedAt: new Date().toISOString(),
      };
    }
    console.log('[News] generateObject returned empty/incomplete fields, falling back');
  } catch (objErr: any) {
    console.log('[News] generateObject failed:', objErr?.message ?? String(objErr));
  }

  console.log('[News] Trying generateText with delimiter format...');
  try {
    const delimiterPrompt = `${basePrompt}

You MUST use EXACTLY this format with these delimiters. Do NOT use JSON. Do NOT use markdown code blocks.

===FRENCH_TITLE===
[Write the headline in French at ${cefrLevel} level]
===FRENCH_CONTENT===
[Write 3-5 paragraphs of French text at ${cefrLevel} level. Separate paragraphs with blank lines. At least 150 words for A1/A2, 250+ for B1+.]
===ENGLISH_SUMMARY===
[Write 2-3 sentence English summary for context]
===VOCABULARY===
[Write 6-8 items, one per line, format: french_word | english_translation]`;

    const textResult = await generateText({
      messages: [{ role: 'user', content: delimiterPrompt }],
    });

    console.log('[News] generateText response length:', textResult.length);

    const delimiterParsed = parseDelimiterResponse(textResult);
    if (delimiterParsed) {
      console.log(`[News] Adapted via delimiter parsing OK`);
      return {
        ...article,
        frenchTitle: delimiterParsed.frenchTitle,
        frenchContent: delimiterParsed.frenchContent,
        englishSummary: delimiterParsed.englishSummary,
        cefrLevel,
        vocabulary: delimiterParsed.vocabulary,
        adaptedAt: new Date().toISOString(),
      };
    }

    console.log('[News] Delimiter parsing failed, trying JSON extraction from same response...');
    const jsonParsed = tryParseAdaptedJson(textResult);
    if (jsonParsed) {
      console.log(`[News] Adapted via JSON extraction OK`);
      return {
        ...article,
        frenchTitle: jsonParsed.frenchTitle,
        frenchContent: jsonParsed.frenchContent,
        englishSummary: jsonParsed.englishSummary || article.summary,
        cefrLevel,
        vocabulary: Array.isArray(jsonParsed.vocabulary) ? jsonParsed.vocabulary : [],
        adaptedAt: new Date().toISOString(),
      };
    }

    console.log('[News] Both delimiter and JSON parsing failed on first response, trying JSON prompt...');
  } catch (textErr: any) {
    console.log('[News] Delimiter generateText failed:', textErr?.message ?? String(textErr));
  }

  console.log('[News] Trying generateText with JSON format as last resort...');
  let lastTextResponse = '';
  try {
    const jsonPrompt = `${basePrompt}

Write a JSON object with these fields. Use \\n for newlines inside strings. No markdown.
{"frenchTitle": "headline in French", "frenchContent": "paragraphs separated by \\n\\n", "englishSummary": "2-3 sentences", "vocabulary": [{"french": "word", "english": "translation"}]}`;

    const jsonResult = await generateText({
      messages: [{ role: 'user', content: jsonPrompt }],
    });
    lastTextResponse = jsonResult;

    const parsed = tryParseAdaptedJson(jsonResult);
    if (parsed) {
      console.log(`[News] Adapted via final JSON attempt OK`);
      return {
        ...article,
        frenchTitle: parsed.frenchTitle,
        frenchContent: parsed.frenchContent,
        englishSummary: parsed.englishSummary || article.summary,
        cefrLevel,
        vocabulary: Array.isArray(parsed.vocabulary) ? parsed.vocabulary : [],
        adaptedAt: new Date().toISOString(),
      };
    }
  } catch (lastErr: any) {
    console.log('[News] Final JSON attempt failed:', lastErr?.message ?? String(lastErr));
  }

  console.log('[News] Trying simple text generation as absolute last resort...');
  try {
    const simplePrompt = `Write a short news article in French at ${cefrLevel} level about:\n${article.headline}\n${article.summary}\n\n${LEVEL_GUIDANCE[cefrLevel]}\n\nJust write the French title on the first line, then the article paragraphs. Nothing else.`;

    const simpleResult = await generateText({
      messages: [{ role: 'user', content: simplePrompt }],
    });

    if (simpleResult && simpleResult.length > 80) {
      const extracted = extractContentFromFreeText(simpleResult, article);
      if (extracted) {
        console.log('[News] Adapted via simple text extraction OK');
        return {
          ...article,
          frenchTitle: extracted.frenchTitle,
          frenchContent: extracted.frenchContent,
          englishSummary: extracted.englishSummary || article.summary,
          cefrLevel,
          vocabulary: extracted.vocabulary,
          adaptedAt: new Date().toISOString(),
        };
      }
    }
  } catch (simpleErr: any) {
    console.log('[News] Simple text generation failed:', simpleErr?.message ?? String(simpleErr));
  }

  if (lastTextResponse && lastTextResponse.length > 80) {
    console.log('[News] Attempting free-text extraction from last response...');
    const extracted = extractContentFromFreeText(lastTextResponse, article);
    if (extracted) {
      console.log('[News] Adapted via free-text extraction from previous response OK');
      return {
        ...article,
        frenchTitle: extracted.frenchTitle,
        frenchContent: extracted.frenchContent,
        englishSummary: extracted.englishSummary || article.summary,
        cefrLevel,
        vocabulary: extracted.vocabulary,
        adaptedAt: new Date().toISOString(),
      };
    }
  }

  console.error('[News] All adaptation methods failed for:', article.headline);
  throw new Error('Failed to adapt article after all attempts');
}
