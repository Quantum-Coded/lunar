import * as THREE from 'three';

const raycaster = new THREE.Raycaster();
const downDirection = new THREE.Vector3(0, -1, 0);
const rayOrigin = new THREE.Vector3();

export interface TerrainSampleResult {
  y: number;
  normal: THREE.Vector3;
}

const defaultNormal = new THREE.Vector3(0, 1, 0);

/**
 * Displaces a PlaneGeometry on the CPU using heightmap pixel data.
 * This enables exact Three.js Raycaster intersections and smooth normal orientation.
 */
export function buildDisplacedTerrainGeometry(
  heightmapImage: CanvasImageSource | any,
  size: number = 10,
  segments: number = 256,
  displacementScale: number = 0.7,
  displacementBias: number = -0.35
): THREE.PlaneGeometry {
  const geometry = new THREE.PlaneGeometry(size, size, segments, segments);

  const canvas = document.createElement('canvas');
  canvas.width = segments;
  canvas.height = segments;
  const ctx = canvas.getContext('2d');
  if (!ctx) return geometry;

  ctx.drawImage(heightmapImage, 0, 0, segments, segments);
  const imgData = ctx.getImageData(0, 0, segments, segments).data;

  const pos = geometry.attributes.position;
  const uv = geometry.attributes.uv;

  for (let i = 0; i < pos.count; i++) {
    const u = uv.getX(i);
    const v = uv.getY(i);

    // v in PlaneGeometry goes 1 at top to 0 at bottom. In image coords, py = (1 - v) * (segments - 1)
    const px = Math.min(segments - 1, Math.max(0, Math.floor(u * (segments - 1))));
    const py = Math.min(segments - 1, Math.max(0, Math.floor((1 - v) * (segments - 1))));

    const idx = (py * segments + px) * 4;
    // Greyscale pixel value [0 - 255]
    const rawVal = imgData[idx] / 255.0;
    const height = rawVal * displacementScale + displacementBias;

    // Displace along local Z (which maps to World +Y after [-PI/2, 0, 0] rotation)
    pos.setZ(i, height);
  }

  pos.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  return geometry;
}

/**
 * Samples terrain height and surface normal using Three.js Raycaster.
 */
export function sampleTerrainHeight(
  x: number,
  z: number,
  terrainMesh: THREE.Mesh | null,
  fallbackY: number = 0.05
): TerrainSampleResult {
  if (!terrainMesh) {
    return { y: fallbackY, normal: defaultNormal };
  }

  rayOrigin.set(x, 6.0, z); // Cast from 6 units above
  raycaster.set(rayOrigin, downDirection);
  raycaster.far = 15.0;

  const intersects = raycaster.intersectObject(terrainMesh, false);
  if (intersects.length > 0) {
    const hit = intersects[0];
    const normal = hit.face ? hit.face.normal.clone().transformDirection(terrainMesh.matrixWorld) : defaultNormal;
    return {
      y: hit.point.y,
      normal,
    };
  }

  return { y: fallbackY, normal: defaultNormal };
}
