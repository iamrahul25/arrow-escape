import type { DifficultyBand } from '../game/types';

export const GENERATOR_VERSION = '1.0.0';

export interface LevelGenConfig {
  level: number;
  name: string;
  difficulty: DifficultyBand;
  gridSize: number;
  arrowCount: number;
  minBends: number;
  maxBends: number;
  minLength: number;
  maxLength: number;
  /** Desired initially movable arrows (soft target for candidate selection). */
  initialAvailable: number;
  /** Soft target for longest forced chain / solution depth. */
  dependencyDepth: number;
  hintQuota: number;
  /** Candidate attempts per level. */
  candidateCount: number;
  /** How hard we try to intentionally block already-placed arrows. */
  blockBias: number;
  seed: number;
}

function bandForLevel(level: number): DifficultyBand {
  if (level <= 5) return 'tutorial';
  if (level <= 10) return 'easy';
  if (level <= 20) return 'easyPlus';
  if (level <= 30) return 'medium';
  if (level <= 40) return 'hard';
  if (level <= 45) return 'veryHard';
  return 'expert';
}

const BAND_NAMES: Record<DifficultyBand, string[]> = {
  tutorial: ['Warm Up', 'First Turns', 'Clear Path', 'Gentle Curves', 'Open Board'],
  easy: ['Corner Intro', 'Soft Knots', 'Side Swipe', 'Easy Weave', 'Light Block'],
  easyPlus: [
    'Twin Paths',
    'Choice Point',
    'Bent Cross',
    'Early Fork',
    'Lane Shift',
    'Split Decision',
    'Soft Maze',
    'Detour',
    'Side Chain',
    'Quiet Trap',
  ],
  medium: [
    'Crossroads',
    'Interlock',
    'Dense Weave',
    'Hold Pattern',
    'Order Matters',
    'Tight Corridors',
    'Layered Bends',
    'Mid Maze',
    'Pinned Tip',
    'Pressure',
  ],
  hard: [
    'Deep Chain',
    'Narrow Gate',
    'Long Lookahead',
    'Hard Knot',
    'Few Exits',
    'Branch Trap',
    'Dense Order',
    'Forced Path',
    'High Stakes',
    'Lattice',
  ],
  veryHard: ['Brutal Weave', 'One Wrong Move', 'Sparse Exits', 'Deep Fork', 'Expert Gate'],
  expert: ['Master Knot', 'Zero Margin', 'Final Lattice', 'Apex Maze', 'Escape Master'],
};

/**
 * Continuous difficulty curve for levels 1–50, combined with band rules.
 */
export function getLevelConfig(level: number, seedBase = 100_000): LevelGenConfig {
  if (level < 1 || level > 50) {
    throw new Error(`Level must be 1–50, got ${level}`);
  }

  const t = (level - 1) / 49;
  const difficulty = bandForLevel(level);
  const names = BAND_NAMES[difficulty];
  const nameIndex = (level - 1) % names.length;

  // Match plan table bands with a smooth lerp.
  let gridSize: number;
  let arrowCount: number;
  let minBends: number;
  let maxBends: number;
  let minLength: number;
  let maxLength: number;
  let initialAvailable: number;
  let dependencyDepth: number;
  let blockBias: number;
  let candidateCount: number;

  if (level <= 5) {
    gridSize = 8;
    arrowCount = 6 + level; // 7–10
    minBends = 0;
    maxBends = 1;
    minLength = 3;
    maxLength = 6;
    initialAvailable = 4 + Math.floor((5 - level) / 2);
    dependencyDepth = 2 + Math.floor(level / 2);
    blockBias = 0.25;
    candidateCount = 40;
  } else if (level <= 10) {
    gridSize = 8;
    arrowCount = 10 + (level - 6); // 10–14
    minBends = 1;
    maxBends = 2;
    minLength = 3;
    maxLength = 6;
    initialAvailable = 4;
    dependencyDepth = 4;
    blockBias = 0.4;
    candidateCount = 50;
  } else if (level <= 15) {
    gridSize = 10;
    arrowCount = 12 + (level - 11); // 12–16
    minBends = 1;
    maxBends = 3;
    minLength = 3;
    maxLength = 7;
    initialAvailable = 3;
    dependencyDepth = 5;
    blockBias = 0.5;
    candidateCount = 60;
  } else if (level <= 20) {
    gridSize = 10;
    arrowCount = 15 + (level - 16); // 15–19
    minBends = 2;
    maxBends = 3;
    minLength = 3;
    maxLength = 7;
    initialAvailable = 3;
    dependencyDepth = 6;
    blockBias = 0.55;
    candidateCount = 70;
  } else if (level <= 25) {
    gridSize = 11;
    arrowCount = 18 + (level - 21); // 18–22
    minBends = 2;
    maxBends = 4;
    minLength = 3;
    maxLength = 7;
    initialAvailable = 3;
    dependencyDepth = 7;
    blockBias = 0.6;
    candidateCount = 80;
  } else if (level <= 30) {
    gridSize = 12;
    arrowCount = 20 + (level - 26); // 20–24
    minBends = 2;
    maxBends = 4;
    minLength = 3;
    maxLength = 8;
    initialAvailable = 2;
    dependencyDepth = 8;
    blockBias = 0.65;
    candidateCount = 90;
  } else if (level <= 35) {
    gridSize = 12;
    arrowCount = 23 + (level - 31); // 23–27
    minBends = 2;
    maxBends = 5;
    minLength = 3;
    maxLength = 8;
    initialAvailable = 2;
    dependencyDepth = 9;
    blockBias = 0.7;
    candidateCount = 90;
  } else if (level <= 40) {
    gridSize = 13;
    arrowCount = 26 + (level - 36); // 26–30
    minBends = 3;
    maxBends = 5;
    minLength = 3;
    maxLength = 8;
    initialAvailable = 2;
    dependencyDepth = 10;
    blockBias = 0.75;
    candidateCount = 100;
  } else if (level <= 45) {
    gridSize = 14;
    arrowCount = 28 + (level - 41); // 28–32
    minBends = 3;
    maxBends = 5;
    minLength = 3;
    maxLength = 8;
    initialAvailable = 2;
    dependencyDepth = 11;
    blockBias = 0.8;
    candidateCount = 100;
  } else {
    gridSize = 15;
    arrowCount = 30 + (level - 46); // 30–34
    minBends = 3;
    maxBends = 6;
    minLength = 3;
    maxLength = 8;
    initialAvailable = 2;
    dependencyDepth = 12;
    blockBias = 0.85;
    candidateCount = 110;
  }

  // Soft continuous nudge from the lerp curve.
  const continuousArrows = Math.round(6 + t * 33);
  arrowCount = Math.round((arrowCount * 2 + continuousArrows) / 3);

  // Cap by occupancy budget so dense boards remain placeable.
  // Use a slightly optimistic average length — late placements shorten.
  const avgLen = Math.max(3, minLength + 0.75);
  const cellBudget = Math.floor(gridSize * gridSize * 0.62);
  const maxByDensity = Math.max(6, Math.floor(cellBudget / avgLen));
  arrowCount = Math.min(arrowCount, maxByDensity);

  const hintQuota =
    difficulty === 'tutorial' || difficulty === 'easy'
      ? 3
      : difficulty === 'easyPlus' || difficulty === 'medium'
        ? 2
        : 1;

  return {
    level,
    name: names[nameIndex],
    difficulty,
    gridSize,
    arrowCount,
    minBends,
    maxBends,
    minLength,
    maxLength,
    initialAvailable,
    dependencyDepth,
    hintQuota,
    candidateCount,
    blockBias,
    seed: seedBase + level * 9973,
  };
}

export function targetDifficultyScore(difficulty: DifficultyBand): { min: number; max: number } {
  switch (difficulty) {
    case 'tutorial':
      return { min: 0, max: 20 };
    case 'easy':
      return { min: 18, max: 40 };
    case 'easyPlus':
      return { min: 35, max: 50 };
    case 'medium':
      return { min: 45, max: 65 };
    case 'hard':
      return { min: 60, max: 80 };
    case 'veryHard':
      return { min: 75, max: 90 };
    case 'expert':
      return { min: 85, max: 100 };
  }
}
