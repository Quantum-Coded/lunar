"""Build the terrain tile pyramid the 3D client streams.

Every tile holds (cells+1)^2 samples so neighbouring tiles share an edge row/column.
Two PNGs per tile:
  height.png  RGB: 16-bit elevation split across R (high byte) and G (low byte), scaled to [min, max]
  data.png    RGBA: R = sun visibility, G = permanent shadow, B = slope, A = real-data coverage
"""
import json
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.ndimage import zoom

from .config import Settings
from .layers import Layers
from .terrain import slope_degrees

SLOPE_FULL_SCALE_DEG = 45.0  # slope value that maps to 255 in data.png (B channel)


def _block_mean(a: np.ndarray) -> np.ndarray:
    h, w = a.shape
    return a.reshape(h // 2, 2, w // 2, 2).mean(axis=(1, 3))


def _resample_square(a: np.ndarray, size: int, order: int) -> np.ndarray:
    return zoom(a, size / a.shape[0], order=order, grid_mode=True, mode="nearest").astype("float32")


def _encode_height(h: np.ndarray, lo: float, hi: float) -> np.ndarray:
    q = np.clip(np.rint((h - lo) / (hi - lo) * 65535.0), 0, 65535).astype("uint16")
    return np.dstack([(q >> 8).astype("uint8"), (q & 255).astype("uint8"), np.zeros_like(q, dtype="uint8")])


def _encode_data(illum, psr, slope, cover) -> np.ndarray:
    to8 = lambda a: np.clip(np.rint(a * 255.0), 0, 255).astype("uint8")
    return np.dstack([to8(illum), to8(psr), to8(slope / SLOPE_FULL_SCALE_DEG), np.where(cover >= 0.5, 255, 0).astype("uint8")])


def build_tile_pyramid(layers: Layers, settings: Settings, out_dir: Path) -> dict:
    cells, max_level = settings.tile_cells, settings.max_level
    finest = cells * 2 ** max_level
    extent_m = layers.shape[1] * layers.cell_m
    lo, hi = float(np.nanmin(layers.dem)), float(np.nanmax(layers.dem))

    dem = np.where(layers.coverage, layers.dem, np.nanmean(layers.dem))
    level_arrays = {
        "dem": _resample_square(dem, finest, 1),
        "illum": _resample_square(np.nan_to_num(layers.illumination), finest, 1),
        "psr": _resample_square(layers.psr.astype("float32"), finest, 1),
        "cover": _resample_square(layers.coverage.astype("float32"), finest, 1),
    }

    available: dict[int, list[list[int]]] = {}
    level_info = []
    for level in range(max_level, -1, -1):
        n = cells * 2 ** level
        cell_m = extent_m / n
        dem_l, illum_l, psr_l, cover_l = (level_arrays[k] for k in ("dem", "illum", "psr", "cover"))
        slope_l = slope_degrees(dem_l, cell_m)
        level_info.append({"z": level, "cell_m": cell_m, "tiles_per_side": 2 ** level})

        pad = lambda a: np.pad(a, ((0, 1), (0, 1)), mode="edge")
        dem_p, illum_p, psr_p, slope_p, cover_p = map(pad, (dem_l, illum_l, psr_l, slope_l, cover_l))

        available[level] = []
        for ty in range(2 ** level):
            for tx in range(2 ** level):
                sl = (slice(ty * cells, ty * cells + cells + 1), slice(tx * cells, tx * cells + cells + 1))
                cover = cover_p[sl]
                if cover.max() < 0.5:
                    continue
                tile_dir = out_dir / "tiles" / str(level) / str(tx) / str(ty)
                tile_dir.mkdir(parents=True, exist_ok=True)
                Image.fromarray(_encode_height(dem_p[sl], lo, hi)).save(tile_dir / "height.png", compress_level=6)
                Image.fromarray(_encode_data(illum_p[sl], psr_p[sl], slope_p[sl], cover)).save(tile_dir / "data.png", compress_level=6)
                available[level].append([tx, ty])
        print(f"  level {level}: {len(available[level])} tiles @ {cell_m:.1f} m/sample")

        if level > 0:
            level_arrays = {k: _block_mean(v) for k, v in level_arrays.items()}

    return {
        "cells": cells,
        "samples": cells + 1,
        "max_level": max_level,
        "extent_m": extent_m,
        "height_min_m": lo,
        "height_max_m": hi,
        "slope_full_scale_deg": SLOPE_FULL_SCALE_DEG,
        "levels": sorted(level_info, key=lambda l: l["z"]),
        "available": {str(k): v for k, v in available.items()},
    }
