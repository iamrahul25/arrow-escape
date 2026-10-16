import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Canvas,
  Circle,
  Group,
  Path,
  RoundedRect,
  Skia,
} from '@shopify/react-native-skia';
import {
  useAnimatedReaction,
  useSharedValue,
  withSequence,
  withTiming,
  useDerivedValue,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { getArrowCells, gridToPixel } from '../game/geometry';
import type { Arrow, BoardSize, Cell, Direction } from '../game/types';
import { colors } from '../theme';
import { DIRECTION_DELTA } from '../game/directions';
import { config } from '../config';
import {
  arrowHeadSize,
  arrowStrokeWidth,
  buildStaticGraphics,
  makeBodyPath,
  makeHeadPath,
  type Pt,
} from './arrowGraphics';

interface ArrowBoardProps {
  arrows: Arrow[];
  board: BoardSize;
  /** Row-major playable cells; null = whole rectangle. */
  mask: boolean[] | null;
  showGridDots: boolean;
  cellSize: number;
  hintArrowId: string | null;
  shakingArrowId: string | null;
  escapingArrowId: string | null;
  onTapArrow: (id: string) => void;
  onEscapeDone: () => void;
  onShakeDone: () => void;
}

const MAX_ZOOM = config.zoom.max;
const BOARD_RADIUS = 20;

function clampZoom(s: number): number {
  'worklet';
  return Math.min(MAX_ZOOM, Math.max(1, s));
}

/** Keeps the zoomed board covering the viewport (no empty space at the edges). */
function clampOffset(t: number, scale: number, size: number): number {
  'worklet';
  const max = (size * (scale - 1)) / 2;
  return Math.min(max, Math.max(-max, t));
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
  exitCells: number,
): Pt[] {
  const points = cells.map((c) => gridToPixel(c, cellSize));
  if (points.length < 2) return points;

  const direction = tipDirectionFromCells(cells);
  const delta = DIRECTION_DELTA[direction];
  const tip = points[points.length - 1];
  const exitDist = (exitCells + 2) * cellSize;

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

function AnimatedArrow({
  arrow,
  cellSize,
  board,
  isHint,
  isShaking,
  isEscaping,
  onEscapeDone,
  onShakeDone,
}: {
  arrow: Arrow;
  cellSize: number;
  board: BoardSize;
  isHint: boolean;
  isShaking: boolean;
  isEscaping: boolean;
  onEscapeDone: () => void;
  onShakeDone: () => void;
}) {
  const shakeX = useSharedValue(0);
  const [escapeT, setEscapeT] = useState(0);

  const headSize = arrowHeadSize(cellSize);
  const strokeWidth = arrowStrokeWidth(cellSize);

  const exitCells = Math.max(board.width, board.height);
  const escapeRoute = useMemo(
    () => buildEscapeRoute(getArrowCells(arrow), cellSize, exitCells),
    [arrow, cellSize, exitCells],
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
  board,
  mask,
  showGridDots,
  cellSize,
  hintArrowId,
  shakingArrowId,
  escapingArrowId,
  onTapArrow,
  onEscapeDone,
  onShakeDone,
}: ArrowBoardProps) {
  const { width, height } = board;
  const pixelWidth = width * cellSize;
  const pixelHeight = height * cellSize;

  const visibleArrows = useMemo(() => {
    return arrows.filter((a) => a.active || a.id === escapingArrowId);
  }, [arrows, escapingArrowId]);

  const handleTap = useCallback(
    (x: number, y: number) => {
      if (escapingArrowId) return;
      const gx = Math.floor(x / cellSize);
      const gy = Math.floor(y / cellSize);
      if (gx < 0 || gy < 0 || gx >= width || gy >= height) return;

      for (let i = visibleArrows.length - 1; i >= 0; i--) {
        const arrow = visibleArrows[i];
        if (!arrow.active) continue;
        if (arrow.path.some((c) => c.x === gx && c.y === gy)) {
          onTapArrow(arrow.id);
          return;
        }
      }
    },
    [cellSize, width, height, visibleArrows, onTapArrow, escapingArrowId],
  );

  const centerX = pixelWidth / 2;
  const centerY = pixelHeight / 2;
  const scale = useSharedValue(1);
  const offsetX = useSharedValue(0);
  const offsetY = useSharedValue(0);
  const pinching = useSharedValue(false);
  const pinchAnchor = useSharedValue({ scale: 1, x: 0, y: 0 });
  const blockTapsUntil = useSharedValue(0);
  const [zoomPercent, setZoomPercent] = useState(100);

  useEffect(() => {
    scale.value = 1;
    offsetX.value = 0;
    offsetY.value = 0;
  }, [board, cellSize, scale, offsetX, offsetY]);

  useAnimatedReaction(
    () => Math.round(scale.value * 100),
    (pct, prev) => {
      if (pct !== prev) runOnJS(setZoomPercent)(pct);
    },
  );

  const viewTransform = useDerivedValue(() => [
    { translateX: centerX + offsetX.value },
    { translateY: centerY + offsetY.value },
    { scale: scale.value },
    { translateX: -centerX },
    { translateY: -centerY },
  ]);

  // Board outline in board coordinates, sized so it stays a constant width on screen.
  const edgeStroke = useDerivedValue(() => config.zoom.edgeWidth / scale.value);
  const edgeInset = useDerivedValue(() => edgeStroke.value / 2);
  const edgeWidth = useDerivedValue(() => pixelWidth - edgeStroke.value);
  const edgeHeight = useDerivedValue(() => pixelHeight - edgeStroke.value);
  const edgeRadius = useDerivedValue(() => BOARD_RADIUS / scale.value);
  const edgeOpacity = useDerivedValue(() =>
    Math.min(1, Math.max(0, (scale.value - 1) / config.zoom.edgeFadeRange)),
  );

  const boardGesture = useMemo(() => {
    const pinch = Gesture.Pinch()
      .onStart((e) => {
        pinching.value = true;
        const s = scale.value;
        // Board point under the fingers, relative to the board center.
        pinchAnchor.value = {
          scale: s,
          x: (e.focalX - centerX - offsetX.value) / s,
          y: (e.focalY - centerY - offsetY.value) / s,
        };
      })
      .onUpdate((e) => {
        const anchor = pinchAnchor.value;
        const s = clampZoom(anchor.scale * e.scale);
        scale.value = s;
        offsetX.value = clampOffset(e.focalX - centerX - anchor.x * s, s, pixelWidth);
        offsetY.value = clampOffset(e.focalY - centerY - anchor.y * s, s, pixelHeight);
      })
      .onEnd(() => {
        blockTapsUntil.value = Date.now() + config.zoom.tapCooldownMs;
      })
      .onFinalize(() => {
        pinching.value = false;
      });

    const pan = Gesture.Pan()
      .minDistance(config.zoom.panMinDistance)
      .averageTouches(true)
      .onChange((e) => {
        if (pinching.value) return;
        const s = scale.value;
        offsetX.value = clampOffset(offsetX.value + e.changeX, s, pixelWidth);
        offsetY.value = clampOffset(offsetY.value + e.changeY, s, pixelHeight);
      })
      .onEnd(() => {
        blockTapsUntil.value = Date.now() + config.zoom.tapCooldownMs;
      });

    const tap = Gesture.Tap()
      .maxDistance(config.zoom.tapMaxDistance)
      .onTouchesDown((e, manager) => {
        if (e.numberOfTouches > 1) manager.fail();
      })
      .onEnd((e, success) => {
        if (!success || pinching.value || Date.now() < blockTapsUntil.value) return;
        const s = scale.value;
        runOnJS(handleTap)(
          (e.x - centerX - offsetX.value) / s + centerX,
          (e.y - centerY - offsetY.value) / s + centerY,
        );
      });

    return Gesture.Race(Gesture.Simultaneous(pinch, pan), tap);
  }, [
    handleTap,
    centerX,
    centerY,
    pixelWidth,
    pixelHeight,
    scale,
    offsetX,
    offsetY,
    pinching,
    pinchAnchor,
    blockTapsUntil,
  ]);

  const zoomBy = useCallback(
    (factor: number) => {
      const s0 = scale.value;
      const s1 = clampZoom(s0 * factor);
      const k = s1 / s0;
      const timing = { duration: config.zoom.buttonAnimMs };
      scale.value = withTiming(s1, timing);
      offsetX.value = withTiming(clampOffset(offsetX.value * k, s1, pixelWidth), timing);
      offsetY.value = withTiming(clampOffset(offsetY.value * k, s1, pixelHeight), timing);
    },
    [scale, offsetX, offsetY, pixelWidth, pixelHeight],
  );

  const resetZoom = useCallback(() => {
    const timing = { duration: config.zoom.buttonAnimMs };
    scale.value = withTiming(1, timing);
    offsetX.value = withTiming(0, timing);
    offsetY.value = withTiming(0, timing);
  }, [scale, offsetX, offsetY]);

  const canZoomOut = zoomPercent > 100;
  const canZoomIn = zoomPercent < Math.round(MAX_ZOOM * 100);

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
    if (!showGridDots) return dots;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (mask && !mask[y * width + x]) continue;
        if (tipCells.has(`${x},${y}`)) continue;
        dots.push({
          x: x * cellSize + cellSize / 2,
          y: y * cellSize + cellSize / 2,
        });
      }
    }
    return dots;
  }, [showGridDots, width, height, mask, cellSize, tipCells]);

  const dotColor = `rgba(23, 35, 63, ${config.board.dotOpacity})`;

  return (
    <View style={styles.container}>
      <View style={[styles.board, { width: pixelWidth, height: pixelHeight }]}>
        <GestureDetector gesture={boardGesture}>
          <View>
            <Canvas style={{ width: pixelWidth, height: pixelHeight }}>
              <Group transform={viewTransform}>
                <RoundedRect
                  x={edgeInset}
                  y={edgeInset}
                  width={edgeWidth}
                  height={edgeHeight}
                  r={edgeRadius}
                  color={colors.boardEdge}
                  style="stroke"
                  strokeWidth={edgeStroke}
                  opacity={edgeOpacity}
                />
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
                    board={board}
                    isHint={hintArrowId === arrow.id}
                    isShaking={shakingArrowId === arrow.id}
                    isEscaping={escapingArrowId === arrow.id}
                    onEscapeDone={onEscapeDone}
                    onShakeDone={onShakeDone}
                  />
                ))}
              </Group>
            </Canvas>
          </View>
        </GestureDetector>
      </View>

      <View style={styles.zoomBar}>
        <Pressable
          style={[styles.zoomBtn, !canZoomOut && styles.zoomDisabled]}
          onPress={() => zoomBy(1 / config.zoom.buttonStep)}
          disabled={!canZoomOut}
          hitSlop={6}
          accessibilityLabel="Zoom out"
        >
          <Text style={styles.zoomBtnText}>−</Text>
        </Pressable>
        <Pressable
          style={[styles.zoomLabelBtn, !canZoomOut && styles.zoomDisabled]}
          onPress={resetZoom}
          disabled={!canZoomOut}
          hitSlop={6}
          accessibilityLabel="Reset zoom"
        >
          <Text style={styles.zoomLabel}>{zoomPercent}%</Text>
        </Pressable>
        <Pressable
          style={[styles.zoomBtn, !canZoomIn && styles.zoomDisabled]}
          onPress={() => zoomBy(config.zoom.buttonStep)}
          disabled={!canZoomIn}
          hitSlop={6}
          accessibilityLabel="Zoom in"
        >
          <Text style={styles.zoomBtnText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  board: {
    backgroundColor: 'transparent',
    borderRadius: BOARD_RADIUS,
    overflow: 'hidden',
  },
  zoomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: config.zoom.barHeight,
  },
  zoomBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
  },
  zoomLabelBtn: {
    minWidth: 64,
    height: 40,
    paddingHorizontal: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
  },
  zoomDisabled: {
    opacity: 0.4,
  },
  zoomBtnText: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.navy,
  },
  zoomLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.navy,
  },
});
