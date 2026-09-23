import { NavCell, GridPosition } from '@/types';

interface Node {
  row: number;
  col: number;
  g: number;
  h: number;
  f: number;
  parent?: Node;
}

// 8-directional neighbor offsets
const DIRECTIONS: Array<[number, number, number]> = [
  [-1, 0, 1.0],   // North
  [1, 0, 1.0],    // South
  [0, -1, 1.0],   // West
  [0, 1, 1.0],    // East
  [-1, -1, 1.414],// North-West
  [-1, 1, 1.414], // North-East
  [1, -1, 1.414], // South-West
  [1, 1, 1.414]   // South-East
];

function heuristic(r1: number, c1: number, r2: number, c2: number): number {
  const dx = Math.abs(c1 - c2);
  const dy = Math.abs(r1 - r2);
  // Octile distance
  return (dx + dy) + (1.414 - 2) * Math.min(dx, dy);
}

/**
 * Fast A* pathfinding over the AI-derived hazard cost navigation grid.
 */
export function findAStarPath(
  grid: NavCell[][],
  start: GridPosition,
  goal: GridPosition
): GridPosition[] {
  const height = grid.length;
  if (height === 0) return [];
  const width = grid[0].length;

  const [startR, startC] = start;
  const [goalR, goalC] = goal;

  if (startR === goalR && startC === goalC) return [start];

  // Open set and closed lookup
  const openSet: Node[] = [];
  const closedSet = new Uint8Array(height * width);
  const gScores = new Float32Array(height * width).fill(Infinity);

  const startIdx = startR * width + startC;
  gScores[startIdx] = 0;

  openSet.push({
    row: startR,
    col: startC,
    g: 0,
    h: heuristic(startR, startC, goalR, goalC),
    f: heuristic(startR, startC, goalR, goalC)
  });

  const MAX_ITERATIONS = 25000;
  let iterations = 0;

  while (openSet.length > 0 && iterations++ < MAX_ITERATIONS) {
    // Find lowest f score
    let bestIdx = 0;
    for (let i = 1; i < openSet.length; i++) {
      if (openSet[i].f < openSet[bestIdx].f) {
        bestIdx = i;
      }
    }

    const current = openSet.splice(bestIdx, 1)[0];
    const currIdx = current.row * width + current.col;

    // Check goal
    if (current.row === goalR && current.col === goalC) {
      const path: GridPosition[] = [];
      let curr: Node | undefined = current;
      while (curr) {
        path.push([curr.row, curr.col]);
        curr = curr.parent;
      }
      path.reverse();
      return smoothPath(path, grid);
    }

    closedSet[currIdx] = 1;

    for (const [dr, dc, distCost] of DIRECTIONS) {
      const nr = current.row + dr;
      const nc = current.col + dc;

      if (nr < 0 || nr >= height || nc < 0 || nc >= width) continue;

      const nIdx = nr * width + nc;
      if (closedSet[nIdx] === 1) continue;

      const neighborCell = grid[nr][nc];
      // Hazard cost formula weighting
      const hazardFactor = neighborCell.hazard_cost || 1.0;
      const tentativeG = current.g + (distCost * hazardFactor);

      if (tentativeG < gScores[nIdx]) {
        gScores[nIdx] = tentativeG;
        const hVal = heuristic(nr, nc, goalR, goalC);
        const neighborNode: Node = {
          row: nr,
          col: nc,
          g: tentativeG,
          h: hVal,
          f: tentativeG + hVal,
          parent: current
        };

        const existingIdx = openSet.findIndex((n) => n.row === nr && n.col === nc);
        if (existingIdx !== -1) {
          openSet[existingIdx] = neighborNode;
        } else {
          openSet.push(neighborNode);
        }
      }
    }
  }

  // If exact goal unreached, return path to closest explored node
  return [];
}

/**
 * Downsamples collinear waypoints to create smooth trajectories for rover navigation.
 */
function smoothPath(path: GridPosition[], grid: NavCell[][]): GridPosition[] {
  if (path.length <= 3) return path;

  const smoothed: GridPosition[] = [path[0]];
  let step = 3; // Keep every 3rd waypoint to preserve curvature while reducing jitter

  for (let i = step; i < path.length - 1; i += step) {
    smoothed.push(path[i]);
  }

  smoothed.push(path[path.length - 1]);
  return smoothed;
}

/**
 * Autonomous Target Seeker: searches polar ice prospectivity map for high-yield volatile cold traps
 * and returns the optimal A* path to the best deposit.
 */
export function findNearestIceDeposit(
  grid: NavCell[][],
  start: GridPosition
): { path: GridPosition[]; targetCell: GridPosition; distanceMeters: number; iceProb: number } | null {
  const height = grid.length;
  const width = grid[0].length;
  const [sr, sc] = start;

  let bestCell: GridPosition | null = null;
  let bestScore = -Infinity;
  let bestIceProb = 0;

  // Search polar map for ice deposits (threshold >= 0.65)
  for (let r = 0; r < height; r += 2) {
    for (let c = 0; c < width; c += 2) {
      const cell = grid[r][c];
      if (cell.ice_probability >= 0.60) {
        const dist = Math.sqrt((r - sr) ** 2 + (c - sc) ** 2);
        if (dist === 0) continue;

        // Balance high ice concentration against distance and hazard
        const score = (cell.ice_probability * 2.0) - (dist * 0.015) - (cell.hazard_cost * 0.1);
        if (score > bestScore) {
          bestScore = score;
          bestCell = [r, c];
          bestIceProb = cell.ice_probability;
        }
      }
    }
  }

  if (!bestCell) return null;

  const path = findAStarPath(grid, start, bestCell);
  // Approx scale: 256 cells across 4.5 km surveyed zone (~17.5 meters/cell)
  const cellDistance = Math.sqrt((bestCell[0] - sr) ** 2 + (bestCell[1] - sc) ** 2);
  const distanceMeters = cellDistance * 17.5;

  return {
    path,
    targetCell: bestCell,
    distanceMeters,
    iceProb: bestIceProb
  };
}
