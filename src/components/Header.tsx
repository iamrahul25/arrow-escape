import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../theme';

interface HeaderProps {
  title: string;
  onBack?: () => void;
  onAction?: () => void;
  actionLabel?: string;
}

export function Header({ title, onBack, onAction, actionLabel = '⚙' }: HeaderProps) {
  return (
    <View style={styles.row}>
      <View style={styles.side}>
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={12} style={styles.btn}>
            <Text style={styles.btnText}>←</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.title}>{title}</Text>
      <View style={[styles.side, styles.sideRight]}>
        {onAction ? (
          <Pressable onPress={onAction} hitSlop={12} style={styles.btn}>
            <Text style={styles.btnText}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  side: {
    width: 48,
  },
  sideRight: {
    alignItems: 'flex-end',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.navy,
    letterSpacing: 0.3,
  },
  btn: {
    padding: spacing.sm,
  },
  btnText: {
    fontSize: 22,
    color: colors.navy,
  },
});
