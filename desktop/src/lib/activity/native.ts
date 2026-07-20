import { invoke } from '@tauri-apps/api/core';

export type ForegroundApp = {
  appName: string;
  processName: string;
  windowTitle: string;
  url?: string | null;
  host?: string | null;
  excluded: boolean;
  locked: boolean;
};

export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export async function getForegroundApp(): Promise<ForegroundApp | null> {
  if (!isTauriRuntime()) return null;
  try {
    return await invoke<ForegroundApp>('get_foreground_app');
  } catch {
    return null;
  }
}

export async function isTrackingAvailable(): Promise<boolean> {
  if (!isTauriRuntime()) return false;
  try {
    return await invoke<boolean>('tracking_available');
  } catch {
    return false;
  }
}
