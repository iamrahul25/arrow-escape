import { level1 } from './level1';
import { level2 } from './level2';
import { level3 } from './level3';
import type { Level } from '../game/types';

export const LEVELS: Level[] = [level1, level2, level3];

export function getLevel(id: number): Level | undefined {
  return LEVELS.find((l) => l.id === id);
}

export function getNextLevelId(currentId: number): number | null {
  const next = LEVELS.find((l) => l.id === currentId + 1);
  return next?.id ?? null;
}

export { level1, level2, level3 };
