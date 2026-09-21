import { DIRECTION_DELTA, oppositeDirection } from '../game/directions';
import { cellKey, countBends, getEscapeSweep, validatePathShape } from '../game/geometry';
import type { ArrowDef, Cell, Direction } from '../game/types';
import type { OccupancyGrid } from './occupancy';
import type { Rng } from './rng';

const DIRS: Direction[] = ['up', 'down', 'left', 'right'];

function turnLeft(d: Direction): Direction {
  return ({ up: 'left', left: 'down', down: 'right', right: 'up' } as const)[d];
}

function turnRight(d: Direction): Direction {
  return ({ up: 'right', right: 'down', down: 'left', left: 'up' } as const)[d];
}

export interface PathGenOptions {
  gridSize: number;
  minBends: number;
  maxBends: number;
  minLength: number;
  maxLength: number;
  /** Prefer occupying at least one of these cells (intentional blocking). */
  preferCells?: Cell[];
  occupied: OccupancyGrid;
}

/**
 * Grow a self-avoiding orthogonal path tip-first, then reverse to tail→tip.
 * Rejects self-intersections, out-of-bounds, and occupied cells.
 */
export function generateArrowPath(rng: Rng, options: PathGenOptions): Cell[] | null {
  const {
    gridSize,
    minBends,
    maxBends,
    minLength,
    maxLength,
    preferCells = [],
    occupied,
  } = options;

  for (let attempt = 0; attempt < 80; attempt++) {
    const escapeDir = rng.pick(DIRS);
    const tip = pickTipNearEdge(rng, gridSize, escapeDir);
    if (!tip) continue;

    const tipDelta = DIRECTION_DELTA[escapeDir];
    const prev: Cell = { x: tip.x - tipDelta.x, y: tip.y - tipDelta.y };
    if (!inBounds(prev, gridSize)) continue;
    if (occupied.has(tip) || occupied.has(prev)) continue;

    // Prefer tips whose escape corridor hits a prefer cell (we occupy corridor later via body).
    // Body growth targets preferCells when possible.

    const backward: Cell[] = [{ ...tip }, { ...prev }];
    const local = new Set([cellKey(tip), cellKey(prev)]);
    let x = prev.x;
    let y = prev.y;
    let growDir = oppositeDirection(escapeDir);
    let bends = 0;
    let stepsOnSeg = 1;

    const targetBends = rng.intRange(minBends, Math.max(minBends, maxBends));
    const targetLen = rng.intRange(minLength, Math.max(minLength, maxLength));
    const preferSet = new Set(preferCells.map(cellKey));
    let hitPrefer = preferSet.size === 0;

    while (backward.length < targetLen) {
      const wantTurn =
        bends < targetBends &&
        stepsOnSeg >= 1 &&
        (stepsOnSeg >= 2 || rng.chance(0.55));

      const tryDirs: Direction[] = [];
      if (wantTurn) {
        tryDirs.push(rng.chance(0.5) ? turnLeft(growDir) : turnRight(growDir));
      }

      // Bias toward preferred cells when adjacent.
      const biased = preferredDirections(x, y, growDir, preferSet, gridSize);
      tryDirs.push(...biased, growDir, turnLeft(growDir), turnRight(growDir));

      const unique = uniqueDirs(tryDirs, growDir);
      let moved = false;

      for (const d of unique) {
        const delta = DIRECTION_DELTA[d];
        const nx = x + delta.x;
        const ny = y + delta.y;
        const key = `${nx},${ny}`;
        if (!inBounds({ x: nx, y: ny }, gridSize)) continue;
        if (occupied.has({ x: nx, y: ny }) || local.has(key)) continue;

        // Avoid tiny zigzags: require at least 1 step before another turn if already bent a lot.
        if (d !== growDir && stepsOnSeg < 1) continue;

        if (d !== growDir) {
          bends++;
          stepsOnSeg = 0;
        }

        x = nx;
        y = ny;
        growDir = d;
        backward.push({ x, y });
        local.add(key);
        stepsOnSeg++;
        if (preferSet.has(key)) hitPrefer = true;
        moved = true;
        break;
      }

      if (!moved) break;
    }

    if (backward.length < minLength) continue;
    if (bends < Math.min(minBends, 1) && minBends > 0) continue;
    if (preferSet.size > 0 && !hitPrefer && rng.chance(0.7)) continue;

    // Reject too many single-cell segments (ugly zigzags).
    const path = backward.slice().reverse();
    if (isUglyPath(path)) continue;

    const shapeError = validatePathShape(path, gridSize);
    if (shapeError) continue;

    return path;
  }

  return null;
}

function pickTipNearEdge(rng: Rng, gridSize: number, escapeDir: Direction): Cell | null {
  const margin = Math.min(3, Math.max(1, Math.floor(gridSize / 4)));
  if (escapeDir === 'right') {
    return { x: gridSize - 1 - rng.int(margin), y: rng.int(gridSize) };
  }
  if (escapeDir === 'left') {
    return { x: rng.int(margin), y: rng.int(gridSize) };
  }
  if (escapeDir === 'down') {
    return { x: rng.int(gridSize), y: gridSize - 1 - rng.int(margin) };
  }
  return { x: rng.int(gridSize), y: rng.int(margin) };
}

function preferredDirections(
  x: number,
  y: number,
  growDir: Direction,
  preferSet: Set<string>,
  gridSize: number,
): Direction[] {
  if (preferSet.size === 0) return [];
  const scored: { d: Direction; dist: number }[] = [];
  for (const d of DIRS) {
    if (d === oppositeDirection(growDir)) continue;
    const delta = DIRECTION_DELTA[d];
    const nx = x + delta.x;
    const ny = y + delta.y;
    if (!inBounds({ x: nx, y: ny }, gridSize)) continue;
    if (preferSet.has(`${nx},${ny}`)) {
      scored.push({ d, dist: 0 });
      continue;
    }
    // Soft pull toward any preferred cell.
    let best = Infinity;
    for (const key of preferSet) {
      const [px, py] = key.split(',').map(Number);
      best = Math.min(best, Math.abs(px - nx) + Math.abs(py - ny));
    }
    if (best < 4) scored.push({ d, dist: best });
  }
  scored.sort((a, b) => a.dist - b.dist);
  return scored.map((s) => s.d);
}

function uniqueDirs(dirs: Direction[], growDir: Direction): Direction[] {
  const seen = new Set<Direction>();
  const out: Direction[] = [];
  for (const d of dirs) {
    if (d === oppositeDirection(growDir)) continue;
    if (seen.has(d)) continue;
    seen.add(d);
    out.push(d);
  }
  return out;
}

function inBounds(cell: Cell, gridSize: number): boolean {
  return cell.x >= 0 && cell.y >= 0 && cell.x < gridSize && cell.y < gridSize;
}

/** Reject paths with too many 1-length zigzag segments. */
function isUglyPath(path: Cell[]): boolean {
  if (path.length < 4) return false;
  let shortTurns = 0;
  let segLen = 1;
  for (let i = 2; i < path.length; i++) {
    const a = path[i - 2];
    const b = path[i - 1];
    const c = path[i];
    const sameDir = b.x - a.x === c.x - b.x && b.y - a.y === c.y - b.y;
    if (sameDir) {
      segLen++;
    } else {
      if (segLen === 1) shortTurns++;
      segLen = 1;
    }
  }
  return shortTurns >= 3;
}

/**
 * Cells from an already-placed arrow's escape corridor that we can occupy to block it.
 */
export function blockingTargets(
  target: ArrowDef,
  gridSize: number,
  occupied: OccupancyGrid,
): Cell[] {
  return getEscapeSweep(target, gridSize).filter((c) => !occupied.has(c));
}

export function pathStats(path: Cell[]): { bends: number; length: number } {
  return { bends: countBends(path), length: path.length };
}
