"""Projection helpers. The whole project works in the DEM's south-polar stereographic metres:
X = east, Y = north, origin at the south pole."""
import numpy as np
from pyproj import CRS, Transformer


class PolarProjection:
    def __init__(self, projected_crs: CRS, geographic_crs: CRS):
        self.crs = projected_crs
        self._fwd = Transformer.from_crs(geographic_crs, projected_crs, always_xy=True)
        self._inv = Transformer.from_crs(projected_crs, geographic_crs, always_xy=True)

    def lonlat_to_xy(self, lon_east, lat):
        return self._fwd.transform(np.asarray(lon_east, dtype="float64"), np.asarray(lat, dtype="float64"))

    def xy_to_lonlat(self, x, y):
        lon, lat = self._inv.transform(np.asarray(x, dtype="float64"), np.asarray(y, dtype="float64"))
        return np.mod(lon, 360.0), lat
