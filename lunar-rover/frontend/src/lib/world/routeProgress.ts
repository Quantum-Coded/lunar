export interface RouteProgress {
  /** Distance still to travel along the planned path, metres. */
  remainingM: number;
  /** Distance already covered along the planned path, metres. */
  travelledM: number;
  /** How far the rover is from the path, metres. */
  offRouteM: number;
  /** Index of the first waypoint still ahead. */
  nextIndex: number;
  /** The point on the path closest to the rover. */
  snapped: [number, number];
}

/** Projects a position onto a polyline of [x, y] waypoints and measures how far along it is. */
export function routeProgress(waypoints: [number, number][], x: number, y: number): RouteProgress {
  let best = { dist: Infinity, seg: 0, t: 0, point: waypoints[0] };
  const lengths: number[] = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    const [ax, ay] = waypoints[i], [bx, by] = waypoints[i + 1];
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    lengths.push(Math.sqrt(len2));
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2));
    const px = ax + dx * t, py = ay + dy * t;
    const d = Math.hypot(x - px, y - py);
    if (d < best.dist) best = { dist: d, seg: i, t, point: [px, py] };
  }
  const total = lengths.reduce((a, b) => a + b, 0);
  const travelledM = lengths.slice(0, best.seg).reduce((a, b) => a + b, 0) + (lengths[best.seg] ?? 0) * best.t;
  return {
    remainingM: Math.max(0, total - travelledM),
    travelledM,
    offRouteM: best.dist,
    nextIndex: Math.min(best.seg + 1, waypoints.length - 1),
    snapped: best.point,
  };
}
