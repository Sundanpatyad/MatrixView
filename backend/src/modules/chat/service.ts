import crypto from 'node:crypto';
import multer from 'multer';
import { Types } from 'mongoose';
import { AuthError } from '../auth/errors.js';
import { User, type UserDoc } from '../auth/models/User.js';
import { ActivitySession } from '../activity/models/ActivitySession.js';
import { Project } from '../workspace/models/Project.js';
import {
  deleteStoredMedia,
  deleteStoredMediaMany,
  storeUploadedFile,
  type StoredMediaRef,
} from '../../storage/media.js';
import {
  emitToConversation,
  emitToOrg,
  emitToUser,
  onlineCounts,
} from '../../gateway/io.js';
import { Conversation } from './models/Conversation.js';
import { ConversationMemberState } from './models/ConversationMemberState.js';
import { UserBlock } from './models/UserBlock.js';
import { Message } from './models/Message.js';
import { fetchLinkPreview, firstHttpUrl } from './linkPreview.js';
import {
  chatHref,
  createAndEmitMany,
} from '../notifications/service.js';

type Actor = { sub: string; orgId: string; email: string; role?: string };

const CHAT_MAX_BYTES = 25 * 1024 * 1024;

export const chatUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: CHAT_MAX_BYTES, files: 5 },
});

function attachmentKind(
  mime: string,
): 'image' | 'video' | 'audio' | 'document' | 'other' {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (
    mime.includes('pdf') ||
    mime.includes('document') ||
    mime.includes('sheet') ||
    mime.includes('text') ||
    mime.includes('msword') ||
    mime.includes('officedocument') ||
    mime.includes('presentation')
  ) {
    return 'document';
  }
  return 'other';
}

async function fileToChatAttachment(file: Express.Multer.File) {
  const stored = await storeUploadedFile(file, 'chat');
  return {
    id: `catt_${crypto.randomBytes(6).toString('hex')}`,
    name: stored.name || file.originalname,
    size: stored.size,
    mimeType: stored.mimeType,
    url: stored.url,
    kind: attachmentKind(stored.mimeType),
    storageProvider: stored.provider,
    storageKey: stored.storageKey,
  };
}

function oid(id: string) {
  if (!Types.ObjectId.isValid(id)) throw new AuthError('Invalid id', 400);
  return new Types.ObjectId(id);
}

export async function blockedUserIdsFor(userId: string): Promise<Set<string>> {
  const rows = await UserBlock.find({ userId: oid(userId) }).select('blockedUserId').lean();
  return new Set(rows.map((row) => String(row.blockedUserId)));
}

export async function areUsersBlocked(a: string, b: string): Promise<boolean> {
  if (!Types.ObjectId.isValid(a) || !Types.ObjectId.isValid(b)) return false;
  const row = await UserBlock.exists({
    $or: [
      { userId: new Types.ObjectId(a), blockedUserId: new Types.ObjectId(b) },
      { userId: new Types.ObjectId(b), blockedUserId: new Types.ObjectId(a) },
    ],
  });
  return Boolean(row);
}

async function assertCanDm(actorId: string, otherId: string) {
  const iBlocked = await UserBlock.exists({
    userId: oid(actorId),
    blockedUserId: oid(otherId),
  });
  if (iBlocked) {
    throw new AuthError(
      'You blocked this person. Unblock them to send a message.',
      403,
      'USER_BLOCKED',
    );
  }
  const theyBlocked = await UserBlock.exists({
    userId: oid(otherId),
    blockedUserId: oid(actorId),
  });
  if (theyBlocked) {
    throw new AuthError('Message could not be sent', 403, 'USER_BLOCKED');
  }
}

async function requireMember(conversationId: string, actor: Actor) {
  const conversation = await Conversation.findById(oid(conversationId));
  if (!conversation) throw new AuthError('Conversation not found', 404, 'NOT_FOUND');
  const isMember = conversation.memberIds.some((id) => String(id) === actor.sub);
  if (!isMember) throw new AuthError('Not a member of this chat', 403, 'FORBIDDEN');
  return conversation;
}

async function usersByIds(ids: string[]) {
  const users = await User.find({
    _id: { $in: ids.filter((id) => Types.ObjectId.isValid(id)) },
    status: { $in: ['active', 'invited', 'locked'] },
  })
    .select('_id name email role avatarUrl')
    .lean();
  return users;
}

/** User ids who share ≥1 project (admin or member) with the actor. */
async function sharedProjectPeerIds(actor: Actor): Promise<Set<string>> {
  const email = actor.email.toLowerCase().trim();
  const projects = await Project.find({ 'members.email': email }).select('members').lean();

  const peerIds = new Set<string>();
  for (const project of projects) {
    const me = project.members.find((m) => m.email.toLowerCase() === email);
    if (!me || me.status === 'pending') continue;

    for (const m of project.members) {
      if (m.status === 'pending' || !m.userId) continue;
      const id = String(m.userId);
      if (id !== actor.sub) peerIds.add(id);
    }
  }
  return peerIds;
}

async function assertCanChatWith(actor: Actor, userIds: string[]) {
  const peers = await sharedProjectPeerIds(actor);
  const others = [...new Set(userIds.map(String))].filter((id) => id !== actor.sub);
  for (const id of others) {
    if (!peers.has(id)) {
      throw new AuthError(
        'You can only chat with people who share a project with you',
        403,
        'FORBIDDEN',
      );
    }
  }
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

type MemberPrefs = {
  muted: boolean;
  pinned: boolean;
  pinnedAt: string | null;
  clearedAt: Date | null;
  hiddenAt: Date | null;
};

const DEFAULT_PREFS: MemberPrefs = {
  muted: false,
  pinned: false,
  pinnedAt: null,
  clearedAt: null,
  hiddenAt: null,
};

async function prefsFor(
  conversationId: string,
  userId: string,
): Promise<MemberPrefs> {
  const state = await ConversationMemberState.findOne({
    conversationId: oid(conversationId),
    userId: oid(userId),
  }).lean();
  if (!state) return { ...DEFAULT_PREFS };
  return {
    muted: Boolean(state.muted),
    pinned: Boolean(state.pinned),
    pinnedAt: state.pinnedAt ? state.pinnedAt.toISOString() : null,
    clearedAt: state.clearedAt ?? null,
    hiddenAt: state.hiddenAt ?? null,
  };
}

async function prefsMapForUser(
  userId: string,
  conversationIds: string[],
): Promise<Map<string, MemberPrefs>> {
  const map = new Map<string, MemberPrefs>();
  if (conversationIds.length === 0) return map;
  const rows = await ConversationMemberState.find({
    userId: oid(userId),
    conversationId: { $in: conversationIds.map((id) => oid(id)) },
  }).lean();
  for (const state of rows) {
    map.set(String(state.conversationId), {
      muted: Boolean(state.muted),
      pinned: Boolean(state.pinned),
      pinnedAt: state.pinnedAt ? state.pinnedAt.toISOString() : null,
      clearedAt: state.clearedAt ?? null,
      hiddenAt: state.hiddenAt ?? null,
    });
  }
  return map;
}

async function upsertMemberState(
  actor: Actor,
  conversationId: string,
  patch: Partial<{
    muted: boolean;
    pinned: boolean;
    pinnedAt: Date | null;
    clearedAt: Date | null;
    hiddenAt: Date | null;
  }>,
) {
  return ConversationMemberState.findOneAndUpdate(
    { conversationId: oid(conversationId), userId: oid(actor.sub) },
    {
      $set: {
        ...patch,
        orgId: oid(actor.orgId),
        conversationId: oid(conversationId),
        userId: oid(actor.sub),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

async function serializeConversation(
  doc: InstanceType<typeof Conversation>,
  actorId: string,
  prefs?: MemberPrefs,
) {
  const members = await usersByIds(doc.memberIds.map(String));
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

  const memberPrefs = prefs ?? (await prefsFor(String(doc._id), actorId));
  const lastMessageAt = doc.lastMessageAt?.toISOString?.() ?? doc.updatedAt.toISOString();
  const cleared = memberPrefs.clearedAt;
  const previewCleared =
    cleared && doc.lastMessageAt && doc.lastMessageAt.getTime() <= cleared.getTime();

  return {
    id: String(doc._id),
    type: doc.type as 'dm' | 'group',
    name: title,
    rawName: doc.name ?? '',
    avatarUrl: doc.avatarUrl ?? null,
    memberIds: doc.memberIds.map(String),
    members: sortedMembers,
    createdBy: String(doc.createdBy),
    lastMessageAt,
    lastMessagePreview: previewCleared ? '' : doc.lastMessagePreview ?? '',
    createdAt: doc.createdAt.toISOString(),
    muted: memberPrefs.muted,
    pinned: memberPrefs.pinned,
    pinnedAt: memberPrefs.pinnedAt,
  };
}

async function emitConversationUpsert(doc: InstanceType<typeof Conversation>) {
  for (const memberId of doc.memberIds.map(String)) {
    const conversation = await serializeConversation(doc, memberId);
    emitToUser(memberId, 'conversation:upsert', { conversation });
  }
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
    type: (doc.type as 'text' | 'call' | undefined) ?? 'text',
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
    call:
      doc.type === 'call' && doc.call
        ? {
            callId: doc.call.callId,
            outcome: doc.call.outcome as
              | 'answered'
              | 'missed'
              | 'rejected'
              | 'cancelled'
              | 'failed',
            mediaKind: (doc.call.mediaKind as 'audio' | 'video' | undefined) ?? 'audio',
            durationSeconds: doc.call.durationSeconds ?? 0,
            initiatedBy: String(doc.call.initiatedBy),
          }
        : null,
    status: computeDeliveryStatus(String(doc.senderId), memberIds, doc.receipts ?? []),
    receipts,
    forwarded: Boolean(doc.forwarded),
    forwardedFrom: doc.forwardedFrom ?? null,
    linkPreview:
      doc.deletedAt || !doc.linkPreview
        ? null
        : {
            url: doc.linkPreview.url,
            host: doc.linkPreview.host ?? '',
            title: doc.linkPreview.title ?? '',
            description: doc.linkPreview.description ?? '',
            imageUrl: doc.linkPreview.imageUrl ?? null,
            siteName: doc.linkPreview.siteName ?? '',
          },
    editedAt: doc.editedAt ? doc.editedAt.toISOString() : null,
    deletedAt: doc.deletedAt ? doc.deletedAt.toISOString() : null,
    createdAt: doc.createdAt.toISOString(),
  };
}

async function broadcastMessageEdited(message: InstanceType<typeof Message>) {
  const serialized = await serializeMessage(message);
  emitToConversation(serialized.conversationId, 'message:edited', { message: serialized });
  for (const memberId of await memberIdsForMessage(message)) {
    emitToUser(memberId, 'message:edited', { message: serialized });
  }
  return serialized;
}

export async function getLinkPreviewForUrl(url: string) {
  const preview = await fetchLinkPreview(url);
  return { preview };
}

export function scheduleLinkPreview(messageId: string) {
  void attachLinkPreview(messageId).catch((err) => {
    console.error('[chat] link preview', err);
  });
}

async function attachLinkPreview(messageId: string) {
  const message = await Message.findById(messageId);
  if (!message || message.deletedAt) return;
  const url = firstHttpUrl(message.body ?? '');
  if (!url) {
    if (message.linkPreview) {
      message.linkPreview = null;
      await message.save();
      await broadcastMessageEdited(message);
    }
    return;
  }
  const preview = await fetchLinkPreview(url);
  if (!preview) return;
  message.linkPreview = preview;
  await message.save();
  await broadcastMessageEdited(message);
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
    memberIds: oid(actor.sub),
  }).sort({ lastMessageAt: -1 });

  const [prefsById, blockedIds] = await Promise.all([
    prefsMapForUser(
      actor.sub,
      list.map((c) => String(c._id)),
    ),
    blockedUserIdsFor(actor.sub),
  ]);

  const visible = list.filter((c) => {
    if (c.type === 'dm') {
      const otherId = c.memberIds.map(String).find((id) => id !== actor.sub);
      if (otherId && blockedIds.has(otherId)) return false;
    }
    const prefs = prefsById.get(String(c._id));
    if (!prefs?.hiddenAt) return true;
    const last = c.lastMessageAt?.getTime?.() ?? 0;
    return last > prefs.hiddenAt.getTime();
  });

  const conversations = await Promise.all(
    visible.map((c) =>
      serializeConversation(c, actor.sub, prefsById.get(String(c._id)) ?? DEFAULT_PREFS),
    ),
  );

  conversations.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (a.pinned && b.pinned) {
      return new Date(b.pinnedAt ?? 0).getTime() - new Date(a.pinnedAt ?? 0).getTime();
    }
    return new Date(b.lastMessageAt ?? 0).getTime() - new Date(a.lastMessageAt ?? 0).getTime();
  });

  return { conversations };
}

export async function listChatUsers(actor: Actor) {
  const peerIds = await sharedProjectPeerIds(actor);
  const conversations = await Conversation.find({ memberIds: oid(actor.sub) })
    .select('memberIds')
    .lean();
  for (const c of conversations) {
    for (const id of c.memberIds) {
      const s = String(id);
      if (s !== actor.sub) peerIds.add(s);
    }
  }
  if (peerIds.size === 0) {
    return { users: [] };
  }

  const blockedIds = await blockedUserIdsFor(actor.sub);
  const peerObjectIds = [...peerIds]
    .filter((id) => !blockedIds.has(id))
    .map((id) => oid(id));
  if (peerObjectIds.length === 0) {
    return { users: [] };
  }
  const [users, activeSessions] = await Promise.all([
    User.find({
      _id: { $in: peerObjectIds },
      status: { $in: ['active', 'invited', 'locked'] },
    })
      .select('_id name email role avatarUrl')
      .sort({ name: 1 })
      .lean(),
    ActivitySession.find({
      userId: { $in: peerObjectIds },
      status: 'active',
    })
      .select('userId')
      .lean(),
  ]);

  const checkedIn = new Set(activeSessions.map((s) => String(s.userId)));

  return {
    users: users.map((u) => {
      const id = String(u._id);
      return {
        ...serializeUser(u),
        checkedIn: checkedIn.has(id),
        online: (onlineCounts.get(id) ?? 0) > 0,
      };
    }),
  };
}

/**
 * Start a DM with:
 * - a shared-project peer (by userId), or
 * - any registered platform user (by email).
 */
export async function getOrCreateDm(
  actor: Actor,
  input: { userId?: string; email?: string },
) {
  const email = input.email?.trim().toLowerCase() ?? '';
  const userId = input.userId?.trim() ?? '';

  let other: UserDoc | null = null;

  if (email) {
    other = await User.findOne({
      email,
      status: { $in: ['active', 'invited', 'locked'] },
    });
    if (!other) {
      throw new AuthError(
        'No DockX account found with that email',
        404,
        'NOT_FOUND',
      );
    }
  } else if (userId) {
    await assertCanChatWith(actor, [userId]);
    other = await User.findOne({
      _id: oid(userId),
      status: { $in: ['active', 'invited', 'locked'] },
    });
    if (!other) throw new AuthError('User not found', 404, 'NOT_FOUND');
  } else {
    throw new AuthError('Email or user id required', 400);
  }

  if (String(other._id) === actor.sub) {
    throw new AuthError('Cannot chat with yourself', 400);
  }

  const otherId = String(other._id);
  await assertCanDm(actor.sub, otherId);
  const existing = await Conversation.findOne({
    type: 'dm',
    memberIds: { $all: [oid(actor.sub), oid(otherId)], $size: 2 },
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

  await emitConversationUpsert(conversation);
  return { conversation: await serializeConversation(conversation, actor.sub) };
}

export async function createGroup(
  actor: Actor,
  input: { name: string; memberIds: string[] },
) {
  const name = input.name.trim();
  if (!name) throw new AuthError('Group name required', 400);

  const uniqueIds = [...new Set([actor.sub, ...input.memberIds.map(String)])];
  await assertCanChatWith(actor, uniqueIds);
  const users = await usersByIds(uniqueIds);
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

  await emitConversationUpsert(conversation);
  const serialized = await serializeConversation(conversation, actor.sub);

  const creator = users.find((u) => String(u._id) === actor.sub);
  const creatorName = creator?.name ?? 'Someone';
  void createAndEmitMany(
    users
      .filter((u) => String(u._id) !== actor.sub)
      .map((u) => ({
        orgId: actor.orgId,
        recipientId: String(u._id),
        actorId: actor.sub,
        actorName: creatorName,
        type: 'team.added' as const,
        title: 'Added to team chat',
        body: `${creatorName} added you to “${name}”`,
        href: chatHref(String(conversation._id)),
        conversationId: String(conversation._id),
        meta: { conversationName: name },
      })),
  ).catch((err) => console.error('[notifications] team.added', err));

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
  await emitConversationUpsert(conversation);
  return { conversation: await serializeConversation(conversation, actor.sub) };
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
  const previousUrl = conversation.avatarUrl ?? null;
  conversation.avatarUrl = avatarUrl;
  await conversation.save();
  if (previousUrl && previousUrl !== avatarUrl) {
    await deleteStoredMedia(previousUrl);
  }
  await emitConversationUpsert(conversation);
  return { conversation: await serializeConversation(conversation, actor.sub) };
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

  await assertCanChatWith(actor, memberIds);
  const users = await usersByIds(memberIds);
  const existing = new Set(conversation.memberIds.map(String));
  const newlyAdded: string[] = [];
  for (const u of users) {
    if (!existing.has(String(u._id))) {
      conversation.memberIds.push(u._id);
      newlyAdded.push(String(u._id));
    }
  }
  await conversation.save();
  await emitConversationUpsert(conversation);
  const serialized = await serializeConversation(conversation, actor.sub);

  if (newlyAdded.length > 0) {
    const actorUser = await User.findById(actor.sub).select('name').lean();
    const actorName = actorUser?.name ?? 'Someone';
    const groupName = conversation.name || 'group chat';
    void createAndEmitMany(
      newlyAdded.map((recipientId) => ({
        orgId: actor.orgId,
        recipientId,
        actorId: actor.sub,
        actorName,
        type: 'team.added' as const,
        title: 'Added to team chat',
        body: `${actorName} added you to “${groupName}”`,
        href: chatHref(conversationId),
        conversationId,
        meta: { conversationName: groupName },
      })),
    ).catch((err) => console.error('[notifications] team.added', err));
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
  emitToUser(userId, 'conversation:removed', { conversationId });
  await emitConversationUpsert(conversation);
  return { conversation: await serializeConversation(conversation, actor.sub) };
}

export async function listMessages(
  actor: Actor,
  conversationId: string,
  opts?: { after?: string; before?: string; limit?: number },
) {
  await requireMember(conversationId, actor);
  const prefs = await prefsFor(conversationId, actor.sub);
  const filter: Record<string, unknown> = { conversationId: oid(conversationId) };
  if (prefs.clearedAt) {
    filter.createdAt = { $gt: prefs.clearedAt };
  }
  const rawLimit = opts?.limit ?? (opts?.after ? 500 : 40);
  const limit = Math.min(Math.max(rawLimit, 1), 500);

  // Incremental sync: only messages newer than `after`
  if (opts?.after) {
    const afterDate = new Date(opts.after);
    if (!Number.isNaN(+afterDate)) {
      const minAfter =
        prefs.clearedAt && prefs.clearedAt.getTime() > afterDate.getTime()
          ? prefs.clearedAt
          : afterDate;
      filter.createdAt = { $gt: minAfter };
    }
    const messages = await Message.find(filter).sort({ createdAt: 1 }).limit(limit);
    return {
      messages: await Promise.all(messages.map((m) => serializeMessage(m))),
      hasMore: false,
    };
  }

  // Older page: messages strictly before `before` (scroll-up history)
  if (opts?.before) {
    const beforeDate = new Date(opts.before);
    if (!Number.isNaN(+beforeDate)) {
      filter.createdAt = { $lt: beforeDate };
    }
    const batch = await Message.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit + 1);
    const hasMore = batch.length > limit;
    const slice = hasMore ? batch.slice(0, limit) : batch;
    slice.reverse();
    return {
      messages: await Promise.all(slice.map((m) => serializeMessage(m))),
      hasMore,
    };
  }

  // Initial page: latest N messages (oldest → newest in the page)
  const batch = await Message.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit + 1);
  const hasMore = batch.length > limit;
  const slice = hasMore ? batch.slice(0, limit) : batch;
  slice.reverse();
  return {
    messages: await Promise.all(slice.map((m) => serializeMessage(m))),
    hasMore,
  };
}

export async function sendMessage(
  actor: Actor,
  conversationId: string,
  input: { body?: string; replyToId?: string },
  files: Express.Multer.File[] = [],
) {
  const conversation = await requireMember(conversationId, actor);
  if (conversation.type === 'dm') {
    const otherId = conversation.memberIds.map(String).find((id) => id !== actor.sub);
    if (otherId) await assertCanDm(actor.sub, otherId);
  }
  const body = (input.body ?? '').trim();
  const attachments = await Promise.all(files.map((f) => fileToChatAttachment(f)));

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
        ? 'Photo'
        : attachments[0].kind === 'video'
          ? 'Video'
          : attachments[0].name || 'Attachment'
      : '');

  conversation.lastMessageAt = new Date();
  conversation.lastMessagePreview = preview.slice(0, 160);
  await conversation.save();

  const serialized = await serializeMessage(message);
  scheduleLinkPreview(String(message._id));

  // New activity un-hides the chat for every member who had deleted/hidden it.
  await ConversationMemberState.updateMany(
    { conversationId: conversation._id, hiddenAt: { $ne: null } },
    { $set: { hiddenAt: null } },
  );

  emitToConversation(conversationId, 'message:new', { message: serialized });
  for (const memberId of conversation.memberIds.map(String)) {
    emitToUser(memberId, 'message:new', { message: serialized });
  }
  await emitConversationUpsert(conversation);

  const memberIds = conversation.memberIds.map(String).filter((id) => id !== actor.sub);
  const mutedRows = await ConversationMemberState.find({
    conversationId: conversation._id,
    userId: { $in: memberIds.map((id) => oid(id)) },
    muted: true,
  })
    .select('userId')
    .lean();
  const mutedSet = new Set(mutedRows.map((row) => String(row.userId)));

  const sender = await User.findById(actor.sub).select('name').lean();
  const senderName = sender?.name ?? 'Someone';
  const convLabel =
    conversation.type === 'group'
      ? conversation.name || 'team chat'
      : 'a direct message';
  const previewText = (preview || 'New message').slice(0, 140);
  void createAndEmitMany(
    memberIds
      .filter((id) => !mutedSet.has(id))
      .map((recipientId) => ({
        orgId: actor.orgId,
        recipientId,
        actorId: actor.sub,
        actorName: senderName,
        type: 'message.new' as const,
        title:
          conversation.type === 'group'
            ? `New message in ${convLabel}`
            : `Message from ${senderName}`,
        body: previewText,
        href: chatHref(conversationId, String(message._id)),
        conversationId,
        messageId: String(message._id),
        meta: {
          conversationType: conversation.type,
          conversationName: convLabel,
        },
      })),
  ).catch((err) => console.error('[notifications] message.new', err));

  return { message: serialized };
}

export async function forwardMessage(
  actor: Actor,
  messageId: string,
  targetConversationId: string,
) {
  const source = await Message.findById(oid(messageId));
  if (!source || source.deletedAt) {
    throw new AuthError('Message not found', 404, 'NOT_FOUND');
  }
  if (source.type === 'call') {
    throw new AuthError('Call history cannot be forwarded', 400);
  }
  await requireMember(String(source.conversationId), actor);
  const target = await requireMember(targetConversationId, actor);
  if (target.type === 'dm') {
    const otherId = target.memberIds.map(String).find((id) => id !== actor.sub);
    if (otherId) await assertCanDm(actor.sub, otherId);
  }

  const body = (source.body ?? '').trim();
  const attachments = (source.attachments ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    size: a.size,
    mimeType: a.mimeType,
    url: a.url,
    kind: a.kind,
    storageProvider: a.storageProvider ?? null,
    storageKey: a.storageKey ?? null,
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
    forwarded: true,
    forwardedFrom: sender?.name ?? source.forwardedFrom ?? null,
  });

  const preview =
    messageBody ||
    (attachments[0]
      ? attachments[0].kind === 'image'
        ? 'Photo'
        : attachments[0].kind === 'video'
          ? 'Video'
          : attachments[0].name || 'Attachment'
      : forwardLabel);

  target.lastMessageAt = new Date();
  target.lastMessagePreview = `Forwarded: ${preview}`.slice(0, 160);
  await target.save();

  const serialized = await serializeMessage(message);
  scheduleLinkPreview(String(message._id));
  const convSerialized = await serializeConversation(target, actor.sub);

  emitToConversation(targetConversationId, 'message:new', { message: serialized });
  for (const memberId of target.memberIds.map(String)) {
    emitToUser(memberId, 'message:new', { message: serialized });
  }
  await emitConversationUpsert(target);

  const forwarder = await User.findById(actor.sub).select('name').lean();
  const forwarderName = forwarder?.name ?? 'Someone';
  const convLabel =
    target.type === 'group' ? target.name || 'team chat' : 'a direct message';
  void createAndEmitMany(
    target.memberIds
      .map(String)
      .filter((id) => id !== actor.sub)
      .map((recipientId) => ({
        orgId: actor.orgId,
        recipientId,
        actorId: actor.sub,
        actorName: forwarderName,
        type: 'message.new' as const,
        title: `Forwarded message from ${forwarderName}`,
        body: (preview || 'Forwarded message').slice(0, 140),
        href: chatHref(targetConversationId, String(message._id)),
        conversationId: targetConversationId,
        messageId: String(message._id),
        meta: {
          conversationType: target.type,
          conversationName: convLabel,
          forwarded: true,
        },
      })),
  ).catch((err) => console.error('[notifications] message.new forward', err));

  return { message: serialized, conversation: convSerialized };
}

export type CallOutcome = 'answered' | 'missed' | 'rejected' | 'cancelled' | 'failed';

function formatCallDuration(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
  }
  return `${m}:${String(r).padStart(2, '0')}`;
}

function callHistoryBody(
  outcome: CallOutcome,
  durationSeconds: number,
  mediaKind: 'audio' | 'video' = 'audio',
  isGroup = false,
) {
  const noun = isGroup
    ? mediaKind === 'video'
      ? 'Group video call'
      : 'Group voice call'
    : mediaKind === 'video'
      ? 'Video call'
      : 'Voice call';
  const lower = isGroup
    ? mediaKind === 'video'
      ? 'group video call'
      : 'group voice call'
    : mediaKind === 'video'
      ? 'video call'
      : 'voice call';
  switch (outcome) {
    case 'answered':
      return `${noun} · ${formatCallDuration(durationSeconds)}`;
    case 'rejected':
      return `Declined ${lower}`;
    case 'cancelled':
      return `Cancelled ${lower}`;
    case 'missed':
      return `Missed ${lower}`;
    case 'failed':
    default:
      return `${noun} failed`;
  }
}

/** Persist a call event into the chat thread (idempotent by callId). */
export async function recordCallHistory(input: {
  conversationId: string;
  callId: string;
  initiatedBy: string;
  outcome: CallOutcome;
  durationSeconds?: number;
  mediaKind?: 'audio' | 'video';
  isGroup?: boolean;
}) {
  const existing = await Message.findOne({
    type: 'call',
    'call.callId': input.callId,
  });
  if (existing) {
    return serializeMessage(existing);
  }

  const conversation = await Conversation.findById(oid(input.conversationId));
  if (!conversation) return null;
  if (conversation.type !== 'dm' && conversation.type !== 'group') return null;

  const mediaKind = input.mediaKind === 'video' ? 'video' : 'audio';
  const isGroup = input.isGroup ?? conversation.type === 'group';
  const durationSeconds = Math.max(0, Math.floor(input.durationSeconds ?? 0));
  const body = callHistoryBody(input.outcome, durationSeconds, mediaKind, isGroup);

  let message;
  try {
    message = await Message.create({
      orgId: conversation.orgId,
      conversationId: conversation._id,
      senderId: oid(input.initiatedBy),
      type: 'call',
      body,
      call: {
        callId: input.callId,
        outcome: input.outcome,
        mediaKind,
        durationSeconds,
        initiatedBy: oid(input.initiatedBy),
      },
      attachments: [],
      receipts: [],
    });
  } catch (err) {
    // Race: another finalize wrote the same callId first
    const raced = await Message.findOne({ type: 'call', 'call.callId': input.callId });
    if (raced) return serializeMessage(raced);
    throw err;
  }

  conversation.lastMessageAt = new Date();
  conversation.lastMessagePreview = body.slice(0, 160);
  await conversation.save();

  const serialized = await serializeMessage(message);

  emitToConversation(String(conversation._id), 'message:new', { message: serialized });
  for (const memberId of conversation.memberIds.map(String)) {
    emitToUser(memberId, 'message:new', { message: serialized });
  }
  await emitConversationUpsert(conversation);

  return serialized;
}

export async function editMessage(actor: Actor, messageId: string, body: string) {
  const message = await Message.findById(oid(messageId));
  if (!message || message.deletedAt) {
    throw new AuthError('Message not found', 404, 'NOT_FOUND');
  }
  if (message.type === 'call') {
    throw new AuthError('Call history cannot be edited', 400);
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
  scheduleLinkPreview(String(message._id));
  emitToConversation(serialized.conversationId, 'message:edited', { message: serialized });
  for (const memberId of await memberIdsForMessage(message)) {
    emitToUser(memberId, 'message:edited', { message: serialized });
  }
  return { message: serialized };
}

export async function deleteMessage(actor: Actor, messageId: string) {
  const message = await Message.findById(oid(messageId));
  if (!message || message.deletedAt) {
    throw new AuthError('Message not found', 404, 'NOT_FOUND');
  }
  if (message.type === 'call') {
    throw new AuthError('Call history cannot be deleted', 400);
  }
  if (String(message.senderId) !== actor.sub) {
    throw new AuthError('You can only delete your own messages', 403, 'FORBIDDEN');
  }
  await requireMember(String(message.conversationId), actor);

  const removed = (message.attachments ?? []).map((a) => ({
    url: a.url,
    provider: a.storageProvider ?? null,
    storageKey: a.storageKey ?? null,
    mimeType: a.mimeType ?? null,
    kind: a.kind ?? null,
  }));
  message.deletedAt = new Date();
  message.body = '';
  message.set('attachments', []);
  await message.save();

  // Remove blobs from Cloudinary/R2 unless another live message still references them
  const toDelete: StoredMediaRef[] = [];
  for (const att of removed) {
    if (!att.url && !att.storageKey) continue;
    const stillUsed = await Message.exists({
      orgId: message.orgId,
      deletedAt: null,
      _id: { $ne: message._id },
      $or: [
        ...(att.url ? [{ 'attachments.url': att.url }] : []),
        ...(att.storageKey ? [{ 'attachments.storageKey': att.storageKey }] : []),
      ],
    });
    if (!stillUsed) toDelete.push(att);
  }
  if (toDelete.length) {
    await deleteStoredMediaMany(toDelete);
    console.info('[chat] deleted media from storage', toDelete.length);
  }

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

export async function setConversationPinned(
  actor: Actor,
  conversationId: string,
  pinned: boolean,
) {
  const conversation = await requireMember(conversationId, actor);
  await upsertMemberState(actor, conversationId, {
    pinned,
    pinnedAt: pinned ? new Date() : null,
  });
  return { conversation: await serializeConversation(conversation, actor.sub) };
}

export async function setConversationMuted(
  actor: Actor,
  conversationId: string,
  muted: boolean,
) {
  const conversation = await requireMember(conversationId, actor);
  await upsertMemberState(actor, conversationId, { muted });
  return { conversation: await serializeConversation(conversation, actor.sub) };
}

/** Block or unblock the other person in a DM. Blocking also removes the chat from your list. */
export async function setConversationBlocked(
  actor: Actor,
  conversationId: string,
  blocked: boolean,
) {
  const conversation = await requireMember(conversationId, actor);
  if (conversation.type !== 'dm') {
    throw new AuthError('You can only block people in direct messages', 400, 'NOT_DM');
  }
  const otherId = conversation.memberIds.map(String).find((id) => id !== actor.sub);
  if (!otherId) throw new AuthError('User not found', 404, 'NOT_FOUND');

  if (blocked) {
    await UserBlock.findOneAndUpdate(
      { userId: oid(actor.sub), blockedUserId: oid(otherId) },
      {
        $set: {
          orgId: oid(actor.orgId),
          userId: oid(actor.sub),
          blockedUserId: oid(otherId),
        },
      },
      { upsert: true },
    );
    return deleteConversationForMe(actor, conversationId);
  }

  await UserBlock.deleteOne({ userId: oid(actor.sub), blockedUserId: oid(otherId) });
  await upsertMemberState(actor, conversationId, { hiddenAt: null });
  emitToUser(actor.sub, 'conversation:upsert', {
    conversation: await serializeConversation(conversation, actor.sub),
  });
  return { conversation: await serializeConversation(conversation, actor.sub) };
}

/** Clear message history for the current user only. */
export async function clearConversationMessages(actor: Actor, conversationId: string) {
  const conversation = await requireMember(conversationId, actor);
  const clearedAt = new Date();
  await upsertMemberState(actor, conversationId, { clearedAt });
  return { conversation: await serializeConversation(conversation, actor.sub) };
}

/**
 * Remove chat from the current user's list.
 * Groups: leave the group. DMs: hide until a new message arrives.
 */
export async function deleteConversationForMe(actor: Actor, conversationId: string) {
  const conversation = await requireMember(conversationId, actor);

  if (conversation.type === 'group') {
    const next = conversation.memberIds.filter((id) => String(id) !== actor.sub);
    if (next.length < 1) {
      // Last member leaving — tear the group down (skip admin check).
      return destroyGroup(conversationId, conversation.memberIds.map(String), conversation.avatarUrl);
    }
    conversation.memberIds = next as typeof conversation.memberIds;
    // If the creator left, transfer ownership to the next member.
    if (String(conversation.createdBy) === actor.sub) {
      conversation.createdBy = next[0] as typeof conversation.createdBy;
    }
    await conversation.save();
    emitToUser(actor.sub, 'conversation:removed', { conversationId });
    await emitConversationUpsert(conversation);
    return { ok: true as const, removed: true as const };
  }

  await upsertMemberState(actor, conversationId, {
    hiddenAt: new Date(),
    clearedAt: new Date(),
  });
  emitToUser(actor.sub, 'conversation:removed', { conversationId });
  return { ok: true as const, removed: true as const };
}

async function destroyGroup(
  conversationId: string,
  memberIds: string[],
  avatarUrl?: string | null,
) {
  const conversationOid = oid(conversationId);
  const messages = await Message.find({ conversationId: conversationOid }).lean();
  const media: StoredMediaRef[] = [];
  for (const message of messages) {
    for (const att of message.attachments ?? []) {
      media.push({
        url: att.url,
        provider: att.storageProvider ?? null,
        storageKey: att.storageKey ?? null,
        mimeType: att.mimeType ?? null,
        kind: att.kind ?? null,
      });
    }
  }
  if (avatarUrl) {
    media.push({ url: avatarUrl, provider: null, storageKey: null });
  }

  await Message.deleteMany({ conversationId: conversationOid });
  await ConversationMemberState.deleteMany({ conversationId: conversationOid });
  await Conversation.deleteOne({ _id: conversationOid });
  if (media.length) {
    await deleteStoredMediaMany(media).catch((err) =>
      console.error('[chat] deleteGroup media cleanup', err),
    );
  }

  for (const memberId of memberIds) {
    emitToUser(memberId, 'conversation:removed', { conversationId });
  }
  return { ok: true as const, removed: true as const };
}

/** Permanently delete a group (creator/admin only) and all of its messages. */
export async function deleteGroup(actor: Actor, conversationId: string) {
  const conversation = await requireMember(conversationId, actor);
  if (conversation.type !== 'group') {
    throw new AuthError('Only groups can be deleted', 400);
  }
  if (String(conversation.createdBy) !== actor.sub) {
    throw new AuthError('Only the group admin can delete this group', 403, 'FORBIDDEN');
  }

  return destroyGroup(
    conversationId,
    conversation.memberIds.map(String),
    conversation.avatarUrl,
  );
}

/** Used by activity module — re-export org emit helper availability */
export function notifyOrgConversationRefresh(orgId: string, conversationId: string) {
  emitToOrg(orgId, 'conversation:refresh', { conversationId });
}
