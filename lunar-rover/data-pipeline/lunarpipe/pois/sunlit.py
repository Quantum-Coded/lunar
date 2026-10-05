"""Sunlit-site POIs: local maxima of the LOLA average solar-visibility map."""
import numpy as np
from scipy import ndimage

from ..config import Settings
from ..layers import Layers
from .common import Poi
from .cold_traps import nearest_feature
from .nomenclature import NamedFeature


def build_sunlit_pois(layers: Layers, settings: Settings, named: list[NamedFeature]) -> list[Poi]:
    sigma_px = settings.sunlit_smoothing_m / layers.cell_m
    smooth = ndimage.gaussian_filter(np.nan_to_num(layers.illumination), sigma_px)
    smooth[~layers.coverage] = 0.0

    sep_px = int(settings.sunlit_site_min_separation_km * 1000.0 / layers.cell_m)
    peaks = (smooth == ndimage.maximum_filter(smooth, size=2 * sep_px + 1)) & (smooth > 0)
    rows, cols = np.nonzero(peaks)
    order = np.argsort(-smooth[rows, cols])[: settings.sunlit_site_count]

    pois: list[Poi] = []
    for rank, i in enumerate(order):
        row, col = int(rows[i]), int(cols[i])
        x, y = layers.rc_to_xy(row, col)
        near, dist = nearest_feature(named, float(x), float(y))
        pct = 100.0 * float(smooth[row, col])
        if dist <= 40_000.0:
            name, where = f"Sunlit ridge near {near.name}", f"{dist / 1000:.0f} km from {near.name}"
        else:
            lon, lat = layers.projection.xy_to_lonlat(x, y)
            name, where = f"Sunlit highland at {abs(float(lat)):.1f}°S", f"at {abs(float(lat)):.1f}°S"
        poi = Poi(
            id=f"sunlit-{rank + 1}", category="sunlit", kind="Sunlit site", name=name,
            x=float(x), y=float(y), radius_m=sep_px * layers.cell_m * 0.25, pole=rank < 10,
            props={"sun_visibility_pct": round(pct, 1), "elevation_m": round(float(layers.dem[row, col]), 1),
                   "nearest_named": near.name, "nearest_named_km": round(dist / 1000.0, 1)},
            summary=(f"The Sun is above the horizon here about {pct:.0f}% of the time, making this one of the sunniest "
                     f"spots in the zone ({where}). A good place for a solar-powered rover to recharge."),
        )
        poi.facts.append({"text": f"Average solar visibility of {pct:.0f}% (the Sun's disc, at least partly, above the local horizon).",
                          "source": "LOLA average solar visibility (Mazarico et al. 2011)"})
        pois.append(poi)
    return pois
