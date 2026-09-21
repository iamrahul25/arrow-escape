import { canArrowMove, getAvailableMoves } from '../game/collision';
import { getEscapeSweep } from '../game/geometry';
import { validateLevel } from '../game/solver';
import type { ArrowDef, Cell, Level, LevelFile } from '../game/types';
import { blockedBy, generateDependencyGraph } from './dependencyGraph';
import { GENERATOR_VERSION, getLevelConfig, type LevelGenConfig } from './difficultyConfig';
import { analyzeDifficulty, candidateFitness } from './difficultyAnalyzer';
import { arrowToFileArrow, totalBends } from './format';
import { OccupancyGrid } from './occupancy';
import { blockingTargets, generateArrowPath } from './pathGenerator';
import { Rng } from './rng';

export interface GenerateResult {
  file: LevelFile;
  level: Level;
}

/**
 * Generate one level: many candidates → validate → score → pick best.
 * Only lowers arrow count after the current count yields zero valid candidates.
 */
export function generateLevel(
  levelNumber: number,
  overrides?: Partial<LevelGenConfig>,
): GenerateResult | null {
  const base = { ...getLevelConfig(levelNumber), ...overrides };
  let best: { result: GenerateResult; fitness: number } | null = null;
  const minAcceptableArrows = Math.max(4, Math.floor(base.arrowCount * 0.72));

  for (let reduce = 0; reduce <= 12; reduce++) {
    const arrowCount = Math.max(minAcceptableArrows, base.arrowCount - reduce);
    // Stop if we would go below the floor and already have a result.
    if (arrowCount < minAcceptableArrows && best) break;

    const config: LevelGenConfig = {
      ...base,
      arrowCount,
      minBends: Math.max(0, base.minBends - Math.floor(reduce / 5)),
      minLength: Math.max(2, base.minLength - Math.floor(reduce / 4)),
      maxLength: Math.max(5, base.maxLength - Math.floor(reduce / 5)),
      seed: base.seed + reduce * 104_729,
    };

    const attempts = Math.max(40, config.candidateCount + reduce * 10);
    let foundAtThisCount = 0;

    for (let i = 0; i < attempts; i++) {
      const candidate = generateCandidate(config, config.seed + i * 7919);
      if (!candidate) continue;

      const validation = validateLevel(candidate.level);
      if (!validation.valid || !validation.solvable || !validation.solution) continue;

      const analysis = analyzeDifficulty(candidate.level, config.difficulty, {
        solutionLimit: 20,
      });
      if (!analysis.solution) continue;

      foundAtThisCount++;

      const fitness = candidateFitness(
        analysis,
        config.initialAvailable,
        Math.min(config.dependencyDepth, config.arrowCount),
        base.arrowCount,
      );

      const file: LevelFile = {
        version: 1,
        level: config.level,
        name: config.name,
        board: { width: config.gridSize, height: config.gridSize },
        difficulty: config.difficulty,
        hintQuota: config.hintQuota,
        generation: {
          seed: config.seed + i * 7919,
          generatorVersion: GENERATOR_VERSION,
        },
        stats: analysis.stats,
        solution: analysis.solution,
        arrows: candidate.level.arrows.map(arrowToFileArrow),
      };

      if (!best || fitness < best.fitness) {
        best = {
          fitness,
          result: { file, level: candidate.level },
        };
      }

      const availOk =
        Math.abs(analysis.stats.initialAvailable - config.initialAvailable) <= 2;
      const countOk = analysis.stats.arrowCount >= minAcceptableArrows;
      // Require sampling several candidates before early-exit so density stays high.
      if (fitness < 10 && availOk && countOk && foundAtThisCount >= 3) {
        return best.result;
      }
    }

    // Only reduce arrow count when this density produced nothing.
    if (foundAtThisCount > 0 && best) {
      const countOk = best.result.file.stats.arrowCount >= minAcceptableArrows;
      if (countOk && (best.fitness < 22 || reduce >= 2)) break;
    }
  }

  // Last resort: allow below the soft floor if nothing worked.
  if (!best) {
    for (let arrowCount = minAcceptableArrows - 1; arrowCount >= 6; arrowCount--) {
      const config: LevelGenConfig = {
        ...base,
        arrowCount,
        minBends: Math.max(0, base.minBends - 1),
        minLength: 2,
        maxLength: Math.max(5, base.maxLength - 2),
        seed: base.seed + 9_000_000 + arrowCount,
      };
      for (let i = 0; i < 80; i++) {
        const candidate = generateCandidate(config, config.seed + i * 7919);
        if (!candidate) continue;
        const validation = validateLevel(candidate.level);
        if (!validation.valid || !validation.solvable) continue;
        const analysis = analyzeDifficulty(candidate.level, config.difficulty, {
          solutionLimit: 16,
        });
        if (!analysis.solution) continue;
        const fitness = candidateFitness(
          analysis,
          config.initialAvailable,
          Math.min(config.dependencyDepth, config.arrowCount),
          base.arrowCount,
        );
        best = {
          fitness,
          result: {
            file: {
              version: 1,
              level: config.level,
              name: config.name,
              board: { width: config.gridSize, height: config.gridSize },
              difficulty: config.difficulty,
              hintQuota: config.hintQuota,
              generation: {
                seed: config.seed + i * 7919,
                generatorVersion: GENERATOR_VERSION,
              },
              stats: analysis.stats,
              solution: analysis.solution,
              arrows: candidate.level.arrows.map(arrowToFileArrow),
            },
            level: candidate.level,
          },
        };
        return best.result;
      }
    }
  }

  return best?.result ?? null;
}

function generateCandidate(
  config: LevelGenConfig,
  seed: number,
): { level: Level } | null {
  const rng = new Rng(seed);
  const ids = Array.from({ length: config.arrowCount }, (_, i) =>
    `A${String(i + 1).padStart(2, '0')}`,
  );

  const branchChance =
    config.difficulty === 'tutorial'
      ? 0.05
      : config.difficulty === 'easy'
        ? 0.15
        : config.difficulty === 'easyPlus'
          ? 0.3
          : config.difficulty === 'medium'
            ? 0.45
            : 0.6;

  const graph = generateDependencyGraph(rng, ids, {
    branchChance,
    maxParents: config.difficulty === 'tutorial' ? 1 : 2,
  });

  const placeOrder = graph.solutionOrder.slice().reverse();
  const occupied = new OccupancyGrid();
  const placedById = new Map<string, ArrowDef>();
  const placedList: ArrowDef[] = [];

  for (let index = 0; index < placeOrder.length; index++) {
    const id = placeOrder[index];
    const fill = index / Math.max(1, placeOrder.length - 1);
    const minBends =
      fill > 0.6 ? Math.min(config.minBends, fill > 0.85 ? 0 : 1) : config.minBends;
    const minLength =
      fill > 0.6 ? Math.min(config.minLength, fill > 0.85 ? 2 : 3) : config.minLength;
    const maxLength =
      fill > 0.75 ? Math.min(config.maxLength, minLength + 4) : config.maxLength;

    const shouldBlock = blockedBy(graph, id)
      .map((blockedId) => placedById.get(blockedId))
      .filter((a): a is ArrowDef => !!a);

    const activeNow = placedList.map((a) => ({ ...a, active: true as const }));
    const freeNow = getAvailableMoves(activeNow, config.gridSize);
    const opportunistic = freeNow.slice(0, 4);

    const preferCells: Cell[] = [];
    const wantBlock =
      placedList.length > 0 &&
      (rng.chance(config.blockBias) || config.blockBias >= 0.55);

    if (wantBlock) {
      const targets = shouldBlock.length > 0 ? shouldBlock : opportunistic;
      for (const target of targets) {
        preferCells.push(...blockingTargets(target, config.gridSize, occupied));
      }
    }

    const def = placeArrow(rng, {
      id,
      gridSize: config.gridSize,
      minBends,
      maxBends: config.maxBends,
      minLength,
      maxLength,
      preferCells,
      requireBlock: wantBlock && preferCells.length > 0 && config.blockBias >= 0.55,
      occupied,
      placedList,
    });

    if (!def) return null;

    placedById.set(id, def);
    placedList.push(def);
    occupied.occupy(def);
  }

  const arrows = graph.solutionOrder.map((id) => placedById.get(id)!);

  const level: Level = {
    id: config.level,
    name: config.name,
    gridSize: config.gridSize,
    hintQuota: config.hintQuota,
    arrows,
  };

  if (config.minBends >= 1 && totalBends(arrows) === 0) return null;

  return { level };
}

function placeArrow(
  rng: Rng,
  opts: {
    id: string;
    gridSize: number;
    minBends: number;
    maxBends: number;
    minLength: number;
    maxLength: number;
    preferCells: Cell[];
    requireBlock: boolean;
    occupied: OccupancyGrid;
    placedList: ArrowDef[];
  },
): ArrowDef | null {
  const tries = opts.requireBlock ? 180 : 140;

  for (let t = 0; t < tries; t++) {
    const relax = t > tries * 0.65;
    const path = generateArrowPath(rng, {
      gridSize: opts.gridSize,
      minBends: relax ? Math.min(opts.minBends, 0) : opts.minBends,
      maxBends: opts.maxBends,
      minLength: relax ? Math.min(opts.minLength, 2) : opts.minLength,
      maxLength: opts.maxLength,
      preferCells: opts.preferCells.length ? opts.preferCells : undefined,
      occupied: opts.occupied,
    });
    if (!path) continue;
    if (opts.occupied.wouldOverlap(path)) continue;

    const candidate: ArrowDef = { id: opts.id, path };
    const active = [...opts.placedList, candidate].map((a) => ({
      ...a,
      active: true as const,
    }));
    if (!canArrowMove(active[active.length - 1], active, opts.gridSize)) continue;

    if (opts.requireBlock && !relax) {
      const body = new Set(path.map((c) => `${c.x},${c.y}`));
      const hits = opts.preferCells.some((c) => body.has(`${c.x},${c.y}`));
      if (!hits) continue;
    }

    return candidate;
  }

  return null;
}

/** Expose for tests / debugging. */
export function debugEscapeCells(arrow: ArrowDef, gridSize: number) {
  return getEscapeSweep(arrow, gridSize);
}
