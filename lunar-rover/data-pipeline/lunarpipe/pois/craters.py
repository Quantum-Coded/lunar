"""Crater POIs: the Robbins catalogue positions/sizes, IAU names, and depth/shadow measured from our DEM."""
import numpy as np
import pandas as pd

from ..config import Settings, load_sources
from ..layers import Layers
from .common import Poi, in_coverage, slug
from .nomenclature import NamedFeature

_MAX_WINDOW_PX = 400


def _measure(layers: Layers, x: float, y: float, radius_m: float) -> dict:
    """Rim-to-floor depth, floor shadow fraction and rim sunlight, straight from the rasters."""
    row, col = layers.xy_to_rc(x, y)
    radius_px = radius_m / layers.cell_m
    stride = max(1, int(np.ceil(1.6 * radius_px / _MAX_WINDOW_PX)))
    half = int(1.6 * radius_px)
    r0, r1 = max(int(row) - half, 0), min(int(row) + half + 1, layers.shape[0])
    c0, c1 = max(int(col) - half, 0), min(int(col) + half + 1, layers.shape[1])
    rr, cc = np.mgrid[r0:r1:stride, c0:c1:stride]
    dist = np.hypot(rr - row, cc - col) / radius_px
    dem = layers.dem[rr, cc]
    ring = (dist > 0.9) & (dist < 1.1)
    floor = dist < 0.6
    if ring.sum() < 8 or floor.sum() < 4:
        return {}
    rim_h, floor_h = float(np.percentile(dem[ring], 75)), float(np.percentile(dem[floor], 10))
    return {
        "depth_m": max(rim_h - floor_h, 0.0),
        "rim_elevation_m": rim_h,
        "floor_elevation_m": floor_h,
        "floor_shadow_pct": 100.0 * float(layers.psr[rr, cc][floor].mean()),
        "rim_sun_pct": 100.0 * float(layers.illumination[rr, cc][ring].mean()),
    }


def _describe(poi: Poi, d_km: float, m: dict) -> None:
    named = not poi.name.startswith("Unnamed")
    poi.summary = (f"{poi.name} is an impact crater about {d_km:.0f} km across." if named
                   else f"An impact crater about {d_km:.1f} km across, catalogued by Robbins (2019).")
    if m.get("depth_m", 0) > 0:
        poi.facts.append({"text": f"Measured from the LOLA elevation model, its floor sits about {m['depth_m'] / 1000:.1f} km below its rim.",
                          "source": "LOLA LDEM 80 m (Barker et al. 2021)"})
    if m.get("floor_shadow_pct", 0) >= 1:
        poi.facts.append({"text": f"{m['floor_shadow_pct']:.0f}% of the floor is in permanent shadow - the Sun never reaches it.",
                          "source": "LOLA permanent-shadow map (Mazarico et al. 2011)"})
    if "rim_sun_pct" in m:
        poi.facts.append({"text": f"The rim is sunlit about {m['rim_sun_pct']:.0f}% of the time on average.",
                          "source": "LOLA average solar visibility (Mazarico et al. 2011)"})


def build_crater_pois(layers: Layers, settings: Settings, named: list[NamedFeature]) -> list[Poi]:
    path = settings.raw_dir / load_sources(settings)["craters"]["file"]
    cols = ["CRATER_ID", "LAT_CIRC_IMG", "LON_CIRC_IMG", "DIAM_CIRC_IMG"]
    frame = pd.read_csv(path, usecols=cols)
    frame = frame[(frame.LAT_CIRC_IMG < -70) & (frame.DIAM_CIRC_IMG >= settings.crater_min_km)]
    x, y = layers.projection.lonlat_to_xy(frame.LON_CIRC_IMG.to_numpy(), frame.LAT_CIRC_IMG.to_numpy())
    keep = in_coverage(layers, x, y)
    frame, x, y = frame[keep], np.asarray(x)[keep], np.asarray(y)[keep]
    diam_km = frame.DIAM_CIRC_IMG.to_numpy()

    # Match each IAU-named crater to the closest, similarly sized catalogue crater.
    name_for: dict[int, NamedFeature] = {}
    for feat in (f for f in named if f.kind == "Crater" and f.diameter_km > 0):
        dist_km = np.hypot(x - feat.x, y - feat.y) / 1000.0
        ratio = diam_km / feat.diameter_km
        ok = (dist_km < 0.4 * feat.diameter_km) & (ratio > 0.6) & (ratio < 1.6)
        if ok.any():
            idx = int(np.argmin(np.where(ok, dist_km, np.inf)))
            name_for.setdefault(idx, feat)

    matched_names = {f.name for f in name_for.values()}
    pois: list[Poi] = []
    for i, (cid, px, py, d_km) in enumerate(zip(frame.CRATER_ID, x, y, diam_km)):
        feat = name_for.get(i)
        poi = Poi(
            id=f"crater-{cid}", category="crater", kind="Crater",
            name=feat.name if feat else f"Unnamed crater {cid}",
            x=float(px), y=float(py), radius_m=float(d_km) * 500.0, pole=feat is not None,
            namesake=feat.origin if feat else None, link=feat.link if feat else None,
            props={"diameter_km": round(float(d_km), 2), "catalogue_id": cid, "named": feat is not None},
        )
        m = _measure(layers, poi.x, poi.y, poi.radius_m)
        poi.props.update({k: round(v, 1) for k, v in m.items()})
        _describe(poi, float(d_km), m)
        pois.append(poi)

    # IAU-named craters that the size cut-off excluded still deserve a marker.
    for feat in named:
        if feat.kind != "Crater" or feat.name in matched_names:
            continue
        poi = Poi(id=f"iau-{slug(feat.name)}", category="crater", kind="Crater", name=feat.name,
                  x=feat.x, y=feat.y, radius_m=feat.diameter_km * 500.0, pole=True,
                  namesake=feat.origin, link=feat.link,
                  props={"diameter_km": round(feat.diameter_km, 2), "named": True})
        m = _measure(layers, poi.x, poi.y, max(poi.radius_m, layers.cell_m * 4))
        poi.props.update({k: round(v, 1) for k, v in m.items()})
        _describe(poi, feat.diameter_km, m)
        pois.append(poi)
    return pois
