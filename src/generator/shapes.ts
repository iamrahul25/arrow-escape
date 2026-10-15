export type ShapeId = 'heart' | 'circle' | 'diamond' | 'star' | 'cross' | 'ring';

export const SHAPES: { id: ShapeId; label: string }[] = [
  { id: 'heart', label: 'Heart' },
  { id: 'circle', label: 'Circle' },
  { id: 'diamond', label: 'Diamond' },
  { id: 'star', label: 'Star' },
  { id: 'cross', label: 'Cross' },
  { id: 'ring', label: 'Ring' },
];

/** Inside test in normalized coordinates: u → right, v → up, both in [-1, 1]. */
type InsideFn = (u: number, v: number) => boolean;

function starPolygon(points: number, outer: number, inner: number): [number, number][] {
  const verts: [number, number][] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = Math.PI / 2 + (i * Math.PI) / points;
    verts.push([Math.cos(a) * r, Math.sin(a) * r - 0.08]);
  }
  return verts;
}

function insidePolygon(u: number, v: number, poly: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > v !== yj > v && u < ((xj - xi) * (v - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

const STAR = starPolygon(5, 1.05, 0.48);

const INSIDE: Record<ShapeId, InsideFn> = {
  heart: (u, v) => {
    const x = u * 1.25;
    const y = v * 1.25 + 0.18;
    const a = x * x + y * y - 1;
    return a * a * a - x * x * y * y * y <= 0;
  },
  circle: (u, v) => u * u + v * v <= 1,
  diamond: (u, v) => Math.abs(u) + Math.abs(v) <= 1.02,
  star: (u, v) => insidePolygon(u, v, STAR),
  cross: (u, v) => Math.abs(u) <= 0.36 || Math.abs(v) <= 0.36,
  ring: (u, v) => {
    const d = u * u + v * v;
    return d <= 1 && d >= 0.3;
  },
};

/** Rasterize a preset shape onto a width × height grid (row-major, sampled at cell centers). */
export function shapeMask(shape: ShapeId, width: number, height: number): boolean[] {
  const inside = INSIDE[shape];
  const mask: boolean[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const u = ((x + 0.5) / width) * 2 - 1;
      const v = 1 - ((y + 0.5) / height) * 2;
      mask.push(inside(u, v));
    }
  }
  return mask;
}

export function fullMask(width: number, height: number): boolean[] {
  return new Array<boolean>(width * height).fill(true);
}
