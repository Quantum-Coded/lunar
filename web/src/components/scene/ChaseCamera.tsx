'use client';

import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useMissionStore } from '@/lib/scene-state/store';

interface ChaseCameraProps {
  roverRef: React.RefObject<THREE.Group | null>;
}

export function ChaseCamera({ roverRef }: ChaseCameraProps) {
  const { camera, gl } = useThree();
  const cameraMode = useMissionStore((s) => s.cameraMode);
  const roverMovementState = useMissionStore((s) => s.roverMovementState);

  // Manual orbit offset angles during pointer drag
  const isDraggingRef = useRef(false);
  const prevPointerRef = useRef({ x: 0, y: 0 });
  const orbitAngleRef = useRef({ azimuth: 0, elevation: 0.32, distance: 1.6 });
  const fpvAngleRef = useRef({ yaw: 0, pitch: -0.05 });

  // Current interpolated camera target and position
  const currentCamPosRef = useRef(new THREE.Vector3(0, 2, 4));
  const currentLookTargetRef = useRef(new THREE.Vector3(0, 0, 0));

  // Pointer drag listeners for manual camera orbiting
  useEffect(() => {
    const dom = gl.domElement;

    const onPointerDown = (e: PointerEvent) => {
      // Allow orbit on primary click or right click
      isDraggingRef.current = true;
      prevPointerRef.current = { x: e.clientX, y: e.clientY };
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDraggingRef.current) return;

      const dx = e.clientX - prevPointerRef.current.x;
      const dy = e.clientY - prevPointerRef.current.y;
      prevPointerRef.current = { x: e.clientX, y: e.clientY };

      if (cameraMode === 'chase' || cameraMode === 'orbit') {
        orbitAngleRef.current.azimuth -= dx * 0.008;
        orbitAngleRef.current.elevation += dy * 0.005;
        // Clamp elevation to avoid going underground or directly overhead
        orbitAngleRef.current.elevation = Math.max(0.08, Math.min(Math.PI / 2.2, orbitAngleRef.current.elevation));
      } else if (cameraMode === 'fpv') {
        fpvAngleRef.current.yaw -= dx * 0.005;
        fpvAngleRef.current.pitch -= dy * 0.005;
        fpvAngleRef.current.pitch = Math.max(-0.4, Math.min(0.5, fpvAngleRef.current.pitch));
        fpvAngleRef.current.yaw = Math.max(-1.2, Math.min(1.2, fpvAngleRef.current.yaw));
      }
    };

    const onPointerUp = () => {
      isDraggingRef.current = false;
    };

    const onWheel = (e: WheelEvent) => {
      if (cameraMode === 'chase' || cameraMode === 'orbit') {
        orbitAngleRef.current.distance += e.deltaY * 0.002;
        orbitAngleRef.current.distance = Math.max(0.8, Math.min(5.5, orbitAngleRef.current.distance));
      }
    };

    dom.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    dom.addEventListener('wheel', onWheel, { passive: true });

    return () => {
      dom.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      dom.removeEventListener('wheel', onWheel);
    };
  }, [gl, cameraMode]);

  useFrame((_, delta) => {
    const rover = roverRef.current;
    if (!rover) return;

    const roverPos = rover.position;
    const roverHeading = rover.rotation.y;

    // When driving in chase mode and user is not dragging, gently decay manual azimuth back behind rover
    if (roverMovementState === 'driving' && !isDraggingRef.current && cameraMode === 'chase') {
      orbitAngleRef.current.azimuth = THREE.MathUtils.lerp(orbitAngleRef.current.azimuth, 0, delta * 2.5);
    }

    if (cameraMode === 'chase' || cameraMode === 'orbit') {
      const dist = orbitAngleRef.current.distance;
      const elev = orbitAngleRef.current.elevation;
      const totalAzimuth = roverHeading + orbitAngleRef.current.azimuth;

      // Position camera behind and above rover
      const targetCamX = roverPos.x - Math.sin(totalAzimuth) * (dist * Math.cos(elev));
      const targetCamZ = roverPos.z - Math.cos(totalAzimuth) * (dist * Math.cos(elev));
      const targetCamY = roverPos.y + dist * Math.sin(elev);

      // Desired look target: slightly ahead and above rover center
      const lookTargetX = roverPos.x + Math.sin(roverHeading) * 0.15;
      const lookTargetY = roverPos.y + 0.12;
      const lookTargetZ = roverPos.z + Math.cos(roverHeading) * 0.15;

      const lerpSpeed = Math.min(1.0, delta * 7.0);
      currentCamPosRef.current.lerp(new THREE.Vector3(targetCamX, targetCamY, targetCamZ), lerpSpeed);
      currentLookTargetRef.current.lerp(new THREE.Vector3(lookTargetX, lookTargetY, lookTargetZ), lerpSpeed);

      camera.position.copy(currentCamPosRef.current);
      camera.lookAt(currentLookTargetRef.current);
    } else if (cameraMode === 'fpv') {
      // FPV "Mast Camera" mounted on the sensor mast
      const mastOffsetLocal = new THREE.Vector3(0.07, 0.28, 0.12);
      mastOffsetLocal.applyAxisAngle(new THREE.Vector3(0, 1, 0), roverHeading);
      const mastPosWorld = roverPos.clone().add(mastOffsetLocal);

      const lookHeading = roverHeading + fpvAngleRef.current.yaw;
      const lookTarget = mastPosWorld.clone().add(
        new THREE.Vector3(
          Math.sin(lookHeading) * 3.0,
          fpvAngleRef.current.pitch * 2.0,
          Math.cos(lookHeading) * 3.0
        )
      );

      const lerpSpeed = Math.min(1.0, delta * 12.0);
      currentCamPosRef.current.lerp(mastPosWorld, lerpSpeed);
      currentLookTargetRef.current.lerp(lookTarget, lerpSpeed);

      camera.position.copy(currentCamPosRef.current);
      camera.lookAt(currentLookTargetRef.current);
    }
  });

  return null;
}
