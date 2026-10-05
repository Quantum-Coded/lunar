"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { sunDirection } from "./sun";

const SKY_RADIUS = 600_000;

function glowTexture(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.08, "rgba(255,244,214,1)");
  g.addColorStop(0.2, "rgba(255,220,150,0.35)");
  g.addColorStop(1, "rgba(255,200,120,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

/** Star field and Sun, re-centred on the camera every frame so they sit at infinity. */
export function Sky() {
  const group = useRef<THREE.Group>(null);
  const sun = useRef<THREE.Sprite>(null);
  const glow = useMemo(glowTexture, []);
  const stars = useMemo(() => {
    const count = 3500;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const u = Math.random() * 2 - 1, phi = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u);
      positions.set([r * Math.cos(phi) * SKY_RADIUS, u * SKY_RADIUS, r * Math.sin(phi) * SKY_RADIUS], i * 3);
      const warmth = 0.75 + Math.random() * 0.25, brightness = 0.35 + Math.random() * 0.65;
      colors.set([brightness, brightness * warmth, brightness * (0.8 + Math.random() * 0.2)], i * 3);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return geometry;
  }, []);

  useFrame(({ camera }) => {
    group.current?.position.copy(camera.position);
    sun.current?.position.copy(sunDirection).multiplyScalar(SKY_RADIUS * 0.95);
  });

  return (
    <group ref={group}>
      <points geometry={stars} frustumCulled={false}>
        <pointsMaterial size={2.2} sizeAttenuation={false} vertexColors depthWrite={false} fog={false} toneMapped={false} />
      </points>
      <sprite ref={sun} scale={[60_000, 60_000, 1]} frustumCulled={false}>
        <spriteMaterial map={glow} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} fog={false} />
      </sprite>
    </group>
  );
}
