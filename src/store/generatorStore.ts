import { create } from 'zustand';
import { generateLevel, type GeneratedLevel } from '../generator/generator';
import { imageAspect, imageMask, type ImageMaskOptions, type ImageSource } from '../generator/imageMask';
import { randomSeed } from '../generator/rng';
import { fullMask, shapeMask, type ShapeId } from '../generator/shapes';
import { getSuite } from '../levels';

/** Generated levels are exported for the Custom Shapes suite. */
const TARGET_SUITE_ID = 2;

export const GRID_MIN = 10;
export const GRID_MAX = 100;
export const LENGTH_MIN = 2;
export const LENGTH_MAX = 20;
export const COVERAGE_MIN = 0.05;
export const COVERAGE_MAX = 0.95;

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

export interface ImageSettings extends ImageMaskOptions {
  /** Grid height follows grid width (and vice versa) to match the image's proportions. */
  keepAspect: boolean;
}

interface GeneratorStore extends GeneratorSettings {
  width: number;
  height: number;
  customShape: boolean;
  /**
   * Last applied preset, 'image' while the mask follows the loaded image (hand edits allowed,
   * rebuilt on resize), or 'custom' once the mask is free-form.
   */
  shape: ShapeId | 'image' | 'custom';
  customMask: boolean[];
  image: ImageSource | null;
  imageSettings: ImageSettings;
  seed: number;
  lockSeed: boolean;
  result: GeneratorResult | null;
  error: string | null;

  setGridSize: (width: number, height: number) => void;
  setCustomShape: (on: boolean) => void;
  applyShape: (shape: ShapeId) => void;
  setImage: (image: ImageSource) => void;
  applyImage: () => void;
  updateImage: (patch: Partial<ImageSettings>) => void;
  clearImage: () => void;
  paintCell: (index: number, value: boolean) => void;
  fillMask: (value: boolean) => void;
  invertMask: () => void;
  setSeed: (seed: number) => void;
  setLockSeed: (lock: boolean) => void;
  update: (patch: Partial<GeneratorSettings>) => void;
  generate: () => void;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const clampGrid = (v: number) => clamp(Math.round(v) || GRID_MIN, GRID_MIN, GRID_MAX);

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

/** Grid size closest to `aspect` (width ÷ height), driven by one side and kept in bounds. */
function fitAspect(size: number, aspect: number, drivenBy: 'width' | 'height') {
  const ratio = drivenBy === 'width' ? 1 / aspect : aspect;
  const lo = Math.max(GRID_MIN, Math.ceil(GRID_MIN / ratio));
  const hi = Math.min(GRID_MAX, Math.floor(GRID_MAX / ratio));
  const driven = clampGrid(lo <= hi ? clamp(size, lo, hi) : size);
  const other = clampGrid(driven * ratio);
  return drivenBy === 'width' ? { width: driven, height: other } : { width: other, height: driven };
}

/** Size and mask for the loaded image, keeping the current width when proportions are locked. */
function imageLayout(image: ImageSource, settings: ImageSettings, width: number, height: number) {
  const size = settings.keepAspect
    ? fitAspect(width, imageAspect(image, settings), 'width')
    : { width, height };
  return {
    ...size,
    shape: 'image' as const,
    customMask: imageMask(image, size.width, size.height, settings),
    result: null,
    error: null,
  };
}

export const useGeneratorStore = create<GeneratorStore>((set, get) => ({
  width: 10,
  height: 10,
  customShape: false,
  shape: 'custom',
  customMask: fullMask(10, 10),
  image: null,
  imageSettings: { invert: false, coverage: 0.5, trim: true, keepAspect: true },
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
    const s = get();
    let width = clampGrid(w);
    let height = clampGrid(h);
    if (s.shape === 'image' && s.image) {
      if (s.imageSettings.keepAspect) {
        const aspect = imageAspect(s.image, s.imageSettings);
        const heightOnly = width === s.width && height !== s.height;
        ({ width, height } = fitAspect(heightOnly ? height : width, aspect, heightOnly ? 'height' : 'width'));
      }
      set({
        width,
        height,
        customMask: imageMask(s.image, width, height, s.imageSettings),
        result: null,
        error: null,
      });
      return;
    }
    const customMask =
      s.shape === 'custom' || s.shape === 'image'
        ? resizeMask(s.customMask, s.width, s.height, width, height)
        : shapeMask(s.shape, width, height);
    set({ width, height, customMask, result: null, error: null });
  },

  setCustomShape: (customShape) => set({ customShape, result: null, error: null }),

  applyShape: (shape) => {
    const { width, height } = get();
    set({ shape, customMask: shapeMask(shape, width, height), result: null, error: null });
  },

  setImage: (image) => {
    const s = get();
    set({ image, ...imageLayout(image, s.imageSettings, s.width, s.height) });
  },

  applyImage: () => {
    const s = get();
    if (s.image) set(imageLayout(s.image, s.imageSettings, s.width, s.height));
  },

  updateImage: (patch) => {
    const s = get();
    const imageSettings = {
      ...s.imageSettings,
      ...patch,
      coverage: clamp(
        Math.round((patch.coverage ?? s.imageSettings.coverage) * 100) / 100,
        COVERAGE_MIN,
        COVERAGE_MAX,
      ),
    };
    set({
      imageSettings,
      ...(s.image ? imageLayout(s.image, imageSettings, s.width, s.height) : {}),
    });
  },

  clearImage: () =>
    set((s) => ({ image: null, shape: s.shape === 'image' ? 'custom' : s.shape })),

  paintCell: (index, value) => {
    const { customMask, shape } = get();
    if (customMask[index] === value) return;
    const next = [...customMask];
    next[index] = value;
    set({
      customMask: next,
      shape: shape === 'image' ? 'image' : 'custom',
      result: null,
      error: null,
    });
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
    const shape = !s.customShape
      ? 'rectangle'
      : s.shape === 'image' && s.image
        ? `image:${s.image.name}`
        : s.shape;
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
