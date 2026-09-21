import { GameEngine } from '../src/game/engine';
import { countBends } from '../src/game/geometry';
import { solveLevel } from '../src/game/solver';
import { level1, LEVELS } from '../src/levels';
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

console.log(`Loaded ${LEVELS.length} levels`);

for (const level of LEVELS) {
  const bends = level.arrows.map((a) => countBends(a.path));
  const avg = bends.reduce((a, b) => a + b, 0) / bends.length;
  console.log(
    `Level ${level.id} (${level.gridSize}×${level.gridSize}): ${level.arrows.length} arrows, avgBends ${avg.toFixed(1)}`,
  );
}

// Play a sample: first, middle, last (full DFS on all 13 large boards is slow)
const sample = [LEVELS[0], LEVELS[Math.floor(LEVELS.length / 2)], LEVELS[LEVELS.length - 1]];
for (const level of sample) {
  playLevel(level);
}

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
