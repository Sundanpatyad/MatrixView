import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useLayoutEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { canUseLiquidGlass } from '@/components/ui/GlassSurface';
import { useColors } from '@/theme';

import { GlassButton, GlassButtonGroup } from './GlassButton';

/** Height of the header row itself, excluding the status bar inset. */
export const HEADER_CONTENT_HEIGHT = 52;

/**
 * Total space a floating header occupies. Screens pad their scroll content by
 * this so the first item starts below the chrome instead of under it.
 */
export function useFloatingHeaderHeight(): number {
  return useSafeAreaInsets().top + HEADER_CONTENT_HEIGHT;
}

/**
 * Layout clearance under the active header.
 * Use for absolute overlays / inverted lists that can't rely on automatic insets.
 */
export function useHeaderClearance(): number {
  return useFloatingHeaderHeight();
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
  onTitlePress?: () => void;
  /**
   * Pins the header above the screen. The screen is then responsible for
   * padding its content by `useFloatingHeaderHeight()`.
   */
  floating?: boolean;
}

/**
 * Transparent header chrome. On iOS 26+, only the buttons are pure native
 * Liquid Glass — not the whole header bar.
 */
export function AppHeader({
  title,
  subtitle,
  showBack = false,
  onBack,
  actions = [],
  left,
  center,
  floating = false,
  onTitlePress,
}: AppHeaderProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const liquid = canUseLiquidGlass();

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    if (navigation.canGoBack()) navigation.goBack();
  };

  const backControl = showBack ? (
    liquid ? (
      <GlassButton onPress={handleBack} accessibilityLabel="Go back" selected>
        <Ionicons name="chevron-back" size={22} color={colors.text} />
      </GlassButton>
    ) : (
      <Pressable onPress={handleBack} hitSlop={12} style={styles.plainBtn} accessibilityLabel="Go back">
        <Ionicons name="chevron-back" size={26} color={colors.text} />
      </Pressable>
    )
  ) : null;

  const actionControls =
    actions.length === 0 ? null : liquid ? (
      <GlassButtonGroup spacing={8} style={styles.actions}>
        {actions.map((action) => (
          <GlassButton
            key={action.accessibilityLabel}
            onPress={action.onPress}
            accessibilityLabel={action.accessibilityLabel}
            selected
          >
            <View>
              <Ionicons name={action.icon} size={20} color={action.tint ?? colors.text} />
              {action.badge ? (
                <View style={[styles.badge, { backgroundColor: colors.danger, borderColor: colors.bg }]}>
                  <Text style={styles.badgeText}>{action.badge > 99 ? '99+' : action.badge}</Text>
                </View>
              ) : null}
            </View>
          </GlassButton>
        ))}
      </GlassButtonGroup>
    ) : (
      <View style={styles.actions}>
        {actions.map((action) => (
          <Pressable
            key={action.accessibilityLabel}
            onPress={action.onPress}
            hitSlop={10}
            accessibilityLabel={action.accessibilityLabel}
            style={({ pressed }) => [styles.plainBtn, pressed && { opacity: 0.6 }]}
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
    );

  return (
    <View
      pointerEvents="box-none"
      style={[floating ? styles.floating : null, floating ? { paddingTop: insets.top } : null]}
    >
      <View style={styles.header} pointerEvents="box-none">
        {backControl}
        {left}

        {center ?? (
          <Pressable
            onPress={onTitlePress}
            disabled={!onTitlePress}
            style={styles.titles}
            accessibilityRole={onTitlePress ? 'button' : undefined}
            accessibilityLabel={onTitlePress ? 'Switch project' : undefined}
          >
            <View style={styles.titleRow}>
              <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                {title}
              </Text>
              {onTitlePress ? (
                <Ionicons name="chevron-down" size={16} color={colors.textSubtle} />
              ) : null}
            </View>
            {subtitle ? (
              <Text style={[styles.subtitle, { color: colors.textSubtle }]} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </Pressable>
        )}

        {actionControls}
      </View>
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
  titles: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 0,
  },
  title: {
    flexShrink: 1,
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: 0.15,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 8,
    flexShrink: 0,
  },
  plainBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
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
