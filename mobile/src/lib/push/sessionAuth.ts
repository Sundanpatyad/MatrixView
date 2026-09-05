import { configureApiAuth, hasAccessToken } from '@/lib/api/client';
import { refreshRequest } from '@/lib/api/auth';
import { loadSession, saveSession } from '@/lib/storage/authStorage';

/** Wire API auth from disk when a shade action runs before AuthContext mounts. */
export async function ensureSessionAuth(): Promise<boolean> {
  if (hasAccessToken()) return true;

  const stored = await loadSession();
  if (!stored) return false;

  let accessToken = stored.accessToken;
  let refreshToken = stored.refreshToken;

  configureApiAuth({
    getAccessToken: () => accessToken,
    refreshAccessToken: async () => {
      const payload = await refreshRequest(refreshToken);
      accessToken = payload.accessToken;
      refreshToken = payload.refreshToken;
      await saveSession({
        accessToken,
        refreshToken,
        user: payload.user,
      });
      return accessToken;
    },
  });

  return true;
}
