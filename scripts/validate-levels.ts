import { validateLevel } from '../src/game/solver';
import { LEVELS } from '../src/levels';

for (const level of LEVELS) {
  const r = validateLevel(level);
  console.log(
    `Level ${level.id}: valid=${r.valid} solvable=${r.solvable}`,
  );
  if (r.errors.length) console.log('  errors:', r.errors);
  if (r.solution) console.log('  solution:', r.solution.join(' -> '));
  else console.log('  NO SOLUTION');
}
