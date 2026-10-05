"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { toWorldX, toWorldZ } from "@/lib/world/coords";
import { useGame } from "@/state/store";

const MAX_POINTS = 4000;
const HEIGHT_ABOVE_GROUND_M = 3;
const REFRESH_S = 1.5;

/** The planned route as a line draped over the terrain, plus a beacon above the destination. */
export function RouteLine() {
  const route = useGame((s) => s.activeRoute);
  const streamer = useGame((s) => s.streamer)!;
  const groupRef = useRef<THREE.Group>(null);
  const since = useRef(Infinity);

  const dense = useMemo(() => {
    if (!route) return null;
    const pts = route.route.waypoints.map(([x, y]) => [toWorldX(x), toWorldZ(y)] as [number, number]);
    const total = pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);
    const spacing = Math.max(40, total / MAX_POINTS);
    const out: [number, number][] = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const [x0, z0] = pts[i - 1], [x1, z1] = pts[i];
      const steps = Math.max(1, Math.round(Math.hypot(x1 - x0, z1 - z0) / spacing));
      for (let s = 1; s <= steps; s++) out.push([x0 + ((x1 - x0) * s) / steps, z0 + ((z1 - z0) * s) / steps]);
    }
    return out;
  }, [route]);

  const line = useMemo(() => {
    if (!dense) return null;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(dense.length * 3), 3));
    const mesh = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: "#ffd24a", depthTest: false, transparent: true, opacity: 0.95 }));
    mesh.renderOrder = 20;
    mesh.frustumCulled = false;
    return mesh;
  }, [dense]);

  const beacon = useMemo(() => {
    if (!route) return null;
    const { goal } = route;
    const base = new THREE.Vector3(toWorldX(goal.x), goal.elevation_m, toWorldZ(goal.y));
    const mesh = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([base, base.clone().add(new THREE.Vector3(0, 4000, 0))]),
      new THREE.LineBasicMaterial({ color: "#ffd24a", depthTest: false, transparent: true, opacity: 0.9 }),
    );
    mesh.renderOrder = 20;
    mesh.frustumCulled = false;
    return mesh;
  }, [route]);

  useEffect(() => {
    const group = groupRef.current;
    if (!group || !line || !beacon) return;
    group.add(line, beacon);
    since.current = Infinity;
    return () => {
      group.remove(line, beacon);
      line.geometry.dispose();
      beacon.geometry.dispose();
    };
  }, [line, beacon]);

  // Terrain detail streams in as the rover moves, so re-drape the line periodically.
  useFrame((_, dt) => {
    if (!line || !dense) return;
    since.current += dt;
    if (since.current < REFRESH_S) return;
    since.current = 0;
    const attr = line.geometry.getAttribute("position") as THREE.BufferAttribute;
    dense.forEach(([x, z], i) => {
      attr.setXYZ(i, x, (streamer.heightAt(x, z) ?? 0) + HEIGHT_ABOVE_GROUND_M, z);
    });
    attr.needsUpdate = true;
  });

  return <group ref={groupRef} />;
}
