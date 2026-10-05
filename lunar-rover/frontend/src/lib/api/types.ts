/** Shapes of the backend's JSON documents. Coordinates are projected metres: x = east, y = north. */

export interface Fact {
  text: string;
  source: string;
}

export interface PoiSummary {
  id: string;
  category: string;
  kind: string;
  name: string;
  x: number;
  y: number;
  lon: number;
  lat: number;
  elevation_m: number;
  radius_m: number;
  pole: boolean;
  props: Record<string, number | string | boolean>;
  distance_m?: number;
  bearing_deg?: number;
}

export interface PoiDetail extends PoiSummary {
  summary: string;
  facts: Fact[];
  namesake: string | null;
  link: string | null;
}

export interface Category {
  id: string;
  label: string;
  description: string;
  color: string;
  count: number;
}

export interface TileLevel {
  z: number;
  cell_m: number;
  tiles_per_side: number;
}

export interface TileInfo {
  cells: number;
  samples: number;
  max_level: number;
  extent_m: number;
  height_min_m: number;
  height_max_m: number;
  slope_full_scale_deg: number;
  levels: TileLevel[];
  available: Record<string, [number, number][]>;
}

export interface DatasetCredit {
  id: string;
  title: string;
  provider: string;
  citation: string;
  url: string;
  published: string;
  plain: string;
  used_for: string;
}

export interface ExtraCredit {
  title: string;
  provider: string;
  published: string;
  plain: string;
  used_for: string;
}

export interface Region {
  name: string;
  description: string;
  extent: { xmin: number; xmax: number; ymin: number; ymax: number };
  coverage: { area_km2: number; moon_surface_km2: number; fraction_of_moon: number; fraction_of_extent: number; max_latitude_deg: number; note: string };
  tiles: TileInfo;
  overview: { size_px: number; images: Record<string, string> };
  datasets: DatasetCredit[];
  extra_credits: ExtraCredit[];
}

export interface Locate {
  x: number;
  y: number;
  lon: number;
  lat: number;
  in_coverage: boolean;
  elevation_m?: number;
  slope_deg?: number;
  sun_visibility_pct?: number;
  in_shadow_region?: boolean;
  inside?: { id: string; name: string; kind: string }[];
  nearest_poi?: { id: string; name: string; kind: string; distance_m: number; bearing_deg: number };
}

export interface Route {
  waypoints: [number, number][];
  distance_m: number;
  straight_line_m: number;
  ascent_m: number;
  max_waypoint_slope_deg: number;
  crosses_steep_terrain: boolean;
  planner_resolution_m: number;
}
