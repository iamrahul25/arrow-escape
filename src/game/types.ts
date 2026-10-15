export type Direction = 'up' | 'down' | 'left' | 'right';

export type GameStatus = 'playing' | 'paused' | 'won' | 'lost';

export interface Cell {
  x: number;
  y: number;
}

export interface PathSegment {
  direction: Direction;
  length: number;
}

/**
 * Path-based arrow: `path` is every occupied grid cell from tail → tip.
 * Cells must form a continuous orthogonal polyline (no diagonals, no gaps).
 * Escape direction is derived from the final segment (tip - previous).
 */
export interface ArrowDef {
  id: string;
  path: Cell[];
}

export interface Arrow extends ArrowDef {
  active: boolean;
}

export interface Level {
  id: number;
  name: string;
  gridSize: number;
  arrows: ArrowDef[];
  hintQuota: number;
}

/** Compact on-disk arrow (segments expand to path at load time). */
export interface LevelFileArrow {
  id: string;
  start: Cell;
  segments: PathSegment[];
  head: { direction: Direction };
}

/** Level JSON schema (version 1). Extra fields in the file are ignored. */
export interface LevelFile {
  version: number;
  level: number;
  name: string;
  board: { width: number; height: number };
  hintQuota: number;
  arrows: LevelFileArrow[];
}

export interface TapResult {
  success: boolean;
  blocked: boolean;
  arrowId: string;
  levelComplete: boolean;
  livesRemaining: number;
  gameOver: boolean;
}

export interface GameSnapshot {
  levelId: number;
  arrows: Arrow[];
  lives: number;
  hints: number;
  moves: number;
  startTime: number;
  status: GameStatus;
  hintArrowId: string | null;
}

export interface ProgressData {
  highestLevel: number;
  completedLevels: number[];
  bestScores: Record<string, number>;
  settings: {
    sound: boolean;
    haptics: boolean;
  };
}
