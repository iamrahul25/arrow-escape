import { GameEngine } from '../src/game/engine';
import { level1 } from '../src/levels/level1';
import { level2 } from '../src/levels/level2';
import { level3 } from '../src/levels/level3';
import { solveLevel } from '../src/game/solver';
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
