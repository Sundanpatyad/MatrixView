import Database from '@tauri-apps/plugin-sql';
import { isTauriRuntime } from '@/lib/activity/native';

export const OFFLINE_DB_URL = 'sqlite:tasktrack.db';

let dbPromise: Promise<Database | null> | null = null;

export function isOfflineDbAvailable() {
  return isTauriRuntime();
}

export async function getOfflineDb(): Promise<Database | null> {
  if (!isOfflineDbAvailable()) return null;
  if (!dbPromise) {
    dbPromise = Database.load(OFFLINE_DB_URL).catch((err) => {
      console.error('[offline] failed to open SQLite', err);
      dbPromise = null;
      return null;
    });
  }
  return dbPromise;
}

export function newLocalId(prefix: string) {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${rand}`;
}
