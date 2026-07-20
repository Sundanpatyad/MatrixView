import type { Server } from 'socket.io';

let io: Server | null = null;

/** userId → number of active sockets */
export const onlineCounts = new Map<string, number>();

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

export function emitToProject(projectId: string, event: string, payload: unknown) {
  io?.to(`project:${projectId}`).emit(event, payload);
}

export function emitPresenceUpdate(
  orgId: string,
  payload: { userId: string; checkedIn: boolean; online?: boolean },
) {
  const online = payload.online ?? (onlineCounts.get(payload.userId) ?? 0) > 0;
  emitToOrg(orgId, 'presence:update', {
    userId: payload.userId,
    checkedIn: payload.checkedIn,
    online,
  });
}
