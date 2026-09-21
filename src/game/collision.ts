import { getArrowCells, getEscapePath, cellsOverlap } from './geometry';
import type { Arrow, Cell } from './types';

export function canArrowMove(arrow: Arrow, arrows: Arrow[], gridSize: number): boolean {
  if (!arrow.active) return false;

  const path = getEscapePath(arrow, gridSize);
  if (path.length === 0) {
    // Tip is already on the edge — escapes immediately if nothing else matters
    return true;
  }

  for (const other of arrows) {
    if (other.id === arrow.id || !other.active) continue;
    const occupied = getArrowCells(other);
    if (cellsOverlap(path, occupied)) {
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
  const path = getEscapePath(arrow, gridSize);

  for (const other of arrows) {
    if (other.id === arrow.id || !other.active) continue;
    const occupied = getArrowCells(other);
    if (cellsOverlap(path, occupied)) {
      return other;
    }
  }

  return null;
}

export function getAvailableMoves(arrows: Arrow[], gridSize: number): Arrow[] {
  return arrows.filter((a) => a.active && canArrowMove(a, arrows, gridSize));
}

export function buildOccupancyMap(
  arrows: Arrow[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const arrow of arrows) {
    if (!arrow.active) continue;
    for (const cell of getArrowCells(arrow)) {
      map.set(`${cell.x},${cell.y}`, arrow.id);
    }
  }
  return map;
}

export function pathIntersectsArrow(path: Cell[], arrow: Arrow): boolean {
  if (!arrow.active) return false;
  return cellsOverlap(path, getArrowCells(arrow));
}
