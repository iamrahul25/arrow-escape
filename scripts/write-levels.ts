import { writeFileSync } from 'fs';
import { getArrowCells } from '../src/game/geometry';
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
  for (let attempt = 0; attempt < 500; attempt++) {
    const direction = DIRS[randomInt(4)];
    const length = 2 + randomInt(3);
    const x = randomInt(gridSize);
    const y = randomInt(gridSize);
    const def: ArrowDef = { id, x, y, direction, length };
    const cells = getArrowCells(def);
    if (cells.some((c) => c.x < 0 || c.y < 0 || c.x >= gridSize || c.y >= gridSize)) {
      continue;
    }
    if (cells.some((c) => occupied.has(`${c.x},${c.y}`))) continue;
    const asActive = [...existing, def].map((a) => ({ ...a, active: true }));
    if (!canArrowMove(asActive[asActive.length - 1], asActive, gridSize)) continue;
    return def;
  }
  return null;
}

function generate(
  id: number,
  name: string,
  gridSize: number,
  count: number,
  hintQuota: number,
  prefix: string,
): Level | null {
  for (let seed = 0; seed < 400; seed++) {
    const occupied = new Set<string>();
    const placed: ArrowDef[] = [];
    let ok = true;
    for (let i = 0; i < count; i++) {
      const def = tryPlace(occupied, gridSize, placed, `${prefix}${i + 1}`);
      if (!def) {
        ok = false;
        break;
      }
      placed.push(def);
      for (const c of getArrowCells(def)) occupied.add(`${c.x},${c.y}`);
    }
    if (!ok) continue;
    const level: Level = { id, name, gridSize, hintQuota, arrows: placed };
    const result = validateLevel(level);
    if (result.valid && result.solvable) return level;
  }
  return null;
}

function formatLevel(level: Level): string {
  const arrows = level.arrows
    .map(
      (a) =>
        `    { id: '${a.id}', x: ${a.x}, y: ${a.y}, direction: '${a.direction}', length: ${a.length} },`,
    )
    .join('\n');

  return `import type { Level } from '../game/types';

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

const level2 = generate(2, 'Crossroads', 10, 15, 2, 'b');
const level3 = generate(3, 'Escape Room', 10, 25, 3, 'c');

if (!level2 || !level3) {
  console.error('Generation failed', { level2: !!level2, level3: !!level3 });
  process.exit(1);
}

console.log('L2 solution', validateLevel(level2).solution?.join(' -> '));
console.log('L3 solution', validateLevel(level3).solution?.join(' -> '));

writeFileSync('src/levels/level2.ts', formatLevel(level2));
writeFileSync('src/levels/level3.ts', formatLevel(level3));
console.log('Wrote level2.ts and level3.ts');
