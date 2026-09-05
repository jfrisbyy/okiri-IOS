import { useState, useEffect, useRef } from 'react';
import { searchImagesForBatch, getCachedSmartImage } from '@/utils/imageSearch';

interface ContentItem {
  id: string;
  title: string;
  region: string;
  category: string;
}

export function useSmartLibraryImages(items: ContentItem[]): Record<string, string> {
  const [smartImages, setSmartImages] = useState<Record<string, string>>({});
  const searchDoneRef = useRef(false);
  const itemsKeyRef = useRef('');

  useEffect(() => {
    const key = items.map(i => i.id).join(',');
    if (key === itemsKeyRef.current && searchDoneRef.current) return;
    itemsKeyRef.current = key;

    const cached: Record<string, string> = {};
    const needsSearch: ContentItem[] = [];

    for (const item of items) {
      const cachedUrl = getCachedSmartImage(item.title, item.region);
      if (cachedUrl) {
        cached[item.id] = cachedUrl;
      } else {
        needsSearch.push(item);
      }
    }

    if (Object.keys(cached).length > 0) {
      setSmartImages(prev => ({ ...prev, ...cached }));
    }

    if (needsSearch.length === 0) {
      searchDoneRef.current = true;
      return;
    }

    searchDoneRef.current = true;

    console.log(`[SmartLibImages] Searching for ${needsSearch.length} library images (${Object.keys(cached).length} cached)...`);

    searchImagesForBatch(
      needsSearch.map(item => ({
        id: item.id,
        title: item.title,
        region: item.region,
        category: item.category,
      }))
    ).then(imageMap => {
      if (Object.keys(imageMap).length > 0) {
        console.log(`[SmartLibImages] Found ${Object.keys(imageMap).length} new library images`);
        setSmartImages(prev => ({ ...prev, ...imageMap }));
      }
    }).catch(e => {
      console.log('[SmartLibImages] Search error:', e);
    });
  }, [items]);

  return smartImages;
}
