"""Shared helpers for building points of interest (POIs)."""
from dataclasses import dataclass, field
import re

import numpy as np
from scipy.ndimage import map_coordinates

from ..layers import Layers

CATEGORIES = [
    {"id": "water_ice", "label": "Water & Ice", "description": "Confirmed water and permanently shadowed cold traps where ice can survive", "color": "#4fd1ff"},
    {"id": "crater", "label": "Craters", "description": "Impact craters from the Robbins catalogue and the IAU gazetteer", "color": "#ffb454"},
    {"id": "sunlit", "label": "Sunlit Sites", "description": "Places the Sun shines most often - ideal for solar power", "color": "#ffe66d"},
    {"id": "landmark", "label": "Landmarks", "description": "Mountains, extremes and other named features", "color": "#b79cff"},
]


@dataclass
class Poi:
    id: str
    category: str
    kind: str
    name: str
    x: float
    y: float
    radius_m: float = 0.0
    pole: bool = False
    props: dict = field(default_factory=dict)
    summary: str = ""
    facts: list = field(default_factory=list)   # [{"text":..., "source":...}]
    namesake: str | None = None
    link: str | None = None
    lon: float = 0.0
    lat: float = 0.0
    elevation_m: float = 0.0

    def to_dict(self) -> dict:
        d = {k: getattr(self, k) for k in (
            "id", "category", "kind", "name", "x", "y", "lon", "lat", "elevation_m", "radius_m", "pole", "props",
            "summary", "facts", "namesake", "link")}
        for k in ("x", "y", "lon", "lat", "elevation_m", "radius_m"):
            d[k] = round(float(d[k]), 3)
        return d


def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def sample(layers: Layers, array: np.ndarray, x, y, order: int = 1):
    """Bilinear sample of any layer-grid array at projected x, y (metres)."""
    rows, cols = layers.xy_to_rc(x, y)
    return map_coordinates(array, [np.atleast_1d(rows), np.atleast_1d(cols)], order=order, mode="nearest")


def in_coverage(layers: Layers, x, y) -> np.ndarray:
    rows, cols = layers.xy_to_rc(np.atleast_1d(x), np.atleast_1d(y))
    r, c = np.rint(rows).astype(int), np.rint(cols).astype(int)
    inside = (r >= 0) & (r < layers.shape[0]) & (c >= 0) & (c < layers.shape[1])
    ok = np.zeros(len(r), dtype=bool)
    ok[inside] = layers.coverage[r[inside], c[inside]]
    return ok


def finish_positions(layers: Layers, pois: list[Poi]) -> None:
    """Fill lon/lat/elevation from x, y using the real DEM and projection."""
    xs = np.array([p.x for p in pois])
    ys = np.array([p.y for p in pois])
    lon, lat = layers.projection.xy_to_lonlat(xs, ys)
    elev = sample(layers, layers.dem, xs, ys)
    for p, lo, la, el in zip(pois, lon, lat, elev):
        p.lon, p.lat, p.elevation_m = float(lo), float(la), float(el)
