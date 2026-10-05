import * as THREE from "three";
import { api } from "../api/client";
import type { TileInfo } from "../api/types";

export interface LoadedTile {
  z: number;
  tx: number;
  ty: number;
  /** (samples x samples) elevations in metres, row 0 = north. */
  heights: Float32Array;
  /** R = sun visibility, G = permanent shadow, B = slope, A = real-data coverage. */
  dataTexture: THREE.Texture;
}

const decodeCanvas = typeof document !== "undefined" ? document.createElement("canvas") : null;

async function fetchBitmap(url: string): Promise<ImageBitmap> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Tile request failed (${res.status}): ${url}`);
  return createImageBitmap(await res.blob(), { premultiplyAlpha: "none", colorSpaceConversion: "none" });
}

/** The pipeline stores 16-bit heights across the R (high byte) and G (low byte) channels. */
function decodeHeights(bitmap: ImageBitmap, info: TileInfo): Float32Array {
  const n = info.samples;
  decodeCanvas!.width = n;
  decodeCanvas!.height = n;
  const ctx = decodeCanvas!.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0);
  const px = ctx.getImageData(0, 0, n, n).data;
  const out = new Float32Array(n * n);
  const range = info.height_max_m - info.height_min_m;
  for (let i = 0; i < n * n; i++) {
    out[i] = info.height_min_m + ((px[i * 4] * 256 + px[i * 4 + 1]) / 65535) * range;
  }
  return out;
}

export async function loadTile(info: TileInfo, z: number, tx: number, ty: number): Promise<LoadedTile> {
  const [heightBitmap, dataBitmap] = await Promise.all([
    fetchBitmap(api.tileUrl(z, tx, ty, "height")),
    fetchBitmap(api.tileUrl(z, tx, ty, "data")),
  ]);
  const heights = decodeHeights(heightBitmap, info);
  heightBitmap.close();

  const dataTexture = new THREE.Texture(dataBitmap);
  dataTexture.colorSpace = THREE.NoColorSpace;
  dataTexture.minFilter = dataTexture.magFilter = THREE.LinearFilter;
  dataTexture.generateMipmaps = false;
  dataTexture.needsUpdate = true;
  return { z, tx, ty, heights, dataTexture };
}
