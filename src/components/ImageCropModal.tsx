import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { FULL_CROP, type CropRect } from '../generator/imageMask';
import { colors, spacing } from '../theme';

/** Smallest crop, as a fraction of the image side. */
const MIN_SIZE = 0.05;
/** How close (px) a touch must be to an edge to grab it. */
const EDGE_HIT = 22;
/** Touchable margin around the image so edges sitting on the image border can still be grabbed. */
const PAD = 16;
const HANDLE = 14;
const CROSS = 18;
const DOT = 6;

interface DragMode {
  left: boolean;
  right: boolean;
  top: boolean;
  bottom: boolean;
  move: boolean;
}

interface ImageCropModalProps {
  visible: boolean;
  uri: string;
  /** Image width ÷ height. */
  aspect: number;
  crop: CropRect;
  onCancel: () => void;
  onApply: (crop: CropRect) => void;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const pct = (v: number) => `${Math.round(v * 100)}%`;

/** Largest on-screen square that fits inside `c`, keeping its center (shifted back inside the image if needed). */
function toSquare(c: CropRect, aspect: number): CropRect {
  const side = Math.min((c.x1 - c.x0) * aspect, c.y1 - c.y0);
  const w = side / aspect;
  const x0 = clamp((c.x0 + c.x1) / 2 - w / 2, 0, 1 - w);
  const y0 = clamp((c.y0 + c.y1) / 2 - side / 2, 0, 1 - side);
  return { x0, y0, x1: x0 + w, y1: y0 + side };
}

function centered(c: CropRect): CropRect {
  const w = c.x1 - c.x0;
  const h = c.y1 - c.y0;
  return { x0: (1 - w) / 2, y0: (1 - h) / 2, x1: (1 + w) / 2, y1: (1 + h) / 2 };
}

/** Resize keeping the frame square in pixels. All values are in pixels of a `W`×`H` image. */
function squareResize(
  mode: DragMode,
  s: { l: number; t: number; r: number; b: number },
  dx: number,
  dy: number,
  W: number,
  H: number,
) {
  const minSide = MIN_SIZE * Math.min(W, H);
  const horiz = mode.left || mode.right;
  const vert = mode.top || mode.bottom;
  const w = mode.left ? s.r - (s.l + dx) : s.r + dx - s.l;
  const h = mode.top ? s.b - (s.t + dy) : s.b + dy - s.t;
  const ax = mode.left ? s.r : s.l;
  const ay = mode.top ? s.b : s.t;
  const roomX = mode.left ? ax : W - ax;
  const roomY = mode.top ? ay : H - ay;

  if (horiz && vert) {
    const side = clamp(Math.max(w, h), minSide, Math.min(roomX, roomY));
    const l = mode.left ? ax - side : ax;
    const t = mode.top ? ay - side : ay;
    return { l, t, r: l + side, b: t + side };
  }
  if (horiz) {
    const side = clamp(w, minSide, Math.min(roomX, H));
    const l = mode.left ? ax - side : ax;
    const t = clamp((s.t + s.b) / 2 - side / 2, 0, H - side);
    return { l, t, r: l + side, b: t + side };
  }
  const side = clamp(h, minSide, Math.min(roomY, W));
  const t = mode.top ? ay - side : ay;
  const l = clamp((s.l + s.r) / 2 - side / 2, 0, W - side);
  return { l, t, r: l + side, b: t + side };
}

export function ImageCropModal({ visible, uri, aspect, crop, onCancel, onApply }: ImageCropModalProps) {
  const window = useWindowDimensions();
  const [draft, setDraft] = useState(crop);
  const [squareLock, setSquareLock] = useState(false);
  const squareLockRef = useRef(squareLock);
  squareLockRef.current = squareLock;
  useEffect(() => {
    if (visible) setDraft(squareLockRef.current ? toSquare(crop, aspect) : crop);
  }, [visible, crop, aspect]);

  const toggleSquareLock = () => {
    const next = !squareLock;
    setSquareLock(next);
    if (next) setDraft((d) => toSquare(d, aspect));
  };
  const reset = () => setDraft(squareLock ? toSquare(FULL_CROP, aspect) : FULL_CROP);

  const maxW = Math.min(window.width - spacing.md * 4 - PAD * 2, 720);
  const maxH = window.height - 260;
  const boxW = Math.max(1, Math.min(maxW, maxH * aspect));
  const boxH = boxW / aspect;

  const draftRef = useRef(draft);
  draftRef.current = draft;
  const drag = useRef<{ mode: DragMode; start: CropRect } | null>(null);

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .minDistance(0)
        .onBegin((e) => {
          const c = draftRef.current;
          const x = e.x - PAD;
          const y = e.y - PAD;
          const l = c.x0 * boxW;
          const r = c.x1 * boxW;
          const t = c.y0 * boxH;
          const b = c.y1 * boxH;
          const nearX = x > l - EDGE_HIT && x < r + EDGE_HIT;
          const nearY = y > t - EDGE_HIT && y < b + EDGE_HIT;
          const mode: DragMode = {
            left: nearY && Math.abs(x - l) < EDGE_HIT,
            right: nearY && Math.abs(x - r) < EDGE_HIT,
            top: nearX && Math.abs(y - t) < EDGE_HIT,
            bottom: nearX && Math.abs(y - b) < EDGE_HIT,
            move: false,
          };
          if (mode.left && mode.right) {
            if (Math.abs(x - l) < Math.abs(x - r)) mode.right = false;
            else mode.left = false;
          }
          if (mode.top && mode.bottom) {
            if (Math.abs(y - t) < Math.abs(y - b)) mode.bottom = false;
            else mode.top = false;
          }
          mode.move =
            !mode.left && !mode.right && !mode.top && !mode.bottom && x > l && x < r && y > t && y < b;
          drag.current = { mode, start: c };
        })
        .onUpdate((e) => {
          const d = drag.current;
          if (!d) return;
          const { mode, start } = d;
          const dx = e.translationX / boxW;
          const dy = e.translationY / boxH;
          let { x0, y0, x1, y1 } = start;
          if (mode.move) {
            x0 = clamp(start.x0 + dx, 0, 1 - (start.x1 - start.x0));
            y0 = clamp(start.y0 + dy, 0, 1 - (start.y1 - start.y0));
            x1 = x0 + (start.x1 - start.x0);
            y1 = y0 + (start.y1 - start.y0);
          } else if (squareLockRef.current) {
            const px = squareResize(
              mode,
              { l: start.x0 * boxW, t: start.y0 * boxH, r: start.x1 * boxW, b: start.y1 * boxH },
              e.translationX,
              e.translationY,
              boxW,
              boxH,
            );
            x0 = px.l / boxW;
            y0 = px.t / boxH;
            x1 = px.r / boxW;
            y1 = px.b / boxH;
          } else {
            if (mode.left) x0 = clamp(start.x0 + dx, 0, x1 - MIN_SIZE);
            if (mode.right) x1 = clamp(start.x1 + dx, x0 + MIN_SIZE, 1);
            if (mode.top) y0 = clamp(start.y0 + dy, 0, y1 - MIN_SIZE);
            if (mode.bottom) y1 = clamp(start.y1 + dy, y0 + MIN_SIZE, 1);
          }
          setDraft({ x0, y0, x1, y1 });
        })
        .onFinalize(() => {
          drag.current = null;
        }),
    [boxW, boxH],
  );

  const l = draft.x0 * boxW;
  const r = draft.x1 * boxW;
  const t = draft.y0 * boxH;
  const b = draft.y1 * boxH;
  const handles = [
    [l, t],
    [(l + r) / 2, t],
    [r, t],
    [r, (t + b) / 2],
    [r, b],
    [(l + r) / 2, b],
    [l, b],
    [l, (t + b) / 2],
  ];
  const fw = r - l;
  const fh = b - t;
  const cx = (l + r) / 2;
  const cy = (t + b) / 2;
  const imageCenterX = boxW / 2;
  const imageCenterY = boxH / 2;
  const isCentered = Math.abs(cx - imageCenterX) < 1 && Math.abs(cy - imageCenterY) < 1;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <GestureHandlerRootView style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Crop Image</Text>
          <Text style={styles.help}>
            Drag the edges or corners to crop. Drag inside the frame to move it. The cross turns green when
            the frame is centered on the image (orange lines).
          </Text>
          <GestureDetector gesture={gesture}>
            <View style={styles.touchArea}>
              <View style={{ width: boxW, height: boxH }} pointerEvents="none">
                <Image source={{ uri }} style={{ width: boxW, height: boxH }} resizeMode="stretch" />
                <View style={[styles.shade, { left: 0, top: 0, width: boxW, height: t }]} />
                <View style={[styles.shade, { left: 0, top: b, width: boxW, height: boxH - b }]} />
                <View style={[styles.shade, { left: 0, top: t, width: l, height: b - t }]} />
                <View style={[styles.shade, { left: r, top: t, width: boxW - r, height: b - t }]} />
                {[1, 2].map((i) => (
                  <React.Fragment key={i}>
                    <View style={[styles.gridV, { left: l + (fw * i) / 3, top: t, height: fh }]} />
                    <View style={[styles.gridH, { top: t + (fh * i) / 3, left: l, width: fw }]} />
                  </React.Fragment>
                ))}
                <View style={[styles.imageCenterV, { left: imageCenterX - 0.5, height: boxH }]} />
                <View style={[styles.imageCenterH, { top: imageCenterY - 0.5, width: boxW }]} />
                <View style={[styles.frame, { left: l, top: t, width: fw, height: fh }]} />
                <View
                  style={[
                    styles.crossV,
                    isCentered && styles.crossCentered,
                    { left: cx - 1, top: cy - CROSS / 2 },
                  ]}
                />
                <View
                  style={[
                    styles.crossH,
                    isCentered && styles.crossCentered,
                    { left: cx - CROSS / 2, top: cy - 1 },
                  ]}
                />
                <View
                  style={[
                    styles.centerDot,
                    isCentered && styles.centerDotCentered,
                    { left: cx - DOT / 2, top: cy - DOT / 2 },
                  ]}
                />
                {handles.map(([hx, hy], i) => (
                  <View key={i} style={[styles.handle, { left: hx - HANDLE / 2, top: hy - HANDLE / 2 }]} />
                ))}
              </View>
            </View>
          </GestureDetector>
          <Text style={styles.info}>
            Left {pct(draft.x0)} · Right {pct(1 - draft.x1)} · Top {pct(draft.y0)} · Bottom {pct(1 - draft.y1)}
          </Text>
          <View style={styles.tools}>
            <Pressable
              style={[styles.toggle, squareLock && styles.toggleOn]}
              onPress={toggleSquareLock}
              accessibilityRole="switch"
              accessibilityState={{ checked: squareLock }}
            >
              <View style={[styles.checkbox, squareLock && styles.checkboxOn]}>
                {squareLock && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={[styles.toggleText, squareLock && styles.toggleTextOn]}>Lock square</Text>
            </Pressable>
            <Pressable
              style={[styles.toggle, isCentered && styles.toggleOn]}
              onPress={() => setDraft((d) => centered(d))}
            >
              <Text style={[styles.toggleText, isCentered && styles.toggleTextOn]}>
                {isCentered ? 'Centered ✓' : 'Center frame'}
              </Text>
            </Pressable>
          </View>
          <View style={styles.buttons}>
            <Pressable style={styles.btn} onPress={reset}>
              <Text style={styles.btnText}>Reset</Text>
            </Pressable>
            <Pressable style={styles.btn} onPress={onCancel}>
              <Text style={styles.btnText}>Cancel</Text>
            </Pressable>
            <Pressable style={[styles.btn, styles.btnPrimary]} onPress={() => onApply(draft)}>
              <Text style={[styles.btnText, styles.btnTextLight]}>Apply</Text>
            </Pressable>
          </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(23, 35, 63, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  card: {
    backgroundColor: colors.background,
    borderRadius: 18,
    padding: spacing.md,
    gap: spacing.sm,
    alignItems: 'center',
    maxWidth: '100%',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.navy,
  },
  help: {
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
  },
  touchArea: {
    padding: PAD,
  },
  shade: {
    position: 'absolute',
    backgroundColor: 'rgba(23, 35, 63, 0.6)',
  },
  frame: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: colors.blue,
  },
  handle: {
    position: 'absolute',
    width: HANDLE,
    height: HANDLE,
    borderRadius: 3,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.blue,
  },
  gridV: {
    position: 'absolute',
    width: 1,
    backgroundColor: 'rgba(21, 155, 239, 0.55)',
  },
  gridH: {
    position: 'absolute',
    height: 1,
    backgroundColor: 'rgba(21, 155, 239, 0.55)',
  },
  imageCenterV: {
    position: 'absolute',
    top: 0,
    width: 1,
    backgroundColor: 'rgba(255, 179, 0, 0.6)',
  },
  imageCenterH: {
    position: 'absolute',
    left: 0,
    height: 1,
    backgroundColor: 'rgba(255, 179, 0, 0.6)',
  },
  crossV: {
    position: 'absolute',
    width: 2,
    height: CROSS,
    backgroundColor: colors.blue,
  },
  crossH: {
    position: 'absolute',
    width: CROSS,
    height: 2,
    backgroundColor: colors.blue,
  },
  crossCentered: {
    backgroundColor: colors.success,
  },
  centerDot: {
    position: 'absolute',
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.blue,
  },
  centerDotCentered: {
    borderColor: colors.success,
  },
  info: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.navy,
  },
  tools: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignSelf: 'stretch',
  },
  toggle: {
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleOn: {
    backgroundColor: '#E6F4FD',
    borderColor: colors.blue,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.navy,
  },
  toggleTextOn: {
    color: colors.blue,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  checkboxOn: {
    borderColor: colors.blue,
    backgroundColor: colors.blue,
  },
  checkmark: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '900',
    lineHeight: 14,
  },
  buttons: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignSelf: 'stretch',
  },
  btn: {
    flexGrow: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnPrimary: {
    backgroundColor: colors.blue,
    borderColor: colors.blue,
  },
  btnText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.navy,
  },
  btnTextLight: {
    color: colors.white,
  },
});
