import { Types } from 'mongoose';
import { emitToUser } from '../../gateway/io.js';
import { AuthError } from '../auth/errors.js';
import {
  Notification,
  type NotificationDoc,
  type NotificationType,
} from './models/Notification.js';

type Actor = {
  sub: string;
  orgId: string;
  email?: string;
  name?: string;
};

export type SerializedNotification = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  href: string;
  actorId: string | null;
  actorName: string;
  projectId: string | null;
  taskId: string | null;
  conversationId: string | null;
  messageId: string | null;
  meta: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
};

function oid(id: string) {
  if (!Types.ObjectId.isValid(id)) throw new AuthError('Invalid id', 400);
  return new Types.ObjectId(id);
}

export function serializeNotification(doc: NotificationDoc): SerializedNotification {
  return {
    id: String(doc._id),
    type: doc.type as NotificationType,
    title: doc.title,
    body: doc.body ?? '',
    href: doc.href,
    actorId: doc.actorId ? String(doc.actorId) : null,
    actorName: doc.actorName ?? '',
    projectId: doc.projectId ? String(doc.projectId) : null,
    taskId: doc.taskId ? String(doc.taskId) : null,
    conversationId: doc.conversationId ? String(doc.conversationId) : null,
    messageId: doc.messageId ? String(doc.messageId) : null,
    meta: (doc.meta as Record<string, unknown>) ?? {},
    readAt: doc.readAt ? new Date(doc.readAt).toISOString() : null,
    createdAt: new Date(doc.createdAt).toISOString(),
  };
}

export type CreateNotificationInput = {
  orgId: string;
  recipientId: string;
  actorId?: string | null;
  actorName?: string;
  type: NotificationType;
  title: string;
  body?: string;
  href: string;
  projectId?: string | null;
  taskId?: string | null;
  conversationId?: string | null;
  messageId?: string | null;
  meta?: Record<string, unknown>;
};

/** Persist + push realtime to the recipient's personal socket room. */
export async function createAndEmit(
  input: CreateNotificationInput,
): Promise<SerializedNotification | null> {
  if (!input.recipientId || !Types.ObjectId.isValid(input.recipientId)) return null;
  if (input.actorId && input.actorId === input.recipientId) return null;

  const doc = await Notification.create({
    orgId: oid(input.orgId),
    recipientId: oid(input.recipientId),
    actorId: input.actorId && Types.ObjectId.isValid(input.actorId) ? oid(input.actorId) : null,
    actorName: (input.actorName ?? '').trim(),
    type: input.type,
    title: input.title.trim(),
    body: (input.body ?? '').trim(),
    href: input.href,
    projectId:
      input.projectId && Types.ObjectId.isValid(input.projectId) ? oid(input.projectId) : null,
    taskId: input.taskId && Types.ObjectId.isValid(input.taskId) ? oid(input.taskId) : null,
    conversationId:
      input.conversationId && Types.ObjectId.isValid(input.conversationId)
        ? oid(input.conversationId)
        : null,
    messageId:
      input.messageId && Types.ObjectId.isValid(input.messageId) ? oid(input.messageId) : null,
    meta: input.meta ?? {},
    readAt: null,
  });

  const notification = serializeNotification(doc as NotificationDoc);
  const unreadCount = await countUnread(input.recipientId);

  emitToUser(input.recipientId, 'notification:new', { notification });
  emitToUser(input.recipientId, 'notification:unread-count', { count: unreadCount });

  return notification;
}

export async function createAndEmitMany(
  inputs: CreateNotificationInput[],
): Promise<SerializedNotification[]> {
  const out: SerializedNotification[] = [];
  for (const input of inputs) {
    const n = await createAndEmit(input);
    if (n) out.push(n);
  }
  return out;
}

export async function listNotifications(
  actor: Actor,
  opts: { limit?: number; cursor?: string; unreadOnly?: boolean } = {},
) {
  const limit = Math.min(Math.max(opts.limit ?? 30, 1), 100);
  const filter: Record<string, unknown> = { recipientId: oid(actor.sub) };
  if (opts.unreadOnly) filter.readAt = null;
  if (opts.cursor && Types.ObjectId.isValid(opts.cursor)) {
    filter._id = { $lt: oid(opts.cursor) };
  }

  const docs = await Notification.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1)
    .lean();

  const hasMore = docs.length > limit;
  const page = hasMore ? docs.slice(0, limit) : docs;
  const notifications = page.map((d) => serializeNotification(d as NotificationDoc));
  const nextCursor = hasMore ? notifications[notifications.length - 1]?.id ?? null : null;
  const unreadCount = await countUnread(actor.sub);

  return { notifications, nextCursor, unreadCount };
}

export async function getNotification(actor: Actor, id: string) {
  const doc = await Notification.findOne({ _id: oid(id), recipientId: oid(actor.sub) });
  if (!doc) throw new AuthError('Notification not found', 404, 'NOT_FOUND');
  return serializeNotification(doc);
}

export async function countUnread(userId: string) {
  if (!Types.ObjectId.isValid(userId)) return 0;
  return Notification.countDocuments({ recipientId: oid(userId), readAt: null });
}

export async function markRead(actor: Actor, ids: string[]) {
  const objectIds = ids.filter((id) => Types.ObjectId.isValid(id)).map(oid);
  if (objectIds.length === 0) {
    return { updated: 0, unreadCount: await countUnread(actor.sub) };
  }

  const result = await Notification.updateMany(
    {
      _id: { $in: objectIds },
      recipientId: oid(actor.sub),
      readAt: null,
    },
    { $set: { readAt: new Date() } },
  );

  const unreadCount = await countUnread(actor.sub);
  emitToUser(actor.sub, 'notification:unread-count', { count: unreadCount });
  emitToUser(actor.sub, 'notification:read', { ids: objectIds.map(String) });

  return { updated: result.modifiedCount, unreadCount };
}

export async function markAllRead(actor: Actor) {
  const result = await Notification.updateMany(
    { recipientId: oid(actor.sub), readAt: null },
    { $set: { readAt: new Date() } },
  );
  emitToUser(actor.sub, 'notification:unread-count', { count: 0 });
  emitToUser(actor.sub, 'notification:read', { all: true });
  return { updated: result.modifiedCount, unreadCount: 0 };
}

export async function removeNotification(actor: Actor, id: string) {
  const result = await Notification.deleteOne({ _id: oid(id), recipientId: oid(actor.sub) });
  if (!result.deletedCount) throw new AuthError('Notification not found', 404, 'NOT_FOUND');
  const unreadCount = await countUnread(actor.sub);
  emitToUser(actor.sub, 'notification:unread-count', { count: unreadCount });
  return { ok: true, unreadCount };
}

/** Resolve project member seat id → User._id string. */
export function resolveMemberUserId(
  members: Array<{ id: string; userId?: Types.ObjectId | string | null }>,
  memberId: string | null | undefined,
): string | null {
  if (!memberId) return null;
  const m = members.find((x) => x.id === memberId);
  if (!m?.userId) return null;
  return String(m.userId);
}

export function boardTaskHref(projectId: string, taskId: string) {
  return `/board?project=${encodeURIComponent(projectId)}&task=${encodeURIComponent(taskId)}`;
}

export function chatHref(conversationId: string, messageId?: string) {
  const base = `/chat?c=${encodeURIComponent(conversationId)}`;
  return messageId ? `${base}&m=${encodeURIComponent(messageId)}` : base;
}

export function projectHref(projectId: string) {
  return `/board?project=${encodeURIComponent(projectId)}`;
}
