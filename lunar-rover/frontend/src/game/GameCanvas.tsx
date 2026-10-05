"use client";

import { Canvas } from "@react-three/fiber";
import { CameraRig } from "./CameraRig";
import { InfoPoles } from "./InfoPoles";
import { Rover } from "./Rover";
import { RouteLine } from "./RouteLine";
import { Simulation } from "./Simulation";
import { Sky } from "./Sky";
import { Terrain } from "./Terrain";
import { useKeyboardControls } from "./input";

/** The 3D world. Everything inside needs the terrain streamer, so mount only after boot data is ready. */
export default function GameCanvas() {
  useKeyboardControls();
  return (
    <Canvas
      gl={{ antialias: true, logarithmicDepthBuffer: true, powerPreference: "high-performance" }}
      camera={{ fov: 62, near: 0.3, far: 1_200_000, position: [0, 50, 0] }}
      dpr={[1, 1.75]}
      style={{ background: "#000" }}
    >
      <Sky />
      <Terrain />
      <Rover />
      <InfoPoles />
      <RouteLine />
      <Simulation />
      <CameraRig />
    </Canvas>
  );
}
