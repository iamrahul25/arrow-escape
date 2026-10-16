import { DIRECTION_DELTA } from '../game/directions';
import { getArrowDirection } from '../game/geometry';
import type { ArrowDef, Cell, Level, LevelFile, LevelFileArrow, PathSegment } from '../game/types';

export function pathFromSegments(start: Cell, segments: PathSegment[]): Cell[] {
  if (segments.length === 0) {
    throw new Error('Arrow must have at least one segment');
  }

  const path: Cell[] = [{ ...start }];
  let x = start.x;
  let y = start.y;

  for (const seg of segments) {
    if (seg.length < 1) {
      throw new Error('Segment length must be >= 1');
    }
    const delta = DIRECTION_DELTA[seg.direction];
    for (let i = 0; i < seg.length; i++) {
      x += delta.x;
      y += delta.y;
      path.push({ x, y });
    }
  }

  return path;
}

export function arrowDefFromFile(arrow: LevelFileArrow): ArrowDef {
  const path = pathFromSegments(arrow.start, arrow.segments);
  const tipDir = getArrowDirection({ path });
  if (tipDir !== arrow.head.direction) {
    throw new Error(
      `Arrow ${arrow.id}: head.direction ${arrow.head.direction} != tip ${tipDir}`,
    );
  }
  return { id: arrow.id, path };
}

export const MASK_ON = '#';
export const MASK_OFF = '.';

export function maskFromRows(rows: string[], width: number, height: number): boolean[] {
  if (rows.length !== height || rows.some((r) => r.length !== width)) {
    throw new Error(`Mask must be ${height} rows of ${width} characters`);
  }
  return rows.flatMap((row) => [...row].map((ch) => ch === MASK_ON));
}

export function maskToRows(mask: boolean[], width: number, height: number): string[] {
  const rows: string[] = [];
  for (let y = 0; y < height; y++) {
    let row = '';
    for (let x = 0; x < width; x++) {
      row += mask[y * width + x] ? MASK_ON : MASK_OFF;
    }
    rows.push(row);
  }
  return rows;
}

export function levelFromFile(file: LevelFile, suiteId = 0): Level {
  const { width, height } = file.board;
  const mask = file.board.mask ? maskFromRows(file.board.mask, width, height) : null;
  const arrows = file.arrows.map(arrowDefFromFile);

  for (const arrow of arrows) {
    for (const c of arrow.path) {
      if (c.x < 0 || c.y < 0 || c.x >= width || c.y >= height) {
        throw new Error(`Level ${file.level}: arrow ${arrow.id} leaves the ${width}×${height} board`);
      }
    }
  }

  return {
    id: file.level,
    suiteId,
    name: file.name,
    width,
    height,
    mask,
    hintQuota: file.hintQuota,
    arrows,
  };
}
