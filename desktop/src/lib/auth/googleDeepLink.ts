import { isTauriApp } from '@/lib/webrtc/screenShare';
import { parseGoogleCallbackUrl } from '@/lib/auth/googleSignIn';

type Handler = (payload: { code: string | null; error: string | null }) => void;

let started = false;

/** Listen for DockX deep links after Google finishes in the system browser. */
export async function startGoogleDeepLinkListener(onCallback: Handler): Promise<() => void> {
  if (!isTauriApp() || started) return () => undefined;
  started = true;

  const { onOpenUrl } = await import('@tauri-apps/plugin-deep-link');
  const unlisten = await onOpenUrl((urls) => {
    for (const raw of urls) {
      if (!raw.includes('auth/google')) continue;
      onCallback(parseGoogleCallbackUrl(raw));
    }
  });

  return () => {
    started = false;
    unlisten();
  };
}
