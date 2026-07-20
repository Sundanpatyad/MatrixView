import { io, type Socket } from 'socket.io-client';
import {
  API_BASE,
  peekAccessToken,
  refreshApiAccessToken,
} from '@/lib/api/client';
import type { ChatConversation, ChatMessage } from '@/lib/api/chat';
import type { AppNotification } from '@/lib/api/notifications';

export type PresenceUser = {
  userId: string;
  checkedIn: boolean;
  online: boolean;
};

export type TypingUpdate = {
  conversationId: string;
  userId: string;
  userName: string;
  typing: boolean;
};

export type MessageStatusUpdate = {
  messageId: string;
  conversationId: string;
  status: 'sent' | 'delivered' | 'read';
  receipts: Array<{
    userId: string;
    deliveredAt: string | null;
    readAt: string | null;
  }>;
};

type ChatHandlers = {
  onPresenceSnapshot?: (users: PresenceUser[]) => void;
  onPresenceUpdate?: (user: PresenceUser) => void;
  onMessageNew?: (message: ChatMessage) => void;
  onMessageEdited?: (message: ChatMessage) => void;
  onMessageDeleted?: (message: ChatMessage) => void;
  onMessageStatus?: (update: MessageStatusUpdate) => void;
  onTyping?: (update: TypingUpdate) => void;
  onConversationUpsert?: (conversation: ChatConversation) => void;
  onConversationRemoved?: (conversationId: string) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
};

type NotificationHandlers = {
  onNotificationNew?: (notification: AppNotification) => void;
  onNotificationRead?: (payload: { id?: string; all?: boolean }) => void;
  onUnreadCount?: (count: number) => void;
};

let socket: Socket | null = null;
let chatHandlers: ChatHandlers = {};
let notificationHandlers: NotificationHandlers = {};

function bindSocket(s: Socket) {
  s.on('connect', () => chatHandlers.onConnect?.());
  s.on('disconnect', () => chatHandlers.onDisconnect?.());

  s.on('presence:snapshot', (payload: { users: PresenceUser[] }) => {
    chatHandlers.onPresenceSnapshot?.(payload.users ?? []);
  });
  s.on('presence:update', (payload: PresenceUser) => {
    chatHandlers.onPresenceUpdate?.(payload);
  });
  s.on('message:new', (payload: { message: ChatMessage }) => {
    if (payload?.message) chatHandlers.onMessageNew?.(payload.message);
  });
  s.on('message:edited', (payload: { message: ChatMessage }) => {
    if (payload?.message) chatHandlers.onMessageEdited?.(payload.message);
  });
  s.on('message:deleted', (payload: { message: ChatMessage }) => {
    if (payload?.message) chatHandlers.onMessageDeleted?.(payload.message);
  });
  s.on('message:status', (payload: MessageStatusUpdate) => {
    if (payload?.messageId) chatHandlers.onMessageStatus?.(payload);
  });
  s.on('typing:update', (payload: TypingUpdate) => {
    if (payload?.conversationId) chatHandlers.onTyping?.(payload);
  });
  s.on('conversation:upsert', (payload: { conversation: ChatConversation }) => {
    if (payload?.conversation) chatHandlers.onConversationUpsert?.(payload.conversation);
  });
  s.on('conversation:removed', (payload: { conversationId: string }) => {
    if (payload?.conversationId) chatHandlers.onConversationRemoved?.(payload.conversationId);
  });

  s.on('notification:new', (payload: { notification: AppNotification }) => {
    if (payload?.notification) notificationHandlers.onNotificationNew?.(payload.notification);
  });
  s.on('notification:read', (payload: { id?: string; all?: boolean }) => {
    notificationHandlers.onNotificationRead?.(payload ?? {});
  });
  s.on('notification:unread_count', (payload: { count: number }) => {
    if (typeof payload?.count === 'number') {
      notificationHandlers.onUnreadCount?.(payload.count);
    }
  });
}

export function setChatSocketHandlers(next: ChatHandlers) {
  chatHandlers = next;
}

export function setNotificationSocketHandlers(next: NotificationHandlers) {
  notificationHandlers = next;
}

/** Shared realtime socket for chat + notifications (connect while authenticated). */
export async function connectChatSocket() {
  const token = peekAccessToken() || (await refreshApiAccessToken());
  if (!token) return null;

  if (socket?.connected) return socket;

  if (socket) {
    socket.auth = { token };
    socket.connect();
    return socket;
  }

  socket = io(API_BASE || undefined, {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    auth: { token },
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
  });

  bindSocket(socket);

  socket.io.on('reconnect_attempt', async () => {
    const next = peekAccessToken() || (await refreshApiAccessToken());
    if (next && socket) socket.auth = { token: next };
  });

  return socket;
}

export function disconnectChatSocket() {
  if (!socket) return;
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
  chatHandlers = {};
  notificationHandlers = {};
}

export function getChatSocket() {
  return socket;
}

export function joinConversation(conversationId: string) {
  socket?.emit('conversation:join', { conversationId });
}

export function leaveConversation(conversationId: string) {
  socket?.emit('conversation:leave', { conversationId });
}

export function emitTypingStart(conversationId: string) {
  socket?.emit('typing:start', { conversationId });
}

export function emitTypingStop(conversationId: string) {
  socket?.emit('typing:stop', { conversationId });
}

export function emitMessagesRead(conversationId: string) {
  socket?.emit('messages:read', { conversationId });
}
