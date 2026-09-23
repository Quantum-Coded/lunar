'use client';

import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useTexture, OrbitControls } from '@react-three/drei';
import { useMissionStore } from '@/lib/scene-state/store';
import { latLonToSphere } from '@/lib/utils/coordinates';
import { HOTSPOTS } from '@/lib/utils/hotspot-registry';

export function GlobalMoon() {
  const meshRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Group>(null);
  const phase = useMissionStore((s) => s.phase);

  // Load NASA SVS texture and LOLA heightmap
  const [texture, heightmap] = useTexture([
    '/data/global/moon_texture.jpg',
    '/data/global/moon_heightmap.png'
  ]);

  useMemo(() => {
    if (texture) {
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
    }
  }, [texture]);

  // Target coordinates for Shackleton Crater (South Pole)
  const southPolePos = useMemo(() => {
    return latLonToSphere(HOTSPOTS.south_pole.centerLat, HOTSPOTS.south_pole.centerLon, 1.02);
  }, []);

  // Idle rotation only during globe phase
  useFrame((_, delta) => {
    if (meshRef.current && phase === 'globe') {
      meshRef.current.rotation.y += delta * 0.04;
    }
    if (ringRef.current) {
      ringRef.current.rotation.z += delta * 0.5;
    }
  });

  return (
    <group>
      {/* Dynamic Sun Light for realistic day/night terminator */}
      <directionalLight
        position={[5, 2, 4]}
        intensity={2.2}
        castShadow
      />
      <ambientLight intensity={0.06} />

      {/* Orbit Controls enabled during globe exploration */}
      <OrbitControls
        enablePan={false}
        enableZoom={phase === 'globe'}
        minDistance={1.3}
        maxDistance={5.0}
        rotateSpeed={0.6}
        dampingFactor={0.05}
      />

      {/* Lunar Sphere */}
      <mesh ref={meshRef} receiveShadow castShadow>
        <sphereGeometry args={[1, 128, 128]} />
        <meshStandardMaterial
          map={texture}
          displacementMap={heightmap}
          displacementScale={0.035}
          displacementBias={-0.01}
          roughness={0.92}
          metalness={0.05}
        />
      </mesh>

      {/* Shackleton Crater Hotspot Target Reticle */}
      {phase === 'globe' && (
        <group position={southPolePos}>
          <group ref={ringRef}>
            {/* Outer pulsating cyan ring */}
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.07, 0.085, 32]} />
              <meshBasicMaterial
                color="#06b6d4"
                side={THREE.DoubleSide}
                transparent
                opacity={0.85}
              />
            </mesh>
            {/* Inner target crosshair dots */}
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.025, 16]} />
              <meshBasicMaterial
                color="#22d3ee"
                side={THREE.DoubleSide}
                transparent
                opacity={0.9}
              />
            </mesh>
          </group>
        </group>
      )}
    </group>
  );
}
