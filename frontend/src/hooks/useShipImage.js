import { useState, useEffect } from 'react';

const imageCache = new Map();

/**
 * Hook to fetch and cache ship images from the backend proxy.
 * Returns { imageUrl, thumbnailUrl, loading, license }
 */
export function useShipImage(shipType) {
  const [data, setData] = useState({
    imageUrl: null,
    thumbnailUrl: null,
    loading: !!shipType,
    license: null,
  });

  useEffect(() => {
    if (!shipType) {
      setData({ imageUrl: null, thumbnailUrl: null, loading: false, license: null });
      return;
    }

    // Check in-memory cache
    if (imageCache.has(shipType.toLowerCase())) {
      setData({ ...imageCache.get(shipType.toLowerCase()), loading: false });
      return;
    }

    let cancelled = false;
    setData((prev) => ({ ...prev, loading: true }));

    fetch(`/api/ship-images/lookup/${encodeURIComponent(shipType)}`, { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error('Not found');
        return res.json();
      })
      .then((img) => {
        if (cancelled) return;
        const result = {
          imageUrl: img.image_url,
          thumbnailUrl: img.thumbnail_url,
          license: {
            type: img.license,
            url: img.license_url,
            author: img.author,
            source: img.source_url,
          },
        };
        imageCache.set(shipType.toLowerCase(), result);
        setData({ ...result, loading: false });
      })
      .catch(() => {
        if (!cancelled) {
          setData({ imageUrl: null, thumbnailUrl: null, loading: false, license: null });
        }
      });

    return () => { cancelled = true; };
  }, [shipType]);

  return data;
}
