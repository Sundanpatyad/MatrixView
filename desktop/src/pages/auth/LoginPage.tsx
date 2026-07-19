import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/lib/auth/AuthContext';
import { ApiError } from '@/lib/api/client';

export function LoginPage() {
  const { login, isAuthenticated, isBootstrapping } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('riya@acme.dev');
  const [password, setPassword] = useState('Password123');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (isBootstrapping) {
    return (
      <div className="atmosphere flex min-h-screen items-center justify-center text-sm text-ink-500">
        Restoring session…
      </div>
    );
  }

  if (isAuthenticated) return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to sign in');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="atmosphere flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <p className="font-display text-3xl font-semibold text-ink-900">TaskTrack</p>
        <h1 className="mt-2 text-lg font-semibold text-ink-800">Desktop Agent</h1>
        <p className="mt-1 text-sm text-ink-500">
          Sign in once — silent login on every launch after this.
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-ink-700">
              Email
            </label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-ink-700">
              Password
            </label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Signing in…' : 'Continue'}
          </Button>
        </form>
        <p className="mt-4 text-center text-xs text-ink-400">
          Demo: riya@acme.dev / Password123
        </p>
        <p className="mt-2 text-center text-sm text-ink-500">
          New org?{' '}
          <Link to="/register" className="font-medium text-teal-700 underline-offset-2 hover:underline">
            Create account
          </Link>
        </p>
      </div>
    </div>
  );
}
