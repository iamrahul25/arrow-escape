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
import { getNextLevelId } from '../levels';
import { useGameStore } from '../store/gameStore';
import { colors, spacing } from '../theme';
import { config } from '../config';

export function GameScreen() {
  const { width, height } = useWindowDimensions();
  const snapshot = useGameStore((s) => s.snapshot);
  const level = useGameStore((s) => s.level);
  const playtest = useGameStore((s) => s.playtest);
  const exitGame = useGameStore((s) => s.exitGame);
  const elapsedSeconds = useGameStore((s) => s.elapsedSeconds);
  const shakingArrowId = useGameStore((s) => s.shakingArrowId);
  const escapingArrowId = useGameStore((s) => s.escapingArrowId);
  const tapArrow = useGameStore((s) => s.tapArrow);
  const useHint = useGameStore((s) => s.useHint);
  const autoMove = useGameStore((s) => s.autoMove);
  const autoPending = useGameStore((s) => s.autoPending);
  const developerMode = useGameStore((s) => s.progress.settings.developerMode);
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

  if (!snapshot || !level) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.loading}>Loading…</Text>
      </SafeAreaView>
    );
  }

  const cellSize = Math.min(
    (width - config.board.horizontalInset) / level.width,
    (height * config.board.maxHeightFraction) / level.height,
  );
  const remaining = snapshot.arrows.filter((a) => a.active).length;
  const hasNext = playtest || getNextLevelId(level.suiteId, level.id) !== null;
  const showResult = snapshot.status === 'won' || snapshot.status === 'lost';
  const title = playtest ? 'Play Test' : `Level ${level.id}`;
  const hintsOut = !developerMode && snapshot.hints <= 0;
  const autoBusy = autoPending || escapingArrowId !== null || snapshot.status !== 'playing';

  return (
    <SafeAreaView style={styles.safe}>
      <Header
        title={title}
        onBack={exitGame}
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
          board={level}
          mask={level.mask}
          cellSize={cellSize}
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
          style={[styles.hintBtn, hintsOut && styles.hintDisabled]}
          onPress={() => useHint()}
          disabled={hintsOut || snapshot.status !== 'playing'}
        >
          <Text style={styles.hintText}>💡 {developerMode ? '∞' : snapshot.hints}</Text>
        </Pressable>
        {developerMode ? (
          <Pressable
            style={[styles.hintBtn, autoBusy && styles.hintDisabled]}
            onPress={autoMove}
            disabled={autoBusy}
          >
            <Text style={styles.hintText}>🤖 Auto</Text>
          </Pressable>
        ) : null}
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
        title={title}
        moves={snapshot.moves}
        seconds={elapsedSeconds}
        hasNext={hasNext}
        nextLabel={playtest ? 'Back to Generator' : 'Next Level'}
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
