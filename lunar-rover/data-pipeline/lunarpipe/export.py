"""Write the non-tile products: navigation grids, GPS overview images and region metadata."""
import json
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.ndimage import zoom

from .config import Settings, load_sources, load_extra_credits
from .layers import Layers
from .terrain import hillshade, slope_degrees


def write_nav_grids(layers: Layers, out_dir: Path) -> dict:
    """Raw arrays the backend memory-maps for lookups and routing (north-up, row-major)."""
    grid_dir = out_dir / "grids"
    grid_dir.mkdir(parents=True, exist_ok=True)
    slope = slope_degrees(layers.dem, layers.cell_m)
    arrays = {
        "elevation": np.where(layers.coverage, layers.dem, np.nan).astype("float32"),
        "slope": np.where(layers.coverage, slope, np.nan).astype("float16"),
        "illumination": np.nan_to_num(layers.illumination).astype("float16"),
        "psr": layers.psr.astype("uint8"),
        "coverage": layers.coverage.astype("uint8"),
    }
    for name, arr in arrays.items():
        np.save(grid_dir / f"{name}.npy", arr)
    return {
        "dir": "grids",
        "shape": list(layers.shape),
        "cell_m": layers.cell_m,
        "x0": layers.x0,
        "y0": layers.y0,
        "arrays": {k: str(v.dtype) for k, v in arrays.items()},
    }


def _save_rgba(arr: np.ndarray, path: Path) -> None:
    Image.fromarray(np.clip(arr, 0, 255).astype("uint8"), "RGBA").save(path, optimize=True)


def write_overview_images(layers: Layers, settings: Settings, out_dir: Path) -> dict:
    """Square, north-up map images for the GPS screen: shaded relief, shadow overlay, sunlight overlay."""
    size = settings.overview_px
    factor = size / layers.shape[0]
    shade = zoom(hillshade(layers.dem, layers.cell_m), factor, order=1, grid_mode=True, mode="nearest")
    psr = zoom(layers.psr.astype("float32"), factor, order=1, grid_mode=True, mode="nearest")
    sun = zoom(np.nan_to_num(layers.illumination), factor, order=1, grid_mode=True, mode="nearest")
    cover = zoom(layers.coverage.astype("float32"), factor, order=0, grid_mode=True, mode="nearest") > 0.5

    grey = (35 + 190 * shade)[..., None] * np.ones(3)
    base = np.dstack([grey, np.where(cover, 255, 0)])
    _save_rgba(base, out_dir / "overview_relief.png")

    shadow = np.dstack([np.full_like(psr, 70), np.full_like(psr, 150), np.full_like(psr, 255), 190 * psr])
    _save_rgba(shadow, out_dir / "overview_shadow.png")

    heat = np.clip(sun / max(sun.max(), 1e-6), 0, 1)
    sunlight = np.dstack([255 * np.ones_like(heat), 200 * heat + 40, 40 * np.ones_like(heat), 200 * heat ** 0.8])
    _save_rgba(sunlight, out_dir / "overview_sunlight.png")
    return {"size_px": size, "images": {"relief": "overview_relief.png", "shadow": "overview_shadow.png",
                                         "sunlight": "overview_sunlight.png"}}


def write_region(layers: Layers, settings: Settings, out_dir: Path, tiles: dict, nav: dict, overview: dict, poi_count: int) -> None:
    sources = load_sources(settings)
    area_km2 = float(layers.coverage.sum()) * (layers.cell_m / 1000.0) ** 2
    moon_km2 = 4 * np.pi * (layers.projection.crs.ellipsoid.semi_major_metre / 1000.0) ** 2
    ys, xs = np.nonzero(layers.coverage)
    _, lat = layers.projection.xy_to_lonlat(*layers.rc_to_xy(ys[::5000], xs[::5000]))
    region = {
        "name": "Lunar South Polar Region",
        "description": "Every point of this zone is backed by NASA LRO laser-altimeter data.",
        "projection": {
            "kind": "south_polar_stereographic",
            "wkt": layers.projection.crs.to_wkt(),
            "axes": "x = east, y = north, metres from the south pole",
        },
        "extent": {"xmin": layers.x0, "xmax": layers.x0 + layers.shape[1] * layers.cell_m,
                   "ymax": layers.y0, "ymin": layers.y0 - layers.shape[0] * layers.cell_m},
        "coverage": {
            "area_km2": round(area_km2, 1),
            "moon_surface_km2": round(moon_km2, 0),
            "fraction_of_moon": round(area_km2 / moon_km2, 5),
            "fraction_of_extent": round(float(layers.coverage.mean()), 4),
            "max_latitude_deg": round(float(lat.max()), 2),
            "note": "Coverage is the intersection of the footprints of every dataset below.",
        },
        "tiles": tiles,
        "navigation": nav,
        "overview": overview,
        "poi_count": poi_count,
        "datasets": [
            {"id": key, "title": s["title"], "provider": s["provider"], "citation": s["citation"], "url": s["url"],
             "published": s["published"], "plain": s["plain"], "used_for": s["used_for"]}
            for key, s in sources.items()
        ],
        "extra_credits": load_extra_credits(settings),
    }
    with open(out_dir / "region.json", "w", encoding="utf8") as f:
        json.dump(region, f, indent=1)
