"""Terrain derivatives computed from the real elevation model."""
import numpy as np


def _filled(dem: np.ndarray) -> np.ndarray:
    return np.where(np.isfinite(dem), dem, np.nanmean(dem))


def slope_degrees(dem: np.ndarray, cell_m: float) -> np.ndarray:
    """Slope of the elevation model in degrees (NaN stays NaN)."""
    dz_dy, dz_dx = np.gradient(_filled(dem), cell_m)
    slope = np.degrees(np.arctan(np.hypot(dz_dx, dz_dy))).astype("float32")
    slope[~np.isfinite(dem)] = np.nan
    return slope


def hillshade(dem: np.ndarray, cell_m: float, azimuth_deg: float = 315.0, altitude_deg: float = 25.0) -> np.ndarray:
    """0..1 shaded relief for map thumbnails. Azimuth is clockwise from north (north = row 0)."""
    dz_dy, dz_dx = np.gradient(_filled(dem), cell_m)
    az, alt = np.radians(azimuth_deg), np.radians(altitude_deg)
    slope = np.arctan(np.hypot(dz_dx, dz_dy))
    aspect = np.arctan2(dz_dx, dz_dy)  # rows grow southwards
    shade = np.sin(alt) * np.cos(slope) + np.cos(alt) * np.sin(slope) * np.cos(az - aspect)
    return np.clip(shade, 0.0, 1.0).astype("float32")
