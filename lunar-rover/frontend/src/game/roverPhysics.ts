import type { TerrainStreamer } from "@/lib/terrain/streamer";
import { degToRad } from "@/lib/world/coords";
import { roverPose } from "@/state/roverPose";

const MAX_CLIMB_DEG = 32; // the rover refuses to drive up/down anything steeper than this
const WHEEL_RADIUS_M = 0.4;
const WHEEL_BASE_M = 1.5; // sampling offset for pitch/roll estimation
const ARRIVAL_RADIUS_M = 40;

export interface DriveInput {
  throttle: number; // -1..1
  steer: number; // -1..1 (right positive)
  brake: boolean;
}

export interface Autopilot {
  waypoints: [number, number][]; // world x, z
  index: number;
}

/** Forward vector of a map bearing in world (x, z): bearing 0 = north = -z. */
const forward = (bearingRad: number): [number, number] => [Math.sin(bearingRad), -Math.cos(bearingRad)];

const wrap180 = (deg: number) => ((deg + 540) % 360) - 180;

/**
 * Advances the rover by `dt` seconds. Returns true while an autopilot route is still being followed,
 * false when there is none or it has just been completed.
 */
export function stepRover(dt: number, input: DriveInput, maxSpeed: number, terrain: TerrainStreamer, auto: Autopilot | null): boolean {
  const pose = roverPose;
  let throttle = input.throttle;
  let steer = input.steer;
  let following = false;

  if (auto && auto.index < auto.waypoints.length) {
    following = true;
    const [tx, tz] = auto.waypoints[auto.index];
    const dx = tx - pose.x, dz = tz - pose.z;
    const dist = Math.hypot(dx, dz);
    const isLast = auto.index === auto.waypoints.length - 1;
    if (dist < (isLast ? ARRIVAL_RADIUS_M : Math.max(30, pose.speed * 0.6))) {
      auto.index++;
      if (auto.index >= auto.waypoints.length) following = false;
    } else {
      const desired = (Math.atan2(dx, -dz) * 180) / Math.PI;
      const error = wrap180(desired - pose.headingDeg);
      steer = Math.max(-1, Math.min(1, error / 25));
      // Ease off while turning, and brake early for the final stop.
      const alignment = Math.max(0, 1 - Math.abs(error) / 70);
      const arrival = isLast ? Math.min(1, dist / (pose.speed * 3 + 80)) : 1;
      throttle = Math.max(0.12, alignment * arrival);
    }
  }

  // Longitudinal dynamics.
  const target = input.brake ? 0 : throttle * maxSpeed;
  const accel = Math.max(6, maxSpeed * 0.8);
  const delta = target - pose.speed;
  pose.speed += Math.sign(delta) * Math.min(Math.abs(delta), accel * dt);

  // Steering: tighter at crawl speed, gentler when fast.
  const turnRate = 55 / (1 + Math.abs(pose.speed) / 50);
  const steerAmount = Math.abs(pose.speed) > 0.2 || following ? steer : 0;
  pose.headingDeg = (pose.headingDeg + steerAmount * turnRate * dt * (pose.speed < 0 ? -1 : 1) + 360) % 360;

  // Move, refusing steep or out-of-survey ground.
  const [fx, fz] = forward(degToRad(pose.headingDeg));
  const step = pose.speed * dt;
  const nx = pose.x + fx * step, nz = pose.z + fz * step;
  const currentH = terrain.heightAt(pose.x, pose.z);
  const nextH = terrain.heightAt(nx, nz);
  if (nextH === null || !terrain.isCovered(nx, nz)) {
    pose.speed = 0;
  } else {
    const run = Math.abs(step);
    const climb = currentH === null || run < 1e-3 ? 0 : (Math.atan2(Math.abs(nextH - currentH), run) * 180) / Math.PI;
    if (climb > MAX_CLIMB_DEG && run > 0.05) {
      pose.speed = 0;
    } else {
      pose.x = nx;
      pose.z = nz;
    }
  }
  pose.wheelAngle += (pose.speed * dt) / WHEEL_RADIUS_M;

  settleOnTerrain(terrain);
  return following;
}

let lastDetailLevel = -1;

/**
 * Ground height under the rover. While only a coarse tile is loaded (fast driving outruns the streaming), the drawn
 * surface is a coarse mesh whose triangles stay inside the range of nearby samples, so take the highest nearby sample:
 * the rover then rides on or just above the drawn ground and never sinks into it.
 */
function groundHeight(terrain: TerrainStreamer, x: number, z: number): number | null {
  const level = terrain.finestLevelAt(x, z);
  const centre = terrain.heightAt(x, z);
  if (centre === null || level >= terrain.info.max_level) return centre;
  const reach = terrain.cellSize(Math.max(level, 0));
  let best = centre;
  for (const dx of [-reach, 0, reach]) {
    for (const dz of [-reach, 0, reach]) best = Math.max(best, terrain.heightAt(x + dx, z + dz) ?? best);
  }
  return best;
}

/** Height, pitch and roll from four terrain samples around the rover. */
export function settleOnTerrain(terrain: TerrainStreamer): boolean {
  const pose = roverPose;
  const [fx, fz] = forward(degToRad(pose.headingDeg));
  const rx = -fz, rz = fx; // right-hand vector
  const h = (a: number, b: number) => terrain.heightAt(pose.x + fx * a + rx * b, pose.z + fz * a + rz * b);
  const centre = h(0, 0), front = h(WHEEL_BASE_M, 0), back = h(-WHEEL_BASE_M, 0), right = h(0, WHEEL_BASE_M), left = h(0, -WHEEL_BASE_M);
  if (centre === null || front === null || back === null || right === null || left === null) return false;
  const ground = groundHeight(terrain, pose.x, pose.z) ?? centre;
  const level = terrain.finestLevelAt(pose.x, pose.z);
  // When finer detail replaces a coarse tile the ground can drop a little: ease down instead of snapping.
  pose.y = pose.placed && level > lastDetailLevel && ground < pose.y ? pose.y + (ground - pose.y) * 0.3 : ground;
  lastDetailLevel = level;
  pose.pitchRad = Math.atan2(front - back, 2 * WHEEL_BASE_M);
  pose.rollRad = Math.atan2(right - left, 2 * WHEEL_BASE_M);
  pose.placed = true;
  return true;
}
