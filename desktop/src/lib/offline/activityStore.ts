import type { ActivitySample, ActivitySession } from '@/lib/api/activity';
import { getOfflineDb, newLocalId } from './db';
import { enqueueOutbox } from './outbox';

type SessionRow = {
  id: string;
  server_id: string | null;
  user_id: string;
  org_id: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  synced: number;
};

export async function createLocalActivitySession(input: {
  userId: string;
  orgId: string;
}): Promise<ActivitySession> {
  const db = await getOfflineDb();
  const id = newLocalId('lsess');
  const startedAt = new Date().toISOString();
  const session: ActivitySession = {
    id,
    userId: input.userId,
    orgId: input.orgId,
    status: 'active',
    startedAt,
    endedAt: null,
    totalTrackedMs: 0,
    totalAwayMs: 0,
    apps: [],
    sites: [],
    awayPeriods: [],
  };

  if (db) {
    await db.execute(
      `INSERT INTO activity_sessions
        (id, server_id, user_id, org_id, status, started_at, ended_at, synced)
       VALUES ($1, NULL, $2, $3, 'active', $4, NULL, 0)`,
      [id, input.userId, input.orgId, startedAt],
    );
    await enqueueOutbox('activity.session.start', { localSessionId: id });
  }

  return session;
}

export async function saveServerActivitySession(
  session: ActivitySession,
  localId?: string,
) {
  const db = await getOfflineDb();
  if (!db) return;
  const id = localId ?? session.id;
  const existing = await db.select<SessionRow[]>(
    `SELECT id FROM activity_sessions WHERE id = $1 OR server_id = $2 LIMIT 1`,
    [id, session.id],
  );
  if (existing[0]) {
    await db.execute(
      `UPDATE activity_sessions
       SET server_id = $2, status = $3, started_at = $4, ended_at = $5, synced = 1
       WHERE id = $1`,
      [
        existing[0].id,
        session.id,
        session.status,
        session.startedAt,
        session.endedAt,
      ],
    );
  } else {
    await db.execute(
      `INSERT INTO activity_sessions
        (id, server_id, user_id, org_id, status, started_at, ended_at, synced)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 1)`,
      [
        id,
        session.id,
        session.userId,
        session.orgId,
        session.status,
        session.startedAt,
        session.endedAt,
      ],
    );
  }
}

export async function getActiveLocalSession(userId: string): Promise<{
  localId: string;
  serverId: string | null;
  session: ActivitySession;
} | null> {
  const db = await getOfflineDb();
  if (!db) return null;
  const rows = await db.select<SessionRow[]>(
    `SELECT * FROM activity_sessions
     WHERE user_id = $1 AND status = 'active'
     ORDER BY started_at DESC LIMIT 1`,
    [userId],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    localId: row.id,
    serverId: row.server_id,
    session: {
      id: row.server_id ?? row.id,
      userId: row.user_id,
      orgId: row.org_id,
      status: row.status as 'active' | 'closed',
      startedAt: row.started_at,
      endedAt: row.ended_at,
      totalTrackedMs: 0,
      apps: [],
      sites: [],
      awayPeriods: [],
    },
  };
}

export async function resolveServerSessionId(localOrServerId: string): Promise<string | null> {
  const db = await getOfflineDb();
  if (!db) return localOrServerId.startsWith('lsess_') ? null : localOrServerId;
  const rows = await db.select<SessionRow[]>(
    `SELECT id, server_id FROM activity_sessions
     WHERE id = $1 OR server_id = $1 LIMIT 1`,
    [localOrServerId],
  );
  const row = rows[0];
  if (!row) return localOrServerId.startsWith('lsess_') ? null : localOrServerId;
  return row.server_id;
}

export async function getLocalSessionRow(localId: string): Promise<SessionRow | null> {
  const db = await getOfflineDb();
  if (!db) return null;
  const rows = await db.select<SessionRow[]>(
    `SELECT * FROM activity_sessions WHERE id = $1 LIMIT 1`,
    [localId],
  );
  return rows[0] ?? null;
}

export async function markLocalSessionClosed(localId: string) {
  const db = await getOfflineDb();
  if (!db) return;
  const endedAt = new Date().toISOString();
  await db.execute(
    `UPDATE activity_sessions SET status = 'closed', ended_at = $2, synced = 0 WHERE id = $1`,
    [localId, endedAt],
  );
  await enqueueOutbox('activity.session.stop', { localSessionId: localId });
}

export async function persistActivitySamples(
  sessionId: string,
  samples: ActivitySample[],
  opts?: { synced?: boolean },
): Promise<string[]> {
  const db = await getOfflineDb();
  if (!db || samples.length === 0) return [];
  const createdAt = new Date().toISOString();
  const synced = opts?.synced ? 1 : 0;
  const ids: string[] = [];
  for (const sample of samples) {
    const id = newLocalId('samp');
    ids.push(id);
    await db.execute(
      `INSERT INTO activity_samples (id, session_id, payload, created_at, synced)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, sessionId, JSON.stringify(sample), createdAt, synced],
    );
  }
  return ids;
}

export async function listUnsyncedSamples(limit = 200): Promise<
  Array<{ id: string; session_id: string; payload: string }>
> {
  const db = await getOfflineDb();
  if (!db) return [];
  return db.select(
    `SELECT id, session_id, payload FROM activity_samples
     WHERE synced = 0
     ORDER BY created_at ASC
     LIMIT $1`,
    [limit],
  );
}

export async function markSamplesSynced(ids: string[]) {
  const db = await getOfflineDb();
  if (!db || ids.length === 0) return;
  for (const id of ids) {
    await db.execute(`UPDATE activity_samples SET synced = 1 WHERE id = $1`, [id]);
  }
}

export async function setSessionServerId(localId: string, serverId: string) {
  const db = await getOfflineDb();
  if (!db) return;
  await db.execute(
    `UPDATE activity_sessions SET server_id = $2, synced = 1 WHERE id = $1`,
    [localId, serverId],
  );
}
