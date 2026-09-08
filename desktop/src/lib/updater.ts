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

export function updaterEnabled() {
  return isTauriRuntime() && import.meta.env.PROD;
}

export async function checkForAppUpdate(): Promise<AppUpdateInfo | null> {
  if (!updaterEnabled()) return null;
  const currentVersion = await getVersion();
  const update = await check();
  if (!update) return null;
  return {
    currentVersion,
    version: update.version,
    body: update.body ?? '',
    date: update.date ?? null,
    raw: update,
  };
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
