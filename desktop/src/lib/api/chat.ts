import { apiFetch } from './client';

export type ChatMember = {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl?: string | null;
  checkedIn?: boolean;
};

export type MessageDeliveryStatus = 'sent' | 'delivered' | 'read';

export type ChatConversation = {
  id: string;
  type: 'dm' | 'group';
  name: string;
  rawName: string;
  avatarUrl?: string | null;
  memberIds: string[];
  members: ChatMember[];
  createdBy: string;
  lastMessageAt: string;
  lastMessagePreview: string;
  createdAt: string;
};

export type ChatAttachment = {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  url: string;
  kind: 'image' | 'video' | 'document' | 'other';
};

export type ChatReplyPreview = {
  id: string;
  body: string;
  senderName: string;
  deleted: boolean;
};

export type ChatMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderAvatarUrl?: string | null;
  body: string;
  replyTo: ChatReplyPreview | null;
  attachments: ChatAttachment[];
  status?: MessageDeliveryStatus;
  receipts?: Array<{
    userId: string;
    deliveredAt: string | null;
    readAt: string | null;
  }>;
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
};

export function listConversations(): Promise<{ conversations: ChatConversation[] }> {
  return apiFetch('/api/chat/conversations', { auth: true });
}

export function listChatUsers(): Promise<{ users: ChatMember[] }> {
  return apiFetch('/api/chat/users', { auth: true });
}

export function createDm(userId: string): Promise<{ conversation: ChatConversation }> {
  return apiFetch('/api/chat/conversations/dm', {
    method: 'POST',
    auth: true,
    body: JSON.stringify({ userId }),
  });
}

export function createGroup(input: {
  name: string;
  memberIds: string[];
}): Promise<{ conversation: ChatConversation }> {
  return apiFetch('/api/chat/conversations/groups', {
    method: 'POST',
    auth: true,
    body: JSON.stringify(input),
  });
}

export function updateGroup(
  conversationId: string,
  input: { name: string },
): Promise<{ conversation: ChatConversation }> {
  return apiFetch(`/api/chat/conversations/${conversationId}`, {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify(input),
  });
}

export function uploadGroupAvatar(
  conversationId: string,
  file: File,
): Promise<{ conversation: ChatConversation }> {
  const body = new FormData();
  body.append('avatar', file);
  return apiFetch(`/api/chat/conversations/${conversationId}/avatar`, {
    method: 'POST',
    auth: true,
    body,
  });
}

export function addGroupMembers(
  conversationId: string,
  memberIds: string[],
): Promise<{ conversation: ChatConversation }> {
  return apiFetch(`/api/chat/conversations/${conversationId}/members`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify({ memberIds }),
  });
}

export function removeGroupMember(
  conversationId: string,
  userId: string,
): Promise<{ conversation: ChatConversation }> {
  return apiFetch(`/api/chat/conversations/${conversationId}/members/${userId}`, {
    method: 'DELETE',
    auth: true,
  });
}

export function listMessages(
  conversationId: string,
  opts?: { after?: string },
): Promise<{ messages: ChatMessage[] }> {
  const q = opts?.after ? `?after=${encodeURIComponent(opts.after)}` : '';
  return apiFetch(`/api/chat/conversations/${conversationId}/messages${q}`, {
    auth: true,
  });
}

export function sendMessage(
  conversationId: string,
  input: { body?: string; replyToId?: string; files?: File[] },
): Promise<{ message: ChatMessage }> {
  const form = new FormData();
  if (input.body) form.append('body', input.body);
  if (input.replyToId) form.append('replyToId', input.replyToId);
  for (const file of input.files ?? []) {
    form.append('files', file);
  }
  return apiFetch(`/api/chat/conversations/${conversationId}/messages`, {
    method: 'POST',
    auth: true,
    body: form,
  });
}

export function editMessage(
  messageId: string,
  body: string,
): Promise<{ message: ChatMessage }> {
  return apiFetch(`/api/chat/messages/${messageId}`, {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify({ body }),
  });
}

export function forwardMessage(
  messageId: string,
  conversationId: string,
): Promise<{ message: ChatMessage; conversation: ChatConversation }> {
  return apiFetch(`/api/chat/messages/${messageId}/forward`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify({ conversationId }),
  });
}

export function deleteMessage(messageId: string): Promise<{ message: ChatMessage }> {
  return apiFetch(`/api/chat/messages/${messageId}`, {
    method: 'DELETE',
    auth: true,
  });
}
