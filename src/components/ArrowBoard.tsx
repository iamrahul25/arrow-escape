import React, { useCallback, useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Canvas,
  Group,
  Line,
  Path,
  Skia,
  vec,
} from '@shopify/react-native-skia';
import {
  useSharedValue,
  withSequence,
  withTiming,
  useDerivedValue,
  Easing,
  cancelAnimation,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { getArrowCells, getArrowTip, directionToAngle } from '../game/geometry';
import type { Arrow, Direction } from '../game/types';
import { colors } from '../theme';
import { DIRECTION_DELTA } from '../game/directions';

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

function buildArrowPath(arrow: Arrow, cellSize: number, headSize: number) {
  const cells = getArrowCells(arrow);
  const tip = getArrowTip(arrow);
  const start = cells[0];

  const sx = start.x * cellSize + cellSize / 2;
  const sy = start.y * cellSize + cellSize / 2;
  const tx = tip.x * cellSize + cellSize / 2;
  const ty = tip.y * cellSize + cellSize / 2;

  const angle = directionToAngle(arrow.direction);
  const hx = tx - Math.cos(angle) * headSize * 0.35;
  const hy = ty - Math.sin(angle) * headSize * 0.35;

  const body = Skia.Path.Make();
  body.moveTo(sx, sy);
  body.lineTo(hx, hy);

  const head = Skia.Path.Make();
  const left = angle + Math.PI * 0.82;
  const right = angle - Math.PI * 0.82;
  head.moveTo(tx, ty);
  head.lineTo(tx + Math.cos(left) * headSize, ty + Math.sin(left) * headSize);
  head.lineTo(tx + Math.cos(right) * headSize, ty + Math.sin(right) * headSize);
  head.close();

  return { body, head };
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
  const escapeProgress = useSharedValue(0);
  const opacity = useSharedValue(1);

  const delta = DIRECTION_DELTA[arrow.direction as Direction];
  const travel = (gridSize + arrow.length) * cellSize;

  useEffect(() => {
    if (!isShaking) return;
    shakeX.value = withSequence(
      withTiming(-6, { duration: 40 }),
      withTiming(6, { duration: 40 }),
      withTiming(-4, { duration: 40 }),
      withTiming(4, { duration: 40 }),
      withTiming(0, { duration: 40 }),
    );
    const t = setTimeout(onShakeDone, 220);
    return () => clearTimeout(t);
  }, [isShaking, onShakeDone, shakeX]);

  useEffect(() => {
    if (!isEscaping) return;
    escapeProgress.value = 0;
    opacity.value = 1;
    escapeProgress.value = withTiming(1, {
      duration: 420,
      easing: Easing.out(Easing.cubic),
    });
    opacity.value = withTiming(0, { duration: 420 });
    const t = setTimeout(onEscapeDone, 430);
    return () => {
      clearTimeout(t);
      cancelAnimation(escapeProgress);
      cancelAnimation(opacity);
    };
  }, [isEscaping, escapeProgress, opacity, onEscapeDone]);

  const color = isHint ? colors.hint : isShaking ? colors.blocked : colors.navy;

  const transform = useDerivedValue(() => {
    return [
      {
        translateX:
          shakeX.value + (isEscaping ? escapeProgress.value * delta.x * travel : 0),
      },
      {
        translateY: isEscaping ? escapeProgress.value * delta.y * travel : 0,
      },
    ];
  });

  const skiaOpacity = useDerivedValue(() => {
    return isEscaping ? opacity.value : 1;
  });

  const headSize = cellSize * 0.42;
  const { body, head } = useMemo(
    () => buildArrowPath(arrow, cellSize, headSize),
    [arrow, cellSize, headSize],
  );
  const strokeWidth = Math.max(4, cellSize * 0.18);

  return (
    <Group opacity={skiaOpacity} transform={transform}>
      <Path
        path={body}
        color={color}
        style="stroke"
        strokeWidth={strokeWidth}
        strokeCap="round"
        strokeJoin="round"
      />
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
        const cells = getArrowCells(arrow);
        if (cells.some((c) => c.x === gx && c.y === gy)) {
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

  const gridLines = useMemo(() => {
    const lines: { p1: { x: number; y: number }; p2: { x: number; y: number } }[] = [];
    for (let i = 0; i <= gridSize; i++) {
      const p = i * cellSize;
      lines.push({ p1: { x: p, y: 0 }, p2: { x: p, y: boardSize } });
      lines.push({ p1: { x: 0, y: p }, p2: { x: boardSize, y: p } });
    }
    return lines;
  }, [gridSize, cellSize, boardSize]);

  return (
    <View style={[styles.board, { width: boardSize, height: boardSize }]}>
      <GestureDetector gesture={tapGesture}>
        <Canvas style={{ width: boardSize, height: boardSize }}>
          {gridLines.map((line, idx) => (
            <Line
              key={idx}
              p1={vec(line.p1.x, line.p1.y)}
              p2={vec(line.p2.x, line.p2.y)}
              color="rgba(23, 35, 63, 0.04)"
              strokeWidth={1}
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
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  board: {
    backgroundColor: colors.panel,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
});
