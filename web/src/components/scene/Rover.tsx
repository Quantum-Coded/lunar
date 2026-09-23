'use client';

import React, { useRef, useMemo, forwardRef, useImperativeHandle, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useMissionStore } from '@/lib/scene-state/store';
import { gridToWorld, worldToGrid } from '@/lib/utils/coordinates';
import { useRoverControls } from '@/lib/input/useRoverControls';
import { sampleTerrainHeight } from '@/lib/utils/terrainDisplacement';

export const Rover = forwardRef<THREE.Group, {}>((_, ref) => {
  const innerGroupRef = useRef<THREE.Group>(null);
  useImperativeHandle(ref, () => innerGroupRef.current!, []);

  const wheelsRef = useRef<THREE.Mesh[]>([]);
  const spotLightTargetRef = useRef<THREE.Object3D>(null);

  // Store state
  const roverGridPos = useMissionStore((s) => s.roverGridPos);
  const activePath = useMissionStore((s) => s.activePath);
  const navGrid = useMissionStore((s) => s.navGrid);
  const roverMovementState = useMissionStore((s) => s.roverMovementState);
  const terrainMesh = useMissionStore((s) => s.terrainMesh);

  const setRoverGridPos = useMissionStore((s) => s.setRoverGridPos);
  const setRoverMovementState = useMissionStore((s) => s.setRoverMovementState);
  const setRoverHeading = useMissionStore((s) => s.setRoverHeading);
  const setActivePath = useMissionStore((s) => s.setActivePath);
  const setCurrentWaypointIdx = useMissionStore((s) => s.setCurrentWaypointIdx);
  const setPathProgress = useMissionStore((s) => s.setPathProgress);
  const setDriveMode = useMissionStore((s) => s.setDriveMode);
  const updateTelemetry = useMissionStore((s) => s.updateTelemetry);
  const setStatusMessage = useMissionStore((s) => s.setStatusMessage);

  // Input hook
  const controlsRef = useRoverControls();

  // Movement & physics tracking refs
  const currentPosRef = useRef<THREE.Vector3>(
    new THREE.Vector3(...gridToWorld(roverGridPos[0], roverGridPos[1], 256, 10, 0.05))
  );
  const currentHeadingRef = useRef(0);
  const waypointIdxRef = useRef(0);
  const odometerRef = useRef(0);

  // Surface pitch & roll tracking
  const pitchRef = useRef(0);
  const rollRef = useRef(0);

  // Dust particle trail
  const DUST_COUNT = 36;
  const dustGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(DUST_COUNT * 3);
    for (let i = 0; i < DUST_COUNT * 3; i++) pos[i] = 0;
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return geo;
  }, []);
  const dustLifetimes = useRef(new Float32Array(DUST_COUNT).fill(0));
  const dustVelocities = useRef(
    Array.from({ length: DUST_COUNT }, () => new THREE.Vector3())
  );
  const dustPointsRef = useRef<THREE.Points>(null);

  // Initialize heading store on mount
  useEffect(() => {
    setRoverHeading(currentHeadingRef.current);
  }, [setRoverHeading]);

  useFrame((_, delta) => {
    if (!innerGroupRef.current) return;

    const input = controlsRef.current;
    const isManualInputActive = input.forward || input.backward || input.left || input.right;

    // Current cell info from real model data
    const [curR, curC] = roverGridPos;
    const currentCell = navGrid && navGrid[curR] ? navGrid[curR][curC] : null;
    const hazardCost = currentCell ? currentCell.hazard_cost : 1.0;
    const inCrater = currentCell ? currentCell.in_crater : false;

    // Hazard speed scaling: severe obstacles and craters slow down vehicle
    const hazardSpeedFactor = Math.max(0.2, (1.0 / Math.pow(hazardCost, 0.75)) * (inCrater ? 0.7 : 1.0));
    const baseDriveSpeed = 0.85;
    const currentSpeed = baseDriveSpeed * hazardSpeedFactor;

    let isMoving = false;
    let driveDeltaDist = 0;

    // --- CASE A: Manual Keyboard WASD Controls ---
    if (isManualInputActive) {
      // Manual input cancels any active automated route
      if (activePath.length > 0) {
        setActivePath([]);
        waypointIdxRef.current = 0;
        setDriveMode('manual');
        setStatusMessage('MANUAL ROVER PILOTING ENGAGED. A* ROUTE OVERRIDDEN.');
      }

      // Steering
      const turnRate = (2.2 / Math.sqrt(hazardCost)) * delta;
      if (input.left) {
        currentHeadingRef.current += turnRate;
        isMoving = true;
      }
      if (input.right) {
        currentHeadingRef.current -= turnRate;
        isMoving = true;
      }

      // Forward / Reverse
      if (input.forward || input.backward) {
        const dirSign = input.forward ? 1.0 : -0.55;
        const step = currentSpeed * delta * dirSign;
        driveDeltaDist = step;

        const forwardVec = new THREE.Vector3(
          Math.sin(currentHeadingRef.current),
          0,
          Math.cos(currentHeadingRef.current)
        );

        currentPosRef.current.addScaledVector(forwardVec, step);
        isMoving = true;
      }

      // Keep within bounds of 10x10 terrain
      currentPosRef.current.x = Math.max(-4.85, Math.min(4.85, currentPosRef.current.x));
      currentPosRef.current.z = Math.max(-4.85, Math.min(4.85, currentPosRef.current.z));

      setRoverHeading(currentHeadingRef.current);
    } 
    // --- CASE B: Autonomous A* Waypoint Navigation ---
    else if (activePath.length > 1 && waypointIdxRef.current < activePath.length) {
      const targetWaypoint = activePath[waypointIdxRef.current];
      const [targetX, , targetZ] = gridToWorld(targetWaypoint[0], targetWaypoint[1], 256, 10, 0.05);
      const targetVec = new THREE.Vector3(targetX, 0, targetZ);

      const toTarget = targetVec.clone().sub(new THREE.Vector3(currentPosRef.current.x, 0, currentPosRef.current.z));
      const distToWp = toTarget.length();

      if (distToWp > 0.02) {
        // Desired heading toward waypoint
        const desiredHeading = Math.atan2(toTarget.x, toTarget.z);
        let angleDiff = desiredHeading - currentHeadingRef.current;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

        // Smooth steering
        currentHeadingRef.current += angleDiff * Math.min(1.0, delta * 5.5);
        setRoverHeading(currentHeadingRef.current);

        // Advance toward waypoint
        const step = Math.min(distToWp, currentSpeed * delta);
        driveDeltaDist = step;
        toTarget.normalize().multiplyScalar(step);
        currentPosRef.current.add(toTarget);
        isMoving = true;
      } else {
        // Advance waypoint
        waypointIdxRef.current += 1;
        setCurrentWaypointIdx(waypointIdxRef.current);

        const progress = Math.min(1.0, waypointIdxRef.current / (activePath.length - 1));
        setPathProgress(progress);

        if (waypointIdxRef.current >= activePath.length) {
          // Destination Reached!
          setRoverMovementState('idle');
          setActivePath([]);
          waypointIdxRef.current = 0;
          setStatusMessage('OBJECTIVE REACHED. EXPLORATION SAMPLING POINT ESTABLISHED.');
        }
      }
    }

    // Update Movement State
    if (isMoving) {
      if (roverMovementState !== 'driving') {
        setRoverMovementState('driving');
      }
    } else {
      if (roverMovementState !== 'idle') {
        setRoverMovementState('idle');
      }
    }

    // --- TERRAIN CONFORMATION (Raycaster & Normal Sampling) ---
    const sample = sampleTerrainHeight(
      currentPosRef.current.x,
      currentPosRef.current.z,
      terrainMesh,
      0.05
    );

    // Odometer & suspension bounce
    odometerRef.current += Math.abs(driveDeltaDist);
    const suspensionBounce = isMoving ? Math.sin(odometerRef.current * 22.0) * 0.004 : 0;
    currentPosRef.current.y = sample.y + 0.025 + suspensionBounce;

    // Align rover pitch and roll to terrain normal
    const surfaceNormal = sample.normal;
    const forwardVector = new THREE.Vector3(
      Math.sin(currentHeadingRef.current),
      0,
      Math.cos(currentHeadingRef.current)
    );
    const rightVector = new THREE.Vector3(
      Math.cos(currentHeadingRef.current),
      0,
      -Math.sin(currentHeadingRef.current)
    );

    // Pitch is slope along forward direction; Roll is slope along lateral direction
    const targetPitch = Math.asin(THREE.MathUtils.clamp(forwardVector.dot(surfaceNormal), -0.5, 0.5));
    const targetRoll = -Math.asin(THREE.MathUtils.clamp(rightVector.dot(surfaceNormal), -0.5, 0.5));

    pitchRef.current = THREE.MathUtils.lerp(pitchRef.current, targetPitch, delta * 6.0);
    rollRef.current = THREE.MathUtils.lerp(rollRef.current, targetRoll, delta * 6.0);

    // Apply Position & Euler Rotations (YXZ order)
    innerGroupRef.current.position.copy(currentPosRef.current);
    innerGroupRef.current.rotation.set(pitchRef.current, currentHeadingRef.current, rollRef.current, 'YXZ');

    // Update Headlight SpotLight Target
    if (spotLightTargetRef.current) {
      spotLightTargetRef.current.position.set(
        currentPosRef.current.x + Math.sin(currentHeadingRef.current) * 3.0,
        currentPosRef.current.y - 0.2,
        currentPosRef.current.z + Math.cos(currentHeadingRef.current) * 3.0
      );
    }

    // --- ANIMATE WHEELS ---
    if (isMoving) {
      const wheelSpin = driveDeltaDist !== 0 ? (driveDeltaDist / 0.038) : (delta * 4.0);
      wheelsRef.current.forEach((wheel) => {
        if (wheel) wheel.rotation.x += wheelSpin;
      });
    }

    // --- DUST PARTICLES SIMULATION ---
    if (dustPointsRef.current) {
      const posAttr = dustGeo.attributes.position as THREE.BufferAttribute;
      const positions = posAttr.array as Float32Array;

      for (let i = 0; i < DUST_COUNT; i++) {
        dustLifetimes.current[i] -= delta * 1.6;

        // Spawn new dust puff behind rear wheels if driving
        if (dustLifetimes.current[i] <= 0 && isMoving && Math.random() < 0.35) {
          dustLifetimes.current[i] = 0.8 + Math.random() * 0.6;
          const rearOffset = new THREE.Vector3(
            (Math.random() - 0.5) * 0.22,
            0.02,
            -0.18
          ).applyAxisAngle(new THREE.Vector3(0, 1, 0), currentHeadingRef.current);

          const spawnPos = currentPosRef.current.clone().add(rearOffset);
          positions[i * 3] = spawnPos.x;
          positions[i * 3 + 1] = spawnPos.y;
          positions[i * 3 + 2] = spawnPos.z;

          dustVelocities.current[i].set(
            (Math.random() - 0.5) * 0.05 - Math.sin(currentHeadingRef.current) * 0.1,
            0.08 + Math.random() * 0.06,
            (Math.random() - 0.5) * 0.05 - Math.cos(currentHeadingRef.current) * 0.1
          );
        } else if (dustLifetimes.current[i] > 0) {
          positions[i * 3] += dustVelocities.current[i].x * delta;
          positions[i * 3 + 1] += dustVelocities.current[i].y * delta;
          positions[i * 3 + 2] += dustVelocities.current[i].z * delta;
          dustVelocities.current[i].y -= 0.08 * delta; // slight gravity
        }
      }
      posAttr.needsUpdate = true;
    }

    // --- UPDATE TELEMETRY ON CELL CHANGE ---
    const [newR, newC] = worldToGrid(currentPosRef.current.x, currentPosRef.current.z, 256, 10);
    if (newR !== roverGridPos[0] || newC !== roverGridPos[1]) {
      setRoverGridPos([newR, newC]);
      if (navGrid && navGrid[newR] && navGrid[newR][newC]) {
        const cell = navGrid[newR][newC];
        updateTelemetry({
          currentHazardCost: cell.hazard_cost,
          currentTerrainClass: cell.terrain_class,
          isInCrater: cell.in_crater
        });

        if (cell.in_crater && !currentCell?.in_crater) {
          setStatusMessage(`CAUTION: VEHICLE HAS ENTERED CRATER DEPRESSION. SLOPE FRICTION INCREASED (COST: ${cell.hazard_cost.toFixed(1)}x).`);
        }
      }
    }
  });

  return (
    <>
      <group ref={innerGroupRef} position={currentPosRef.current}>
        {/* Chassis Body */}
        <mesh position={[0, 0.08, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.22, 0.08, 0.32]} />
          <meshStandardMaterial color="#f1f5f9" roughness={0.35} metalness={0.8} />
        </mesh>

        {/* Gold Multi-Layer Insulation (MLI) Blanket */}
        <mesh position={[0, 0.095, -0.04]} castShadow>
          <boxGeometry args={[0.18, 0.06, 0.16]} />
          <meshStandardMaterial color="#eab308" roughness={0.25} metalness={0.9} />
        </mesh>

        {/* Top Solar Panel Array Deck */}
        <mesh position={[0, 0.135, 0.02]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.24, 0.28]} />
          <meshStandardMaterial color="#0f172a" roughness={0.15} metalness={0.9} />
        </mesh>

        {/* Camera Mast & Stereo Sensor Head */}
        <group position={[0.07, 0.12, 0.12]}>
          <mesh position={[0, 0.08, 0]}>
            <cylinderGeometry args={[0.008, 0.008, 0.16, 8]} />
            <meshStandardMaterial color="#64748b" metalness={0.9} />
          </mesh>
          <mesh position={[0, 0.16, 0.01]}>
            <boxGeometry args={[0.08, 0.03, 0.03]} />
            <meshStandardMaterial color="#0f172a" metalness={0.8} />
          </mesh>
          <mesh position={[-0.025, 0.16, 0.025]}>
            <sphereGeometry args={[0.008, 8, 8]} />
            <meshBasicMaterial color="#06b6d4" />
          </mesh>
          <mesh position={[0.025, 0.16, 0.025]}>
            <sphereGeometry args={[0.008, 8, 8]} />
            <meshBasicMaterial color="#06b6d4" />
          </mesh>
        </group>

        {/* High-Gain Parabolic Communications Antenna */}
        <group position={[-0.07, 0.14, -0.1]}>
          <mesh rotation={[0.4, 0, 0]}>
            <coneGeometry args={[0.045, 0.02, 16, 1, true]} />
            <meshStandardMaterial color="#cbd5e1" side={THREE.DoubleSide} metalness={0.8} />
          </mesh>
        </group>

        {/* 6 Rocker-Bogie All-Terrain Wheels */}
        {[
          // Left side
          [-0.14, 0.04, 0.12],
          [-0.14, 0.04, 0.0],
          [-0.14, 0.04, -0.12],
          // Right side
          [0.14, 0.04, 0.12],
          [0.14, 0.04, 0.0],
          [0.14, 0.04, -0.12],
        ].map((wPos, i) => (
          <group key={i} position={wPos as [number, number, number]}>
            <mesh position={[0, 0.02, 0]}>
              <cylinderGeometry args={[0.006, 0.006, 0.04, 8]} />
              <meshStandardMaterial color="#475569" metalness={0.9} />
            </mesh>
            <mesh
              ref={(el) => {
                if (el) wheelsRef.current[i] = el;
              }}
              rotation={[0, 0, Math.PI / 2]}
              castShadow
            >
              <cylinderGeometry args={[0.038, 0.038, 0.028, 16]} />
              <meshStandardMaterial color="#334155" roughness={0.9} metalness={0.2} />
            </mesh>
          </group>
        ))}

        {/* Forward Headlight / Surface Illuminator */}
        <pointLight position={[0, 0.12, 0.18]} color="#ffffff" intensity={2.0} distance={1.8} />

        {/* High-Intensity Mast SpotLight cutting into shadowed craters */}
        <spotLight
          position={[0.07, 0.28, 0.14]}
          color="#f8fafc"
          intensity={5.0}
          distance={6.5}
          angle={0.65}
          penumbra={0.6}
          castShadow
        />
      </group>

      {/* Standalone SpotLight Target in World Coordinates */}
      <object3D ref={spotLightTargetRef} />

      {/* Dynamic Dust Puff Particles */}
      <points ref={dustPointsRef} geometry={dustGeo}>
        <pointsMaterial
          size={0.032}
          color="#cbd5e1"
          transparent
          opacity={0.65}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>
    </>
  );
});

Rover.displayName = 'Rover';
