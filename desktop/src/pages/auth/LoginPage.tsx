import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import {
  AuthField,
  AuthInput,
  AuthLayout,
} from '@/components/auth/AuthLayout';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/lib/auth/AuthContext';
import { useToast } from '@/lib/toast/ToastContext';

export function LoginPage() {
  const { login, isAuthenticated, isBootstrapping } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

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

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to continue to your workspace. You’ll stay signed in on this device."
      footer={
        <p className="text-center text-sm text-ink-300">
          New to DockX?{' '}
          <Link
            to="/register"
            className="font-semibold text-brand-300 transition hover:text-brand-400"
          >
            Create an account
          </Link>
        </p>
      }
    >
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
              className="pr-20"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded-lg px-2.5 py-1 text-[12px] font-semibold text-ink-300 transition hover:bg-ink-700 hover:text-ink-50"
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </AuthField>

        <Button type="submit" size="lg" className="mt-1 w-full rounded-xl" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      <p className="mt-5 rounded-xl border border-ink-600 bg-ink-900/60 px-3.5 py-2.5 text-center text-[11px] leading-relaxed text-ink-400">
        Demo · <span className="font-medium text-ink-300">riya@acme.dev</span> /{' '}
        <span className="font-medium text-ink-300">Password123</span>
      </p>
    </AuthLayout>
  );
}
