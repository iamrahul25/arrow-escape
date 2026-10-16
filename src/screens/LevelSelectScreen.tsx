import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '../components/Header';
import { getSuite } from '../levels';
import { useGameStore } from '../store/gameStore';
import { colors, spacing } from '../theme';
import { getSuiteProgress } from '../utils/storage';

export function LevelSelectScreen() {
  const setScreen = useGameStore((s) => s.setScreen);
  const startLevel = useGameStore((s) => s.startLevel);
  const progress = useGameStore((s) => s.progress);
  const suiteId = useGameStore((s) => s.selectedSuiteId);
  const isLevelUnlocked = useGameStore((s) => s.isLevelUnlocked);

  const suite = getSuite(suiteId);
  const { completedLevels } = getSuiteProgress(progress, suiteId);

  return (
    <SafeAreaView style={styles.safe}>
      <Header title={suite?.name ?? 'Levels'} onBack={() => setScreen('suites')} />

      <ScrollView contentContainerStyle={styles.grid}>
        {suite?.levels.length ? (
          suite.levels.map((level) => {
            const unlocked = isLevelUnlocked(suiteId, level.id);
            const completed = completedLevels.includes(level.id);

            return (
              <Pressable
                key={level.id}
                style={[styles.tile, completed && styles.tileDone, !unlocked && styles.locked]}
                disabled={!unlocked}
                onPress={() => startLevel(suiteId, level.id)}
              >
                <Text style={[styles.levelNum, completed && styles.textDone]}>
                  {unlocked ? level.id : '🔒'}
                </Text>
                <Text style={[styles.size, completed && styles.textDone]}>
                  {level.width}×{level.height}
                </Text>
              </Pressable>
            );
          })
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Levels coming soon</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  grid: {
    padding: spacing.lg,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  tile: {
    width: 64,
    height: 64,
    borderRadius: 14,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileDone: {
    backgroundColor: colors.blue,
    borderColor: colors.blue,
  },
  locked: {
    opacity: 0.45,
  },
  levelNum: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.navy,
  },
  size: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '600',
    color: colors.muted,
  },
  textDone: {
    color: colors.white,
  },
  empty: {
    paddingVertical: spacing.xl,
  },
  emptyText: {
    fontSize: 16,
    color: colors.muted,
  },
});
