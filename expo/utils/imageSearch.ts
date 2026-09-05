import AsyncStorage from '@react-native-async-storage/async-storage';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const PERPLEXITY_MODEL = 'perplexity/sonar';
const CACHE_KEY = 'okiri_smart_images_v2';

let imageCache: Record<string, string> = {};
let cacheLoaded = false;
let loadPromise: Promise<void> | null = null;

function makeKey(title: string, region?: string): string {
  const str = `${title.toLowerCase().slice(0, 80)}|${(region || '').toLowerCase()}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

async function ensureLoaded(): Promise<void> {
  if (cacheLoaded) return;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEY);
      if (raw) imageCache = JSON.parse(raw);
      console.log(`[ImageSearch] Loaded ${Object.keys(imageCache).length} cached images`);
    } catch (e) {
      console.log('[ImageSearch] Cache load error:', e);
    }
    cacheLoaded = true;
  })();
  return loadPromise;
}

async function persist(): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(imageCache));
  } catch (e) {
    console.log('[ImageSearch] Persist error:', e);
  }
}

export function getCachedSmartImage(title: string, region?: string): string | null {
  return imageCache[makeKey(title, region)] || null;
}

export async function searchImagesForBatch(
  items: Array<{ id: string; title: string; region?: string; category?: string; sourceUrl?: string }>
): Promise<Record<string, string>> {
  const apiKey = (process.env.EXPO_PUBLIC_OPENROUTER_API_KEY || '').trim();
  if (!apiKey || items.length === 0) return {};

  await ensureLoaded();

  const results: Record<string, string> = {};
  const uncached: typeof items = [];

  for (const item of items) {
    const cached = getCachedSmartImage(item.title, item.region);
    if (cached) {
      results[item.id] = cached;
    } else {
      uncached.push(item);
    }
  }

  if (uncached.length === 0) {
    console.log('[ImageSearch] All items found in cache');
    return results;
  }

  console.log(`[ImageSearch] Searching original article images for ${uncached.length} items (${items.length - uncached.length} cached)...`);

  for (let i = 0; i < uncached.length; i += 8) {
    const batch = uncached.slice(i, i + 8);

    if (i > 0) {
      await new Promise(r => setTimeout(r, 400));
    }

    try {
      const numbered = batch
        .map((a, idx) => {
          const sourceInfo = a.sourceUrl ? ` [Source: ${a.sourceUrl}]` : '';
          return `${idx + 1}. "${a.title}" (${a.region || 'general'}, ${a.category || 'general'})${sourceInfo}`;
        })
        .join('\n');

      const res = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://rork.app',
        },
        body: JSON.stringify({
          model: PERPLEXITY_MODEL,
          messages: [
            {
              role: 'system',
              content: 'You extract original article images from news websites. For each article, visit the source URL and find the og:image, twitter:image, or main featured image. Return ONLY a valid JSON array with no markdown or explanation.',
            },
            {
              role: 'user',
              content: `For each article below, find the ORIGINAL image used by the article on its webpage.

CRITICAL RULES:
1. If a source URL is provided, visit that page and extract the og:image meta tag, twitter:image meta tag, or the main hero/featured image
2. The image MUST be the actual image used by the original article — NOT a generic stock photo
3. Return direct URLs to actual image files (jpg, png, webp)
4. URLs must start with https://
5. If you cannot find the original article image, search for the article by headline and find its real image from the publisher's website
6. Do NOT return placeholder, generic, or unrelated images

Articles:
${numbered}

Respond with ONLY a JSON array of exactly ${batch.length} objects:
[{"index":1,"imageUrl":"https://..."},{"index":2,"imageUrl":"https://..."}]`,
            },
          ],
          temperature: 0.1,
          max_tokens: 2500,
        }),
      });

      if (!res.ok) {
        console.log(`[ImageSearch] API error: ${res.status}`);
        continue;
      }

      const data = await res.json();
      const text = data.choices?.[0]?.message?.content || '';
      const match = text.match(/\[[\s\S]*\]/);

      if (match) {
        const arr = JSON.parse(match[0]);
        if (Array.isArray(arr)) {
          let count = 0;
          for (const entry of arr) {
            const idx = (entry.index || 0) - 1;
            const url = (entry.imageUrl || entry.url || '').trim();
            if (idx >= 0 && idx < batch.length && url.startsWith('http')) {
              const item = batch[idx];
              results[item.id] = url;
              imageCache[makeKey(item.title, item.region)] = url;
              count++;
            }
          }
          console.log(`[ImageSearch] Batch ${Math.floor(i / 8) + 1}: found ${count}/${batch.length} original images`);
        }
      }
    } catch (e) {
      console.log('[ImageSearch] Batch search error:', e);
    }
  }

  await persist();
  console.log(`[ImageSearch] Total: ${Object.keys(results).length} original images found`);
  return results;
}

export async function searchSingleImage(
  title: string,
  region?: string,
  category?: string
): Promise<string | null> {
  const apiKey = (process.env.EXPO_PUBLIC_OPENROUTER_API_KEY || '').trim();
  if (!apiKey) return null;

  await ensureLoaded();

  const cached = getCachedSmartImage(title, region);
  if (cached) return cached;

  try {
    console.log(`[ImageSearch] Single search: "${title.slice(0, 50)}..."`);
    const res = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://rork.app',
      },
      body: JSON.stringify({
        model: PERPLEXITY_MODEL,
        messages: [
          {
            role: 'system',
            content: 'Find one relevant photo URL. Return ONLY the direct image URL, nothing else.',
          },
          {
            role: 'user',
            content: `Find a relevant, high-quality photo for: "${title}"${region ? ` (location: ${region})` : ''}${category ? `, topic: ${category}` : ''}.

Search for a real photo that matches this topic. Prefer Wikipedia, Wikimedia Commons, Unsplash, or news agency images.
Return ONLY the direct URL. Nothing else.`,
          },
        ],
        temperature: 0.1,
        max_tokens: 300,
      }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || '';
    const urlMatch = text.match(/https?:\/\/[^\s"'<>\]\)]+/);

    if (urlMatch) {
      const url = urlMatch[0].replace(/[.,;:)\]]+$/, '');
      if (url.startsWith('http')) {
        imageCache[makeKey(title, region)] = url;
        await persist();
        console.log(`[ImageSearch] Found: "${title.slice(0, 40)}..." -> ${url.slice(0, 60)}...`);
        return url;
      }
    }
  } catch (e) {
    console.log('[ImageSearch] Single search error:', e);
  }

  return null;
}
