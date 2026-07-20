import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { activityTracker } from '@/lib/activity/ActivityTracker';
import { getOfflineDb, isOfflineDbAvailable } from './db';
import { syncService } from './sync';

type OfflineContextValue = {
  online: boolean;
  sqliteReady: boolean;
  syncing: boolean;
  pendingCount: number;
  lastSyncError: string | null;
  flushNow: () => Promise<void>;
};

const OfflineContext = createContext<OfflineContextValue | null>(null);

export function OfflineProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  const [online, setOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  const [sqliteReady, setSqliteReady] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !isOfflineDbAvailable()) {
      setSqliteReady(false);
      syncService.stop();
      return;
    }

    let cancelled = false;
    void (async () => {
      const db = await getOfflineDb();
      if (cancelled) return;
      setSqliteReady(Boolean(db));
      if (db) {
        syncService.setSessionMappedHandler((localId, serverId) => {
          activityTracker.remapSessionId(localId, serverId);
        });
        syncService.start();
        void syncService.flush();
      }
    })();

    const unsub = syncService.subscribe((s) => {
      setSyncing(s.syncing);
      setPendingCount(s.pending);
      setLastSyncError(s.lastError);
    });

    return () => {
      cancelled = true;
      unsub();
      syncService.stop();
    };
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    if (online && sqliteReady) void syncService.flush();
  }, [online, sqliteReady]);

  const value = useMemo(
    () => ({
      online,
      sqliteReady,
      syncing,
      pendingCount,
      lastSyncError,
      flushNow: () => syncService.flush(),
    }),
    [online, sqliteReady, syncing, pendingCount, lastSyncError],
  );

  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>;
}

export function useOffline() {
  const ctx = useContext(OfflineContext);
  if (!ctx) throw new Error('useOffline must be used within OfflineProvider');
  return ctx;
}
