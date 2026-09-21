import { canArrowMove, getAvailableMoves } from './collision';
import type { Arrow, Level } from './types';

export function cloneArrows(arrows: Arrow[]): Arrow[] {
  return arrows.map((a) => ({ ...a }));
}

export function arrowsFromLevel(level: Level): Arrow[] {
  return level.arrows.map((a) => ({ ...a, active: true }));
}

/**
 * DFS backtracking solver. Returns one valid solution sequence of arrow ids,
 * or null if unsolvable.
 */
export function solveLevel(level: Level): string[] | null {
  const arrows = arrowsFromLevel(level);
  const solution: string[] = [];

  function dfs(): boolean {
    const remaining = arrows.filter((a) => a.active);
    if (remaining.length === 0) return true;

    const moves = getAvailableMoves(arrows, level.gridSize);
    if (moves.length === 0) return false;

    for (const move of moves) {
      move.active = false;
      solution.push(move.id);
      if (dfs()) return true;
      solution.pop();
      move.active = true;
    }

    return false;
  }

  return dfs() ? solution : null;
}

export function hasSolution(level: Level): boolean {
  return solveLevel(level) !== null;
}

export function countSolutions(level: Level, limit = 50): number {
  const arrows = arrowsFromLevel(level);
  let count = 0;

  function dfs(): void {
    if (count >= limit) return;
    const remaining = arrows.filter((a) => a.active);
    if (remaining.length === 0) {
      count++;
      return;
    }

    const moves = getAvailableMoves(arrows, level.gridSize);
    for (const move of moves) {
      move.active = false;
      dfs();
      move.active = true;
      if (count >= limit) return;
    }
  }

  dfs();
  return count;
}

export function validateLevel(level: Level): {
  valid: boolean;
  solvable: boolean;
  solution: string[] | null;
  errors: string[];
} {
  const errors: string[] = [];
  const occupied = new Map<string, string>();

  for (const arrow of level.arrows) {
    if (arrow.length < 1) {
      errors.push(`Arrow ${arrow.id} has invalid length`);
    }

    const { x, y, direction, length } = arrow;
    for (let i = 0; i < length; i++) {
      let cx = x;
      let cy = y;
      if (direction === 'right') cx = x + i;
      if (direction === 'left') cx = x - i;
      if (direction === 'down') cy = y + i;
      if (direction === 'up') cy = y - i;

      if (cx < 0 || cy < 0 || cx >= level.gridSize || cy >= level.gridSize) {
        errors.push(`Arrow ${arrow.id} goes out of bounds`);
        break;
      }

      const key = `${cx},${cy}`;
      if (occupied.has(key)) {
        errors.push(`Arrow ${arrow.id} overlaps ${occupied.get(key)} at ${key}`);
      } else {
        occupied.set(key, arrow.id);
      }
    }
  }

  const solution = errors.length === 0 ? solveLevel(level) : null;

  return {
    valid: errors.length === 0,
    solvable: solution !== null,
    solution,
    errors,
  };
}

export function getHintArrowId(arrows: Arrow[], gridSize: number): string | null {
  const moves = getAvailableMoves(arrows, gridSize);
  return moves[0]?.id ?? null;
}

export function isArrowEscapable(arrow: Arrow, arrows: Arrow[], gridSize: number): boolean {
  return canArrowMove(arrow, arrows, gridSize);
}
