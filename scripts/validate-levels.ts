/**
 * Fast validation: shape, coverage, and reverse-order clear (no full DFS).
 * Full DFS on 16×16 packs can take minutes.
 */
import { canArrowMove } from '../src/game/collision';
import { arrowsFromLevel, validateLevel } from '../src/game/solver';
import { LEVELS } from '../src/levels';

function clearsInReverse(level: (typeof LEVELS)[0]): boolean {
  const arrows = arrowsFromLevel(level);
  for (let i = arrows.length - 1; i >= 0; i--) {
    if (!canArrowMove(arrows[i], arrows, level.gridSize)) return false;
    arrows[i].active = false;
  }
  return true;
}

let failed = false;

for (const level of LEVELS) {
  const total = level.gridSize * level.gridSize;
  const occupied = new Set(
    level.arrows.flatMap((a) => a.path.map((c) => `${c.x},${c.y}`)),
  );
  const full = occupied.size === total;
  const reverseOk = clearsInReverse(level);

  // Full DFS only for small boards
  let solvable = reverseOk;
  if (level.gridSize <= 10) {
    const r = validateLevel(level);
    solvable = r.solvable;
    if (!r.valid) {
      console.log(`Level ${level.id}: INVALID`, r.errors);
      failed = true;
      continue;
    }
  }

  console.log(
    `Level ${level.id} (${level.gridSize}×${level.gridSize}): coverage=${occupied.size}/${total} reverseClear=${reverseOk} solvable=${solvable}`,
  );

  // Small boards: require full DFS solvability. Large: reverse-clear is enough.
  if (!full) failed = true;
  else if (level.gridSize <= 10 && !solvable) failed = true;
  else if (level.gridSize > 10 && !reverseOk) failed = true;
}

if (failed) {
  console.error('Level validation failed');
  process.exit(1);
}

console.log(`All ${LEVELS.length} levels valid`);
