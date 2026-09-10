import { SESSION_EXPIRY_SWEEP_MS } from './constants.js';
import { closeExpiredSessions } from './service.js';

let timer: ReturnType<typeof setInterval> | null = null;

export function startSessionExpiryJob() {
  const run = () => {
    void closeExpiredSessions()
      .then((count) => {
        if (count > 0) console.log(`[activity] auto-checked out ${count} session(s) after 24h`);
      })
      .catch((err) => {
        console.error('[activity] auto checkout failed', err);
      });
  };

  run();
  if (timer) clearInterval(timer);
  timer = setInterval(run, SESSION_EXPIRY_SWEEP_MS);
  timer.unref?.();
}

export function stopSessionExpiryJob() {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}
