import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { startGoogleDeepLinkListener } from '@/lib/auth/googleDeepLink';

/**
 * When Google OAuth finishes in the system browser, the OS opens
 * `dockx:///auth/google/callback?code=…` and we route into the app callback page.
 * Loading / exchange happens only after that return — not on the login button.
 */
export function GoogleDeepLinkBridge() {
  const navigate = useNavigate();

  useEffect(() => {
    let stop: (() => void) | undefined;
    void startGoogleDeepLinkListener(({ code, error }) => {
      const params = new URLSearchParams();
      if (code) params.set('code', code);
      if (error) params.set('error', error);
      navigate(`/auth/google/callback?${params.toString()}`, { replace: true });
    }).then((unlisten) => {
      stop = unlisten;
    });
    return () => stop?.();
  }, [navigate]);

  return null;
}
