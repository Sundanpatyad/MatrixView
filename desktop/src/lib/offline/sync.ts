import {
  postActivitySamples,
  startActivitySession,
  stopActivitySession,
  type ActivitySample,
} from '@/lib/api/activity';
import { sendMessage } from '@/lib/api/chat';
import {
  getLocalSessionRow,
  listUnsyncedSamples,
  markSamplesSynced,
  setSessionServerId,
} from './activityStore';
import { getPendingMessage, replacePendingMessage } from './chatStore';
import { isOfflineDbAvailable } from './db';
import {
  listPendingOutbox,
  markOutboxDone,
  markOutboxFailed,
  pendingOutboxCount,
  type OutboxRow,
} from './outbox';

type SyncListener = (state: { syncing: boolean; pending: number; lastError: string | null }) => void;

class SyncService {
  private timer: number | null = null;
  private running = false;
  private syncing = false;
  private lastError: string | null = null;
  private listeners = new Set<SyncListener>();
  private onSessionMapped: ((localId: string, serverId: string) => void) | null = null;

  setSessionMappedHandler(handler: (localId: string, serverId: string) => void) {
    this.onSessionMapped = handler;
  }

  subscribe(listener: SyncListener) {
    this.listeners.add(listener);
    void this.emit();
    return () => this.listeners.delete(listener);
  }

  private async emit() {
    const pending = await pendingOutboxCount();
    const unsynced = (await listUnsyncedSamples(1)).length > 0 ? 1 : 0;
    const state = {
      syncing: this.syncing,
      pending: pending + unsynced,
      lastError: this.lastError,
    };
    for (const l of this.listeners) l(state);
  }

  start() {
    if (!isOfflineDbAvailable() || this.running) return;
    this.running = true;
    void this.flush();
    this.timer = window.setInterval(() => {
      if (navigator.onLine) void this.flush();
    }, 8_000);
    window.addEventListener('online', this.onOnline);
  }

  stop() {
    this.running = false;
    if (this.timer != null) window.clearInterval(this.timer);
    this.timer = null;
    window.removeEventListener('online', this.onOnline);
  }

  private onOnline = () => {
    void this.flush();
  };

  async flush() {
    if (!isOfflineDbAvailable() || !navigator.onLine || this.syncing) return;
    this.syncing = true;
    this.lastError = null;
    await this.emit();
    try {
      await this.processOutbox();
      await this.flushSamples();
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : 'Sync failed';
    } finally {
      this.syncing = false;
      await this.emit();
    }
  }

  private async processOutbox() {
    const rows = await listPendingOutbox(40);
    for (const row of rows) {
      try {
        await this.handleOutbox(row);
        await markOutboxDone(row.id);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed';
        this.lastError = message;
        await markOutboxFailed(row.id, message);
      }
    }
  }

  private async handleOutbox(row: OutboxRow) {
    const payload = JSON.parse(row.payload) as Record<string, unknown>;
    if (row.kind === 'activity.session.start') {
      const localSessionId = String(payload.localSessionId);
      const { session } = await startActivitySession();
      await setSessionServerId(localSessionId, session.id);
      this.onSessionMapped?.(localSessionId, session.id);
      return;
    }
    if (row.kind === 'activity.session.stop') {
      const localSessionId = String(payload.localSessionId);
      const rowLocal = await getLocalSessionRow(localSessionId);
      const serverId = rowLocal?.server_id;
      if (serverId) {
        await stopActivitySession(serverId);
      } else {
        // Start may still be pending — stop after start by re-enqueue? For now try stop current.
        await stopActivitySession();
      }
      return;
    }
    if (row.kind === 'chat.message.send') {
      const localMessageId = String(payload.localMessageId);
      const conversationId = String(payload.conversationId);
      const body = String(payload.body ?? '');
      const replyToId =
        typeof payload.replyToId === 'string' && payload.replyToId
          ? payload.replyToId
          : undefined;
      const pending = await getPendingMessage(localMessageId);
      if (!pending) return;
      const { message } = await sendMessage(conversationId, { body, replyToId });
      await replacePendingMessage(localMessageId, message, pending.user_id);
    }
  }

  private async flushSamples() {
    const rows = await listUnsyncedSamples(200);
    if (rows.length === 0) return;

    const bySession = new Map<string, Array<{ id: string; sample: ActivitySample }>>();
    for (const row of rows) {
      const sample = JSON.parse(row.payload) as ActivitySample;
      const list = bySession.get(row.session_id) ?? [];
      list.push({ id: row.id, sample });
      bySession.set(row.session_id, list);
    }

    for (const [localSessionId, items] of bySession) {
      const sessionRow = await getLocalSessionRow(localSessionId);
      const serverId =
        sessionRow?.server_id ??
        (localSessionId.startsWith('lsess_') ? null : localSessionId);
      if (!serverId) continue;
      await postActivitySamples(
        serverId,
        items.map((i) => i.sample),
      );
      await markSamplesSynced(items.map((i) => i.id));
    }
  }
}

export const syncService = new SyncService();
