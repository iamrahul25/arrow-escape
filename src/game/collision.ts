import {
  cellKey,
  getArrowCells,
  getArrowDirection,
  getEscapeSweep,
  cellsOverlap,
} from './geometry';
import { DIRECTION_DELTA } from './directions';
import type { Arrow, Cell } from './types';

/**
 * An arrow can escape if the straight line ahead of its arrowhead
 * (tip direction only) is clear of other active arrows.
 * Bent body cells do not need a clear ray — only the tip corridor matters.
 */
export function canArrowMove(arrow: Arrow, arrows: Arrow[], gridSize: number): boolean {
  if (!arrow.active) return false;

  const corridor = getEscapeSweep(arrow, gridSize);
  if (corridor.length === 0) return true;

  for (const other of arrows) {
    if (other.id === arrow.id || !other.active) continue;
    if (cellsOverlap(corridor, getArrowCells(other))) {
      return false;
    }
  }

  return true;
}

export function getBlockingArrow(
  arrow: Arrow,
  arrows: Arrow[],
  gridSize: number,
): Arrow | null {
  const corridor = getEscapeSweep(arrow, gridSize);

  for (const other of arrows) {
    if (other.id === arrow.id || !other.active) continue;
    if (cellsOverlap(corridor, getArrowCells(other))) {
      return other;
    }
  }

  return null;
}

export function getAvailableMoves(arrows: Arrow[], gridSize: number): Arrow[] {
  return arrows.filter((a) => a.active && canArrowMove(a, arrows, gridSize));
}

export function buildOccupancyMap(arrows: Arrow[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const arrow of arrows) {
    if (!arrow.active) continue;
    for (const cell of getArrowCells(arrow)) {
      map.set(cellKey(cell), arrow.id);
    }
  }
  return map;
}

export function pathIntersectsArrow(path: Cell[], arrow: Arrow): boolean {
  if (!arrow.active) return false;
  return cellsOverlap(path, getArrowCells(arrow));
}

export function getEscapeDirectionDelta(arrow: Arrow) {
  return DIRECTION_DELTA[getArrowDirection(arrow)];
}
