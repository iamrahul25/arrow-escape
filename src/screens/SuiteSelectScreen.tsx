import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '../components/Header';
import { SUITES } from '../levels';
import { useGameStore } from '../store/gameStore';
import { colors, spacing } from '../theme';
import { getSuiteProgress } from '../utils/storage';

export function SuiteSelectScreen() {
  const setScreen = useGameStore((s) => s.setScreen);
  const openSuite = useGameStore((s) => s.openSuite);
  const progress = useGameStore((s) => s.progress);

  return (
    <SafeAreaView style={styles.safe}>
      <Header title="Select Suite" onBack={() => setScreen('home')} />

      <ScrollView contentContainerStyle={styles.list}>
        {SUITES.map((suite) => {
          const total = suite.levels.length;
          const done = getSuiteProgress(progress, suite.id).completedLevels.length;
          const empty = total === 0;

          return (
            <Pressable
              key={suite.id}
              style={[styles.card, empty && styles.disabled]}
              disabled={empty}
              onPress={() => openSuite(suite.id)}
            >
              <View style={styles.info}>
                <Text style={styles.suiteNum}>Suite {suite.id}</Text>
                <Text style={styles.suiteName}>{suite.name}</Text>
                <Text style={styles.description}>{suite.description}</Text>
                <Text style={styles.count}>
                  {empty ? 'Coming soon' : `${done} / ${total} completed`}
                </Text>
              </View>
              <Text style={styles.badge}>{empty ? '' : '▶'}</Text>
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
  disabled: {
    opacity: 0.45,
  },
  info: {
    flex: 1,
  },
  suiteNum: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.blue,
    letterSpacing: 0.5,
  },
  suiteName: {
    marginTop: 2,
    fontSize: 20,
    fontWeight: '800',
    color: colors.navy,
  },
  description: {
    marginTop: 4,
    fontSize: 14,
    color: colors.muted,
  },
  count: {
    marginTop: 8,
    fontSize: 13,
    color: colors.navy,
    fontWeight: '600',
  },
  badge: {
    fontSize: 22,
    color: colors.blue,
    fontWeight: '700',
  },
});
