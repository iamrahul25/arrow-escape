import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGameStore } from '../store/gameStore';
import { colors, spacing } from '../theme';

export function HomeScreen() {
  const setScreen = useGameStore((s) => s.setScreen);
  const startLevel = useGameStore((s) => s.startLevel);
  const progress = useGameStore((s) => s.progress);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.brand}>ARROW</Text>
          <Text style={styles.brandAccent}>ESCAPE</Text>
          <Text style={styles.tagline}>Clear every arrow. Find the order.</Text>
        </View>

        <View style={styles.actions}>
          <Pressable
            style={styles.play}
            onPress={() => startLevel(progress.highestLevel)}
          >
            <Text style={styles.playText}>▶  PLAY</Text>
          </Pressable>

          <Pressable style={styles.secondary} onPress={() => setScreen('levels')}>
            <Text style={styles.secondaryText}>Levels</Text>
          </Pressable>

          <Pressable style={styles.link} onPress={() => setScreen('settings')}>
            <Text style={styles.linkText}>⚙  Settings</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    justifyContent: 'space-between',
    paddingBottom: spacing.xl,
  },
  hero: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  brand: {
    fontSize: 48,
    fontWeight: '900',
    color: colors.navy,
    letterSpacing: 6,
  },
  brandAccent: {
    fontSize: 48,
    fontWeight: '900',
    color: colors.blue,
    letterSpacing: 6,
    marginTop: -4,
  },
  tagline: {
    marginTop: spacing.md,
    fontSize: 15,
    color: colors.muted,
    textAlign: 'center',
  },
  actions: {
    gap: spacing.md,
    alignItems: 'center',
    paddingBottom: spacing.lg,
  },
  play: {
    backgroundColor: colors.blue,
    paddingVertical: 18,
    paddingHorizontal: 56,
    borderRadius: 16,
    width: '100%',
    alignItems: 'center',
  },
  playText: {
    color: colors.white,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 1,
  },
  secondary: {
    backgroundColor: colors.panel,
    paddingVertical: 16,
    borderRadius: 16,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryText: {
    color: colors.navy,
    fontSize: 17,
    fontWeight: '700',
  },
  link: {
    padding: spacing.md,
  },
  linkText: {
    color: colors.muted,
    fontSize: 16,
    fontWeight: '600',
  },
});
