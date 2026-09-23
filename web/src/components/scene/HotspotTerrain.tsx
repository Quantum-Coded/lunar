'use client';

import React, { useRef, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useTexture } from '@react-three/drei';
import { ThreeEvent } from '@react-three/fiber';
import { useMissionStore } from '@/lib/scene-state/store';
import { loadNavGrid, loadCraters } from '@/lib/data-loaders/hotspot';
import { findAStarPath, findNearestIceDeposit } from '@/lib/pathfinding/astar';
import { worldToGrid } from '@/lib/utils/coordinates';
import { buildDisplacedTerrainGeometry } from '@/lib/utils/terrainDisplacement';
import { Rover } from './Rover';
import { Overlays } from './Overlays';
import { PathTrail } from './PathTrail';
import { ChaseCamera } from './ChaseCamera';
import { TerrainOverlayMesh } from './TerrainOverlayMesh';

export function HotspotTerrain() {
  const meshRef = useRef<THREE.Mesh>(null);
  const roverRef = useRef<THREE.Group>(null);
  
  // Store state
  const activeLayer = useMissionStore((s) => s.activeLayer);
  const craters = useMissionStore((s) => s.craters);
  const navGrid = useMissionStore((s) => s.navGrid);
  const roverGridPos = useMissionStore((s) => s.roverGridPos);
  const setCraters = useMissionStore((s) => s.setCraters);
  const setNavGrid = useMissionStore((s) => s.setNavGrid);
  const setActivePath = useMissionStore((s) => s.setActivePath);
  const setTargetGridPos = useMissionStore((s) => s.setTargetGridPos);
  const setRoverMovementState = useMissionStore((s) => s.setRoverMovementState);
  const setTerrainMesh = useMissionStore((s) => s.setTerrainMesh);
  const updateTelemetry = useMissionStore((s) => s.updateTelemetry);
  const setStatusMessage = useMissionStore((s) => s.setStatusMessage);

  // Load textures
  const [baseTexture, heightmap, iceHeatmap, terrainClasses] = useTexture([
    '/data/hotspots/south_pole/base_texture.jpg',
    '/data/hotspots/south_pole/heightmap.png',
    '/data/hotspots/south_pole/ice_heatmap.png',
    '/data/hotspots/south_pole/terrain_classes.png'
  ]);

  // Build physical CPU displaced geometry for 3D terrain and raycasting
  const displacedGeometry = useMemo(() => {
    if (!heightmap?.image) return null;
    return buildDisplacedTerrainGeometry(heightmap.image as HTMLImageElement, 10, 256, 0.7, -0.35);
  }, [heightmap]);

  // Register terrain mesh with store for Raycasting and height sampling
  useEffect(() => {
    if (meshRef.current) {
      setTerrainMesh(meshRef.current);
    }
    return () => {
      setTerrainMesh(null);
    };
  }, [setTerrainMesh, displacedGeometry]);

  // Load model navigation grid and crater detections
  useEffect(() => {
    let mounted = true;
    async function initData() {
      try {
        const [grid, crts] = await Promise.all([
          loadNavGrid('south_pole'),
          loadCraters('south_pole')
        ]);
        if (!mounted) return;
        setNavGrid(grid);
        setCraters(crts);

        // Compute initial telemetry
        const iceScan = findNearestIceDeposit(grid, roverGridPos);
        const currCell = grid[roverGridPos[0]][roverGridPos[1]];
        updateTelemetry({
          currentHazardCost: currCell.hazard_cost,
          currentTerrainClass: currCell.terrain_class,
          isInCrater: currCell.in_crater,
          nearestIceDistanceMeters: iceScan ? iceScan.distanceMeters : null,
          nearestIceProbability: iceScan ? iceScan.iceProb : null
        });
      } catch (err) {
        console.error('Failed to load hotspot data:', err);
      }
    }
    initData();
    return () => { mounted = false; };
  }, [setNavGrid, setCraters, updateTelemetry, roverGridPos]);

  // Click-to-Navigate Handler
  const handleTerrainClick = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (!navGrid) return;

    const hit = e.point;
    const targetCell = worldToGrid(hit.x, hit.z, 256, 10);
    setTargetGridPos(targetCell);

    const [tr, tc] = targetCell;
    const targetInfo = navGrid[tr][tc];

    setStatusMessage(
      `CALCULATING A* TRAVERSE TO [${tr}, ${tc}] (${targetInfo.terrain_class}, HAZARD: ${targetInfo.hazard_cost.toFixed(1)}x)...`
    );

    const path = findAStarPath(navGrid, roverGridPos, targetCell);
    if (path.length > 0) {
      setActivePath(path);
      setRoverMovementState('turning');
      setStatusMessage(
        `OPTIMAL HAZARD-AVOIDING PATH COMPUTED (${path.length} WAYPOINTS). ROVER ADVANCING...`
      );
    } else {
      setStatusMessage('TARGET UNREACHABLE: SEVERE OBSTACLE / EXCLUSION ZONE.');
    }
  };

  return (
    <group>
      {/* Grazing Lunar Directional Sun Light (calibrated to sun_elevation_deg: 1.37°) */}
      <directionalLight
        position={[-11, 1.4, 7.5]}
        intensity={3.2}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={0.5}
        shadow-camera-far={25}
        shadow-camera-left={-7}
        shadow-camera-right={7}
        shadow-camera-top={7}
        shadow-camera-bottom={-7}
        shadow-bias={-0.0004}
      />
      {/* Subtle blue earthshine fill light */}
      <directionalLight position={[0, 10, 0]} intensity={0.08} color="#93c5fd" />
      <ambientLight intensity={0.07} />

      {/* Main Heightmapped 3D Terrain Plane */}
      <mesh
        ref={meshRef}
        geometry={displacedGeometry || undefined}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        onPointerDown={handleTerrainClick}
        receiveShadow
        castShadow
      >
        {!displacedGeometry && <planeGeometry args={[10, 10, 256, 256]} />}
        <meshStandardMaterial
          map={baseTexture}
          roughness={0.92}
          metalness={0.05}
        />
      </mesh>

      {/* Terrain-Conforming Heatmap & Segmentation Overlay Mesh */}
      <TerrainOverlayMesh
        geometry={displacedGeometry}
        activeLayer={activeLayer}
        iceHeatmap={iceHeatmap}
        terrainClasses={terrainClasses}
      />

      {/* AI Crater Hazard Overlays */}
      <Overlays craters={craters} />

      {/* Glowing A* Trajectory Trail conforming to surface */}
      <PathTrail />

      {/* Animated 3D Drivable Rover */}
      <Rover ref={roverRef} />

      {/* Third-Person Chase / FPV Camera System */}
      <ChaseCamera roverRef={roverRef} />
    </group>
  );
}
