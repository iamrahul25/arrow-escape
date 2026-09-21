import type { Level } from '../game/types';

export const level2: Level = {
  id: 2,
  name: 'Crossroads',
  gridSize: 10,
  hintQuota: 2,
  arrows: [
    { id: 'b1', x: 4, y: 2, direction: 'down', length: 2 },
    { id: 'b2', x: 2, y: 8, direction: 'up', length: 4 },
    { id: 'b3', x: 6, y: 9, direction: 'up', length: 2 },
    { id: 'b4', x: 1, y: 4, direction: 'up', length: 3 },
    { id: 'b5', x: 0, y: 3, direction: 'down', length: 2 },
    { id: 'b6', x: 3, y: 3, direction: 'down', length: 4 },
    { id: 'b7', x: 6, y: 0, direction: 'left', length: 4 },
    { id: 'b8', x: 7, y: 9, direction: 'up', length: 3 },
    { id: 'b9', x: 9, y: 8, direction: 'up', length: 2 },
    { id: 'b10', x: 7, y: 5, direction: 'up', length: 4 },
    { id: 'b11', x: 5, y: 6, direction: 'right', length: 3 },
    { id: 'b12', x: 1, y: 5, direction: 'down', length: 4 },
    { id: 'b13', x: 2, y: 1, direction: 'left', length: 3 },
    { id: 'b14', x: 0, y: 7, direction: 'down', length: 3 },
    { id: 'b15', x: 8, y: 3, direction: 'down', length: 4 },
  ],
};
