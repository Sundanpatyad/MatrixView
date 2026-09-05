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
  hasSocketHold,
  isSocketConnected,
  patchSocketHandlers,
  socketActions,
} from '@/lib/socket/socket';

import { useAuth } from './AuthContext';

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

/** How long the app may sit in the background before the user reads as Offline. */
const BACKGROUND_DISCONNECT_MS = 20_000;

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

  // Presence follows the app: foreground means Online, and leaving the app for
  // more than a moment means Offline. The delay keeps a quick app switch (or a
  // permission dialog) from flickering the dot.
  useEffect(() => {
    if (!isAuthenticated) return;
    let leaveTimer: ReturnType<typeof setTimeout> | null = null;

    const cancelLeave = () => {
      if (!leaveTimer) return;
      clearTimeout(leaveTimer);
      leaveTimer = null;
    };

    const scheduleLeave = () => {
      cancelLeave();
      leaveTimer = setTimeout(() => {
        leaveTimer = null;
        if (AppState.currentState === 'active') return;
        // An in-progress call keeps signaling alive in the background; check
        // again once it has ended.
        if (hasSocketHold()) {
          scheduleLeave();
          return;
        }
        disconnectSocket({ preserveRooms: true });
        setConnected(false);
      }, BACKGROUND_DISCONNECT_MS);
    };

    const onChange = (state: AppStateStatus) => {
      if (state === 'active') {
        cancelLeave();
        void connectSocket().then(() => {
          ensureSocketConnected();
          setConnected(isSocketConnected());
          socketActions.requestPresence();
        });
        return;
      }
      if (state !== 'background') return;
      scheduleLeave();
    };

    const sub = AppState.addEventListener('change', onChange);
    return () => {
      cancelLeave();
      sub.remove();
    };
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
