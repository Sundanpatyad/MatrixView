import { useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { useToast, type ToastAction } from '@/lib/toast/ToastContext';
import {
  checkForAppUpdate,
  clearUpdateReminder,
  currentAppVersion,
  installAppUpdate,
  msUntilUpdateReminder,
  relaunchApp,
  snoozeUpdateReminder,
  updateReminderDue,
  updaterEnabled,
  type AppUpdateInfo,
} from '@/lib/updater';
import { bindManualUpdateCheck, setUpdateCheckBusy } from '@/components/updater/useManualUpdateCheck';

type CheckOpts = {
  manual?: boolean;
  onLogin?: boolean;
  fromReminder?: boolean;
};

function upToDateMessage(version: string | null) {
  if (version) return `Updated now — DockX ${version} is the latest version.`;
  return "Updated now — you're on the latest version.";
}

export function UpdatePrompt() {
  const toast = useToast();
  const { isAuthenticated, isBootstrapping } = useAuth();
  const infoRef = useRef<AppUpdateInfo | null>(null);
  const toastIdRef = useRef('');
  const installingRef = useRef(false);
  const remindTimerRef = useRef(0);
  const loginCheckedRef = useRef(false);
  const toastApiRef = useRef(toast);
  toastApiRef.current = toast;

  const ensureToast = useCallback(
    (message: string, opts: NonNullable<Parameters<typeof toast.push>[1]>) => {
      const id = toastIdRef.current;
      const patch = typeof opts === 'string' ? { tone: opts } : opts;
      if (id) {
        toast.update(id, { message, ...patch });
        return id;
      }
      const next = toast.push(message, opts);
      toastIdRef.current = next;
      return next;
    },
    [toast],
  );

  const finishToast = useCallback(
    (id: string, message: string, tone: 'success' | 'error' | 'info' = 'success') => {
      if (toastIdRef.current === id) toastIdRef.current = '';
      toast.update(id, {
        message,
        tone,
        loading: false,
        progress: null,
        actions: [],
        sticky: false,
        durationMs: tone === 'error' ? 5500 : 4200,
      });
    },
    [toast],
  );

  const runCheckRef = useRef<(opts?: CheckOpts) => Promise<void>>(async () => {});

  const armReminder = useCallback(() => {
    window.clearTimeout(remindTimerRef.current);
    const wait = msUntilUpdateReminder();
    if (wait <= 0) return;
    remindTimerRef.current = window.setTimeout(() => {
      void runCheckRef.current({ fromReminder: true });
    }, wait);
  }, []);

  const remindLater = useCallback(() => {
    snoozeUpdateReminder();
    const id = toastIdRef.current;
    toastIdRef.current = '';
    if (id) {
      toast.update(id, {
        message: "We'll remind you in 1 hour.",
        tone: 'info',
        loading: false,
        progress: null,
        actions: [],
        sticky: false,
        durationMs: 3500,
      });
    }
    armReminder();
  }, [armReminder, toast]);

  const installNow = useCallback(async () => {
    const current = infoRef.current;
    if (!current || installingRef.current) return;
    installingRef.current = true;
    setUpdateCheckBusy(true);
    clearUpdateReminder();

    const id = ensureToast(`Downloading DockX ${current.version}…`, {
      tone: 'info',
      sticky: true,
      loading: true,
      progress: 2,
      actions: [],
    });

    let displayed = 2;
    let target = 2;
    let raf = 0;
    let running = true;
    const tick = () => {
      if (!running) return;
      if (displayed < target) {
        displayed = Math.min(target, displayed + Math.max(0.16, (target - displayed) * 0.035));
        toastApiRef.current.update(id, {
          progress: Math.round(displayed),
          loading: true,
          sticky: true,
          message:
            displayed >= 99
              ? 'Installing update…'
              : `Downloading DockX ${current.version}… ${Math.round(displayed)}%`,
        });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    try {
      await installAppUpdate(current.raw, (percent) => {
        if (percent > 0) target = Math.max(target, Math.min(99, percent));
        else target = Math.min(90, target + 0.9);
      });
      target = 100;
      await new Promise<void>((resolve) => {
        const wait = () => {
          if (displayed >= 99.2) {
            resolve();
            return;
          }
          requestAnimationFrame(wait);
        };
        wait();
      });
      running = false;
      cancelAnimationFrame(raf);
      toast.update(id, {
        message: 'Update installed. Restarting…',
        tone: 'success',
        loading: true,
        progress: 100,
        actions: [],
        sticky: true,
      });
      await relaunchApp();
    } catch (err) {
      running = false;
      cancelAnimationFrame(raf);
      installingRef.current = false;
      setUpdateCheckBusy(false);
      finishToast(
        id,
        err instanceof Error ? err.message : 'Could not install the update.',
        'error',
      );
    }
  }, [ensureToast, finishToast, toast]);

  const showAvailable = useCallback(
    (info: AppUpdateInfo) => {
      infoRef.current = info;
      const actions: ToastAction[] = [
        { label: 'Remind me later', variant: 'secondary', onClick: remindLater },
        { label: 'Install now', variant: 'primary', onClick: () => void installNow() },
      ];
      ensureToast(`DockX ${info.version} is ready to install.`, {
        tone: 'info',
        sticky: true,
        loading: false,
        progress: null,
        actions,
      });
    },
    [ensureToast, installNow, remindLater],
  );

  const runCheck = useCallback(
    async (opts: CheckOpts = {}) => {
      if (installingRef.current) return;

      const showLoading = Boolean(opts.manual);
      const startedAt = Date.now();
      let id = toastIdRef.current;
      if (showLoading) {
        setUpdateCheckBusy(true);
        id = ensureToast('Checking for updates…', {
          tone: 'info',
          sticky: true,
          loading: true,
          progress: null,
          actions: [],
        });
      }

      const waitForLoading = async () => {
        if (!showLoading) return;
        const elapsed = Date.now() - startedAt;
        if (elapsed < 750) {
          await new Promise((resolve) => window.setTimeout(resolve, 750 - elapsed));
        }
      };

      try {
        if (!updaterEnabled()) {
          await waitForLoading();

          if (opts.manual || opts.onLogin) {
            const version = await currentAppVersion();
            const message = upToDateMessage(version);
            if (id) finishToast(id, message);
            else toast.success(message);
          }
          return;
        }

        const next = await checkForAppUpdate();
        await waitForLoading();
        infoRef.current = next;

        if (!next) {
          if (opts.manual || opts.onLogin) {
            const version = await currentAppVersion();
            const message = upToDateMessage(version);
            if (id) finishToast(id, message);
            else toast.success(message);
          } else if (id) {
            toast.dismiss(id);
            toastIdRef.current = '';
          }
          return;
        }

        if (!opts.manual && !opts.fromReminder && !updateReminderDue()) {
          if (id && showLoading) {
            toast.dismiss(id);
            toastIdRef.current = '';
          }
          armReminder();
          return;
        }

        showAvailable(next);
      } catch (err) {
        await waitForLoading();
        const message = err instanceof Error ? err.message : 'Could not check for updates.';
        if (opts.manual) {
          if (id) finishToast(id, message, 'error');
          else toast.error(message);
        } else if (id) {
          toast.dismiss(id);
          toastIdRef.current = '';
        }
      } finally {
        if (!installingRef.current) setUpdateCheckBusy(false);
      }
    },
    [armReminder, ensureToast, finishToast, showAvailable, toast],
  );

  runCheckRef.current = runCheck;

  useEffect(() => {
    bindManualUpdateCheck(() => void runCheckRef.current({ manual: true }));
    return () => bindManualUpdateCheck(null);
  }, []);

  useEffect(() => {
    if (!isAuthenticated || isBootstrapping) {
      loginCheckedRef.current = false;
      return;
    }
    if (loginCheckedRef.current) return;
    loginCheckedRef.current = true;
    const timer = window.setTimeout(() => void runCheckRef.current({ onLogin: true }), 1600);
    return () => window.clearTimeout(timer);
  }, [isAuthenticated, isBootstrapping]);

  useEffect(() => {
    if (!isAuthenticated || isBootstrapping) return;
    armReminder();
    const interval = window.setInterval(() => void runCheckRef.current({}), 6 * 60 * 60 * 1000);
    return () => {
      window.clearTimeout(remindTimerRef.current);
      window.clearInterval(interval);
    };
  }, [armReminder, isAuthenticated, isBootstrapping]);

  return null;
}
