import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../theme';

interface GameResultProps {
  visible: boolean;
  won: boolean;
  levelId: number;
  moves: number;
  seconds: number;
  hasNext: boolean;
  onNext: () => void;
  onReplay: () => void;
  onHome: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function GameResult({
  visible,
  won,
  levelId,
  moves,
  seconds,
  hasNext,
  onNext,
  onReplay,
  onHome,
}: GameResultProps) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.emoji}>{won ? '🎉' : '💔'}</Text>
          <Text style={styles.title}>
            {won ? `Level ${levelId} Complete!` : 'Out of Lives'}
          </Text>
          {won ? (
            <>
              <Text style={styles.stars}>★★★</Text>
              <Text style={styles.stat}>{moves} moves</Text>
              <Text style={styles.stat}>{formatTime(seconds)}</Text>
            </>
          ) : (
            <Text style={styles.subtitle}>Clear arrows in the right order.</Text>
          )}

          {won && hasNext ? (
            <Pressable style={styles.primary} onPress={onNext}>
              <Text style={styles.primaryText}>Next Level</Text>
            </Pressable>
          ) : null}

          <Pressable
            style={won && hasNext ? styles.secondary : styles.primary}
            onPress={onReplay}
          >
            <Text style={won && hasNext ? styles.secondaryText : styles.primaryText}>
              Replay
            </Text>
          </Pressable>

          <Pressable onPress={onHome} style={styles.link}>
            <Text style={styles.linkText}>Home</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(23, 35, 63, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.white,
    borderRadius: 24,
    padding: spacing.xl,
    alignItems: 'center',
  },
  emoji: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.navy,
    textAlign: 'center',
  },
  stars: {
    marginTop: spacing.sm,
    fontSize: 28,
    color: colors.hint,
    letterSpacing: 4,
  },
  stat: {
    marginTop: spacing.xs,
    fontSize: 16,
    color: colors.muted,
  },
  subtitle: {
    marginTop: spacing.md,
    fontSize: 15,
    color: colors.muted,
    textAlign: 'center',
  },
  primary: {
    marginTop: spacing.lg,
    backgroundColor: colors.blue,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
  },
  primaryText: {
    color: colors.white,
    fontSize: 17,
    fontWeight: '700',
  },
  secondary: {
    marginTop: spacing.sm,
    backgroundColor: colors.panel,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
  },
  secondaryText: {
    color: colors.navy,
    fontSize: 17,
    fontWeight: '600',
  },
  link: {
    marginTop: spacing.md,
    padding: spacing.sm,
  },
  linkText: {
    color: colors.muted,
    fontSize: 15,
  },
});
