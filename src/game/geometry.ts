import { DIRECTION_DELTA } from './directions';
import type { Arrow, ArrowDef, BoardSize, Cell, Direction } from './types';

export function cellKey(cell: Cell): string {
  return `${cell.x},${cell.y}`;
}

export function cellEquals(a: Cell, b: Cell): boolean {
  return a.x === b.x && a.y === b.y;
}

export function cellsOverlap(a: Cell[], b: Cell[]): boolean {
  const set = new Set(a.map(cellKey));
  return b.some((c) => set.has(cellKey(c)));
}

export function getArrowCells(arrow: Pick<ArrowDef, 'path'>): Cell[] {
  return arrow.path;
}

export function getArrowTip(arrow: Pick<ArrowDef, 'path'>): Cell {
  return arrow.path[arrow.path.length - 1];
}

export function getArrowDirection(arrow: Pick<ArrowDef, 'path'>): Direction {
  if (arrow.path.length < 2) {
    throw new Error('Arrow path must have at least 2 cells');
  }
  const tip = arrow.path[arrow.path.length - 1];
  const prev = arrow.path[arrow.path.length - 2];
  const dx = tip.x - prev.x;
  const dy = tip.y - prev.y;

  if (dx === 1 && dy === 0) return 'right';
  if (dx === -1 && dy === 0) return 'left';
  if (dx === 0 && dy === 1) return 'down';
  if (dx === 0 && dy === -1) return 'up';

  throw new Error(`Invalid tip segment: (${prev.x},${prev.y}) → (${tip.x},${tip.y})`);
}

/**
 * Straight-line escape corridor from the arrowhead only.
 * Cells from tip+1 in the tip direction to the board edge
 * (excludes the arrow's own body cells).
 */
export function getEscapeSweep(
  arrow: Pick<ArrowDef, 'path'>,
  board: BoardSize,
): Cell[] {
  const tip = getArrowTip(arrow);
  const direction = getArrowDirection(arrow);
  const delta = DIRECTION_DELTA[direction];
  const own = new Set(arrow.path.map(cellKey));
  const corridor: Cell[] = [];

  let x = tip.x + delta.x;
  let y = tip.y + delta.y;

  while (x >= 0 && y >= 0 && x < board.width && y < board.height) {
    const key = `${x},${y}`;
    if (!own.has(key)) {
      corridor.push({ x, y });
    }
    x += delta.x;
    y += delta.y;
  }

  return corridor;
}

export function findArrowAt(arrows: Arrow[], cell: Cell): Arrow | null {
  for (let i = arrows.length - 1; i >= 0; i--) {
    const arrow = arrows[i];
    if (!arrow.active) continue;
    if (arrow.path.some((c) => cellEquals(c, cell))) {
      return arrow;
    }
  }
  return null;
}

export function pixelToGrid(
  touchX: number,
  touchY: number,
  cellSize: number,
  board: BoardSize,
): Cell | null {
  const x = Math.floor(touchX / cellSize);
  const y = Math.floor(touchY / cellSize);
  if (x < 0 || y < 0 || x >= board.width || y >= board.height) return null;
  return { x, y };
}

export function gridToPixel(cell: Cell, cellSize: number): { x: number; y: number } {
  return {
    x: cell.x * cellSize + cellSize / 2,
    y: cell.y * cellSize + cellSize / 2,
  };
}

export function directionToAngle(direction: Direction): number {
  switch (direction) {
    case 'right':
      return 0;
    case 'down':
      return Math.PI / 2;
    case 'left':
      return Math.PI;
    case 'up':
      return -Math.PI / 2;
  }
}
