import { getEscapeSweep } from '../game/geometry';
import type { BoardSize, Cell } from '../game/types';
import { Rng } from './rng';

/**
 * Arrow Escape level generator.
 *
 * Solvability model: arrow X is blocked by arrow Y when Y occupies a cell on X's escape ray
 * (straight line from X's head to the board edge). Arrows never move until they escape, so
 * the board is solvable exactly when this "blocked-by" graph has no cycle.
 *
 * Pipeline:
 * 1. Mask: playable cells (full rectangle or a custom shape).
 * 2. Placement, long → short: start from the most constrained empty cell, grow a bending path,
 *    then try both head orientations and shorter trims down to 2 cells.
 * 3. Incremental verification: a candidate is accepted only if it doesn't point back into its
 *    own body and adding its edges keeps the graph acyclic.
 * 4. Gap repair: extend neighbouring arrows' tails/heads into leftover cells.
 * 5. Backtracking: rip up arrows around stubborn holes and re-pack; keep only improvements.
 * 6. Final check by simulating the real game rules.
 */

export interface GeneratorOptions extends BoardSize {
  /** Row-major playable cells, length width × height. */
  mask: boolean[];
  seed: number;
  /** Preferred arrow length range in cells. Shorter arrows (down to 2) still fill tight gaps. */
  minLength: number;
  maxLength: number;
  /** Chance (0–1) of turning at each step while a straight move is possible. */
  turnChance: number;
}

export interface GeneratorStats {
  arrowCount: number;
  playableCells: number;
  filledCells: number;
  emptyCells: number;
  coverage: number;
  bendCount: number;
  initialAvailable: number;
  solveDepth: number;
  attempts: number;
  durationMs: number;
}

export interface GeneratedLevel extends BoardSize {
  mask: boolean[];
  seed: number;
  /** Tail → tip cells for each arrow. */
  arrows: Cell[][];
  /** Arrow indices in a valid clearing order. */
  solution: number[];
  stats: GeneratorStats;
}

const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];
const MAX_ATTEMPTS = 3;
const WALK_TRIES = 8;

interface ArrowRec {
  /** Cell indices tail → tip. */
  path: number[];
  /** Cell indices from the cell after the tip to the board edge. */
  ray: number[];
  /** Arrows occupying a cell of this arrow's ray. */
  blockers: Set<number>;
}

class PlacementBoard {
  readonly w: number;
  readonly h: number;
  readonly mask: Uint8Array;
  owner: Int32Array;
  /** Per cell: arrows whose ray passes through it. */
  rayCover: Set<number>[];
  arrows: (ArrowRec | null)[];
  emptyCount: number;
  private seen: number[] = [];
  private epoch = 0;

  constructor(w: number, h: number, mask: Uint8Array, source?: PlacementBoard) {
    this.w = w;
    this.h = h;
    this.mask = mask;
    if (source) {
      this.owner = source.owner.slice();
      this.rayCover = source.rayCover.map((s) => new Set(s));
      this.arrows = source.arrows.map((a) =>
        a ? { path: [...a.path], ray: [...a.ray], blockers: new Set(a.blockers) } : null,
      );
      this.emptyCount = source.emptyCount;
    } else {
      this.owner = new Int32Array(w * h).fill(-1);
      this.rayCover = Array.from({ length: w * h }, () => new Set<number>());
      this.arrows = [];
      this.emptyCount = mask.reduce((n, m) => n + m, 0);
    }
  }

  clone(): PlacementBoard {
    return new PlacementBoard(this.w, this.h, this.mask, this);
  }

  neighbor(c: number, d: number): number {
    const x = (c % this.w) + DX[d];
    const y = Math.floor(c / this.w) + DY[d];
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return -1;
    return y * this.w + x;
  }

  isFree(c: number): boolean {
    return c >= 0 && this.mask[c] === 1 && this.owner[c] === -1;
  }

  freeNeighbors(c: number, exclude?: Set<number>): number {
    let n = 0;
    for (let d = 0; d < 4; d++) {
      const nb = this.neighbor(c, d);
      if (this.isFree(nb) && !exclude?.has(nb)) n++;
    }
    return n;
  }

  rayOf(path: number[]): number[] {
    const tip = path[path.length - 1];
    const prev = path[path.length - 2];
    const dx = (tip % this.w) - (prev % this.w);
    const dy = Math.floor(tip / this.w) - Math.floor(prev / this.w);
    const ray: number[] = [];
    let x = (tip % this.w) + dx;
    let y = Math.floor(tip / this.w) + dy;
    while (x >= 0 && y >= 0 && x < this.w && y < this.h) {
      ray.push(y * this.w + x);
      x += dx;
      y += dy;
    }
    return ray;
  }

  /** True if any arrow in `targets` is reachable from `from` along blocked-by edges. */
  private reaches(from: Iterable<number>, targets: Set<number>): boolean {
    if (targets.size === 0) return false;
    this.epoch++;
    const stack = [...from];
    while (stack.length > 0) {
      const id = stack.pop()!;
      if (targets.has(id)) return true;
      if (this.seen[id] === this.epoch) continue;
      this.seen[id] = this.epoch;
      const rec = this.arrows[id];
      if (rec) for (const b of rec.blockers) stack.push(b);
    }
    return false;
  }

  tryPlace(path: number[]): boolean {
    const ray = this.rayOf(path);
    if (ray.some((c) => path.includes(c))) return false;

    const blockers = new Set<number>();
    for (const c of ray) if (this.owner[c] >= 0) blockers.add(this.owner[c]);
    const blocked = new Set<number>();
    for (const c of path) for (const a of this.rayCover[c]) blocked.add(a);
    if (this.reaches(blockers, blocked)) return false;

    const id = this.arrows.length;
    this.arrows.push({ path, ray, blockers });
    for (const c of path) this.owner[c] = id;
    for (const c of ray) this.rayCover[c].add(id);
    for (const a of blocked) this.arrows[a]!.blockers.add(id);
    this.emptyCount -= path.length;
    return true;
  }

  remove(id: number): void {
    const rec = this.arrows[id];
    if (!rec) return;
    for (const c of rec.path) {
      this.owner[c] = -1;
      for (const a of this.rayCover[c]) this.arrows[a]?.blockers.delete(id);
    }
    for (const c of rec.ray) this.rayCover[c].delete(id);
    this.arrows[id] = null;
    this.emptyCount += rec.path.length;
  }

  /** Occupy free cell `c` with arrow `id`, if the new blocked-by edges stay acyclic. */
  private claim(id: number, c: number): boolean {
    const rec = this.arrows[id]!;
    const blocked = new Set(this.rayCover[c]);
    blocked.delete(id);
    if (this.reaches(rec.blockers, blocked)) return false;
    this.owner[c] = id;
    for (const a of blocked) this.arrows[a]!.blockers.add(id);
    this.emptyCount--;
    return true;
  }

  tryExtendTail(id: number, c: number): boolean {
    const rec = this.arrows[id]!;
    if (rec.ray.includes(c) || !this.claim(id, c)) return false;
    rec.path.unshift(c);
    return true;
  }

  tryExtendHead(id: number): boolean {
    const rec = this.arrows[id]!;
    const c = rec.ray[0];
    if (c === undefined || !this.isFree(c)) return false;
    this.rayCover[c].delete(id);
    if (!this.claim(id, c)) {
      this.rayCover[c].add(id);
      return false;
    }
    rec.path.push(c);
    rec.ray.shift();
    return true;
  }
}

class LevelBuilder {
  constructor(
    private readonly opts: GeneratorOptions,
    private readonly rng: Rng,
    private readonly playable: number,
  ) {}

  private targetLength(board: PlacementBoard): number {
    const { minLength, maxLength } = this.opts;
    const progress = 1 - board.emptyCount / this.playable;
    const hi = Math.round(maxLength - (maxLength - minLength) * progress);
    return this.rng.int(minLength, Math.max(minLength, hi));
  }

  private walk(board: PlacementBoard, start: number, target: number): number[] {
    const path = [start];
    const inPath = new Set(path);
    let dir = -1;

    while (path.length < target) {
      const cur = path[path.length - 1];
      const options: number[] = [];
      for (let d = 0; d < 4; d++) {
        const nb = board.neighbor(cur, d);
        if (board.isFree(nb) && !inPath.has(nb)) options.push(d);
      }
      if (options.length === 0) break;

      let next = dir;
      const canGoStraight = dir >= 0 && options.includes(dir);
      const turns = options.filter((d) => d !== dir);
      if (!canGoStraight || (turns.length > 0 && this.rng.next() < this.opts.turnChance)) {
        const pool = canGoStraight ? turns : options;
        // Favour cells with fewer free neighbours so paths hug walls and avoid stranding cells.
        const weights = pool.map(
          (d) => 1 / (1 + board.freeNeighbors(board.neighbor(cur, d), inPath)),
        );
        let r = this.rng.next() * weights.reduce((s, w) => s + w, 0);
        next = pool[pool.length - 1];
        for (let i = 0; i < pool.length; i++) {
          r -= weights[i];
          if (r <= 0) {
            next = pool[i];
            break;
          }
        }
      }

      const cell = board.neighbor(cur, next);
      path.push(cell);
      inPath.add(cell);
      dir = next;
    }
    return path;
  }

  /** Try the walked path with either end as the head, trimming from the far end down to `minLen`. */
  private placeVariants(board: PlacementBoard, path: number[], minLen: number): boolean {
    const headAtEnd = this.rng.next() < 0.5;
    for (let len = path.length; len >= minLen; len--) {
      const forward = path.slice(0, len);
      const backward = [...forward].reverse();
      const [first, second] = headAtEnd ? [forward, backward] : [backward, forward];
      if (board.tryPlace(first) || board.tryPlace(second)) return true;
    }
    return false;
  }

  fill(board: PlacementBoard): void {
    const stuck = new Set<number>();
    const cells = board.mask.length;

    for (;;) {
      let best = 5;
      let candidates: number[] = [];
      for (let c = 0; c < cells; c++) {
        if (!board.isFree(c) || stuck.has(c)) continue;
        const n = board.freeNeighbors(c);
        if (n < best) {
          best = n;
          candidates = [c];
        } else if (n === best) {
          candidates.push(c);
        }
      }
      if (candidates.length === 0) return;

      const start = this.rng.pick(candidates);
      if (best === 0) {
        stuck.add(start);
        continue;
      }

      const walks: number[][] = [];
      for (let t = 0; t < WALK_TRIES; t++) {
        const path = this.walk(board, start, this.targetLength(board));
        if (path.length >= 2) walks.push(path);
      }
      walks.sort((a, b) => b.length - a.length);
      const placed =
        walks.some((p) => this.placeVariants(board, p, this.opts.minLength)) ||
        walks.some((p) => this.placeVariants(board, p, 2));
      if (!placed) stuck.add(start);
    }
  }

  extendIntoGaps(board: PlacementBoard): void {
    const maxLen = Math.max(this.opts.maxLength * 2, 6);
    let changed = true;
    while (changed) {
      changed = false;
      for (let c = 0; c < board.mask.length; c++) {
        if (!board.isFree(c)) continue;
        for (const d of this.rng.shuffle([0, 1, 2, 3])) {
          const nb = board.neighbor(c, d);
          const id = nb >= 0 ? board.owner[nb] : -1;
          if (id < 0) continue;
          const rec = board.arrows[id]!;
          if (rec.path.length >= maxLen) continue;
          if (rec.path[0] === nb && board.tryExtendTail(id, c)) {
            changed = true;
            break;
          }
          if (rec.path[rec.path.length - 1] === nb && rec.ray[0] === c && board.tryExtendHead(id)) {
            changed = true;
            break;
          }
        }
      }
    }
  }

  /** Rip up arrows around remaining holes and re-pack; keep the trial only if it has fewer holes. */
  backtrack(board: PlacementBoard, floor: number): PlacementBoard {
    const rounds = Math.min(400, 40 + board.emptyCount * 12);
    for (let round = 0; round < rounds && board.emptyCount > floor; round++) {
      const holes: number[] = [];
      for (let c = 0; c < board.mask.length; c++) if (board.isFree(c)) holes.push(c);
      const hole = this.rng.pick(holes);

      const nearby = new Set<number>();
      for (let d = 0; d < 4; d++) {
        const nb = board.neighbor(hole, d);
        if (nb >= 0 && board.owner[nb] >= 0) nearby.add(board.owner[nb]);
      }
      if (nearby.size === 0) continue;

      const trial = board.clone();
      const victims = this.rng.shuffle([...nearby]).slice(0, this.rng.int(1, 3));
      for (const id of victims) trial.remove(id);
      this.fill(trial);
      this.extendIntoGaps(trial);
      if (trial.emptyCount < board.emptyCount) board = trial;
    }
    return board;
  }
}

/** Cells that can never be covered because no playable cell touches them. */
function countIsolated(opts: GeneratorOptions): number {
  const { width, height, mask } = opts;
  let n = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!mask[y * width + x]) continue;
      const touches =
        (x > 0 && mask[y * width + x - 1]) ||
        (x < width - 1 && mask[y * width + x + 1]) ||
        (y > 0 && mask[(y - 1) * width + x]) ||
        (y < height - 1 && mask[(y + 1) * width + x]);
      if (!touches) n++;
    }
  }
  return n;
}

function countBends(path: Cell[]): number {
  let bends = 0;
  for (let i = 2; i < path.length; i++) {
    const dx1 = path[i - 1].x - path[i - 2].x;
    const dy1 = path[i - 1].y - path[i - 2].y;
    const dx2 = path[i].x - path[i - 1].x;
    const dy2 = path[i].y - path[i - 1].y;
    if (dx1 !== dx2 || dy1 !== dy2) bends++;
  }
  return bends;
}

/**
 * Clear the board with the real game rules (escape corridor from the game's geometry),
 * removing every free arrow each round. Uses an occupancy grid so large boards stay fast.
 */
function simulate(paths: Cell[][], board: BoardSize) {
  const occupied = new Int32Array(board.width * board.height).fill(-1);
  paths.forEach((path, i) => {
    for (const c of path) occupied[c.y * board.width + c.x] = i;
  });
  const corridors = paths.map((path) =>
    getEscapeSweep({ path }, board).map((c) => c.y * board.width + c.x),
  );

  let active = paths.map((_, i) => i);
  const solution: number[] = [];
  let initialAvailable = 0;
  let depth = 0;

  while (active.length > 0) {
    const free = active.filter((i) => corridors[i].every((c) => occupied[c] < 0 || occupied[c] === i));
    if (free.length === 0) break;
    if (depth === 0) initialAvailable = free.length;
    depth++;
    for (const i of free) {
      for (const c of paths[i]) occupied[c.y * board.width + c.x] = -1;
      solution.push(i);
    }
    const removed = new Set(free);
    active = active.filter((i) => !removed.has(i));
  }

  return {
    solvable: solution.length === paths.length,
    solution,
    initialAvailable,
    solveDepth: depth,
  };
}

export function generateLevel(opts: GeneratorOptions): GeneratedLevel {
  const started = Date.now();
  const { width, height } = opts;
  const minLength = Math.max(2, Math.min(opts.minLength, opts.maxLength));
  const options = { ...opts, minLength, maxLength: Math.max(minLength, opts.maxLength) };
  const mask = Uint8Array.from(opts.mask, (m) => (m ? 1 : 0));
  const playable = mask.reduce((n, m) => n + m, 0);
  if (playable < 2) throw new Error('Select at least 2 connected cells to generate a level.');
  const floor = countIsolated(options);

  let best: PlacementBoard | null = null;
  let attempts = 0;
  for (; attempts < MAX_ATTEMPTS; attempts++) {
    const rng = new Rng(opts.seed + attempts * 7919);
    const builder = new LevelBuilder(options, rng, playable);
    let board = new PlacementBoard(width, height, mask);
    builder.fill(board);
    builder.extendIntoGaps(board);
    board = builder.backtrack(board, floor);
    if (!best || board.emptyCount < best.emptyCount) best = board;
    if (best.emptyCount <= floor) {
      attempts++;
      break;
    }
  }

  const toCell = (c: number): Cell => ({ x: c % width, y: Math.floor(c / width) });
  const paths = best!.arrows
    .filter((a): a is ArrowRec => a !== null)
    .map((a) => a.path.map(toCell))
    .sort((a, b) => a[0].y - b[0].y || a[0].x - b[0].x);

  const result = simulate(paths, opts);
  if (!result.solvable) {
    throw new Error('Generator produced an unsolvable board. Please report this seed.');
  }

  const filled = paths.reduce((n, p) => n + p.length, 0);
  return {
    width,
    height,
    mask: [...opts.mask],
    seed: opts.seed,
    arrows: paths,
    solution: result.solution,
    stats: {
      arrowCount: paths.length,
      playableCells: playable,
      filledCells: filled,
      emptyCells: playable - filled,
      coverage: filled / playable,
      bendCount: paths.reduce((n, p) => n + countBends(p), 0),
      initialAvailable: result.initialAvailable,
      solveDepth: result.solveDepth,
      attempts,
      durationMs: Date.now() - started,
    },
  };
}
