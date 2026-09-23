'use client';

import React, { useMemo } from 'react';
import * as THREE from 'three';
import { ActiveLayer } from '@/types';

interface TerrainOverlayMeshProps {
  geometry: THREE.BufferGeometry | null;
  activeLayer: ActiveLayer;
  iceHeatmap: THREE.Texture;
  terrainClasses: THREE.Texture;
}

export function TerrainOverlayMesh({
  geometry,
  activeLayer,
  iceHeatmap,
  terrainClasses,
}: TerrainOverlayMeshProps) {
  const overlayConfig = useMemo(() => {
    if (activeLayer === 'ice') {
      return {
        texture: iceHeatmap,
        opacity: 0.82,
        emissiveIntensity: 0.35,
      };
    }
    if (activeLayer === 'terrain') {
      return {
        texture: terrainClasses,
        opacity: 0.75,
        emissiveIntensity: 0.15,
      };
    }
    return null;
  }, [activeLayer, iceHeatmap, terrainClasses]);

  if (!overlayConfig || !geometry) return null;

  return (
    <mesh
      geometry={geometry}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0, 0]}
    >
      <meshStandardMaterial
        map={overlayConfig.texture}
        emissiveMap={overlayConfig.texture}
        emissive={new THREE.Color(0xffffff)}
        emissiveIntensity={overlayConfig.emissiveIntensity}
        transparent
        opacity={overlayConfig.opacity}
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={-2}
        polygonOffsetUnits={-2}
        roughness={0.8}
        metalness={0.1}
      />
    </mesh>
  );
}
