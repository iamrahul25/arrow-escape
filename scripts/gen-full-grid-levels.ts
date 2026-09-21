/**
 * Fast generator for levels 4–13.
 * Serpentine → short forward-aligned splits → clear in reverse order (O(n)).
 * Avoids full DFS during generation.
 */
import { mkdirSync, writeFileSync } from 'fs';
import { canArrowMove, getAvailableMoves } from '../src/game/collision';
import { countBends, validatePathShape, cellKey } from '../src/game/geometry';
import { arrowsFromLevel } from '../src/game/solver';
import type { ArrowDef, Cell, Level, LevelJson } from '../src/game/types';

function randInt(n: number) {
  return Math.floor(Math.random() * n);
}

function compressToWaypoints(path: Cell[]): Cell[] {
  if (path.length <= 2) return path.map((c) => ({ ...c }));
  const wps: Cell[] = [{ ...path[0] }];
  for (let i = 1; i < path.length - 1; i++) {
    const a = path[i - 1];
    const b = path[i];
    const c = path[i + 1];
    if (b.x - a.x !== c.x - b.x || b.y - a.y !== c.y - b.y) {
      wps.push({ ...b });
    }
  }
  wps.push({ ...path[path.length - 1] });
  return wps;
}

function levelToJson(level: Level): LevelJson {
  return {
    id: level.id,
    name: level.name,
    gridSize: level.gridSize,
    hintQuota: level.hintQuota,
    arrows: level.arrows.map((a) => ({
      id: a.id,
      waypoints: compressToWaypoints(a.path),
    })),
  };
}

function maxStraightSteps(path: Cell[]): number {
  if (path.length < 2) return 0;
  let best = 1;
  let run = 1;
  let pdx = path[1].x - path[0].x;
  let pdy = path[1].y - path[0].y;
  for (let i = 2; i < path.length; i++) {
    const dx = path[i].x - path[i - 1].x;
    const dy = path[i].y - path[i - 1].y;
    if (dx === pdx && dy === pdy) run++;
    else {
      best = Math.max(best, run);
      run = 1;
      pdx = dx;
      pdy = dy;
    }
  }
  return Math.max(best, run);
}

function levelQuality(level: Level) {
  const avgBends =
    level.arrows.reduce((s, a) => s + countBends(a.path), 0) / level.arrows.length;
  const maxStraight = Math.max(...level.arrows.map((a) => maxStraightSteps(a.path)));
  const active = level.arrows.map((a) => ({ ...a, active: true as const }));
  const free = getAvailableMoves(active, level.gridSize).length;
  return {
    avgBends,
    maxStraight,
    free,
    blocked: level.arrows.length - free,
    arrows: level.arrows.length,
  };
}

function serpentinePath(n: number): Cell[] {
  const flipRows = Math.random() < 0.5;
  const transpose = Math.random() < 0.5;
  const reverseAll = Math.random() < 0.5;
  const cells: Cell[] = [];

  for (let row = 0; row < n; row++) {
    const y = flipRows ? n - 1 - row : row;
    if (row % 2 === 0) {
      for (let x = 0; x < n; x++) cells.push({ x, y });
    } else {
      for (let x = n - 1; x >= 0; x--) cells.push({ x, y });
    }
  }

  let path = cells;
  if (transpose) path = path.map((c) => ({ x: c.y, y: c.x }));
  if (reverseAll) path = path.slice().reverse();
  return path;
}

/** Clear arrows from last to first — matches forward-aligned Hamiltonian splits. */
function clearsInReverseOrder(level: Level): boolean {
  const arrows = arrowsFromLevel(level);
  for (let i = arrows.length - 1; i >= 0; i--) {
    if (!canArrowMove(arrows[i], arrows, level.gridSize)) return false;
    arrows[i].active = false;
  }
  return true;
}

function isFullyPacked(level: Level): boolean {
  const total = level.gridSize * level.gridSize;
  const seen = new Set<string>();
  for (const a of level.arrows) {
    if (validatePathShape(a.path, level.gridSize)) return false;
    for (const c of a.path) {
      const k = cellKey(c);
      if (seen.has(k)) return false;
      seen.add(k);
    }
  }
  return seen.size === total;
}

function splitShort(full: Cell[], minLen: number, maxLen: number): Cell[][] {
  const segments: Cell[][] = [];
  let i = 0;

  const aimsAtNext = (j: number) => {
    if (j >= full.length) return true;
    if (j < 2) return false;
    const prev = full[j - 2];
    const tip = full[j - 1];
    const next = full[j];
    return tip.x - prev.x === next.x - tip.x && tip.y - prev.y === next.y - tip.y;
  };

  while (i < full.length) {
    let bestJ = -1;
    let bestScore = -Infinity;
    const maxJ = Math.min(i + maxLen, full.length);
    const minJ = Math.min(Math.max(i + 2, i + minLen), full.length);

    for (let j = minJ; j <= maxJ; j++) {
      if (full.length - j === 1) continue;
      const seg = full.slice(i, j);
      const score =
        (aimsAtNext(j) ? 50 : 0) +
        countBends(seg) * 8 -
        maxStraightSteps(seg) * 6 +
        (j - i);
      if (score > bestScore) {
        bestScore = score;
        bestJ = j;
      }
    }

    if (bestJ < 0) {
      for (let j = i + 2; j <= maxJ; j++) {
        if (full.length - j === 1) continue;
        if (aimsAtNext(j) || j === full.length) {
          bestJ = j;
          break;
        }
      }
    }
    if (bestJ < 0) bestJ = Math.min(i + Math.max(2, minLen), full.length);
    if (full.length - bestJ === 1) bestJ = full.length;

    segments.push(full.slice(i, bestJ));
    i = bestJ;
  }
  return segments;
}

function generateLevel(spec: {
  id: number;
  name: string;
  gridSize: number;
  hintQuota: number;
  minLen: number;
  maxLen: number;
  maxStraight: number;
  prefix: string;
  seeds: number;
}): Level | null {
  const t0 = Date.now();
  let best: Level | null = null;
  let bestScore = -Infinity;

  for (let seed = 0; seed < spec.seeds; seed++) {
    const full = serpentinePath(spec.gridSize);
    const segments = splitShort(full, spec.minLen, spec.maxLen);
    const arrows: ArrowDef[] = segments.map((path, idx) => ({
      id: `${spec.prefix}${idx + 1}`,
      path,
    }));
    const level: Level = {
      id: spec.id,
      name: spec.name,
      gridSize: spec.gridSize,
      hintQuota: spec.hintQuota,
      arrows,
    };

    if (!isFullyPacked(level)) continue;
    if (!clearsInReverseOrder(level)) continue;

    const q = levelQuality(level);
    if (q.maxStraight > spec.maxLen) continue;

    const score =
      q.avgBends * 50 +
      q.blocked * 8 +
      q.arrows * 2 -
      q.maxStraight * 35 +
      Math.random(); // tiny jitter so same-grid levels differ

    if (score > bestScore) {
      bestScore = score;
      best = level;
    }
  }

  // Don't early-return — sample all seeds for variety between same-sized levels
  if (best) {
    const q = levelQuality(best);
    console.log(
      `Level ${spec.id} ok — ${((Date.now() - t0) / 1000).toFixed(1)}s arrows=${q.arrows} avgBends=${q.avgBends.toFixed(1)} maxStraight=${q.maxStraight}`,
    );
  }
  return best;
}

const NAMES: Record<number, string> = {
  4: 'Tight Corners',
  5: 'Switchback',
  6: 'Coil Field',
  7: 'Knot Garden',
  8: 'Deep Grid',
  9: 'Spiral Lock',
  10: 'Arrow Forest',
  11: 'Bent Labyrinth',
  12: 'Dense Weave',
  13: 'Final Maze',
};

/** Even grids only — serpentine packs cleanly and reverse-clear is reliable. */
function buildSpecs() {
  const table: [number, number, number, number, number, number][] = [
    // id, grid, maxLen, maxStraight, hints, seeds
    [4, 10, 5, 3, 3, 100],
    [5, 10, 5, 3, 3, 100],
    [6, 12, 5, 3, 3, 80],
    [7, 12, 5, 3, 3, 80],
    [8, 14, 5, 3, 4, 60],
    [9, 14, 5, 3, 4, 60],
    [10, 14, 5, 3, 4, 60],
    [11, 16, 5, 4, 4, 50],
    [12, 16, 5, 4, 5, 50],
    [13, 16, 5, 4, 5, 50],
  ];

  return table.map(([id, gridSize, maxLen, maxStraight, hintQuota, seeds]) => ({
    id,
    name: NAMES[id],
    gridSize,
    hintQuota,
    minLen: 4,
    maxLen,
    maxStraight,
    prefix: String.fromCharCode(96 + id),
    seeds,
  }));
}

mkdirSync('src/levels/data', { recursive: true });

const only = process.argv[2] ? Number(process.argv[2]) : null;
const specs = buildSpecs();
const tAll = Date.now();

for (const spec of specs) {
  if (only !== null && spec.id !== only) continue;
  console.log(`Generating level ${spec.id} (${spec.gridSize}×${spec.gridSize})...`);
  const level = generateLevel(spec);
  if (!level) {
    console.error(`Failed level ${spec.id}`);
    process.exit(1);
  }
  const q = levelQuality(level);
  console.log(
    `  arrows=${q.arrows} avgBends=${q.avgBends.toFixed(2)} maxStraight=${q.maxStraight} blocked=${q.blocked}`,
  );
  writeFileSync(
    `src/levels/data/level${level.id}.json`,
    JSON.stringify(levelToJson(level), null, 2) + '\n',
  );
}

console.log(`Done in ${((Date.now() - tAll) / 1000).toFixed(1)}s`);
