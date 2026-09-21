import React, { useEffect } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowBoard } from '../components/ArrowBoard';
import { GameResult } from '../components/GameResult';
import { Header } from '../components/Header';
import { Lives } from '../components/Lives';
import { getNextLevelId, getLevel } from '../levels';
import { useGameStore } from '../store/gameStore';
import { colors, spacing } from '../theme';
import { config } from '../config';

export function GameScreen() {
  const { width, height } = useWindowDimensions();
  const snapshot = useGameStore((s) => s.snapshot);
  const elapsedSeconds = useGameStore((s) => s.elapsedSeconds);
  const shakingArrowId = useGameStore((s) => s.shakingArrowId);
  const escapingArrowId = useGameStore((s) => s.escapingArrowId);
  const tapArrow = useGameStore((s) => s.tapArrow);
  const useHint = useGameStore((s) => s.useHint);
  const restartLevel = useGameStore((s) => s.restartLevel);
  const setScreen = useGameStore((s) => s.setScreen);
  const clearTransient = useGameStore((s) => s.clearTransient);
  const tick = useGameStore((s) => s.tick);
  const completeAndAdvance = useGameStore((s) => s.completeAndAdvance);
  const pause = useGameStore((s) => s.pause);
  const resume = useGameStore((s) => s.resume);

  useEffect(() => {
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [tick]);

  if (!snapshot) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.loading}>Loading…</Text>
      </SafeAreaView>
    );
  }

  const level = getLevel(snapshot.levelId);
  const gridSize = level?.gridSize ?? 8;
  const boardSize = Math.min(
    width - config.board.horizontalInset,
    height * config.board.maxHeightFraction,
  );
  const remaining = snapshot.arrows.filter((a) => a.active).length;
  const hasNext = getNextLevelId(snapshot.levelId) !== null;
  const showResult = snapshot.status === 'won' || snapshot.status === 'lost';

  return (
    <SafeAreaView style={styles.safe}>
      <Header
        title={`Level ${snapshot.levelId}`}
        onBack={() => setScreen('levels')}
        onAction={() => {
          if (snapshot.status === 'paused') resume();
          else pause();
        }}
        actionLabel={snapshot.status === 'paused' ? '▶' : '⏸'}
      />

      <View style={styles.meta}>
        <Lives lives={snapshot.lives} />
        <Text style={styles.arrowCount}>{remaining} arrows</Text>
        <Text style={styles.moves}>↗ {snapshot.moves}</Text>
      </View>

      <View style={styles.boardWrap}>
        <ArrowBoard
          arrows={snapshot.arrows}
          gridSize={gridSize}
          boardSize={boardSize}
          hintArrowId={snapshot.hintArrowId}
          shakingArrowId={shakingArrowId}
          escapingArrowId={escapingArrowId}
          onTapArrow={(id) => {
            if (snapshot.status === 'playing') tapArrow(id);
          }}
          onEscapeDone={clearTransient}
          onShakeDone={clearTransient}
        />
      </View>

      <View style={styles.footer}>
        <Pressable
          style={[styles.hintBtn, snapshot.hints <= 0 && styles.hintDisabled]}
          onPress={() => useHint()}
          disabled={snapshot.hints <= 0 || snapshot.status !== 'playing'}
        >
          <Text style={styles.hintText}>💡 {snapshot.hints}</Text>
        </Pressable>
        <Pressable style={styles.restartBtn} onPress={restartLevel}>
          <Text style={styles.restartText}>↻</Text>
        </Pressable>
      </View>

      {snapshot.status === 'paused' ? (
        <View style={styles.pauseOverlay}>
          <Text style={styles.pauseTitle}>Paused</Text>
          <Pressable style={styles.resumeBtn} onPress={resume}>
            <Text style={styles.resumeText}>Resume</Text>
          </Pressable>
        </View>
      ) : null}

      <GameResult
        visible={showResult}
        won={snapshot.status === 'won'}
        levelId={snapshot.levelId}
        moves={snapshot.moves}
        seconds={elapsedSeconds}
        hasNext={hasNext}
        onNext={completeAndAdvance}
        onReplay={restartLevel}
        onHome={() => setScreen('home')}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loading: {
    marginTop: 40,
    textAlign: 'center',
    color: colors.muted,
  },
  meta: {
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  arrowCount: {
    fontSize: 16,
    color: colors.muted,
    fontWeight: '600',
  },
  moves: {
    fontSize: 15,
    color: colors.navy,
    fontWeight: '700',
  },
  boardWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.lg,
    paddingBottom: spacing.lg,
    paddingTop: spacing.md,
  },
  hintBtn: {
    backgroundColor: colors.panel,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  hintDisabled: {
    opacity: 0.4,
  },
  hintText: {
    fontSize: 18,
    color: colors.navy,
    fontWeight: '700',
  },
  restartBtn: {
    backgroundColor: colors.panel,
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  restartText: {
    fontSize: 22,
    color: colors.navy,
  },
  pauseOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255,255,255,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  pauseTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.navy,
    marginBottom: spacing.lg,
  },
  resumeBtn: {
    backgroundColor: colors.blue,
    paddingVertical: 14,
    paddingHorizontal: 36,
    borderRadius: 14,
  },
  resumeText: {
    color: colors.white,
    fontSize: 17,
    fontWeight: '700',
  },
});
