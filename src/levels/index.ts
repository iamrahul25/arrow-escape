import type { Level, LevelFile } from '../game/types';
import { levelFromFile } from '../generator/format';
import { LEVEL_FILES } from './registry';

export const LEVELS: Level[] = LEVEL_FILES.map((file: LevelFile) => levelFromFile(file));

export function getLevel(id: number): Level | undefined {
  return LEVELS.find((l) => l.id === id);
}

export function getNextLevelId(currentId: number): number | null {
  const next = LEVELS.find((l) => l.id === currentId + 1);
  return next?.id ?? null;
}

export function getLevelFile(id: number): LevelFile | undefined {
  return LEVEL_FILES.find((l) => l.level === id);
}
