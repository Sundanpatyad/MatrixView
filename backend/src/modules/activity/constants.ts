/** Active check-in is closed automatically this long after `startedAt`. */
export const MAX_SESSION_DURATION_MS = 24 * 60 * 60 * 1000;

/** How often the process sweeps leftover overnight sessions. */
export const SESSION_EXPIRY_SWEEP_MS = 60_000;
