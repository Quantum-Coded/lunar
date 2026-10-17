"use client";

import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { degToRad } from "@/lib/world/coords";
import { roverPose } from "@/state/roverPose";
import { sunDirection } from "./sun";

/** NASA's Space Exploration Vehicle (Lunar Electric Rover concept), from nasa/NASA-3D-Resources,
 *  simplified and meshopt-compressed for the web. */
const MODEL_URL = "/models/nasa-space-exploration-vehicle.glb";
/** The SEV is about 4.5 m long; slightly smaller keeps the chase camera framing. */
const TARGET_LENGTH_M = 4.2;
/** The glTF is Y-up with its cabin towards +Z. Turn it so the nose points to -Z like the scene expects. */
const MODEL_YAW = Math.PI;

interface Wheel {
  pivot: THREE.Group;
}

async function loadRover(): Promise<{ root: THREE.Group; wheels: Wheel[] }> {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync(MODEL_URL);
  const model = gltf.scene;

  const holder = new THREE.Group();
  holder.add(model);
  holder.rotation.set(0, MODEL_YAW, 0);
  holder.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(holder);
  const scale = TARGET_LENGTH_M / Math.max(bounds.max.z - bounds.min.z, bounds.max.x - bounds.min.x);
  const root = new THREE.Group();
  root.add(holder);
  holder.scale.setScalar(scale);
  holder.updateMatrixWorld(true);
  const scaled = new THREE.Box3().setFromObject(holder);
  holder.position.set(-(scaled.max.x + scaled.min.x) / 2, -scaled.min.y, -(scaled.max.z + scaled.min.z) / 2);

  // The model is a single mesh, so the wheels can't spin on their own.
  return { root, wheels: [] };
}

export function Rover() {
  const group = useRef<THREE.Group>(null);
  const light = useRef<THREE.DirectionalLight>(null);
  const [rover, setRover] = useState<{ root: THREE.Group; wheels: Wheel[] } | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadRover().then((r) => !cancelled && setRover(r)).catch((e) => console.error("Rover model failed to load", e));
    return () => { cancelled = true; };
  }, []);

  useFrame(() => {
    const g = group.current;
    if (!g || !rover) return;
    g.position.set(roverPose.x, roverPose.y, roverPose.z);
    // Scene yaw is the negative bearing; pitch/roll are applied in the rover's own frame.
    g.rotation.set(0, 0, 0);
    g.rotateY(-degToRad(roverPose.headingDeg));
    g.rotateX(roverPose.pitchRad);
    g.rotateZ(roverPose.rollRad);
    rover.wheels.forEach(({ pivot }) => { pivot.rotation.x = roverPose.wheelAngle; });
    light.current?.position.copy(sunDirection).multiplyScalar(50).add(g.position);
    light.current?.target.position.copy(g.position);
    light.current?.target.updateMatrixWorld();
  });

  return (
    <>
      <hemisphereLight args={["#b8c8ee", "#5a5650", 1.1]} />
      <directionalLight ref={light} intensity={3.6} color="#fff3dc" />
      <group ref={group}>{rover && <primitive object={rover.root} />}</group>
    </>
  );
}
