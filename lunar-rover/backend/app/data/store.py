"""Read-only access to the processed data products (the pipeline's output contract)."""
import json
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from pyproj import CRS, Transformer
from scipy.ndimage import map_coordinates
from scipy.spatial import cKDTree


@dataclass
class Grid:
    """A north-up raster in projected metres (row 0 = northern edge)."""
    arrays: dict[str, np.ndarray]
    cell_m: float
    x0: float
    y0: float

    @property
    def shape(self) -> tuple[int, int]:
        return next(iter(self.arrays.values())).shape

    def xy_to_rc(self, x, y):
        return (self.y0 - np.asarray(y)) / self.cell_m - 0.5, (np.asarray(x) - self.x0) / self.cell_m - 0.5

    def rc_to_xy(self, row, col):
        return self.x0 + (np.asarray(col) + 0.5) * self.cell_m, self.y0 - (np.asarray(row) + 0.5) * self.cell_m

    def contains(self, x: float, y: float) -> bool:
        row, col = self.xy_to_rc(x, y)
        r, c = int(round(float(row))), int(round(float(col)))
        h, w = self.shape
        return 0 <= r < h and 0 <= c < w and bool(self.arrays["coverage"][r, c])

    def sample(self, name: str, x: float, y: float) -> float:
        row, col = self.xy_to_rc(x, y)
        arr = self.arrays[name]
        # Interpolate on a small window so we never touch the whole memory-mapped raster.
        r0, c0 = int(np.floor(row)) - 1, int(np.floor(col)) - 1
        r0, c0 = np.clip(r0, 0, arr.shape[0] - 4), np.clip(c0, 0, arr.shape[1] - 4)
        window = np.asarray(arr[r0:r0 + 4, c0:c0 + 4], dtype="float32")
        value = map_coordinates(np.nan_to_num(window, nan=float(np.nanmean(window)) if np.isfinite(window).any() else 0.0),
                                [[row - r0], [col - c0]], order=1, mode="nearest")[0]
        return float(value)


class DataStore:
    def __init__(self, data_dir: Path):
        self.data_dir = data_dir
        self.region = json.loads((data_dir / "region.json").read_text(encoding="utf8"))
        poi_doc = json.loads((data_dir / "pois.json").read_text(encoding="utf8"))
        self.categories: list[dict] = poi_doc["categories"]
        self.zone_facts: list[dict] = poi_doc["zone_facts"]
        self.pois: list[dict] = poi_doc["pois"]
        self.pois_by_id = {p["id"]: p for p in self.pois}
        self.poi_tree = cKDTree(np.array([[p["x"], p["y"]] for p in self.pois]))

        nav = self.region["navigation"]
        grid_dir = data_dir / nav["dir"]
        self.grid = Grid(
            arrays={name: np.load(grid_dir / f"{name}.npy", mmap_mode="r") for name in nav["arrays"]},
            cell_m=nav["cell_m"], x0=nav["x0"], y0=nav["y0"],
        )
        projected = CRS.from_wkt(self.region["projection"]["wkt"])
        self._to_lonlat = Transformer.from_crs(projected, projected.geodetic_crs, always_xy=True)

    def lonlat(self, x: float, y: float) -> tuple[float, float]:
        lon, lat = self._to_lonlat.transform(x, y)
        return float(lon % 360.0), float(lat)
