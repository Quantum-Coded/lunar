"""Landmark POIs: IAU-named non-crater features plus the highest and lowest points of the covered zone."""
import numpy as np

from ..layers import Layers
from .common import Poi, slug
from .nomenclature import NamedFeature


def _extreme(layers: Layers, which: str) -> Poi:
    dem = np.where(layers.coverage, layers.dem, np.nan)
    flat = np.nanargmax(dem) if which == "high" else np.nanargmin(dem)
    row, col = np.unravel_index(int(flat), dem.shape)
    x, y = layers.rc_to_xy(row, col)
    elev = float(dem[row, col])
    label = "Highest point" if which == "high" else "Lowest point"
    return Poi(
        id=f"extreme-{which}", category="landmark", kind=label, name=f"{label} in the surveyed zone",
        x=float(x), y=float(y), pole=True, props={"elevation_m": round(elev, 1)},
        summary=(f"The {'highest' if which == 'high' else 'lowest'} ground inside the surveyed zone, at {elev / 1000:.2f} km "
                 "relative to the Moon's mean reference sphere (radius 1737.4 km)."),
        facts=[{"text": "Elevations are measured by LRO's laser altimeter, which fires 28 laser pulses per second at the surface.",
                "source": "NASA LOLA instrument overview"}],
    )


def build_landmark_pois(layers: Layers, named: list[NamedFeature]) -> list[Poi]:
    pois = [_extreme(layers, "high"), _extreme(layers, "low")]
    for f in named:
        if f.kind == "Crater":
            continue
        poi = Poi(
            id=f"iau-{slug(f.name)}", category="landmark", kind=f.kind, name=f.name, x=f.x, y=f.y,
            radius_m=f.diameter_km * 500.0, pole=True, namesake=f.origin, link=f.link,
            props={"diameter_km": round(f.diameter_km, 2)},
            summary=f"{f.name} is an IAU-named {f.kind.lower()} roughly {f.diameter_km:.0f} km across.",
        )
        pois.append(poi)
    return pois
