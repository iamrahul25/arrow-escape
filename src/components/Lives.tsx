import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../theme';
import { config } from '../config';

interface LivesProps {
  lives: number;
  max?: number;
}

export function Lives({ lives, max = config.lives }: LivesProps) {
  return (
    <View style={styles.row}>
      {Array.from({ length: max }).map((_, i) => (
        <Text key={i} style={[styles.heart, i >= lives && styles.lost]}>
          ♥
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  heart: {
    fontSize: 26,
    color: colors.heart,
  },
  lost: {
    color: colors.border,
  },
});
