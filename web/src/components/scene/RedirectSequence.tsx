'use client';

import React, { useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useMissionStore } from '@/lib/scene-state/store';
import { latLonToSphere } from '@/lib/utils/coordinates';
import { HOTSPOTS } from '@/lib/utils/hotspot-registry';

interface RedirectSequenceProps {
  startLat: number;
  startLon: number;
  onComplete: () => void;
}

export function RedirectSequence({ startLat, startLon, onComplete }: RedirectSequenceProps) {
  const { camera } = useThree();
  const progressRef = useRef(0);
  const thrusterRef = useRef<THREE.Points>(null);
  const setStatusMessage = useMissionStore((s) => s.setStatusMessage);

  const startPos = React.useMemo(() => {
    return new THREE.Vector3(...latLonToSphere(startLat, startLon, 1.05));
  }, [startLat, startLon]);

  const targetPos = React.useMemo(() => {
    return new THREE.Vector3(
      ...latLonToSphere(HOTSPOTS.south_pole.centerLat, HOTSPOTS.south_pole.centerLon, 1.05)
    );
  }, []);

  // Compute parabolic hop midpoint in space
  const midPos = React.useMemo(() => {
    const mid = new THREE.Vector3().addVectors(startPos, targetPos).multiplyScalar(0.5);
    // Push outwards to simulate sub-orbital ballistic hop
    mid.normalize().multiplyScalar(1.6);
    return mid;
  }, [startPos, targetPos]);

  const curve = React.useMemo(() => {
    return new THREE.QuadraticBezierCurve3(startPos, midPos, targetPos);
  }, [startPos, midPos, targetPos]);

  // Particles for thruster fire
  const particleCount = 40;
  const particleGeo = React.useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i++) {
      positions[i] = (Math.random() - 0.5) * 0.08;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, []);

  useFrame((_, delta) => {
    progressRef.current += delta * 0.4; // 2.5 second redirect arc
    const t = Math.min(1.0, progressRef.current);

    // Eased position along quadratic curve
    const currentPoint = curve.getPoint(t);

    if (thrusterRef.current) {
      thrusterRef.current.position.copy(currentPoint);
    }

    // Camera smoothly arcs behind the redirected rover
    const camOffset = currentPoint.clone().normalize().multiplyScalar(2.2);
    camera.position.lerp(camOffset, 0.08);
    camera.lookAt(currentPoint);

    if (t < 0.4) {
      setStatusMessage('NO AI SURVEY DATA AT COORDINATES. AUTONOMOUS REDIRECT ENGAGED...');
    } else if (t < 0.8) {
      setStatusMessage('BALLISTIC HOPPING VECTOR COMPUTED -> SHACKLETON CRATER SOUTH POLE.');
    } else {
      setStatusMessage('APPROACHING SHACKLETON SURVEY ZONE. PREPARING TOUCHDOWN...');
    }

    if (t >= 1.0) {
      onComplete();
    }
  });

  return (
    <group>
      {/* Visual hopping trajectory line */}
      <mesh>
        <tubeGeometry args={[curve, 40, 0.004, 8, false]} />
        <meshBasicMaterial color="#f59e0b" transparent opacity={0.6} />
      </mesh>

      {/* Thruster Plume Particles */}
      <points ref={thrusterRef} geometry={particleGeo}>
        <pointsMaterial
          size={0.03}
          color="#f59e0b"
          transparent
          opacity={0.8}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}
