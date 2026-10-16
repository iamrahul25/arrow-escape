import type { Level, LevelFile } from '../game/types';
import { levelFromFile } from './format';
import { SUITE_1_LEVELS } from './suites/suite-1';
import { SUITE_2_LEVELS } from './suites/suite-2';

export interface Suite {
  id: number;
  name: string;
  description: string;
  levels: Level[];
}

function suite(id: number, name: string, description: string, files: LevelFile[]): Suite {
  return { id, name, description, levels: files.map((file) => levelFromFile(file, id)) };
}

export const SUITES: Suite[] = [
  suite(1, 'Squares & Rectangles', 'Grids from 4×4 up to 20×20', SUITE_1_LEVELS),
  suite(2, 'Custom Shapes', 'Hearts, stars, rings and more', SUITE_2_LEVELS),
];

export function getSuite(suiteId: number): Suite | undefined {
  return SUITES.find((s) => s.id === suiteId);
}

export function getLevel(suiteId: number, levelId: number): Level | undefined {
  return getSuite(suiteId)?.levels.find((l) => l.id === levelId);
}

export function getNextLevelId(suiteId: number, currentId: number): number | null {
  return getLevel(suiteId, currentId + 1)?.id ?? null;
}
