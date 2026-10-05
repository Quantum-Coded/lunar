"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { api } from "@/lib/api/client";
import { toRegionX, toRegionY, toWorldX, toWorldZ } from "@/lib/world/coords";
import { SPEED_LEVELS_MPS, useGame } from "@/state/store";
import { roverPose } from "@/state/roverPose";
import { drive } from "./input";
import { settleOnTerrain, stepRover, type Autopilot } from "./roverPhysics";

const TELEMETRY_INTERVAL_S = 0.2;
const LOCATE_INTERVAL_S = 1.0;
const POLE_CHECK_INTERVAL_S = 0.5;

/** Drives the rover each frame and feeds telemetry, location lookups and info-pole proximity to the UI. */
export function Simulation() {
  const streamer = useGame((s) => s.streamer)!;
  const timers = useRef({ telemetry: 0, locate: 0, pole: 0 });
  const auto = useRef<Autopilot | null>(null);
  const locating = useRef(false);
  const activePole = useRef<string | null>(null);

  // Spawn at a data-driven location: the first sunlit site in the POI list (falls back to any pole).
  useEffect(() => {
    const { poles } = useGame.getState();
    const params = new URLSearchParams(window.location.search);
    const wanted = params.get("poi");
    const spawn = poles.find((p) => p.id === wanted) ?? poles.find((p) => p.category === "sunlit") ?? poles[0];
    if (spawn) {
      roverPose.x = toWorldX(spawn.x);
      roverPose.z = toWorldZ(spawn.y);
      roverPose.headingDeg = 0;
      roverPose.placed = false;
      useGame.getState().dismissPole(spawn.id); // don't greet the player with a pop-up on arrival
    }
  }, [streamer]);

  // Build / clear the autopilot whenever the store toggles it.
  useEffect(() => {
    return useGame.subscribe((state, prev) => {
      if (state.autopilot === prev.autopilot && state.activeRoute === prev.activeRoute) return;
      if (state.autopilot && state.activeRoute) {
        const points = state.activeRoute.route.waypoints.map(([x, y]) => [toWorldX(x), toWorldZ(y)] as [number, number]);
        auto.current = { waypoints: points, index: Math.min(1, points.length - 1) };
      } else {
        auto.current = null;
      }
    });
  }, []);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const state = useGame.getState();

    if (!roverPose.placed) {
      settleOnTerrain(streamer);
      return;
    }

    const maxSpeed = SPEED_LEVELS_MPS[state.speedLevel];
    const wasFollowing = auto.current !== null;
    const following = stepRover(dt, drive, maxSpeed, streamer, auto.current);
    if (wasFollowing && !following) {
      auto.current = null;
      useGame.getState().setAutopilot(false);
      if (state.activeRoute) {
        const goal = state.activeRoute.goal;
        useGame.getState().setArrivedAt(goal);
        api.poi(goal.id).then((detail) => useGame.getState().setNearbyPole(detail)).catch(() => {});
      }
    }

    // Ask for terrain detail ahead of the rover so fast driving does not outrun the tile streaming.
    const yaw = (roverPose.headingDeg * Math.PI) / 180;
    const lookAhead = Math.abs(roverPose.speed) * 2 + 60;
    streamer.select(roverPose.x + Math.sin(yaw) * lookAhead, roverPose.z - Math.cos(yaw) * lookAhead);

    const t = timers.current;
    t.telemetry += dt; t.locate += dt; t.pole += dt;
    const x = toRegionX(roverPose.x), y = toRegionY(roverPose.z);

    if (t.telemetry > TELEMETRY_INTERVAL_S) {
      t.telemetry = 0;
      state.setTelemetry({
        x, y, headingDeg: roverPose.headingDeg, speed: roverPose.speed, elevation: roverPose.y,
        slopeDeg: (Math.hypot(roverPose.pitchRad, roverPose.rollRad) * 180) / Math.PI,
      });
    }

    if (t.locate > LOCATE_INTERVAL_S && !locating.current) {
      t.locate = 0;
      locating.current = true;
      api.locate(x, y).then(state.setLocate).catch(() => {}).finally(() => { locating.current = false; });
    }

    if (t.pole > POLE_CHECK_INTERVAL_S) {
      t.pole = 0;
      checkPoles(x, y);
    }
  });

  /** Opens the info card for the info pole the rover is standing at (smallest feature wins). */
  function checkPoles(x: number, y: number) {
    const { poles, dismissedPoles, nearbyPole } = useGame.getState();
    let best: { id: string; radius: number } | null = null;
    for (const p of poles) {
      const trigger = Math.min(Math.max(p.radius_m * 0.3, 400), 2500);
      if (Math.hypot(p.x - x, p.y - y) <= trigger && (!best || p.radius_m < best.radius)) best = { id: p.id, radius: p.radius_m };
    }
    const id = best && !dismissedPoles.has(best.id) ? best.id : null;
    if (id === activePole.current) return;
    activePole.current = id;
    if (!id) {
      if (nearbyPole) useGame.getState().setNearbyPole(null);
      return;
    }
    api.poi(id).then((detail) => { if (activePole.current === id) useGame.getState().setNearbyPole(detail); }).catch(() => {});
  }

  return null;
}
