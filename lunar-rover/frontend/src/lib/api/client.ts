import type { Category, Fact, Locate, PoiDetail, PoiSummary, Region, Route } from "./types";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
/** Terrain tiles can be served from a CDN/bucket instead of the API (set NEXT_PUBLIC_TILE_URL, no trailing slash). */
const TILE_URL = process.env.NEXT_PUBLIC_TILE_URL ?? `${API_URL}/api/tiles`;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, init);
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.detail ?? `${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export interface PoiQuery {
  category?: string;
  q?: string;
  near?: { x: number; y: number };
  radiusM?: number;
  polesOnly?: boolean;
  limit?: number;
}

export const api = {
  region: () => request<Region>("/api/region"),
  categories: () => request<Category[]>("/api/categories"),
  zoneFacts: () => request<Fact[]>("/api/zone-facts"),
  poi: (id: string) => request<PoiDetail>(`/api/pois/${encodeURIComponent(id)}`),
  pois: (query: PoiQuery = {}) => {
    const p = new URLSearchParams();
    if (query.category) p.set("category", query.category);
    if (query.q) p.set("q", query.q);
    if (query.near) {
      p.set("near_x", String(query.near.x));
      p.set("near_y", String(query.near.y));
    }
    if (query.radiusM) p.set("radius_m", String(query.radiusM));
    if (query.polesOnly) p.set("poles_only", "true");
    p.set("limit", String(query.limit ?? 50));
    return request<PoiSummary[]>(`/api/pois?${p}`);
  },
  locate: (x: number, y: number) => request<Locate>(`/api/locate?x=${x}&y=${y}`),
  route: (start: [number, number], goal: [number, number]) =>
    request<Route>("/api/route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ start, goal }),
    }),
  tileUrl: (z: number, x: number, y: number, kind: "height" | "data") => `${TILE_URL}/${z}/${x}/${y}/${kind}.png`,
  overviewUrl: (layer: string) => `${API_URL}/api/overview/${layer}.png`,
};
