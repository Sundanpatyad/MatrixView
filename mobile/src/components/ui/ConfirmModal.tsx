import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import React from 'react';
import {
  Dimensions,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, useColors, useTheme } from '@/theme';

import { Button } from './Button';

export type ConfirmModalProps = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const colors = useColors();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const screen = Dimensions.get('screen');
  const overlayWidth = Math.max(window.width, screen.width);
  const overlayHeight =
    Platform.OS === 'android' ? Math.max(window.height, screen.height) : window.height;
  const cardWidth = Math.min(overlayWidth - 48, 400);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      presentationStyle="overFullScreen"
      onRequestClose={() => {
        if (!busy) onCancel();
      }}
    >
      <View
        style={[
          styles.root,
          {
            width: overlayWidth,
            height: overlayHeight,
            backgroundColor:
              Platform.OS === 'android' ? 'rgba(0, 0, 0, 0.78)' : colors.overlayStrong,
          },
        ]}
      >
        {Platform.OS === 'ios' ? (
          <BlurView intensity={32} tint={isDark ? 'dark' : 'light'} style={styles.fill} />
        ) : null}

        <Pressable
          style={styles.fill}
          onPress={() => {
            if (!busy) onCancel();
          }}
          accessibilityLabel="Dismiss"
        />

        <View
          style={[
            styles.center,
            { paddingTop: insets.top, paddingBottom: insets.bottom },
          ]}
          pointerEvents="box-none"
        >
          <View
            accessibilityRole="alert"
            style={[
              styles.card,
              {
                width: cardWidth,
                backgroundColor: colors.bgElevated,
                borderColor: colors.borderStrong,
              },
            ]}
          >
            <View
              style={[
                styles.iconWrap,
                { backgroundColor: destructive ? colors.dangerSoft : colors.brandSoft },
              ]}
            >
              <Ionicons
                name={destructive ? 'warning-outline' : 'help-circle-outline'}
                size={22}
                color={destructive ? colors.danger : colors.brand}
              />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
            <Text style={[styles.message, { color: colors.textMuted }]}>{message}</Text>
            <View style={styles.actions}>
              <Button
                label={cancelLabel}
                variant="secondary"
                size="md"
                disabled={busy}
                onPress={onCancel}
                fullWidth
                style={styles.actionBtn}
              />
              <Button
                label={busy ? 'Please wait…' : confirmLabel}
                variant={destructive ? 'danger' : 'primary'}
                size="md"
                loading={busy}
                disabled={busy}
                onPress={onConfirm}
                fullWidth
                style={styles.actionBtn}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  fill: {
    ...StyleSheet.absoluteFillObject,
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 16,
    elevation: 24,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  message: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  actionBtn: {
    flex: 1,
  },
});
