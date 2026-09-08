import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { Button } from '@/components/ui/Button';
import { postAuthPath } from '@/lib/auth/inviteToken';
import { useAuth, getRememberPref } from '@/lib/auth/AuthContext';
import { loginWithGoogleIdToken } from '@/lib/auth/googleSignIn';

function readCallback() {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const query = new URLSearchParams(window.location.search);
  return {
    idToken: hash.get('id_token') || query.get('id_token'),
    code: query.get('code') || hash.get('code'),
    error: query.get('error') || hash.get('error'),
    errorDescription: query.get('error_description') || hash.get('error_description'),
  };
}

export function GoogleCallbackPage() {
  const { completeOAuth, applySession, isAuthenticated, isBootstrapping } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [exchanging, setExchanging] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (isBootstrapping || started.current) return;
    started.current = true;

    const { idToken, code, error: oauthError, errorDescription } = readCallback();

    if (oauthError) {
      setError(
        oauthError === 'access_denied'
          ? 'Google sign-in was cancelled.'
          : oauthError.includes('redirect_uri') || (errorDescription || '').includes('redirect_uri')
            ? 'Google redirect URI mismatch. In Google Cloud Console, open the Web application client and add this site’s /auth/google/callback URL under Authorized redirect URIs.'
            : `Google sign-in failed (${oauthError}).`,
      );
      return;
    }

    if (idToken) {
      setExchanging(true);
      void (async () => {
        try {
          const auth = await loginWithGoogleIdToken(idToken, getRememberPref());
          applySession(auth, getRememberPref());
          window.history.replaceState(null, '', '/auth/google/callback');
          navigate(postAuthPath(), { replace: true });
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Google sign-in failed.');
        } finally {
          setExchanging(false);
        }
      })();
      return;
    }

    if (!code) {
      setError('Missing Google sign-in code. Try again from the login page.');
      return;
    }

    setExchanging(true);
    void (async () => {
      try {
        await completeOAuth(code);
        navigate(postAuthPath(), { replace: true });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Google sign-in failed.');
      } finally {
        setExchanging(false);
      }
    })();
  }, [applySession, completeOAuth, isBootstrapping, navigate]);

  if (isBootstrapping || exchanging) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-2 bg-ink-950 px-6 text-center text-sm text-ink-300">
        <p>Completing Google sign-in…</p>
      </div>
    );
  }

  if (isAuthenticated && !error) return <Navigate to={postAuthPath()} replace />;

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
