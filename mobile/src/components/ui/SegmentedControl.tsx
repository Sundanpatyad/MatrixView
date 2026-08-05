import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { radius, useColors } from '@/theme';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  scrollable?: boolean;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  scrollable = false,
}: SegmentedControlProps<T>) {
  const colors = useColors();

  const items = options.map((option) => {
    const active = option.value === value;
    return (
      <Pressable
        key={option.value}
        onPress={() => onChange(option.value)}
        style={({ pressed }) => [
          styles.item,
          scrollable ? styles.itemScroll : styles.itemFlex,
          {
            backgroundColor: active ? colors.surface : 'transparent',
            borderColor: active ? colors.borderStrong : 'transparent',
          },
          pressed && { opacity: 0.75 },
        ]}
      >
        <Text
          style={[styles.label, { color: active ? colors.text : colors.textSubtle }]}
          numberOfLines={1}
        >
          {option.label}
        </Text>
        {option.count !== undefined && option.count > 0 ? (
          <View style={[styles.count, { backgroundColor: active ? colors.brandSoft : colors.track }]}>
            <Text style={[styles.countText, { color: active ? colors.brand : colors.textMuted }]}>
              {option.count}
            </Text>
          </View>
        ) : null}
      </Pressable>
    );
  });

  if (scrollable) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.track, styles.trackScroll, { backgroundColor: colors.surfaceAlt }]}
      >
        {items}
      </ScrollView>
    );
  }

  return <View style={[styles.track, { backgroundColor: colors.surfaceAlt }]}>{items}</View>;
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    borderRadius: radius.md,
    padding: 2,
    gap: 2,
  },
  trackScroll: {
    alignItems: 'center',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    height: 28,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
  itemFlex: {
    flex: 1,
    paddingHorizontal: 6,
  },
  itemScroll: {
    paddingHorizontal: 10,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
  count: {
    minWidth: 16,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  countText: {
    fontSize: 10,
    fontWeight: '700',
  },
});
