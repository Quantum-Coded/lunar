"""Runtime configuration (override with environment variables prefixed LUNAR_)."""
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="LUNAR_")

    data_dir: Path = REPO_DIR / "data" / "processed"
    cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    # Rover traversability profile used by the route planner.
    rover_slope_limit_deg: float = 20.0       # steeper than this is treated as (almost) impassable
    rover_slope_penalty: float = 4.0          # extra cost multiplier as slope approaches the limit
    route_max_grid_px: int = 1400             # planner resolution cap (cells along the longest window side)
    route_window_margin: float = 0.35         # extra search area around start/goal, as a fraction of their span
    route_simplify_m: float = 120.0           # Douglas-Peucker tolerance for returned waypoints

    # Hardening. Behind a reverse proxy (Hugging Face, Render, ...) set LUNAR_TRUST_PROXY=true so the real client
    # address is read from X-Forwarded-For for rate limiting.
    enable_docs: bool = True                  # set LUNAR_ENABLE_DOCS=false in production
    trust_proxy: bool = False
    route_rate_limit: tuple[int, float] = (20, 60.0)     # route plans per client per minute (CPU heavy)
    query_rate_limit: tuple[int, float] = (300, 60.0)    # other API calls per client per minute
