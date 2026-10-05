"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { degToRad } from "@/lib/world/coords";
import { useGame } from "@/state/store";
import { roverPose } from "@/state/roverPose";

/** Fixed chase view: just behind and above the rover so its hood and the road ahead are both in frame. */
const DISTANCE_BEHIND_M = 6.5;
const HEIGHT_ABOVE_M = 3.1;
const LOOK_AHEAD_M = 9;
const LOOK_HEIGHT_M = 0.9;
const FOLLOW_STIFFNESS = 9;
/** Width of the phone column that floats over the right of the world on wide screens (keep in sync with globals.css). */
const PHONE_COLUMN_PX = 440;

/** On wide screens the phone covers the right edge, so shift the picture to keep the rover centred in the visible part. */
function phoneOverlayShiftPx(): number {
  return window.matchMedia("(min-width: 981px) and (min-height: 601px)").matches ? PHONE_COLUMN_PX / 2 : 0;
}

export function CameraRig() {
  const streamer = useGame((s) => s.streamer)!;
  const smoothed = useRef(new THREE.Vector3());
  const initialised = useRef(false);

  useFrame(({ camera, size }, dt) => {
    const yaw = degToRad(roverPose.headingDeg);
    const fx = Math.sin(yaw), fz = -Math.cos(yaw);

    const target = new THREE.Vector3(
      roverPose.x - fx * DISTANCE_BEHIND_M,
      roverPose.y + HEIGHT_ABOVE_M,
      roverPose.z - fz * DISTANCE_BEHIND_M,
    );
    const ground = streamer.heightAt(target.x, target.z);
    if (ground !== null) target.y = Math.max(target.y, ground + 1.5);

    if (!initialised.current && roverPose.placed) {
      smoothed.current.copy(target);
      initialised.current = true;
    }
    smoothed.current.lerp(target, 1 - Math.exp(-FOLLOW_STIFFNESS * dt));
    camera.position.copy(smoothed.current);
    camera.lookAt(roverPose.x + fx * LOOK_AHEAD_M, roverPose.y + LOOK_HEIGHT_M, roverPose.z + fz * LOOK_AHEAD_M);

    const cam = camera as THREE.PerspectiveCamera;
    const shift = phoneOverlayShiftPx();
    if (shift) cam.setViewOffset(size.width, size.height, shift, 0, size.width, size.height);
    else cam.clearViewOffset();
  });

  return null;
}
