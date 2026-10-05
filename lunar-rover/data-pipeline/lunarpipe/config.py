"""Paths and tunable parameters. Everything the pipeline needs to know lives here."""
from dataclasses import dataclass
from pathlib import Path

import yaml

PIPELINE_DIR = Path(__file__).resolve().parent.parent
REPO_DIR = PIPELINE_DIR.parent


@dataclass(frozen=True)
class Settings:
    raw_dir: Path = PIPELINE_DIR / "raw"
    references_dir: Path = PIPELINE_DIR / "references"
    sources_file: Path = PIPELINE_DIR / "sources.yaml"
    output_dir: Path = REPO_DIR / "data" / "processed"

    # --- terrain tile pyramid ---
    tile_cells: int = 128          # quads per tile edge (tiles carry cells+1 samples)
    max_level: int = 6             # 2**6 tiles per side -> ~74 m/px for the 80 m DEM
    overview_px: int = 2048        # resolution of the GPS overview images

    # --- feature extraction ---
    cold_trap_min_km2: float = 8.0       # smallest permanently shadowed region listed
    crater_min_km: float = 6.0           # smallest Robbins crater listed as a POI
    sunlit_site_count: int = 24
    sunlit_site_min_separation_km: float = 6.0
    sunlit_smoothing_m: float = 240.0
    cold_trap_pole_count: int = 14       # biggest cold traps that also get info poles


def load_sources(settings: Settings) -> dict:
    with open(settings.sources_file, encoding="utf8") as f:
        return yaml.safe_load(f)["datasets"]


def load_reference(settings: Settings, name: str) -> dict:
    with open(settings.references_dir / name, encoding="utf8") as f:
        return yaml.safe_load(f)


def load_extra_credits(settings: Settings) -> list:
    with open(settings.sources_file, encoding="utf8") as f:
        return yaml.safe_load(f).get("extra_credits", [])
