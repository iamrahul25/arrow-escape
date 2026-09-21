import { GameEngine } from '../src/game/engine';
import { countBends } from '../src/game/geometry';
import { solveLevel } from '../src/game/solver';
import { level1, level2, level3, LEVELS } from '../src/levels';
import type { Level } from '../src/game/types';

function playLevel(level: Level) {
  const engine = new GameEngine();
  engine.loadLevel(level);
  const solution = solveLevel(level);
  if (!solution) throw new Error(`No solution for level ${level.id}`);

  for (const id of solution) {
    const r = engine.tapArrow(id);
    if (!r.success) throw new Error(`Level ${level.id} failed on ${id}`);
  }

  const snap = engine.getSnapshot();
  if (snap.status !== 'won') throw new Error(`Level ${level.id} not won`);
  console.log(`PASS level ${level.id} (${snap.moves} moves)`);
}

for (const level of LEVELS) {
  const bends = level.arrows.map((a) => countBends(a.path));
  const avg = bends.reduce((a, b) => a + b, 0) / bends.length;
  console.log(
    `Level ${level.id}: ${level.arrows.length} arrows, bends ${Math.min(...bends)}–${Math.max(...bends)} (avg ${avg.toFixed(1)})`,
  );
  if (bends.every((b) => b === 0)) {
    throw new Error(`Level ${level.id} has no bent arrows`);
  }
}

playLevel(level1);
playLevel(level2);
playLevel(level3);

const engine = new GameEngine();
engine.loadLevel(level1);
const blocked = engine.getSnapshot().arrows.find((a) => !engine.canMove(a.id));
if (!blocked) throw new Error('Expected a blocked arrow on level 1');
const r = engine.tapArrow(blocked.id);
if (!r.blocked || r.livesRemaining !== 2) {
  throw new Error(`Blocked tap unexpected: ${JSON.stringify(r)}`);
}
console.log('PASS blocked tap loses a life');
console.log('All smoke tests passed');
