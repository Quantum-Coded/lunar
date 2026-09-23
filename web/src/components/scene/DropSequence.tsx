'use client';

import React, { useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useMissionStore } from '@/lib/scene-state/store';
import { latLonToSphere } from '@/lib/utils/coordinates';
import { RedirectSequence } from './RedirectSequence';

export function DropSequence() {
  const { camera } = useThree();
  const dropTarget = useMissionStore((s) => s.dropTarget);
  const setPhase = useMissionStore((s) => s.setPhase);
  const setStatusMessage = useMissionStore((s) => s.setStatusMessage);

  const [isRedirecting, setIsRedirecting] = useState(false);
  const progressRef = useRef(0);
  const capsuleRef = useRef<THREE.Group>(null);
  const impactParticlesRef = useRef<THREE.Points>(null);
  const [impactTriggered, setImpactTriggered] = useState(false);

  const targetCoords = dropTarget || { lat: -89.9, lon: 0.0, isHotspot: true };

  // Starting orbital position (altitude above surface)
  const [surfacePos, orbitPos] = React.useMemo(() => {
    const sPos = new THREE.Vector3(...latLonToSphere(targetCoords.lat, targetCoords.lon, 1.02));
    const oPos = sPos.clone().multiplyScalar(2.4);
    return [sPos, oPos];
  }, [targetCoords.lat, targetCoords.lon]);

  // Dust puff particles on impact
  const dustGeo = React.useMemo(() => {
    const count = 60;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i++) {
      pos[i] = (Math.random() - 0.5) * 0.15;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return geo;
  }, []);

  useFrame((_, delta) => {
    if (isRedirecting) return;

    progressRef.current += delta * 0.5; // ~2.0s free-fall descent
    const t = Math.min(1.0, progressRef.current);

    // Eased descent: cubic ease-in
    const easedT = t * t * t;
    const currentPos = new THREE.Vector3().lerpVectors(orbitPos, surfacePos, easedT);

    if (capsuleRef.current) {
      capsuleRef.current.position.copy(currentPos);
      capsuleRef.current.lookAt(surfacePos);
    }

    // Camera tracks descent
    const camTarget = currentPos.clone().add(currentPos.clone().normalize().multiplyScalar(0.8));
    camera.position.lerp(camTarget, 0.06);
    camera.lookAt(currentPos);

    if (t < 0.5) {
      setStatusMessage('DE-ORBIT BURN COMPLETE. FREE-FALL TRAJECTORY TOWARD LUNAR SURFACE...');
    } else if (t < 0.9) {
      setStatusMessage('ATMOSPHERIC SENSORS: VACUUM. RETRO-THRUST ENGAGED...');
    }

    // Impact Touchdown
    if (t >= 1.0 && !impactTriggered) {
      setImpactTriggered(true);
      if (targetCoords.isHotspot) {
        setStatusMessage('TOUCHDOWN CONFIRMED: SHACKLETON SURVEY ZONE. DEPLOYING ROVER SYSTEMS...');
        setTimeout(() => {
          setPhase('surface');
        }, 1200);
      } else {
        // Trigger Case B redirect
        setIsRedirecting(true);
      }
    }
  });

  if (isRedirecting) {
    return (
      <RedirectSequence
        startLat={targetCoords.lat}
        startLon={targetCoords.lon}
        onComplete={() => {
          setStatusMessage('REDIRECT TOUCHDOWN CONFIRMED: SHACKLETON HOTSPOT. INITIALIZING SURFACE MODE...');
          setTimeout(() => {
            setPhase('surface');
          }, 1000);
        }}
      />
    );
  }

  return (
    <group>
      {/* Falling Lander Capsule */}
      <group ref={capsuleRef} position={orbitPos}>
        {/* Sleek metallic entry capsule */}
        <mesh>
          <coneGeometry args={[0.025, 0.05, 8]} />
          <meshStandardMaterial color="#38bdf8" roughness={0.3} metalness={0.8} />
        </mesh>
        {/* Thruster exhaust glow */}
        <pointLight color="#06b6d4" intensity={2} distance={0.3} />
      </group>

      {/* Touchdown Dust Particles */}
      {impactTriggered && (
        <points ref={impactParticlesRef} position={surfacePos} geometry={dustGeo}>
          <pointsMaterial
            size={0.02}
            color="#cbd5e1"
            transparent
            opacity={0.8}
            blending={THREE.AdditiveBlending}
          />
        </points>
      )}
    </group>
  );
}
