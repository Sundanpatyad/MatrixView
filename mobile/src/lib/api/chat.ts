import { apiFetch } from './client';
import type { ChatConversation, ChatMember, ChatMessage, PickedFile } from './types';

export function listConversations() {
  return apiFetch<{ conversations: ChatConversation[] }>('/api/chat/conversations', { auth: true });
}

export function listChatUsers() {
  return apiFetch<{ users: ChatMember[] }>('/api/chat/users', { auth: true });
}

export function createDm(input: { userId?: string; email?: string }) {
  return apiFetch<{ conversation: ChatConversation }>('/api/chat/conversations/dm', {
    method: 'POST',
    body: input,
    auth: true,
  });
}

export function createGroup(input: { name: string; memberIds?: string[] }) {
  return apiFetch<{ conversation: ChatConversation }>('/api/chat/conversations/groups', {
    method: 'POST',
    body: input,
    auth: true,
  });
}

export function updateGroup(conversationId: string, name: string) {
  return apiFetch<{ conversation: ChatConversation }>(`/api/chat/conversations/${conversationId}`, {
    method: 'PATCH',
    body: { name },
    auth: true,
  });
}

export function uploadGroupAvatar(conversationId: string, file: PickedFile) {
  const form = new FormData();
  form.append('avatar', { uri: file.uri, name: file.name, type: file.mimeType } as unknown as Blob);
  return apiFetch<{ conversation: ChatConversation }>(`/api/chat/conversations/${conversationId}/avatar`, {
    method: 'POST',
    body: form,
    auth: true,
  });
}

export function addGroupMembers(conversationId: string, memberIds: string[]) {
  return apiFetch<{ conversation: ChatConversation }>(`/api/chat/conversations/${conversationId}/members`, {
    method: 'POST',
    body: { memberIds },
    auth: true,
  });
}

export function removeGroupMember(conversationId: string, userId: string) {
  return apiFetch<{ conversation: ChatConversation }>(
    `/api/chat/conversations/${conversationId}/members/${userId}`,
    { method: 'DELETE', auth: true },
  );
}

export function listMessages(
  conversationId: string,
  params: { after?: string; before?: string; limit?: number } = {},
) {
  const search = new URLSearchParams();
  if (params.after) search.set('after', params.after);
  if (params.before) search.set('before', params.before);
  if (params.limit) search.set('limit', String(params.limit));
  const query = search.toString();
  return apiFetch<{ messages: ChatMessage[]; hasMore: boolean }>(
    `/api/chat/conversations/${conversationId}/messages${query ? `?${query}` : ''}`,
    { auth: true },
  );
}

export function sendMessage(
  conversationId: string,
  input: { body: string; replyToId?: string; files?: PickedFile[] },
) {
  const form = new FormData();
  form.append('body', input.body);
  if (input.replyToId) form.append('replyToId', input.replyToId);
  (input.files ?? []).forEach((file) => {
    form.append('files', { uri: file.uri, name: file.name, type: file.mimeType } as unknown as Blob);
  });
  return apiFetch<{ message: ChatMessage }>(`/api/chat/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: form,
    auth: true,
    timeoutMs: 90000,
  });
}

export function editMessage(messageId: string, body: string) {
  return apiFetch<{ message: ChatMessage }>(`/api/chat/messages/${messageId}`, {
    method: 'PATCH',
    body: { body },
    auth: true,
  });
}

export function forwardMessage(messageId: string, conversationId: string) {
  return apiFetch<{ message: ChatMessage; conversation: ChatConversation }>(
    `/api/chat/messages/${messageId}/forward`,
    { method: 'POST', body: { conversationId }, auth: true },
  );
}

export function deleteMessage(messageId: string) {
  return apiFetch<{ message: ChatMessage }>(`/api/chat/messages/${messageId}`, { method: 'DELETE', auth: true });
}
