import { DIRECTION_DELTA } from './directions';
import type { Arrow, Cell, Direction } from './types';

export function isInBounds(cell: Cell, gridSize: number): boolean {
  return cell.x >= 0 && cell.y >= 0 && cell.x < gridSize && cell.y < gridSize;
}

/** Cells occupied by the arrow body, tip last. */
export function getArrowCells(arrow: Pick<Arrow, 'x' | 'y' | 'direction' | 'length'>): Cell[] {
  const delta = DIRECTION_DELTA[arrow.direction];
  const cells: Cell[] = [];

  for (let i = 0; i < arrow.length; i++) {
    cells.push({
      x: arrow.x + delta.x * i,
      y: arrow.y + delta.y * i,
    });
  }

  return cells;
}

export function getArrowTip(arrow: Pick<Arrow, 'x' | 'y' | 'direction' | 'length'>): Cell {
  const cells = getArrowCells(arrow);
  return cells[cells.length - 1];
}

/**
 * Escape path: cells the tip must travel through to leave the board
 * (excludes the tip's current cell).
 */
export function getEscapePath(
  arrow: Pick<Arrow, 'x' | 'y' | 'direction' | 'length'>,
  gridSize: number,
): Cell[] {
  const tip = getArrowTip(arrow);
  const delta = DIRECTION_DELTA[arrow.direction];
  const path: Cell[] = [];

  let x = tip.x + delta.x;
  let y = tip.y + delta.y;

  while (x >= 0 && y >= 0 && x < gridSize && y < gridSize) {
    path.push({ x, y });
    x += delta.x;
    y += delta.y;
  }

  return path;
}

export function cellsOverlap(a: Cell[], b: Cell[]): boolean {
  const set = new Set(a.map((c) => `${c.x},${c.y}`));
  return b.some((c) => set.has(`${c.x},${c.y}`));
}

export function cellEquals(a: Cell, b: Cell): boolean {
  return a.x === b.x && a.y === b.y;
}

export function findArrowAt(
  arrows: Arrow[],
  cell: Cell,
): Arrow | null {
  for (let i = arrows.length - 1; i >= 0; i--) {
    const arrow = arrows[i];
    if (!arrow.active) continue;
    const occupied = getArrowCells(arrow);
    if (occupied.some((c) => cellEquals(c, cell))) {
      return arrow;
    }
  }
  return null;
}

export function pixelToGrid(
  touchX: number,
  touchY: number,
  cellSize: number,
  gridSize: number,
): Cell | null {
  const x = Math.floor(touchX / cellSize);
  const y = Math.floor(touchY / cellSize);
  if (x < 0 || y < 0 || x >= gridSize || y >= gridSize) return null;
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
