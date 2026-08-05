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
            borderColor: active ? colors.border : 'transparent',
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
          <View style={[styles.count, { backgroundColor: active ? colors.brandSoft : colors.surfaceHover }]}>
            <Text style={[styles.countText, { color: active ? colors.brand : colors.textSubtle }]}>
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
    padding: 3,
    gap: 3,
  },
  trackScroll: {
    alignItems: 'center',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 34,
    borderRadius: radius.sm + 1,
    borderWidth: 1,
  },
  itemFlex: {
    flex: 1,
    paddingHorizontal: 8,
  },
  itemScroll: {
    paddingHorizontal: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
  count: {
    minWidth: 18,
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
