import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, useColors } from '@/theme';

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
  maxHeightRatio = 0.88,
}: SheetProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const body = scrollable ? (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 16 }}
    >
      {children}
    </ScrollView>
  ) : (
    children
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
        <Pressable style={styles.backdropTap} onPress={onClose} accessibilityLabel="Dismiss" />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: colors.bgElevated,
                borderColor: colors.border,
                paddingBottom: insets.bottom + 16,
                maxHeight: `${maxHeightRatio * 100}%`,
              },
            ]}
          >
            <View style={[styles.grabber, { backgroundColor: colors.borderStrong }]} />
            {title ? (
              <View style={styles.header}>
                <View style={styles.headerText}>
                  <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
                  {subtitle ? (
                    <Text style={[styles.subtitle, { color: colors.textSubtle }]}>{subtitle}</Text>
                  ) : null}
                </View>
                <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close">
                  <Ionicons name="close" size={22} color={colors.textSubtle} />
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
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdropTap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheet: {
    borderTopLeftRadius: radius['2xl'],
    borderTopRightRadius: radius['2xl'],
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 18,
    gap: 12,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 3,
    lineHeight: 18,
  },
});
