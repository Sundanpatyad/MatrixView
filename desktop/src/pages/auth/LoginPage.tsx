import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import {
  AuthDivider,
  AuthField,
  AuthInput,
  AuthLayout,
} from '@/components/auth/AuthLayout';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/lib/auth/AuthContext';
import { openGoogleSignIn } from '@/lib/auth/googleSignIn';
import { useToast } from '@/lib/toast/ToastContext';

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export function LoginPage() {
  const { login, applySession, isAuthenticated, isBootstrapping } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [browserHint, setBrowserHint] = useState(false);

  if (isBootstrapping) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-ink-950 text-sm text-ink-300">
        Restoring session…
      </div>
    );
  }

  if (isAuthenticated) return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      toast.fromError(err, 'Unable to sign in');
    } finally {
      setLoading(false);
    }
  }

  async function onGoogleSignIn() {
    // Browser opens for account pick; desktop waits on a local loopback redirect.
    try {
      setBrowserHint(true);
      toast.info('Finish signing in with Google in your browser, then return to DockX.');
      const result = await openGoogleSignIn();
      if (result.mode === 'desktop') {
        applySession(result.auth);
        navigate('/');
        return;
      }
      // web redirect — callback page finishes the session
    } catch (err) {
      setBrowserHint(false);
      toast.fromError(err, 'Unable to sign in with Google');
    }
  }

  const busy = loading;

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to continue to your workspace."
      footer={
        <p className="text-sm text-ink-300">
          New to DockX?{' '}
          <Link
            to="/register"
            className="font-semibold text-brand-300 transition hover:text-brand-200"
          >
            Create an account
          </Link>
        </p>
      }
    >
      <div className="space-y-5">
        <Button
          type="button"
          variant="secondary"
          size="lg"
          className="h-11 w-full rounded-xl"
          disabled={busy}
          onClick={() => void onGoogleSignIn()}
        >
          <GoogleIcon className="h-[18px] w-[18px] shrink-0" />
          Continue with Google
        </Button>
        {browserHint ? (
          <p className="text-center text-[12px] leading-relaxed text-ink-400">
            Browser opened — choose your Google account there. DockX will continue when you
            return.
          </p>
        ) : null}

        <AuthDivider />

        <form onSubmit={onSubmit} className="space-y-4">
          <AuthField id="email" label="Email">
            <AuthInput
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
              placeholder="you@company.com"
              autoFocus
              disabled={busy}
            />
          </AuthField>

          <AuthField id="password" label="Password">
            <div className="relative">
              <AuthInput
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="Enter your password"
                className="pr-16"
                disabled={busy}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-md px-2 py-1 text-[12px] font-medium text-ink-300 transition hover:text-ink-50"
                disabled={busy}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </AuthField>

          <Button
            type="submit"
            size="lg"
            className="mt-1 h-11 w-full rounded-xl"
            disabled={busy}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </div>
    </AuthLayout>
  );
}
