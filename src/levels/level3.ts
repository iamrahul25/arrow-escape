import { arrowFromWaypoints } from '../game/geometry';
import type { Level } from '../game/types';

export const level3: Level = {
  id: 3,
  name: 'Escape Maze',
  gridSize: 12,
  hintQuota: 3,
  arrows: [
    arrowFromWaypoints('c1', [{ x: 8, y: 4 }, { x: 8, y: 3 }, { x: 7, y: 3 }, { x: 7, y: 1 }]),
    arrowFromWaypoints('c2', [{ x: 0, y: 2 }, { x: 1, y: 2 }, { x: 1, y: 1 }, { x: 0, y: 1 }]),
    arrowFromWaypoints('c3', [{ x: 0, y: 8 }, { x: 1, y: 8 }, { x: 1, y: 7 }, { x: 0, y: 7 }]),
    arrowFromWaypoints('c4', [{ x: 11, y: 1 }, { x: 11, y: 2 }, { x: 10, y: 2 }, { x: 10, y: 0 }, { x: 11, y: 0 }]),
    arrowFromWaypoints('c5', [{ x: 7, y: 6 }, { x: 7, y: 7 }, { x: 9, y: 7 }, { x: 9, y: 8 }, { x: 10, y: 8 }]),
    arrowFromWaypoints('c6', [{ x: 11, y: 10 }, { x: 11, y: 7 }, { x: 10, y: 7 }, { x: 10, y: 6 }, { x: 11, y: 6 }]),
    arrowFromWaypoints('c7', [{ x: 5, y: 9 }, { x: 3, y: 9 }, { x: 3, y: 11 }]),
    arrowFromWaypoints('c8', [{ x: 2, y: 11 }, { x: 2, y: 9 }, { x: 0, y: 9 }]),
    arrowFromWaypoints('c9', [{ x: 2, y: 5 }, { x: 4, y: 5 }, { x: 4, y: 3 }, { x: 5, y: 3 }, { x: 5, y: 2 }]),
    arrowFromWaypoints('c10', [{ x: 4, y: 11 }, { x: 4, y: 10 }, { x: 5, y: 10 }, { x: 5, y: 11 }]),
    arrowFromWaypoints('c11', [{ x: 0, y: 11 }, { x: 0, y: 10 }, { x: 1, y: 10 }, { x: 1, y: 11 }]),
    arrowFromWaypoints('c12', [{ x: 2, y: 3 }, { x: 3, y: 3 }, { x: 3, y: 4 }, { x: 2, y: 4 }]),
    arrowFromWaypoints('c13', [{ x: 8, y: 0 }, { x: 8, y: 2 }, { x: 9, y: 2 }, { x: 9, y: 1 }]),
    arrowFromWaypoints('c14', [{ x: 6, y: 11 }, { x: 6, y: 10 }, { x: 7, y: 10 }, { x: 7, y: 11 }]),
    arrowFromWaypoints('c15', [{ x: 1, y: 4 }, { x: 1, y: 3 }, { x: 0, y: 3 }]),
    arrowFromWaypoints('c16', [{ x: 4, y: 2 }, { x: 2, y: 2 }, { x: 2, y: 1 }]),
    arrowFromWaypoints('c17', [{ x: 10, y: 4 }, { x: 10, y: 5 }, { x: 9, y: 5 }, { x: 9, y: 3 }, { x: 10, y: 3 }]),
    arrowFromWaypoints('c18', [{ x: 3, y: 1 }, { x: 4, y: 1 }, { x: 4, y: 0 }]),
    arrowFromWaypoints('c19', [{ x: 9, y: 9 }, { x: 8, y: 9 }, { x: 8, y: 11 }]),
    arrowFromWaypoints('c20', [{ x: 7, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 1 }, { x: 5, y: 1 }, { x: 5, y: 0 }]),
    arrowFromWaypoints('c21', [{ x: 0, y: 6 }, { x: 1, y: 6 }, { x: 1, y: 5 }, { x: 0, y: 5 }]),
    arrowFromWaypoints('c22', [{ x: 9, y: 11 }, { x: 9, y: 10 }, { x: 10, y: 10 }, { x: 10, y: 11 }]),
  ],
};
