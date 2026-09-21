import { arrowFromWaypoints } from '../game/geometry';
import type { Level } from '../game/types';

export const level1: Level = {
  id: 1,
  name: 'First Bends',
  gridSize: 8,
  hintQuota: 2,
  arrows: [
    arrowFromWaypoints('a1', [{ x: 3, y: 4 }, { x: 6, y: 4 }, { x: 6, y: 5 }]),
    arrowFromWaypoints('a2', [{ x: 4, y: 0 }, { x: 4, y: 2 }, { x: 5, y: 2 }]),
    arrowFromWaypoints('a3', [{ x: 7, y: 6 }, { x: 7, y: 3 }, { x: 6, y: 3 }, { x: 6, y: 2 }, { x: 7, y: 2 }]),
    arrowFromWaypoints('a4', [{ x: 6, y: 1 }, { x: 5, y: 1 }, { x: 5, y: 0 }, { x: 7, y: 0 }]),
    arrowFromWaypoints('a5', [{ x: 2, y: 5 }, { x: 4, y: 5 }, { x: 4, y: 6 }]),
    arrowFromWaypoints('a6', [{ x: 4, y: 7 }, { x: 3, y: 7 }, { x: 3, y: 6 }, { x: 1, y: 6 }, { x: 1, y: 7 }]),
    arrowFromWaypoints('a7', [{ x: 0, y: 5 }, { x: 1, y: 5 }, { x: 1, y: 4 }, { x: 0, y: 4 }]),
    arrowFromWaypoints('a8', [{ x: 0, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 0 }, { x: 1, y: 0 }]),
    arrowFromWaypoints('a9', [{ x: 5, y: 5 }, { x: 5, y: 6 }, { x: 6, y: 6 }, { x: 6, y: 7 }]),
    arrowFromWaypoints('a10', [{ x: 0, y: 2 }, { x: 1, y: 2 }, { x: 1, y: 3 }, { x: 0, y: 3 }]),
  ],
};
