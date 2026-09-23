'use client';

import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { useMissionStore } from '@/lib/scene-state/store';
import { GlobalMoon } from './GlobalMoon';
import { DropSequence } from './DropSequence';
import { HotspotTerrain } from './HotspotTerrain';

export function MissionScene() {
  const phase = useMissionStore((s) => s.phase);

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
      <Canvas
        camera={{ position: [0, 0.8, 3.2], fov: 45, near: 0.1, far: 1000 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      >
        <color attach="background" args={['#030712']} />

        {/* Cinematic Deep Space Stars */}
        <Stars
          radius={150}
          depth={80}
          count={7000}
          factor={4}
          saturation={0.1}
          fade
          speed={0.8}
        />

        <Suspense fallback={null}>
          {/* Orbital Globe Phases */}
          {(phase === 'globe' || phase === 'dropping' || phase === 'redirecting') && (
            <group>
              <GlobalMoon />
              {(phase === 'dropping' || phase === 'redirecting') && <DropSequence />}
            </group>
          )}

          {/* Surface Traverse Phase */}
          {phase === 'surface' && <HotspotTerrain />}
        </Suspense>

        {/* Post-Processing Effects for Glowing Overlays and Cinematic Contrast */}
        <EffectComposer multisampling={4}>
          <Bloom
            intensity={0.65}
            luminanceThreshold={0.7}
            luminanceSmoothing={0.3}
          />
          <Vignette eskil={false} offset={0.15} darkness={0.85} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
