"""Load the raw rasters and resample them onto one common grid (the DEM's own grid)."""
from dataclasses import dataclass

import numpy as np
import rasterio
from pyproj import CRS
from rasterio.warp import Resampling, reproject

from .config import Settings, load_sources
from .geo import PolarProjection


@dataclass
class Layers:
    """All rasters share this grid: row 0 is the northern edge, column 0 the western edge."""
    dem: np.ndarray            # float32 metres, NaN where no data
    illumination: np.ndarray   # float32 fraction of time the Sun is visible (0..1), NaN where no data
    psr: np.ndarray            # bool, permanently shadowed
    coverage: np.ndarray       # bool, every layer has real data here
    transform: rasterio.Affine
    projection: PolarProjection
    cell_m: float

    @property
    def shape(self):
        return self.dem.shape

    @property
    def x0(self) -> float:
        return self.transform.c

    @property
    def y0(self) -> float:
        return self.transform.f

    def xy_to_rc(self, x, y):
        """Fractional (row, col) in pixel-centre coordinates - for map_coordinates."""
        return (self.y0 - np.asarray(y)) / self.cell_m - 0.5, (np.asarray(x) - self.x0) / self.cell_m - 0.5

    def rc_to_xy(self, row, col):
        return self.x0 + (np.asarray(col) + 0.5) * self.cell_m, self.y0 - (np.asarray(row) + 0.5) * self.cell_m


def _warp_to(src_ds, dst_shape, dst_transform, dst_crs, resampling):
    dst = np.full(dst_shape, np.nan, dtype="float32")
    reproject(
        source=rasterio.band(src_ds, 1),
        destination=dst,
        dst_transform=dst_transform,
        dst_crs=dst_crs,
        resampling=resampling,
        src_nodata=src_ds.nodata,
        dst_nodata=np.nan,
    )
    return dst


def load_layers(settings: Settings) -> Layers:
    sources = load_sources(settings)
    raw = settings.raw_dir

    with rasterio.open(raw / sources["dem"]["file"]) as dem_ds:
        dem = dem_ds.read(1).astype("float32")
        if dem_ds.nodata is not None:
            dem[dem == dem_ds.nodata] = np.nan
        transform, crs, shape = dem_ds.transform, dem_ds.crs, dem.shape
        projected = CRS.from_wkt(crs.to_wkt())
        cell_m = float(transform.a)

    with rasterio.open(raw / sources["illumination"]["file"]) as ds:
        scaled = _warp_to(ds, shape, transform, crs, Resampling.bilinear)
        illumination = np.clip(scaled * float(sources["illumination"].get("scale", 1.0)), 0.0, 1.0)

    with rasterio.open(raw / sources["psr"]["file"]) as ds:
        # The PSR product stores +20000 for shadow and -20000 for lit (see the PDS label).
        shadow = _warp_to(ds, shape, transform, crs, Resampling.nearest)

    coverage = np.isfinite(dem) & np.isfinite(illumination) & np.isfinite(shadow)
    return Layers(
        dem=dem,
        illumination=illumination,
        psr=(shadow > 0) & coverage,
        coverage=coverage,
        transform=transform,
        projection=PolarProjection(projected, projected.geodetic_crs),
        cell_m=cell_m,
    )
