import { arrowFromWaypoints } from '../game/geometry';
import type { Level } from '../game/types';

export const level2: Level = {
  id: 2,
  name: 'Crossroads',
  gridSize: 10,
  hintQuota: 2,
  arrows: [
    arrowFromWaypoints('b1', [{ x: 5, y: 4 }, { x: 5, y: 2 }, { x: 7, y: 2 }, { x: 7, y: 1 }]),
    arrowFromWaypoints('b2', [{ x: 3, y: 3 }, { x: 3, y: 6 }, { x: 2, y: 6 }, { x: 2, y: 8 }]),
    arrowFromWaypoints('b3', [{ x: 6, y: 6 }, { x: 6, y: 3 }, { x: 7, y: 3 }, { x: 7, y: 4 }, { x: 9, y: 4 }]),
    arrowFromWaypoints('b4', [{ x: 2, y: 2 }, { x: 2, y: 5 }, { x: 1, y: 5 }]),
    arrowFromWaypoints('b5', [{ x: 8, y: 9 }, { x: 6, y: 9 }, { x: 6, y: 8 }, { x: 7, y: 8 }]),
    arrowFromWaypoints('b6', [{ x: 0, y: 3 }, { x: 1, y: 3 }, { x: 1, y: 4 }, { x: 0, y: 4 }]),
    arrowFromWaypoints('b7', [{ x: 8, y: 0 }, { x: 9, y: 0 }, { x: 9, y: 3 }, { x: 8, y: 3 }, { x: 8, y: 2 }]),
    arrowFromWaypoints('b8', [{ x: 5, y: 5 }, { x: 5, y: 8 }, { x: 3, y: 8 }, { x: 3, y: 9 }]),
    arrowFromWaypoints('b9', [{ x: 1, y: 9 }, { x: 0, y: 9 }, { x: 0, y: 6 }, { x: 1, y: 6 }, { x: 1, y: 7 }]),
    arrowFromWaypoints('b10', [{ x: 7, y: 7 }, { x: 7, y: 5 }, { x: 8, y: 5 }]),
    arrowFromWaypoints('b11', [{ x: 2, y: 1 }, { x: 2, y: 0 }, { x: 0, y: 0 }]),
    arrowFromWaypoints('b12', [{ x: 9, y: 5 }, { x: 9, y: 7 }, { x: 8, y: 7 }, { x: 8, y: 8 }, { x: 9, y: 8 }]),
    arrowFromWaypoints('b13', [{ x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 2 }, { x: 0, y: 2 }]),
    arrowFromWaypoints('b14', [{ x: 5, y: 1 }, { x: 6, y: 1 }, { x: 6, y: 0 }]),
    arrowFromWaypoints('b15', [{ x: 4, y: 1 }, { x: 4, y: 2 }, { x: 3, y: 2 }, { x: 3, y: 0 }]),
  ],
};
