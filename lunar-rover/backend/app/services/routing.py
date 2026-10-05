"""Least-cost route planning over the real slope grid."""
import math

import numpy as np
from skimage.graph import MCP_Geometric
from skimage.measure import approximate_polygon

from ..data.store import DataStore
from ..settings import Settings


class RouteError(Exception):
    pass


def _window(store: DataStore, a, b, settings: Settings):
    """Pick the raster window to search and the down-sampling stride that keeps it tractable."""
    grid = store.grid
    ra, ca = (int(round(float(v))) for v in grid.xy_to_rc(*a))
    rb, cb = (int(round(float(v))) for v in grid.xy_to_rc(*b))
    h, w = grid.shape
    pad = max(40, int(settings.route_window_margin * max(abs(ra - rb), abs(ca - cb))))
    r0, r1 = max(min(ra, rb) - pad, 0), min(max(ra, rb) + pad + 1, h)
    c0, c1 = max(min(ca, cb) - pad, 0), min(max(ca, cb) + pad + 1, w)
    stride = max(1, math.ceil(max(r1 - r0, c1 - c0) / settings.route_max_grid_px))
    return r0, r1, c0, c1, stride, (ra, ca), (rb, cb)


def _steepest_along(store: DataStore, pts: np.ndarray) -> float:
    """Steepest native-resolution slope found along the polyline (nearest-cell lookups every ~half cell)."""
    grid = store.grid
    seg = np.hypot(*np.diff(pts, axis=0).T)
    samples = [pts[0:1]]
    for a, b, length in zip(pts[:-1], pts[1:], seg):
        n = max(2, int(length / (grid.cell_m * 0.5)))
        t = np.linspace(0.0, 1.0, n)[1:, None]
        samples.append(a + (b - a) * t)
    dense = np.vstack(samples)
    rows, cols = grid.xy_to_rc(dense[:, 0], dense[:, 1])
    r = np.clip(np.rint(rows).astype(int), 0, grid.shape[0] - 1)
    c = np.clip(np.rint(cols).astype(int), 0, grid.shape[1] - 1)
    return float(np.nanmax(np.asarray(grid.arrays["slope"][r, c], dtype="float32")))


def plan_route(store: DataStore, start: tuple[float, float], goal: tuple[float, float], settings: Settings) -> dict:
    for label, p in (("start", start), ("goal", goal)):
        if not store.grid.contains(*p):
            raise RouteError(f"The {label} point is outside the surveyed zone.")

    grid = store.grid
    r0, r1, c0, c1, stride, (ra, ca), (rb, cb) = _window(store, start, goal, settings)
    # Trim so the window divides evenly, then take the steepest slope in each block (conservative).
    rows, cols = (r1 - r0) // stride * stride, (c1 - c0) // stride * stride
    slope = np.asarray(grid.arrays["slope"][r0:r0 + rows, c0:c0 + cols], dtype="float32")
    slope = np.nan_to_num(slope, nan=90.0)
    slope = slope.reshape(rows // stride, stride, cols // stride, stride).max(axis=(1, 3))
    covered = np.asarray(grid.arrays["coverage"][r0:r0 + rows, c0:c0 + cols], dtype=bool)
    covered = covered.reshape(rows // stride, stride, cols // stride, stride).all(axis=(1, 3))

    limit = settings.rover_slope_limit_deg
    cost = 1.0 + settings.rover_slope_penalty * (slope / limit) ** 2
    cost[slope > limit] += 500.0                  # strongly avoided, but never an impossible dead end
    cost[~covered] = np.inf

    def cell(r, c):
        return (min(max((r - r0) // stride, 0), cost.shape[0] - 1), min(max((c - c0) // stride, 0), cost.shape[1] - 1))

    start_cell, goal_cell = cell(ra, ca), cell(rb, cb)
    cost[start_cell] = max(cost[start_cell], 1.0) if np.isfinite(cost[start_cell]) else 1.0
    cost[goal_cell] = max(cost[goal_cell], 1.0) if np.isfinite(cost[goal_cell]) else 1.0

    mcp = MCP_Geometric(cost, fully_connected=True)
    mcp.find_costs([start_cell], [goal_cell])
    try:
        path = np.array(mcp.traceback(goal_cell), dtype="float64")
    except ValueError as exc:
        raise RouteError("No traversable route found between these points.") from exc

    # Cell indices -> projected metres. Pin the ends to the exact requested coordinates.
    full_rows, full_cols = r0 + (path[:, 0] + 0.5) * stride - 0.5, c0 + (path[:, 1] + 0.5) * stride - 0.5
    xs, ys = grid.rc_to_xy(full_rows, full_cols)
    pts = np.column_stack([xs, ys])
    pts[0], pts[-1] = start, goal
    pts = approximate_polygon(pts, tolerance=settings.route_simplify_m)

    seg = np.hypot(*np.diff(pts, axis=0).T)
    steepest = _steepest_along(store, pts)
    elev = np.array([grid.sample("elevation", *p) for p in pts])
    return {
        "waypoints": [[round(float(x), 1), round(float(y), 1)] for x, y in pts],
        "distance_m": round(float(np.hypot(seg, np.diff(elev)).sum()), 1),
        "straight_line_m": round(float(math.dist(start, goal)), 1),
        "ascent_m": round(float(np.clip(np.diff(elev), 0, None).sum()), 1),
        "max_waypoint_slope_deg": round(steepest, 1),
        "crosses_steep_terrain": steepest > limit,
        "planner_resolution_m": grid.cell_m * stride,
    }
