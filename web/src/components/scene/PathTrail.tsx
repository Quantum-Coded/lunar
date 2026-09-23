'use client';

import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useMissionStore } from '@/lib/scene-state/store';
import { gridToWorld } from '@/lib/utils/coordinates';
import { sampleTerrainHeight } from '@/lib/utils/terrainDisplacement';

export function PathTrail() {
  const activePath = useMissionStore((s) => s.activePath);
  const targetGridPos = useMissionStore((s) => s.targetGridPos);
  const currentWaypointIdx = useMissionStore((s) => s.currentWaypointIdx);
  const terrainMesh = useMissionStore((s) => s.terrainMesh);
  const targetRingRef = useRef<THREE.Mesh>(null);

  // Convert remaining untraversed grid waypoints to 3D terrain-conforming line points
  const points = useMemo(() => {
    if (!activePath || activePath.length < 2) return [];

    // Slice path from current progress so visited segment disappears
    const startIdx = Math.min(activePath.length - 1, Math.max(0, currentWaypointIdx));
    const remaining = activePath.slice(startIdx);
    if (remaining.length < 2) return [];

    return remaining.map(([r, c]) => {
      const [x, , z] = gridToWorld(r, c, 256, 10);
      const { y } = sampleTerrainHeight(x, z, terrainMesh, 0.05);
      return new THREE.Vector3(x, y + 0.035, z); // float just above displaced surface
    });
  }, [activePath, currentWaypointIdx, terrainMesh]);

  const lineGeometry = useMemo(() => {
    if (points.length < 2) return null;
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [points]);

  // Target destination 3D coordinates
  const targetWorldPos = useMemo(() => {
    if (activePath.length > 0) {
      const last = activePath[activePath.length - 1];
      const [x, , z] = gridToWorld(last[0], last[1], 256, 10);
      const { y } = sampleTerrainHeight(x, z, terrainMesh, 0.05);
      return new THREE.Vector3(x, y + 0.04, z);
    }
    if (targetGridPos) {
      const [x, , z] = gridToWorld(targetGridPos[0], targetGridPos[1], 256, 10);
      const { y } = sampleTerrainHeight(x, z, terrainMesh, 0.05);
      return new THREE.Vector3(x, y + 0.04, z);
    }
    return null;
  }, [activePath, targetGridPos, terrainMesh]);

  useFrame((_, delta) => {
    if (targetRingRef.current) {
      targetRingRef.current.rotation.z += delta * 1.5;
    }
  });

  const lineObj = useMemo(() => {
    if (!lineGeometry) return null;
    const mat = new THREE.LineDashedMaterial({
      color: 0x22d3ee,
      dashSize: 0.12,
      gapSize: 0.06,
      linewidth: 2,
      transparent: true,
      opacity: 0.95,
    });
    const line = new THREE.Line(lineGeometry, mat);
    line.computeLineDistances();
    return line;
  }, [lineGeometry]);

  return (
    <group>
      {/* Active Trajectory Polyline conforming to lunar surface */}
      {lineObj && <primitive object={lineObj} />}

      {/* Target Marker Ring at destination */}
      {targetWorldPos && (
        <group position={targetWorldPos}>
          <mesh ref={targetRingRef} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.12, 0.16, 24]} />
            <meshBasicMaterial
              color="#06b6d4"
              side={THREE.DoubleSide}
              transparent
              opacity={0.85}
            />
          </mesh>
          <pointLight color="#06b6d4" intensity={1.5} distance={0.8} />
        </group>
      )}
    </group>
  );
}
