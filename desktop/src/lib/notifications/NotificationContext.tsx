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
import { useNavigate } from 'react-router-dom';
import {
  deleteNotification,
  getUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationsRead,
  type AppNotification,
} from '@/lib/api/notifications';
import { useAuth } from '@/lib/auth/AuthContext';
import { patchChatSocketHandlers } from '@/lib/socket/chatSocket';

type NotificationContextValue = {
  items: AppNotification[];
  unreadCount: number;
  loading: boolean;
  hasMore: boolean;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  markRead: (ids: string[]) => Promise<void>;
  markAllRead: () => Promise<void>;
  remove: (id: string) => Promise<void>;
  openNotification: (n: AppNotification) => Promise<void>;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

function upsertFront(list: AppNotification[], next: AppNotification) {
  const without = list.filter((n) => n.id !== next.id);
  return [next, ...without];
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isAuthenticated || !user) {
      setItems([]);
      setUnreadCount(0);
      setNextCursor(null);
      return;
    }
    setLoading(true);
    try {
      const data = await listNotifications({ limit: 40 });
      setItems(data.notifications);
      setUnreadCount(data.unreadCount);
      setNextCursor(data.nextCursor);
    } catch {
      /* keep prior */
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, user]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || !isAuthenticated) return;
    try {
      const data = await listNotifications({ limit: 40, cursor: nextCursor });
      setItems((prev) => {
        const seen = new Set(prev.map((n) => n.id));
        return [...prev, ...data.notifications.filter((n) => !seen.has(n.id))];
      });
      setUnreadCount(data.unreadCount);
      setNextCursor(data.nextCursor);
    } catch {
      /* ignore */
    }
  }, [nextCursor, isAuthenticated]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!isAuthenticated) return;
    void getUnreadCount()
      .then((r) => setUnreadCount(r.count))
      .catch(() => undefined);
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    patchChatSocketHandlers({
      onNotificationNew: (notification) => {
        setItems((prev) => upsertFront(prev, notification));
      },
      onNotificationUnreadCount: (count) => {
        setUnreadCount(count);
      },
      onNotificationRead: (payload) => {
        if (payload.all) {
          setItems((prev) =>
            prev.map((n) => (n.readAt ? n : { ...n, readAt: new Date().toISOString() })),
          );
          setUnreadCount(0);
          return;
        }
        const ids = new Set(payload.ids ?? []);
        if (ids.size === 0) return;
        setItems((prev) =>
          prev.map((n) =>
            ids.has(n.id) && !n.readAt ? { ...n, readAt: new Date().toISOString() } : n,
          ),
        );
      },
    });
    return () => {
      patchChatSocketHandlers({
        onNotificationNew: undefined,
        onNotificationUnreadCount: undefined,
        onNotificationRead: undefined,
      });
    };
  }, [isAuthenticated]);

  const itemsRef = useRef(items);
  itemsRef.current = items;

  const markRead = useCallback(async (ids: string[]) => {
    const unique = [...new Set(ids.filter(Boolean))];
    if (unique.length === 0) return;

    const delta = itemsRef.current.filter(
      (n) => unique.includes(n.id) && !n.readAt,
    ).length;
    if (delta === 0) {
      // Still sync with server in case local state is stale
      try {
        const res = await markNotificationsRead(unique);
        setUnreadCount(res.unreadCount);
      } catch {
        /* ignore */
      }
      return;
    }

    const now = new Date().toISOString();
    setItems((prev) =>
      prev.map((n) =>
        unique.includes(n.id) && !n.readAt ? { ...n, readAt: now } : n,
      ),
    );
    setUnreadCount((c) => Math.max(0, c - delta));

    try {
      const res = await markNotificationsRead(unique);
      setUnreadCount(res.unreadCount);
    } catch {
      void refresh();
    }
  }, [refresh]);

  const markAllRead = useCallback(async () => {
    setItems((prev) =>
      prev.map((n) => (n.readAt ? n : { ...n, readAt: new Date().toISOString() })),
    );
    setUnreadCount(0);
    try {
      const res = await markAllNotificationsRead();
      setUnreadCount(res.unreadCount);
    } catch {
      void refresh();
    }
  }, [refresh]);

  const remove = useCallback(async (id: string) => {
    let wasUnread = false;
    setItems((prev) => {
      const target = prev.find((n) => n.id === id);
      wasUnread = Boolean(target && !target.readAt);
      return prev.filter((n) => n.id !== id);
    });
    if (wasUnread) setUnreadCount((c) => Math.max(0, c - 1));
    try {
      const res = await deleteNotification(id);
      setUnreadCount(res.unreadCount);
    } catch {
      void refresh();
    }
  }, [refresh]);

  const openNotification = useCallback(
    async (n: AppNotification) => {
      if (!n.readAt) await markRead([n.id]);
      if (n.href) navigate(n.href);
    },
    [markRead, navigate],
  );

  const value = useMemo<NotificationContextValue>(
    () => ({
      items,
      unreadCount,
      loading,
      hasMore: Boolean(nextCursor),
      refresh,
      loadMore,
      markRead,
      markAllRead,
      remove,
      openNotification,
    }),
    [
      items,
      unreadCount,
      loading,
      nextCursor,
      refresh,
      loadMore,
      markRead,
      markAllRead,
      remove,
      openNotification,
    ],
  );

  return (
    <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}
