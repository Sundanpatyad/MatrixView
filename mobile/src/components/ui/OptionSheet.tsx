import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { radius, useColors } from '@/theme';

import { Sheet } from './Sheet';

export interface SheetOption<T extends string> {
  value: T;
  label: string;
  description?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  color?: string;
}

interface OptionSheetProps<T extends string> {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  options: SheetOption<T>[];
  value?: T | null;
  onSelect: (value: T) => void;
}

export function OptionSheet<T extends string>({
  visible,
  onClose,
  title,
  subtitle,
  options,
  value,
  onSelect,
}: OptionSheetProps<T>) {
  const colors = useColors();

  return (
    <Sheet visible={visible} onClose={onClose} title={title} subtitle={subtitle}>
      <View style={styles.list}>
        {options.map((option) => {
          const active = option.value === value;
          return (
            <Pressable
              key={option.value}
              onPress={() => {
                onSelect(option.value);
                onClose();
              }}
              style={({ pressed }) => [
                styles.row,
                {
                  backgroundColor: active ? colors.brandSoft : colors.surfaceAlt,
                  borderColor: active ? colors.brandBorder : colors.border,
                },
                pressed && { opacity: 0.8 },
              ]}
            >
              {option.icon ? (
                <Ionicons name={option.icon} size={19} color={option.color ?? (active ? colors.brand : colors.textMuted)} />
              ) : option.color ? (
                <View style={[styles.dot, { backgroundColor: option.color }]} />
              ) : null}

              <View style={styles.text}>
                <Text style={[styles.label, { color: active ? colors.brand : colors.text }]}>{option.label}</Text>
                {option.description ? (
                  <Text style={[styles.description, { color: colors.textSubtle }]}>{option.description}</Text>
                ) : null}
              </View>

              {active ? <Ionicons name="checkmark-circle" size={20} color={colors.brand} /> : null}
            </Pressable>
          );
        })}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  text: {
    flex: 1,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
  },
  description: {
    fontSize: 12,
    marginTop: 2,
  },
});
