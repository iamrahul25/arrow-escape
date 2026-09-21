import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '../components/Header';
import { LEVELS } from '../levels';
import { useGameStore } from '../store/gameStore';
import { colors, spacing } from '../theme';

export function LevelSelectScreen() {
  const setScreen = useGameStore((s) => s.setScreen);
  const startLevel = useGameStore((s) => s.startLevel);
  const progress = useGameStore((s) => s.progress);
  const isLevelUnlocked = useGameStore((s) => s.isLevelUnlocked);

  return (
    <SafeAreaView style={styles.safe}>
      <Header title="Select Level" onBack={() => setScreen('home')} />

      <ScrollView contentContainerStyle={styles.list}>
        {LEVELS.map((level) => {
          const unlocked = isLevelUnlocked(level.id);
          const completed = progress.completedLevels.includes(level.id);
          const best = progress.bestScores[String(level.id)];

          return (
            <Pressable
              key={level.id}
              style={[styles.card, !unlocked && styles.locked]}
              disabled={!unlocked}
              onPress={() => startLevel(level.id)}
            >
              <View>
                <Text style={styles.levelNum}>
                  {unlocked ? `Level ${level.id}` : `🔒 Level ${level.id}`}
                </Text>
                <Text style={styles.levelName}>{level.name}</Text>
                {completed && best !== undefined ? (
                  <Text style={styles.best}>Best: {best} moves</Text>
                ) : null}
              </View>
              <Text style={styles.badge}>{completed ? '✓' : unlocked ? '▶' : ''}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  list: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.panel,
    borderRadius: 18,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
  },
  locked: {
    opacity: 0.45,
  },
  levelNum: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.navy,
  },
  levelName: {
    marginTop: 4,
    fontSize: 14,
    color: colors.muted,
  },
  best: {
    marginTop: 6,
    fontSize: 13,
    color: colors.blue,
    fontWeight: '600',
  },
  badge: {
    fontSize: 22,
    color: colors.blue,
    fontWeight: '700',
  },
});
