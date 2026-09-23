export type ScenePhase = 'globe' | 'dropping' | 'redirecting' | 'surface';

export type ActiveLayer = 'none' | 'ice' | 'craters' | 'terrain';

export type HotspotId = 'south_pole';

export interface CraterMarker {
  id: string;
  name: string;
  x: number;          // Normalized 0.0 - 1.0 (hotspot x)
  y: number;          // Normalized 0.0 - 1.0 (hotspot y)
  radius: number;     // Normalized radius (relative to hotspot width)
  depth_m: number;
  confidence: number;
  type: string;
}

export interface NavCell {
  ice_probability: number;
  terrain_class: string;
  in_crater: boolean;
  hazard_cost: number;
}

export type GridPosition = [number, number]; // [row, col]

export type RoverMovementState = 'idle' | 'driving' | 'turning';

export type CameraMode = 'chase' | 'fpv' | 'orbit';

export type DriveMode = 'manual' | 'auto';

export interface HotspotBounds {
  latMin: number;
  latMax: number;
  lonMin: number;
  lonMax: number;
}

export interface HotspotConfig {
  id: HotspotId;
  label: string;
  sublabel: string;
  centerLat: number;
  centerLon: number;
  bounds: HotspotBounds;
  dataPath: string;
  surveyedAreaKm2: number;
}

export interface MissionTelemetry {
  nearestIceDistanceMeters: number | null;
  nearestIceProbability: number | null;
  currentHazardCost: number;
  currentTerrainClass: string;
  isInCrater: boolean;
  activePathLengthMeters: number | null;
  navState: RoverMovementState;
}
