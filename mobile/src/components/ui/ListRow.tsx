import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { radius, useColors } from '@/theme';

interface ListRowProps {
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  title: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
  right?: React.ReactNode;
  destructive?: boolean;
  left?: React.ReactNode;
  showChevron?: boolean;
}

export function ListRow({
  icon,
  iconColor,
  title,
  subtitle,
  value,
  onPress,
  right,
  destructive = false,
  left,
  showChevron = true,
}: ListRowProps) {
  const colors = useColors();
  const tint = destructive ? colors.danger : colors.text;

  const content = (
    <>
      {left ??
        (icon ? (
          <View style={[styles.iconWrap, { backgroundColor: colors.surfaceAlt }]}>
            <Ionicons name={icon} size={18} color={iconColor ?? (destructive ? colors.danger : colors.textMuted)} />
          </View>
        ) : null)}

      <View style={styles.text}>
        <Text style={[styles.title, { color: tint }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: colors.textSubtle }]} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {value ? (
        <Text style={[styles.value, { color: colors.textSubtle }]} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {right}
      {onPress && showChevron && !right ? (
        <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
      ) : null}
    </>
  );

  if (!onPress) {
    return <View style={styles.row}>{content}</View>;
  }

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.65 }]}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: radius.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 17,
  },
  value: {
    fontSize: 13,
  },
});
