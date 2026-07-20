import type { Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import { Types } from 'mongoose';
import { config } from '../config.js';
import { Session } from '../modules/auth/models/Session.js';
import { User } from '../modules/auth/models/User.js';
import { ActivitySession } from '../modules/activity/models/ActivitySession.js';
import { Conversation } from '../modules/chat/models/Conversation.js';
import * as chat from '../modules/chat/service.js';
import { verifyAccessToken, type AccessTokenPayload } from '../utils/tokens.js';
import {
  emitPresenceUpdate,
  onlineCounts,
  setIO,
} from './io.js';

export type SocketAuth = AccessTokenPayload;

type AuthedSocket = Socket & { data: { auth: SocketAuth } };

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

    socket.on('conversation:join', async (payload: { conversationId?: string }, ack?) => {
      try {
        const conversationId = payload?.conversationId;
        if (!conversationId || !(await isConversationMember(conversationId, userId, orgId))) {
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

    socket.on('disconnect', async () => {
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
