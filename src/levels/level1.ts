import type { Level } from '../game/types';

/** Tutorial — few crossings, teaches clear-order mechanic. */
export const level1: Level = {
  id: 1,
  name: 'First Steps',
  gridSize: 8,
  hintQuota: 2,
  arrows: [
    { id: 'a1', x: 0, y: 1, direction: 'right', length: 3 },
    { id: 'a2', x: 5, y: 0, direction: 'down', length: 3 },
    { id: 'a3', x: 7, y: 3, direction: 'left', length: 3 },
    { id: 'a4', x: 2, y: 6, direction: 'up', length: 3 },
    { id: 'a5', x: 0, y: 5, direction: 'right', length: 2 },
    { id: 'a6', x: 6, y: 5, direction: 'down', length: 2 },
    { id: 'a7', x: 4, y: 7, direction: 'left', length: 2 },
    { id: 'a8', x: 3, y: 0, direction: 'down', length: 2 },
    { id: 'a9', x: 7, y: 6, direction: 'up', length: 2 },
  ],
};
