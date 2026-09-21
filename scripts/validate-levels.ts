import { validateLevel } from '../src/game/solver';
import { LEVELS } from '../src/levels';

let failed = 0;
for (const level of LEVELS) {
  const r = validateLevel(level);
  const status = r.valid && r.solvable ? 'OK' : 'FAIL';
  if (status === 'FAIL') failed++;
  console.log(
    `Level ${String(level.id).padStart(2, '0')}: ${status} arrows=${level.arrows.length} grid=${level.gridSize}`,
  );
  if (r.errors.length) console.log('  errors:', r.errors);
}

console.log(failed === 0 ? `\nAll ${LEVELS.length} levels valid & solvable` : `\n${failed} level(s) failed`);
process.exit(failed === 0 ? 0 : 1);
