import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  loginRequest,
  logoutRequest,
  meRequest,
  refreshRequest,
  registerRequest,
  updateMeRequest,
  uploadAvatarRequest,
  type AuthUser,
} from '@/lib/api/auth';
import { configureApiAuth } from '@/lib/api/client';

const STORAGE_KEY = 'dockx.desktop.auth';

export type DesktopUser = AuthUser;

type StoredAuth = {
  user: DesktopUser;
  accessToken: string;
  refreshToken: string;
};

type AuthContextValue = {
  user: DesktopUser | null;
  isAuthenticated: boolean;
  isBootstrapping: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: {
    name: string;
    email: string;
    password: string;
    orgName?: string;
    inviteToken?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (input: { name?: string; phone?: string }) => Promise<void>;
  uploadAvatar: (file: File) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function readStored(): StoredAuth | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredAuth;
    if (!parsed?.accessToken || !parsed?.refreshToken || !parsed?.user) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStored(value: StoredAuth | null) {
  if (!value) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<DesktopUser | null>(() => readStored()?.user ?? null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const tokensRef = useRef<{ accessToken: string | null; refreshToken: string | null }>({
    accessToken: readStored()?.accessToken ?? null,
    refreshToken: readStored()?.refreshToken ?? null,
  });
  const refreshPromiseRef = useRef<Promise<string | null> | null>(null);

  const persist = useCallback((next: StoredAuth | null) => {
    tokensRef.current = {
      accessToken: next?.accessToken ?? null,
      refreshToken: next?.refreshToken ?? null,
    };
    writeStored(next);
    setUser(next?.user ?? null);
  }, []);

  const applyAuth = useCallback(
    (result: { user: DesktopUser; accessToken: string; refreshToken: string }) => {
      persist({
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });
    },
    [persist],
  );

  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    if (refreshPromiseRef.current) return refreshPromiseRef.current;

    refreshPromiseRef.current = (async () => {
      const refreshToken = tokensRef.current.refreshToken;
      if (!refreshToken) {
        persist(null);
        return null;
      }
      try {
        const result = await refreshRequest(refreshToken);
        applyAuth(result);
        return result.accessToken;
      } catch {
        persist(null);
        return null;
      } finally {
        refreshPromiseRef.current = null;
      }
    })();

    return refreshPromiseRef.current;
  }, [applyAuth, persist]);

  useEffect(() => {
    configureApiAuth({
      getAccessToken: () => tokensRef.current.accessToken,
      refreshAccessToken,
    });
  }, [refreshAccessToken]);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const stored = readStored();
      if (!stored) {
        if (!cancelled) setIsBootstrapping(false);
        return;
      }

      tokensRef.current = {
        accessToken: stored.accessToken,
        refreshToken: stored.refreshToken,
      };

      try {
        const { user: me } = await meRequest();
        if (cancelled) return;
        persist({ ...stored, user: me });
      } catch {
        const token = await refreshAccessToken();
        if (!token && !cancelled) persist(null);
      } finally {
        if (!cancelled) setIsBootstrapping(false);
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [persist, refreshAccessToken]);

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await loginRequest({ email, password });
      applyAuth(result);
    },
    [applyAuth],
  );

  const register = useCallback(
    async (input: {
      name: string;
      email: string;
      password: string;
      orgName?: string;
      inviteToken?: string;
    }) => {
      const result = await registerRequest(input);
      applyAuth(result);
    },
    [applyAuth],
  );

  const logout = useCallback(async () => {
    const { accessToken, refreshToken } = tokensRef.current;
    await logoutRequest(refreshToken, accessToken);
    persist(null);
  }, [persist]);

  const replaceUser = useCallback(
    (nextUser: DesktopUser) => {
      const { accessToken, refreshToken } = tokensRef.current;
      if (!accessToken || !refreshToken) {
        setUser(nextUser);
        return;
      }
      persist({ user: nextUser, accessToken, refreshToken });
    },
    [persist],
  );

  const updateProfile = useCallback(
    async (input: { name?: string; phone?: string }) => {
      const { user: next } = await updateMeRequest(input);
      replaceUser(next);
    },
    [replaceUser],
  );

  const uploadAvatar = useCallback(
    async (file: File) => {
      const { user: next } = await uploadAvatarRequest(file);
      replaceUser(next);
    },
    [replaceUser],
  );

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isBootstrapping,
      login,
      register,
      logout,
      updateProfile,
      uploadAvatar,
    }),
    [user, isBootstrapping, login, register, logout, updateProfile, uploadAvatar],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
