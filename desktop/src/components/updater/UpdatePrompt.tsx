import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { isTauriRuntime } from '@/lib/activity/native';
import {
  checkForAppUpdate,
  installAppUpdate,
  publishAppUpdate,
  relaunchApp,
  subscribeToAppUpdate,
  updaterEnabled,
  type AppUpdateInfo,
} from '@/lib/updater';

export function UpdatePrompt() {
  const [info, setInfo] = useState<AppUpdateInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runCheck = useCallback(async () => {
    if (!updaterEnabled()) return;
    try {
      const next = await checkForAppUpdate();
      setInfo(next);
      setError(null);
    } catch {
      /* offline or no release manifest yet */
    }
  }, []);

  useEffect(() => subscribeToAppUpdate(setInfo), []);

  useEffect(() => {
    if (!updaterEnabled()) return;
    const timer = window.setTimeout(() => void runCheck(), 5000);
    const interval = window.setInterval(() => void runCheck(), 6 * 60 * 60 * 1000);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
    };
  }, [runCheck]);

  if (!info) return null;

  async function install() {
    const current = info;
    if (!current) return;
    setBusy(true);
    setError(null);
    try {
      await installAppUpdate(current.raw, setProgress);
      await relaunchApp();
      await relaunchApp();
    } catch (err) {
      setBusy(false);
      setProgress(null);
      setError(err instanceof Error ? err.message : 'Could not install the update.');
    }
  }

  return (
    <div className="fixed right-4 bottom-4 z-[9000] w-[min(100%-2rem,360px)] border border-ink-600 bg-ink-800 p-4 shadow-lg">
      <p className="text-[10px] font-bold tracking-wide text-ink-400 uppercase">Update available</p>
      <p className="mt-1 text-sm font-semibold text-ink-50">
        DockX {info.version}
        <span className="ml-1.5 font-normal text-ink-400">from {info.currentVersion}</span>
      </p>
      {info.body ? (
        <p className="mt-1.5 line-clamp-3 text-[12px] leading-relaxed text-ink-300">{info.body}</p>
      ) : (
        <p className="mt-1.5 text-[12px] text-ink-300">A new desktop build is ready to install.</p>
      )}
      {progress != null ? (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink-700">
          <div
            className="h-full bg-brand-500 transition-[width]"
            style={{ width: `${progress}%` }}
          />
        </div>
      ) : null}
      {error ? <p className="mt-2 text-[11px] text-[#ed4245]">{error}</p> : null}
      <div className="mt-3 flex justify-end gap-2">
        <Button
          type="button"
          size="xs"
          variant="secondary"
          disabled={busy}
          onClick={() => setInfo(null)}
        >
          Later
        </Button>
        <Button type="button" size="xs" disabled={busy} onClick={() => void install()}>
          {busy ? (progress != null ? `Installing ${progress}%` : 'Installing…') : 'Install & restart'}
        </Button>
      </div>
    </div>
  );
}

export function useManualUpdateCheck() {
  const [busy, setBusy] = useState(false);
  const checkNow = useCallback(async () => {
    if (!isTauriRuntime()) {
      return { ok: false as const, message: 'Updates are only available in the desktop app.' };
    }
    if (!updaterEnabled()) {
      return { ok: true as const, message: 'Update checks run in installed builds, not in dev.' };
    }
    setBusy(true);
    try {
      const next = await checkForAppUpdate();
      if (!next) return { ok: true as const, message: 'You are on the latest version.' };
      publishAppUpdate(next);
      return { ok: true as const, update: next };
    } catch (err) {
      return {
        ok: false as const,
        message: err instanceof Error ? err.message : 'Could not check for updates.',
      };
    } finally {
      setBusy(false);
    }
  }, []);
  return { busy, checkNow };
}
