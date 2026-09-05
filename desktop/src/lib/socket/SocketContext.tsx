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
    () => ({ connected, presence, reconnect, seedPresence }),
    [connected, presence, reconnect, seedPresence],
  );

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be used within SocketProvider');
  return ctx;
}
