import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { notificationsApi, type AppNotification } from '@/lib/api';
import { patchSocketHandlers } from '@/lib/socket/socket';

import { useAuth } from './AuthContext';

interface NotificationContextValue {
  items: AppNotification[];
  unreadCount: number;
  isLoading: boolean;
  hasMore: boolean;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  markRead: (ids: string[]) => Promise<void>;
  markAllRead: () => Promise<void>;
  remove: (id: string) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

const PAGE_SIZE = 30;

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();

  const [items, setItems] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    try {
      const result = await notificationsApi.listNotifications({ limit: PAGE_SIZE });
      setItems(result.notifications ?? []);
      setUnreadCount(result.unreadCount ?? 0);
      setCursor(result.nextCursor);
      setHasMore(Boolean(result.nextCursor));
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      setItems([]);
      setUnreadCount(0);
      setCursor(null);
      setHasMore(false);
      return;
    }
    void refresh();
  }, [isAuthenticated, refresh]);

  useEffect(() => {
    patchSocketHandlers({
      onNotificationNew: ({ notification }) => {
        setItems((prev) => [notification, ...prev.filter((entry) => entry.id !== notification.id)]);
        setUnreadCount((count) => count + 1);
      },
      onNotificationUnreadCount: ({ count }) => setUnreadCount(count),
      onNotificationRead: ({ ids, all }) => {
        const readAt = new Date().toISOString();
        if (all) {
          setItems((prev) => prev.map((entry) => (entry.readAt ? entry : { ...entry, readAt })));
          setUnreadCount(0);
          return;
        }
        if (!ids?.length) return;
        const idSet = new Set(ids);
        setItems((prev) => prev.map((entry) => (idSet.has(entry.id) ? { ...entry, readAt } : entry)));
      },
    });
  }, []);

  const loadMore = useCallback(async () => {
    if (!cursor || isLoading) return;
    setIsLoading(true);
    try {
      const result = await notificationsApi.listNotifications({ limit: PAGE_SIZE, cursor });
      setItems((prev) => {
        const seen = new Set(prev.map((entry) => entry.id));
        return [...prev, ...(result.notifications ?? []).filter((entry) => !seen.has(entry.id))];
      });
      setCursor(result.nextCursor);
      setHasMore(Boolean(result.nextCursor));
    } finally {
      setIsLoading(false);
    }
  }, [cursor, isLoading]);

  const markRead = useCallback(async (ids: string[]) => {
    if (!ids.length) return;
    const readAt = new Date().toISOString();
    const idSet = new Set(ids);
    setItems((prev) => prev.map((entry) => (idSet.has(entry.id) ? { ...entry, readAt } : entry)));
    try {
      const result = await notificationsApi.markNotificationsRead(ids);
      setUnreadCount(result.unreadCount);
    } catch {
      // The socket broadcast reconciles state if the request fails.
    }
  }, []);

  const markAllRead = useCallback(async () => {
    const readAt = new Date().toISOString();
    setItems((prev) => prev.map((entry) => (entry.readAt ? entry : { ...entry, readAt })));
    setUnreadCount(0);
    await notificationsApi.markAllNotificationsRead();
  }, []);

  const remove = useCallback(async (id: string) => {
    setItems((prev) => prev.filter((entry) => entry.id !== id));
    const result = await notificationsApi.deleteNotification(id);
    setUnreadCount(result.unreadCount);
  }, []);

  const value = useMemo<NotificationContextValue>(
    () => ({ items, unreadCount, isLoading, hasMore, refresh, loadMore, markRead, markAllRead, remove }),
    [items, unreadCount, isLoading, hasMore, refresh, loadMore, markRead, markAllRead, remove],
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used inside NotificationProvider');
  return ctx;
}
