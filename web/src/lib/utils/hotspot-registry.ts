import { HotspotConfig, HotspotId } from '@/types';

export const HOTSPOTS: Record<HotspotId, HotspotConfig> = {
  south_pole: {
    id: 'south_pole',
    label: 'Shackleton Crater — Lunar South Pole',
    sublabel: 'Artemis Target Zone • Permanently Shadowed Region (PSR)',
    centerLat: -89.9,
    centerLon: 0.0,
    bounds: {
      latMin: -90.0,
      latMax: -85.0,
      lonMin: -180.0,
      lonMax: 180.0
    },
    dataPath: '/data/hotspots/south_pole',
    surveyedAreaKm2: 450
  }
};

/**
 * Evaluates whether a given lunar lat/lon coordinate falls within a surveyed hotspot zone.
 */
export function isInsideHotspot(lat: number, lon: number): HotspotConfig | null {
  for (const hotspot of Object.values(HOTSPOTS)) {
    const b = hotspot.bounds;
    if (lat >= b.latMin && lat <= b.latMax && lon >= b.lonMin && lon <= b.lonMax) {
      return hotspot;
    }
  }
  return null;
}

/**
 * Returns the nearest surveyed hotspot to any arbitrary point on the Moon.
 */
export function getClosestHotspot(lat: number, lon: number): HotspotConfig {
  // Currently Shackleton is the primary AI4Science surveyed zone
  return HOTSPOTS.south_pole;
}

/**
 * Generates a uniformly distributed random point on a sphere.
 */
export function getRandomPointOnMoon(): { lat: number; lon: number } {
  // Uniform sampling on sphere: z = sin(lat) uniform in [-1, 1]
  const u = Math.random();
  const v = Math.random();
  const z = 2 * u - 1;
  const lat = Math.asin(z) * (180 / Math.PI);
  const lon = v * 360 - 180;
  return { lat, lon };
}
