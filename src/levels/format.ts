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

export function levelFromFile(file: LevelFile): Level {
  if (file.board.width !== file.board.height) {
    throw new Error(
      `Level ${file.level}: non-square boards are not supported (got ${file.board.width}×${file.board.height})`,
    );
  }

  return {
    id: file.level,
    name: file.name,
    gridSize: file.board.width,
    hintQuota: file.hintQuota,
    arrows: file.arrows.map(arrowDefFromFile),
  };
}
