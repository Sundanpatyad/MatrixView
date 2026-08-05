import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

import { darkPalette, lightPalette, type Palette, type ThemeMode } from './tokens';

const STORAGE_KEY = 'dockx.mobile.theme';

export type ThemePreference = ThemeMode | 'system';

interface ThemeContextValue {
  mode: ThemeMode;
  preference: ThemePreference;
  colors: Palette;
  isDark: boolean;
  setPreference: (preference: ThemePreference) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (cancelled) return;
        if (stored === 'light' || stored === 'dark' || stored === 'system') {
          setPreferenceState(stored);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
  }, []);

  const mode: ThemeMode = preference === 'system' ? (systemScheme === 'light' ? 'light' : 'dark') : preference;

  const toggle = useCallback(() => {
    setPreference(mode === 'dark' ? 'light' : 'dark');
  }, [mode, setPreference]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      preference,
      colors: mode === 'dark' ? darkPalette : lightPalette,
      isDark: mode === 'dark',
      setPreference,
      toggle,
    }),
    [mode, preference, setPreference, toggle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}

/** Convenience hook for the common case of only needing the palette. */
export function useColors(): Palette {
  return useTheme().colors;
}
