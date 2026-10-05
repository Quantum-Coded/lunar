"""Assemble every POI source into one list, attach cited facts and real coordinates."""
from ..config import Settings, load_reference
from ..layers import Layers
from .common import CATEGORIES, Poi, finish_positions
from .cold_traps import build_cold_trap_pois
from .craters import build_crater_pois
from .evidence import build_evidence_pois
from .landmarks import build_landmark_pois
from .nomenclature import load_named_features
from .sunlit import build_sunlit_pois


def build_pois(layers: Layers, settings: Settings) -> dict:
    named = load_named_features(layers, settings)
    pois: list[Poi] = []
    pois += build_crater_pois(layers, settings, named)
    pois += build_cold_trap_pois(layers, settings, named)
    pois += build_sunlit_pois(layers, settings, named)
    pois += build_landmark_pois(layers, named)
    pois += build_evidence_pois(layers, settings)

    curated = load_reference(settings, "facts.yaml")
    by_name = curated.get("features", {})
    for poi in pois:
        for key, facts in by_name.items():
            if poi.name == key or poi.name.startswith(f"{key} cold trap"):
                poi.facts.extend(facts)

    finish_positions(layers, pois)
    return {
        "categories": CATEGORIES,
        "zone_facts": curated.get("zone_facts", []),
        "pois": [p.to_dict() for p in pois],
    }
