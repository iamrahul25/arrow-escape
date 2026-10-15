import { Skia } from '@shopify/react-native-skia';
import { directionToAngle, getArrowDirection, gridToPixel } from '../game/geometry';
import type { ArrowDef } from '../game/types';
import { config } from '../config';

export interface Pt {
  x: number;
  y: number;
}

export function makeBodyPath(points: Pt[], tipPullBack: number, angle: number) {
  const body = Skia.Path.Make();
  if (points.length === 0) return body;

  body.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    const isLast = i === points.length - 1;
    if (isLast && tipPullBack > 0) {
      body.lineTo(
        points[i].x - Math.cos(angle) * tipPullBack,
        points[i].y - Math.sin(angle) * tipPullBack,
      );
    } else {
      body.lineTo(points[i].x, points[i].y);
    }
  }
  return body;
}

/** Filled triangle with soft corners (border-radius style). */
function makeRoundedTriangle(a: Pt, b: Pt, c: Pt, radius: number) {
  const verts = [a, b, c];
  const path = Skia.Path.Make();

  for (let i = 0; i < 3; i++) {
    const prev = verts[(i + 2) % 3];
    const curr = verts[i];
    const next = verts[(i + 1) % 3];

    const toPrevX = prev.x - curr.x;
    const toPrevY = prev.y - curr.y;
    const toNextX = next.x - curr.x;
    const toNextY = next.y - curr.y;
    const lenPrev = Math.hypot(toPrevX, toPrevY) || 1;
    const lenNext = Math.hypot(toNextX, toNextY) || 1;
    const r = Math.min(radius, lenPrev * 0.45, lenNext * 0.45);

    const startX = curr.x + (toPrevX / lenPrev) * r;
    const startY = curr.y + (toPrevY / lenPrev) * r;
    const endX = curr.x + (toNextX / lenNext) * r;
    const endY = curr.y + (toNextY / lenNext) * r;

    if (i === 0) {
      path.moveTo(startX, startY);
    } else {
      path.lineTo(startX, startY);
    }
    // Control point at the sharp corner → soft radius like CSS border-radius.
    path.quadTo(curr.x, curr.y, endX, endY);
  }

  path.close();
  return path;
}

export function makeHeadPath(tip: Pt, angle: number, headSize: number) {
  const left = angle + Math.PI * 0.82;
  const right = angle - Math.PI * 0.82;
  const wingL: Pt = {
    x: tip.x + Math.cos(left) * headSize,
    y: tip.y + Math.sin(left) * headSize,
  };
  const wingR: Pt = {
    x: tip.x + Math.cos(right) * headSize,
    y: tip.y + Math.sin(right) * headSize,
  };
  const radius = headSize * config.arrow.headCornerRadiusFactor;
  return makeRoundedTriangle(tip, wingL, wingR, radius);
}

export function buildStaticGraphics(
  arrow: Pick<ArrowDef, 'path'>,
  cellSize: number,
  headSize: number,
) {
  const points = arrow.path.map((c) => gridToPixel(c, cellSize));
  const angle = directionToAngle(getArrowDirection(arrow));
  return {
    body: makeBodyPath(
      points,
      headSize * config.arrow.tipPullbackFactor,
      angle,
    ),
    head: makeHeadPath(points[points.length - 1], angle, headSize),
    tail: points[0] ?? null,
  };
}

export function arrowStrokeWidth(cellSize: number): number {
  return Math.max(config.arrow.strokeWidthMin, cellSize * config.arrow.strokeWidthFactor);
}

export function arrowHeadSize(cellSize: number): number {
  return cellSize * config.arrow.headSizeFactor;
}
