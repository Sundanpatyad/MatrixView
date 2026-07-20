import { io, type Socket } from 'socket.io-client';
import {
  API_BASE,
  peekAccessToken,
  refreshApiAccessToken,
} from '@/lib/api/client';
import type { ChatConversation, ChatMessage } from '@/lib/api/chat';

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

type Handlers = {
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

let socket: Socket | null = null;
let handlers: Handlers = {};

function bindSocket(s: Socket) {
  s.on('connect', () => handlers.onConnect?.());
  s.on('disconnect', () => handlers.onDisconnect?.());

  s.on('presence:snapshot', (payload: { users: PresenceUser[] }) => {
    handlers.onPresenceSnapshot?.(payload.users ?? []);
  });
  s.on('presence:update', (payload: PresenceUser) => {
    handlers.onPresenceUpdate?.(payload);
  });
  s.on('message:new', (payload: { message: ChatMessage }) => {
    if (payload?.message) handlers.onMessageNew?.(payload.message);
  });
  s.on('message:edited', (payload: { message: ChatMessage }) => {
    if (payload?.message) handlers.onMessageEdited?.(payload.message);
  });
  s.on('message:deleted', (payload: { message: ChatMessage }) => {
    if (payload?.message) handlers.onMessageDeleted?.(payload.message);
  });
  s.on('message:status', (payload: MessageStatusUpdate) => {
    if (payload?.messageId) handlers.onMessageStatus?.(payload);
  });
  s.on('typing:update', (payload: TypingUpdate) => {
    if (payload?.conversationId) handlers.onTyping?.(payload);
  });
  s.on('conversation:upsert', (payload: { conversation: ChatConversation }) => {
    if (payload?.conversation) handlers.onConversationUpsert?.(payload.conversation);
  });
  s.on('conversation:removed', (payload: { conversationId: string }) => {
    if (payload?.conversationId) handlers.onConversationRemoved?.(payload.conversationId);
  });
}

export function setChatSocketHandlers(next: Handlers) {
  handlers = next;
}

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
  handlers = {};
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
