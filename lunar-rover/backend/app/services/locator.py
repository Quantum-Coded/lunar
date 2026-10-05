"""'Where am I?' - everything the data knows about one point."""
from ..data.store import DataStore
from .geometry import bearing_deg, distance_m


def locate(store: DataStore, x: float, y: float) -> dict:
    lon, lat = store.lonlat(x, y)
    covered = store.grid.contains(x, y)
    info = {"x": x, "y": y, "lon": lon, "lat": lat, "in_coverage": covered}
    if not covered:
        return info

    grid = store.grid
    psr_value = grid.sample("psr", x, y)
    info.update(
        elevation_m=round(grid.sample("elevation", x, y), 1),
        slope_deg=round(max(grid.sample("slope", x, y), 0.0), 1),
        sun_visibility_pct=round(100.0 * grid.sample("illumination", x, y), 1),
        in_shadow_region=bool(psr_value >= 0.5),
    )

    # Features whose footprint contains the point (e.g. which crater am I inside?), smallest first.
    nearby = store.poi_tree.query_ball_point([x, y], r=60_000)
    inside = [store.pois[i] for i in nearby
              if store.pois[i]["radius_m"] > 0 and store.pois[i]["category"] in ("crater", "water_ice")
              and distance_m(x, y, store.pois[i]["x"], store.pois[i]["y"]) <= store.pois[i]["radius_m"]]
    inside.sort(key=lambda p: p["radius_m"])
    info["inside"] = [{"id": p["id"], "name": p["name"], "kind": p["kind"]} for p in inside[:4]]

    # Nearest *known* place: skip catalogue craters that have no official name.
    dists, idxs = store.poi_tree.query([x, y], k=min(40, len(store.pois)))
    dist, nearest = next(((d, store.pois[int(i)]) for d, i in zip(dists, idxs)
                          if store.pois[int(i)]["props"].get("named") is not False), (dists[0], store.pois[int(idxs[0])]))
    info["nearest_poi"] = {
        "id": nearest["id"], "name": nearest["name"], "kind": nearest["kind"],
        "distance_m": round(float(dist), 1), "bearing_deg": round(bearing_deg(x, y, nearest["x"], nearest["y"]), 1),
    }
    return info
