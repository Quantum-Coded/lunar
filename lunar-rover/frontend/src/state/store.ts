import { create } from "zustand";
import type { Category, Fact, Locate, PoiDetail, PoiSummary, Region, Route } from "@/lib/api/types";
import type { TerrainStreamer } from "@/lib/terrain/streamer";

/** Top speeds (m/s) the player can pick. Real rovers crawl at centimetres per second; these are game-scale speeds. */
export const SPEED_LEVELS_MPS = [10, 30, 60, 120, 300];
const DEFAULT_SPEED_LEVEL = 2;

export interface ActiveRoute {
  goal: PoiSummary;
  route: Route;
}

interface GameState {
  // --- loaded once ---
  region: Region | null;
  categories: Category[];
  zoneFacts: Fact[];
  allPois: PoiSummary[];
  poles: PoiSummary[];
  streamer: TerrainStreamer | null;
  loadError: string | null;
  setBootData: (data: { region: Region; categories: Category[]; zoneFacts: Fact[]; allPois: PoiSummary[]; poles: PoiSummary[] }) => void;
  setStreamer: (s: TerrainStreamer) => void;
  setLoadError: (message: string) => void;

  // --- driving ---
  speedLevel: number;
  changeSpeedLevel: (delta: number) => void;

  // --- telemetry (throttled copy of the live pose) ---
  telemetry: { x: number; y: number; headingDeg: number; speed: number; elevation: number; slopeDeg: number };
  setTelemetry: (t: GameState["telemetry"]) => void;
  locate: Locate | null;
  setLocate: (l: Locate) => void;

  // --- navigation ---
  selected: PoiDetail | null;
  select: (poi: PoiDetail | null) => void;
  activeRoute: ActiveRoute | null;
  setActiveRoute: (r: ActiveRoute | null) => void;
  autopilot: boolean;
  setAutopilot: (on: boolean) => void;
  arrivedAt: PoiSummary | null;
  setArrivedAt: (p: PoiSummary | null) => void;

  // --- info poles ---
  nearbyPole: PoiDetail | null;
  setNearbyPole: (p: PoiDetail | null) => void;
  dismissedPoles: Set<string>;
  dismissPole: (id: string) => void;
}

export const useGame = create<GameState>((set) => ({
  region: null,
  categories: [],
  zoneFacts: [],
  allPois: [],
  poles: [],
  streamer: null,
  loadError: null,
  setBootData: (d) => set(d),
  setStreamer: (streamer) => set({ streamer }),
  setLoadError: (loadError) => set({ loadError }),

  speedLevel: DEFAULT_SPEED_LEVEL,
  changeSpeedLevel: (delta) => set((s) => ({ speedLevel: Math.max(0, Math.min(SPEED_LEVELS_MPS.length - 1, s.speedLevel + delta)) })),

  telemetry: { x: 0, y: 0, headingDeg: 0, speed: 0, elevation: 0, slopeDeg: 0 },
  setTelemetry: (telemetry) => set({ telemetry }),
  locate: null,
  setLocate: (locate) => set({ locate }),

  selected: null,
  select: (selected) => set({ selected }),
  activeRoute: null,
  setActiveRoute: (activeRoute) => set({ activeRoute, arrivedAt: null }),
  autopilot: false,
  setAutopilot: (autopilot) => set({ autopilot }),
  arrivedAt: null,
  setArrivedAt: (arrivedAt) => set({ arrivedAt }),

  nearbyPole: null,
  setNearbyPole: (nearbyPole) => set({ nearbyPole }),
  dismissedPoles: new Set(),
  dismissPole: (id) => set((s) => ({ dismissedPoles: new Set(s.dismissedPoles).add(id), nearbyPole: s.nearbyPole?.id === id ? null : s.nearbyPole })),
}));
