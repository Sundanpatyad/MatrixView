import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/lib/auth/AuthContext';
import { dockxGoogleDeepLink } from '@/lib/auth/googleSignIn';
import { isTauriApp } from '@/lib/webrtc/screenShare';

export function GoogleCallbackPage() {
  const { completeOAuth, isAuthenticated, isBootstrapping } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [exchanging, setExchanging] = useState(false);
  const [browserHandoff, setBrowserHandoff] = useState(false);
  const code = searchParams.get('code');
  const oauthError = searchParams.get('error');

  useEffect(() => {
    if (isBootstrapping) return;

    if (oauthError) {
      setError(
        oauthError === 'access_denied'
          ? 'Google sign-in was cancelled.'
          : oauthError.includes('redirect_uri')
            ? 'Google redirect URI mismatch. Add http://localhost:4000/api/auth/google/callback on a Web OAuth client.'
            : `Google sign-in failed (${oauthError}).`,
      );
      return;
    }
    if (!code) {
      setError('Missing Google sign-in code. Try again from the login page.');
      return;
    }

    // Google finished in the system browser — hand the one-time code to DockX.
    // Do not exchange here first (code is single-use).
    if (!isTauriApp()) {
      setBrowserHandoff(true);
      window.location.href = dockxGoogleDeepLink(code);
      return;
    }

    let cancelled = false;
    setExchanging(true);
    void (async () => {
      try {
        await completeOAuth(code);
        if (!cancelled) navigate('/', { replace: true });
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Google sign-in failed.');
        }
      } finally {
        if (!cancelled) setExchanging(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [code, completeOAuth, isBootstrapping, navigate, oauthError]);

  async function finishInBrowser() {
    if (!code) return;
    setExchanging(true);
    setError(null);
    try {
      await completeOAuth(code);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed.');
    } finally {
      setExchanging(false);
    }
  }

  if (isBootstrapping || exchanging) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-2 bg-ink-950 px-6 text-center text-sm text-ink-300">
        <p>Completing Google sign-in…</p>
      </div>
    );
  }

  if (browserHandoff && !error) {
    return (
      <AuthLayout
        title="Open DockX"
        subtitle="Google sign-in finished. Continue in the DockX app."
      >
        <p className="text-sm text-ink-300">
          If macOS asks to open DockX, choose Open. Then return to the DockX window.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {code ? (
            <a href={dockxGoogleDeepLink(code)}>
              <Button size="sm">Open DockX</Button>
            </a>
          ) : null}
          <Button size="sm" variant="secondary" onClick={() => void finishInBrowser()}>
            Continue in this browser
          </Button>
        </div>
        <Link to="/login" className="mt-4 inline-block text-xs text-ink-400 underline">
          Back to sign in
        </Link>
      </AuthLayout>
    );
  }

  if (isAuthenticated && !error) return <Navigate to="/" replace />;

  if (error) {
    return (
      <AuthLayout title="Google sign-in" subtitle="Something went wrong.">
        <p className="text-sm text-ink-300">{error}</p>
        <Link to="/login" className="mt-4 inline-block">
          <Button size="sm">Back to sign in</Button>
        </Link>
      </AuthLayout>
    );
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-ink-950 text-sm text-ink-300">
      Completing Google sign-in…
    </div>
  );
}
