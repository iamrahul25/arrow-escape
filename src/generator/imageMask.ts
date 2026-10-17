import { AlphaType, ColorType, Skia } from '@shopify/react-native-skia';

/** Longest side of the stored ink map; far more detail than the largest grid can show. */
const MAX_SIDE = 400;
/** Pixels at least this transparent count as white. */
const ALPHA_CUTOFF = 128;
/** Pixels darker than this (0–255 luminance) count as black. */
const DARK_CUTOFF = 128;

export interface ImageSource {
  name: string;
  uri: string;
  /** Size of the ink map: the image box-averaged down to fit MAX_SIDE. */
  width: number;
  height: number;
  /** Row-major fraction (0–1) of black source pixels under each ink-map pixel. */
  ink: Float32Array;
}

/** Rectangle as fractions (0–1) of the image's width and height. */
export interface CropRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export const FULL_CROP: CropRect = { x0: 0, y0: 0, x1: 1, y1: 1 };

export interface ImageMaskOptions {
  /** Black becomes empty and white becomes grid. */
  invert: boolean;
  /** Minimum fraction (0–1) of a cell that must be "grid" pixels for the cell to be on. */
  coverage: number;
  /** Part of the image to use; everything outside is ignored. */
  crop: CropRect;
  /** Shrink the crop to the bounding box of grid pixels so blank margins don't waste rows. */
  trim: boolean;
}

/** Where the used part of the image sits on the grid, in cells. Its height follows its aspect. */
export interface Placement {
  x: number;
  y: number;
  width: number;
}

/** Ink-map pixel bounds; fractional when the crop doesn't land on pixel edges. */
type Bounds = CropRect;

/** Decodes an encoded image (PNG, JPEG, …) and reduces it to a black/white ink map. */
export function decodeImage(base64: string, name: string, uri: string): ImageSource {
  const image = Skia.Image.MakeImageFromEncoded(Skia.Data.fromBase64(base64));
  if (!image) throw new Error('Could not read this image.');
  const srcW = image.width();
  const srcH = image.height();
  const pixels = image.readPixels(0, 0, {
    width: srcW,
    height: srcH,
    colorType: ColorType.RGBA_8888,
    alphaType: AlphaType.Unpremul,
  });
  if (!pixels) throw new Error('Could not read the image pixels.');
  const unit = pixels instanceof Float32Array ? 255 : 1;

  const scale = Math.min(1, MAX_SIDE / Math.max(srcW, srcH));
  const width = Math.max(1, Math.round(srcW * scale));
  const height = Math.max(1, Math.round(srcH * scale));
  const dark = new Float32Array(width * height);
  const count = new Float32Array(width * height);

  for (let sy = 0; sy < srcH; sy++) {
    const row = Math.min(height - 1, Math.floor((sy * height) / srcH)) * width;
    for (let sx = 0; sx < srcW; sx++) {
      const p = (sy * srcW + sx) * 4;
      const t = row + Math.min(width - 1, Math.floor((sx * width) / srcW));
      const lum = (0.299 * pixels[p] + 0.587 * pixels[p + 1] + 0.114 * pixels[p + 2]) * unit;
      if (pixels[p + 3] * unit >= ALPHA_CUTOFF && lum < DARK_CUTOFF) dark[t]++;
      count[t]++;
    }
  }
  for (let i = 0; i < dark.length; i++) dark[i] = count[i] ? dark[i] / count[i] : 0;

  return { name, uri, width, height, ink: dark };
}

function gridValue(src: ImageSource, i: number, invert: boolean) {
  return invert ? 1 - src.ink[i] : src.ink[i];
}

function imageBounds(src: ImageSource, opts: ImageMaskOptions): Bounds {
  const crop = {
    x0: opts.crop.x0 * src.width,
    y0: opts.crop.y0 * src.height,
    x1: opts.crop.x1 * src.width,
    y1: opts.crop.y1 * src.height,
  };
  if (!opts.trim) return crop;
  let x0 = crop.x1;
  let y0 = crop.y1;
  let x1 = crop.x0;
  let y1 = crop.y0;
  for (let y = Math.floor(crop.y0); y < Math.ceil(crop.y1); y++) {
    for (let x = Math.floor(crop.x0); x < Math.ceil(crop.x1); x++) {
      if (gridValue(src, y * src.width + x, opts.invert) < 0.5) continue;
      x0 = Math.min(x0, Math.max(crop.x0, x));
      y0 = Math.min(y0, Math.max(crop.y0, y));
      x1 = Math.max(x1, Math.min(crop.x1, x + 1));
      y1 = Math.max(y1, Math.min(crop.y1, y + 1));
    }
  }
  return x1 > x0 && y1 > y0 ? { x0, y0, x1, y1 } : crop;
}

/** The part of the image that becomes the grid (crop, then trim), as fractions of the image. */
export function imageRegion(src: ImageSource, opts: ImageMaskOptions): CropRect {
  const b = imageBounds(src, opts);
  return { x0: b.x0 / src.width, y0: b.y0 / src.height, x1: b.x1 / src.width, y1: b.y1 / src.height };
}

/** Width ÷ height of the part of the image that becomes the grid. */
export function imageAspect(src: ImageSource, opts: ImageMaskOptions): number {
  const b = imageBounds(src, opts);
  return (b.x1 - b.x0) / (b.y1 - b.y0);
}

/** Largest placement of an image with this aspect that fits the grid, centered. */
export function fitPlacement(aspect: number, gridW: number, gridH: number): Placement {
  const width = Math.min(gridW, gridH * aspect);
  return { x: (gridW - width) / 2, y: (gridH - width / aspect) / 2, width };
}

/** Rasterize the placed image onto a width × height grid by area-weighted coverage per cell. */
export function imageMask(
  src: ImageSource,
  width: number,
  height: number,
  opts: ImageMaskOptions,
  placement: Placement,
): boolean[] {
  const b = imageBounds(src, opts);
  /** Ink-map pixels per cell side. */
  const k = (b.x1 - b.x0) / placement.width;
  const cellArea = k * k;
  const mask: boolean[] = [];
  for (let y = 0; y < height; y++) {
    const fy0 = Math.max(b.y0, b.y0 + (y - placement.y) * k);
    const fy1 = Math.min(b.y1, b.y0 + (y + 1 - placement.y) * k);
    for (let x = 0; x < width; x++) {
      const fx0 = Math.max(b.x0, b.x0 + (x - placement.x) * k);
      const fx1 = Math.min(b.x1, b.x0 + (x + 1 - placement.x) * k);
      let sum = 0;
      if (fx1 > fx0 && fy1 > fy0) {
        for (let py = Math.floor(fy0); py < Math.min(src.height, Math.ceil(fy1)); py++) {
          const wy = Math.min(fy1, py + 1) - Math.max(fy0, py);
          for (let px = Math.floor(fx0); px < Math.min(src.width, Math.ceil(fx1)); px++) {
            const w = (Math.min(fx1, px + 1) - Math.max(fx0, px)) * wy;
            sum += w * gridValue(src, py * src.width + px, opts.invert);
          }
        }
      }
      mask.push(sum / cellArea >= opts.coverage - 1e-6);
    }
  }
  return mask;
}
