"""Querying points of interest."""
from ..data.store import DataStore
from .geometry import bearing_deg, distance_m

# Fields that make up the light-weight listing; everything else is served by the detail endpoint.
_SUMMARY_FIELDS = ("id", "category", "kind", "name", "x", "y", "lon", "lat", "elevation_m", "radius_m", "pole")


def summarize(poi: dict, origin: tuple[float, float] | None = None) -> dict:
    out = {k: poi[k] for k in _SUMMARY_FIELDS}
    out["props"] = poi["props"]
    if origin:
        out["distance_m"] = round(distance_m(*origin, poi["x"], poi["y"]), 1)
        out["bearing_deg"] = round(bearing_deg(*origin, poi["x"], poi["y"]), 1)
    return out


def search(store: DataStore, *, category: str | None, origin: tuple[float, float] | None,
           limit: int, query: str | None, poles_only: bool, radius_m: float | None) -> list[dict]:
    pool = store.pois
    if origin and radius_m:
        idx = store.poi_tree.query_ball_point(origin, radius_m)
        pool = [store.pois[i] for i in idx]
    if category:
        pool = [p for p in pool if p["category"] == category]
    if poles_only:
        pool = [p for p in pool if p["pole"]]
    if query:
        q = query.lower()
        pool = [p for p in pool if q in p["name"].lower() or q in p["kind"].lower()]
    rows = [summarize(p, origin) for p in pool]
    if origin:
        rows.sort(key=lambda r: r["distance_m"])
    else:
        rows.sort(key=lambda r: (not r["pole"], -r["radius_m"]))
    return rows[:limit]
