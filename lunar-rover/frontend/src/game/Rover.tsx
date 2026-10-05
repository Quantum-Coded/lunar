"use client";

import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { MTLLoader } from "three/addons/loaders/MTLLoader.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { degToRad } from "@/lib/world/coords";
import { roverPose } from "@/state/roverPose";
import { sunDirection } from "./sun";

const MODEL_DIR = "/models/";
const MODEL_NAME = "14014_Moon_Rover_V1_l1";
/** The real Lunar Roving Vehicle is about 3.1 m long; the model's long axis is Y. */
const TARGET_LENGTH_M = 3.4;
const WHEEL_PART = /^(wheel|tire)/i;

interface Wheel {
  pivot: THREE.Group;
}

/** Wrap each wheel+tyre pair in a pivot at its own centre so it can spin about the model's X axle. */
function rigWheels(model: THREE.Object3D): Wheel[] {
  const parts: THREE.Object3D[] = [];
  model.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && WHEEL_PART.test(o.name)) parts.push(o);
  });

  const pivots = new Map<string, THREE.Group>();
  const box = new THREE.Box3();
  for (const part of parts) {
    box.setFromObject(part);
    const c = box.getCenter(new THREE.Vector3());
    const key = `${Math.round(c.x / 4)}:${Math.round(c.y / 4)}`;
    let pivot = pivots.get(key);
    if (!pivot) {
      pivot = new THREE.Group();
      pivot.position.copy(c);
      model.add(pivot);
      pivots.set(key, pivot);
    }
    pivot.attach(part); // keeps the part's world transform
  }
  return [...pivots.values()].map((pivot) => ({ pivot }));
}

async function loadRover(): Promise<{ root: THREE.Group; wheels: Wheel[] }> {
  const materials = await new MTLLoader().setPath(MODEL_DIR).loadAsync(`${MODEL_NAME}.mtl`);
  materials.preload();
  const model = await new OBJLoader().setMaterials(materials).setPath(MODEL_DIR).loadAsync(`${MODEL_NAME}.obj`);

  // The OBJ is Z-up with its nose towards -Y. Rotate into the scene: Y-up, nose towards -Z.
  const holder = new THREE.Group();
  holder.add(model);
  model.updateMatrixWorld(true);
  const wheels = rigWheels(model);

  holder.rotation.set(-Math.PI / 2, 0, Math.PI);
  holder.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(holder);
  const scale = TARGET_LENGTH_M / Math.max(bounds.max.z - bounds.min.z, bounds.max.x - bounds.min.x);
  const root = new THREE.Group();
  root.add(holder);
  holder.scale.setScalar(scale);
  holder.updateMatrixWorld(true);
  const scaled = new THREE.Box3().setFromObject(holder);
  holder.position.set(-(scaled.max.x + scaled.min.x) / 2, -scaled.min.y, -(scaled.max.z + scaled.min.z) / 2);

  model.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mats.forEach((m) => {
      const phong = m as THREE.MeshPhongMaterial;
      if (phong.map) phong.map.colorSpace = THREE.SRGBColorSpace;
      phong.shininess = 18;
      phong.side = THREE.DoubleSide;
    });
  });
  return { root, wheels };
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
