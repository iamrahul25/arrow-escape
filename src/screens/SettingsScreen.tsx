import React from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '../components/Header';
import { useGameStore } from '../store/gameStore';
import { colors, spacing } from '../theme';

export function SettingsScreen() {
  const setScreen = useGameStore((s) => s.setScreen);
  const progress = useGameStore((s) => s.progress);
  const toggleSetting = useGameStore((s) => s.toggleSetting);
  const resetProgress = useGameStore((s) => s.resetProgress);

  const confirmReset = () => {
    Alert.alert(
      'Reset Progress',
      'This will clear completed levels and best scores.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            void resetProgress();
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <Header title="Settings" onBack={() => setScreen('home')} />

      <View style={styles.section}>
        <View style={styles.row}>
          <Text style={styles.label}>🔊 Sound</Text>
          <Switch
            value={progress.settings.sound}
            onValueChange={() => void toggleSetting('sound')}
            trackColor={{ true: colors.blue, false: colors.border }}
          />
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>📳 Haptics</Text>
          <Switch
            value={progress.settings.haptics}
            onValueChange={() => void toggleSetting('haptics')}
            trackColor={{ true: colors.blue, false: colors.border }}
          />
        </View>
      </View>

      <Pressable style={styles.reset} onPress={confirmReset}>
        <Text style={styles.resetText}>Reset Progress</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  section: {
    margin: spacing.lg,
    backgroundColor: colors.panel,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  label: {
    fontSize: 16,
    color: colors.navy,
    fontWeight: '600',
  },
  reset: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.lg,
    alignItems: 'center',
  },
  resetText: {
    color: colors.heart,
    fontSize: 16,
    fontWeight: '700',
  },
});
