import { getOfflineDb, newLocalId } from './db';

export type OutboxKind =
  | 'activity.session.start'
  | 'activity.session.stop'
  | 'chat.message.send';

export type OutboxRow = {
  id: string;
  kind: OutboxKind;
  payload: string;
  created_at: string;
  attempts: number;
  last_error: string | null;
  status: string;
};

export async function enqueueOutbox(kind: OutboxKind, payload: unknown) {
  const db = await getOfflineDb();
  if (!db) return null;
  const id = newLocalId('ob');
  const createdAt = new Date().toISOString();
  await db.execute(
    `INSERT INTO outbox (id, kind, payload, created_at, attempts, last_error, status)
     VALUES ($1, $2, $3, $4, 0, NULL, 'pending')`,
    [id, kind, JSON.stringify(payload), createdAt],
  );
  return id;
}

export async function listPendingOutbox(limit = 50): Promise<OutboxRow[]> {
  const db = await getOfflineDb();
  if (!db) return [];
  return db.select<OutboxRow[]>(
    `SELECT id, kind, payload, created_at, attempts, last_error, status
     FROM outbox
     WHERE status = 'pending'
     ORDER BY created_at ASC
     LIMIT $1`,
    [limit],
  );
}

export async function markOutboxDone(id: string) {
  const db = await getOfflineDb();
  if (!db) return;
  await db.execute(`UPDATE outbox SET status = 'done' WHERE id = $1`, [id]);
}

export async function markOutboxFailed(id: string, error: string) {
  const db = await getOfflineDb();
  if (!db) return;
  await db.execute(
    `UPDATE outbox SET attempts = attempts + 1, last_error = $2,
      status = CASE WHEN attempts + 1 >= 20 THEN 'failed' ELSE 'pending' END
     WHERE id = $1`,
    [id, error.slice(0, 500)],
  );
}

export async function pendingOutboxCount(): Promise<number> {
  const db = await getOfflineDb();
  if (!db) return 0;
  const rows = await db.select<Array<{ c: number }>>(
    `SELECT COUNT(*) as c FROM outbox WHERE status = 'pending'`,
  );
  return Number(rows[0]?.c ?? 0);
}
