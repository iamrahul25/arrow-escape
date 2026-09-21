/**
 * Builds a solvable level by placing arrows in clear-order:
 * each new arrow is placed so it can escape given arrows already on the board
 * (those earlier arrows will be cleared first in play... wait)
 *
 * Correct model: we place in REVERSE clear order.
 * 1. Place an arrow that can freely escape on empty/partial board.
 * 2. Later-placed arrows may be blocked by earlier-placed ones.
 * Play order = reverse of placement order.
 */
import { getArrowCells, getEscapePath, cellsOverlap } from '../src/game/geometry';
import { canArrowMove } from '../src/game/collision';
import { validateLevel } from '../src/game/solver';
import type { ArrowDef, Direction, Level } from '../src/game/types';

const DIRS: Direction[] = ['up', 'down', 'left', 'right'];

function randomInt(n: number) {
  return Math.floor(Math.random() * n);
}

function tryPlace(
  occupied: Set<string>,
  gridSize: number,
  existing: ArrowDef[],
  id: string,
): ArrowDef | null {
  for (let attempt = 0; attempt < 400; attempt++) {
    const direction = DIRS[randomInt(4)];
    const length = 2 + randomInt(3); // 2-4
    const x = randomInt(gridSize);
    const y = randomInt(gridSize);
    const def: ArrowDef = { id, x, y, direction, length };
    const cells = getArrowCells(def);

    if (cells.some((c) => c.x < 0 || c.y < 0 || c.x >= gridSize || c.y >= gridSize)) {
      continue;
    }
    if (cells.some((c) => occupied.has(`${c.x},${c.y}`))) continue;

    // Must be able to escape given currently placed arrows (placement = reverse play)
    const asActive = [...existing, def].map((a) => ({ ...a, active: true }));
    const self = asActive[asActive.length - 1];
    if (!canArrowMove(self, asActive, gridSize)) continue;

    return def;
  }
  return null;
}

function generateLevel(
  id: number,
  name: string,
  gridSize: number,
  count: number,
  hintQuota: number,
  seedTries = 200,
): Level | null {
  for (let seed = 0; seed < seedTries; seed++) {
    const occupied = new Set<string>();
    const placed: ArrowDef[] = [];

    let ok = true;
    for (let i = 0; i < count; i++) {
      const def = tryPlace(occupied, gridSize, placed, `L${id}-${i + 1}`);
      if (!def) {
        ok = false;
        break;
      }
      placed.push(def);
      for (const c of getArrowCells(def)) occupied.add(`${c.x},${c.y}`);
    }

    if (!ok) continue;

    // Play order is reverse of placement (last placed clears first? NO)
    // We required each newly placed arrow can escape given ALL placed so far.
    // That means the LAST placed can always escape first → play order = reverse placement.
    // Solver should find a solution regardless.
    const level: Level = {
      id,
      name,
      gridSize,
      hintQuota,
      arrows: placed,
    };

    const result = validateLevel(level);
    if (result.valid && result.solvable) {
      return level;
    }
  }
  return null;
}

for (const spec of [
  { id: 2, name: 'Crossroads', gridSize: 10, count: 15, hints: 2 },
  { id: 3, name: 'Escape Room', gridSize: 10, count: 24, hints: 3 },
]) {
  const level = generateLevel(spec.id, spec.name, spec.gridSize, spec.count, spec.hints);
  if (!level) {
    console.log('FAILED', spec.id);
    continue;
  }
  const v = validateLevel(level);
  console.log('--- Level', level.id, '---');
  console.log('solvable', v.solvable, 'solution len', v.solution?.length);
  console.log(JSON.stringify(level, null, 2));
}
