import { useState, useEffect } from 'react';

const vehicleCache = new Map();

/**
 * Hook to fetch and cache vehicle data (images, specs, license info) from the backend proxy.
 * Queries the SC Wiki API via /api/ship-images/lookup/:shipType and caches results in-memory.
 * Returns { imageUrl, thumbnailUrl, loading, license, vehicleData }
 */
export function useVehicleData(shipType) {
  const [data, setData] = useState({
    imageUrl: null,
    thumbnailUrl: null,
    loading: !!shipType,
    license: null,
    vehicleData: null,
  });

  useEffect(() => {
    if (!shipType) {
      setData({ imageUrl: null, thumbnailUrl: null, loading: false, license: null, vehicleData: null });
      return;
    }

    // Check in-memory cache
    if (vehicleCache.has(shipType.toLowerCase())) {
      setData({ ...vehicleCache.get(shipType.toLowerCase()), loading: false });
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
          vehicleData: {
            displayName: img.display_name || null,
            crewMax: img.crew_max ?? null,
            fuelCapacity: img.fuel_capacity != null ? Number(img.fuel_capacity) : null,
            cargoCapacity: img.cargo_capacity != null ? Number(img.cargo_capacity) : null,
            hullHp: img.hull_hp != null ? Number(img.hull_hp) : null,
            sizeCategory: img.size_category || null,
            manufacturer: img.manufacturer || null,
            vehicleCategory: img.vehicle_category || null,
          },
        };
        vehicleCache.set(shipType.toLowerCase(), result);
        setData({ ...result, loading: false });
      })
      .catch(() => {
        if (!cancelled) {
          setData({ imageUrl: null, thumbnailUrl: null, loading: false, license: null, vehicleData: null });
        }
      });

    return () => { cancelled = true; };
  }, [shipType]);

  return data;
}
