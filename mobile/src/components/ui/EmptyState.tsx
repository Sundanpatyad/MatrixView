import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useColors } from '@/theme';

import { Button } from './Button';

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon = 'sparkles-outline', title, description, actionLabel, onAction }: EmptyStateProps) {
  const colors = useColors();
  return (
    <View style={styles.wrap}>
      <View style={[styles.iconWrap, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
        <Ionicons name={icon} size={28} color={colors.textSubtle} />
      </View>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      {description ? <Text style={[styles.description, { color: colors.textSubtle }]}>{description}</Text> : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} variant="subtle" size="sm" style={styles.action} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  description: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 19,
  },
  action: {
    marginTop: 18,
  },
});
