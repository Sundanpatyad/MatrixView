import { Types } from 'mongoose';
import { AuthError } from '../auth/errors.js';
import { emitToUser } from '../../gateway/io.js';
import {
  Notification,
  NOTIFICATION_TYPES,
  type NotificationDoc,
  type NotificationType,
} from './models/Notification.js';

type Actor = {
  sub: string;
  orgId: string;
  name?: string;
};

export type NotificationMeta = {
  projectId?: string | null;
  taskId?: string | null;
  taskKey?: string | null;
  conversationId?: string | null;
  messageId?: string | null;
  commentId?: string | null;
  href?: string | null;
};

export type CreateNotificationInput = {
  orgId: string;
  recipientId: string;
  actorId?: string | null;
  actorName?: string;
  type: NotificationType;
  title: string;
  body?: string;
  meta?: NotificationMeta;
};

function iso(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  if (typeof d === 'string') return d;
  return d.toISOString();
}

export function serializeNotification(doc: NotificationDoc | Record<string, unknown>) {
  const d = doc as NotificationDoc;
  const meta = (d.meta ?? {}) as NotificationMeta;
  return {
    id: String(d._id),
    orgId: String(d.orgId),
    recipientId: String(d.recipientId),
    actorId: d.actorId ? String(d.actorId) : null,
    actorName: d.actorName ?? '',
    type: d.type as NotificationType,
    title: d.title,
    body: d.body ?? '',
    readAt: iso(d.readAt as Date | null),
    createdAt: iso(d.createdAt) ?? new Date().toISOString(),
    meta: {
      projectId: meta.projectId ?? null,
      taskId: meta.taskId ?? null,
      taskKey: meta.taskKey ?? null,
      conversationId: meta.conversationId ?? null,
      messageId: meta.messageId ?? null,
      commentId: meta.commentId ?? null,
      href: meta.href ?? null,
    },
  };
}

export type PublicNotification = ReturnType<typeof serializeNotification>;

/** Map project member id (mem_*) or raw user id → User._id string. */
export function resolveAssigneeUserId(
  project: {
    members?: Array<{ id?: string; userId?: Types.ObjectId | string | null }>;
  },
  assigneeId: string | null | undefined,
): string | null {
  if (!assigneeId?.trim()) return null;
  const id = assigneeId.trim();
  const byMember = (project.members ?? []).find((m) => m.id === id);
  if (byMember?.userId) return String(byMember.userId);
  if (Types.ObjectId.isValid(id)) return id;
  return null;
}

export async function unreadCount(recipientId: string): Promise<number> {
  if (!Types.ObjectId.isValid(recipientId)) return 0;
  return Notification.countDocuments({
    recipientId: new Types.ObjectId(recipientId),
    readAt: null,
  });
}

async function emitUnread(recipientId: string) {
  const count = await unreadCount(recipientId);
  emitToUser(recipientId, 'notification:unread_count', { count });
}

export async function createAndEmit(
  input: CreateNotificationInput,
): Promise<PublicNotification | null> {
  if (!NOTIFICATION_TYPES.includes(input.type)) return null;
  if (!Types.ObjectId.isValid(input.recipientId)) return null;
  if (!Types.ObjectId.isValid(input.orgId)) return null;

  // Never notify yourself
  if (input.actorId && input.actorId === input.recipientId) return null;
  if (!input.actorId && input.recipientId === '') return null;

  const doc = await Notification.create({
    orgId: new Types.ObjectId(input.orgId),
    recipientId: new Types.ObjectId(input.recipientId),
    actorId: input.actorId && Types.ObjectId.isValid(input.actorId)
      ? new Types.ObjectId(input.actorId)
      : null,
    actorName: (input.actorName ?? '').trim(),
    type: input.type,
    title: input.title.trim().slice(0, 200),
    body: (input.body ?? '').trim().slice(0, 500),
    readAt: null,
    meta: {
      projectId: input.meta?.projectId ?? null,
      taskId: input.meta?.taskId ?? null,
      taskKey: input.meta?.taskKey ?? null,
      conversationId: input.meta?.conversationId ?? null,
      messageId: input.meta?.messageId ?? null,
      commentId: input.meta?.commentId ?? null,
      href: input.meta?.href ?? null,
    },
  });

  const notification = serializeNotification(doc);
  emitToUser(input.recipientId, 'notification:new', { notification });
  void emitUnread(input.recipientId);
  return notification;
}

/** Fire-and-forget helper for service hooks — never throws into callers. */
export function notifyQuietly(input: CreateNotificationInput) {
  void createAndEmit(input).catch((err) => {
    console.error('[notifications] createAndEmit failed', err);
  });
}

export async function listForUser(
  actor: Actor,
  opts: { limit?: number; unreadOnly?: boolean } = {},
) {
  const limit = Math.min(Math.max(opts.limit ?? 40, 1), 100);
  const filter: Record<string, unknown> = {
    recipientId: new Types.ObjectId(actor.sub),
  };
  if (opts.unreadOnly) filter.readAt = null;

  const docs = await Notification.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit);

  return {
    notifications: docs.map(serializeNotification),
    unreadCount: await unreadCount(actor.sub),
  };
}

export async function markRead(actor: Actor, notificationId: string) {
  if (!Types.ObjectId.isValid(notificationId)) {
    throw new AuthError('Notification not found', 404, 'NOT_FOUND');
  }
  const doc = await Notification.findOne({
    _id: notificationId,
    recipientId: actor.sub,
  });
  if (!doc) throw new AuthError('Notification not found', 404, 'NOT_FOUND');

  if (!doc.readAt) {
    doc.readAt = new Date();
    await doc.save();
    emitToUser(actor.sub, 'notification:read', { id: String(doc._id) });
    void emitUnread(actor.sub);
  }

  return serializeNotification(doc);
}

export async function markAllRead(actor: Actor) {
  const now = new Date();
  const result = await Notification.updateMany(
    { recipientId: actor.sub, readAt: null },
    { $set: { readAt: now } },
  );
  emitToUser(actor.sub, 'notification:read', { all: true });
  emitToUser(actor.sub, 'notification:unread_count', { count: 0 });
  return { ok: true as const, modified: result.modifiedCount };
}

export async function getUnreadCount(actor: Actor) {
  return { count: await unreadCount(actor.sub) };
}
