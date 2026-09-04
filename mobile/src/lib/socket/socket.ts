import { io, type Socket } from 'socket.io-client';

import { refreshApiAccessToken } from '../api/client';
import type {
  AppNotification,
  BoardTask,
  ChatConversation,
  ChatMessage,
  PresenceUser,
  Project,
  ProjectTeam,
} from '../api/types';
import { API_BASE } from '../config';

export interface MessageStatusUpdate {
  messageId: string;
  conversationId: string;
  status: 'sent' | 'delivered' | 'read';
  receipts?: Array<{ userId: string; deliveredAt: string | null; readAt: string | null }>;
}

export interface TypingUpdate {
  conversationId: string;
  userId: string;
  userName: string;
  typing: boolean;
}

export interface BoardTaskEvent {
  projectId: string;
  task: BoardTask;
  actorId: string;
  changed?: string[];
}

export interface BoardColumnsEvent {
  projectId: string;
  project: Project;
  actorId: string;
  tasks?: BoardTask[];
}

export interface BoardTeamEvent {
  projectId: string;
  team?: ProjectTeam;
  teamId?: string;
  actorId: string;
}

export type CallMediaKind = 'audio' | 'video';

/**
 * SDP and ICE payloads are kept structural rather than typed against
 * react-native-webrtc: the native module is absent in Expo Go, and this module
 * must stay importable there.
 */
export interface SessionDescriptionPayload {
  type?: string;
  sdp?: string;
}

export type IceCandidatePayload = Record<string, unknown> | null;

export interface CallPeer {
  userId: string;
  name: string;
}

export interface CallRoom {
  callId: string;
  conversationId: string;
  mediaKind: CallMediaKind;
  initiatedBy: string;
  participantCount: number;
  participants: CallPeer[];
  members?: Array<{ userId: string; name: string | null; joined: boolean }>;
  raisedHands?: string[];
  spotlightUserId?: string | null;
}

export interface CallIncomingPayload {
  callId: string;
  conversationId: string;
  fromUserId: string;
  fromName: string;
  mediaKind?: CallMediaKind;
  isGroup?: boolean;
  conversationName?: string;
}

export interface CallAcceptedPayload {
  callId: string;
  conversationId: string;
  fromUserId: string;
}

export interface CallEndedPayload {
  callId: string;
  conversationId: string;
  fromUserId: string;
  reason?: string;
}

export interface CallOfferPayload {
  callId: string;
  conversationId: string;
  fromUserId: string;
  fromName?: string;
  sdp: SessionDescriptionPayload;
}

export interface CallAnswerPayload {
  callId: string;
  conversationId: string;
  fromUserId: string;
  sdp: SessionDescriptionPayload;
}

export interface CallIcePayload {
  callId: string;
  conversationId: string;
  fromUserId: string;
  candidate: IceCandidatePayload;
}

export interface CallPeerJoinedPayload {
  callId: string;
  conversationId: string;
  userId: string;
  name: string;
}

export interface CallPeerLeftPayload {
  callId: string;
  conversationId: string;
  userId: string;
  reason?: string;
}

export interface CallRoomPayload {
  conversationId: string;
  active: boolean;
  room: CallRoom | null;
}

export interface CallScreenPayload {
  callId: string;
  conversationId: string;
  fromUserId: string;
  active: boolean;
}

export interface SocketHandlers {
  onConnectionChange: (connected: boolean) => void;

  onCallIncoming: (payload: CallIncomingPayload) => void;
  onCallAccepted: (payload: CallAcceptedPayload) => void;
  onCallEnded: (payload: CallEndedPayload) => void;
  onCallOffer: (payload: CallOfferPayload) => void;
  onCallAnswer: (payload: CallAnswerPayload) => void;
  onCallIce: (payload: CallIcePayload) => void;
  onCallPeerJoined: (payload: CallPeerJoinedPayload) => void;
  onCallPeerLeft: (payload: CallPeerLeftPayload) => void;
  onCallRoom: (payload: CallRoomPayload) => void;
  onCallScreen: (payload: CallScreenPayload) => void;

  onPresenceSnapshot: (payload: { users: PresenceUser[] }) => void;
  onPresenceUpdate: (payload: PresenceUser) => void;

  onMessageNew: (payload: { message: ChatMessage }) => void;
  onMessageEdited: (payload: { message: ChatMessage }) => void;
  onMessageDeleted: (payload: { message: ChatMessage }) => void;
  onMessageStatus: (payload: MessageStatusUpdate) => void;
  onTyping: (payload: TypingUpdate) => void;
  onConversationUpsert: (payload: { conversation: ChatConversation }) => void;
  onConversationRemoved: (payload: { conversationId: string }) => void;

  onTaskCreated: (payload: BoardTaskEvent) => void;
  onTaskUpdated: (payload: BoardTaskEvent) => void;
  onProjectColumns: (payload: BoardColumnsEvent) => void;
  onProjectUpdated: (payload: BoardColumnsEvent) => void;
  onProjectRemoved: (payload: { projectId: string; projectName?: string }) => void;
  onTeamUpserted: (payload: BoardTeamEvent) => void;
  onTeamDeleted: (payload: BoardTeamEvent) => void;

  onNotificationNew: (payload: { notification: AppNotification }) => void;
  onNotificationUnreadCount: (payload: { count: number }) => void;
  onNotificationRead: (payload: { ids?: string[]; all?: boolean }) => void;
  onInviteNew: (payload: { invite: import('../api/workspace').PendingInvite }) => void;
  onInviteResolved: (payload: { inviteId: string; status: 'accepted' | 'declined' }) => void;
}

type HandlerKey = keyof SocketHandlers;

/**
 * A single shared socket backs every feature. Consumers register named
 * callbacks instead of attaching their own listeners so that mounting and
 * unmounting screens never tears down the connection.
 */
const handlers: Partial<SocketHandlers> = {};

let socket: Socket | null = null;
let currentToken: string | null = null;
let connectInFlight: Promise<Socket | null> | null = null;
let heartbeat: ReturnType<typeof setInterval> | null = null;
let lastPongAt = 0;

/**
 * Room membership lives on the server socket, so it is lost on every
 * reconnect. Tracking it here also lets callers join before the socket has
 * finished connecting.
 */
const joinedConversations = new Set<string>();
const joinedProjects = new Set<string>();

const HEARTBEAT_INTERVAL_MS = 20000;
const HEARTBEAT_STALE_MS = 45000;

function call<K extends HandlerKey>(key: K, ...args: Parameters<NonNullable<SocketHandlers[K]>>) {
  const handler = handlers[key] as ((...a: unknown[]) => void) | undefined;
  if (!handler) return;
  try {
    handler(...(args as unknown[]));
  } catch (error) {
    if (__DEV__) console.warn(`[socket] handler ${key} threw`, error);
  }
}

export function setSocketHandlers(next: Partial<SocketHandlers>) {
  Object.assign(handlers, next);
}

export function patchSocketHandlers(next: Partial<SocketHandlers>) {
  Object.assign(handlers, next);
}

export function clearSocketHandlerKeys(keys: HandlerKey[]) {
  keys.forEach((key) => {
    delete handlers[key];
  });
}

function startHeartbeat(active: Socket) {
  stopHeartbeat();
  lastPongAt = Date.now();
  heartbeat = setInterval(() => {
    if (!active.connected) return;
    if (lastPongAt && Date.now() - lastPongAt > HEARTBEAT_STALE_MS) {
      active.disconnect();
      active.connect();
      lastPongAt = Date.now();
      return;
    }
    active.emit('client:ping', { t: Date.now() });
  }, HEARTBEAT_INTERVAL_MS);
}

function stopHeartbeat() {
  if (heartbeat) {
    clearInterval(heartbeat);
    heartbeat = null;
  }
}

function bindListeners(active: Socket) {
  active.on('connect', () => {
    lastPongAt = Date.now();
    joinedConversations.forEach((conversationId) => active.emit('conversation:join', { conversationId }));
    joinedProjects.forEach((projectId) => active.emit('project:join', { projectId }));
    call('onConnectionChange', true);
    active.emit('presence:request');
  });

  active.on('disconnect', () => {
    call('onConnectionChange', false);
  });

  active.on('client:pong', () => {
    lastPongAt = Date.now();
  });

  active.on('connect_error', async () => {
    call('onConnectionChange', false);
    const token = await refreshApiAccessToken().catch(() => null);
    if (token) {
      currentToken = token;
      active.auth = { token };
    }
  });

  active.io.on('reconnect_attempt', async () => {
    const token = await refreshApiAccessToken().catch(() => null);
    if (token) {
      currentToken = token;
      active.auth = { token };
    }
  });

  active.on('presence:snapshot', (payload) => call('onPresenceSnapshot', payload));
  active.on('presence:update', (payload) => call('onPresenceUpdate', payload));

  active.on('message:new', (payload) => call('onMessageNew', payload));
  active.on('message:edited', (payload) => call('onMessageEdited', payload));
  active.on('message:deleted', (payload) => call('onMessageDeleted', payload));
  active.on('message:status', (payload) => call('onMessageStatus', payload));
  active.on('typing:update', (payload) => call('onTyping', payload));
  active.on('conversation:upsert', (payload) => call('onConversationUpsert', payload));
  active.on('conversation:removed', (payload) => call('onConversationRemoved', payload));

  active.on('task:created', (payload) => call('onTaskCreated', payload));
  active.on('task:updated', (payload) => call('onTaskUpdated', payload));
  active.on('project:columns', (payload) => call('onProjectColumns', payload));
  active.on('project:updated', (payload) => call('onProjectUpdated', payload));
  active.on('project:removed', (payload) => call('onProjectRemoved', payload));
  active.on('team:upserted', (payload) => call('onTeamUpserted', payload));
  active.on('team:deleted', (payload) => call('onTeamDeleted', payload));

  active.on('notification:new', (payload) => call('onNotificationNew', payload));
  active.on('notification:unread-count', (payload) => call('onNotificationUnreadCount', payload));
  active.on('notification:read', (payload) => call('onNotificationRead', payload));
  active.on('invite:new', (payload) => call('onInviteNew', payload));
  active.on('invite:resolved', (payload) => call('onInviteResolved', payload));

  active.on('call:incoming', (payload) => call('onCallIncoming', payload));
  active.on('call:accepted', (payload) => call('onCallAccepted', payload));
  active.on('call:ended', (payload) => call('onCallEnded', payload));
  active.on('call:offer', (payload) => call('onCallOffer', payload));
  active.on('call:answer', (payload) => call('onCallAnswer', payload));
  active.on('call:ice', (payload) => call('onCallIce', payload));
  active.on('call:peer-joined', (payload) => call('onCallPeerJoined', payload));
  active.on('call:peer-left', (payload) => call('onCallPeerLeft', payload));
  active.on('call:room', (payload) => call('onCallRoom', payload));
  active.on('call:screen', (payload) => call('onCallScreen', payload));
}

export function connectSocket(token: string): Promise<Socket | null> {
  if (socket && socket.connected && currentToken === token) {
    return Promise.resolve(socket);
  }
  if (connectInFlight) return connectInFlight;

  connectInFlight = new Promise<Socket | null>((resolve) => {
    if (socket) {
      socket.removeAllListeners();
      socket.disconnect();
      socket = null;
    }

    currentToken = token;
    const active = io(API_BASE, {
      path: '/socket.io',
      transports: ['websocket'],
      auth: { token },
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      timeout: 10000,
    });

    socket = active;
    bindListeners(active);
    startHeartbeat(active);

    const settle = () => resolve(active);
    active.once('connect', settle);
    active.once('connect_error', settle);
  }).finally(() => {
    connectInFlight = null;
  });

  return connectInFlight;
}

export function disconnectSocket() {
  stopHeartbeat();
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
  currentToken = null;
  joinedConversations.clear();
  joinedProjects.clear();
  call('onConnectionChange', false);
}

export function getSocket(): Socket | null {
  return socket;
}

export function isSocketConnected(): boolean {
  return Boolean(socket?.connected);
}

/** Nudges a dropped socket back to life, e.g. when the app returns from background. */
export function ensureSocketConnected() {
  if (!socket) return;
  if (!socket.connected) socket.connect();
}

function emit(event: string, payload?: unknown) {
  if (!socket) return;
  socket.emit(event, payload);
}

export const socketActions = {
  joinConversation: (conversationId: string) => {
    joinedConversations.add(conversationId);
    emit('conversation:join', { conversationId });
  },
  leaveConversation: (conversationId: string) => {
    joinedConversations.delete(conversationId);
    emit('conversation:leave', { conversationId });
  },
  joinProject: (projectId: string) => {
    joinedProjects.add(projectId);
    emit('project:join', { projectId });
  },
  leaveProject: (projectId: string) => {
    joinedProjects.delete(projectId);
    emit('project:leave', { projectId });
  },
  startTyping: (conversationId: string) => emit('typing:start', { conversationId }),
  stopTyping: (conversationId: string) => emit('typing:stop', { conversationId }),
  markDelivered: (conversationId: string) => emit('messages:delivered', { conversationId }),
  markRead: (conversationId: string) => emit('messages:read', { conversationId }),
  requestPresence: () => emit('presence:request'),
};

const ACK_TIMEOUT_MS = 12000;

interface CallAck {
  ok: boolean;
  error?: string;
  peerId?: string;
  isGroup?: boolean;
  peers?: CallPeer[];
  mediaKind?: CallMediaKind;
}

/**
 * The call handshake needs the server's answer (peer id, roster, busy errors)
 * before media can be wired up, so these emits resolve on the ack rather than
 * fire-and-forget. A dropped socket resolves as a failure instead of hanging.
 */
function emitWithAck(event: string, payload: unknown): Promise<CallAck> {
  if (!socket || !socket.connected) {
    return Promise.resolve({ ok: false, error: 'You appear to be offline.' });
  }

  return new Promise<CallAck>((resolve) => {
    let settled = false;
    const finish = (ack: CallAck) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(ack);
    };

    const timer = setTimeout(() => finish({ ok: false, error: 'The call server did not respond.' }), ACK_TIMEOUT_MS);

    socket!.emit(event, payload, (ack: CallAck | undefined) =>
      finish(ack ?? { ok: false, error: 'The call server did not respond.' }),
    );
  });
}

export interface CallSignalTarget {
  callId: string;
  conversationId: string;
  toUserId: string;
}

export const callSocket = {
  invite: (input: { conversationId: string; callId: string; mediaKind: CallMediaKind }) =>
    emitWithAck('call:invite', input),
  join: (input: { callId: string; conversationId: string }) => emitWithAck('call:join', input),
  accept: (input: { callId: string; conversationId: string }) => emitWithAck('call:accept', input),
  reject: (input: { callId: string; conversationId: string }) => emitWithAck('call:reject', input),
  hangup: (input: { callId: string; conversationId: string; reason?: string }) =>
    emitWithAck('call:hangup', input),

  offer: (input: CallSignalTarget & { sdp: SessionDescriptionPayload }) => emit('call:offer', input),
  answer: (input: CallSignalTarget & { sdp: SessionDescriptionPayload }) => emit('call:answer', input),
  ice: (input: CallSignalTarget & { candidate: IceCandidatePayload }) => emit('call:ice', input),
  screen: (input: { callId: string; conversationId: string; active: boolean; toUserId?: string }) =>
    emit('call:screen', input),
};
