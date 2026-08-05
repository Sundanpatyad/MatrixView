import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import React from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, useTheme } from '@/theme';

import { GLASS_BLUR_SUPPORTED } from './GlassSurface';

interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  /** Wraps children in a ScrollView; disable for sheets that host their own list. */
  scrollable?: boolean;
  maxHeightRatio?: number;
}

export function Sheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
  scrollable = true,
  maxHeightRatio = 0.86,
}: SheetProps) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();

  /**
   * A percentage would resolve against the auto-height wrapper rather than the
   * screen, letting long option lists grow past the top edge without scrolling.
   */
  const maxHeight = Math.round(windowHeight * maxHeightRatio);
  const bottomPad = Math.max(insets.bottom, 12);

  const body = scrollable ? (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      bounces={false}
      // Without this the list keeps its full content height and is clipped by
      // the sheet's maxHeight instead of scrolling inside it.
      style={styles.scroll}
    >
      {children}
    </ScrollView>
  ) : (
    children
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        {GLASS_BLUR_SUPPORTED ? (
          <BlurView intensity={28} tint={isDark ? 'dark' : 'light'} style={styles.fill} />
        ) : null}
        {/* Doubles as the scrim, and carries the whole effect where blur cannot. */}
        <Pressable
          style={[
            styles.fill,
            { backgroundColor: GLASS_BLUR_SUPPORTED ? colors.overlay : colors.overlayStrong },
          ]}
          onPress={onClose}
          accessibilityLabel="Dismiss"
        />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          pointerEvents="box-none"
        >
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: colors.bgElevated,
                borderTopColor: colors.glassBorder,
                paddingBottom: bottomPad,
                maxHeight,
              },
            ]}
          >
            <View style={[styles.grabber, { backgroundColor: colors.borderStrong }]} />

            {title ? (
              <View style={styles.header}>
                <View style={styles.headerText}>
                  <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                    {title}
                  </Text>
                  {subtitle ? (
                    <Text style={[styles.subtitle, { color: colors.textSubtle }]} numberOfLines={2}>
                      {subtitle}
                    </Text>
                  ) : null}
                </View>
                <Pressable
                  onPress={onClose}
                  hitSlop={10}
                  accessibilityLabel="Close"
                  style={({ pressed }) => [
                    styles.close,
                    { backgroundColor: colors.surfaceAlt },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Ionicons name="close" size={18} color={colors.textMuted} />
                </Pressable>
              </View>
            ) : null}

            {body}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  fill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  scroll: {
    flexShrink: 1,
  },
  sheet: {
    borderTopLeftRadius: radius['2xl'],
    borderTopRightRadius: radius['2xl'],
    // Only the top edge is visible, so side borders would just streak the screen.
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  grabber: {
    width: 38,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 3,
    lineHeight: 18,
  },
  close: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
