import { DIRECTION_DELTA } from './directions';
import type { Arrow, ArrowDef, Cell, Direction } from './types';

export function isInBounds(cell: Cell, gridSize: number): boolean {
  return cell.x >= 0 && cell.y >= 0 && cell.x < gridSize && cell.y < gridSize;
}

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

/** Expand corner waypoints into a full cell-by-cell orthogonal path. */
export function expandWaypoints(waypoints: Cell[]): Cell[] {
  if (waypoints.length === 0) return [];
  const cells: Cell[] = [{ ...waypoints[0] }];

  for (let i = 1; i < waypoints.length; i++) {
    const from = waypoints[i - 1];
    const to = waypoints[i];
    if (from.x !== to.x && from.y !== to.y) {
      throw new Error(
        `Diagonal segment not allowed: (${from.x},${from.y}) → (${to.x},${to.y})`,
      );
    }

    const dx = Math.sign(to.x - from.x);
    const dy = Math.sign(to.y - from.y);
    let x = from.x;
    let y = from.y;
    while (x !== to.x || y !== to.y) {
      x += dx;
      y += dy;
      cells.push({ x, y });
    }
  }

  return cells;
}

/** Authoring helper: build an ArrowDef from corner waypoints. */
export function arrowFromWaypoints(id: string, waypoints: Cell[]): ArrowDef {
  return { id, path: expandWaypoints(waypoints) };
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
  gridSize: number,
): Cell[] {
  const tip = getArrowTip(arrow);
  const direction = getArrowDirection(arrow);
  const delta = DIRECTION_DELTA[direction];
  const own = new Set(arrow.path.map(cellKey));
  const corridor: Cell[] = [];

  let x = tip.x + delta.x;
  let y = tip.y + delta.y;

  while (x >= 0 && y >= 0 && x < gridSize && y < gridSize) {
    const key = `${x},${y}`;
    if (!own.has(key)) {
      corridor.push({ x, y });
    }
    x += delta.x;
    y += delta.y;
  }

  return corridor;
}

export function countBends(path: Cell[]): number {
  if (path.length < 3) return 0;
  let bends = 0;
  for (let i = 1; i < path.length - 1; i++) {
    const a = path[i - 1];
    const b = path[i];
    const c = path[i + 1];
    const dx1 = b.x - a.x;
    const dy1 = b.y - a.y;
    const dx2 = c.x - b.x;
    const dy2 = c.y - b.y;
    if (dx1 !== dx2 || dy1 !== dy2) bends++;
  }
  return bends;
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

export function validatePathShape(
  path: Cell[],
  gridSize: number,
): string | null {
  if (path.length < 2) return 'Path must have at least 2 cells';

  const seen = new Set<string>();
  for (let i = 0; i < path.length; i++) {
    const cell = path[i];
    if (!isInBounds(cell, gridSize)) {
      return `Cell (${cell.x},${cell.y}) out of bounds`;
    }
    const key = cellKey(cell);
    if (seen.has(key)) return `Path revisits cell ${key}`;
    seen.add(key);

    if (i > 0) {
      const prev = path[i - 1];
      const manhattan = Math.abs(cell.x - prev.x) + Math.abs(cell.y - prev.y);
      if (manhattan !== 1) {
        return `Gap/diagonal between (${prev.x},${prev.y}) and (${cell.x},${cell.y})`;
      }
    }
  }

  try {
    getArrowDirection({ path });
  } catch (e) {
    return e instanceof Error ? e.message : 'Invalid tip direction';
  }

  return null;
}
