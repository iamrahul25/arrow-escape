import React, { useEffect, useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { GeneratorBoard, type BoardImageOverlay } from '../components/GeneratorBoard';
import { Header } from '../components/Header';
import { ImageCropModal } from '../components/ImageCropModal';
import { levelFileName, toLevelFile } from '../generator/export';
import { decodeImage, imageAspect, imageRegion } from '../generator/imageMask';
import { SHAPES } from '../generator/shapes';
import { levelFromFile } from '../levels/format';
import { useGameStore } from '../store/gameStore';
import Slider from '@react-native-community/slider';
import {
  activeMask,
  GRID_MAX,
  GRID_MIN,
  PLACEMENT_MIN,
  placementLimits,
  useGeneratorStore,
} from '../store/generatorStore';
import { colors, spacing } from '../theme';
import { pickImage } from '../utils/pickImage';
import { saveJsonFile } from '../utils/saveJson';

const WIDE_LAYOUT = 900;
const SIDE_PANEL = 400;

function Stepper({
  label,
  value,
  onChange,
  step = 1,
  format = String,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  format?: (value: number) => string;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.stepper}>
        <Pressable style={styles.stepBtn} onPress={() => onChange(value - step)} hitSlop={6}>
          <Text style={styles.stepText}>−</Text>
        </Pressable>
        <Text style={styles.stepValue}>{format(value)}</Text>
        <Pressable style={styles.stepBtn} onPress={() => onChange(value + step)} hitSlop={6}>
          <Text style={styles.stepText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.blue, false: colors.border }} />
    </View>
  );
}

function Button({
  label,
  onPress,
  variant = 'secondary',
  disabled,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'accent' | 'danger';
  disabled?: boolean;
}) {
  return (
    <Pressable
      style={[styles.btn, styles[`btn_${variant}`], disabled && styles.btnDisabled]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={[styles.btnText, variant !== 'secondary' && styles.btnTextLight]}>{label}</Text>
    </Pressable>
  );
}

function SizeSlider({
  label,
  value,
  onChange,
  onCommit,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  onCommit: (value: number) => void;
}) {
  const [live, setLive] = useState(value);
  useEffect(() => setLive(value), [value]);

  return (
    <View style={styles.sliderRow}>
      <Text style={styles.sliderLabel}>{label}</Text>
      <Slider
        style={styles.slider}
        minimumValue={GRID_MIN}
        maximumValue={GRID_MAX}
        step={1}
        value={value}
        minimumTrackTintColor={colors.blue}
        maximumTrackTintColor={colors.border}
        thumbTintColor={colors.blue}
        onValueChange={(v) => {
          setLive(v);
          onChange(v);
        }}
        onSlidingComplete={onCommit}
      />
      <Text style={styles.sliderValue}>{live}</Text>
    </View>
  );
}

/** Slider that applies every change immediately. */
function LiveSlider({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <View style={styles.sliderRow}>
      <Text style={styles.sliderLabel}>{label}</Text>
      <Slider
        style={styles.slider}
        minimumValue={min}
        maximumValue={max}
        step={1}
        value={value}
        minimumTrackTintColor={colors.blue}
        maximumTrackTintColor={colors.border}
        thumbTintColor={colors.blue}
        onValueChange={onChange}
      />
      <Text style={styles.sliderValue}>{Math.round(value)}</Text>
    </View>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, color ? { color } : null]}>{value}</Text>
    </View>
  );
}

export function GeneratorScreen() {
  const window = useWindowDimensions();
  const wide = window.width >= WIDE_LAYOUT;
  const setScreen = useGameStore((s) => s.setScreen);
  const startPlaytest = useGameStore((s) => s.startPlaytest);
  const g = useGeneratorStore();

  const [widthText, setWidthText] = useState(String(g.width));
  const [heightText, setHeightText] = useState(String(g.height));
  const [seedText, setSeedText] = useState(String(g.seed));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [boardMode, setBoardMode] = useState<'place' | 'paint'>('place');

  useEffect(() => setSeedText(String(g.seed)), [g.seed]);
  useEffect(() => {
    setWidthText(String(g.width));
    setHeightText(String(g.height));
  }, [g.width, g.height]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 2500);
    return () => clearTimeout(t);
  }, [notice]);

  const mask = useMemo(
    () => activeMask(g),
    [g.customShape, g.customMask, g.width, g.height],
  );
  const result = g.result;

  const imageActive = g.customShape && g.shape === 'image' && g.image !== null;
  const imageGeom = useMemo(
    () =>
      g.image
        ? { aspect: imageAspect(g.image, g.imageSettings), region: imageRegion(g.image, g.imageSettings) }
        : null,
    [g.image, g.imageSettings],
  );
  const placing = imageActive && boardMode === 'place';
  const overlay: BoardImageOverlay | null =
    placing && g.image && imageGeom
      ? { uri: g.image.uri, region: imageGeom.region, aspect: imageGeom.aspect, placement: g.placement }
      : null;
  const limits = imageGeom ? placementLimits(imageGeom.aspect, g.width, g.height, g.placement.width) : null;

  const levelFile = useMemo(() => {
    if (!result) return null;
    return toLevelFile(result.level, {
      level: g.levelNumber,
      name: g.levelName.trim() || 'Generated Level',
      hintQuota: g.hintQuota,
      shape: result.shape,
      minLength: result.minLength,
      maxLength: result.maxLength,
      turnChance: result.turnChance,
    });
  }, [result, g.levelNumber, g.levelName, g.hintQuota]);
  const json = useMemo(() => (levelFile ? JSON.stringify(levelFile, null, 2) : ''), [levelFile]);

  const boardMaxW = wide ? Math.min(window.width - SIDE_PANEL - spacing.xl * 2, 760) : window.width - spacing.xl;
  const boardMaxH = wide ? window.height - 120 : window.height * 0.55;
  const cellSize = Math.min(boardMaxW / g.width, boardMaxH / g.height);

  const onCreate = () => {
    g.setGridSize(Number(widthText), Number(heightText));
    const { width, height } = useGeneratorStore.getState();
    setWidthText(String(width));
    setHeightText(String(height));
  };

  const onSlide = (width: number, height: number) => {
    g.setGridSize(width, height);
    const s = useGeneratorStore.getState();
    setWidthText(String(s.width));
    setHeightText(String(s.height));
  };

  const onPickImage = async () => {
    setImageError(null);
    setPicking(true);
    try {
      const picked = await pickImage();
      if (picked) {
        g.setImage(decodeImage(picked.base64, picked.name, picked.uri));
        setBoardMode('place');
        setCropOpen(true);
      }
    } catch (err) {
      setImageError((err as Error).message);
    } finally {
      setPicking(false);
    }
  };

  const onGenerate = () => {
    setBusy(true);
    // Let the "Generating…" label paint before the synchronous generator runs.
    setTimeout(() => {
      g.generate();
      setBusy(false);
    }, 16);
  };

  const onCopy = async () => {
    await Clipboard.setStringAsync(json);
    setNotice('Level JSON copied to clipboard');
  };

  const onDownload = async () => {
    try {
      await saveJsonFile(levelFileName(g.levelNumber), json);
      setNotice(`Saved ${levelFileName(g.levelNumber)}`);
    } catch (err) {
      setNotice((err as Error).message);
    }
  };

  const onPlay = () => {
    if (levelFile) startPlaytest(levelFromFile(levelFile));
  };

  const board = (
    <View style={styles.boardWrap}>
      <GeneratorBoard
        width={g.width}
        height={g.height}
        mask={mask}
        arrows={result?.level.arrows ?? null}
        cellSize={cellSize}
        onPaint={g.customShape && !placing ? g.paintCell : undefined}
        overlay={overlay}
      />
    </View>
  );

  const panel = (
    <View style={styles.panel}>
      <Button
        label={busy ? 'Generating…' : 'Generate Level'}
        variant="accent"
        onPress={onGenerate}
        disabled={busy}
      />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Grid Size</Text>
        <View style={styles.sizeRow}>
          <TextInput
            style={[styles.input, styles.sizeInput]}
            value={widthText}
            onChangeText={setWidthText}
            onSubmitEditing={onCreate}
            keyboardType="number-pad"
            selectTextOnFocus
          />
          <Text style={styles.times}>×</Text>
          <TextInput
            style={[styles.input, styles.sizeInput]}
            value={heightText}
            onChangeText={setHeightText}
            onSubmitEditing={onCreate}
            keyboardType="number-pad"
            selectTextOnFocus
          />
          <Pressable style={styles.createBtn} onPress={onCreate}>
            <Text style={styles.btnText}>Create</Text>
          </Pressable>
        </View>
        <SizeSlider
          label="Width"
          value={g.width}
          onChange={(v) => setWidthText(String(v))}
          onCommit={(v) => onSlide(v, g.height)}
        />
        <SizeSlider
          label="Height"
          value={g.height}
          onChange={(v) => setHeightText(String(v))}
          onCommit={(v) => onSlide(g.width, v)}
        />
        {imageActive ? (
          <>
            <Toggle label="Lock ratio" value={g.lockRatio} onChange={g.setLockRatio} />
            <Text style={styles.help}>
              {g.lockRatio
                ? 'Width and height change together and the image scales with the grid.'
                : 'Resizing only adds or removes rows and columns; the image keeps its size.'}
            </Text>
          </>
        ) : null}
      </View>

      <View style={styles.section}>
        <View style={styles.row}>
          <Text style={styles.sectionTitle}>Custom Shape</Text>
          <Switch
            value={g.customShape}
            onValueChange={g.setCustomShape}
            trackColor={{ true: colors.blue, false: colors.border }}
          />
        </View>
        {g.customShape ? (
          <>
            <Text style={styles.help}>Tap or drag on the board to turn cells on or off.</Text>
            <View style={styles.chips}>
              {SHAPES.map((shape) => (
                <Pressable
                  key={shape.id}
                  style={[styles.chip, g.shape === shape.id && styles.chipActive]}
                  onPress={() => g.applyShape(shape.id)}
                >
                  <Text style={[styles.chipText, g.shape === shape.id && styles.chipTextActive]}>
                    {shape.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.buttonRow}>
              <Button label="Fill All" onPress={() => g.fillMask(true)} />
              <Button label="Invert" onPress={g.invertMask} />
              <Button label="Clear All" variant="danger" onPress={() => g.fillMask(false)} />
            </View>

            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={styles.subTitle}>From Image</Text>
              {g.image ? (
                <Pressable onPress={g.clearImage} hitSlop={6}>
                  <Text style={styles.link}>Remove</Text>
                </Pressable>
              ) : null}
            </View>
            <Text style={styles.help}>
              Use a flat black-and-white image: black becomes grid, white stays empty.
            </Text>
            {g.image ? (
              <View style={styles.imageRow}>
                <Image source={{ uri: g.image.uri }} style={styles.imagePreview} resizeMode="contain" />
                <View style={styles.imageInfo}>
                  <Text style={styles.label} numberOfLines={1}>
                    {g.image.name}
                  </Text>
                  <Text style={styles.help}>
                    {g.shape === 'image'
                      ? 'Applied. Resizing the grid rebuilds the mask from the image.'
                      : 'Not applied to the board.'}
                  </Text>
                </View>
              </View>
            ) : null}
            <View style={styles.buttonRow}>
              <Button
                label={picking ? 'Loading…' : g.image ? 'Change Image' : 'Choose Image'}
                onPress={onPickImage}
                disabled={picking}
              />
              {g.image ? <Button label="Edit Crop" onPress={() => setCropOpen(true)} /> : null}
              {g.image && g.shape !== 'image' ? (
                <Button label="Use Image" variant="primary" onPress={g.applyImage} />
              ) : null}
            </View>
            {imageError ? <Text style={styles.error}>{imageError}</Text> : null}
            {imageActive && limits ? (
              <>
                <View style={styles.chips}>
                  {(['place', 'paint'] as const).map((mode) => (
                    <Pressable
                      key={mode}
                      style={[styles.chip, boardMode === mode && styles.chipActive]}
                      onPress={() => setBoardMode(mode)}
                    >
                      <Text style={[styles.chipText, boardMode === mode && styles.chipTextActive]}>
                        {mode === 'place' ? 'Place image' : 'Paint cells'}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.help}>
                  {placing
                    ? 'Move and size the image on the grid. Hand-painted cells are replaced when the image changes.'
                    : 'Tap or drag on the board to touch up cells.'}
                </Text>
                {placing ? (
                  <>
                    <LiveSlider
                      label="Size"
                      value={g.placement.width}
                      min={PLACEMENT_MIN}
                      max={limits.maxWidth}
                      onChange={(width) => g.placeImage({ width })}
                    />
                    <LiveSlider
                      label="X"
                      value={g.placement.x}
                      min={limits.minX}
                      max={limits.maxX}
                      onChange={(x) => g.placeImage({ x })}
                    />
                    <LiveSlider
                      label="Y"
                      value={g.placement.y}
                      min={limits.minY}
                      max={limits.maxY}
                      onChange={(y) => g.placeImage({ y })}
                    />
                    <View style={styles.buttonRow}>
                      <Button label="Fit" onPress={g.fitImage} />
                      <Button label="Center" onPress={g.centerImage} />
                    </View>
                  </>
                ) : null}
              </>
            ) : null}
            {g.image ? (
              <>
                <Toggle
                  label="Invert"
                  value={g.imageSettings.invert}
                  onChange={(invert) => g.updateImage({ invert })}
                />
                <Toggle
                  label="Trim blank border"
                  value={g.imageSettings.trim}
                  onChange={(trim) => g.updateImage({ trim })}
                />
                <Stepper
                  label="Cell coverage"
                  value={g.imageSettings.coverage}
                  step={0.05}
                  format={(v) => `${Math.round(v * 100)}%`}
                  onChange={(coverage) => g.updateImage({ coverage })}
                />
                <Text style={styles.help}>
                  A cell becomes grid when at least this much of it is{' '}
                  {g.imageSettings.invert ? 'white' : 'black'}.
                </Text>
              </>
            ) : null}
          </>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Generator Settings</Text>
        <Stepper label="Min arrow length" value={g.minLength} onChange={(v) => g.update({ minLength: v })} />
        <Stepper label="Max arrow length" value={g.maxLength} onChange={(v) => g.update({ maxLength: v })} />
        <Stepper
          label="Turn chance"
          value={g.turnChance}
          step={0.05}
          format={(v) => `${Math.round(v * 100)}%`}
          onChange={(v) => g.update({ turnChance: v })}
        />
        <View style={styles.row}>
          <Text style={styles.label}>Seed</Text>
          <TextInput
            style={[styles.input, styles.seedInput]}
            value={seedText}
            onChangeText={setSeedText}
            onEndEditing={() => g.setSeed(Number(seedText))}
            onSubmitEditing={() => g.setSeed(Number(seedText))}
            keyboardType="number-pad"
            selectTextOnFocus
          />
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Lock seed</Text>
          <Switch
            value={g.lockSeed}
            onValueChange={g.setLockSeed}
            trackColor={{ true: colors.blue, false: colors.border }}
          />
        </View>
        <Text style={styles.help}>
          {g.lockSeed
            ? 'Generate rebuilds the same level from this seed.'
            : 'Each Generate uses a new random seed.'}
        </Text>
      </View>

      <View style={styles.section}>
        <Stat label="Total arrows" value={result ? String(result.level.stats.arrowCount) : '—'} />
        <Stat
          label="Status"
          value={g.error ? 'Failed' : result ? 'Solvable' : 'Not generated'}
          color={g.error ? colors.blocked : result ? colors.success : colors.muted}
        />
        {result ? (
          <>
            <Stat
              label="Coverage"
              value={`${(result.level.stats.coverage * 100).toFixed(1)}% (${result.level.stats.emptyCells} empty)`}
            />
            <Stat label="Free at start" value={String(result.level.stats.initialAvailable)} />
            <Stat label="Solve depth" value={String(result.level.stats.solveDepth)} />
            <Stat label="Bends" value={String(result.level.stats.bendCount)} />
            <Stat label="Time" value={`${result.level.stats.durationMs} ms`} />
          </>
        ) : null}
        {g.error ? <Text style={styles.error}>{g.error}</Text> : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Export</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Level #</Text>
          <TextInput
            style={[styles.input, styles.seedInput]}
            value={String(g.levelNumber)}
            onChangeText={(t) => g.update({ levelNumber: Number(t) })}
            keyboardType="number-pad"
            selectTextOnFocus
          />
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Name</Text>
          <TextInput
            style={[styles.input, styles.nameInput]}
            value={g.levelName}
            onChangeText={(t) => g.update({ levelName: t })}
          />
        </View>
        <Stepper label="Hints" value={g.hintQuota} onChange={(v) => g.update({ hintQuota: v })} />
        <View style={styles.buttonRow}>
          <Button label="Copy JSON" onPress={onCopy} disabled={!levelFile} />
          <Button label="Download" onPress={onDownload} disabled={!levelFile} />
          <Button label="▶ Play Test" variant="primary" onPress={onPlay} disabled={!levelFile} />
        </View>
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <Header title="Level Generator" onBack={() => setScreen('home')} />
      {wide ? (
        <View style={[styles.content, styles.contentWide]}>
          {board}
          <ScrollView style={styles.panelScroll} contentContainerStyle={styles.panelScrollContent}>
            {panel}
          </ScrollView>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {board}
          {panel}
        </ScrollView>
      )}
      {g.image ? (
        <ImageCropModal
          visible={cropOpen}
          uri={g.image.uri}
          aspect={g.image.width / g.image.height}
          crop={g.imageSettings.crop}
          onCancel={() => setCropOpen(false)}
          onApply={(crop) => {
            g.updateImage({ crop });
            setCropOpen(false);
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    gap: spacing.md,
  },
  contentWide: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingBottom: 0,
  },
  panelScroll: {
    alignSelf: 'stretch',
    width: SIDE_PANEL,
    flexGrow: 0,
  },
  panelScrollContent: {
    paddingBottom: spacing.md,
  },
  boardWrap: {
    alignItems: 'center',
  },
  panel: {
    gap: spacing.md,
    width: '100%',
    maxWidth: SIDE_PANEL,
    alignSelf: 'center',
  },
  section: {
    backgroundColor: colors.panel,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.navy,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  label: {
    fontSize: 15,
    color: colors.navy,
    fontWeight: '600',
  },
  help: {
    fontSize: 13,
    color: colors.muted,
  },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    fontSize: 15,
    color: colors.navy,
    textAlign: 'center',
  },
  sizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sizeInput: {
    flex: 1,
    minWidth: 0,
    width: 0,
  },
  createBtn: {
    flexShrink: 0,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sliderLabel: {
    width: 52,
    fontSize: 14,
    fontWeight: '600',
    color: colors.navy,
  },
  slider: {
    flex: 1,
    height: 32,
  },
  sliderValue: {
    width: 32,
    textAlign: 'right',
    fontSize: 14,
    fontWeight: '700',
    color: colors.navy,
  },
  seedInput: {
    width: 140,
  },
  nameInput: {
    flex: 1,
    marginLeft: spacing.md,
    textAlign: 'left',
  },
  times: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.navy,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.navy,
  },
  stepValue: {
    minWidth: 44,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
    color: colors.navy,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.navy,
    borderColor: colors.navy,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.navy,
  },
  chipTextActive: {
    color: colors.white,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  subTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.navy,
  },
  link: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.blocked,
  },
  imageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  imagePreview: {
    width: 64,
    height: 64,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  imageInfo: {
    flex: 1,
    gap: 2,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  btn: {
    flexGrow: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btn_secondary: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btn_primary: {
    backgroundColor: colors.blue,
  },
  btn_accent: {
    backgroundColor: colors.hint,
    paddingVertical: 16,
  },
  btn_danger: {
    backgroundColor: colors.blocked,
  },
  btnDisabled: {
    opacity: 0.4,
  },
  btnText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.navy,
  },
  btnTextLight: {
    color: colors.white,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statLabel: {
    fontSize: 15,
    color: colors.muted,
    fontWeight: '600',
  },
  statValue: {
    fontSize: 15,
    color: colors.navy,
    fontWeight: '700',
  },
  error: {
    fontSize: 13,
    color: colors.blocked,
  },
  notice: {
    fontSize: 13,
    color: colors.success,
    fontWeight: '600',
    textAlign: 'center',
  },
});
