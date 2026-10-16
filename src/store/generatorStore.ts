import { create } from 'zustand';
import { generateLevel, type GeneratedLevel } from '../generator/generator';
import { randomSeed } from '../generator/rng';
import { fullMask, shapeMask, type ShapeId } from '../generator/shapes';
import { getSuite } from '../levels';

/** Generated levels are exported for the Custom Shapes suite. */
const TARGET_SUITE_ID = 2;

export const GRID_MIN = 10;
export const GRID_MAX = 100;
export const LENGTH_MIN = 2;
export const LENGTH_MAX = 20;

export interface GeneratorSettings {
  minLength: number;
  maxLength: number;
  /** 0–1 */
  turnChance: number;
  levelNumber: number;
  levelName: string;
  hintQuota: number;
}

export interface GeneratorResult {
  level: GeneratedLevel;
  shape: string;
  minLength: number;
  maxLength: number;
  turnChance: number;
}

interface GeneratorStore extends GeneratorSettings {
  width: number;
  height: number;
  customShape: boolean;
  /** Last applied preset, or 'custom' once cells were painted by hand. */
  shape: ShapeId | 'custom';
  customMask: boolean[];
  seed: number;
  lockSeed: boolean;
  result: GeneratorResult | null;
  error: string | null;

  setGridSize: (width: number, height: number) => void;
  setCustomShape: (on: boolean) => void;
  applyShape: (shape: ShapeId) => void;
  paintCell: (index: number, value: boolean) => void;
  fillMask: (value: boolean) => void;
  invertMask: () => void;
  setSeed: (seed: number) => void;
  setLockSeed: (lock: boolean) => void;
  update: (patch: Partial<GeneratorSettings>) => void;
  generate: () => void;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function activeMask(s: Pick<GeneratorStore, 'customShape' | 'customMask' | 'width' | 'height'>) {
  return s.customShape ? s.customMask : fullMask(s.width, s.height);
}

function resizeMask(mask: boolean[], fromW: number, fromH: number, toW: number, toH: number) {
  const next = fullMask(toW, toH);
  for (let y = 0; y < Math.min(fromH, toH); y++) {
    for (let x = 0; x < Math.min(fromW, toW); x++) {
      next[y * toW + x] = mask[y * fromW + x];
    }
  }
  return next;
}

export const useGeneratorStore = create<GeneratorStore>((set, get) => ({
  width: 10,
  height: 10,
  customShape: false,
  shape: 'custom',
  customMask: fullMask(10, 10),
  seed: randomSeed(),
  lockSeed: false,
  minLength: 3,
  maxLength: 8,
  turnChance: 0.35,
  levelNumber: (getSuite(TARGET_SUITE_ID)?.levels.length ?? 0) + 1,
  levelName: 'Generated Level',
  hintQuota: 3,
  result: null,
  error: null,

  setGridSize: (w, h) => {
    const width = clamp(Math.round(w) || GRID_MIN, GRID_MIN, GRID_MAX);
    const height = clamp(Math.round(h) || GRID_MIN, GRID_MIN, GRID_MAX);
    const s = get();
    const customMask =
      s.shape === 'custom'
        ? resizeMask(s.customMask, s.width, s.height, width, height)
        : shapeMask(s.shape, width, height);
    set({ width, height, customMask, result: null, error: null });
  },

  setCustomShape: (customShape) => set({ customShape, result: null, error: null }),

  applyShape: (shape) => {
    const { width, height } = get();
    set({ shape, customMask: shapeMask(shape, width, height), result: null, error: null });
  },

  paintCell: (index, value) => {
    const { customMask } = get();
    if (customMask[index] === value) return;
    const next = [...customMask];
    next[index] = value;
    set({ customMask: next, shape: 'custom', result: null, error: null });
  },

  fillMask: (value) => {
    const { width, height } = get();
    set({
      customMask: new Array<boolean>(width * height).fill(value),
      shape: 'custom',
      result: null,
      error: null,
    });
  },

  invertMask: () =>
    set((s) => ({ customMask: s.customMask.map((m) => !m), shape: 'custom', result: null, error: null })),

  setSeed: (seed) => set({ seed: Math.max(0, Math.floor(seed) || 0), lockSeed: true }),

  setLockSeed: (lockSeed) => set({ lockSeed }),

  update: (patch) =>
    set((s) => {
      let minLength = clamp(patch.minLength ?? s.minLength, LENGTH_MIN, LENGTH_MAX);
      let maxLength = clamp(patch.maxLength ?? s.maxLength, LENGTH_MIN, LENGTH_MAX);
      if (minLength > maxLength) {
        if (patch.maxLength !== undefined) minLength = maxLength;
        else maxLength = minLength;
      }
      return {
        ...patch,
        minLength,
        maxLength,
        turnChance: clamp(Math.round((patch.turnChance ?? s.turnChance) * 100) / 100, 0, 1),
        hintQuota: clamp(patch.hintQuota ?? s.hintQuota, 0, 9),
        levelNumber: Math.max(1, Math.floor(patch.levelNumber ?? s.levelNumber) || 1),
      };
    }),

  generate: () => {
    const s = get();
    const seed = s.lockSeed ? s.seed : randomSeed();
    const shape = s.customShape ? s.shape : 'rectangle';
    try {
      const level = generateLevel({
        width: s.width,
        height: s.height,
        mask: activeMask(s),
        seed,
        minLength: s.minLength,
        maxLength: s.maxLength,
        turnChance: s.turnChance,
      });
      set({
        seed,
        error: null,
        result: {
          level,
          shape,
          minLength: s.minLength,
          maxLength: s.maxLength,
          turnChance: s.turnChance,
        },
      });
    } catch (err) {
      set({ seed, result: null, error: (err as Error).message });
    }
  },
}));
