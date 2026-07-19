import type { ChatConversation, ChatMessage } from '@/lib/api/chat';
import { sortConversationsByRecent, sortMessagesByTime } from './chatSort';
import { getOfflineDb, newLocalId } from './db';
import { enqueueOutbox } from './outbox';

type MessageRow = {
  id: string;
  conversation_id: string;
  user_id: string;
  payload: string;
  local_status: string;
  created_at: string;
  updated_at: string;
};

export async function cacheConversations(userId: string, conversations: ChatConversation[]) {
  const db = await getOfflineDb();
  if (!db) return;
  const updatedAt = new Date().toISOString();
  for (const c of conversations) {
    await db.execute(
      `INSERT INTO conversations (id, user_id, payload, updated_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
      [c.id, userId, JSON.stringify(c), updatedAt],
    );
  }
}

export async function listCachedConversations(userId: string): Promise<ChatConversation[]> {
  const db = await getOfflineDb();
  if (!db) return [];
  const rows = await db.select<Array<{ payload: string }>>(
    `SELECT payload FROM conversations WHERE user_id = $1`,
    [userId],
  );
  return sortConversationsByRecent(
    rows.map((r) => JSON.parse(r.payload) as ChatConversation),
  );
}

export async function upsertCachedConversation(userId: string, conversation: ChatConversation) {
  await cacheConversations(userId, [conversation]);
}

export async function cacheMessages(userId: string, messages: ChatMessage[]) {
  const db = await getOfflineDb();
  if (!db) return;
  for (const m of messages) {
    await db.execute(
      `INSERT INTO messages (id, conversation_id, user_id, payload, local_status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'synced', $5, $5)
       ON CONFLICT(id) DO UPDATE SET
         payload = excluded.payload,
         local_status = CASE
           WHEN messages.local_status = 'pending' THEN messages.local_status
           ELSE 'synced'
         END,
         updated_at = excluded.updated_at`,
      [m.id, m.conversationId, userId, JSON.stringify(m), m.createdAt],
    );
  }
}

export async function listCachedMessages(
  userId: string,
  conversationId: string,
): Promise<ChatMessage[]> {
  const db = await getOfflineDb();
  if (!db) return [];
  const rows = await db.select<MessageRow[]>(
    `SELECT * FROM messages
     WHERE user_id = $1 AND conversation_id = $2
     ORDER BY datetime(created_at) ASC, id ASC`,
    [userId, conversationId],
  );
  const messages = rows.map((r) => {
    const msg = JSON.parse(r.payload) as ChatMessage;
    // Prefer row timestamp so sort matches SQLite even if payload drifts
    const createdAt = r.created_at || msg.createdAt;
    if (r.local_status === 'pending') {
      return { ...msg, createdAt, status: msg.status ?? 'sent' };
    }
    return { ...msg, createdAt };
  });
  return sortMessagesByTime(messages);
}

export async function hasCachedMessages(
  userId: string,
  conversationId: string,
): Promise<boolean> {
  const db = await getOfflineDb();
  if (!db) return false;
  const rows = await db.select<Array<{ c: number }>>(
    `SELECT COUNT(*) as c FROM messages
     WHERE user_id = $1 AND conversation_id = $2`,
    [userId, conversationId],
  );
  return Number(rows[0]?.c ?? 0) > 0;
}

/** Latest server (non-pending) message timestamp for delta sync. */
export async function getLatestSyncedCreatedAt(
  userId: string,
  conversationId: string,
): Promise<string | null> {
  const db = await getOfflineDb();
  if (!db) return null;
  const rows = await db.select<Array<{ created_at: string }>>(
    `SELECT created_at FROM messages
     WHERE user_id = $1 AND conversation_id = $2
       AND local_status != 'pending'
       AND id NOT LIKE 'lmsg_%'
     ORDER BY datetime(created_at) DESC, id DESC
     LIMIT 1`,
    [userId, conversationId],
  );
  return rows[0]?.created_at ?? null;
}

export async function hasCachedConversations(userId: string): Promise<boolean> {
  const db = await getOfflineDb();
  if (!db) return false;
  const rows = await db.select<Array<{ c: number }>>(
    `SELECT COUNT(*) as c FROM conversations WHERE user_id = $1`,
    [userId],
  );
  return Number(rows[0]?.c ?? 0) > 0;
}

export async function createPendingMessage(input: {
  userId: string;
  userName: string;
  userAvatarUrl?: string | null;
  conversationId: string;
  body: string;
  replyToId?: string;
}): Promise<ChatMessage> {
  const db = await getOfflineDb();
  const id = newLocalId('lmsg');
  const createdAt = new Date().toISOString();
  const message: ChatMessage = {
    id,
    conversationId: input.conversationId,
    senderId: input.userId,
    senderName: input.userName,
    senderAvatarUrl: input.userAvatarUrl ?? null,
    body: input.body,
    replyTo: input.replyToId
      ? { id: input.replyToId, body: '', senderName: '', deleted: false }
      : null,
    attachments: [],
    status: 'sent',
    receipts: [],
    editedAt: null,
    deletedAt: null,
    createdAt,
  };

  if (db) {
    await db.execute(
      `INSERT INTO messages (id, conversation_id, user_id, payload, local_status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'pending', $5, $5)`,
      [id, input.conversationId, input.userId, JSON.stringify(message), createdAt],
    );
    await enqueueOutbox('chat.message.send', {
      localMessageId: id,
      conversationId: input.conversationId,
      body: input.body,
      replyToId: input.replyToId,
    });
  }

  return message;
}

export async function getPendingMessage(localMessageId: string): Promise<MessageRow | null> {
  const db = await getOfflineDb();
  if (!db) return null;
  const rows = await db.select<MessageRow[]>(
    `SELECT * FROM messages WHERE id = $1 LIMIT 1`,
    [localMessageId],
  );
  return rows[0] ?? null;
}

export async function replacePendingMessage(
  localMessageId: string,
  serverMessage: ChatMessage,
  userId: string,
) {
  const db = await getOfflineDb();
  if (!db) return;
  await db.execute(`DELETE FROM messages WHERE id = $1`, [localMessageId]);
  await cacheMessages(userId, [serverMessage]);
}

export async function upsertLiveMessage(userId: string, message: ChatMessage) {
  await cacheMessages(userId, [message]);
}
