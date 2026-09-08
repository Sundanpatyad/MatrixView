import { getVersion } from '@tauri-apps/api/app';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { isTauriRuntime } from '@/lib/activity/native';

export type AppUpdateInfo = {
  currentVersion: string;
  version: string;
  body: string;
  date: string | null;
  raw: Update;
};

let updateListener: ((info: AppUpdateInfo | null) => void) | null = null;

export function subscribeToAppUpdate(listener: (info: AppUpdateInfo | null) => void) {
  updateListener = listener;
  return () => {
    if (updateListener === listener) updateListener = null;
  };
}

export function publishAppUpdate(info: AppUpdateInfo | null) {
  updateListener?.(info);
}

const REMIND_KEY = 'dockx.update.remindAt';
export const UPDATE_REMIND_MS = 60 * 60 * 1000;

export function updaterEnabled() {
  return isTauriRuntime();
}

export async function currentAppVersion(): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  try {
    return await getVersion();
  } catch {
    return null;
  }
}

export function snoozeUpdateReminder(ms = UPDATE_REMIND_MS) {
  try {
    localStorage.setItem(REMIND_KEY, String(Date.now() + ms));
  } catch {
    /* ignore quota */
  }
}

export function clearUpdateReminder() {
  try {
    localStorage.removeItem(REMIND_KEY);
  } catch {
    /* ignore */
  }
}

export function msUntilUpdateReminder(): number {
  try {
    const raw = localStorage.getItem(REMIND_KEY);
    if (!raw) return 0;
    const at = Number(raw);
    if (!Number.isFinite(at)) return 0;
    return Math.max(0, at - Date.now());
  } catch {
    return 0;
  }
}

export function updateReminderDue() {
  return msUntilUpdateReminder() === 0;
}

export async function checkForAppUpdate(): Promise<AppUpdateInfo | null> {
  if (!updaterEnabled()) return null;
  const currentVersion = await getVersion();
  try {
    const update = await check();
    if (!update) return null;
    return {
      currentVersion,
      version: update.version,
      body: update.body ?? '',
      date: update.date ?? null,
      raw: update,
    };
  } catch (err) {
    if (isMissingUpdateManifest(err)) return null;
    throw err;
  }
}

function isMissingUpdateManifest(err: unknown) {
  const message = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    message.includes('successful status') ||
    message.includes('404') ||
    message.includes('not found') ||
    message.includes('could not fetch') ||
    message.includes('latest.json')
  );
}

export async function installAppUpdate(
  update: Update,
  onProgress?: (percent: number) => void,
) {
  let downloaded = 0;
  let total = 0;
  await update.downloadAndInstall((event) => {
    if (event.event === 'Started') {
      total = event.data.contentLength ?? 0;
      downloaded = 0;
      onProgress?.(0);
    } else if (event.event === 'Progress') {
      downloaded += event.data.chunkLength;
      if (total > 0) onProgress?.(Math.min(100, Math.round((downloaded / total) * 100)));
    } else if (event.event === 'Finished') {
      onProgress?.(100);
    }
  });
}

export async function relaunchApp() {
  const { relaunch } = await import('@tauri-apps/plugin-process');
  await relaunch();
}
