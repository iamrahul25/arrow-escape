import { DIRECTION_DELTA } from '../game/directions';
import { countBends, getArrowDirection } from '../game/geometry';
import type {
  ArrowDef,
  Cell,
  Direction,
  Level,
  LevelFile,
  LevelFileArrow,
  PathSegment,
} from '../game/types';

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

export function segmentsFromPath(path: Cell[]): { start: Cell; segments: PathSegment[] } {
  if (path.length < 2) {
    throw new Error('Path must have at least 2 cells');
  }

  const start = { ...path[0] };
  const segments: PathSegment[] = [];
  let dir = directionBetween(path[0], path[1]);
  let length = 1;

  for (let i = 2; i < path.length; i++) {
    const nextDir = directionBetween(path[i - 1], path[i]);
    if (nextDir === dir) {
      length++;
    } else {
      segments.push({ direction: dir, length });
      dir = nextDir;
      length = 1;
    }
  }
  segments.push({ direction: dir, length });

  return { start, segments };
}

function directionBetween(a: Cell, b: Cell): Direction {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 1 && dy === 0) return 'right';
  if (dx === -1 && dy === 0) return 'left';
  if (dx === 0 && dy === 1) return 'down';
  if (dx === 0 && dy === -1) return 'up';
  throw new Error(`Non-orthogonal step: (${a.x},${a.y}) → (${b.x},${b.y})`);
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

export function arrowToFileArrow(arrow: ArrowDef): LevelFileArrow {
  const { start, segments } = segmentsFromPath(arrow.path);
  return {
    id: arrow.id,
    start,
    segments,
    head: { direction: getArrowDirection(arrow) },
  };
}

export function totalBends(arrows: ArrowDef[]): number {
  return arrows.reduce((sum, a) => sum + countBends(a.path), 0);
}
