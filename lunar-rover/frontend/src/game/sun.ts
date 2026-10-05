import * as THREE from "three";
import { degToRad } from "@/lib/world/coords";

/** Near the lunar poles the Sun skims the horizon; it circles the sky once per lunar day (29.5 Earth days). */
export const SUN_ELEVATION_DEG = 2.5;
/** Time-lapse: one full lap of the horizon takes this many real seconds. */
export const SUN_LAP_SECONDS = 900;

export const sunDirection = new THREE.Vector3();

export function updateSun(elapsedSeconds: number): THREE.Vector3 {
  const azimuth = (elapsedSeconds / SUN_LAP_SECONDS) * Math.PI * 2 + degToRad(35);
  const elevation = degToRad(SUN_ELEVATION_DEG);
  // Azimuth is a map bearing: 0 = north = -z, 90 = east = +x.
  return sunDirection.set(
    Math.cos(elevation) * Math.sin(azimuth),
    Math.sin(elevation),
    -Math.cos(elevation) * Math.cos(azimuth),
  );
}
