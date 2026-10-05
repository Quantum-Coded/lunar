import * as THREE from "three";

/**
 * Geometry for one terrain tile: a (n x n) height grid plus a thin "skirt" around the edge that hides
 * cracks between neighbouring tiles of different detail levels. Positions are tile-local; the mesh is
 * positioned at the tile origin. Row 0 is the north edge, and +z (south) grows with the row.
 */
export function buildTileGeometry(heights: Float32Array, samples: number, cellM: number): THREE.BufferGeometry {
  const n = samples;
  const skirtDepth = Math.max(cellM * 6, 60);
  const gridCount = n * n;
  const skirtCount = 4 * n;
  const positions = new Float32Array((gridCount + skirtCount) * 3);
  const normals = new Float32Array((gridCount + skirtCount) * 3);
  const uvs = new Float32Array((gridCount + skirtCount) * 2);

  const h = (i: number, j: number) => heights[Math.min(Math.max(j, 0), n - 1) * n + Math.min(Math.max(i, 0), n - 1)];
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const k = j * n + i;
      positions.set([i * cellM, heights[k], j * cellM], k * 3);
      const gx = (h(i + 1, j) - h(i - 1, j)) / (2 * cellM);
      const gz = (h(i, j + 1) - h(i, j - 1)) / (2 * cellM);
      const inv = 1 / Math.hypot(gx, 1, gz);
      normals.set([-gx * inv, inv, -gz * inv], k * 3);
      uvs.set([(i + 0.5) / n, (j + 0.5) / n], k * 2);
    }
  }

  // Skirt vertices: copies of each edge vertex pushed down.
  const edges: number[][] = [[], [], [], []];
  for (let t = 0; t < n; t++) {
    edges[0].push(t); // north row
    edges[1].push((n - 1) * n + t); // south row
    edges[2].push(t * n); // west column
    edges[3].push(t * n + n - 1); // east column
  }
  const skirtStart = gridCount;
  edges.flat().forEach((src, s) => {
    const dst = skirtStart + s;
    positions.set([positions[src * 3], positions[src * 3 + 1] - skirtDepth, positions[src * 3 + 2]], dst * 3);
    normals.set(normals.subarray(src * 3, src * 3 + 3), dst * 3);
    uvs.set(uvs.subarray(src * 2, src * 2 + 2), dst * 2);
  });

  const indices: number[] = [];
  for (let j = 0; j < n - 1; j++) {
    for (let i = 0; i < n - 1; i++) {
      const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  edges.forEach((edge, e) => {
    for (let t = 0; t < n - 1; t++) {
      const top0 = edge[t], top1 = edge[t + 1];
      const low0 = skirtStart + e * n + t, low1 = low0 + 1;
      // Winding differs per side so the skirt faces outwards; the material is double sided anyway.
      indices.push(top0, low0, top1, top1, low0, low1);
    }
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  // Bounds are generous vertically so tiles are never culled by the (cheap) sphere test while on screen.
  geometry.computeBoundingSphere();
  return geometry;
}
