import { Ionicons } from '@expo/vector-icons';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { messageFromError } from '@/lib/api';
import { radius, useColors } from '@/theme';

type ToastKind = 'success' | 'error' | 'info';

interface ToastState {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  fromError: (error: unknown, fallback?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const VISIBLE_MS = 3200;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastState | null>(null);
  const progress = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const counter = useRef(0);

  const hide = useCallback(() => {
    Animated.timing(progress, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => setToast(null));
  }, [progress]);

  const push = useCallback(
    (kind: ToastKind, message: string) => {
      if (!message) return;
      counter.current += 1;
      setToast({ id: counter.current, kind, message });
      if (timer.current) clearTimeout(timer.current);
      Animated.spring(progress, { toValue: 1, useNativeDriver: true, damping: 18, stiffness: 180 }).start();
      timer.current = setTimeout(hide, VISIBLE_MS);
    },
    [hide, progress],
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      success: (message) => push('success', message),
      error: (message) => push('error', message),
      info: (message) => push('info', message),
      fromError: (error, fallback) => push('error', messageFromError(error, fallback)),
    }),
    [push],
  );

  const accent =
    toast?.kind === 'success' ? colors.success : toast?.kind === 'error' ? colors.danger : colors.info;
  const icon =
    toast?.kind === 'success' ? 'checkmark-circle' : toast?.kind === 'error' ? 'alert-circle' : 'information-circle';

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.wrap,
            {
              top: insets.top + 8,
              opacity: progress,
              transform: [
                {
                  translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }),
                },
              ],
            },
          ]}
        >
          <Pressable
            onPress={hide}
            style={[styles.toast, { backgroundColor: colors.bgElevated, borderColor: accent }]}
          >
            <Ionicons name={icon} size={20} color={accent} />
            <Text style={[styles.message, { color: colors.text }]} numberOfLines={3}>
              {toast.message}
            </Text>
          </Pressable>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 100,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderLeftWidth: 3,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  message: {
    flex: 1,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '500',
  },
});
