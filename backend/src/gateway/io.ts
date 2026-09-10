import { Types } from 'mongoose';
import type { Server } from 'socket.io';
import { User } from '../modules/auth/models/User.js';
import { ActivitySession } from '../modules/activity/models/ActivitySession.js';
import { MAX_SESSION_DURATION_MS } from '../modules/activity/constants.js';
import { Conversation } from '../modules/chat/models/Conversation.js';
import { Project } from '../modules/workspace/models/Project.js';

let io: Server | null = null;

/** userId → number of active sockets (logged in + connected = online) */
export const onlineCounts = new Map<string, number>();

/** Avoid flashing Offline when a client refreshes or briefly drops the socket. */
const PRESENCE_OFFLINE_GRACE_MS = 2500;
const pendingOffline = new Map<string, ReturnType<typeof setTimeout>>();

export function cancelPendingOffline(userId: string) {
  const timer = pendingOffline.get(userId);
  if (!timer) return;
  clearTimeout(timer);
  pendingOffline.delete(userId);
}

export function schedulePresenceOffline(userId: string, onOffline: () => void) {
  cancelPendingOffline(userId);
  pendingOffline.set(
    userId,
    setTimeout(() => {
      pendingOffline.delete(userId);
      if ((onlineCounts.get(userId) ?? 0) > 0) return;
      onOffline();
    }, PRESENCE_OFFLINE_GRACE_MS),
  );
}

export function setIO(server: Server | null) {
  io = server;
}

export function getIO(): Server | null {
  return io;
}

export function emitToOrg(orgId: string, event: string, payload: unknown) {
  io?.to(`org:${orgId}`).emit(event, payload);
}

export function emitToConversation(conversationId: string, event: string, payload: unknown) {
  io?.to(`conversation:${conversationId}`).emit(event, payload);
}

export function emitToUser(userId: string, event: string, payload: unknown) {
  io?.to(`user:${userId}`).emit(event, payload);
}

/** Kick every socket for this user out of a project room (e.g. after they are removed). */
export function leaveProjectRoomForUser(userId: string, projectId: string) {
  if (!io) return;
  const room = io.sockets.adapter.rooms.get(`user:${userId}`);
  if (!room) return;
  for (const socketId of room) {
    io.sockets.sockets.get(socketId)?.leave(`project:${projectId}`);
  }
}

export function emitToProject(projectId: string, event: string, payload: unknown) {
  io?.to(`project:${projectId}`).emit(event, payload);
}

export type PresencePayload = {
  userId: string;
  checkedIn: boolean;
  online: boolean;
};

function oid(userId: string) {
  return Types.ObjectId.isValid(userId) ? new Types.ObjectId(userId) : null;
}

/**
 * People who should see this user's socket-online flag: same org, shared
 * projects, and anyone in a DM/group with them (often different orgs).
 */
export async function presenceAudienceUserIds(userId: string, orgId: string): Promise<string[]> {
  const ids = new Set<string>([userId]);
  const userOid = oid(userId);

  const [orgUsers, conversations, projects] = await Promise.all([
    User.find({ orgId }).select('_id').lean(),
    userOid
      ? Conversation.find({ memberIds: userOid }).select('memberIds').lean()
      : Promise.resolve([]),
    userOid
      ? Project.find({ 'members.userId': userOid }).select('members.userId').lean()
      : Promise.resolve([]),
  ]);

  for (const u of orgUsers) ids.add(String(u._id));
  for (const c of conversations) {
    for (const m of c.memberIds) ids.add(String(m));
  }
  for (const p of projects) {
    for (const m of p.members) {
      if (m.userId) ids.add(String(m.userId));
    }
  }

  return [...ids];
}

export async function presenceSnapshotForUser(
  userId: string,
  orgId: string,
): Promise<PresencePayload[]> {
  const ids = await presenceAudienceUserIds(userId, orgId);
  const oids = ids.map((id) => oid(id)).filter((id): id is Types.ObjectId => Boolean(id));
  const activeSessions =
    oids.length === 0
      ? []
      : await ActivitySession.find({
          userId: { $in: oids },
          status: 'active',
          startedAt: { $gt: new Date(Date.now() - MAX_SESSION_DURATION_MS) },
        })
          .select('userId')
          .lean();
  const checkedIn = new Set(activeSessions.map((s) => String(s.userId)));
  return ids.map((id) => ({
    userId: id,
    checkedIn: checkedIn.has(id),
    online: (onlineCounts.get(id) ?? 0) > 0,
  }));
}

export async function emitPresenceUpdate(
  orgId: string,
  payload: { userId: string; checkedIn: boolean; online?: boolean },
) {
  const online = payload.online ?? (onlineCounts.get(payload.userId) ?? 0) > 0;
  const body: PresencePayload = {
    userId: payload.userId,
    checkedIn: payload.checkedIn,
    online,
  };

  emitToOrg(orgId, 'presence:update', body);

  const watchers = await presenceAudienceUserIds(payload.userId, orgId);
  for (const uid of watchers) {
    emitToUser(uid, 'presence:update', body);
  }
}
