import { DIRECTION_DELTA, oppositeDirection } from '../game/directions';
import { countBends } from '../game/geometry';
import type { Cell, Direction } from '../game/types';
import { OccupancyGrid } from './occupancy';
import type { Rng } from './rng';

const DIRS: Direction[] = ['up', 'down', 'left', 'right'];

const LEFT_OF: Record<Direction, Direction> = {
  up: 'left',
  left: 'down',
  down: 'right',
  right: 'up',
};

const RIGHT_OF: Record<Direction, Direction> = {
  up: 'right',
  right: 'down',
  down: 'left',
  left: 'up',
};

export interface FillOptions {
  gridSize: number;
  minLength: number;
  maxLength: number;
  minBends: number;
  maxBends: number;
  /** How many arrows may point straight off the board (these are free at the start). */
  targetFree: number;
  candidatesPerStep: number;
}

interface HeadOption {
  x: number;
  y: number;
  dir: Direction;
  /** Head sits on the edge facing out, so its escape ray is empty. */
  borderOut: boolean;
}

interface Placement {
  path: Cell[];
  absorbs: { arrow: number; cell: Cell }[];
  borderOut: boolean;
  score: number;
}

/**
 * Covers every cell of the board with arrows, placed in solution order.
 *
 * A head is only allowed where its escape ray (head → edge) runs entirely over
 * cells claimed by earlier arrows, so every arrow is blocked only by arrows that
 * leave before it. The blocking graph is therefore acyclic and the board is
 * solvable in placement order. Returns tail→head paths, or null on a dead end.
 */
export function fillBoard(rng: Rng, opts: FillOptions): Cell[][] | null {
  const grid = new OccupancyGrid(opts.gridSize);
  const paths: Cell[][] = [];
  let freeArrows = 0;

  while (grid.freeCount > 0) {
    const heads = findHeadOptions(grid);
    if (heads.length === 0) return null;

    const saturated = freeArrows >= opts.targetFree;
    let best: Placement | null = null;

    for (let k = 0; k < opts.candidatesPerStep; k++) {
      const head = pickHead(rng, grid, heads, saturated);
      const path = growBody(rng, grid, head, opts);
      const placement = evaluatePlacement(rng, grid, paths, path, head, saturated, opts);
      if (placement && (!best || placement.score < best.score)) best = placement;
    }

    if (!best) return null;

    const id = paths.length;
    for (const c of best.path) grid.set(c.x, c.y, id);
    paths.push(best.path);
    for (const { arrow, cell } of best.absorbs) {
      grid.set(cell.x, cell.y, arrow);
      paths[arrow].unshift(cell);
    }
    if (best.borderOut) freeArrows++;
  }

  return paths;
}

function findHeadOptions(grid: OccupancyGrid): HeadOption[] {
  const n = grid.size;
  const clear: Record<Direction, Uint8Array> = {
    up: new Uint8Array(n * n),
    down: new Uint8Array(n * n),
    left: new Uint8Array(n * n),
    right: new Uint8Array(n * n),
  };

  // clear[dir][cell] = 1 when every cell beyond `cell` in `dir` is already claimed.
  for (let y = 0; y < n; y++) {
    let ok = true;
    for (let x = n - 1; x >= 0; x--) {
      clear.right[grid.index(x, y)] = ok ? 1 : 0;
      ok = ok && !grid.isFree(x, y);
    }
    ok = true;
    for (let x = 0; x < n; x++) {
      clear.left[grid.index(x, y)] = ok ? 1 : 0;
      ok = ok && !grid.isFree(x, y);
    }
  }
  for (let x = 0; x < n; x++) {
    let ok = true;
    for (let y = n - 1; y >= 0; y--) {
      clear.down[grid.index(x, y)] = ok ? 1 : 0;
      ok = ok && !grid.isFree(x, y);
    }
    ok = true;
    for (let y = 0; y < n; y++) {
      clear.up[grid.index(x, y)] = ok ? 1 : 0;
      ok = ok && !grid.isFree(x, y);
    }
  }

  const options: HeadOption[] = [];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (!grid.isFree(x, y)) continue;
      for (const dir of DIRS) {
        if (!clear[dir][grid.index(x, y)]) continue;
        const d = DIRECTION_DELTA[dir];
        const px = x - d.x;
        const py = y - d.y;
        if (!grid.inBounds(px, py) || !grid.isFree(px, py)) continue;
        options.push({ x, y, dir, borderOut: !grid.inBounds(x + d.x, y + d.y) });
      }
    }
  }
  return options;
}

function freeDegree(grid: OccupancyGrid, x: number, y: number, taken?: Set<number>): number {
  let deg = 0;
  for (const dir of DIRS) {
    const d = DIRECTION_DELTA[dir];
    const nx = x + d.x;
    const ny = y + d.y;
    if (!grid.inBounds(nx, ny) || !grid.isFree(nx, ny)) continue;
    if (taken?.has(grid.index(nx, ny))) continue;
    deg++;
  }
  return deg;
}

function pickHead(
  rng: Rng,
  grid: OccupancyGrid,
  heads: HeadOption[],
  saturated: boolean,
): HeadOption {
  const TIGHTNESS = [4, 4, 3, 2, 1];
  const weights = heads.map((h) => {
    let w = TIGHTNESS[freeDegree(grid, h.x, h.y)];
    if (h.borderOut && saturated) w *= 0.03;
    return w;
  });

  const total = weights.reduce((s, w) => s + w, 0);
  let r = rng.next() * total;
  for (let i = 0; i < heads.length; i++) {
    r -= weights[i];
    if (r <= 0) return heads[i];
  }
  return heads[heads.length - 1];
}

/** Grows the body backward from the head, hugging tight spots so no holes are left behind. */
function growBody(rng: Rng, grid: OccupancyGrid, head: HeadOption, opts: FillOptions): Cell[] {
  const d = DIRECTION_DELTA[head.dir];
  const path: Cell[] = [
    { x: head.x, y: head.y },
    { x: head.x - d.x, y: head.y - d.y },
  ];
  const inPath = new Set(path.map((c) => grid.index(c.x, c.y)));

  let move = oppositeDirection(head.dir);
  let run = 1;
  let bends = 0;
  const targetLen = rng.intRange(opts.minLength, opts.maxLength);
  const targetBends = rng.intRange(opts.minBends, opts.maxBends);

  while (path.length < targetLen) {
    const cur = path[path.length - 1];
    let bestDir: Direction | null = null;
    let bestScore = Infinity;

    for (const g of [move, LEFT_OF[move], RIGHT_OF[move]]) {
      const step = DIRECTION_DELTA[g];
      const nx = cur.x + step.x;
      const ny = cur.y + step.y;
      if (!grid.inBounds(nx, ny) || !grid.isFree(nx, ny)) continue;
      if (inPath.has(grid.index(nx, ny))) continue;

      let s = freeDegree(grid, nx, ny, inPath);
      if (g !== move) {
        if (run < 2) s += 2.5;
        if (bends >= opts.maxBends) s += 4;
        else if (bends < targetBends) s -= 0.8;
      } else if (bends < targetBends && run >= 3) {
        s += 0.6;
      }
      s += rng.next() * 1.2;

      if (s < bestScore) {
        bestScore = s;
        bestDir = g;
      }
    }

    if (!bestDir) break;
    if (bestDir !== move) {
      bends++;
      run = 1;
      move = bestDir;
    } else {
      run++;
    }

    const step = DIRECTION_DELTA[bestDir];
    const next = { x: cur.x + step.x, y: cur.y + step.y };
    path.push(next);
    inPath.add(grid.index(next.x, next.y));
  }

  return path.reverse();
}

function evaluatePlacement(
  rng: Rng,
  grid: OccupancyGrid,
  paths: Cell[][],
  path: Cell[],
  head: HeadOption,
  saturated: boolean,
  opts: FillOptions,
): Placement | null {
  const taken = new Set(path.map((c) => grid.index(c.x, c.y)));
  const newId = paths.length;

  // Free cells left with no free neighbours can never become part of a new arrow.
  const orphans = new Map<number, Cell>();
  let pockets = 0;
  for (const c of path) {
    for (const dir of DIRS) {
      const d = DIRECTION_DELTA[dir];
      const nx = c.x + d.x;
      const ny = c.y + d.y;
      if (!grid.inBounds(nx, ny) || !grid.isFree(nx, ny)) continue;
      const i = grid.index(nx, ny);
      if (taken.has(i) || orphans.has(i)) continue;
      const deg = freeDegree(grid, nx, ny, taken);
      if (deg === 0) orphans.set(i, { x: nx, y: ny });
      else if (deg === 1) pockets++;
    }
  }

  // An orphan can be absorbed by extending the tail of an adjacent arrow. It was
  // never in anyone's escape ray, so this keeps the placement order valid.
  const tails = paths.map((p) => p[0]);
  tails.push(path[0]);
  const usedTails = new Set<number>();
  const absorbs: Placement['absorbs'] = [];

  for (const orphan of orphans.values()) {
    const options: number[] = [];
    for (let a = 0; a < tails.length; a++) {
      if (usedTails.has(a)) continue;
      const t = tails[a];
      if (Math.abs(t.x - orphan.x) + Math.abs(t.y - orphan.y) === 1) options.push(a);
    }
    if (options.length === 0) return null;
    const arrow = rng.pick(options);
    usedTails.add(arrow);
    absorbs.push({ arrow, cell: orphan });
  }

  const length = path.length + (usedTails.has(newId) ? 1 : 0);
  const bends = countBends(path);

  let score = 0;
  if (length < opts.minLength) score += (opts.minLength - length) * 3;
  if (bends < opts.minBends) score += opts.minBends - bends;
  if (bends > opts.maxBends) score += (bends - opts.maxBends) * 1.5;
  if (head.borderOut) score += saturated ? 8 : -1;
  score += zigzags(path) * 0.7;
  score += absorbs.length * 0.5;
  score += pockets * 0.3;
  score += rng.next() * 0.5;

  return { path, absorbs, borderOut: head.borderOut, score };
}

/** Number of interior one-step segments (stair-step wiggles). */
function zigzags(path: Cell[]): number {
  let count = 0;
  let run = 1;
  for (let i = 2; i < path.length; i++) {
    const a = path[i - 2];
    const b = path[i - 1];
    const c = path[i];
    const straight = b.x - a.x === c.x - b.x && b.y - a.y === c.y - b.y;
    if (straight) {
      run++;
    } else {
      if (run === 1 && i > 2) count++;
      run = 1;
    }
  }
  return count;
}
