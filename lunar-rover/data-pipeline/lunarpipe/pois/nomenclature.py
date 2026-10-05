"""IAU-approved feature names inside the covered zone."""
from dataclasses import dataclass

import geopandas as gpd
import numpy as np

from ..config import Settings, load_sources
from ..layers import Layers
from .common import in_coverage


@dataclass
class NamedFeature:
    name: str
    kind: str            # first word of the IAU type, e.g. "Crater", "Mons"
    x: float
    y: float
    diameter_km: float
    origin: str | None
    link: str | None


def _kind(iau_type: str) -> str:
    kind = str(iau_type).split(",")[0].strip()
    # "Satellite Feature" entries (e.g. "Cabeus B") are small craters named after a nearby crater.
    return "Crater" if kind == "Satellite Feature" else kind


def load_named_features(layers: Layers, settings: Settings) -> list[NamedFeature]:
    path = settings.raw_dir / load_sources(settings)["nomenclature"]["file"]
    frame = gpd.read_file(path)
    x, y = layers.projection.lonlat_to_xy(frame["center_lon"].to_numpy(), frame["center_lat"].to_numpy())
    keep = in_coverage(layers, x, y)
    features = []
    for row, px, py in zip(frame[keep].itertuples(), np.asarray(x)[keep], np.asarray(y)[keep]):
        diameter = float(row.diameter) if row.diameter == row.diameter else 0.0
        features.append(NamedFeature(
            name=row.clean_name or row.name,
            kind=_kind(row.type),
            x=float(px), y=float(py),
            diameter_km=diameter,
            origin=(row.origin or None),
            link=(row.link or None),
        ))
    return features
