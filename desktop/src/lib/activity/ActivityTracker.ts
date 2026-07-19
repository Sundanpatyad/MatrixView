import {
  postActivitySamples,
  startActivitySession,
  stopActivitySession,
  type ActivitySample,
  type ActivitySession,
  type AppUsage,
  type AwayPeriod,
  type SiteUsage,
} from '@/lib/api/activity';
import {
  createLocalActivitySession,
  markLocalSessionClosed,
  persistActivitySamples,
  saveServerActivitySession,
} from '@/lib/offline/activityStore';
import { isOfflineDbAvailable } from '@/lib/offline/db';
import { syncService } from '@/lib/offline/sync';
import { getForegroundApp, type ForegroundApp } from './native';

const POLL_MS = 5_000;
const FLUSH_MS = 20_000;

/** Extra client-side guard — never record TaskTrack (dev binary often named "app"). */
function isTaskTrackSelf(fg: ForegroundApp) {
  const app = fg.appName.toLowerCase();
  const proc = fg.processName.toLowerCase();
  const title = (fg.windowTitle ?? '').toLowerCase();
  if (app.includes('tasktrack') || proc.includes('tasktrack')) return true;
  const generic = app === 'app' || app === 'app_lib' || proc === 'app' || proc === 'app_lib';
  return generic && title.includes('tasktrack');
}
/** Gaps larger than this are treated as away (lock / sleep / lid). */
const AWAY_GAP_MS = 20_000;
/** Gaps this long (or more) are classified as sleep / lid close. */
const SLEEP_GAP_MS = 90_000;

type Listener = (state: {
  tracking: boolean;
  session: ActivitySession | null;
  currentApp: string | null;
  currentSite: string | null;
  localApps: AppUsage[];
  localSites: SiteUsage[];
  localAway: AwayPeriod[];
  error: string | null;
}) => void;

function mergeLocalApp(apps: Map<string, AppUsage>, sample: ActivitySample) {
  const name = sample.appName ?? '';
  if (!name) return;
  const key = name.toLowerCase();
  const prev = apps.get(key);
  if (prev) {
    apps.set(key, {
      ...prev,
      durationMs: prev.durationMs + sample.durationMs,
    });
  } else {
    apps.set(key, {
      appName: name,
      processName: sample.processName ?? '',
      durationMs: sample.durationMs,
      lastWindowTitle: sample.windowTitle ?? '',
    });
  }
}

function mergeLocalSite(sites: Map<string, SiteUsage>, sample: ActivitySample) {
  const host = (sample.host ?? '').toLowerCase();
  if (!host) return;
  const prev = sites.get(host);
  if (prev) {
    sites.set(host, {
      ...prev,
      durationMs: prev.durationMs + sample.durationMs,
      url: sample.url || prev.url,
      title: sample.windowTitle || prev.title,
      browserName: sample.appName || prev.browserName,
    });
  } else {
    sites.set(host, {
      host,
      url: sample.url ?? '',
      title: sample.windowTitle ?? '',
      browserName: sample.appName ?? '',
      durationMs: sample.durationMs,
    });
  }
}

function classifyAway(gapMs: number, lockedHint: boolean): AwayPeriod['kind'] {
  if (lockedHint) return 'locked';
  if (gapMs >= SLEEP_GAP_MS) return 'sleep';
  return 'away';
}

class ActivityTracker {
  private sessionId: string | null = null;
  /** Local SQLite session id when offline-first (may differ from server id). */
  private localSessionId: string | null = null;
  private session: ActivitySession | null = null;
  private userId: string | null = null;
  private orgId: string | null = null;
  private pollTimer: number | null = null;
  private flushTimer: number | null = null;
  private lastSampleAt = 0;
  private pending: ActivitySample[] = [];
  private localApps = new Map<string, AppUsage>();
  private localSites = new Map<string, SiteUsage>();
  private localAway: AwayPeriod[] = [];
  private currentApp: string | null = null;
  private currentSite: string | null = null;
  private tracking = false;
  private paused = false;
  private error: string | null = null;
  private listeners = new Set<Listener>();
  private lockStreak = 0;
  private hadSuccessfulRead = false;
  private visibilityHandler: (() => void) | null = null;

  configureUser(user: { id: string; orgId: string } | null) {
    this.userId = user?.id ?? null;
    this.orgId = user?.orgId ?? null;
  }

  /** Called when offline start syncs and server assigns a real session id. */
  remapSessionId(localId: string, serverId: string) {
    if (this.localSessionId === localId || this.sessionId === localId) {
      this.sessionId = serverId;
      if (this.session) this.session = { ...this.session, id: serverId };
      this.emit();
    }
    void syncService.flush();
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private snapshot() {
    return {
      tracking: this.tracking,
      session: this.session,
      currentApp: this.currentApp,
      currentSite: this.currentSite,
      localApps: [...this.localApps.values()].sort((a, b) => b.durationMs - a.durationMs),
      localSites: [...this.localSites.values()].sort((a, b) => b.durationMs - a.durationMs),
      localAway: [...this.localAway],
      error: this.error,
    };
  }

  private emit() {
    const snap = this.snapshot();
    for (const l of this.listeners) l(snap);
  }

  private bindVisibility() {
    this.unbindVisibility();
    this.visibilityHandler = () => {
      if (!this.tracking || this.paused) return;
      if (document.visibilityState === 'hidden') {
        void this.tick();
      } else if (document.visibilityState === 'visible') {
        void this.tick();
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  private unbindVisibility() {
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
  }

  async start(): Promise<ActivitySession | null> {
    if (this.tracking) return this.session;
    this.error = null;
    this.pending = [];
    this.localApps = new Map();
    this.localSites = new Map();
    this.localAway = [];
    this.currentApp = null;
    this.currentSite = null;
    this.lockStreak = 0;
    this.hadSuccessfulRead = false;

    // Prefer online start when network is available
    if (navigator.onLine) {
      try {
        const { session } = await startActivitySession();
        this.localSessionId = session.id;
        await saveServerActivitySession(session);
        this.attachSession(session, session.id);
        void syncService.flush();
        return session;
      } catch {
        /* fall through to offline */
      }
    }

    if (isOfflineDbAvailable() && this.userId && this.orgId) {
      const session = await createLocalActivitySession({
        userId: this.userId,
        orgId: this.orgId,
      });
      this.localSessionId = session.id;
      this.attachSession(session, session.id);
      return session;
    }

    this.error = 'Failed to start tracking (offline and no local database)';
    this.tracking = false;
    this.emit();
    return null;
  }

  /** Resume an existing active session from the DB (after app reopen). */
  async resume(session: ActivitySession, localId?: string): Promise<ActivitySession | null> {
    if (this.tracking) return this.session;
    if (session.status !== 'active') {
      this.error = 'Session is not active';
      this.emit();
      return null;
    }
    this.error = null;
    this.pending = [];
    this.lockStreak = 0;
    this.hadSuccessfulRead = false;
    this.localSessionId = localId ?? session.id;
    await saveServerActivitySession(session, this.localSessionId);
    this.attachSession(session, this.localSessionId);
    return session;
  }

  private attachSession(session: ActivitySession, storageSessionId: string) {
    this.session = session;
    this.sessionId = session.id;
    this.localSessionId = storageSessionId;
    this.localApps = new Map(
      (session.apps ?? []).map((a) => [a.appName.toLowerCase(), a] as const),
    );
    this.localSites = new Map(
      (session.sites ?? []).map((s) => [s.host.toLowerCase(), s] as const),
    );
    this.localAway = [...(session.awayPeriods ?? [])];
    this.tracking = true;
    this.paused = false;
    this.lastSampleAt = Date.now();
    if (this.pollTimer != null) window.clearInterval(this.pollTimer);
    if (this.flushTimer != null) window.clearInterval(this.flushTimer);
    this.pollTimer = window.setInterval(() => void this.tick(), POLL_MS);
    this.flushTimer = window.setInterval(() => void this.flush(), FLUSH_MS);
    this.bindVisibility();
    this.emit();
    void this.tick();
  }

  setPaused(paused: boolean) {
    if (!this.tracking) return;
    if (paused && !this.paused) {
      void this.tick();
    }
    this.paused = paused;
    if (!paused) this.lastSampleAt = Date.now();
    this.emit();
  }

  async stop() {
    if (!this.tracking && !this.sessionId) return;
    this.clearTimers();
    const localId = this.localSessionId ?? this.sessionId;

    try {
      await this.tick();
      await this.flush();
      if (navigator.onLine && this.sessionId && !this.sessionId.startsWith('lsess_')) {
        const { session } = await stopActivitySession(this.sessionId);
        this.session = session;
        if (localId) await markLocalSessionClosed(localId);
      } else if (localId && isOfflineDbAvailable()) {
        await markLocalSessionClosed(localId);
        void syncService.flush();
      } else {
        await stopActivitySession(this.sessionId ?? undefined);
      }
    } catch (err) {
      if (localId && isOfflineDbAvailable()) {
        await markLocalSessionClosed(localId);
        void syncService.flush();
      } else {
        this.error = err instanceof Error ? err.message : 'Failed to stop tracking';
      }
    } finally {
      this.resetLocal(true);
      this.emit();
    }
  }

  /** Stop polling locally but keep the DB session active (app close / logout). */
  softStop() {
    if (!this.tracking) return;
    void this.flush();
    this.clearTimers();
    this.resetLocal(false);
    this.emit();
  }

  private clearTimers() {
    if (this.pollTimer != null) window.clearInterval(this.pollTimer);
    if (this.flushTimer != null) window.clearInterval(this.flushTimer);
    this.pollTimer = null;
    this.flushTimer = null;
    this.unbindVisibility();
  }

  private resetLocal(clearSessionId: boolean) {
    this.tracking = false;
    this.paused = false;
    if (clearSessionId) {
      this.sessionId = null;
      this.localSessionId = null;
    }
    this.currentApp = null;
    this.currentSite = null;
  }

  private recordLockedSlice(now: number, durationMs: number) {
    if (durationMs <= 0) return;
    this.currentApp = 'Screen locked';
    this.currentSite = null;
    const startedAt = now - durationMs;
    this.pending.push({
      kind: 'away',
      awayKind: 'locked',
      startedAt: new Date(startedAt).toISOString(),
      endedAt: new Date(now).toISOString(),
      durationMs,
    });
    const last = this.localAway[this.localAway.length - 1];
    if (
      last &&
      last.kind === 'locked' &&
      now - new Date(last.endedAt).getTime() < 30_000
    ) {
      last.endedAt = new Date(now).toISOString();
      last.durationMs = new Date(last.endedAt).getTime() - new Date(last.startedAt).getTime();
    } else {
      this.localAway.push({
        kind: 'locked',
        startedAt: new Date(startedAt).toISOString(),
        endedAt: new Date(now).toISOString(),
        durationMs,
      });
    }
  }

  private pushAway(startedAt: number, endedAt: number, lockedHint: boolean) {
    const gap = endedAt - startedAt;
    if (gap < AWAY_GAP_MS) return;
    const kind = classifyAway(gap, lockedHint);
    const finalKind: AwayPeriod['kind'] =
      kind === 'sleep' && document.visibilityState === 'hidden' ? 'lid_closed' : kind;

    const period: AwayPeriod = {
      kind: finalKind,
      startedAt: new Date(startedAt).toISOString(),
      endedAt: new Date(endedAt).toISOString(),
      durationMs: gap,
    };
    this.localAway.push(period);
    this.pending.push({
      kind: 'away',
      awayKind: finalKind,
      startedAt: period.startedAt,
      endedAt: period.endedAt,
      durationMs: gap,
    });
  }

  private async tick() {
    if (!this.tracking || this.paused || !this.sessionId) return;

    const now = Date.now();
    const gap = now - this.lastSampleAt;

    if (gap >= AWAY_GAP_MS) {
      this.pushAway(this.lastSampleAt, now, this.lockStreak > 0);
      this.lastSampleAt = now;
      this.currentApp = null;
      this.currentSite = null;
      this.emit();
    }

    const elapsed = Math.min(now - this.lastSampleAt, POLL_MS * 2);
    this.lastSampleAt = now;

    const fg = await getForegroundApp();
    if (!fg) {
      this.lockStreak += 1;
      if (this.hadSuccessfulRead && this.lockStreak >= 2) {
        this.recordLockedSlice(now, Math.max(elapsed, POLL_MS));
        this.emit();
        return;
      }
      this.currentApp = null;
      this.currentSite = null;
      this.error =
        'Cannot read active app. Grant Accessibility to TaskTrack (macOS System Settings → Privacy & Security → Accessibility), then check in again.';
      this.emit();
      return;
    }

    this.error = null;
    this.hadSuccessfulRead = true;

    if (fg.locked) {
      this.lockStreak += 1;
      this.recordLockedSlice(now, elapsed > 0 ? elapsed : POLL_MS);
      this.emit();
      return;
    }

    this.lockStreak = 0;

    if (fg.excluded || isTaskTrackSelf(fg)) {
      this.currentApp = null;
      this.currentSite = null;
      this.emit();
      return;
    }

    this.currentApp = fg.appName;
    this.currentSite = fg.host ?? null;

    if (elapsed > 0) {
      const appSample: ActivitySample = {
        kind: 'app',
        appName: fg.appName,
        processName: fg.processName,
        windowTitle: fg.windowTitle,
        durationMs: elapsed,
      };
      this.pending.push(appSample);
      mergeLocalApp(this.localApps, appSample);

      if (fg.url || fg.host) {
        const siteSample: ActivitySample = {
          kind: 'site',
          appName: fg.appName,
          processName: fg.processName,
          windowTitle: fg.windowTitle,
          url: fg.url ?? undefined,
          host: fg.host ?? undefined,
          durationMs: elapsed,
        };
        this.pending.push(siteSample);
        mergeLocalSite(this.localSites, siteSample);
      }
    }
    this.emit();
  }

  private async flush() {
    const storageId = this.localSessionId ?? this.sessionId;
    if (!storageId || this.pending.length === 0) return;
    const batch = this.pending.splice(0, this.pending.length);

    const serverId =
      this.sessionId && !this.sessionId.startsWith('lsess_') ? this.sessionId : null;

    // Online with server session → try push, then store as synced
    if (navigator.onLine && serverId) {
      try {
        const { session } = await postActivitySamples(serverId, batch);
        this.session = session;
        this.localApps = new Map(session.apps.map((a) => [a.appName.toLowerCase(), a] as const));
        this.localSites = new Map(
          (session.sites ?? []).map((s) => [s.host.toLowerCase(), s] as const),
        );
        this.localAway = [...(session.awayPeriods ?? [])];
        this.emit();
        if (isOfflineDbAvailable()) {
          await persistActivitySamples(storageId, batch, { synced: true });
        }
        return;
      } catch {
        /* fall through to local queue */
      }
    }

    // Offline / no server id / push failed → durable local queue
    if (isOfflineDbAvailable()) {
      await persistActivitySamples(storageId, batch, { synced: false });
      void syncService.flush();
    } else {
      this.pending.unshift(...batch);
    }
  }
}

export const activityTracker = new ActivityTracker();
