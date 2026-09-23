import { create } from 'zustand';
import * as THREE from 'three';
import { 
  ScenePhase, 
  ActiveLayer, 
  HotspotId, 
  CraterMarker, 
  NavCell, 
  GridPosition, 
  RoverMovementState,
  MissionTelemetry,
  CameraMode,
  DriveMode
} from '@/types';

interface MissionStore {
  phase: ScenePhase;
  activeLayer: ActiveLayer;
  activeHotspot: HotspotId | null;
  dropTarget: { lat: number; lon: number; isHotspot: boolean } | null;
  
  // Navigation & Rover
  roverGridPos: GridPosition;
  targetGridPos: GridPosition | null;
  activePath: GridPosition[];
  pathWaypointsWorld: [number, number, number][];
  roverMovementState: RoverMovementState;
  roverHeading: number; // in radians
  driveMode: DriveMode;
  cameraMode: CameraMode;
  pathProgress: number; // 0.0 to 1.0
  currentWaypointIdx: number;
  terrainMesh: THREE.Mesh | null;
  
  // Model Data
  craters: CraterMarker[];
  navGrid: NavCell[][] | null;
  
  // Telemetry & Status
  telemetry: MissionTelemetry;
  statusMessage: string;
  isAutoNavigating: boolean;

  // Actions
  setPhase: (phase: ScenePhase) => void;
  setActiveLayer: (layer: ActiveLayer) => void;
  setActiveHotspot: (hotspot: HotspotId | null) => void;
  setDropTarget: (target: { lat: number; lon: number; isHotspot: boolean } | null) => void;
  setRoverGridPos: (pos: GridPosition) => void;
  setTargetGridPos: (pos: GridPosition | null) => void;
  setActivePath: (path: GridPosition[], worldWaypoints?: [number, number, number][]) => void;
  setRoverMovementState: (state: RoverMovementState) => void;
  setRoverHeading: (heading: number) => void;
  setDriveMode: (mode: DriveMode) => void;
  setCameraMode: (mode: CameraMode) => void;
  setPathProgress: (progress: number) => void;
  setCurrentWaypointIdx: (idx: number) => void;
  setTerrainMesh: (mesh: THREE.Mesh | null) => void;
  setCraters: (craters: CraterMarker[]) => void;
  setNavGrid: (grid: NavCell[][]) => void;
  updateTelemetry: (partial: Partial<MissionTelemetry>) => void;
  setStatusMessage: (message: string) => void;
  setIsAutoNavigating: (val: boolean) => void;
  resetToOrbit: () => void;
}

const DEFAULT_TELEMETRY: MissionTelemetry = {
  nearestIceDistanceMeters: null,
  nearestIceProbability: null,
  currentHazardCost: 1.0,
  currentTerrainClass: 'regolith_plain',
  isInCrater: false,
  activePathLengthMeters: null,
  navState: 'idle'
};

export const useMissionStore = create<MissionStore>((set) => ({
  phase: 'globe',
  activeLayer: 'none',
  activeHotspot: null,
  dropTarget: null,
  
  // Initial spawn near south ridge rim of Shackleton
  roverGridPos: [195, 175],
  targetGridPos: null,
  activePath: [],
  pathWaypointsWorld: [],
  roverMovementState: 'idle',
  roverHeading: 0,
  driveMode: 'manual',
  cameraMode: 'chase',
  pathProgress: 0,
  currentWaypointIdx: 0,
  terrainMesh: null,
  
  craters: [],
  navGrid: null,
  
  telemetry: DEFAULT_TELEMETRY,
  statusMessage: 'SYSTEMS NOMINAL. STANDING BY IN LUNAR ORBIT (100 KM). CLICK "DROP ROVER" TO INITIATE DE-ORBIT BURN.',
  isAutoNavigating: false,

  setPhase: (phase) => set({ phase }),
  setActiveLayer: (activeLayer) => set({ activeLayer }),
  setActiveHotspot: (activeHotspot) => set({ activeHotspot }),
  setDropTarget: (dropTarget) => set({ dropTarget }),
  setRoverGridPos: (roverGridPos) => set({ roverGridPos }),
  setTargetGridPos: (targetGridPos) => set({ targetGridPos }),
  setActivePath: (activePath, pathWaypointsWorld = []) => set({ 
    activePath, 
    pathWaypointsWorld, 
    currentWaypointIdx: 0, 
    pathProgress: 0,
    isAutoNavigating: activePath.length > 0,
    driveMode: activePath.length > 0 ? 'auto' : 'manual'
  }),
  setRoverMovementState: (roverMovementState) => set((s) => ({ 
    roverMovementState, 
    telemetry: { ...s.telemetry, navState: roverMovementState } 
  })),
  setRoverHeading: (roverHeading) => set({ roverHeading }),
  setDriveMode: (driveMode) => set({ driveMode }),
  setCameraMode: (cameraMode) => set({ cameraMode }),
  setPathProgress: (pathProgress) => set({ pathProgress }),
  setCurrentWaypointIdx: (currentWaypointIdx) => set({ currentWaypointIdx }),
  setTerrainMesh: (terrainMesh) => set({ terrainMesh }),
  setCraters: (craters) => set({ craters }),
  setNavGrid: (navGrid) => set({ navGrid }),
  updateTelemetry: (partial) => set((s) => ({ telemetry: { ...s.telemetry, ...partial } })),
  setStatusMessage: (statusMessage) => set({ statusMessage }),
  setIsAutoNavigating: (isAutoNavigating) => set({ isAutoNavigating }),
  
  resetToOrbit: () => set({
    phase: 'globe',
    activeLayer: 'none',
    activeHotspot: null,
    dropTarget: null,
    roverGridPos: [195, 175],
    targetGridPos: null,
    activePath: [],
    pathWaypointsWorld: [],
    roverMovementState: 'idle',
    roverHeading: 0,
    driveMode: 'manual',
    cameraMode: 'chase',
    pathProgress: 0,
    currentWaypointIdx: 0,
    terrainMesh: null,
    isAutoNavigating: false,
    telemetry: DEFAULT_TELEMETRY,
    statusMessage: 'ORBITAL RELOAD COMPLETE. VESSEL READY FOR DE-ORBIT INJECTION.'
  })
}));
