import React, { useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import type { Cell } from '../game/types';
import { colors } from '../theme';
import { arrowHeadSize, arrowStrokeWidth, buildStaticGraphics } from './arrowGraphics';

interface GeneratorBoardProps {
  width: number;
  height: number;
  mask: boolean[];
  arrows: Cell[][] | null;
  cellSize: number;
  /** When set, tapping/dragging paints cells: the first cell touched decides on or off. */
  onPaint?: (index: number, value: boolean) => void;
}

const CELL_GAP = 0.08;

export function GeneratorBoard({ width, height, mask, arrows, cellSize, onPaint }: GeneratorBoardProps) {
  const pixelWidth = width * cellSize;
  const pixelHeight = height * cellSize;

  const cells = useMemo(() => {
    const on = Skia.Path.Make();
    const off = Skia.Path.Make();
    const inset = cellSize * CELL_GAP;
    const size = cellSize - inset * 2;
    const radius = cellSize * 0.18;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const rect = Skia.XYWHRect(x * cellSize + inset, y * cellSize + inset, size, size);
        (mask[y * width + x] ? on : off).addRRect(Skia.RRectXY(rect, radius, radius));
      }
    }
    return { on, off };
  }, [width, height, mask, cellSize]);

  const arrowGfx = useMemo(() => {
    if (!arrows) return null;
    const headSize = arrowHeadSize(cellSize);
    const body = Skia.Path.Make();
    const fill = Skia.Path.Make();
    for (const path of arrows) {
      const gfx = buildStaticGraphics({ path }, cellSize, headSize);
      body.addPath(gfx.body);
      fill.addPath(gfx.head);
      if (gfx.tail) fill.addCircle(gfx.tail.x, gfx.tail.y, arrowStrokeWidth(cellSize) / 2);
    }
    return { body, fill };
  }, [arrows, cellSize]);

  const maskRef = useRef(mask);
  maskRef.current = mask;
  const onPaintRef = useRef(onPaint);
  onPaintRef.current = onPaint;
  const stroke = useRef({ value: true, last: -1 });

  const paintGesture = useMemo(() => {
    const cellAt = (px: number, py: number) => {
      const x = Math.floor(px / cellSize);
      const y = Math.floor(py / cellSize);
      if (x < 0 || y < 0 || x >= width || y >= height) return -1;
      return y * width + x;
    };
    return Gesture.Pan()
      .runOnJS(true)
      .minDistance(0)
      .onBegin((e) => {
        const idx = cellAt(e.x, e.y);
        if (idx < 0) return;
        stroke.current = { value: !maskRef.current[idx], last: idx };
        onPaintRef.current?.(idx, stroke.current.value);
      })
      .onUpdate((e) => {
        const idx = cellAt(e.x, e.y);
        if (idx < 0 || idx === stroke.current.last) return;
        stroke.current.last = idx;
        onPaintRef.current?.(idx, stroke.current.value);
      });
  }, [cellSize, width, height]);

  const canvas = (
    <Canvas style={{ width: pixelWidth, height: pixelHeight }}>
      {onPaint ? (
        <Path path={cells.off} color={colors.border} style="stroke" strokeWidth={1} />
      ) : null}
      <Path path={cells.on} color={colors.cellOn} />
      {arrowGfx ? (
        <>
          <Path
            path={arrowGfx.body}
            color={colors.navy}
            style="stroke"
            strokeWidth={arrowStrokeWidth(cellSize)}
            strokeCap="butt"
            strokeJoin="round"
          />
          <Path path={arrowGfx.fill} color={colors.navy} />
        </>
      ) : null}
    </Canvas>
  );

  return (
    <View style={[styles.board, { width: pixelWidth, height: pixelHeight }]}>
      {onPaint ? (
        <GestureDetector gesture={paintGesture}>
          <View>{canvas}</View>
        </GestureDetector>
      ) : (
        canvas
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  board: {
    borderRadius: 12,
    overflow: 'hidden',
  },
});
