import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import {
  connectChatSocket,
  disconnectChatSocket,
  ensureChatSocketConnected,
  getChatSocket,
  patchChatSocketHandlers,
  requestPresenceSnapshot,
  type PresenceUser,
} from '@/lib/socket/chatSocket';

type PresenceMap = Record<string, PresenceUser>;

type SocketContextValue = {
  connected: boolean;
  presence: PresenceMap;
  isOnline: (userId?: string | null) => boolean;
  reconnect: () => Promise<boolean>;
  seedPresence: (
    users: Array<{ id: string; online?: boolean; checkedIn?: boolean }>,
  ) => void;
};

const SocketContext = createContext<SocketContextValue | null>(null);

function upsertPresence(prev: PresenceMap, entry: PresenceUser): PresenceMap {
  const existing = prev[entry.userId];
  if (
    existing &&
    existing.online === entry.online &&
    existing.checkedIn === entry.checkedIn
  ) {
    return prev;
  }
  return { ...prev, [entry.userId]: entry };
}

/**
 * Owns the Socket.IO connection for the logged-in session.
 * Screens must only patch handlers — they must not connect or disconnect.
 */
export function SocketProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isBootstrapping } = useAuth();
  const meId = user?.id ?? '';
  const [connected, setConnected] = useState(false);
  const [presence, setPresence] = useState<PresenceMap>({});

  useEffect(() => {
    if (!isAuthenticated || !meId) {
      if (isBootstrapping) return;
      disconnectChatSocket();
      setConnected(false);
      setPresence({});
      return;
    }

    patchChatSocketHandlers({
      onConnect: () => {
        setConnected(true);
        setPresence((prev) =>
          upsertPresence(prev, {
            userId: meId,
            checkedIn: prev[meId]?.checkedIn ?? false,
            online: true,
          }),
        );
        requestPresenceSnapshot();
      },
      onDisconnect: () => {
        setConnected(false);
        setPresence((prev) =>
          upsertPresence(prev, {
            userId: meId,
            checkedIn: prev[meId]?.checkedIn ?? false,
            online: false,
          }),
        );
      },
      onPresenceSnapshot: (users) => {
        setPresence((prev) => {
          const next = { ...prev };
          for (const entry of users ?? []) {
            next[entry.userId] = {
              userId: entry.userId,
              checkedIn: Boolean(entry.checkedIn),
              online: Boolean(entry.online),
            };
          }
          return next;
        });
      },
      onPresenceUpdate: (entry) => {
        setPresence((prev) =>
          upsertPresence(prev, {
            userId: entry.userId,
            checkedIn: Boolean(entry.checkedIn),
            online: Boolean(entry.online),
          }),
        );
      },
    }, { lifecycle: true });

    const already = getChatSocket();
    if (already?.connected) {
      setConnected(true);
      requestPresenceSnapshot();
      return;
    }

    void connectChatSocket().then((socket) => {
      if (socket?.connected) {
        setConnected(true);
        requestPresenceSnapshot();
      }
    });
  }, [isAuthenticated, isBootstrapping, meId]);

  const reconnect = useCallback(async () => {
    if (!isAuthenticated || !meId) return false;
    const socket = await ensureChatSocketConnected({ attempts: 5, force: false });
    const ok = Boolean(socket?.connected);
    setConnected(ok);
    if (ok) requestPresenceSnapshot();
    return ok;
  }, [isAuthenticated, meId]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const refresh = () => {
      if (document.visibilityState === 'hidden') return;
      void reconnect();
    };
    // Closing the tab / quitting the app should read as Offline right away
    // instead of waiting for the server to notice a half-open socket.
    const goOffline = () => disconnectChatSocket();
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    window.addEventListener('pagehide', goOffline);
    return () => {
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
      window.removeEventListener('pagehide', goOffline);
    };
  }, [isAuthenticated, reconnect]);

  const isOnline = useCallback(
    (userId?: string | null) => {
      if (!userId) return false;
      if (userId === meId) return connected || Boolean(presence[userId]?.online);
      return Boolean(presence[userId]?.online);
    },
    [connected, meId, presence],
  );

  const seedPresence = useCallback(
    (users: Array<{ id: string; online?: boolean; checkedIn?: boolean }>) => {
      setPresence((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const user of users) {
          if (next[user.id]) continue;
          next[user.id] = {
            userId: user.id,
            online: Boolean(user.online),
            checkedIn: Boolean(user.checkedIn),
          };
          changed = true;
        }
        return changed ? next : prev;
      });
    },
    [],
  );

  const value = useMemo(
    () => ({ connected, presence, isOnline, reconnect, seedPresence }),
    [connected, presence, isOnline, reconnect, seedPresence],
  );

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be used within SocketProvider');
  return ctx;
}

export function useSocketOptional() {
  return useContext(SocketContext);
}
