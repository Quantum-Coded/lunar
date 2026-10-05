"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { buildTileGeometry } from "@/lib/terrain/tileGeometry";
import { createSharedUniforms, createTerrainMaterial } from "@/lib/terrain/terrainMaterial";
import { useGame } from "@/state/store";
import { roverPose } from "@/state/roverPose";
import { sunDirection, updateSun } from "./sun";

const SELECT_INTERVAL_S = 0.03;

/** Draws the quadtree-selected terrain tiles. Tiles are added/removed imperatively as the rover moves. */
export function Terrain() {
  const streamer = useGame((s) => s.streamer)!;
  const groupRef = useRef<THREE.Group>(null);
  const meshes = useRef(new Map<string, THREE.Mesh>());
  const sinceSelect = useRef(Infinity);
  const shared = useMemo(() => createSharedUniforms(), [streamer]);

  useEffect(() => {
    const live = meshes.current;
    return () => {
      live.forEach((m) => {
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      });
      live.clear();
    };
  }, [streamer]);

  useFrame(({ camera, clock }, dt) => {
    const group = groupRef.current;
    if (!group) return;

    shared.uSunDir.value.copy(updateSun(clock.elapsedTime));
    shared.uLampPos.value.set(roverPose.x, roverPose.y + 2.2, roverPose.z);
    const yaw = (roverPose.headingDeg * Math.PI) / 180;
    shared.uLampDir.value.set(Math.sin(yaw), -0.12, -Math.cos(yaw)).normalize();

    sinceSelect.current += dt;
    if (sinceSelect.current < SELECT_INTERVAL_S) return;
    sinceSelect.current = 0;

    const wanted = streamer.select(camera.position.x, camera.position.z);
    streamer.evict();
    const wantedKeys = new Set(wanted.map((t) => `${t.z}/${t.tx}/${t.ty}`));
    for (const [key, mesh] of meshes.current) {
      if (!wantedKeys.has(key)) {
        group.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
        meshes.current.delete(key);
      }
    }
    for (const { z, tx, ty } of wanted) {
      const key = `${z}/${tx}/${ty}`;
      if (meshes.current.has(key)) continue;
      const tile = streamer.get(z, tx, ty)!;
      const geometry = buildTileGeometry(tile.heights, streamer.info.samples, streamer.cellSize(z));
      const mesh = new THREE.Mesh(geometry, createTerrainMaterial(shared, tile.dataTexture));
      const [ox, oz] = streamer.origin(z, tx, ty);
      mesh.position.set(ox, 0, oz);
      group.add(mesh);
      meshes.current.set(key, mesh);
    }
  });

  return <group ref={groupRef} />;
}
