"""Cold-trap POIs: connected permanently shadowed regions (PSRs) from the LOLA shadow map."""
import numpy as np
from scipy import ndimage

from ..config import Settings
from ..layers import Layers
from .common import Poi
from .nomenclature import NamedFeature


def containing_feature(named: list[NamedFeature], x: float, y: float) -> NamedFeature | None:
    """Smallest named crater whose circle contains the point."""
    best = None
    for f in named:
        if f.kind == "Crater" and f.diameter_km > 0 and np.hypot(x - f.x, y - f.y) <= f.diameter_km * 500.0:
            if best is None or f.diameter_km < best.diameter_km:
                best = f
    return best


def nearest_feature(named: list[NamedFeature], x: float, y: float) -> tuple[NamedFeature, float]:
    dist = [np.hypot(x - f.x, y - f.y) for f in named]
    i = int(np.argmin(dist))
    return named[i], dist[i]


def build_cold_trap_pois(layers: Layers, settings: Settings, named: list[NamedFeature]) -> list[Poi]:
    labels, count = ndimage.label(layers.psr, structure=np.ones((3, 3)))
    cell_km2 = (layers.cell_m / 1000.0) ** 2
    areas = ndimage.sum_labels(np.ones_like(labels), labels, index=np.arange(1, count + 1)) * cell_km2
    objects = ndimage.find_objects(labels)

    candidates = [i for i in range(count) if areas[i] >= settings.cold_trap_min_km2]
    candidates.sort(key=lambda i: -areas[i])

    pois: list[Poi] = []
    used_names: dict[str, int] = {}
    for rank, i in enumerate(candidates):
        window = objects[i]
        mask = labels[window] == i + 1
        # The deepest interior point is a better marker than the centroid (which can fall outside a ring-shaped PSR).
        depth = ndimage.distance_transform_edt(mask)
        r_local, c_local = np.unravel_index(int(np.argmax(depth)), depth.shape)
        row, col = window[0].start + r_local, window[1].start + c_local
        x, y = layers.rc_to_xy(row, col)
        x, y = float(x), float(y)
        elev = layers.dem[window][mask]

        host = containing_feature(named, x, y)
        if host:
            used_names[host.name] = used_names.get(host.name, 0) + 1
            suffix = "" if used_names[host.name] == 1 else f" ({used_names[host.name]})"
            name, where = f"{host.name} cold trap{suffix}", f"inside {host.name} crater"
        else:
            near, dist = nearest_feature(named, x, y)
            name, where = f"Cold trap near {near.name}", f"{dist / 1000:.0f} km from {near.name}"

        area = float(areas[i])
        poi = Poi(
            id=f"coldtrap-{rank + 1}", category="water_ice", kind="Permanently shadowed region", name=name,
            x=x, y=y, radius_m=float(np.sqrt(area / np.pi) * 1000.0), pole=rank < settings.cold_trap_pole_count,
            props={"area_km2": round(area, 1), "min_elevation_m": round(float(elev.min()), 1),
                   "max_elevation_m": round(float(elev.max()), 1), "ice_status": "candidate"},
            summary=(f"A {area:.0f} km² permanently shadowed region {where}. The Sun never reaches it, so it stays cold enough "
                     "for water ice to survive for very long periods - whether ice is actually present has not been confirmed on the ground."),
        )
        poi.facts.append({"text": f"Modelled from LOLA topography, this {area:.0f} km² region never receives direct sunlight.",
                          "source": "LOLA permanent-shadow map (Mazarico et al. 2011)"})
        pois.append(poi)
    return pois
