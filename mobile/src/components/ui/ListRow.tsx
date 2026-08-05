import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useColors } from '@/theme';

interface ListRowProps {
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  /** Solid fill behind the icon (WhatsApp-style accent tile). */
  iconBackground?: string;
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
  iconBackground,
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
  const tile = iconBackground ?? (destructive ? colors.dangerSoft : colors.surfaceAlt);
  const glyph = iconColor ?? (destructive ? colors.danger : colors.textMuted);

  const content = (
    <>
      {left ??
        (icon ? (
          <View style={[styles.iconWrap, { backgroundColor: tile }]}>
            <Ionicons name={icon} size={20} color={glyph} />
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
    <Pressable
      onPress={onPress}
      android_ripple={{ color: colors.surfaceHover }}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceHover }]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 13,
    paddingHorizontal: 16,
    minHeight: 56,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '400',
    letterSpacing: 0.1,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
    lineHeight: 18,
  },
  value: {
    fontSize: 14,
  },
});
