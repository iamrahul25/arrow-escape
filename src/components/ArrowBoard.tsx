import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Canvas,
  Circle,
  Group,
  Path,
  Skia,
} from '@shopify/react-native-skia';
import {
  useSharedValue,
  withSequence,
  withTiming,
  useDerivedValue,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
  getArrowCells,
  getArrowDirection,
  directionToAngle,
  gridToPixel,
} from '../game/geometry';
import type { Arrow, Cell, Direction } from '../game/types';
import { colors } from '../theme';
import { DIRECTION_DELTA } from '../game/directions';
import { config } from '../config';

interface ArrowBoardProps {
  arrows: Arrow[];
  gridSize: number;
  boardSize: number;
  hintArrowId: string | null;
  shakingArrowId: string | null;
  escapingArrowId: string | null;
  onTapArrow: (id: string) => void;
  onEscapeDone: () => void;
  onShakeDone: () => void;
}

interface Pt {
  x: number;
  y: number;
}

function dist(a: Pt, b: Pt): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function polylineLength(points: Pt[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += dist(points[i - 1], points[i]);
  }
  return len;
}

function samplePolyline(
  points: Pt[],
  targetDist: number,
): { point: Pt; angle: number } {
  if (points.length === 0) return { point: { x: 0, y: 0 }, angle: 0 };
  if (points.length === 1) return { point: points[0], angle: 0 };

  const total = polylineLength(points);
  const d = Math.max(0, Math.min(targetDist, total));

  let walked = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const seg = dist(a, b);
    if (walked + seg >= d || i === points.length - 1) {
      const t = seg === 0 ? 0 : (d - walked) / seg;
      return {
        point: {
          x: a.x + (b.x - a.x) * t,
          y: a.y + (b.y - a.y) * t,
        },
        angle: Math.atan2(b.y - a.y, b.x - a.x),
      };
    }
    walked += seg;
  }

  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  return {
    point: last,
    angle: Math.atan2(last.y - prev.y, last.x - prev.x),
  };
}

function slicePolyline(points: Pt[], startD: number, endD: number): Pt[] {
  const total = polylineLength(points);
  const from = Math.max(0, Math.min(startD, total));
  const to = Math.max(from, Math.min(endD, total));

  const result: Pt[] = [samplePolyline(points, from).point];
  let walked = 0;

  for (let i = 1; i < points.length; i++) {
    const b = points[i];
    const seg = dist(points[i - 1], b);
    const next = walked + seg;
    if (next > from && next < to) {
      result.push({ ...b });
    }
    walked = next;
  }

  const endPt = samplePolyline(points, to).point;
  const last = result[result.length - 1];
  if (!last || Math.hypot(last.x - endPt.x, last.y - endPt.y) > 0.5) {
    result.push(endPt);
  }

  return result;
}

function makeBodyPath(points: Pt[], tipPullBack: number, angle: number) {
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

function makeHeadPath(tip: Pt, angle: number, headSize: number) {
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

function tipDirectionFromCells(cells: Cell[]): Direction {
  const tip = cells[cells.length - 1];
  const prev = cells[cells.length - 2];
  const dx = tip.x - prev.x;
  const dy = tip.y - prev.y;
  if (dx === 1) return 'right';
  if (dx === -1) return 'left';
  if (dy === 1) return 'down';
  return 'up';
}

/**
 * Tail → tip in pixels, then continues off-board in the tip direction
 * so the arrow can crawl along its bends and exit through the tip.
 */
function buildEscapeRoute(
  cells: Cell[],
  cellSize: number,
  gridSize: number,
): Pt[] {
  const points = cells.map((c) => gridToPixel(c, cellSize));
  if (points.length < 2) return points;

  const direction = tipDirectionFromCells(cells);
  const delta = DIRECTION_DELTA[direction];
  const tip = points[points.length - 1];
  const exitDist = (gridSize + 2) * cellSize;

  points.push({
    x: tip.x + delta.x * exitDist,
    y: tip.y + delta.y * exitDist,
  });

  return points;
}

/**
 * Escape along the bent path (not a rigid slide):
 * 1. Tail retracts along every bend toward the tip
 * 2. Tip continues off-board in the tip direction
 * The visible stroke always stays on the original path.
 */
function buildCrawlGraphics(
  route: Pt[],
  progress: number,
  headSize: number,
): {
  body: ReturnType<typeof Skia.Path.Make>;
  head: ReturnType<typeof Skia.Path.Make>;
  tail: Pt | null;
  opacity: number;
} {
  const total = polylineLength(route);
  const lastSeg = dist(route[route.length - 2], route[route.length - 1]);
  const onBoardLen = Math.max(1, total - lastSeg);

  // Tail eats inward along the bends; tip advances out past the board.
  const startDist = progress * onBoardLen;
  const headDist = onBoardLen + progress * (total - onBoardLen);

  if (headDist - startDist < headSize * 0.25) {
    return {
      body: Skia.Path.Make(),
      head: Skia.Path.Make(),
      tail: null,
      opacity: Math.max(0, 1 - progress),
    };
  }

  const visible = slicePolyline(route, startDist, headDist);
  const headSample = samplePolyline(route, headDist);
  const tipPull = Math.min(
    headSize * config.arrow.tipPullbackFactor,
    Math.max(0, headDist - startDist) * 0.3,
  );

  return {
    body: makeBodyPath(visible, tipPull, headSample.angle),
    head: makeHeadPath(headSample.point, headSample.angle, headSize),
    tail: visible[0] ?? null,
    opacity:
      progress > config.animation.escapeFadeStart
        ? 1 -
          (progress - config.animation.escapeFadeStart) /
            (1 - config.animation.escapeFadeStart)
        : 1,
  };
}

function buildStaticGraphics(arrow: Arrow, cellSize: number, headSize: number) {
  const cells = getArrowCells(arrow);
  const points = cells.map((c) => gridToPixel(c, cellSize));
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

function AnimatedArrow({
  arrow,
  cellSize,
  gridSize,
  isHint,
  isShaking,
  isEscaping,
  onEscapeDone,
  onShakeDone,
}: {
  arrow: Arrow;
  cellSize: number;
  gridSize: number;
  isHint: boolean;
  isShaking: boolean;
  isEscaping: boolean;
  onEscapeDone: () => void;
  onShakeDone: () => void;
}) {
  const shakeX = useSharedValue(0);
  const [escapeT, setEscapeT] = useState(0);

  const headSize = cellSize * config.arrow.headSizeFactor;
  const strokeWidth = Math.max(
    config.arrow.strokeWidthMin,
    cellSize * config.arrow.strokeWidthFactor,
  );

  const escapeRoute = useMemo(
    () => buildEscapeRoute(getArrowCells(arrow), cellSize, gridSize),
    [arrow, cellSize, gridSize],
  );

  useEffect(() => {
    if (!isShaking) return;
    const amp = config.animation.shakeAmplitude;
    const step = config.animation.shakeStepMs;
    shakeX.value = withSequence(
      withTiming(-amp, { duration: step }),
      withTiming(amp, { duration: step }),
      withTiming(-amp * 0.66, { duration: step }),
      withTiming(amp * 0.66, { duration: step }),
      withTiming(0, { duration: step }),
    );
    const t = setTimeout(onShakeDone, config.animation.shakeDoneMs);
    return () => clearTimeout(t);
  }, [isShaking, onShakeDone, shakeX]);

  useEffect(() => {
    if (!isEscaping) {
      setEscapeT(0);
      return;
    }

    const duration =
      config.animation.escapeMsBase +
      arrow.path.length * config.animation.escapeMsPerCell;
    const start = Date.now();
    let frame = 0;
    let finished = false;

    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      setEscapeT(t);
      if (t < 1) {
        frame = requestAnimationFrame(tick);
      } else if (!finished) {
        finished = true;
        onEscapeDone();
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [isEscaping, arrow.path.length, onEscapeDone]);

  const color = isHint ? colors.hint : isShaking ? colors.blocked : colors.navy;

  const transform = useDerivedValue(() => [
    { translateX: shakeX.value },
    { translateY: 0 },
  ]);

  const staticGfx = useMemo(
    () => buildStaticGraphics(arrow, cellSize, headSize),
    [arrow, cellSize, headSize],
  );

  const escapeGfx = useMemo(() => {
    if (!isEscaping) return null;
    return buildCrawlGraphics(escapeRoute, escapeT, headSize);
  }, [isEscaping, escapeRoute, escapeT, headSize]);

  const body = escapeGfx?.body ?? staticGfx.body;
  const head = escapeGfx?.head ?? staticGfx.head;
  const tail = escapeGfx ? escapeGfx.tail : staticGfx.tail;
  const opacity = escapeGfx?.opacity ?? 1;

  return (
    <Group opacity={opacity} transform={transform}>
      {/* Flat tip cap so no circle peeks out behind the arrowhead. */}
      <Path
        path={body}
        color={color}
        style="stroke"
        strokeWidth={strokeWidth}
        strokeCap="butt"
        strokeJoin="round"
      />
      {/* Roundness only on the tail end. */}
      {tail ? (
        <Circle cx={tail.x} cy={tail.y} r={strokeWidth / 2} color={color} />
      ) : null}
      <Path path={head} color={color} style="fill" />
    </Group>
  );
}

export function ArrowBoard({
  arrows,
  gridSize,
  boardSize,
  hintArrowId,
  shakingArrowId,
  escapingArrowId,
  onTapArrow,
  onEscapeDone,
  onShakeDone,
}: ArrowBoardProps) {
  const cellSize = boardSize / gridSize;

  const visibleArrows = useMemo(() => {
    return arrows.filter((a) => a.active || a.id === escapingArrowId);
  }, [arrows, escapingArrowId]);

  const handleTap = useCallback(
    (x: number, y: number) => {
      if (escapingArrowId) return;
      const gx = Math.floor(x / cellSize);
      const gy = Math.floor(y / cellSize);
      if (gx < 0 || gy < 0 || gx >= gridSize || gy >= gridSize) return;

      for (let i = visibleArrows.length - 1; i >= 0; i--) {
        const arrow = visibleArrows[i];
        if (!arrow.active) continue;
        if (arrow.path.some((c) => c.x === gx && c.y === gy)) {
          onTapArrow(arrow.id);
          return;
        }
      }
    },
    [cellSize, gridSize, visibleArrows, onTapArrow, escapingArrowId],
  );

  const tapGesture = useMemo(
    () =>
      Gesture.Tap().onEnd((e) => {
        runOnJS(handleTap)(e.x, e.y);
      }),
    [handleTap],
  );

  const tipCells = useMemo(() => {
    const tips = new Set<string>();
    for (const arrow of visibleArrows) {
      const tip = arrow.path[arrow.path.length - 1];
      if (tip) tips.add(`${tip.x},${tip.y}`);
    }
    return tips;
  }, [visibleArrows]);

  const gridDots = useMemo(() => {
    const dots: { x: number; y: number }[] = [];
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        if (tipCells.has(`${x},${y}`)) continue;
        dots.push({
          x: x * cellSize + cellSize / 2,
          y: y * cellSize + cellSize / 2,
        });
      }
    }
    return dots;
  }, [gridSize, cellSize, tipCells]);

  const dotColor = `rgba(23, 35, 63, ${config.board.dotOpacity})`;

  return (
    <View style={[styles.board, { width: boardSize, height: boardSize }]}>
      <GestureDetector gesture={tapGesture}>
        <View>
          <Canvas style={{ width: boardSize, height: boardSize }}>
            {gridDots.map((dot, idx) => (
              <Circle
                key={idx}
                cx={dot.x}
                cy={dot.y}
                r={config.board.dotSize}
                color={dotColor}
              />
            ))}
            {visibleArrows.map((arrow) => (
              <AnimatedArrow
                key={arrow.id}
                arrow={arrow}
                cellSize={cellSize}
                gridSize={gridSize}
                isHint={hintArrowId === arrow.id}
                isShaking={shakingArrowId === arrow.id}
                isEscaping={escapingArrowId === arrow.id}
                onEscapeDone={onEscapeDone}
                onShakeDone={onShakeDone}
              />
            ))}
          </Canvas>
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  board: {
    backgroundColor: 'transparent',
    borderRadius: 20,
    overflow: 'hidden',
  },
});
