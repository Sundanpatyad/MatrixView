import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import type { PresenceUser } from '@/lib/api/types';
import {
  connectSocket,
  disconnectSocket,
  ensureSocketConnected,
  isSocketConnected,
  patchSocketHandlers,
  socketActions,
} from '@/lib/socket/socket';

import { useAuth } from './AuthContext';

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

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isBootstrapping } = useAuth();
  const meId = user?.id ?? '';
  const [connected, setConnected] = useState(isSocketConnected());
  const [presence, setPresence] = useState<PresenceMap>({});

  useEffect(() => {
    if (!isAuthenticated || !meId) {
      if (isBootstrapping) return;
      disconnectSocket();
      setConnected(false);
      setPresence({});
      return;
    }

    patchSocketHandlers({
      onConnectionChange: (next) => {
        setConnected(next);
        setPresence((prev) =>
          upsertPresence(prev, {
            userId: meId,
            checkedIn: prev[meId]?.checkedIn ?? false,
            online: next,
          }),
        );
        if (next) socketActions.requestPresence();
      },
      onPresenceSnapshot: ({ users: snapshot }) => {
        setPresence((prev) => {
          const next = { ...prev };
          for (const entry of snapshot ?? []) {
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

    void connectSocket().then((socket) => {
      if (socket?.connected) {
        setConnected(true);
        socketActions.requestPresence();
      }
    });
  }, [isAuthenticated, isBootstrapping, meId]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const onChange = (state: AppStateStatus) => {
      if (state === 'active') ensureSocketConnected();
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [isAuthenticated]);

  const reconnect = useCallback(async () => {
    if (!isAuthenticated) return false;
    await connectSocket();
    ensureSocketConnected();
    const ok = isSocketConnected();
    setConnected(ok);
    if (ok) socketActions.requestPresence();
    return ok;
  }, [isAuthenticated]);

  const seedPresence = useCallback(
    (users: Array<{ id: string; online?: boolean; checkedIn?: boolean }>) => {
      setPresence((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const entry of users) {
          if (next[entry.id]) continue;
          next[entry.id] = {
            userId: entry.id,
            online: Boolean(entry.online),
            checkedIn: Boolean(entry.checkedIn),
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
