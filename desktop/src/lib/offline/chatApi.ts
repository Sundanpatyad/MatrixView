import {
  listConversations as listConversationsApi,
  listMessages as listMessagesApi,
  sendMessage as sendMessageApi,
  type ChatConversation,
  type ChatMessage,
} from '@/lib/api/chat';
import {
  appendMessageSorted,
  mergeMessagesById,
  replaceMessageById,
  sortConversationsByRecent,
  sortMessagesByTime,
} from './chatSort';
import {
  cacheConversations,
  cacheMessages,
  createPendingMessage,
  getLatestSyncedCreatedAt,
  hasCachedConversations,
  hasCachedMessages,
  listCachedConversations,
  listCachedMessages,
  replacePendingMessage,
} from './chatStore';
import { isOfflineDbAvailable } from './db';
import { enqueueOutbox } from './outbox';
import { syncService } from './sync';

export {
  appendMessageSorted,
  mergeMessagesById,
  replaceMessageById,
  sortConversationsByRecent,
  sortMessagesByTime,
};

/** Instant local open — never waits on the network. */
export async function openConversationsFromLocal(
  userId: string,
): Promise<{ conversations: ChatConversation[]; hasCache: boolean }> {
  if (!isOfflineDbAvailable()) {
    return { conversations: [], hasCache: false };
  }
  const conversations = await listCachedConversations(userId);
  const hasCache = conversations.length > 0 || (await hasCachedConversations(userId));
  return {
    conversations: sortConversationsByRecent(conversations),
    hasCache: hasCache || conversations.length > 0,
  };
}

/** Background: refresh conversation list from API into SQLite. */
export async function syncConversationsFromApi(
  userId: string,
): Promise<ChatConversation[] | null> {
  if (!navigator.onLine) return null;
  try {
    const { conversations } = await listConversationsApi();
    if (isOfflineDbAvailable()) await cacheConversations(userId, conversations);
    return sortConversationsByRecent(conversations);
  } catch {
    return null;
  }
}

/** Instant local open for a thread — always oldest → newest by timestamp. */
export async function openMessagesFromLocal(
  userId: string,
  conversationId: string,
): Promise<{ messages: ChatMessage[]; hasCache: boolean }> {
  if (!isOfflineDbAvailable()) {
    return { messages: [], hasCache: false };
  }
  const messages = await listCachedMessages(userId, conversationId);
  const hasCache = messages.length > 0 || (await hasCachedMessages(userId, conversationId));
  return { messages: sortMessagesByTime(messages), hasCache };
}

/**
 * Background: fetch only messages newer than the last local synced message.
 * Merges into local order by timestamp so the thread never reshuffles.
 */
export async function syncLatestMessagesFromApi(
  userId: string,
  conversationId: string,
): Promise<ChatMessage[] | null> {
  if (!navigator.onLine) return null;
  try {
    const after = await getLatestSyncedCreatedAt(userId, conversationId);
    const { messages: newer } = await listMessagesApi(
      conversationId,
      after ? { after } : undefined,
    );
    if (newer.length > 0 && isOfflineDbAvailable()) {
      await cacheMessages(userId, newer);
    }
    if (isOfflineDbAvailable()) {
      return sortMessagesByTime(await listCachedMessages(userId, conversationId));
    }
    return sortMessagesByTime(newer);
  } catch {
    return null;
  }
}

export async function loadConversations(userId: string): Promise<ChatConversation[]> {
  const local = await openConversationsFromLocal(userId);
  if (local.hasCache) {
    void syncConversationsFromApi(userId);
    return local.conversations;
  }
  const remote = await syncConversationsFromApi(userId);
  return remote ?? local.conversations;
}

export async function loadMessages(
  userId: string,
  conversationId: string,
): Promise<ChatMessage[]> {
  const local = await openMessagesFromLocal(userId, conversationId);
  if (local.hasCache) {
    void syncLatestMessagesFromApi(userId, conversationId);
    return local.messages;
  }
  const remote = await syncLatestMessagesFromApi(userId, conversationId);
  return remote ?? local.messages;
}

export async function sendChatMessage(input: {
  userId: string;
  userName: string;
  userAvatarUrl?: string | null;
  conversationId: string;
  body: string;
  replyToId?: string;
  files?: File[];
  /** Reuse optimistic bubble id (avoids a second local message). */
  localMessageId?: string;
}): Promise<ChatMessage> {
  const hasFiles = (input.files?.length ?? 0) > 0;

  if (hasFiles) {
    if (!navigator.onLine) {
      throw new Error('Attachments need an internet connection');
    }
    const { message } = await sendMessageApi(input.conversationId, {
      body: input.body,
      replyToId: input.replyToId,
      files: input.files,
    });
    if (isOfflineDbAvailable()) {
      if (input.localMessageId) {
        await replacePendingMessage(input.localMessageId, message, input.userId);
      } else {
        await cacheMessages(input.userId, [message]);
      }
    }
    return message;
  }

  if (navigator.onLine) {
    try {
      const { message } = await sendMessageApi(input.conversationId, {
        body: input.body,
        replyToId: input.replyToId,
      });
      if (isOfflineDbAvailable()) {
        if (input.localMessageId) {
          await replacePendingMessage(input.localMessageId, message, input.userId);
        } else {
          await cacheMessages(input.userId, [message]);
        }
      }
      return message;
    } catch {
      if (!isOfflineDbAvailable()) throw new Error('Failed to send message');
      /* queue offline below */
    }
  }

  if (isOfflineDbAvailable()) {
    if (input.localMessageId) {
      await enqueueOutbox('chat.message.send', {
        localMessageId: input.localMessageId,
        conversationId: input.conversationId,
        body: input.body,
        replyToId: input.replyToId,
      });
      void syncService.flush();
      return {
        id: input.localMessageId,
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
        localState: 'sending',
        receipts: [],
        editedAt: null,
        deletedAt: null,
        createdAt: new Date().toISOString(),
      };
    }
    const pending = await createPendingMessage({
      userId: input.userId,
      userName: input.userName,
      userAvatarUrl: input.userAvatarUrl,
      conversationId: input.conversationId,
      body: input.body,
      replyToId: input.replyToId,
    });
    void syncService.flush();
    return pending;
  }

  const { message } = await sendMessageApi(input.conversationId, {
    body: input.body,
    replyToId: input.replyToId,
  });
  return message;
}
