import * as THREE from 'three';
import { GridPosition } from '@/types';

/**
 * Converts Lunar Latitude and Longitude to 3D Cartesian coordinates on a sphere of radius R.
 * Lat: -90 (South Pole) to +90 (North Pole)
 * Lon: -180 to +180
 */
export function latLonToSphere(lat: number, lon: number, radius: number = 1.0): [number, number, number] {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);

  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);

  return [x, y, z];
}

/**
 * Converts 3D point on unit sphere to Lunar Latitude and Longitude.
 */
export function sphereToLatLon(x: number, y: number, z: number): { lat: number; lon: number } {
  const norm = Math.sqrt(x * x + y * y + z * z);
  const ny = y / norm;
  const lat = 90 - Math.acos(ny) * (180 / Math.PI);
  const lon = (Math.atan2(z, -x) * (180 / Math.PI)) - 180;
  return { lat, lon: lon < -180 ? lon + 360 : lon };
}

/**
 * Converts normalized [0, 1] UV/terrain coordinate to 3D terrain local position.
 * The terrain mesh is a 10 x 10 plane centered at (0, 0, 0) with height along Z or Y.
 */
export function gridToWorld(
  row: number, 
  col: number, 
  gridSize: number = 256, 
  terrainSize: number = 10,
  heightOffset: number = 0.0
): [number, number, number] {
  // row -> Y in range [-terrainSize/2, terrainSize/2] (inverted for image coords)
  // col -> X in range [-terrainSize/2, terrainSize/2]
  const u = col / (gridSize - 1);
  const v = row / (gridSize - 1);

  const x = (u - 0.5) * terrainSize;
  const z = (v - 0.5) * terrainSize; // Three.js horizontal ground plane (XZ)
  const y = heightOffset;

  return [x, y, z];
}

/**
 * Converts 3D terrain hit point back to discrete grid cell [row, col].
 */
export function worldToGrid(
  x: number, 
  z: number, 
  gridSize: number = 256, 
  terrainSize: number = 10
): GridPosition {
  const u = (x / terrainSize) + 0.5;
  const v = (z / terrainSize) + 0.5;

  const col = Math.round(Math.max(0, Math.min(gridSize - 1, u * (gridSize - 1))));
  const row = Math.round(Math.max(0, Math.min(gridSize - 1, v * (gridSize - 1))));

  return [row, col];
}
