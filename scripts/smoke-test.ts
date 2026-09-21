import { GameEngine } from '../src/game/engine';
import { countBends } from '../src/game/geometry';
import { solveLevel } from '../src/game/solver';
import { LEVELS } from '../src/levels';
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

if (LEVELS.length === 0) {
  throw new Error('No levels loaded — run npm run generate-levels first');
}

console.log(`Loaded ${LEVELS.length} levels`);

for (const level of LEVELS) {
  const bends = level.arrows.map((a) => countBends(a.path));
  const avg = bends.reduce((a, b) => a + b, 0) / bends.length;
  console.log(
    `Level ${level.id}: ${level.arrows.length} arrows, bends ${Math.min(...bends)}–${Math.max(...bends)} (avg ${avg.toFixed(1)})`,
  );
}

// Spot-check first, mid, last
const samples = [
  LEVELS[0],
  LEVELS[Math.min(24, LEVELS.length - 1)],
  LEVELS[LEVELS.length - 1],
].filter(Boolean);

for (const level of samples) {
  playLevel(level);
}

const engine = new GameEngine();
engine.loadLevel(LEVELS[0]);
const blocked = engine.getSnapshot().arrows.find((a) => !engine.canMove(a.id));
if (!blocked) throw new Error('Expected a blocked arrow on level 1');
const r = engine.tapArrow(blocked.id);
if (!r.blocked || r.livesRemaining !== 2) {
  throw new Error(`Blocked tap unexpected: ${JSON.stringify(r)}`);
}
console.log('PASS blocked tap loses a life');
console.log('All smoke tests passed');
