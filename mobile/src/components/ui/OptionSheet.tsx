import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { radius, resolveAccentColor, useColors } from '@/theme';

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
  /** Shown in place of the list when there is nothing to pick. */
  emptyLabel?: string;
}

export function OptionSheet<T extends string>({
  visible,
  onClose,
  title,
  subtitle,
  options,
  value,
  onSelect,
  emptyLabel = 'Nothing to choose from yet.',
}: OptionSheetProps<T>) {
  const colors = useColors();

  return (
    <Sheet visible={visible} onClose={onClose} title={title} subtitle={subtitle}>
      {options.length === 0 ? (
        <View style={[styles.empty, { borderColor: colors.border }]}>
          <Ionicons name="file-tray-outline" size={22} color={colors.textSubtle} />
          <Text style={[styles.emptyText, { color: colors.textSubtle }]}>{emptyLabel}</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {options.map((option) => {
            const active = option.value === value;
            const accent = resolveAccentColor(option.color, colors.brand);

            return (
              <Pressable
                key={option.value}
                onPress={() => {
                  onSelect(option.value);
                  onClose();
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={({ pressed }) => [
                  styles.row,
                  {
                    backgroundColor: active ? colors.brandSoft : colors.surfaceAlt,
                    borderColor: active ? colors.brandBorder : 'transparent',
                  },
                  pressed && { opacity: 0.75 },
                ]}
              >
                {option.icon ? (
                  <View style={[styles.iconChip, { backgroundColor: active ? colors.brand : colors.bg }]}>
                    <Ionicons
                      name={option.icon}
                      size={17}
                      color={active ? colors.onBrand : (option.color ?? colors.textMuted)}
                    />
                  </View>
                ) : (
                  <View style={[styles.dot, { backgroundColor: accent }]} />
                )}

                <View style={styles.text}>
                  <Text style={[styles.label, { color: colors.text }]} numberOfLines={1}>
                    {option.label}
                  </Text>
                  {option.description ? (
                    <Text style={[styles.description, { color: colors.textSubtle }]} numberOfLines={1}>
                      {option.description}
                    </Text>
                  ) : null}
                </View>

                {active ? <Ionicons name="checkmark-circle" size={21} color={colors.brand} /> : null}
              </Pressable>
            );
          })}
        </View>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 8,
    paddingBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: radius.md,
    borderWidth: 1,
    minHeight: 56,
  },
  iconChip: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginHorizontal: 12,
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
  empty: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 28,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
  },
  emptyText: {
    fontSize: 13.5,
    textAlign: 'center',
  },
});
