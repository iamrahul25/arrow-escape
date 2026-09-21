import { countBends } from '../src/game/geometry';
import { validateLevel } from '../src/game/solver';
import type { Cell, Level } from '../src/game/types';

function serp(n: number): Cell[] {
  const cells: Cell[] = [];
  for (let row = 0; row < n; row++) {
    if (row % 2 === 0) for (let x = 0; x < n; x++) cells.push({ x, y: row });
    else for (let x = n - 1; x >= 0; x--) cells.push({ x, y: row });
  }
  return cells;
}

function maxS(path: Cell[]): number {
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

function split(full: Cell[], minLen: number, maxLen: number): Cell[][] {
  const segs: Cell[][] = [];
  let i = 0;
  const aims = (j: number) => {
    if (j >= full.length) return true;
    if (j < 2) return false;
    const p = full[j - 2];
    const t = full[j - 1];
    const n = full[j];
    return t.x - p.x === n.x - t.x && t.y - p.y === n.y - t.y;
  };
  while (i < full.length) {
    let bestJ = -1;
    let bestScore = -1e9;
    for (let j = i + Math.max(2, minLen); j <= Math.min(i + maxLen, full.length); j++) {
      if (full.length - j === 1) continue;
      const seg = full.slice(i, j);
      const score =
        (aims(j) ? 40 : 0) + countBends(seg) * 8 - maxS(seg) * 6 + (j - i);
      if (score > bestScore) {
        bestScore = score;
        bestJ = j;
      }
    }
    if (bestJ < 0) bestJ = Math.min(i + 4, full.length);
    if (full.length - bestJ === 1) bestJ = full.length;
    segs.push(full.slice(i, bestJ));
    i = bestJ;
  }
  return segs;
}

const full = serp(10);
const segs = split(full, 4, 5);
const level: Level = {
  id: 4,
  name: 't',
  gridSize: 10,
  hintQuota: 3,
  arrows: segs.map((path, i) => ({ id: `d${i + 1}`, path })),
};
console.log('segs', segs.length, 'solving...');
const t0 = Date.now();
const v = validateLevel(level);
console.log(
  JSON.stringify({
    ms: Date.now() - t0,
    valid: v.valid,
    solvable: v.solvable,
    errors: v.errors.slice(0, 3),
    solLen: v.solution?.length ?? null,
    maxS: Math.max(...segs.map(maxS)),
    avgB: segs.reduce((s, p) => s + countBends(p), 0) / segs.length,
  }),
);
