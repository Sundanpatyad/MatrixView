import type { ChatConversation, ChatMessage } from '@/lib/api/chat';

/** Stable chronological order — prevents shuffle when local + API merge. */
export function sortMessagesByTime(messages: ChatMessage[]): ChatMessage[] {
  return [...messages].sort((a, b) => {
    const ta = Date.parse(a.createdAt) || 0;
    const tb = Date.parse(b.createdAt) || 0;
    if (ta !== tb) return ta - tb;
    // Tie-breaker keeps order stable across reloads
    return a.id.localeCompare(b.id);
  });
}

export function sortConversationsByRecent(conversations: ChatConversation[]): ChatConversation[] {
  return [...conversations].sort((a, b) => {
    const ta = Date.parse(a.lastMessageAt) || Date.parse(a.createdAt) || 0;
    const tb = Date.parse(b.lastMessageAt) || Date.parse(b.createdAt) || 0;
    if (ta !== tb) return tb - ta;
    return a.id.localeCompare(b.id);
  });
}

export function mergeMessagesById(
  existing: ChatMessage[],
  incoming: ChatMessage[],
): ChatMessage[] {
  const map = new Map<string, ChatMessage>();
  for (const m of existing) map.set(m.id, m);
  for (const m of incoming) map.set(m.id, m);
  return sortMessagesByTime([...map.values()]);
}

/** Append one message without shuffling the rest. */
export function appendMessageSorted(
  existing: ChatMessage[],
  message: ChatMessage,
): ChatMessage[] {
  if (existing.some((m) => m.id === message.id)) {
    return existing.map((m) => (m.id === message.id ? message : m));
  }
  // Fast path: newest message goes at end
  const last = existing[existing.length - 1];
  const tNew = Date.parse(message.createdAt) || 0;
  const tLast = last ? Date.parse(last.createdAt) || 0 : 0;
  if (!last || tNew >= tLast) {
    return [...existing, message];
  }
  return sortMessagesByTime([...existing, message]);
}

/** Swap a local optimistic id for the server message (keep position). */
export function replaceMessageById(
  existing: ChatMessage[],
  localId: string,
  server: ChatMessage,
): ChatMessage[] {
  const idx = existing.findIndex((m) => m.id === localId);
  if (idx === -1) return appendMessageSorted(existing, server);
  const next = [...existing];
  next[idx] = { ...server, localState: server.localState ?? null };
  // Drop duplicate if socket already inserted the server id
  return next.filter((m, i) => m.id !== server.id || i === idx);
}
