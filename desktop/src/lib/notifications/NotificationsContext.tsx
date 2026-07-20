import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  fetchNotifications,
  markAllNotificationsReadRequest,
  markNotificationReadRequest,
  type AppNotification,
} from '@/lib/api/notifications';
import { useAuth } from '@/lib/auth/AuthContext';
import { useOffline } from '@/lib/offline/OfflineContext';
import {
  connectChatSocket,
  disconnectChatSocket,
  setNotificationSocketHandlers,
} from '@/lib/socket/chatSocket';

type NotificationsContextValue = {
  notifications: AppNotification[];
  unreadCount: number;
  isLoading: boolean;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isBootstrapping } = useAuth();
  const { online } = useOffline();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    setIsLoading(true);
    try {
      const data = await fetchNotifications({ limit: 40 });
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch {
      /* keep last good state */
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isBootstrapping) return;
    if (!isAuthenticated) {
      setNotifications([]);
      setUnreadCount(0);
      disconnectChatSocket();
      setNotificationSocketHandlers({});
      return;
    }

    void refresh();

    setNotificationSocketHandlers({
      onNotificationNew: (notification) => {
        setNotifications((prev) => {
          if (prev.some((n) => n.id === notification.id)) return prev;
          return [notification, ...prev].slice(0, 60);
        });
        // Unread badge comes from notification:unread_count (emitted with each create).
      },
      onNotificationRead: (payload) => {
        if (payload.all) {
          setNotifications((prev) =>
            prev.map((n) => (n.readAt ? n : { ...n, readAt: new Date().toISOString() })),
          );
          setUnreadCount(0);
          return;
        }
        if (payload.id) {
          setNotifications((prev) =>
            prev.map((n) =>
              n.id === payload.id
                ? { ...n, readAt: n.readAt ?? new Date().toISOString() }
                : n,
            ),
          );
        }
      },
      onUnreadCount: (count) => setUnreadCount(count),
    });

    if (online) void connectChatSocket();

    return () => {
      setNotificationSocketHandlers({});
    };
  }, [isAuthenticated, isBootstrapping, online, refresh, user?.id]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (online) void connectChatSocket();
  }, [isAuthenticated, online]);

  const markRead = useCallback(async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, readAt: n.readAt ?? new Date().toISOString() } : n,
      ),
    );
    setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await markNotificationReadRequest(id);
    } catch {
      void refresh();
    }
  }, [refresh]);

  const markAllRead = useCallback(async () => {
    setNotifications((prev) =>
      prev.map((n) => (n.readAt ? n : { ...n, readAt: new Date().toISOString() })),
    );
    setUnreadCount(0);
    try {
      await markAllNotificationsReadRequest();
    } catch {
      void refresh();
    }
  }, [refresh]);

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      isLoading,
      refresh,
      markRead,
      markAllRead,
    }),
    [notifications, unreadCount, isLoading, refresh, markRead, markAllRead],
  );

  return (
    <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider');
  return ctx;
}
