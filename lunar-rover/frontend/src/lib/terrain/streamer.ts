import type { Region, TileInfo } from "../api/types";
import { toWorldZ } from "../world/coords";
import { loadTile, type LoadedTile } from "./tileLoader";

export interface TileKey {
  z: number;
  tx: number;
  ty: number;
}

const keyOf = (z: number, tx: number, ty: number) => `${z}/${tx}/${ty}`;
const MAX_PARALLEL_LOADS = 8;
/** Loaded tiles kept in memory; beyond this the least recently drawn detail tiles are dropped. */
const MAX_CACHED_TILES = 700;
/** Levels at or below this are tiny and always kept so something can be drawn anywhere. */
const PINNED_LEVELS = 2;
/** A tile is refined while the camera is closer than SPLIT_FACTOR x its edge length. */
const SPLIT_FACTOR = 1.6;

/**
 * Quadtree level-of-detail over the tile pyramid. It owns the loaded tiles, decides which ones to draw for
 * a camera position, and answers terrain-height queries for physics from the finest tile available.
 */
export class TerrainStreamer {
  readonly info: TileInfo;
  private readonly xmin: number;
  private readonly zmin: number;
  private readonly available = new Set<string>();
  private readonly tiles = new Map<string, LoadedTile>();
  private readonly pending = new Set<string>();
  private readonly queue: TileKey[] = [];
  private readonly lastUsed = new Map<string, number>();
  private failures = 0;
  onTileLoaded: (tile: LoadedTile) => void = () => {};

  constructor(region: Region) {
    this.info = region.tiles;
    this.xmin = region.extent.xmin;
    this.zmin = toWorldZ(region.extent.ymax);
    for (const [z, list] of Object.entries(this.info.available)) {
      for (const [tx, ty] of list) this.available.add(keyOf(Number(z), tx, ty));
    }
  }

  tileSize(z: number): number {
    return this.info.extent_m / 2 ** z;
  }

  cellSize(z: number): number {
    return this.tileSize(z) / this.info.cells;
  }

  /** World position of the tile's first height sample (north-west corner). */
  origin(z: number, tx: number, ty: number): [number, number] {
    const size = this.tileSize(z);
    const half = this.cellSize(z) / 2;
    return [this.xmin + tx * size + half, this.zmin + ty * size + half];
  }

  get(z: number, tx: number, ty: number): LoadedTile | undefined {
    return this.tiles.get(keyOf(z, tx, ty));
  }

  private request(z: number, tx: number, ty: number) {
    const key = keyOf(z, tx, ty);
    if (this.tiles.has(key) || this.pending.has(key) || this.failures > 20) return;
    this.pending.add(key);
    this.queue.push({ z, tx, ty });
    this.pump();
  }

  private pump() {
    while (this.queue.length && this.inFlight < MAX_PARALLEL_LOADS) {
      const { z, tx, ty } = this.queue.shift()!;
      this.inFlight++;
      loadTile(this.info, z, tx, ty)
        .then((tile) => {
          this.tiles.set(keyOf(z, tx, ty), tile);
          this.onTileLoaded(tile);
        })
        .catch((err) => {
          this.failures++;
          console.warn(err);
        })
        .finally(() => {
          this.inFlight--;
          this.pending.delete(keyOf(z, tx, ty));
          this.pump();
        });
    }
  }
  private inFlight = 0;

  /** Make sure the coarsest levels exist so there is always something to draw. */
  preload(levels = 2) {
    for (let z = 0; z <= levels; z++) {
      for (const k of this.available) {
        const [kz, tx, ty] = k.split("/").map(Number);
        if (kz === z) this.request(kz, tx, ty);
      }
    }
  }

  /** Tiles to draw for a camera at (wx, wz). Missing detail is requested; coarser tiles stand in until it arrives. */
  select(wx: number, wz: number): TileKey[] {
    const out: TileKey[] = [];
    const visit = (z: number, tx: number, ty: number) => {
      if (!this.available.has(keyOf(z, tx, ty))) return;
      const size = this.tileSize(z);
      const cx = this.xmin + (tx + 0.5) * size;
      const cz = this.zmin + (ty + 0.5) * size;
      const wantsSplit = z < this.info.max_level && Math.hypot(wx - cx, wz - cz) < size * SPLIT_FACTOR;
      if (wantsSplit) {
        const children: [number, number][] = [[0, 0], [1, 0], [0, 1], [1, 1]]
          .map(([dx, dy]) => [tx * 2 + dx, ty * 2 + dy] as [number, number])
          .filter(([cx2, cy2]) => this.available.has(keyOf(z + 1, cx2, cy2)));
        const ready = children.every(([cx2, cy2]) => this.tiles.has(keyOf(z + 1, cx2, cy2)));
        if (ready) {
          children.forEach(([cx2, cy2]) => visit(z + 1, cx2, cy2));
          return;
        }
        children.forEach(([cx2, cy2]) => this.request(z + 1, cx2, cy2));
      }
      if (this.tiles.has(keyOf(z, tx, ty))) {
        this.lastUsed.set(keyOf(z, tx, ty), performance.now());
        out.push({ z, tx, ty });
      }
      else this.request(z, tx, ty);
    };
    visit(0, 0, 0);
    return out;
  }

  /** Frees the oldest unused detail tiles once the cache is over its limit (call after select()). */
  evict(): void {
    if (this.tiles.size <= MAX_CACHED_TILES) return;
    const candidates = [...this.tiles.entries()]
      .filter(([, tile]) => tile.z > PINNED_LEVELS)
      .sort(([a], [b]) => (this.lastUsed.get(a) ?? 0) - (this.lastUsed.get(b) ?? 0));
    let toDrop = this.tiles.size - Math.floor(MAX_CACHED_TILES * 0.85);
    for (const [key, tile] of candidates) {
      if (toDrop-- <= 0) break;
      tile.dataTexture.dispose();
      this.tiles.delete(key);
      this.lastUsed.delete(key);
    }
  }

  /** Terrain elevation (metres) at a world position, from the finest loaded tile; null if nothing covers it. */
  heightAt(wx: number, wz: number): number | null {
    for (let z = this.info.max_level; z >= 0; z--) {
      const size = this.tileSize(z);
      const tx = Math.floor((wx - this.xmin) / size);
      const ty = Math.floor((wz - this.zmin) / size);
      const tile = this.tiles.get(keyOf(z, tx, ty));
      if (!tile) continue;
      const [ox, oz] = this.origin(z, tx, ty);
      const cell = this.cellSize(z);
      const n = this.info.samples;
      const u = Math.min(Math.max((wx - ox) / cell, 0), n - 1.001);
      const v = Math.min(Math.max((wz - oz) / cell, 0), n - 1.001);
      const i = Math.floor(u), j = Math.floor(v);
      const fu = u - i, fv = v - j;
      const h = tile.heights;
      const top = h[j * n + i] * (1 - fu) + h[j * n + i + 1] * fu;
      const bottom = h[(j + 1) * n + i] * (1 - fu) + h[(j + 1) * n + i + 1] * fu;
      return top * (1 - fv) + bottom * fv;
    }
    return null;
  }

  /** Highest detail level already loaded under a world position (-1 if none). */
  finestLevelAt(wx: number, wz: number): number {
    for (let z = this.info.max_level; z >= 0; z--) {
      const size = this.tileSize(z);
      if (this.tiles.has(keyOf(z, Math.floor((wx - this.xmin) / size), Math.floor((wz - this.zmin) / size)))) return z;
    }
    return -1;
  }

  /** True when a position lies inside the surveyed zone (a tile of the coarsest level covers it). */
  isCovered(wx: number, wz: number): boolean {
    const size = this.tileSize(0);
    return wx >= this.xmin && wx <= this.xmin + size && wz >= this.zmin && wz <= this.zmin + size;
  }
}
