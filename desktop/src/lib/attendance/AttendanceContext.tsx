import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { activityTracker } from '@/lib/activity/ActivityTracker';
import {
  getAttendanceStatus,
  type ActivitySession,
  type AppUsage,
} from '@/lib/api/activity';
import { useAuth } from '@/lib/auth/AuthContext';
import { getActiveLocalSession } from '@/lib/offline/activityStore';

type AttendanceState = {
  checkedIn: boolean;
  onBreak: boolean;
  checkInAt: string | null;
  checkOutAt: string | null;
  /** Wall-clock ms when the current work session started (excludes break pauses). */
  sessionStartedAt: number | null;
  /** Accumulated worked ms before the current running segment. */
  workedMs: number;
  elapsedLabel: string;
  activeTaskId: string | null;
  /** True after first attendance hydrate from DB. */
  attendanceReady: boolean;
  /** Activity tracking (apps) while checked in */
  tracking: boolean;
  currentApp: string | null;
  activityApps: AppUsage[];
  activitySession: ActivitySession | null;
  trackingError: string | null;
  checkIn: () => Promise<void>;
  checkOut: () => Promise<void>;
  toggleBreak: () => void;
  setActiveTask: (id: string | null) => void;
};

const AttendanceContext = createContext<AttendanceState | null>(null);

function clockLabel(isoOrDate?: string | Date | null) {
  if (!isoOrDate) return null;
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(+d)) return null;
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatElapsed(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

function applyCheckedInSession(
  session: ActivitySession,
  setters: {
    setCheckedIn: (v: boolean) => void;
    setOnBreak: (v: boolean) => void;
    setCheckInAt: (v: string | null) => void;
    setCheckOutAt: (v: string | null) => void;
    setSessionStartedAt: (v: number | null) => void;
    setWorkedMs: (v: number) => void;
  },
) {
  setters.setCheckedIn(true);
  setters.setOnBreak(false);
  setters.setCheckInAt(clockLabel(session.startedAt));
  setters.setCheckOutAt(null);
  // Timer continues from original check-in time in DB
  setters.setSessionStartedAt(new Date(session.startedAt).getTime());
  setters.setWorkedMs(0);
}

export function AttendanceProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = useAuth();

  useEffect(() => {
    activityTracker.configureUser(user ? { id: user.id, orgId: user.orgId } : null);
  }, [user]);
  const [checkedIn, setCheckedIn] = useState(false);
  const [onBreak, setOnBreak] = useState(false);
  const [checkInAt, setCheckInAt] = useState<string | null>(null);
  const [checkOutAt, setCheckOutAt] = useState<string | null>(null);
  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(null);
  const [workedMs, setWorkedMs] = useState(0);
  const [tick, setTick] = useState(0);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [attendanceReady, setAttendanceReady] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [currentApp, setCurrentApp] = useState<string | null>(null);
  const [activityApps, setActivityApps] = useState<AppUsage[]>([]);
  const [activitySession, setActivitySession] = useState<ActivitySession | null>(null);
  const [trackingError, setTrackingError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = activityTracker.subscribe((s) => {
      setTracking(s.tracking);
      setCurrentApp(s.currentApp);
      setActivityApps(s.localApps);
      setActivitySession(s.session);
      setTrackingError(s.error);
    });
    return () => {
      unsub();
    };
  }, []);

  // Restore check-in from DB when app opens / user logs in
  useEffect(() => {
    if (!isAuthenticated) {
      setAttendanceReady(true);
      return;
    }

    let cancelled = false;
    setAttendanceReady(false);

    void (async () => {
      try {
        const status = await getAttendanceStatus();
        if (cancelled) return;

        if (status.checkedIn && status.session) {
          applyCheckedInSession(status.session, {
            setCheckedIn,
            setOnBreak,
            setCheckInAt,
            setCheckOutAt,
            setSessionStartedAt,
            setWorkedMs,
          });
          await activityTracker.resume(status.session);
        } else {
          setCheckedIn(false);
          setOnBreak(false);
          setCheckInAt(null);
          setCheckOutAt(clockLabel(status.checkOutAt));
          setSessionStartedAt(null);
          setWorkedMs(0);
        }
      } catch {
        // Offline: resume from local SQLite session if any
        if (!cancelled && user?.id) {
          const local = await getActiveLocalSession(user.id);
          if (local) {
            applyCheckedInSession(local.session, {
              setCheckedIn,
              setOnBreak,
              setCheckInAt,
              setCheckOutAt,
              setSessionStartedAt,
              setWorkedMs,
            });
            await activityTracker.resume(local.session, local.localId);
          }
        }
      } finally {
        if (!cancelled) setAttendanceReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user?.id]);

  // Logout / unauth: stop local polling only — DB session stays active for resume
  useEffect(() => {
    if (!isAuthenticated) {
      activityTracker.softStop();
      setCheckedIn(false);
      setOnBreak(false);
      setCheckInAt(null);
      setCheckOutAt(null);
      setSessionStartedAt(null);
      setWorkedMs(0);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!checkedIn || onBreak) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [checkedIn, onBreak]);

  const elapsedMs = useMemo(() => {
    void tick;
    if (!checkedIn) return 0;
    const running =
      !onBreak && sessionStartedAt != null ? Date.now() - sessionStartedAt : 0;
    return workedMs + running;
  }, [checkedIn, onBreak, sessionStartedAt, workedMs, tick]);

  const checkIn = useCallback(async () => {
    // Resume if already checked in on server (e.g. app reopen race)
    try {
      const status = await getAttendanceStatus();
      if (status.checkedIn && status.session) {
        applyCheckedInSession(status.session, {
          setCheckedIn,
          setOnBreak,
          setCheckInAt,
          setCheckOutAt,
          setSessionStartedAt,
          setWorkedMs,
        });
        await activityTracker.resume(status.session);
        return;
      }
    } catch {
      /* fall through to start a new session */
    }

    const session = await activityTracker.start();
    if (session) {
      applyCheckedInSession(session, {
        setCheckedIn,
        setOnBreak,
        setCheckInAt,
        setCheckOutAt,
        setSessionStartedAt,
        setWorkedMs,
      });
    } else {
      const now = Date.now();
      setCheckedIn(true);
      setOnBreak(false);
      setCheckInAt(clockLabel(new Date()));
      setCheckOutAt(null);
      setWorkedMs(0);
      setSessionStartedAt(now);
    }
  }, []);

  const checkOut = useCallback(async () => {
    await activityTracker.stop();
    const endedAt = clockLabel(new Date());
    setCheckedIn(false);
    setOnBreak(false);
    setCheckOutAt(endedAt);
    setCheckInAt(null);
    setSessionStartedAt(null);
    setWorkedMs(0);
    setActiveTaskId(null);
  }, []);

  const toggleBreak = useCallback(() => {
    if (!checkedIn) return;
    setOnBreak((wasBreak) => {
      if (!wasBreak) {
        setWorkedMs((prev) =>
          sessionStartedAt != null ? prev + (Date.now() - sessionStartedAt) : prev,
        );
        setSessionStartedAt(null);
        activityTracker.setPaused(true);
        return true;
      }
      setSessionStartedAt(Date.now());
      activityTracker.setPaused(false);
      return false;
    });
  }, [checkedIn, sessionStartedAt]);

  const setActiveTask = useCallback((id: string | null) => {
    setActiveTaskId(id);
  }, []);

  const value = useMemo(
    () => ({
      checkedIn,
      onBreak,
      checkInAt,
      checkOutAt,
      sessionStartedAt,
      workedMs,
      elapsedLabel: formatElapsed(elapsedMs),
      activeTaskId,
      attendanceReady,
      tracking,
      currentApp,
      activityApps,
      activitySession,
      trackingError,
      checkIn,
      checkOut,
      toggleBreak,
      setActiveTask,
    }),
    [
      checkedIn,
      onBreak,
      checkInAt,
      checkOutAt,
      sessionStartedAt,
      workedMs,
      elapsedMs,
      activeTaskId,
      attendanceReady,
      tracking,
      currentApp,
      activityApps,
      activitySession,
      trackingError,
      checkIn,
      checkOut,
      toggleBreak,
      setActiveTask,
    ],
  );

  return (
    <AttendanceContext.Provider value={value}>{children}</AttendanceContext.Provider>
  );
}

export function useAttendance() {
  const ctx = useContext(AttendanceContext);
  if (!ctx) throw new Error('useAttendance must be used within AttendanceProvider');
  return ctx;
}
