'use client';

import React from 'react';
import * as THREE from 'three';
import { useMissionStore } from '@/lib/scene-state/store';
import { CraterMarker } from '@/types';

interface OverlaysProps {
  craters: CraterMarker[];
}

export function Overlays({ craters }: OverlaysProps) {
  const activeLayer = useMissionStore((s) => s.activeLayer);

  // Visible whenever layer is 'craters', or subtle indicator
  const isVisible = activeLayer === 'craters';
  if (!isVisible && activeLayer !== 'none') return null;

  const opacity = isVisible ? 0.85 : 0.2;

  return (
    <group position={[0, 0.04, 0]}>
      {craters.map((crater) => {
        // Normalize [0, 1] UV to 10 x 10 plane coordinates centered at (0, 0)
        const posX = (crater.x - 0.5) * 10;
        const posZ = (crater.y - 0.5) * 10;
        const radiusWorld = crater.radius * 10;

        return (
          <group key={crater.id} position={[posX, 0, posZ]}>
            {/* Crater Perimeter Hazard Ring */}
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[radiusWorld * 0.96, radiusWorld * 1.02, 48]} />
              <meshBasicMaterial
                color="#f43f5e"
                side={THREE.DoubleSide}
                transparent
                opacity={opacity}
              />
            </mesh>

            {/* Crater Interior Exclusion Fill (Visible only in crater mode) */}
            {isVisible && (
              <mesh rotation={[-Math.PI / 2, 0, 0]}>
                <circleGeometry args={[radiusWorld * 0.96, 32]} />
                <meshBasicMaterial
                  color="#e11d48"
                  side={THREE.DoubleSide}
                  transparent
                  opacity={0.12}
                />
              </mesh>
            )}

            {/* Center Crosshair Dot */}
            {isVisible && (
              <mesh rotation={[-Math.PI / 2, 0, 0]}>
                <circleGeometry args={[0.04, 16]} />
                <meshBasicMaterial
                  color="#fb7185"
                  side={THREE.DoubleSide}
                  transparent
                  opacity={0.9}
                />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}
