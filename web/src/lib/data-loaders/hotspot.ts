import { NavCell, CraterMarker, HotspotConfig, HotspotId } from '@/types';
import { HOTSPOTS } from '@/lib/utils/hotspot-registry';

const navGridCache: Record<string, NavCell[][]> = {};
const cratersCache: Record<string, CraterMarker[]> = {};

/**
 * Loads and expands the compact nav_grid.json into a fast 2D NavCell[][] array.
 */
export async function loadNavGrid(hotspotId: HotspotId = 'south_pole'): Promise<NavCell[][]> {
  if (navGridCache[hotspotId]) {
    return navGridCache[hotspotId];
  }

  const response = await fetch(`/data/hotspots/${hotspotId}/nav_grid.json`);
  if (!response.ok) {
    throw new Error(`Failed to load nav_grid for ${hotspotId}: ${response.statusText}`);
  }

  const rawData = await response.json();

  // If already expanded NavCell[][]
  if (Array.isArray(rawData) && Array.isArray(rawData[0]) && typeof rawData[0][0] === 'object') {
    navGridCache[hotspotId] = rawData as NavCell[][];
    return navGridCache[hotspotId];
  }

  // Compact format: { width, height, classes, cells: [[p_ice, class_idx, in_crater_int, cost], ...] }
  const { classes, cells } = rawData;
  const grid: NavCell[][] = [];

  for (let r = 0; r < cells.length; r++) {
    const row: NavCell[] = [];
    const rawRow = cells[r];
    for (let c = 0; c < rawRow.length; c++) {
      const item = rawRow[c];
      row.push({
        ice_probability: item[0],
        terrain_class: classes[item[1]] || 'regolith_plain',
        in_crater: item[2] === 1,
        hazard_cost: item[3]
      });
    }
    grid.push(row);
  }

  navGridCache[hotspotId] = grid;
  return grid;
}

/**
 * Loads crater detections from craters.json.
 */
export async function loadCraters(hotspotId: HotspotId = 'south_pole'): Promise<CraterMarker[]> {
  if (cratersCache[hotspotId]) {
    return cratersCache[hotspotId];
  }

  const response = await fetch(`/data/hotspots/${hotspotId}/craters.json`);
  if (!response.ok) {
    throw new Error(`Failed to load craters for ${hotspotId}: ${response.statusText}`);
  }

  const craters: CraterMarker[] = await response.json();
  cratersCache[hotspotId] = craters;
  return craters;
}

/**
 * Returns configuration metadata for the selected hotspot.
 */
export function loadHotspotConfig(hotspotId: HotspotId = 'south_pole'): HotspotConfig {
  return HOTSPOTS[hotspotId] || HOTSPOTS.south_pole;
}
