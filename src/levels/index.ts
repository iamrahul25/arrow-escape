import type { Level, LevelJson } from '../game/types';
import { parseLevel } from './parseLevel';

import level1Json from './data/level1.json';
import level2Json from './data/level2.json';
import level3Json from './data/level3.json';
import level4Json from './data/level4.json';
import level5Json from './data/level5.json';
import level6Json from './data/level6.json';
import level7Json from './data/level7.json';
import level8Json from './data/level8.json';
import level9Json from './data/level9.json';
import level10Json from './data/level10.json';
import level11Json from './data/level11.json';
import level12Json from './data/level12.json';
import level13Json from './data/level13.json';

export const LEVELS: Level[] = [
  level1Json,
  level2Json,
  level3Json,
  level4Json,
  level5Json,
  level6Json,
  level7Json,
  level8Json,
  level9Json,
  level10Json,
  level11Json,
  level12Json,
  level13Json,
].map((json) => parseLevel(json as LevelJson));

export const level1 = LEVELS[0];
export const level2 = LEVELS[1];
export const level3 = LEVELS[2];

export function getLevel(id: number): Level | undefined {
  return LEVELS.find((l) => l.id === id);
}

export function getNextLevelId(currentId: number): number | null {
  const next = LEVELS.find((l) => l.id === currentId + 1);
  return next?.id ?? null;
}
