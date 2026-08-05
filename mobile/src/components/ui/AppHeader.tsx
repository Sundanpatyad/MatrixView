import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors } from '@/theme';

import { GlassSurface } from './GlassSurface';

/** Height of the header row itself, excluding the status bar inset. */
export const HEADER_CONTENT_HEIGHT = 56;

/**
 * Total space a floating header occupies. Screens pad their scroll content by
 * this so the first item starts below the glass instead of under it.
 */
export function useFloatingHeaderHeight(): number {
  return useSafeAreaInsets().top + HEADER_CONTENT_HEIGHT;
}

export interface HeaderAction {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  badge?: number;
  accessibilityLabel: string;
  tint?: string;
}

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  actions?: HeaderAction[];
  left?: React.ReactNode;
  center?: React.ReactNode;
  border?: boolean;
  /**
   * Pins the header above the screen as a blurred pane. The screen is then
   * responsible for padding its content by `useFloatingHeaderHeight()`.
   */
  floating?: boolean;
}

export function AppHeader({
  title,
  subtitle,
  showBack = false,
  onBack,
  actions = [],
  left,
  center,
  border = true,
  floating = false,
}: AppHeaderProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    if (navigation.canGoBack()) navigation.goBack();
  };

  const content = (
    <>
      {showBack ? (
        <Pressable onPress={handleBack} hitSlop={12} style={styles.back} accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
      ) : null}

      {left}

      {center ?? (
        <View style={styles.titles}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: colors.textSubtle }]} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      )}

      <View style={styles.actions}>
        {actions.map((action) => (
          <Pressable
            key={action.accessibilityLabel}
            onPress={action.onPress}
            hitSlop={10}
            accessibilityLabel={action.accessibilityLabel}
            style={({ pressed }) => [styles.action, pressed && { opacity: 0.6 }]}
          >
            <Ionicons name={action.icon} size={22} color={action.tint ?? colors.textMuted} />
            {action.badge ? (
              <View style={[styles.badge, { backgroundColor: colors.danger, borderColor: colors.bg }]}>
                <Text style={styles.badgeText}>{action.badge > 99 ? '99+' : action.badge}</Text>
              </View>
            ) : null}
          </Pressable>
        ))}
      </View>
    </>
  );

  if (floating) {
    return (
      <GlassSurface
        edge={border ? 'bottom' : 'none'}
        style={[styles.floating, { paddingTop: insets.top }]}
      >
        <View style={styles.header}>{content}</View>
      </GlassSurface>
    );
  }

  return (
    <View
      style={[
        styles.header,
        {
          backgroundColor: colors.bg,
          borderBottomColor: border ? colors.border : 'transparent',
          borderBottomWidth: border ? StyleSheet.hairlineWidth : 0,
        },
      ]}
    >
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  floating: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 10,
    height: HEADER_CONTENT_HEIGHT,
  },
  back: {
    marginLeft: -6,
  },
  titles: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  action: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -8,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
  },
});
