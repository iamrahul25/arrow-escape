/**
 * Generates solvable bent-path levels.
 * Builds arrows tip-first from the board edge (short escape sweeps),
 * then grows the body inward with bends. Placement order = reverse clear order.
 */
import { writeFileSync } from 'fs';
import { canArrowMove } from '../src/game/collision';
import { cellKey, countBends } from '../src/game/geometry';
import { DIRECTION_DELTA } from '../src/game/directions';
import { validateLevel } from '../src/game/solver';
import type { ArrowDef, Cell, Direction, Level } from '../src/game/types';

const DIRS: Direction[] = ['up', 'down', 'left', 'right'];

function randInt(n: number) {
  return Math.floor(Math.random() * n);
}

function pick<T>(arr: T[]): T {
  return arr[randInt(arr.length)];
}

function turnLeft(d: Direction): Direction {
  const order: Direction[] = ['up', 'left', 'down', 'right'];
  return order[(order.indexOf(d) + 1) % 4];
}

function turnRight(d: Direction): Direction {
  const order: Direction[] = ['up', 'right', 'down', 'left'];
  return order[(order.indexOf(d) + 1) % 4];
}

function opposite(d: Direction): Direction {
  return ({ up: 'down', down: 'up', left: 'right', right: 'left' } as const)[d];
}

/** Tip sits on/near edge, pointing off-board; body grows opposite then bends. */
function growFromEdgeTip(
  gridSize: number,
  occupied: Set<string>,
  minBends: number,
  maxBends: number,
  minLen: number,
  maxLen: number,
): Cell[] | null {
  for (let attempt = 0; attempt < 100; attempt++) {
    const escapeDir = pick(DIRS);
    const tipDelta = DIRECTION_DELTA[escapeDir];

    // Tip cell: on the edge that escapeDir points toward
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

    // Previous cell must establish escapeDir (tip - prev = escapeDir)
    const prevX = tipX - tipDelta.x;
    const prevY = tipY - tipDelta.y;
    if (prevX < 0 || prevY < 0 || prevX >= gridSize || prevY >= gridSize) continue;
    if (occupied.has(`${tipX},${tipY}`) || occupied.has(`${prevX},${prevY}`)) continue;

    // Build path from tip backward, then reverse
    const backward: Cell[] = [
      { x: tipX, y: tipY },
      { x: prevX, y: prevY },
    ];
    const local = new Set<string>([`${tipX},${tipY}`, `${prevX},${prevY}`]);

    let x = prevX;
    let y = prevY;
    // Growing backward: first step was opposite to escapeDir
    let growDir = opposite(escapeDir);
    let bends = 0;
    let stepsOnSegment = 1;
    const targetBends = minBends + randInt(Math.max(1, maxBends - minBends + 1));
    const targetLen = minLen + randInt(Math.max(1, maxLen - minLen + 1));

    while (backward.length < targetLen) {
      const wantTurn =
        bends < targetBends &&
        stepsOnSegment >= 1 &&
        (stepsOnSegment >= 2 || Math.random() < 0.55);

      const tryDirs: Direction[] = [];
      if (wantTurn) {
        tryDirs.push(Math.random() < 0.5 ? turnLeft(growDir) : turnRight(growDir));
      }
      tryDirs.push(growDir, turnLeft(growDir), turnRight(growDir));
      const unique = tryDirs.filter((d, i, a) => a.indexOf(d) === i && d !== opposite(growDir));

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
          stepsOnSegment = 0;
        }
        x = nx;
        y = ny;
        growDir = d;
        backward.push({ x, y });
        local.add(key);
        stepsOnSegment++;
        moved = true;
        break;
      }
      if (!moved) break;
    }

    if (backward.length < minLen) continue;
    if (bends < minBends) continue;

    // Path is tip → ... → tail; reverse to tail → tip
    const path = backward.slice().reverse();
    return path;
  }
  return null;
}

function tryPlace(
  occupied: Set<string>,
  gridSize: number,
  existing: ArrowDef[],
  id: string,
  minBends: number,
  maxBends: number,
  minLen: number,
  maxLen: number,
): ArrowDef | null {
  for (let attempt = 0; attempt < 80; attempt++) {
    const softMinBends = attempt > 40 ? Math.max(1, minBends - 1) : minBends;
    const path = growFromEdgeTip(
      gridSize,
      occupied,
      softMinBends,
      maxBends,
      minLen,
      maxLen,
    );
    if (!path) continue;

    const def: ArrowDef = { id, path };
    const asActive = [...existing, def].map((a) => ({ ...a, active: true as const }));
    if (!canArrowMove(asActive[asActive.length - 1], asActive, gridSize)) continue;
    return def;
  }
  return null;
}

function generateLevel(spec: {
  id: number;
  name: string;
  gridSize: number;
  count: number;
  hintQuota: number;
  minBends: number;
  maxBends: number;
  minLen: number;
  maxLen: number;
  prefix: string;
}): Level | null {
  for (let seed = 0; seed < 800; seed++) {
    const occupied = new Set<string>();
    const placed: ArrowDef[] = [];
    let ok = true;

    for (let i = 0; i < spec.count; i++) {
      // Gradually relax length/bends as board fills
      const fill = i / spec.count;
      const minBends = fill > 0.7 ? Math.max(1, spec.minBends - 1) : spec.minBends;
      const minLen = fill > 0.7 ? Math.max(3, spec.minLen - 1) : spec.minLen;

      const def = tryPlace(
        occupied,
        spec.gridSize,
        placed,
        `${spec.prefix}${i + 1}`,
        minBends,
        spec.maxBends,
        minLen,
        spec.maxLen,
      );
      if (!def) {
        ok = false;
        break;
      }
      placed.push(def);
      for (const c of def.path) occupied.add(cellKey(c));
    }

    if (!ok) continue;

    const level: Level = {
      id: spec.id,
      name: spec.name,
      gridSize: spec.gridSize,
      hintQuota: spec.hintQuota,
      arrows: placed,
    };

    const result = validateLevel(level);
    if (result.valid && result.solvable) {
      const avgBends =
        placed.reduce((s, a) => s + countBends(a.path), 0) / placed.length;
      console.log(
        `Level ${spec.id} ok — arrows=${placed.length} avgBends=${avgBends.toFixed(1)} cells=${occupied.size}`,
      );
      return level;
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
    if (b.x - a.x !== c.x - b.x || b.y - a.y !== c.y - b.y) {
      wps.push({ ...b });
    }
  }
  wps.push({ ...path[path.length - 1] });
  return wps;
}

function formatLevelCompact(level: Level): string {
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

const specs = [
  {
    id: 1,
    name: 'First Bends',
    gridSize: 8,
    count: 10,
    hintQuota: 2,
    minBends: 1,
    maxBends: 2,
    minLen: 4,
    maxLen: 7,
    prefix: 'a',
  },
  {
    id: 2,
    name: 'Crossroads',
    gridSize: 10,
    count: 16,
    hintQuota: 2,
    minBends: 2,
    maxBends: 3,
    minLen: 5,
    maxLen: 8,
    prefix: 'b',
  },
  {
    id: 3,
    name: 'Escape Maze',
    gridSize: 12,
    count: 26,
    hintQuota: 3,
    minBends: 2,
    maxBends: 5,
    minLen: 5,
    maxLen: 10,
    prefix: 'c',
  },
] as const;

const levels: Level[] = [];
for (const spec of specs) {
  const level = generateLevel(spec);
  if (!level) {
    console.error(`Failed level ${spec.id}`);
    process.exit(1);
  }
  levels.push(level);
  const v = validateLevel(level);
  console.log(`L${level.id} solution (${v.solution?.length}): ${v.solution?.join(' -> ')}`);
  writeFileSync(`src/levels/level${level.id}.ts`, formatLevelCompact(level));
}

console.log('Wrote level1.ts, level2.ts, level3.ts');
