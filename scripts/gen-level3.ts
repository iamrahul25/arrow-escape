import { writeFileSync } from 'fs';
import { canArrowMove } from '../src/game/collision';
import { cellKey, countBends } from '../src/game/geometry';
import { DIRECTION_DELTA } from '../src/game/directions';
import { validateLevel } from '../src/game/solver';
import type { ArrowDef, Cell, Direction, Level } from '../src/game/types';

const randInt = (n: number) => Math.floor(Math.random() * n);
const pick = <T,>(a: T[]): T => a[randInt(a.length)];
const turnLeft = (d: Direction): Direction =>
  ({ up: 'left', left: 'down', down: 'right', right: 'up' } as const)[d];
const turnRight = (d: Direction): Direction =>
  ({ up: 'right', right: 'down', down: 'left', left: 'up' } as const)[d];
const opposite = (d: Direction): Direction =>
  ({ up: 'down', down: 'up', left: 'right', right: 'left' } as const)[d];

function grow(
  gridSize: number,
  occupied: Set<string>,
  minBends: number,
  maxBends: number,
  minLen: number,
  maxLen: number,
): Cell[] | null {
  const DIRS: Direction[] = ['up', 'down', 'left', 'right'];
  for (let attempt = 0; attempt < 200; attempt++) {
    const escapeDir = pick(DIRS);
    const tipDelta = DIRECTION_DELTA[escapeDir];
    let tipX = 0;
    let tipY = 0;
    if (escapeDir === 'right') {
      tipX = gridSize - 1 - randInt(2);
      tipY = randInt(gridSize);
    } else if (escapeDir === 'left') {
      tipX = randInt(2);
      tipY = randInt(gridSize);
    } else if (escapeDir === 'down') {
      tipX = randInt(gridSize);
      tipY = gridSize - 1 - randInt(2);
    } else {
      tipX = randInt(gridSize);
      tipY = randInt(2);
    }
    const prevX = tipX - tipDelta.x;
    const prevY = tipY - tipDelta.y;
    if (prevX < 0 || prevY < 0 || prevX >= gridSize || prevY >= gridSize) continue;
    if (occupied.has(`${tipX},${tipY}`) || occupied.has(`${prevX},${prevY}`)) continue;

    const backward: Cell[] = [
      { x: tipX, y: tipY },
      { x: prevX, y: prevY },
    ];
    const local = new Set([`${tipX},${tipY}`, `${prevX},${prevY}`]);
    let x = prevX;
    let y = prevY;
    let growDir = opposite(escapeDir);
    let bends = 0;
    let steps = 1;
    const targetBends = minBends + randInt(Math.max(1, maxBends - minBends + 1));
    const targetLen = minLen + randInt(Math.max(1, maxLen - minLen + 1));

    while (backward.length < targetLen) {
      // Force turns early to hit bend targets
      const wantTurn =
        bends < targetBends &&
        steps >= 1 &&
        (bends < minBends ? steps >= 1 : steps >= 2 || Math.random() < 0.7);

      const tryDirs: Direction[] = [];
      if (wantTurn) {
        tryDirs.push(Math.random() < 0.5 ? turnLeft(growDir) : turnRight(growDir));
      }
      tryDirs.push(growDir, turnLeft(growDir), turnRight(growDir));
      const unique = tryDirs.filter(
        (d, i, a) => a.indexOf(d) === i && d !== opposite(growDir),
      );
      let moved = false;
      for (const d of unique) {
        const delta = DIRECTION_DELTA[d];
        const nx = x + delta.x;
        const ny = y + delta.y;
        const key = `${nx},${ny}`;
        if (nx < 0 || ny < 0 || nx >= gridSize || ny >= gridSize) continue;
        if (occupied.has(key) || local.has(key)) continue;
        if (d !== growDir) {
          bends++;
          steps = 0;
        }
        x = nx;
        y = ny;
        growDir = d;
        backward.push({ x, y });
        local.add(key);
        steps++;
        moved = true;
        break;
      }
      if (!moved) break;
    }

    if (backward.length >= minLen && bends >= minBends) {
      return backward.slice().reverse();
    }
  }
  return null;
}

function compressToWaypoints(path: Cell[]): Cell[] {
  if (path.length <= 2) return path.map((c) => ({ ...c }));
  const wps: Cell[] = [{ ...path[0] }];
  for (let i = 1; i < path.length - 1; i++) {
    const a = path[i - 1];
    const b = path[i];
    const c = path[i + 1];
    if (b.x - a.x !== c.x - b.x || b.y - a.y !== c.y - b.y) wps.push({ ...b });
  }
  wps.push({ ...path[path.length - 1] });
  return wps;
}

function formatLevel(level: Level): string {
  const arrows = level.arrows
    .map((a) => {
      const wps = compressToWaypoints(a.path);
      const wpStr = wps.map((c) => `{ x: ${c.x}, y: ${c.y} }`).join(', ');
      return `    arrowFromWaypoints('${a.id}', [${wpStr}]),`;
    })
    .join('\n');
  return `import { arrowFromWaypoints } from '../game/geometry';
import type { Level } from '../game/types';

export const level${level.id}: Level = {
  id: ${level.id},
  name: '${level.name}',
  gridSize: ${level.gridSize},
  hintQuota: ${level.hintQuota},
  arrows: [
${arrows}
  ],
};
`;
}

let bestLevel: Level | null = null;
let bestScore = -1;

for (let seed = 0; seed < 4000; seed++) {
  const gridSize = 12;
  const count = 25;
  const occupied = new Set<string>();
  const placed: ArrowDef[] = [];
  let ok = true;

  for (let i = 0; i < count; i++) {
    const fill = i / count;
    // Front-load longer multi-bend snakes
    const minBends = fill < 0.35 ? 3 : fill < 0.7 ? 2 : 1;
    const maxBends = fill < 0.35 ? 5 : fill < 0.7 ? 4 : 3;
    const minLen = fill < 0.35 ? 7 : fill < 0.7 ? 5 : 3;
    const maxLen = fill < 0.35 ? 12 : fill < 0.7 ? 9 : 6;

    let def: ArrowDef | null = null;
    for (let t = 0; t < 150; t++) {
      const path = grow(gridSize, occupied, minBends, maxBends, minLen, maxLen);
      if (!path) continue;
      const candidate = { id: `c${i + 1}`, path };
      const active = [...placed, candidate].map((a) => ({ ...a, active: true as const }));
      if (!canArrowMove(active[active.length - 1], active, gridSize)) continue;
      def = candidate;
      break;
    }
    if (!def) {
      ok = false;
      break;
    }
    placed.push(def);
    for (const c of def.path) occupied.add(cellKey(c));
  }

  if (!ok) continue;

  const level: Level = {
    id: 3,
    name: 'Escape Maze',
    gridSize,
    hintQuota: 3,
    arrows: placed,
  };
  const r = validateLevel(level);
  if (!r.valid || !r.solvable) continue;

  const bends = placed.map((a) => countBends(a.path));
  const avg = bends.reduce((a, b) => a + b, 0) / bends.length;
  const maxB = Math.max(...bends);
  const score = placed.length * 10 + avg * 5 + maxB * 3;
  if (score > bestScore) {
    bestScore = score;
    bestLevel = level;
    console.log(
      `candidate arrows=${placed.length} avgBends=${avg.toFixed(1)} maxBends=${maxB} cells=${occupied.size}`,
    );
    if (placed.length >= 24 && avg >= 2.2 && maxB >= 4) break;
  }
}

if (!bestLevel) {
  console.error('Failed to generate hard level 3');
  process.exit(1);
}

const bends = bestLevel.arrows.map((a) => countBends(a.path));
console.log(
  `FINAL L3 arrows=${bestLevel.arrows.length} bends ${Math.min(...bends)}-${Math.max(...bends)} avg=${(bends.reduce((a, b) => a + b, 0) / bends.length).toFixed(1)}`,
);
writeFileSync('src/levels/level3.ts', formatLevel(bestLevel));
console.log('Wrote level3.ts');
