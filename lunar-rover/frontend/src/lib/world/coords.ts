/**
 * The backend speaks projected metres (x = east, y = north). The 3D scene is Y-up with north = -Z,
 * so one metre in the data is exactly one unit in the scene and heights are real elevations.
 */
export const toWorldX = (x: number) => x;
export const toWorldZ = (y: number) => -y;
export const toRegionX = (wx: number) => wx;
export const toRegionY = (wz: number) => -wz;

/** Map bearing (0 = north, 90 = east, clockwise) of a world-space direction. */
export const bearingOf = (dx: number, dz: number) => ((Math.atan2(dx, -dz) * 180) / Math.PI + 360) % 360;

export const degToRad = (d: number) => (d * Math.PI) / 180;

export function formatDistance(m: number): string {
  return m >= 10_000 ? `${(m / 1000).toFixed(0)} km` : m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

export function formatLat(lat: number): string {
  return `${Math.abs(lat).toFixed(3)}°${lat < 0 ? "S" : "N"}`;
}

export function formatLon(lonEast: number): string {
  const lon = lonEast > 180 ? lonEast - 360 : lonEast;
  return `${Math.abs(lon).toFixed(2)}°${lon < 0 ? "W" : "E"}`;
}

export function compassLabel(bearing: number): string {
  const names = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return names[Math.round(bearing / 45) % 8];
}
