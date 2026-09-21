import { getAvailableMoves } from '../game/collision';
import { countBends } from '../game/geometry';
import { arrowsFromLevel, countSolutions, solveLevel } from '../game/solver';
import type { DifficultyBand, Level, LevelFileStats } from '../game/types';
import { targetDifficultyScore } from './difficultyConfig';

export interface AnalysisResult {
  stats: LevelFileStats;
  solution: string[] | null;
  fitError: number;
}

/**
 * Analyze a solvable level and score difficulty across multiple dimensions.
 */
export function analyzeDifficulty(
  level: Level,
  difficulty: DifficultyBand,
  opts?: { solutionLimit?: number },
): AnalysisResult {
  const solutionLimit = opts?.solutionLimit ?? 40;
  const solution = solveLevel(level);
  const arrows = arrowsFromLevel(level);
  const initialAvailable = getAvailableMoves(arrows, level.gridSize).length;
  const bendCount = level.arrows.reduce((s, a) => s + countBends(a.path), 0);
  const solutionCount = countSolutions(level, solutionLimit);
  const deadEndCount = countDeadEnds(level, 24);
  const dependencyDepth = solution?.length ?? level.arrows.length;

  const density =
    level.arrows.reduce((s, a) => s + a.path.length, 0) /
    (level.gridSize * level.gridSize);

  const arrowScore = clamp((level.arrows.length / 45) * 100);
  const densityScore = clamp(density * 180);
  const bendScore = clamp((bendCount / Math.max(1, level.arrows.length) / 6) * 100);
  const dependencyScore = clamp(((level.arrows.length - initialAvailable) / Math.max(1, level.arrows.length)) * 100);
  const depthScore = clamp((dependencyDepth / 40) * 100);
  const branchingScore = clamp(100 - Math.min(100, (solutionCount / solutionLimit) * 100));
  const deadEndScore = clamp(Math.min(100, deadEndCount * 12));
  const uniquenessScore = solutionCount <= 1 ? 100 : solutionCount <= 3 ? 70 : solutionCount <= 10 ? 40 : 10;

  const difficultyScore = clamp(
    arrowScore * 0.15 +
      densityScore * 0.1 +
      bendScore * 0.1 +
      dependencyScore * 0.2 +
      depthScore * 0.2 +
      branchingScore * 0.1 +
      deadEndScore * 0.1 +
      uniquenessScore * 0.05,
  );

  const target = targetDifficultyScore(difficulty);
  const mid = (target.min + target.max) / 2;
  const fitError = Math.abs(difficultyScore - mid);

  return {
    solution,
    fitError,
    stats: {
      arrowCount: level.arrows.length,
      bendCount,
      solutionCount,
      difficultyScore: Math.round(difficultyScore),
      initialAvailable,
      dependencyDepth,
      deadEndCount,
    },
  };
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, n));
}

/**
 * Count moves from the start state that immediately lead to zero available moves
 * (while arrows remain) — classic dead-end taps.
 */
export function countDeadEnds(level: Level, sampleLimit = 30): number {
  const arrows = arrowsFromLevel(level);
  const moves = getAvailableMoves(arrows, level.gridSize);
  let dead = 0;
  let checked = 0;

  for (const move of moves) {
    if (checked >= sampleLimit) break;
    checked++;
    move.active = false;
    const next = getAvailableMoves(arrows, level.gridSize);
    const remaining = arrows.some((a) => a.active);
    if (remaining && next.length === 0) dead++;
    move.active = true;
  }

  return dead;
}

/**
 * Candidate fitness: closer to target band score, closer to desired initialAvailable.
 */
export function candidateFitness(
  analysis: AnalysisResult,
  desiredInitial: number,
  desiredDepth: number,
  targetArrowCount?: number,
): number {
  const initialErr = Math.abs(analysis.stats.initialAvailable - desiredInitial);
  const tooOpen = Math.max(0, analysis.stats.initialAvailable - desiredInitial - 1);
  const depthErr = Math.abs(analysis.stats.dependencyDepth - desiredDepth);
  const countShort = targetArrowCount
    ? Math.max(0, targetArrowCount - analysis.stats.arrowCount)
    : 0;
  // Lower is better.
  return (
    analysis.fitError * 1.0 +
    initialErr * 10 +
    tooOpen * 14 +
    depthErr * 1.2 +
    countShort * 6 -
    analysis.stats.deadEndCount * 0.8
  );
}
