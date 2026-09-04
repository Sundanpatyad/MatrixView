import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import {
  chatApi,
  type ChatConversation,
  type ChatMember,
  type ChatMessage,
  type PickedFile,
  type PresenceUser,
} from '@/lib/api';
import { attachmentKindOf } from '@/lib/attachments';
import { patchSocketHandlers, socketActions } from '@/lib/socket/socket';

import { useAuth } from './AuthContext';

interface SendInput {
  body: string;
  replyToId?: string;
  files?: PickedFile[];
}

interface ChatContextValue {
  conversations: ChatConversation[];
  users: ChatMember[];
  presence: Record<string, PresenceUser>;
  unread: Record<string, number>;
  totalUnread: number;
  isLoading: boolean;
  connected: boolean;

  messagesFor: (conversationId: string) => ChatMessage[];
  typingIn: (conversationId: string) => string[];
  hasMoreIn: (conversationId: string) => boolean;
  isLoadingMessages: (conversationId: string) => boolean;

  refresh: () => Promise<void>;
  openConversation: (conversationId: string) => Promise<void>;
  closeConversation: (conversationId: string) => void;
  loadOlderMessages: (conversationId: string) => Promise<void>;

  send: (conversationId: string, input: SendInput) => Promise<void>;
  retry: (conversationId: string, localId: string) => Promise<void>;
  edit: (messageId: string, body: string) => Promise<void>;
  remove: (messageId: string) => Promise<void>;
  forward: (messageId: string, conversationId: string) => Promise<void>;

  setTyping: (conversationId: string, typing: boolean) => void;

  startDm: (input: { userId?: string; email?: string }) => Promise<ChatConversation>;
  startGroup: (input: { name: string; memberIds?: string[] }) => Promise<ChatConversation>;
  renameGroup: (conversationId: string, name: string) => Promise<void>;
  setGroupAvatar: (conversationId: string, file: PickedFile) => Promise<void>;
  addMembers: (conversationId: string, memberIds: string[]) => Promise<void>;
  removeMember: (conversationId: string, userId: string) => Promise<void>;
  setPinned: (conversationId: string, pinned: boolean) => Promise<void>;
  setMuted: (conversationId: string, muted: boolean) => Promise<void>;
  clearMessages: (conversationId: string) => Promise<void>;
  deleteChat: (conversationId: string) => Promise<void>;
  deleteGroup: (conversationId: string) => Promise<void>;
}

const ChatContext = createContext<ChatContextValue | null>(null);

const PAGE_SIZE = 40;

function sortConversations(list: ChatConversation[]): ChatConversation[] {
  return list.slice().sort((a, b) => {
    const aPinned = Boolean(a.pinned);
    const bPinned = Boolean(b.pinned);
    if (aPinned !== bPinned) return aPinned ? -1 : 1;
    if (aPinned && bPinned) {
      return new Date(b.pinnedAt ?? 0).getTime() - new Date(a.pinnedAt ?? 0).getTime();
    }
    return new Date(b.lastMessageAt ?? 0).getTime() - new Date(a.lastMessageAt ?? 0).getTime();
  });
}

function mergeMessages(existing: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const byId = new Map(existing.map((message) => [message.id, message]));
  incoming.forEach((message) => byId.set(message.id, message));
  return Array.from(byId.values()).sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuth();

  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [users, setUsers] = useState<ChatMember[]>([]);
  const [presence, setPresence] = useState<Record<string, PresenceUser>>({});
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({});
  const [hasMore, setHasMore] = useState<Record<string, boolean>>({});
  const [loadingMessages, setLoadingMessages] = useState<Record<string, boolean>>({});
  const [typing, setTypingState] = useState<Record<string, Record<string, string>>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [connected, setConnected] = useState(false);

  const activeConversationRef = useRef<string | null>(null);
  const typingTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const localCounter = useRef(0);

  const reset = useCallback(() => {
    setConversations([]);
    setUsers([]);
    setPresence({});
    setUnread({});
    setMessages({});
    setHasMore({});
    setTypingState({});
    activeConversationRef.current = null;
  }, []);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    try {
      const [conversationResult, userResult] = await Promise.all([
        chatApi.listConversations(),
        chatApi.listChatUsers(),
      ]);
      setConversations(sortConversations(conversationResult.conversations ?? []));
      setUsers(userResult.users ?? []);
      setPresence((prev) => {
        const next = { ...prev };
        for (const member of userResult.users ?? []) {
          next[member.id] = {
            userId: member.id,
            checkedIn: Boolean(member.checkedIn),
            online: prev[member.id]?.online ?? Boolean(member.online),
          };
        }
        return next;
      });
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      reset();
      return;
    }
    void refresh();
  }, [isAuthenticated, refresh, reset]);

  /**
   * Typing updates are room-scoped (`conversation:{id}`). Stay joined to every
   * conversation so the chat list and open thread both receive live indicators,
   * matching the desktop client's group subscriptions.
   */
  useEffect(() => {
    if (!connected || !isAuthenticated) return;
    conversations.forEach((conversation) => {
      socketActions.joinConversation(conversation.id);
    });
  }, [connected, conversations, isAuthenticated]);

  useEffect(() => {
    patchSocketHandlers({
      onConnectionChange: (next) => {
        setConnected(next);
        const meId = user?.id;
        if (!meId) return;
        setPresence((prev) => ({
          ...prev,
          [meId]: {
            userId: meId,
            checkedIn: prev[meId]?.checkedIn ?? false,
            online: next,
          },
        }));
      },

      onPresenceSnapshot: ({ users: snapshot }) => {
        setPresence((prev) => {
          const next = { ...prev };
          for (const entry of snapshot ?? []) {
            next[entry.userId] = {
              userId: entry.userId,
              checkedIn: Boolean(entry.checkedIn),
              online: Boolean(entry.online),
            };
          }
          return next;
        });
      },
      onPresenceUpdate: (entry) => {
        setPresence((prev) => ({
          ...prev,
          [entry.userId]: {
            userId: entry.userId,
            checkedIn: Boolean(entry.checkedIn),
            online: Boolean(entry.online),
          },
        }));
      },

      onMessageNew: ({ message }) => {
        setMessages((prev) => ({
          ...prev,
          [message.conversationId]: mergeMessages(prev[message.conversationId] ?? [], [message]),
        }));

        setConversations((prev) =>
          sortConversations(
            prev.map((conversation) =>
              conversation.id === message.conversationId
                ? {
                    ...conversation,
                    lastMessageAt: message.createdAt,
                    lastMessagePreview:
                      message.body?.trim() ||
                      (message.attachments[0]?.kind === 'image'
                        ? 'Photo'
                        : message.attachments[0]?.kind === 'video'
                          ? 'Video'
                          : message.attachments[0]?.name ||
                            (message.attachments.length ? 'Attachment' : '')),
                  }
                : conversation,
            ),
          ),
        );

        const isMine = message.senderId === user?.id;
        const isOpen = activeConversationRef.current === message.conversationId;
        if (!isMine && !isOpen) {
          setUnread((prev) => ({
            ...prev,
            [message.conversationId]: (prev[message.conversationId] ?? 0) + 1,
          }));
        }
        if (isOpen && !isMine) {
          socketActions.markRead(message.conversationId);
        }
      },

      onMessageEdited: ({ message }) => {
        setMessages((prev) => ({
          ...prev,
          [message.conversationId]: mergeMessages(prev[message.conversationId] ?? [], [message]),
        }));
      },

      onMessageDeleted: ({ message }) => {
        setMessages((prev) => ({
          ...prev,
          [message.conversationId]: mergeMessages(prev[message.conversationId] ?? [], [message]),
        }));
      },

      onMessageStatus: (update) => {
        setMessages((prev) => {
          const list = prev[update.conversationId];
          if (!list) return prev;
          return {
            ...prev,
            [update.conversationId]: list.map((message) =>
              message.id === update.messageId
                ? { ...message, status: update.status, receipts: update.receipts ?? message.receipts }
                : message,
            ),
          };
        });
      },

      onTyping: ({ conversationId, userId, userName, typing: isTyping }) => {
        if (userId === user?.id) return;
        setTypingState((prev) => {
          const current = { ...(prev[conversationId] ?? {}) };
          if (isTyping) current[userId] = userName;
          else delete current[userId];
          return { ...prev, [conversationId]: current };
        });

        const key = `${conversationId}:${userId}`;
        if (typingTimers.current[key]) clearTimeout(typingTimers.current[key]);
        if (isTyping) {
          typingTimers.current[key] = setTimeout(() => {
            setTypingState((prev) => {
              const current = { ...(prev[conversationId] ?? {}) };
              delete current[userId];
              return { ...prev, [conversationId]: current };
            });
          }, 6000);
        }
      },

      onConversationUpsert: ({ conversation }) => {
        setConversations((prev) => {
          const exists = prev.some((entry) => entry.id === conversation.id);
          return sortConversations(
            exists ? prev.map((entry) => (entry.id === conversation.id ? conversation : entry)) : [conversation, ...prev],
          );
        });
      },

      onConversationRemoved: ({ conversationId }) => {
        setConversations((prev) => prev.filter((entry) => entry.id !== conversationId));
        setMessages((prev) => {
          const next = { ...prev };
          delete next[conversationId];
          return next;
        });
      },
    });
  }, [user?.id]);

  useEffect(
    () => () => {
      Object.values(typingTimers.current).forEach(clearTimeout);
    },
    [],
  );

  const openConversation = useCallback(async (conversationId: string) => {
    activeConversationRef.current = conversationId;
    socketActions.joinConversation(conversationId);
    socketActions.markDelivered(conversationId);
    socketActions.markRead(conversationId);
    setUnread((prev) => ({ ...prev, [conversationId]: 0 }));

    setLoadingMessages((prev) => ({ ...prev, [conversationId]: true }));
    try {
      const { messages: page, hasMore: more } = await chatApi.listMessages(conversationId, { limit: PAGE_SIZE });
      setMessages((prev) => ({ ...prev, [conversationId]: mergeMessages(prev[conversationId] ?? [], page) }));
      setHasMore((prev) => ({ ...prev, [conversationId]: more }));
    } finally {
      setLoadingMessages((prev) => ({ ...prev, [conversationId]: false }));
    }
  }, []);

  const closeConversation = useCallback((conversationId: string) => {
    if (activeConversationRef.current === conversationId) {
      activeConversationRef.current = null;
    }
    // Keep the socket room so typing/read events still arrive for the list.
    void conversationId;
  }, []);

  const loadOlderMessages = useCallback(
    async (conversationId: string) => {
      if (loadingMessages[conversationId] || hasMore[conversationId] === false) return;
      const current = messages[conversationId] ?? [];
      const oldest = current.find((message) => !message.id.startsWith('local-'));
      if (!oldest) return;

      setLoadingMessages((prev) => ({ ...prev, [conversationId]: true }));
      try {
        const { messages: page, hasMore: more } = await chatApi.listMessages(conversationId, {
          before: oldest.createdAt,
          limit: PAGE_SIZE,
        });
        setMessages((prev) => ({ ...prev, [conversationId]: mergeMessages(prev[conversationId] ?? [], page) }));
        setHasMore((prev) => ({ ...prev, [conversationId]: more }));
      } finally {
        setLoadingMessages((prev) => ({ ...prev, [conversationId]: false }));
      }
    },
    [hasMore, loadingMessages, messages],
  );

  const replaceMessage = useCallback((conversationId: string, localId: string, next: ChatMessage | null) => {
    setMessages((prev) => {
      const list = prev[conversationId] ?? [];
      const filtered = list.filter((message) => message.id !== localId);
      return { ...prev, [conversationId]: next ? mergeMessages(filtered, [next]) : filtered };
    });
  }, []);

  const deliver = useCallback(
    async (conversationId: string, localId: string, input: SendInput) => {
      try {
        const { message } = await chatApi.sendMessage(conversationId, input);
        replaceMessage(conversationId, localId, message);
        const preview =
          message.body?.trim() ||
          (message.attachments[0]?.kind === 'image'
            ? 'Photo'
            : message.attachments[0]?.kind === 'video'
              ? 'Video'
              : message.attachments[0]?.name || (message.attachments.length ? 'Attachment' : ''));
        setConversations((prev) =>
          sortConversations(
            prev.map((conversation) =>
              conversation.id === conversationId
                ? {
                    ...conversation,
                    lastMessageAt: message.createdAt,
                    lastMessagePreview: preview,
                  }
                : conversation,
            ),
          ),
        );
      } catch (error) {
        setMessages((prev) => ({
          ...prev,
          [conversationId]: (prev[conversationId] ?? []).map((message) =>
            message.id === localId ? { ...message, localState: 'failed' } : message,
          ),
        }));
        throw error;
      }
    },
    [replaceMessage],
  );

  const pendingInputs = useRef<Record<string, SendInput>>({});

  const send = useCallback(
    async (conversationId: string, input: SendInput) => {
      localCounter.current += 1;
      const localId = `local-${Date.now()}-${localCounter.current}`;
      const optimistic: ChatMessage = {
        id: localId,
        conversationId,
        senderId: user?.id ?? '',
        senderName: user?.name ?? 'You',
        senderAvatarUrl: user?.avatarUrl ?? null,
        type: 'text',
        body: input.body,
        replyTo: null,
        // Showing the picked files right away means an upload never looks like
        // an empty bubble; the server response replaces these with real URLs.
        attachments: (input.files ?? []).map((file, index) => ({
          id: `${localId}-att-${index}`,
          name: file.name,
          size: file.size ?? 0,
          mimeType: file.mimeType,
          url: file.uri,
          kind: attachmentKindOf(file.mimeType),
        })),
        status: 'sent',
        localState: 'sending',
        editedAt: null,
        deletedAt: null,
        createdAt: new Date().toISOString(),
      };

      pendingInputs.current[localId] = input;
      setMessages((prev) => ({
        ...prev,
        [conversationId]: mergeMessages(prev[conversationId] ?? [], [optimistic]),
      }));

      await deliver(conversationId, localId, input);
      delete pendingInputs.current[localId];
    },
    [deliver, user],
  );

  const retry = useCallback(
    async (conversationId: string, localId: string) => {
      const input = pendingInputs.current[localId];
      if (!input) return;
      setMessages((prev) => ({
        ...prev,
        [conversationId]: (prev[conversationId] ?? []).map((message) =>
          message.id === localId ? { ...message, localState: 'sending' } : message,
        ),
      }));
      await deliver(conversationId, localId, input);
      delete pendingInputs.current[localId];
    },
    [deliver],
  );

  const edit = useCallback(async (messageId: string, body: string) => {
    const { message } = await chatApi.editMessage(messageId, body);
    setMessages((prev) => ({
      ...prev,
      [message.conversationId]: mergeMessages(prev[message.conversationId] ?? [], [message]),
    }));
  }, []);

  const remove = useCallback(async (messageId: string) => {
    const { message } = await chatApi.deleteMessage(messageId);
    setMessages((prev) => ({
      ...prev,
      [message.conversationId]: mergeMessages(prev[message.conversationId] ?? [], [message]),
    }));
  }, []);

  const forward = useCallback(async (messageId: string, conversationId: string) => {
    const { message, conversation } = await chatApi.forwardMessage(messageId, conversationId);
    setConversations((prev) =>
      sortConversations(prev.map((entry) => (entry.id === conversation.id ? conversation : entry))),
    );
    setMessages((prev) => ({
      ...prev,
      [message.conversationId]: mergeMessages(prev[message.conversationId] ?? [], [message]),
    }));
  }, []);

  const setTyping = useCallback((conversationId: string, isTyping: boolean) => {
    if (isTyping) socketActions.startTyping(conversationId);
    else socketActions.stopTyping(conversationId);
  }, []);

  const startDm = useCallback(async (input: { userId?: string; email?: string }) => {
    const { conversation } = await chatApi.createDm(input);
    setConversations((prev) =>
      sortConversations(
        prev.some((entry) => entry.id === conversation.id)
          ? prev.map((entry) => (entry.id === conversation.id ? conversation : entry))
          : [conversation, ...prev],
      ),
    );
    return conversation;
  }, []);

  const startGroup = useCallback(async (input: { name: string; memberIds?: string[] }) => {
    const { conversation } = await chatApi.createGroup(input);
    setConversations((prev) => sortConversations([conversation, ...prev]));
    return conversation;
  }, []);

  const applyConversation = useCallback((conversation: ChatConversation) => {
    setConversations((prev) =>
      sortConversations(prev.map((entry) => (entry.id === conversation.id ? conversation : entry))),
    );
  }, []);

  const renameGroup = useCallback(
    async (conversationId: string, name: string) => {
      const { conversation } = await chatApi.updateGroup(conversationId, name);
      applyConversation(conversation);
    },
    [applyConversation],
  );

  const setGroupAvatar = useCallback(
    async (conversationId: string, file: PickedFile) => {
      const { conversation } = await chatApi.uploadGroupAvatar(conversationId, file);
      applyConversation(conversation);
    },
    [applyConversation],
  );

  const addMembers = useCallback(
    async (conversationId: string, memberIds: string[]) => {
      const { conversation } = await chatApi.addGroupMembers(conversationId, memberIds);
      applyConversation(conversation);
    },
    [applyConversation],
  );

  const removeMember = useCallback(
    async (conversationId: string, userId: string) => {
      const { conversation } = await chatApi.removeGroupMember(conversationId, userId);
      applyConversation(conversation);
    },
    [applyConversation],
  );

  const setPinned = useCallback(
    async (conversationId: string, pinned: boolean) => {
      const { conversation } = await chatApi.setConversationPinned(conversationId, pinned);
      applyConversation(conversation);
    },
    [applyConversation],
  );

  const setMuted = useCallback(
    async (conversationId: string, muted: boolean) => {
      const { conversation } = await chatApi.setConversationMuted(conversationId, muted);
      applyConversation(conversation);
    },
    [applyConversation],
  );

  const clearMessages = useCallback(
    async (conversationId: string) => {
      const { conversation } = await chatApi.clearConversationMessages(conversationId);
      applyConversation(conversation);
      setMessages((prev) => ({ ...prev, [conversationId]: [] }));
      setUnread((prev) => {
        if (!prev[conversationId]) return prev;
        const next = { ...prev };
        delete next[conversationId];
        return next;
      });
    },
    [applyConversation],
  );

  const dropConversation = useCallback((conversationId: string) => {
    setConversations((prev) => prev.filter((entry) => entry.id !== conversationId));
    setMessages((prev) => {
      if (!(conversationId in prev)) return prev;
      const next = { ...prev };
      delete next[conversationId];
      return next;
    });
    setUnread((prev) => {
      if (!prev[conversationId]) return prev;
      const next = { ...prev };
      delete next[conversationId];
      return next;
    });
  }, []);

  const deleteChat = useCallback(
    async (conversationId: string) => {
      await chatApi.deleteConversation(conversationId);
      dropConversation(conversationId);
    },
    [dropConversation],
  );

  const deleteGroup = useCallback(
    async (conversationId: string) => {
      await chatApi.deleteGroup(conversationId);
      dropConversation(conversationId);
    },
    [dropConversation],
  );

  const messagesFor = useCallback((conversationId: string) => messages[conversationId] ?? [], [messages]);
  const typingIn = useCallback(
    (conversationId: string) => Object.values(typing[conversationId] ?? {}),
    [typing],
  );
  const hasMoreIn = useCallback((conversationId: string) => hasMore[conversationId] ?? false, [hasMore]);
  const isLoadingMessages = useCallback(
    (conversationId: string) => loadingMessages[conversationId] ?? false,
    [loadingMessages],
  );

  const totalUnread = useMemo(() => Object.values(unread).reduce((sum, count) => sum + count, 0), [unread]);

  const value = useMemo<ChatContextValue>(
    () => ({
      conversations,
      users,
      presence,
      unread,
      totalUnread,
      isLoading,
      connected,
      messagesFor,
      typingIn,
      hasMoreIn,
      isLoadingMessages,
      refresh,
      openConversation,
      closeConversation,
      loadOlderMessages,
      send,
      retry,
      edit,
      remove,
      forward,
      setTyping,
      startDm,
      startGroup,
      renameGroup,
      setGroupAvatar,
      addMembers,
      removeMember,
      setPinned,
      setMuted,
      clearMessages,
      deleteChat,
      deleteGroup,
    }),
    [
      conversations,
      users,
      presence,
      unread,
      totalUnread,
      isLoading,
      connected,
      messagesFor,
      typingIn,
      hasMoreIn,
      isLoadingMessages,
      refresh,
      openConversation,
      closeConversation,
      loadOlderMessages,
      send,
      retry,
      edit,
      remove,
      forward,
      setTyping,
      startDm,
      startGroup,
      renameGroup,
      setGroupAvatar,
      addMembers,
      removeMember,
      setPinned,
      setMuted,
      clearMessages,
      deleteChat,
      deleteGroup,
    ],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used inside ChatProvider');
  return ctx;
}
