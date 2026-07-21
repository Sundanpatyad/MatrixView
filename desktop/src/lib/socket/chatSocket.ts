import { io, type Socket } from 'socket.io-client';
import {
  API_BASE,
  peekAccessToken,
  refreshApiAccessToken,
} from '@/lib/api/client';
import type { ChatConversation, ChatMessage } from '@/lib/api/chat';
import type { BoardTask, Project, ProjectTeam } from '@/lib/workspace/types';

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

export type CallIncomingPayload = {
  callId: string;
  conversationId: string;
  fromUserId: string;
  fromName: string;
  mediaKind?: 'audio' | 'video';
  isGroup?: boolean;
  conversationName?: string;
};

export type CallAcceptedPayload = {
  callId: string;
  conversationId: string;
  fromUserId: string;
};

export type CallSdpPayload = {
  callId: string;
  conversationId: string;
  fromUserId: string;
  fromName?: string;
  sdp: RTCSessionDescriptionInit;
};

export type CallIcePayload = {
  callId: string;
  conversationId: string;
  fromUserId: string;
  candidate: RTCIceCandidateInit | null;
};

export type CallEndedPayload = {
  callId: string;
  conversationId: string;
  fromUserId: string;
  reason?: string;
};

export type CallPeerJoinedPayload = {
  callId: string;
  conversationId: string;
  userId: string;
  name: string;
};

export type CallPeerLeftPayload = {
  callId: string;
  conversationId: string;
  userId: string;
  reason?: string;
};

export type CallRoomPayload = {
  conversationId: string;
  active: boolean;
  room: {
    callId: string;
    conversationId: string;
    mediaKind: 'audio' | 'video';
    initiatedBy: string;
    participantCount: number;
    participants: Array<{ userId: string; name: string }>;
    members?: Array<{ userId: string; name: string | null; joined: boolean }>;
    raisedHands?: string[];
    spotlightUserId?: string | null;
  } | null;
};

export type CallScreenPayload = {
  callId: string;
  conversationId: string;
  fromUserId: string;
  active: boolean;
};

export type CallHandPayload = {
  callId: string;
  conversationId: string;
  fromUserId: string;
  raised: boolean;
};

export type CallReactionPayload = {
  callId: string;
  conversationId: string;
  fromUserId: string;
  emoji: string;
};

export type CallSpotlightPayload = {
  callId: string;
  conversationId: string;
  fromUserId: string;
  targetUserId: string | null;
};

export type BoardTaskEventPayload = {
  projectId: string;
  task: BoardTask;
  actorId?: string;
  changed?: string[];
};

export type BoardColumnsEventPayload = {
  projectId: string;
  project: Project;
  tasks?: BoardTask[];
  actorId?: string;
};

export type BoardTeamEventPayload = {
  projectId: string;
  team?: ProjectTeam;
  teamId?: string;
  actorId?: string;
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
  onCallIncoming?: (payload: CallIncomingPayload) => void;
  onCallAccepted?: (payload: CallAcceptedPayload) => void;
  onCallOffer?: (payload: CallSdpPayload) => void;
  onCallAnswer?: (payload: CallSdpPayload) => void;
  onCallIce?: (payload: CallIcePayload) => void;
  onCallEnded?: (payload: CallEndedPayload) => void;
  onCallPeerJoined?: (payload: CallPeerJoinedPayload) => void;
  onCallPeerLeft?: (payload: CallPeerLeftPayload) => void;
  onCallRoom?: (payload: CallRoomPayload) => void;
  onCallScreen?: (payload: CallScreenPayload) => void;
  onCallHand?: (payload: CallHandPayload) => void;
  onCallReaction?: (payload: CallReactionPayload) => void;
  onCallSpotlight?: (payload: CallSpotlightPayload) => void;
  onTaskCreated?: (payload: BoardTaskEventPayload) => void;
  onTaskUpdated?: (payload: BoardTaskEventPayload) => void;
  onProjectColumns?: (payload: BoardColumnsEventPayload) => void;
  onTeamUpserted?: (payload: BoardTeamEventPayload) => void;
  onTeamDeleted?: (payload: BoardTeamEventPayload) => void;
  onNotificationNew?: (notification: import('@/lib/api/notifications').AppNotification) => void;
  onNotificationUnreadCount?: (count: number) => void;
  onNotificationRead?: (payload: { ids?: string[]; all?: boolean }) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
};

let socket: Socket | null = null;
let handlers: Handlers = {};
let connectInFlight: Promise<Socket | null> | null = null;
let heartbeatTimer: number | null = null;
let lastPongAt = 0;

const HEARTBEAT_MS = 20_000;
const PING_STALE_MS = 45_000;

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function stopHeartbeat() {
  if (heartbeatTimer != null) {
    window.clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

function startHeartbeat(s: Socket) {
  stopHeartbeat();
  lastPongAt = Date.now();
  heartbeatTimer = window.setInterval(() => {
    if (!s.connected) return;
    if (lastPongAt && Date.now() - lastPongAt > PING_STALE_MS) {
      try {
        s.disconnect();
        s.connect();
      } catch {
        /* ignore */
      }
      return;
    }
    s.emit('client:ping', { t: Date.now() });
  }, HEARTBEAT_MS);
}

export function isChatSocketConnected() {
  return Boolean(socket?.connected);
}

function waitForConnect(s: Socket, timeoutMs: number): Promise<boolean> {
  if (s.connected) return Promise.resolve(true);
  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      s.off('connect', onConnect);
      s.off('connect_error', onError);
      resolve(ok);
    };
    const onConnect = () => finish(true);
    const onError = () => {
      /* keep waiting until timeout — socket.io will retry */
    };
    const timer = window.setTimeout(() => finish(s.connected), timeoutMs);
    s.once('connect', onConnect);
    s.on('connect_error', onError);
  });
}

async function refreshSocketAuth() {
  const next = peekAccessToken() || (await refreshApiAccessToken());
  if (next && socket) socket.auth = { token: next };
  return next;
}

function bindSocket(s: Socket) {
  s.on('connect', () => {
    lastPongAt = Date.now();
    startHeartbeat(s);
    // Kick an immediate ping so the path is warm
    s.emit('client:ping', { t: Date.now() });
    handlers.onConnect?.();
  });
  s.on('disconnect', () => {
    stopHeartbeat();
    handlers.onDisconnect?.();
  });
  s.on('connect_error', () => {
    void refreshSocketAuth();
  });
  s.on('client:pong', () => {
    lastPongAt = Date.now();
  });

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
  s.on('call:incoming', (payload: CallIncomingPayload) => {
    if (payload?.callId) handlers.onCallIncoming?.(payload);
  });
  s.on('call:accepted', (payload: CallAcceptedPayload) => {
    if (payload?.callId) handlers.onCallAccepted?.(payload);
  });
  s.on('call:offer', (payload: CallSdpPayload) => {
    if (payload?.callId && payload.sdp) handlers.onCallOffer?.(payload);
  });
  s.on('call:answer', (payload: CallSdpPayload) => {
    if (payload?.callId && payload.sdp) handlers.onCallAnswer?.(payload);
  });
  s.on('call:ice', (payload: CallIcePayload) => {
    if (payload?.callId) handlers.onCallIce?.(payload);
  });
  s.on('call:ended', (payload: CallEndedPayload) => {
    if (payload?.callId) handlers.onCallEnded?.(payload);
  });
  s.on('call:peer-joined', (payload: CallPeerJoinedPayload) => {
    if (payload?.callId && payload.userId) handlers.onCallPeerJoined?.(payload);
  });
  s.on('call:peer-left', (payload: CallPeerLeftPayload) => {
    if (payload?.callId && payload.userId) handlers.onCallPeerLeft?.(payload);
  });
  s.on('call:room', (payload: CallRoomPayload) => {
    if (payload?.conversationId) handlers.onCallRoom?.(payload);
  });
  s.on('call:screen', (payload: CallScreenPayload) => {
    if (payload?.callId) handlers.onCallScreen?.(payload);
  });
  s.on('call:hand', (payload: CallHandPayload) => {
    if (payload?.callId) handlers.onCallHand?.(payload);
  });
  s.on('call:reaction', (payload: CallReactionPayload) => {
    if (payload?.callId && payload.emoji) handlers.onCallReaction?.(payload);
  });
  s.on('call:spotlight', (payload: CallSpotlightPayload) => {
    if (payload?.callId) handlers.onCallSpotlight?.(payload);
  });
  s.on('task:created', (payload: BoardTaskEventPayload) => {
    if (payload?.task?.id) handlers.onTaskCreated?.(payload);
  });
  s.on('task:updated', (payload: BoardTaskEventPayload) => {
    if (payload?.task?.id) handlers.onTaskUpdated?.(payload);
  });
  s.on('project:columns', (payload: BoardColumnsEventPayload) => {
    if (payload?.project?.id) handlers.onProjectColumns?.(payload);
  });
  s.on('team:upserted', (payload: BoardTeamEventPayload) => {
    if (payload?.team?.id) handlers.onTeamUpserted?.(payload);
  });
  s.on('team:deleted', (payload: BoardTeamEventPayload) => {
    if (payload?.teamId) handlers.onTeamDeleted?.(payload);
  });
  s.on(
    'notification:new',
    (payload: { notification: import('@/lib/api/notifications').AppNotification }) => {
      if (payload?.notification) handlers.onNotificationNew?.(payload.notification);
    },
  );
  s.on('notification:unread-count', (payload: { count: number }) => {
    if (typeof payload?.count === 'number') handlers.onNotificationUnreadCount?.(payload.count);
  });
  s.on('notification:read', (payload: { ids?: string[]; all?: boolean }) => {
    handlers.onNotificationRead?.(payload ?? {});
  });
}

/** Replace all handlers (prefer patchChatSocketHandlers for partial updates). */
export function setChatSocketHandlers(next: Handlers) {
  handlers = next;
}

/** Merge handlers so CallProvider + ChatPage can coexist. */
export function patchChatSocketHandlers(partial: Partial<Handlers>) {
  handlers = { ...handlers, ...partial };
}

/** Remove specific handler keys without touching the rest. */
export function clearChatSocketHandlerKeys(keys: Array<keyof Handlers>) {
  const next = { ...handlers };
  for (const key of keys) {
    delete next[key];
  }
  handlers = next;
}

export async function connectChatSocket() {
  if (socket?.connected) return socket;
  if (connectInFlight) return connectInFlight;

  connectInFlight = (async () => {
    const token = peekAccessToken() || (await refreshApiAccessToken());
    if (!token) return null;

    if (socket?.connected) return socket;

    if (socket) {
      socket.auth = { token };
      if (!socket.connected) socket.connect();
      await waitForConnect(socket, 8_000);
      return socket.connected ? socket : socket;
    }

    socket = io(API_BASE || undefined, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      auth: { token },
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10_000,
      timeout: 10_000,
      // Engine.IO keepalive — complements app-level client:ping / client:pong
      withCredentials: true,
    });

    bindSocket(socket);

    socket.io.on('reconnect_attempt', () => {
      void refreshSocketAuth();
    });

    await waitForConnect(socket, 8_000);
    if (socket.connected) {
      lastPongAt = Date.now();
      startHeartbeat(socket);
    }
    return socket;
  })().finally(() => {
    connectInFlight = null;
  });

  return connectInFlight;
}

/**
 * Force a reconnect with exponential backoff.
 * Use when the UI shows disconnected / Call buttons are disabled.
 */
export async function ensureChatSocketConnected(opts?: {
  attempts?: number;
  force?: boolean;
}): Promise<Socket | null> {
  const attempts = Math.max(1, opts?.attempts ?? 5);
  const force = opts?.force ?? false;

  if (force && socket) {
    const old = socket;
    socket = null;
    connectInFlight = null;
    try {
      old.io.reconnection(false);
      old.removeAllListeners();
      old.disconnect();
    } catch {
      /* ignore */
    }
  }

  for (let i = 0; i < attempts; i++) {
    const s = await connectChatSocket();
    if (s?.connected) return s;

    if (socket && !socket.connected) {
      await refreshSocketAuth();
      socket.connect();
      const ok = await waitForConnect(socket, 6_000);
      if (ok) return socket;
    }

    await delay(Math.min(1000 * 2 ** i, 8_000));
  }

  return getChatSocket()?.connected ? socket : null;
}

export function disconnectChatSocket() {
  connectInFlight = null;
  stopHeartbeat();
  lastPongAt = 0;
  if (!socket) return;
  const old = socket;
  socket = null;
  try {
    old.io.reconnection(false);
  } catch {
    /* ignore */
  }
  old.removeAllListeners();
  old.disconnect();
  // Keep shared handlers so CallProvider + ChatPage can rebind without losing each other
  // on transient disconnects.
}

export function getChatSocket() {
  return socket;
}

/** Ask the server to re-broadcast who is socket-online (needed after late handler attach). */
export function requestPresenceSnapshot() {
  const s = socket;
  if (!s?.connected) return;
  s.emit('presence:request');
}

export function joinConversation(conversationId: string) {
  socket?.emit('conversation:join', { conversationId });
}

export function leaveConversation(conversationId: string) {
  socket?.emit('conversation:leave', { conversationId });
}

export function joinProject(projectId: string) {
  socket?.emit('project:join', { projectId });
}

export function leaveProject(projectId: string) {
  socket?.emit('project:leave', { projectId });
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

export function emitCallInvite(input: {
  conversationId: string;
  callId: string;
  mediaKind?: 'audio' | 'video';
}): Promise<{
  ok: boolean;
  error?: string;
  peerId?: string;
  isGroup?: boolean;
  peers?: Array<{ userId: string; name: string }>;
}> {
  return new Promise((resolve) => {
    if (!socket) {
      resolve({ ok: false, error: 'Not connected' });
      return;
    }
    socket.emit(
      'call:invite',
      input,
      (res: {
        ok: boolean;
        error?: string;
        peerId?: string;
        isGroup?: boolean;
        peers?: Array<{ userId: string; name: string }>;
      }) => {
        resolve(res ?? { ok: false, error: 'No response' });
      },
    );
  });
}

export function emitCallJoin(input: {
  callId: string;
  conversationId: string;
}): Promise<{
  ok: boolean;
  error?: string;
  peers?: Array<{ userId: string; name: string }>;
  mediaKind?: 'audio' | 'video';
}> {
  return new Promise((resolve) => {
    if (!socket) {
      resolve({ ok: false, error: 'Not connected' });
      return;
    }
    socket.emit(
      'call:join',
      input,
      (res: {
        ok: boolean;
        error?: string;
        peers?: Array<{ userId: string; name: string }>;
        mediaKind?: 'audio' | 'video';
      }) => {
        resolve(res ?? { ok: false, error: 'No response' });
      },
    );
  });
}

export function emitCallAccept(input: {
  callId: string;
  conversationId: string;
}): Promise<{
  ok: boolean;
  error?: string;
  isGroup?: boolean;
  peers?: Array<{ userId: string; name: string }>;
  mediaKind?: 'audio' | 'video';
}> {
  return new Promise((resolve) => {
    if (!socket) {
      resolve({ ok: false, error: 'Not connected' });
      return;
    }
    socket.emit(
      'call:accept',
      input,
      (res: {
        ok: boolean;
        error?: string;
        isGroup?: boolean;
        peers?: Array<{ userId: string; name: string }>;
        mediaKind?: 'audio' | 'video';
      }) => {
        resolve(res ?? { ok: false });
      },
    );
  });
}

export function emitCallReject(input: { callId: string; conversationId: string }) {
  socket?.emit('call:reject', input);
}

export function emitCallHangup(input: {
  callId: string;
  conversationId: string;
  reason?: string;
}) {
  socket?.emit('call:hangup', input);
}

export function emitCallOffer(input: {
  callId: string;
  conversationId: string;
  toUserId: string;
  sdp: RTCSessionDescriptionInit;
}) {
  socket?.emit('call:offer', input);
}

export function emitCallAnswer(input: {
  callId: string;
  conversationId: string;
  toUserId: string;
  sdp: RTCSessionDescriptionInit;
}) {
  socket?.emit('call:answer', input);
}

export function emitCallIce(input: {
  callId: string;
  conversationId: string;
  toUserId: string;
  candidate: RTCIceCandidateInit | null;
}) {
  socket?.emit('call:ice', input);
}

export function emitCallScreen(input: {
  callId: string;
  conversationId: string;
  active: boolean;
  toUserId?: string;
}) {
  socket?.emit('call:screen', input);
}

export function emitCallHand(input: {
  callId: string;
  conversationId: string;
  raised: boolean;
  toUserId?: string;
}) {
  socket?.emit('call:hand', input);
}

export function emitCallReaction(input: {
  callId: string;
  conversationId: string;
  emoji: string;
  toUserId?: string;
}) {
  socket?.emit('call:reaction', input);
}

export function emitCallSpotlight(input: {
  callId: string;
  conversationId: string;
  targetUserId: string | null;
  toUserId?: string;
}) {
  socket?.emit('call:spotlight', input);
}
