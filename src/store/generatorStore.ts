import { create } from 'zustand';
import { generateLevel, type GeneratedLevel } from '../generator/generator';
import {
  FULL_CROP,
  fitPlacement,
  imageAspect,
  imageMask,
  type ImageMaskOptions,
  type ImageSource,
  type Placement,
} from '../generator/imageMask';
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

export type ImageSettings = ImageMaskOptions;

/** Smallest image width, in cells, the placement controls allow. */
export const PLACEMENT_MIN = 2;

interface GeneratorStore extends GeneratorSettings {
  width: number;
  height: number;
  /**
   * While an image is applied: width and height change together (keeping `ratio`) and the image
   * scales with the grid. Unlocked, resizing only adds or removes rows/columns.
   */
  lockRatio: boolean;
  /** Grid width ÷ height kept while `lockRatio` is on. */
  ratio: number;
  customShape: boolean;
  /**
   * Last applied preset, 'image' while the mask follows the loaded image (hand edits allowed,
   * rebuilt on resize), or 'custom' once the mask is free-form.
   */
  shape: ShapeId | 'image' | 'custom';
  customMask: boolean[];
  image: ImageSource | null;
  imageSettings: ImageSettings;
  placement: Placement;
  seed: number;
  lockSeed: boolean;
  result: GeneratorResult | null;
  error: string | null;

  setGridSize: (width: number, height: number) => void;
  setLockRatio: (lock: boolean) => void;
  setCustomShape: (on: boolean) => void;
  applyShape: (shape: ShapeId) => void;
  setImage: (image: ImageSource) => void;
  applyImage: () => void;
  updateImage: (patch: Partial<ImageSettings>) => void;
  placeImage: (patch: Partial<Placement>) => void;
  fitImage: () => void;
  centerImage: () => void;
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

/** Slider ranges for the image placement: it may hang off the grid but keeps at least one cell on it. */
export function placementLimits(aspect: number, gridW: number, gridH: number, width: number) {
  return {
    maxWidth: Math.ceil(2 * Math.max(gridW, gridH * aspect)),
    minX: Math.floor(1 - width),
    maxX: gridW - 1,
    minY: Math.floor(1 - width / aspect),
    maxY: gridH - 1,
  };
}

function clampPlacement(p: Placement, aspect: number, gridW: number, gridH: number): Placement {
  const width = clamp(p.width, PLACEMENT_MIN, placementLimits(aspect, gridW, gridH, p.width).maxWidth);
  const lim = placementLimits(aspect, gridW, gridH, width);
  return { x: clamp(p.x, lim.minX, lim.maxX), y: clamp(p.y, lim.minY, lim.maxY), width };
}

/**
 * Applies the loaded image fitted to the grid. With the ratio locked the grid first takes the
 * image's proportions (keeping the current width) so the image fills it.
 */
function imageLayout(
  image: ImageSource,
  settings: ImageSettings,
  width: number,
  height: number,
  lockRatio: boolean,
) {
  const aspect = imageAspect(image, settings);
  const size = lockRatio ? fitAspect(width, aspect, 'width') : { width, height };
  const placement = fitPlacement(aspect, size.width, size.height);
  return {
    ...size,
    ratio: lockRatio ? aspect : size.width / size.height,
    placement,
    shape: 'image' as const,
    customMask: imageMask(image, size.width, size.height, settings, placement),
    result: null,
    error: null,
  };
}

function placedLayout(s: GeneratorStore, image: ImageSource, placement: Placement) {
  return {
    placement,
    customMask: imageMask(image, s.width, s.height, s.imageSettings, placement),
    result: null,
    error: null,
  };
}

const sameCrop = (a: ImageSettings['crop'], b: ImageSettings['crop']) =>
  a.x0 === b.x0 && a.y0 === b.y0 && a.x1 === b.x1 && a.y1 === b.y1;

export const useGeneratorStore = create<GeneratorStore>((set, get) => ({
  width: 10,
  height: 10,
  lockRatio: true,
  ratio: 1,
  customShape: false,
  shape: 'custom',
  customMask: fullMask(10, 10),
  image: null,
  imageSettings: { invert: false, coverage: 0.5, crop: FULL_CROP, trim: true },
  placement: { x: 0, y: 0, width: 10 },
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
      let placement = s.placement;
      if (s.lockRatio) {
        const heightOnly = width === s.width && height !== s.height;
        ({ width, height } = fitAspect(heightOnly ? height : width, s.ratio, heightOnly ? 'height' : 'width'));
        const fx = width / s.width;
        const fy = height / s.height;
        placement = {
          x: placement.x * fx,
          y: placement.y * fy,
          width: placement.width * (heightOnly ? fy : fx),
        };
      }
      set({
        width,
        height,
        placement,
        customMask: imageMask(s.image, width, height, s.imageSettings, placement),
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

  setLockRatio: (lockRatio) => set((s) => ({ lockRatio, ratio: s.width / s.height })),

  setCustomShape: (customShape) => set({ customShape, result: null, error: null }),

  applyShape: (shape) => {
    const { width, height } = get();
    set({ shape, customMask: shapeMask(shape, width, height), result: null, error: null });
  },

  setImage: (image) => {
    const s = get();
    const imageSettings = { ...s.imageSettings, crop: FULL_CROP };
    set({ image, imageSettings, ...imageLayout(image, imageSettings, s.width, s.height, s.lockRatio) });
  },

  applyImage: () => {
    const s = get();
    if (s.image) set(imageLayout(s.image, s.imageSettings, s.width, s.height, s.lockRatio));
  },

  updateImage: (patch) => {
    const s = get();
    const prev = s.imageSettings;
    const imageSettings = {
      ...prev,
      ...patch,
      coverage: clamp(
        Math.round((patch.coverage ?? prev.coverage) * 100) / 100,
        COVERAGE_MIN,
        COVERAGE_MAX,
      ),
    };
    if (!s.image) {
      set({ imageSettings });
      return;
    }
    const regionChanged =
      !sameCrop(imageSettings.crop, prev.crop) ||
      imageSettings.trim !== prev.trim ||
      imageSettings.invert !== prev.invert;
    set(
      s.shape !== 'image' || regionChanged
        ? { imageSettings, ...imageLayout(s.image, imageSettings, s.width, s.height, s.lockRatio) }
        : { imageSettings, ...placedLayout({ ...s, imageSettings }, s.image, s.placement) },
    );
  },

  placeImage: (patch) => {
    const s = get();
    if (!s.image || s.shape !== 'image') return;
    const aspect = imageAspect(s.image, s.imageSettings);
    const next = { ...s.placement, ...patch };
    if (patch.width !== undefined && patch.x === undefined && patch.y === undefined) {
      // Resize around the image's center.
      const width = clamp(patch.width, PLACEMENT_MIN, placementLimits(aspect, s.width, s.height, patch.width).maxWidth);
      next.x = s.placement.x + (s.placement.width - width) / 2;
      next.y = s.placement.y + (s.placement.width - width) / aspect / 2;
      next.width = width;
    }
    set(placedLayout(s, s.image, clampPlacement(next, aspect, s.width, s.height)));
  },

  fitImage: () => {
    const s = get();
    if (!s.image || s.shape !== 'image') return;
    set(placedLayout(s, s.image, fitPlacement(imageAspect(s.image, s.imageSettings), s.width, s.height)));
  },

  centerImage: () => {
    const s = get();
    if (!s.image || s.shape !== 'image') return;
    const height = s.placement.width / imageAspect(s.image, s.imageSettings);
    set(
      placedLayout(s, s.image, {
        ...s.placement,
        x: (s.width - s.placement.width) / 2,
        y: (s.height - height) / 2,
      }),
    );
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
