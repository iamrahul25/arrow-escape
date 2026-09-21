export type Direction = 'up' | 'down' | 'left' | 'right';

export type GameStatus = 'playing' | 'paused' | 'won' | 'lost';

export interface Cell {
  x: number;
  y: number;
}

export interface ArrowDef {
  id: string;
  x: number;
  y: number;
  direction: Direction;
  length: number;
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
