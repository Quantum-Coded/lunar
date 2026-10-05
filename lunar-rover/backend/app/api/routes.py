"""HTTP layer - thin wrappers around the services."""
from typing import Annotated

from fastapi import APIRouter, HTTPException, Path, Query, Request
from fastapi.responses import FileResponse

from ..schemas import RouteRequest
from ..services import locator, pois, routing

router = APIRouter(prefix="/api")

# Finite, bounded projected coordinates (metres).
Coord = Annotated[float, Query(allow_inf_nan=False, ge=-1e7, le=1e7)]


def _store(request: Request):
    return request.app.state.store


@router.get("/region")
def get_region(request: Request):
    """Coverage, projection, tile layout and dataset credits for the surveyed zone."""
    return _store(request).region


@router.get("/overview/{layer}.png")
def get_overview(request: Request, layer: str = Path(max_length=32)):
    """North-up map image of the whole zone for the GPS screen (relief, shadow or sunlight)."""
    store = _store(request)
    filename = store.region["overview"]["images"].get(layer)
    if filename is None:
        raise HTTPException(404, "Unknown overview layer")
    return FileResponse(store.data_dir / filename, media_type="image/png")


@router.get("/categories")
def get_categories(request: Request):
    store = _store(request)
    counts: dict[str, int] = {}
    for p in store.pois:
        counts[p["category"]] = counts.get(p["category"], 0) + 1
    return [{**c, "count": counts.get(c["id"], 0)} for c in store.categories]


@router.get("/zone-facts")
def get_zone_facts(request: Request):
    return _store(request).zone_facts


@router.get("/pois")
def list_pois(
    request: Request,
    category: str | None = Query(None, max_length=32),
    q: str | None = Query(None, max_length=80),
    near_x: Coord | None = None,
    near_y: Coord | None = None,
    radius_m: float | None = Query(None, gt=0),
    poles_only: bool = False,
    limit: int = Query(50, ge=1, le=2000),
):
    origin = (near_x, near_y) if near_x is not None and near_y is not None else None
    return pois.search(_store(request), category=category, origin=origin, limit=limit,
                       query=q, poles_only=poles_only, radius_m=radius_m)


@router.get("/pois/{poi_id}")
def get_poi(request: Request, poi_id: str = Path(max_length=80)):
    poi = _store(request).pois_by_id.get(poi_id)
    if poi is None:
        raise HTTPException(404, "Unknown point of interest")
    return poi


@router.get("/locate")
def locate(request: Request, x: Coord, y: Coord):
    return locator.locate(_store(request), x, y)


@router.post("/route")
def route(request: Request, body: RouteRequest):
    try:
        return routing.plan_route(_store(request), body.start, body.goal, request.app.state.settings)
    except routing.RouteError as exc:
        raise HTTPException(422, str(exc)) from exc
