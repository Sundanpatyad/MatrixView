import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { Types } from 'mongoose';
import { AuthError } from '../auth/errors.js';
import { User } from '../auth/models/User.js';
import { ActivitySession } from '../activity/models/ActivitySession.js';
import { uploadsDir } from '../workspace/upload.js';
import {
  emitToConversation,
  emitToOrg,
  emitToUser,
} from '../../gateway/io.js';
import { Conversation } from './models/Conversation.js';
import { Message } from './models/Message.js';

type Actor = { sub: string; orgId: string; email: string; role?: string };

const CHAT_MAX_BYTES = 25 * 1024 * 1024;

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).slice(0, 16);
    cb(null, `chat-${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
  },
});

export const chatUpload = multer({
  storage,
  limits: { fileSize: CHAT_MAX_BYTES, files: 5 },
});

function attachmentKind(mime: string): 'image' | 'video' | 'document' | 'other' {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (
    mime.includes('pdf') ||
    mime.includes('document') ||
    mime.includes('sheet') ||
    mime.includes('text') ||
    mime.includes('msword') ||
    mime.includes('officedocument')
  ) {
    return 'document';
  }
  return 'other';
}

function fileToChatAttachment(file: Express.Multer.File) {
  return {
    id: `catt_${crypto.randomBytes(6).toString('hex')}`,
    name: file.originalname,
    size: file.size,
    mimeType: file.mimetype || 'application/octet-stream',
    url: `/uploads/${file.filename}`,
    kind: attachmentKind(file.mimetype || ''),
  };
}

function oid(id: string) {
  if (!Types.ObjectId.isValid(id)) throw new AuthError('Invalid id', 400);
  return new Types.ObjectId(id);
}

async function requireMember(conversationId: string, actor: Actor) {
  const conversation = await Conversation.findOne({
    _id: oid(conversationId),
    orgId: actor.orgId,
  });
  if (!conversation) throw new AuthError('Conversation not found', 404, 'NOT_FOUND');
  const isMember = conversation.memberIds.some((id) => String(id) === actor.sub);
  if (!isMember) throw new AuthError('Not a member of this chat', 403, 'FORBIDDEN');
  return conversation;
}

async function usersByIds(orgId: string, ids: string[]) {
  const users = await User.find({
    orgId,
    _id: { $in: ids.filter((id) => Types.ObjectId.isValid(id)) },
    status: { $in: ['active', 'invited', 'locked'] },
  })
    .select('_id name email role avatarUrl')
    .lean();
  return users;
}

function serializeUser(u: {
  _id: Types.ObjectId;
  name: string;
  email: string;
  role?: string;
  avatarUrl?: string | null;
}) {
  return {
    id: String(u._id),
    name: u.name,
    email: u.email,
    role: u.role ?? 'Member',
    avatarUrl: u.avatarUrl ?? null,
  };
}

type ReceiptLike = {
  userId: Types.ObjectId | string;
  deliveredAt?: Date | null;
  readAt?: Date | null;
};

function computeDeliveryStatus(
  senderId: string,
  memberIds: string[],
  receipts: ReceiptLike[],
): 'sent' | 'delivered' | 'read' {
  const others = memberIds.filter((id) => id !== senderId);
  if (others.length === 0) return 'read';

  const byUser = new Map(
    receipts.map((r) => [
      String(r.userId),
      { deliveredAt: r.deliveredAt ?? null, readAt: r.readAt ?? null },
    ]),
  );

  const allRead = others.every((id) => Boolean(byUser.get(id)?.readAt));
  if (allRead) return 'read';

  const allDelivered = others.every((id) => Boolean(byUser.get(id)?.deliveredAt));
  if (allDelivered) return 'delivered';

  return 'sent';
}

async function serializeConversation(doc: InstanceType<typeof Conversation>, actorId: string) {
  const members = await usersByIds(String(doc.orgId), doc.memberIds.map(String));
  const memberMap = new Map(members.map((m) => [String(m._id), m]));
  const sortedMembers = doc.memberIds
    .map((id) => memberMap.get(String(id)))
    .filter(Boolean)
    .map((m) => serializeUser(m!));

  let title = doc.name?.trim() || '';
  if (doc.type === 'dm') {
    const other = sortedMembers.find((m) => m.id !== actorId);
    title = other?.name ?? 'Direct message';
  }

  return {
    id: String(doc._id),
    type: doc.type as 'dm' | 'group',
    name: title,
    rawName: doc.name ?? '',
    avatarUrl: doc.avatarUrl ?? null,
    memberIds: doc.memberIds.map(String),
    members: sortedMembers,
    createdBy: String(doc.createdBy),
    lastMessageAt: doc.lastMessageAt?.toISOString?.() ?? doc.updatedAt.toISOString(),
    lastMessagePreview: doc.lastMessagePreview ?? '',
    createdAt: doc.createdAt.toISOString(),
  };
}

async function memberIdsForMessage(doc: InstanceType<typeof Message> | { conversationId: Types.ObjectId }) {
  const conversation = await Conversation.findById(doc.conversationId).select('memberIds').lean();
  return (conversation?.memberIds ?? []).map(String);
}

export async function serializeMessage(doc: InstanceType<typeof Message>) {
  const sender = await User.findById(doc.senderId).select('_id name email avatarUrl').lean();
  let replyTo = null;
  if (doc.replyToId) {
    const parent = await Message.findById(doc.replyToId).lean();
    if (parent) {
      const replySender = await User.findById(parent.senderId).select('name').lean();
      replyTo = {
        id: String(parent._id),
        body: parent.deletedAt ? '' : parent.body ?? '',
        senderName: replySender?.name ?? 'Unknown',
        deleted: Boolean(parent.deletedAt),
      };
    }
  }

  const memberIds = await memberIdsForMessage(doc);
  const receipts = (doc.receipts ?? []).map((r) => ({
    userId: String(r.userId),
    deliveredAt: r.deliveredAt ? r.deliveredAt.toISOString() : null,
    readAt: r.readAt ? r.readAt.toISOString() : null,
  }));

  return {
    id: String(doc._id),
    conversationId: String(doc.conversationId),
    senderId: String(doc.senderId),
    senderName: sender?.name ?? 'Unknown',
    senderAvatarUrl: sender?.avatarUrl ?? null,
    body: doc.deletedAt ? '' : doc.body ?? '',
    replyTo,
    attachments: doc.deletedAt
      ? []
      : (doc.attachments ?? []).map((a) => ({
          id: a.id,
          name: a.name,
          size: a.size,
          mimeType: a.mimeType,
          url: a.url,
          kind: a.kind ?? 'other',
        })),
    status: computeDeliveryStatus(String(doc.senderId), memberIds, doc.receipts ?? []),
    receipts,
    editedAt: doc.editedAt ? doc.editedAt.toISOString() : null,
    deletedAt: doc.deletedAt ? doc.deletedAt.toISOString() : null,
    createdAt: doc.createdAt.toISOString(),
  };
}

function broadcastMessageStatus(serialized: Awaited<ReturnType<typeof serializeMessage>>) {
  emitToConversation(serialized.conversationId, 'message:status', {
    messageId: serialized.id,
    conversationId: serialized.conversationId,
    status: serialized.status,
    receipts: serialized.receipts,
  });
  emitToUser(serialized.senderId, 'message:status', {
    messageId: serialized.id,
    conversationId: serialized.conversationId,
    status: serialized.status,
    receipts: serialized.receipts,
  });
}

export async function listConversations(actor: Actor) {
  const list = await Conversation.find({
    orgId: actor.orgId,
    memberIds: oid(actor.sub),
  }).sort({ lastMessageAt: -1 });

  return {
    conversations: await Promise.all(list.map((c) => serializeConversation(c, actor.sub))),
  };
}

export async function listChatUsers(actor: Actor) {
  const [users, activeSessions] = await Promise.all([
    User.find({
      orgId: actor.orgId,
      status: { $in: ['active', 'invited', 'locked'] },
    })
      .select('_id name email role avatarUrl')
      .sort({ name: 1 })
      .lean(),
    ActivitySession.find({ orgId: actor.orgId, status: 'active' }).select('userId').lean(),
  ]);

  const checkedIn = new Set(activeSessions.map((s) => String(s.userId)));

  return {
    users: users.map((u) => ({
      ...serializeUser(u),
      checkedIn: checkedIn.has(String(u._id)),
    })),
  };
}

export async function getOrCreateDm(actor: Actor, otherUserId: string) {
  if (otherUserId === actor.sub) {
    throw new AuthError('Cannot chat with yourself', 400);
  }
  const other = await User.findOne({
    _id: oid(otherUserId),
    orgId: actor.orgId,
    status: { $in: ['active', 'invited', 'locked'] },
  });
  if (!other) throw new AuthError('User not found', 404, 'NOT_FOUND');

  const existing = await Conversation.findOne({
    orgId: actor.orgId,
    type: 'dm',
    memberIds: { $all: [oid(actor.sub), oid(otherUserId)], $size: 2 },
  });
  if (existing) {
    return { conversation: await serializeConversation(existing, actor.sub) };
  }

  const conversation = await Conversation.create({
    orgId: actor.orgId,
    type: 'dm',
    name: '',
    memberIds: [oid(actor.sub), other._id],
    createdBy: oid(actor.sub),
    lastMessageAt: new Date(),
    lastMessagePreview: '',
  });

  const serialized = await serializeConversation(conversation, actor.sub);
  for (const memberId of serialized.memberIds) {
    emitToUser(memberId, 'conversation:upsert', { conversation: serialized });
  }
  return { conversation: serialized };
}

export async function createGroup(
  actor: Actor,
  input: { name: string; memberIds: string[] },
) {
  const name = input.name.trim();
  if (!name) throw new AuthError('Group name required', 400);

  const uniqueIds = [...new Set([actor.sub, ...input.memberIds.map(String)])];
  const users = await usersByIds(actor.orgId, uniqueIds);
  if (users.length < 2) {
    throw new AuthError('Add at least one other member', 400);
  }

  const conversation = await Conversation.create({
    orgId: actor.orgId,
    type: 'group',
    name,
    memberIds: users.map((u) => u._id),
    createdBy: oid(actor.sub),
    lastMessageAt: new Date(),
    lastMessagePreview: 'Group created',
  });

  const serialized = await serializeConversation(conversation, actor.sub);
  for (const memberId of serialized.memberIds) {
    emitToUser(memberId, 'conversation:upsert', { conversation: serialized });
  }
  return { conversation: serialized };
}

export async function updateGroup(
  actor: Actor,
  conversationId: string,
  input: { name: string },
) {
  const conversation = await requireMember(conversationId, actor);
  if (conversation.type !== 'group') {
    throw new AuthError('Only groups can be renamed', 400);
  }
  const name = input.name.trim();
  if (!name) throw new AuthError('Group name required', 400);
  conversation.name = name;
  await conversation.save();
  const serialized = await serializeConversation(conversation, actor.sub);
  emitToConversation(conversationId, 'conversation:upsert', { conversation: serialized });
  for (const memberId of serialized.memberIds) {
    emitToUser(memberId, 'conversation:upsert', { conversation: serialized });
  }
  return { conversation: serialized };
}

export async function updateGroupAvatar(
  actor: Actor,
  conversationId: string,
  avatarUrl: string,
) {
  const conversation = await requireMember(conversationId, actor);
  if (conversation.type !== 'group') {
    throw new AuthError('Only groups can have an image', 400);
  }
  conversation.avatarUrl = avatarUrl;
  await conversation.save();
  const serialized = await serializeConversation(conversation, actor.sub);
  emitToConversation(conversationId, 'conversation:upsert', { conversation: serialized });
  for (const memberId of serialized.memberIds) {
    emitToUser(memberId, 'conversation:upsert', { conversation: serialized });
  }
  return { conversation: serialized };
}

export async function addGroupMembers(
  actor: Actor,
  conversationId: string,
  memberIds: string[],
) {
  const conversation = await requireMember(conversationId, actor);
  if (conversation.type !== 'group') {
    throw new AuthError('Only groups support members', 400);
  }

  const users = await usersByIds(actor.orgId, memberIds);
  const existing = new Set(conversation.memberIds.map(String));
  for (const u of users) {
    if (!existing.has(String(u._id))) {
      conversation.memberIds.push(u._id);
    }
  }
  await conversation.save();
  const serialized = await serializeConversation(conversation, actor.sub);
  for (const memberId of serialized.memberIds) {
    emitToUser(memberId, 'conversation:upsert', { conversation: serialized });
  }
  return { conversation: serialized };
}

export async function removeGroupMember(
  actor: Actor,
  conversationId: string,
  userId: string,
) {
  const conversation = await requireMember(conversationId, actor);
  if (conversation.type !== 'group') {
    throw new AuthError('Only groups support members', 400);
  }

  const removingSelf = userId === actor.sub;
  const isCreator = String(conversation.createdBy) === actor.sub;
  if (!removingSelf && !isCreator) {
    throw new AuthError('Only the group creator can remove members', 403, 'FORBIDDEN');
  }

  const next = conversation.memberIds.filter((id) => String(id) !== userId);
  if (next.length < 1) {
    throw new AuthError('Group must keep at least one member', 400);
  }
  conversation.memberIds = next as typeof conversation.memberIds;
  await conversation.save();
  const serialized = await serializeConversation(conversation, actor.sub);
  emitToUser(userId, 'conversation:removed', { conversationId });
  for (const memberId of serialized.memberIds) {
    emitToUser(memberId, 'conversation:upsert', { conversation: serialized });
  }
  return { conversation: serialized };
}

export async function listMessages(
  actor: Actor,
  conversationId: string,
  opts?: { after?: string },
) {
  await requireMember(conversationId, actor);
  const filter: Record<string, unknown> = { conversationId: oid(conversationId) };
  if (opts?.after) {
    const afterDate = new Date(opts.after);
    if (!Number.isNaN(+afterDate)) {
      filter.createdAt = { $gt: afterDate };
    }
  }
  const messages = await Message.find(filter).sort({ createdAt: 1 }).limit(500);
  return {
    messages: await Promise.all(messages.map((m) => serializeMessage(m))),
  };
}

export async function sendMessage(
  actor: Actor,
  conversationId: string,
  input: { body?: string; replyToId?: string },
  files: Express.Multer.File[] = [],
) {
  const conversation = await requireMember(conversationId, actor);
  const body = (input.body ?? '').trim();
  const attachments = files.map(fileToChatAttachment);

  if (!body && attachments.length === 0) {
    throw new AuthError('Message cannot be empty', 400);
  }

  let replyToId: Types.ObjectId | null = null;
  if (input.replyToId) {
    const parent = await Message.findOne({
      _id: oid(input.replyToId),
      conversationId: conversation._id,
    });
    if (!parent || parent.deletedAt) {
      throw new AuthError('Reply target not found', 404, 'NOT_FOUND');
    }
    replyToId = parent._id;
  }

  const message = await Message.create({
    orgId: actor.orgId,
    conversationId: conversation._id,
    senderId: oid(actor.sub),
    body,
    replyToId,
    attachments,
    receipts: [],
  });

  const preview =
    body ||
    (attachments[0]
      ? attachments[0].kind === 'image'
        ? '📷 Photo'
        : attachments[0].kind === 'video'
          ? '🎬 Video'
          : `📎 ${attachments[0].name}`
      : '');

  conversation.lastMessageAt = new Date();
  conversation.lastMessagePreview = preview.slice(0, 160);
  await conversation.save();

  const serialized = await serializeMessage(message);
  const convSerialized = await serializeConversation(conversation, actor.sub);

  emitToConversation(conversationId, 'message:new', { message: serialized });
  for (const memberId of conversation.memberIds.map(String)) {
    emitToUser(memberId, 'message:new', { message: serialized });
    emitToUser(memberId, 'conversation:upsert', { conversation: convSerialized });
  }

  return { message: serialized };
}

export async function forwardMessage(
  actor: Actor,
  messageId: string,
  targetConversationId: string,
) {
  const source = await Message.findOne({ _id: oid(messageId), orgId: actor.orgId });
  if (!source || source.deletedAt) {
    throw new AuthError('Message not found', 404, 'NOT_FOUND');
  }
  await requireMember(String(source.conversationId), actor);
  const target = await requireMember(targetConversationId, actor);

  const body = (source.body ?? '').trim();
  const attachments = (source.attachments ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    size: a.size,
    mimeType: a.mimeType,
    url: a.url,
    kind: a.kind,
  }));

  if (!body && attachments.length === 0) {
    throw new AuthError('Nothing to forward', 400);
  }

  const sender = await User.findById(source.senderId).select('name').lean();
  const forwardLabel = sender?.name ? `Forwarded from ${sender.name}` : 'Forwarded message';
  const messageBody = body ? `${body}` : '';

  const message = await Message.create({
    orgId: actor.orgId,
    conversationId: target._id,
    senderId: oid(actor.sub),
    body: messageBody,
    replyToId: null,
    attachments,
    receipts: [],
  });

  const preview =
    messageBody ||
    (attachments[0]
      ? attachments[0].kind === 'image'
        ? '📷 Photo'
        : attachments[0].kind === 'video'
          ? '🎬 Video'
          : `📎 ${attachments[0].name}`
      : forwardLabel);

  target.lastMessageAt = new Date();
  target.lastMessagePreview = `↪ ${preview}`.slice(0, 160);
  await target.save();

  const serialized = await serializeMessage(message);
  const convSerialized = await serializeConversation(target, actor.sub);

  emitToConversation(targetConversationId, 'message:new', { message: serialized });
  for (const memberId of target.memberIds.map(String)) {
    emitToUser(memberId, 'message:new', { message: serialized });
    emitToUser(memberId, 'conversation:upsert', { conversation: convSerialized });
  }

  return { message: serialized, conversation: convSerialized };
}

export async function editMessage(actor: Actor, messageId: string, body: string) {
  const message = await Message.findOne({ _id: oid(messageId), orgId: actor.orgId });
  if (!message || message.deletedAt) {
    throw new AuthError('Message not found', 404, 'NOT_FOUND');
  }
  if (String(message.senderId) !== actor.sub) {
    throw new AuthError('You can only edit your own messages', 403, 'FORBIDDEN');
  }
  await requireMember(String(message.conversationId), actor);

  const trimmed = body.trim();
  if (!trimmed && (message.attachments?.length ?? 0) === 0) {
    throw new AuthError('Message cannot be empty', 400);
  }

  message.body = trimmed;
  message.editedAt = new Date();
  await message.save();
  const serialized = await serializeMessage(message);
  emitToConversation(serialized.conversationId, 'message:edited', { message: serialized });
  for (const memberId of await memberIdsForMessage(message)) {
    emitToUser(memberId, 'message:edited', { message: serialized });
  }
  return { message: serialized };
}

export async function deleteMessage(actor: Actor, messageId: string) {
  const message = await Message.findOne({ _id: oid(messageId), orgId: actor.orgId });
  if (!message || message.deletedAt) {
    throw new AuthError('Message not found', 404, 'NOT_FOUND');
  }
  if (String(message.senderId) !== actor.sub) {
    throw new AuthError('You can only delete your own messages', 403, 'FORBIDDEN');
  }
  await requireMember(String(message.conversationId), actor);

  message.deletedAt = new Date();
  message.body = '';
  message.set('attachments', []);
  await message.save();
  const serialized = await serializeMessage(message);
  emitToConversation(serialized.conversationId, 'message:deleted', { message: serialized });
  for (const memberId of await memberIdsForMessage(message)) {
    emitToUser(memberId, 'message:deleted', { message: serialized });
  }
  return { message: serialized };
}

export async function markMessagesDelivered(actor: Actor, conversationId: string) {
  await requireMember(conversationId, actor);
  const now = new Date();
  const messages = await Message.find({
    conversationId: oid(conversationId),
    senderId: { $ne: oid(actor.sub) },
    deletedAt: null,
    $or: [
      { receipts: { $not: { $elemMatch: { userId: oid(actor.sub) } } } },
      {
        receipts: {
          $elemMatch: { userId: oid(actor.sub), deliveredAt: null },
        },
      },
    ],
  }).limit(200);

  const updated = [];
  for (const message of messages) {
    const idx = message.receipts.findIndex((r) => String(r.userId) === actor.sub);
    if (idx >= 0) {
      if (!message.receipts[idx].deliveredAt) {
        message.receipts[idx].deliveredAt = now;
      }
    } else {
      message.receipts.push({
        userId: oid(actor.sub),
        deliveredAt: now,
        readAt: null,
      } as (typeof message.receipts)[number]);
    }
    await message.save();
    const serialized = await serializeMessage(message);
    broadcastMessageStatus(serialized);
    updated.push(serialized);
  }
  return updated;
}

export async function markMessagesRead(actor: Actor, conversationId: string) {
  await requireMember(conversationId, actor);
  const now = new Date();
  const messages = await Message.find({
    conversationId: oid(conversationId),
    senderId: { $ne: oid(actor.sub) },
    deletedAt: null,
    $or: [
      { receipts: { $not: { $elemMatch: { userId: oid(actor.sub) } } } },
      {
        receipts: {
          $elemMatch: { userId: oid(actor.sub), readAt: null },
        },
      },
    ],
  }).limit(200);

  const updated = [];
  for (const message of messages) {
    const idx = message.receipts.findIndex((r) => String(r.userId) === actor.sub);
    if (idx >= 0) {
      if (!message.receipts[idx].deliveredAt) message.receipts[idx].deliveredAt = now;
      if (!message.receipts[idx].readAt) message.receipts[idx].readAt = now;
    } else {
      message.receipts.push({
        userId: oid(actor.sub),
        deliveredAt: now,
        readAt: now,
      } as (typeof message.receipts)[number]);
    }
    await message.save();
    const serialized = await serializeMessage(message);
    broadcastMessageStatus(serialized);
    updated.push(serialized);
  }
  return updated;
}

/** Used by activity module — re-export org emit helper availability */
export function notifyOrgConversationRefresh(orgId: string, conversationId: string) {
  emitToOrg(orgId, 'conversation:refresh', { conversationId });
}
