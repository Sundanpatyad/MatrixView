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
  googleExchangeRequest,
  loginRequest,
  logoutRequest,
  meRequest,
  refreshRequest,
  registerRequest,
  updateMeRequest,
  uploadAvatarRequest,
  type AuthResponse,
  type AuthUser,
} from '@/lib/api/auth';
import { configureApiAuth, DESKTOP_AUTH_STORAGE_KEY } from '@/lib/api/client';
import { isApiError, isOfflineError, isSessionDead, isTransientServerError } from '@/lib/api/errors';

const STORAGE_KEY = DESKTOP_AUTH_STORAGE_KEY;
const REMEMBER_PREF_KEY = 'dockx.rememberMe';

export type DesktopUser = AuthUser;

type StoredAuth = {
  user: DesktopUser;
  accessToken: string;
  refreshToken: string;
  rememberMe?: boolean;
};

type AuthContextValue = {
  user: DesktopUser | null;
  isAuthenticated: boolean;
  isBootstrapping: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  register: (input: {
    name: string;
    email: string;
    password: string;
    orgName?: string;
    inviteToken?: string;
    rememberMe?: boolean;
  }) => Promise<void>;
  /** Finish Google OAuth after `/auth/google/callback?code=…` */
  completeOAuth: (code: string) => Promise<void>;
  /** Apply tokens from desktop Google loopback sign-in */
  applySession: (result: AuthResponse, rememberMe?: boolean) => void;
  logout: () => Promise<void>;
  updateProfile: (input: { name?: string; phone?: string }) => Promise<void>;
  uploadAvatar: (file: File) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function rememberPref(): boolean {
  try {
    const session = sessionStorage.getItem(REMEMBER_PREF_KEY);
    if (session === '0' || session === '1') return session === '1';
    return localStorage.getItem(REMEMBER_PREF_KEY) !== '0';
  } catch {
    return true;
  }
}

export function getRememberPref() {
  return rememberPref();
}

export function setRememberPref(value: boolean) {
  try {
    localStorage.setItem(REMEMBER_PREF_KEY, value ? '1' : '0');
  } catch {
    /* private mode */
  }
}

function persistStore(rememberMe: boolean) {
  return rememberMe ? localStorage : sessionStorage;
}

function readStored(): StoredAuth | null {
  try {
    const local = localStorage.getItem(STORAGE_KEY);
    const session = sessionStorage.getItem(STORAGE_KEY);
    const raw = local || session;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredAuth;
    if (!parsed?.accessToken || !parsed?.refreshToken || !parsed?.user) return null;
    return { ...parsed, rememberMe: parsed.rememberMe ?? Boolean(local) };
  } catch {
    return null;
  }
}

function writeStored(value: StoredAuth | null) {
  try {
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  if (!value) return;
  const rememberMe = value.rememberMe !== false;
  persistStore(rememberMe).setItem(STORAGE_KEY, JSON.stringify({ ...value, rememberMe }));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<DesktopUser | null>(() => readStored()?.user ?? null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const tokensRef = useRef<{
    accessToken: string | null;
    refreshToken: string | null;
    rememberMe: boolean;
  }>({
    accessToken: readStored()?.accessToken ?? null,
    refreshToken: readStored()?.refreshToken ?? null,
    rememberMe: readStored()?.rememberMe !== false,
  });
  const refreshPromiseRef = useRef<Promise<string | null> | null>(null);

  const persist = useCallback((next: StoredAuth | null) => {
    tokensRef.current = {
      accessToken: next?.accessToken ?? null,
      refreshToken: next?.refreshToken ?? null,
      rememberMe: next?.rememberMe !== false,
    };
    writeStored(next);
    setUser(next?.user ?? null);
  }, []);

  const applyAuth = useCallback(
    (
      result: { user: DesktopUser; accessToken: string; refreshToken: string },
      rememberMe = tokensRef.current.rememberMe,
    ) => {
      persist({
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        rememberMe,
      });
    },
    [persist],
  );

  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    if (refreshPromiseRef.current) return refreshPromiseRef.current;

    refreshPromiseRef.current = (async () => {
      const refreshToken = tokensRef.current.refreshToken;
      if (!refreshToken) return null;
      try {
        const result = await refreshRequest(refreshToken);
        applyAuth(result);
        return result.accessToken;
      } catch (err) {
        if (isOfflineError(err) || isTransientServerError(err)) throw err;
        if (isSessionDead(err) || (isApiError(err) && (err.status === 401 || err.status === 403))) {
          persist(null);
        }
        return null;
      } finally {
        refreshPromiseRef.current = null;
      }
    })();

    return refreshPromiseRef.current;
  }, [applyAuth, persist]);

  configureApiAuth({
    getAccessToken: () => tokensRef.current.accessToken,
    refreshAccessToken,
  });

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
        rememberMe: stored.rememberMe !== false,
      };
      if (!cancelled) setUser(stored.user);

      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        if (!cancelled) setIsBootstrapping(false);
        return;
      }

      try {
        const { user: me } = await meRequest();
        if (cancelled) return;
        persist({ ...stored, user: me });
      } catch (err) {
        if (cancelled) return;
        if (isOfflineError(err) || isTransientServerError(err)) {
          return;
        }
        try {
          const token = await refreshAccessToken();
          if (!token && isSessionDead(err)) persist(null);
        } catch (refreshErr) {
          if (!isOfflineError(refreshErr) && !isTransientServerError(refreshErr) && isSessionDead(refreshErr)) {
            persist(null);
          }
        }
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
    async (email: string, password: string, rememberMe = true) => {
      setRememberPref(rememberMe);
      const result = await loginRequest({ email, password, rememberMe });
      applyAuth(result, rememberMe);
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
      rememberMe?: boolean;
    }) => {
      const rememberMe = input.rememberMe !== false;
      setRememberPref(rememberMe);
      const result = await registerRequest({ ...input, rememberMe });
      applyAuth(result, rememberMe);
    },
    [applyAuth],
  );

  const completeOAuth = useCallback(
    async (code: string) => {
      const rememberMe = rememberPref();
      const result = await googleExchangeRequest(code);
      applyAuth(result, rememberMe);
    },
    [applyAuth],
  );

  const applySession = useCallback(
    (result: AuthResponse, rememberMe = rememberPref()) => {
      setRememberPref(rememberMe);
      applyAuth(result, rememberMe);
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
      const { accessToken, refreshToken, rememberMe } = tokensRef.current;
      if (!accessToken || !refreshToken) {
        setUser(nextUser);
        return;
      }
      persist({ user: nextUser, accessToken, refreshToken, rememberMe });
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
      completeOAuth,
      applySession,
      logout,
      updateProfile,
      uploadAvatar,
    }),
    [
      user,
      isBootstrapping,
      login,
      register,
      completeOAuth,
      applySession,
      logout,
      updateProfile,
      uploadAvatar,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
