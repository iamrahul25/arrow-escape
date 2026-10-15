import { getArrowDirection } from '../game/geometry';
import type { Cell, Direction, LevelFile, LevelFileArrow, PathSegment } from '../game/types';
import { maskToRows } from '../levels/format';
import type { GeneratedLevel } from './generator';

export const GENERATOR_VERSION = '2.0.0';

export interface ExportMeta {
  level: number;
  name: string;
  hintQuota: number;
  shape: string;
  minLength: number;
  maxLength: number;
  turnChance: number;
}

function stepDirection(from: Cell, to: Cell): Direction {
  if (to.x > from.x) return 'right';
  if (to.x < from.x) return 'left';
  if (to.y > from.y) return 'down';
  return 'up';
}

function segmentsFromPath(path: Cell[]): PathSegment[] {
  const segments: PathSegment[] = [];
  for (let i = 1; i < path.length; i++) {
    const direction = stepDirection(path[i - 1], path[i]);
    const last = segments[segments.length - 1];
    if (last && last.direction === direction) last.length++;
    else segments.push({ direction, length: 1 });
  }
  return segments;
}

function arrowId(index: number): string {
  return `A${String(index + 1).padStart(2, '0')}`;
}

export function toLevelFile(gen: GeneratedLevel, meta: ExportMeta) {
  const arrows: LevelFileArrow[] = gen.arrows.map((path, i) => ({
    id: arrowId(i),
    start: { ...path[0] },
    segments: segmentsFromPath(path),
    head: { direction: getArrowDirection({ path }) },
  }));
  const shaped = gen.mask.some((m) => !m);

  const file: LevelFile & Record<string, unknown> = {
    version: 1,
    level: meta.level,
    name: meta.name,
    board: {
      width: gen.width,
      height: gen.height,
      ...(shaped ? { mask: maskToRows(gen.mask, gen.width, gen.height) } : {}),
    },
    hintQuota: meta.hintQuota,
    generation: {
      seed: gen.seed,
      generatorVersion: GENERATOR_VERSION,
      shape: meta.shape,
      minLength: meta.minLength,
      maxLength: meta.maxLength,
      turnChance: meta.turnChance,
    },
    stats: {
      arrowCount: gen.stats.arrowCount,
      bendCount: gen.stats.bendCount,
      coverage: Number(gen.stats.coverage.toFixed(4)),
      emptyCells: gen.stats.emptyCells,
      initialAvailable: gen.stats.initialAvailable,
      solveDepth: gen.stats.solveDepth,
    },
    solution: gen.solution.map(arrowId),
    arrows,
  };
  return file;
}

export function levelFileName(level: number): string {
  return `level-${String(level).padStart(2, '0')}.json`;
}
