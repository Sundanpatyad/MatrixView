import type { Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import { Types } from 'mongoose';
import { config } from '../config.js';
import { Session } from '../modules/auth/models/Session.js';
import { User } from '../modules/auth/models/User.js';
import { ActivitySession } from '../modules/activity/models/ActivitySession.js';
import { Conversation } from '../modules/chat/models/Conversation.js';
import { Project } from '../modules/workspace/models/Project.js';
import * as chat from '../modules/chat/service.js';
import { verifyAccessToken, type AccessTokenPayload } from '../utils/tokens.js';
import {
  emitPresenceUpdate,
  onlineCounts,
  setIO,
  emitToUser,
  emitToConversation,
} from './io.js';

export type SocketAuth = AccessTokenPayload;

type AuthedSocket = Socket & { data: { auth: SocketAuth } };

/** userId → active 1:1 call metadata */
const userCalls = new Map<
  string,
  {
    callId: string;
    peerId: string;
    conversationId: string;
    initiatedBy: string;
    acceptedAt: number | null;
    mediaKind: 'audio' | 'video';
  }
>();

const MAX_GROUP_CALL_PARTICIPANTS = 8;

type GroupRoom = {
  callId: string;
  conversationId: string;
  mediaKind: 'audio' | 'video';
  initiatedBy: string;
  startedAt: number;
  /** At least one non-host participant joined */
  hadPeer: boolean;
  /** All group conversation member ids (for broadcasting room state) */
  memberIds: string[];
  participants: Map<string, { name: string; joinedAt: number }>;
  ringing: Set<string>;
  raisedHands: Set<string>;
  spotlightUserId: string | null;
};

/** conversationId → active group room */
const groupRooms = new Map<string, GroupRoom>();
/** userId → conversationId of group call they're in (joined) */
const userGroupCall = new Map<string, string>();

function isUserBusy(uid: string) {
  return userCalls.has(uid) || userGroupCall.has(uid);
}

function roomSnapshot(room: GroupRoom) {
  const joinedIds = new Set(room.participants.keys());
  return {
    callId: room.callId,
    conversationId: room.conversationId,
    mediaKind: room.mediaKind,
    initiatedBy: room.initiatedBy,
    participantCount: room.participants.size,
    participants: [...room.participants.entries()].map(([userId, p]) => ({
      userId,
      name: p.name,
    })),
    /** Every group member — joined or not — so clients can show Join for all */
    members: room.memberIds.map((userId) => ({
      userId,
      name: room.participants.get(userId)?.name ?? null,
      joined: joinedIds.has(userId),
    })),
    raisedHands: [...room.raisedHands],
    spotlightUserId: room.spotlightUserId,
  };
}

function emitGroupRoom(conversationId: string, room: GroupRoom | null, memberIds?: string[]) {
  const payload = {
    conversationId,
    active: Boolean(room),
    room: room ? roomSnapshot(room) : null,
  };
  emitToConversation(conversationId, 'call:room', payload);
  // Also push to every member's personal room so they see the call even
  // if they haven't opened this conversation (and joined the socket room).
  const targets = memberIds ?? room?.memberIds ?? [];
  for (const uid of targets) {
    emitToUser(uid, 'call:room', payload);
  }
}

async function endGroupRoom(room: GroupRoom, conversationId: string) {
  const remaining = [...room.participants.keys()];
  for (const peerId of remaining) {
    userGroupCall.delete(peerId);
    emitToUser(peerId, 'call:ended', {
      callId: room.callId,
      conversationId,
      fromUserId: peerId,
      reason: 'hangup',
    });
  }
  room.participants.clear();
  room.ringing.clear();
  groupRooms.delete(conversationId);
  const durationSeconds = Math.max(1, Math.round((Date.now() - room.startedAt) / 1000));
  try {
    await chat.recordCallHistory({
      conversationId,
      callId: room.callId,
      initiatedBy: room.initiatedBy,
      outcome: room.hadPeer ? 'answered' : 'cancelled',
      durationSeconds: room.hadPeer ? durationSeconds : 0,
      mediaKind: room.mediaKind,
      isGroup: true,
    });
  } catch (err) {
    console.error('[call] failed to record group history', err);
  }
  emitGroupRoom(conversationId, null, room.memberIds);
}

async function getConversationForMember(conversationId: string, userId: string) {
  if (!Types.ObjectId.isValid(conversationId)) return null;
  return Conversation.findOne({
    _id: conversationId,
    memberIds: userId,
  }).select('type memberIds orgId name');
}

async function leaveGroupCall(
  userId: string,
  callId: string | undefined,
  reason: 'hangup' | 'disconnected' | 'rejected',
) {
  const conversationId = userGroupCall.get(userId);
  if (!conversationId) {
    // Maybe still ringing — clear from ringing sets
    for (const room of groupRooms.values()) {
      if (callId && room.callId !== callId) continue;
      if (room.ringing.has(userId)) {
        room.ringing.delete(userId);
      }
    }
    return;
  }
  const room = groupRooms.get(conversationId);
  if (!room) {
    userGroupCall.delete(userId);
    return;
  }
  if (callId && room.callId !== callId) return;

  room.participants.delete(userId);
  room.ringing.delete(userId);
  room.raisedHands.delete(userId);
  if (room.spotlightUserId === userId) room.spotlightUserId = null;
  userGroupCall.delete(userId);

  for (const peerId of room.participants.keys()) {
    emitToUser(peerId, 'call:peer-left', {
      callId: room.callId,
      conversationId,
      userId,
      reason,
    });
  }

  // Keep the room alive while the host waits alone for others.
  // Once at least one peer joined (hadPeer), end when ≤1 person remains.
  if (room.participants.size === 0 || (room.hadPeer && room.participants.size <= 1)) {
    await endGroupRoom(room, conversationId);
  } else {
    emitGroupRoom(conversationId, room);
  }
}

async function getDmPeer(
  conversationId: string,
  userId: string,
  _orgId: string,
): Promise<{ peerId: string; conversationId: string } | null> {
  if (!Types.ObjectId.isValid(conversationId)) return null;
  const conversation = await Conversation.findOne({
    _id: conversationId,
    type: 'dm',
    memberIds: userId,
  }).select('memberIds');
  if (!conversation || conversation.memberIds.length !== 2) return null;
  const peerId = conversation.memberIds.map(String).find((id) => id !== userId);
  if (!peerId) return null;
  return { peerId, conversationId: String(conversation._id) };
}

function clearCall(userId: string, callId?: string) {
  const cur = userCalls.get(userId);
  if (!cur) return;
  if (callId && cur.callId !== callId) return;
  userCalls.delete(userId);
  const peer = userCalls.get(cur.peerId);
  if (peer && peer.callId === cur.callId) userCalls.delete(cur.peerId);
}

async function finalizeCall(
  userId: string,
  callId: string,
  reason: 'rejected' | 'hangup' | 'disconnected' | 'failed',
) {
  const cur = userCalls.get(userId);
  if (!callId || !cur || cur.callId !== callId) return null;

  const meta = { ...cur };
  clearCall(userId, callId);

  let outcome: chat.CallOutcome;
  let durationSeconds = 0;
  if (meta.acceptedAt) {
    outcome = 'answered';
    durationSeconds = Math.max(1, Math.round((Date.now() - meta.acceptedAt) / 1000));
  } else if (reason === 'rejected') {
    outcome = 'rejected';
  } else if (reason === 'hangup') {
    outcome = userId === meta.initiatedBy ? 'cancelled' : 'rejected';
  } else if (reason === 'disconnected') {
    outcome = userId === meta.initiatedBy ? 'cancelled' : 'missed';
  } else {
    outcome = 'failed';
  }

  try {
    await chat.recordCallHistory({
      conversationId: meta.conversationId,
      callId: meta.callId,
      initiatedBy: meta.initiatedBy,
      outcome,
      durationSeconds,
      mediaKind: meta.mediaKind,
    });
  } catch (err) {
    console.error('[call] failed to record history', err);
  }

  return meta;
}

async function authenticateSocket(socket: Socket): Promise<SocketAuth> {
  const raw =
    (socket.handshake.auth?.token as string | undefined) ||
    (typeof socket.handshake.headers.authorization === 'string' &&
    socket.handshake.headers.authorization.startsWith('Bearer ')
      ? socket.handshake.headers.authorization.slice(7).trim()
      : undefined) ||
    (socket.handshake.query?.token as string | undefined);

  if (!raw) throw new Error('Authentication required');

  const payload = verifyAccessToken(raw);
  const session = await Session.findById(payload.sessionId);
  if (!session || session.revokedAt || session.expiresAt.getTime() < Date.now()) {
    throw new Error('Session revoked or expired');
  }
  session.lastActiveAt = new Date();
  await session.save();
  return payload;
}

async function orgPresenceSnapshot(orgId: string) {
  const [users, activeSessions] = await Promise.all([
    User.find({
      orgId,
      status: { $in: ['active', 'invited', 'locked'] },
    })
      .select('_id')
      .lean(),
    ActivitySession.find({ orgId, status: 'active' }).select('userId').lean(),
  ]);

  const checkedIn = new Set(activeSessions.map((s) => String(s.userId)));
  return users.map((u) => {
    const userId = String(u._id);
    return {
      userId,
      checkedIn: checkedIn.has(userId),
      online: (onlineCounts.get(userId) ?? 0) > 0,
    };
  });
}

async function isConversationMember(conversationId: string, userId: string, orgId: string) {
  if (!Types.ObjectId.isValid(conversationId)) return false;
  const conversation = await Conversation.findOne({
    _id: conversationId,
    orgId,
    memberIds: userId,
  }).select('_id');
  return Boolean(conversation);
}

export function initSocket(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: config.corsOrigin,
      credentials: true,
    },
    path: '/socket.io',
    // Keep connections alive while users stay logged in
    pingInterval: 20_000,
    pingTimeout: 20_000,
  });
  setIO(io);

  io.use(async (socket, next) => {
    try {
      const auth = await authenticateSocket(socket);
      (socket as AuthedSocket).data.auth = auth;
      next();
    } catch (err) {
      next(err instanceof Error ? err : new Error('Unauthorized'));
    }
  });

  io.on('connection', async (rawSocket) => {
    const socket = rawSocket as AuthedSocket;
    const auth = socket.data.auth;
    const userId = auth.sub;
    const orgId = auth.orgId;

    socket.join(`org:${orgId}`);
    socket.join(`user:${userId}`);

    // App-level ping/pong (in addition to Engine.IO keepalive)
    socket.on('client:ping', (payload?: { t?: number }) => {
      socket.emit('client:pong', { t: payload?.t ?? Date.now(), serverTime: Date.now() });
    });

    onlineCounts.set(userId, (onlineCounts.get(userId) ?? 0) + 1);

    const attendance = await ActivitySession.exists({
      userId,
      orgId,
      status: 'active',
    });

    emitPresenceUpdate(orgId, {
      userId,
      checkedIn: Boolean(attendance),
      online: true,
    });

    socket.emit('presence:snapshot', {
      users: await orgPresenceSnapshot(orgId),
    });

    socket.on('presence:request', async (_payload?: unknown, ack?) => {
      try {
        const users = await orgPresenceSnapshot(orgId);
        socket.emit('presence:snapshot', { users });
        ack?.({ ok: true, count: users.length });
      } catch (err) {
        ack?.({ ok: false, error: err instanceof Error ? err.message : 'Failed' });
      }
    });

    socket.on('conversation:join', async (payload: { conversationId?: string }, ack?) => {
      try {
        const conversationId = payload?.conversationId;
        if (!conversationId || !(await isConversationMember(conversationId, userId, orgId))) {
          // membership-only fallback (cross-org DMs / groups)
          const conv = await getConversationForMember(conversationId ?? '', userId);
          if (!conv) {
            ack?.({ ok: false, error: 'Forbidden' });
            return;
          }
        }
        if (!conversationId) {
          ack?.({ ok: false, error: 'Forbidden' });
          return;
        }
        socket.join(`conversation:${conversationId}`);
        await chat.markMessagesDelivered(
          { sub: userId, orgId, email: auth.email, role: auth.role },
          conversationId,
        );
        await chat.markMessagesRead(
          { sub: userId, orgId, email: auth.email, role: auth.role },
          conversationId,
        );
        const room = groupRooms.get(conversationId);
        if (room) {
          socket.emit('call:room', {
            conversationId,
            active: true,
            room: roomSnapshot(room),
          });
        }
        ack?.({ ok: true });
      } catch (err) {
        ack?.({ ok: false, error: err instanceof Error ? err.message : 'Failed' });
      }
    });

    socket.on('conversation:leave', (payload: { conversationId?: string }) => {
      if (payload?.conversationId) {
        socket.leave(`conversation:${payload.conversationId}`);
      }
    });

    socket.on('project:join', async (payload: { projectId?: string }, ack?) => {
      try {
        const projectId = payload?.projectId;
        if (!projectId || !Types.ObjectId.isValid(projectId)) {
          ack?.({ ok: false, error: 'Invalid project' });
          return;
        }
        const project = await Project.findById(projectId).select('members').lean();
        if (!project) {
          ack?.({ ok: false, error: 'Not found' });
          return;
        }
        const email = String(auth.email ?? '').toLowerCase();
        const member = project.members?.find(
          (m) => String(m.email ?? '').toLowerCase() === email,
        );
        if (!member) {
          ack?.({ ok: false, error: 'Forbidden' });
          return;
        }
        socket.join(`project:${projectId}`);
        ack?.({ ok: true });
      } catch (err) {
        ack?.({ ok: false, error: err instanceof Error ? err.message : 'Failed' });
      }
    });

    socket.on('project:leave', (payload: { projectId?: string }) => {
      if (payload?.projectId) {
        socket.leave(`project:${payload.projectId}`);
      }
    });

    socket.on('messages:delivered', async (payload: { conversationId?: string }, ack?) => {
      try {
        const conversationId = payload?.conversationId;
        if (!conversationId || !(await isConversationMember(conversationId, userId, orgId))) {
          ack?.({ ok: false });
          return;
        }
        await chat.markMessagesDelivered(
          { sub: userId, orgId, email: auth.email, role: auth.role },
          conversationId,
        );
        ack?.({ ok: true });
      } catch {
        ack?.({ ok: false });
      }
    });

    socket.on('messages:read', async (payload: { conversationId?: string }, ack?) => {
      try {
        const conversationId = payload?.conversationId;
        if (!conversationId || !(await isConversationMember(conversationId, userId, orgId))) {
          ack?.({ ok: false });
          return;
        }
        await chat.markMessagesRead(
          { sub: userId, orgId, email: auth.email, role: auth.role },
          conversationId,
        );
        ack?.({ ok: true });
      } catch {
        ack?.({ ok: false });
      }
    });

    socket.on('typing:start', async (payload: { conversationId?: string }) => {
      const conversationId = payload?.conversationId;
      if (!conversationId || !(await isConversationMember(conversationId, userId, orgId))) {
        return;
      }
      const user = await User.findById(userId).select('name').lean();
      socket.to(`conversation:${conversationId}`).emit('typing:update', {
        conversationId,
        userId,
        userName: user?.name ?? 'Someone',
        typing: true,
      });
    });

    socket.on('typing:stop', async (payload: { conversationId?: string }) => {
      const conversationId = payload?.conversationId;
      if (!conversationId || !(await isConversationMember(conversationId, userId, orgId))) {
        return;
      }
      socket.to(`conversation:${conversationId}`).emit('typing:update', {
        conversationId,
        userId,
        userName: '',
        typing: false,
      });
    });

    // ─── 1:1 + group call signaling ───────────────────────────────────
    socket.on(
      'call:invite',
      async (
        payload: {
          conversationId?: string;
          callId?: string;
          mediaKind?: 'audio' | 'video';
        },
        ack?: (res: {
          ok: boolean;
          error?: string;
          peerId?: string;
          isGroup?: boolean;
          peers?: Array<{ userId: string; name: string }>;
        }) => void,
      ) => {
        try {
          const conversationId = payload?.conversationId;
          const callId = payload?.callId;
          const mediaKind = payload?.mediaKind === 'video' ? 'video' : 'audio';
          if (!conversationId || !callId) {
            ack?.({ ok: false, error: 'Invalid call' });
            return;
          }
          if (isUserBusy(userId)) {
            ack?.({ ok: false, error: 'You are already on a call' });
            return;
          }

          const conversation = await getConversationForMember(conversationId, userId);
          if (!conversation) {
            ack?.({ ok: false, error: 'Conversation not found' });
            return;
          }

          const user = await User.findById(userId).select('name').lean();
          const fromName = user?.name ?? 'Someone';

          if (conversation.type === 'group') {
            if (groupRooms.has(String(conversation._id))) {
              ack?.({ ok: false, error: 'A group call is already in progress' });
              return;
            }
            const memberIds = conversation.memberIds.map(String);
            const room: GroupRoom = {
              callId,
              conversationId: String(conversation._id),
              mediaKind,
              initiatedBy: userId,
              startedAt: Date.now(),
              hadPeer: false,
              memberIds,
              participants: new Map([[userId, { name: fromName, joinedAt: Date.now() }]]),
              ringing: new Set(memberIds.filter((id) => id !== userId)),
              raisedHands: new Set(),
              spotlightUserId: null,
            };
            groupRooms.set(room.conversationId, room);
            userGroupCall.set(userId, room.conversationId);

            for (const memberId of room.ringing) {
              emitToUser(memberId, 'call:incoming', {
                callId,
                conversationId: room.conversationId,
                fromUserId: userId,
                fromName,
                mediaKind,
                isGroup: true,
                conversationName: conversation.name || 'Group',
              });
            }
            emitGroupRoom(room.conversationId, room);
            ack?.({ ok: true, isGroup: true, peers: [] });
            return;
          }

          // DM
          const dm = await getDmPeer(conversationId, userId, orgId);
          if (!dm) {
            ack?.({ ok: false, error: 'Calls are only available in direct or group chats' });
            return;
          }
          if (isUserBusy(dm.peerId)) {
            ack?.({ ok: false, error: 'User is busy on another call' });
            return;
          }
          userCalls.set(userId, {
            callId,
            peerId: dm.peerId,
            conversationId: dm.conversationId,
            initiatedBy: userId,
            acceptedAt: null,
            mediaKind,
          });
          userCalls.set(dm.peerId, {
            callId,
            peerId: userId,
            conversationId: dm.conversationId,
            initiatedBy: userId,
            acceptedAt: null,
            mediaKind,
          });
          emitToUser(dm.peerId, 'call:incoming', {
            callId,
            conversationId: dm.conversationId,
            fromUserId: userId,
            fromName,
            mediaKind,
            isGroup: false,
          });
          ack?.({ ok: true, peerId: dm.peerId, isGroup: false });
        } catch (err) {
          ack?.({ ok: false, error: err instanceof Error ? err.message : 'Failed' });
        }
      },
    );

    socket.on(
      'call:join',
      async (
        payload: { callId?: string; conversationId?: string },
        ack?: (res: {
          ok: boolean;
          error?: string;
          peers?: Array<{ userId: string; name: string }>;
          mediaKind?: 'audio' | 'video';
        }) => void,
      ) => {
        try {
          const conversationId = payload?.conversationId;
          const callId = payload?.callId;
          if (!conversationId || !callId) {
            ack?.({ ok: false, error: 'Invalid call' });
            return;
          }
          if (isUserBusy(userId)) {
            ack?.({ ok: false, error: 'You are already on a call' });
            return;
          }
          const room = groupRooms.get(conversationId);
          if (!room || room.callId !== callId) {
            ack?.({ ok: false, error: 'Call is no longer active' });
            return;
          }
          const conversation = await getConversationForMember(conversationId, userId);
          if (!conversation || conversation.type !== 'group') {
            ack?.({ ok: false, error: 'Not a group member' });
            return;
          }
          if (room.participants.size >= MAX_GROUP_CALL_PARTICIPANTS) {
            ack?.({ ok: false, error: 'Group call is full' });
            return;
          }

          const user = await User.findById(userId).select('name').lean();
          const name = user?.name ?? 'Someone';
          const peers = [...room.participants.entries()].map(([id, p]) => ({
            userId: id,
            name: p.name,
          }));

          room.participants.set(userId, { name, joinedAt: Date.now() });
          room.ringing.delete(userId);
          if (userId !== room.initiatedBy) room.hadPeer = true;
          userGroupCall.set(userId, conversationId);

          for (const peerId of room.participants.keys()) {
            if (peerId === userId) continue;
            emitToUser(peerId, 'call:peer-joined', {
              callId: room.callId,
              conversationId,
              userId,
              name,
            });
          }
          emitGroupRoom(conversationId, room);
          ack?.({ ok: true, peers, mediaKind: room.mediaKind });
        } catch (err) {
          ack?.({ ok: false, error: err instanceof Error ? err.message : 'Failed' });
        }
      },
    );

    socket.on(
      'call:accept',
      async (
        payload: { callId?: string; conversationId?: string },
        ack?: (res: {
          ok: boolean;
          error?: string;
          isGroup?: boolean;
          peers?: Array<{ userId: string; name: string }>;
          mediaKind?: 'audio' | 'video';
        }) => void,
      ) => {
        try {
          const callId = payload?.callId;
          const conversationId = payload?.conversationId;

          // Group accept → join
          if (conversationId && groupRooms.has(conversationId)) {
            const room = groupRooms.get(conversationId)!;
            if (!callId || room.callId !== callId) {
              ack?.({ ok: false, error: 'No active call' });
              return;
            }
            if (isUserBusy(userId) && userGroupCall.get(userId) !== conversationId) {
              ack?.({ ok: false, error: 'You are already on a call' });
              return;
            }
            if (room.participants.has(userId)) {
              ack?.({
                ok: true,
                isGroup: true,
                peers: [...room.participants.entries()]
                  .filter(([id]) => id !== userId)
                  .map(([id, p]) => ({ userId: id, name: p.name })),
                mediaKind: room.mediaKind,
              });
              return;
            }
            if (room.participants.size >= MAX_GROUP_CALL_PARTICIPANTS) {
              ack?.({ ok: false, error: 'Group call is full' });
              return;
            }
            const user = await User.findById(userId).select('name').lean();
            const name = user?.name ?? 'Someone';
            const peers = [...room.participants.entries()].map(([id, p]) => ({
              userId: id,
              name: p.name,
            }));
            room.participants.set(userId, { name, joinedAt: Date.now() });
            room.ringing.delete(userId);
            room.hadPeer = true;
            userGroupCall.set(userId, conversationId);
            for (const peerId of room.participants.keys()) {
              if (peerId === userId) continue;
              emitToUser(peerId, 'call:peer-joined', {
                callId: room.callId,
                conversationId,
                userId,
                name,
              });
            }
            emitGroupRoom(conversationId, room);
            ack?.({ ok: true, isGroup: true, peers, mediaKind: room.mediaKind });
            return;
          }

          // DM accept
          const cur = callId ? userCalls.get(userId) : undefined;
          if (!callId || !cur || cur.callId !== callId) {
            ack?.({ ok: false, error: 'No active call' });
            return;
          }
          const acceptedAt = Date.now();
          cur.acceptedAt = acceptedAt;
          const peer = userCalls.get(cur.peerId);
          if (peer && peer.callId === callId) peer.acceptedAt = acceptedAt;
          emitToUser(cur.peerId, 'call:accepted', {
            callId,
            conversationId: cur.conversationId,
            fromUserId: userId,
          });
          ack?.({ ok: true, isGroup: false });
        } catch {
          ack?.({ ok: false });
        }
      },
    );

    socket.on(
      'call:reject',
      async (payload: { callId?: string; conversationId?: string }, ack?) => {
        const callId = payload?.callId;
        const conversationId = payload?.conversationId;

        if (conversationId && groupRooms.has(conversationId)) {
          const room = groupRooms.get(conversationId)!;
          if (!callId || room.callId === callId) {
            room.ringing.delete(userId);
          }
          ack?.({ ok: true });
          return;
        }

        const cur = callId ? userCalls.get(userId) : undefined;
        if (callId && cur && cur.callId === callId) {
          emitToUser(cur.peerId, 'call:ended', {
            callId,
            conversationId: cur.conversationId,
            fromUserId: userId,
            reason: 'rejected',
          });
          await finalizeCall(userId, callId, 'rejected');
        }
        ack?.({ ok: true });
      },
    );

    socket.on(
      'call:hangup',
      async (payload: { callId?: string; conversationId?: string; reason?: string }, ack?) => {
        const callId = payload?.callId;
        const conversationId = payload?.conversationId;

        if (
          (conversationId && groupRooms.has(conversationId)) ||
          userGroupCall.has(userId)
        ) {
          await leaveGroupCall(userId, callId, 'hangup');
          ack?.({ ok: true });
          return;
        }

        const cur = callId ? userCalls.get(userId) : undefined;
        if (callId && cur && cur.callId === callId) {
          emitToUser(cur.peerId, 'call:ended', {
            callId,
            conversationId: cur.conversationId,
            fromUserId: userId,
            reason: payload?.reason ?? 'hangup',
          });
          await finalizeCall(userId, callId, 'hangup');
        }
        ack?.({ ok: true });
      },
    );

    const canRelayCallSignal = (toUserId: string, callId: string) => {
      const dm = userCalls.get(userId);
      if (dm && dm.callId === callId && dm.peerId === toUserId) return true;
      const convId = userGroupCall.get(userId);
      if (!convId) return false;
      const room = groupRooms.get(convId);
      return Boolean(
        room &&
          room.callId === callId &&
          room.participants.has(userId) &&
          room.participants.has(toUserId),
      );
    };

    socket.on(
      'call:offer',
      async (payload: {
        callId?: string;
        conversationId?: string;
        toUserId?: string;
        sdp?: { type?: string; sdp?: string };
      }) => {
        const { callId, conversationId, toUserId, sdp } = payload ?? {};
        if (!callId || !conversationId || !toUserId || !sdp) return;
        if (!canRelayCallSignal(toUserId, callId)) return;
        emitToUser(toUserId, 'call:offer', {
          callId,
          conversationId,
          fromUserId: userId,
          fromName: (await User.findById(userId).select('name').lean())?.name ?? 'Someone',
          sdp,
        });
      },
    );

    socket.on(
      'call:answer',
      async (payload: {
        callId?: string;
        conversationId?: string;
        toUserId?: string;
        sdp?: { type?: string; sdp?: string };
      }) => {
        const { callId, conversationId, toUserId, sdp } = payload ?? {};
        if (!callId || !conversationId || !toUserId || !sdp) return;
        if (!canRelayCallSignal(toUserId, callId)) return;
        emitToUser(toUserId, 'call:answer', {
          callId,
          conversationId,
          fromUserId: userId,
          sdp,
        });
      },
    );

    socket.on(
      'call:ice',
      async (payload: {
        callId?: string;
        conversationId?: string;
        toUserId?: string;
        candidate?: Record<string, unknown> | null;
      }) => {
        const { callId, conversationId, toUserId, candidate } = payload ?? {};
        if (!callId || !conversationId || !toUserId) return;
        if (!canRelayCallSignal(toUserId, callId)) return;
        emitToUser(toUserId, 'call:ice', {
          callId,
          conversationId,
          fromUserId: userId,
          candidate: candidate ?? null,
        });
      },
    );

    socket.on(
      'call:screen',
      async (payload: {
        callId?: string;
        conversationId?: string;
        active?: boolean;
        toUserId?: string;
      }) => {
        const callId = payload?.callId;
        const conversationId = payload?.conversationId;
        const active = Boolean(payload?.active);
        if (!callId || !conversationId) return;

        const room = groupRooms.get(conversationId);
        if (room && room.callId === callId && room.participants.has(userId)) {
          for (const peerId of room.participants.keys()) {
            if (peerId === userId) continue;
            emitToUser(peerId, 'call:screen', {
              callId,
              conversationId,
              fromUserId: userId,
              active,
            });
          }
          return;
        }

        const dm = userCalls.get(userId);
        const toUserId = payload?.toUserId ?? dm?.peerId;
        if (!toUserId || !dm || dm.callId !== callId) return;
        if (!canRelayCallSignal(toUserId, callId)) return;
        emitToUser(toUserId, 'call:screen', {
          callId,
          conversationId,
          fromUserId: userId,
          active,
        });
      },
    );

    /** Broadcast lightweight UX events to every other participant in the call (O(n) mesh-safe). */
    const broadcastCallUx = (
      callId: string,
      conversationId: string,
      event: string,
      data: Record<string, unknown>,
      toUserId?: string,
    ) => {
      const room = groupRooms.get(conversationId);
      if (room && room.callId === callId && room.participants.has(userId)) {
        for (const peerId of room.participants.keys()) {
          if (peerId === userId) continue;
          emitToUser(peerId, event, {
            callId,
            conversationId,
            fromUserId: userId,
            ...data,
          });
        }
        return true;
      }
      const dm = userCalls.get(userId);
      const peer = toUserId ?? dm?.peerId;
      if (!peer || !dm || dm.callId !== callId) return false;
      if (!canRelayCallSignal(peer, callId)) return false;
      emitToUser(peer, event, {
        callId,
        conversationId,
        fromUserId: userId,
        ...data,
      });
      return true;
    };

    socket.on(
      'call:hand',
      async (payload: {
        callId?: string;
        conversationId?: string;
        raised?: boolean;
        toUserId?: string;
      }) => {
        const callId = payload?.callId;
        const conversationId = payload?.conversationId;
        if (!callId || !conversationId) return;
        const raised = Boolean(payload?.raised);
        const room = groupRooms.get(conversationId);
        if (room && room.callId === callId && room.participants.has(userId)) {
          if (raised) room.raisedHands.add(userId);
          else room.raisedHands.delete(userId);
        }
        broadcastCallUx(callId, conversationId, 'call:hand', { raised }, payload?.toUserId);
      },
    );

    socket.on(
      'call:reaction',
      async (payload: {
        callId?: string;
        conversationId?: string;
        emoji?: string;
        toUserId?: string;
      }) => {
        const callId = payload?.callId;
        const conversationId = payload?.conversationId;
        const emoji = typeof payload?.emoji === 'string' ? payload.emoji.slice(0, 8) : '';
        if (!callId || !conversationId || !emoji) return;
        broadcastCallUx(callId, conversationId, 'call:reaction', { emoji }, payload?.toUserId);
      },
    );

    socket.on(
      'call:spotlight',
      async (payload: {
        callId?: string;
        conversationId?: string;
        targetUserId?: string | null;
        toUserId?: string;
      }) => {
        const callId = payload?.callId;
        const conversationId = payload?.conversationId;
        if (!callId || !conversationId) return;
        const targetUserId =
          typeof payload?.targetUserId === 'string' && payload.targetUserId
            ? payload.targetUserId
            : null;
        const room = groupRooms.get(conversationId);
        if (room && room.callId === callId && room.participants.has(userId)) {
          room.spotlightUserId = targetUserId;
        }
        broadcastCallUx(
          callId,
          conversationId,
          'call:spotlight',
          { targetUserId },
          payload?.toUserId,
        );
      },
    );

    socket.on('disconnect', async () => {
      const active = userCalls.get(userId);
      if (active) {
        emitToUser(active.peerId, 'call:ended', {
          callId: active.callId,
          conversationId: active.conversationId,
          fromUserId: userId,
          reason: 'disconnected',
        });
        await finalizeCall(userId, active.callId, 'disconnected');
      }
      if (userGroupCall.has(userId)) {
        await leaveGroupCall(userId, undefined, 'disconnected');
      }

      const next = (onlineCounts.get(userId) ?? 1) - 1;
      if (next <= 0) onlineCounts.delete(userId);
      else onlineCounts.set(userId, next);

      if (next <= 0) {
        const stillCheckedIn = await ActivitySession.exists({
          userId,
          orgId,
          status: 'active',
        });
        emitPresenceUpdate(orgId, {
          userId,
          checkedIn: Boolean(stillCheckedIn),
          online: false,
        });
      }
    });
  });

  return io;
}

export { getIO, emitToOrg, emitToConversation, emitToUser, emitPresenceUpdate } from './io.js';
