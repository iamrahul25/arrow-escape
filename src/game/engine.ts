import { canArrowMove, getAvailableMoves } from './collision';
import { findArrowAt, pixelToGrid } from './geometry';
import { arrowsFromLevel, getHintArrowId } from './solver';
import type {
  Arrow,
  GameSnapshot,
  GameStatus,
  Level,
  TapResult,
} from './types';

const DEFAULT_LIVES = 3;

export class GameEngine {
  private level: Level | null = null;
  private arrows: Arrow[] = [];
  private lives = DEFAULT_LIVES;
  private hints = 0;
  private moves = 0;
  private startTime = 0;
  private status: GameStatus = 'playing';
  private hintArrowId: string | null = null;

  loadLevel(level: Level): GameSnapshot {
    this.level = level;
    this.arrows = arrowsFromLevel(level);
    this.lives = DEFAULT_LIVES;
    this.hints = level.hintQuota;
    this.moves = 0;
    this.startTime = Date.now();
    this.status = 'playing';
    this.hintArrowId = null;
    return this.getSnapshot();
  }

  getSnapshot(): GameSnapshot {
    return {
      levelId: this.level?.id ?? 0,
      arrows: this.arrows.map((a) => ({ ...a })),
      lives: this.lives,
      hints: this.hints,
      moves: this.moves,
      startTime: this.startTime,
      status: this.status,
      hintArrowId: this.hintArrowId,
    };
  }

  tapArrow(id: string): TapResult {
    if (this.status !== 'playing' || !this.level) {
      return {
        success: false,
        blocked: false,
        arrowId: id,
        levelComplete: false,
        livesRemaining: this.lives,
        gameOver: this.status === 'lost',
      };
    }

    const arrow = this.arrows.find((a) => a.id === id);
    if (!arrow || !arrow.active) {
      return {
        success: false,
        blocked: false,
        arrowId: id,
        levelComplete: false,
        livesRemaining: this.lives,
        gameOver: false,
      };
    }

    this.hintArrowId = null;

    if (!canArrowMove(arrow, this.arrows, this.level.gridSize)) {
      this.lives -= 1;
      if (this.lives <= 0) {
        this.lives = 0;
        this.status = 'lost';
      }
      return {
        success: false,
        blocked: true,
        arrowId: id,
        levelComplete: false,
        livesRemaining: this.lives,
        gameOver: this.status === 'lost',
      };
    }

    arrow.active = false;
    this.moves += 1;

    const levelComplete = this.isComplete();
    if (levelComplete) {
      this.status = 'won';
    }

    return {
      success: true,
      blocked: false,
      arrowId: id,
      levelComplete,
      livesRemaining: this.lives,
      gameOver: false,
    };
  }

  tapAt(touchX: number, touchY: number, cellSize: number): TapResult | null {
    if (!this.level) return null;
    const cell = pixelToGrid(touchX, touchY, cellSize, this.level.gridSize);
    if (!cell) return null;
    const arrow = findArrowAt(this.arrows, cell);
    if (!arrow) return null;
    return this.tapArrow(arrow.id);
  }

  canMove(id: string): boolean {
    if (!this.level) return false;
    const arrow = this.arrows.find((a) => a.id === id);
    if (!arrow) return false;
    return canArrowMove(arrow, this.arrows, this.level.gridSize);
  }

  getAvailableMoves(): Arrow[] {
    if (!this.level) return [];
    return getAvailableMoves(this.arrows, this.level.gridSize);
  }

  getHint(): string | null {
    if (!this.level || this.status !== 'playing') return null;
    if (this.hints <= 0) return this.hintArrowId;

    const id = getHintArrowId(this.arrows, this.level.gridSize);
    if (!id) return null;

    this.hints -= 1;
    this.hintArrowId = id;
    return id;
  }

  clearHint(): void {
    this.hintArrowId = null;
  }

  isComplete(): boolean {
    return this.arrows.every((a) => !a.active);
  }

  pause(): void {
    if (this.status === 'playing') this.status = 'paused';
  }

  resume(): void {
    if (this.status === 'paused') this.status = 'playing';
  }

  reset(): GameSnapshot {
    if (!this.level) {
      return this.getSnapshot();
    }
    return this.loadLevel(this.level);
  }

  getElapsedSeconds(): number {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }
}
