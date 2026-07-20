import type { ChatAttachment, ChatMessage } from '@/lib/api/chat';
import { sendChatMessage } from '@/lib/offline/chatApi';
import { cacheOptimisticMessage, replacePendingMessage } from '@/lib/offline/chatStore';
import { isOfflineDbAvailable, newLocalId } from '@/lib/offline/db';

export type SendJobInput = {
  userId: string;
  userName: string;
  userAvatarUrl?: string | null;
  conversationId: string;
  body: string;
  replyToId?: string;
  replyPreview?: ChatMessage['replyTo'];
  files: File[];
};

export type OptimisticSend = {
  localId: string;
  message: ChatMessage;
  objectUrls: string[];
};

type QueueJob = SendJobInput & {
  localId: string;
  objectUrls: string[];
  onSuccess: (server: ChatMessage, localId: string) => void;
  onFailure: (err: Error, localId: string) => void;
};

function attachmentKind(mime: string): ChatAttachment['kind'] {
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

/** Build a WhatsApp-style optimistic bubble (blob previews for media). */
export function buildOptimisticMessage(input: SendJobInput): OptimisticSend {
  const localId = newLocalId('lmsg');
  const createdAt = new Date().toISOString();
  const objectUrls: string[] = [];
  const attachments: ChatAttachment[] = input.files.map((file) => {
    const url = URL.createObjectURL(file);
    objectUrls.push(url);
    return {
      id: newLocalId('latt'),
      name: file.name,
      size: file.size,
      mimeType: file.type || 'application/octet-stream',
      url,
      kind: attachmentKind(file.type || ''),
    };
  });

  const message: ChatMessage = {
    id: localId,
    conversationId: input.conversationId,
    senderId: input.userId,
    senderName: input.userName,
    senderAvatarUrl: input.userAvatarUrl ?? null,
    body: input.body,
    replyTo: input.replyPreview ?? (input.replyToId
      ? { id: input.replyToId, body: '', senderName: '', deleted: false }
      : null),
    attachments,
    status: 'sent',
    localState: 'sending',
    receipts: [],
    editedAt: null,
    deletedAt: null,
    createdAt,
  };

  return { localId, message, objectUrls };
}

export function revokeObjectUrls(urls: string[]) {
  for (const url of urls) {
    try {
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    }
  }
}

/**
 * Per-conversation FIFO send queue (WhatsApp-style):
 * composer stays free; bubbles show "sending" until each job finishes in order.
 */
class ChatSendQueue {
  private queues = new Map<string, QueueJob[]>();
  private pumping = new Set<string>();

  enqueue(
    optimistic: OptimisticSend,
    input: SendJobInput,
    handlers: {
      onSuccess: (server: ChatMessage, localId: string) => void;
      onFailure: (err: Error, localId: string) => void;
    },
  ) {
    const job: QueueJob = {
      ...input,
      localId: optimistic.localId,
      objectUrls: optimistic.objectUrls,
      onSuccess: handlers.onSuccess,
      onFailure: handlers.onFailure,
    };
    const list = this.queues.get(input.conversationId) ?? [];
    list.push(job);
    this.queues.set(input.conversationId, list);
    void this.pump(input.conversationId);
  }

  private async pump(conversationId: string) {
    if (this.pumping.has(conversationId)) return;
    this.pumping.add(conversationId);
    try {
      while (true) {
        const list = this.queues.get(conversationId);
        if (!list?.length) break;
        const job = list.shift()!;
        try {
          if (job.files.length > 0 && !navigator.onLine) {
            throw new Error('Attachments need an internet connection');
          }
          const server = await sendChatMessage({
            userId: job.userId,
            userName: job.userName,
            userAvatarUrl: job.userAvatarUrl,
            conversationId: job.conversationId,
            body: job.body,
            replyToId: job.replyToId,
            files: job.files,
            localMessageId: job.localId,
          });
          // Still pending offline (same local id) — keep clock; otherwise swap to server msg
          if (server.id === job.localId) {
            job.onSuccess({ ...server, localState: 'sending' }, job.localId);
          } else {
            if (isOfflineDbAvailable()) {
              await replacePendingMessage(job.localId, server, job.userId);
            }
            // Replace UI first so the bubble never briefly loses its media URL.
            job.onSuccess({ ...server, localState: null }, job.localId);
            revokeObjectUrls(job.objectUrls);
          }
        } catch (err) {
          const error = err instanceof Error ? err : new Error('Failed to send');
          job.onFailure(error, job.localId);
        }
      }
    } finally {
      this.pumping.delete(conversationId);
      const leftover = this.queues.get(conversationId);
      if (leftover?.length) void this.pump(conversationId);
    }
  }
}

export const chatSendQueue = new ChatSendQueue();

export async function persistOptimisticLocal(userId: string, message: ChatMessage) {
  if (!isOfflineDbAvailable()) return;
  await cacheOptimisticMessage(userId, message);
}
