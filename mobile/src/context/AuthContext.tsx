import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { authApi, configureApiAuth, type AuthResponse, type AuthUser, type PickedFile } from '@/lib/api';
import { GoogleSignInCancelledError, signInWithGoogleNative, signOutGoogleNative } from '@/lib/auth/googleSignIn';
import { clearSession, loadSession, saveSession, saveUser } from '@/lib/storage/authStorage';

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isBootstrapping: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  register: (input: {
    name: string;
    email: string;
    password: string;
    orgName?: string;
    inviteToken?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  logoutEverywhere: () => Promise<void>;
  updateProfile: (input: { name?: string; phone?: string }) => Promise<void>;
  uploadAvatar: (file: PickedFile) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  const tokensRef = useRef<{ accessToken: string | null; refreshToken: string | null }>({
    accessToken: null,
    refreshToken: null,
  });
  const refreshInFlight = useRef<Promise<string | null> | null>(null);

  const applySession = useCallback(async (payload: AuthResponse) => {
    tokensRef.current = { accessToken: payload.accessToken, refreshToken: payload.refreshToken };
    setUser(payload.user);
    await saveSession({
      accessToken: payload.accessToken,
      refreshToken: payload.refreshToken,
      user: payload.user,
    });
  }, []);

  const teardown = useCallback(async () => {
    tokensRef.current = { accessToken: null, refreshToken: null };
    setUser(null);
    await clearSession();
    await signOutGoogleNative();
  }, []);

  /**
   * Refresh is deduped: a burst of parallel 401s must only rotate the refresh
   * token once, otherwise the backend revokes the whole session family.
   */
  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    if (refreshInFlight.current) return refreshInFlight.current;

    const { refreshToken } = tokensRef.current;
    if (!refreshToken) return null;

    refreshInFlight.current = (async () => {
      try {
        const payload = await authApi.refreshRequest(refreshToken);
        tokensRef.current = { accessToken: payload.accessToken, refreshToken: payload.refreshToken };
        setUser(payload.user);
        await saveSession({
          accessToken: payload.accessToken,
          refreshToken: payload.refreshToken,
          user: payload.user,
        });
        return payload.accessToken;
      } catch {
        await teardown();
        return null;
      } finally {
        refreshInFlight.current = null;
      }
    })();

    return refreshInFlight.current;
  }, [teardown]);

  useEffect(() => {
    configureApiAuth({
      getAccessToken: () => tokensRef.current.accessToken,
      refreshAccessToken,
    });
  }, [refreshAccessToken]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const stored = await loadSession();
      if (!stored) {
        if (!cancelled) setIsBootstrapping(false);
        return;
      }

      tokensRef.current = { accessToken: stored.accessToken, refreshToken: stored.refreshToken };
      if (!cancelled) setUser(stored.user);

      try {
        const { user: fresh } = await authApi.meRequest();
        if (cancelled) return;
        setUser(fresh);
        await saveUser(fresh);
      } catch {
        const token = await refreshAccessToken();
        if (cancelled) return;
        if (!token) {
          await teardown();
        }
      } finally {
        if (!cancelled) setIsBootstrapping(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshAccessToken, teardown]);

  const login = useCallback(
    async (email: string, password: string) => {
      const payload = await authApi.loginRequest(email.trim(), password);
      await applySession(payload);
    },
    [applySession],
  );

  const loginWithGoogle = useCallback(async () => {
    try {
      const idToken = await signInWithGoogleNative();
      const payload = await authApi.googleLoginRequest(idToken);
      await applySession(payload);
    } catch (error) {
      if (error instanceof GoogleSignInCancelledError) return;
      throw error;
    }
  }, [applySession]);

  const register = useCallback(
    async (input: { name: string; email: string; password: string; orgName?: string; inviteToken?: string }) => {
      const payload = await authApi.registerRequest({
        ...input,
        name: input.name.trim(),
        email: input.email.trim(),
      });
      await applySession(payload);
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    const { refreshToken, accessToken } = tokensRef.current;
    try {
      await authApi.logoutRequest(refreshToken, accessToken);
    } catch {
      // A failed round trip must never trap the user in a signed-in shell.
    }
    await teardown();
  }, [teardown]);

  const logoutEverywhere = useCallback(async () => {
    try {
      await authApi.logoutAllRequest();
    } catch {
      // Same rationale as logout: always clear locally.
    }
    await teardown();
  }, [teardown]);

  const updateProfile = useCallback(async (input: { name?: string; phone?: string }) => {
    const { user: next } = await authApi.updateMeRequest(input);
    setUser(next);
    await saveUser(next);
  }, []);

  const uploadAvatar = useCallback(async (file: PickedFile) => {
    const { user: next } = await authApi.uploadAvatarRequest(file);
    setUser(next);
    await saveUser(next);
  }, []);

  const refreshUser = useCallback(async () => {
    const { user: next } = await authApi.meRequest();
    setUser(next);
    await saveUser(next);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isBootstrapping,
      isAdmin: (user?.role ?? '').toLowerCase() === 'admin',
      login,
      loginWithGoogle,
      register,
      logout,
      logoutEverywhere,
      updateProfile,
      uploadAvatar,
      refreshUser,
    }),
    [
      user,
      isBootstrapping,
      login,
      loginWithGoogle,
      register,
      logout,
      logoutEverywhere,
      updateProfile,
      uploadAvatar,
      refreshUser,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
