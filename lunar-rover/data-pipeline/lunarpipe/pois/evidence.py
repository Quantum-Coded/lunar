"""Published, directly observed water evidence (hand-cited in references/ice_evidence.yaml)."""
from ..config import Settings, load_reference
from ..layers import Layers
from .common import Poi, in_coverage


def build_evidence_pois(layers: Layers, settings: Settings) -> list[Poi]:
    pois = []
    for site in load_reference(settings, "ice_evidence.yaml")["sites"]:
        x, y = layers.projection.lonlat_to_xy(site["lon_east"], site["lat"])
        if not in_coverage(layers, x, y)[0]:
            continue
        pois.append(Poi(
            id=site["id"], category="water_ice", kind="Confirmed water", name=site["name"],
            x=float(x[0] if hasattr(x, "__len__") else x), y=float(y[0] if hasattr(y, "__len__") else y),
            radius_m=500.0, pole=True, props={"ice_status": "confirmed"},
            summary=" ".join(site["summary"].split()), facts=list(site["facts"]),
        ))
    return pois
