import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/lib/auth/AuthContext';

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('neha@acme.dev');
  const [password, setPassword] = useState('Password123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError('Enter email and password.');
      return;
    }
    setLoading(true);
    // Mock auth — no API yet
    window.setTimeout(() => {
      login({
        id: 'u_1',
        name: 'Neha Sharma',
        email,
        orgName: 'Acme Studio',
        role: 'Admin',
      });
      setLoading(false);
      navigate('/dashboard');
    }, 400);
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold text-ink-900">Log in</h1>
      <p className="mt-2 text-sm text-ink-500">Access your TaskTrack management portal.</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <FormField label="Email" htmlFor="email">
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </FormField>
        <FormField label="Password" htmlFor="password">
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </FormField>

        <div className="flex justify-end">
          <Link
            to="/forgot-password"
            className="text-sm font-medium text-brand-700 hover:text-brand-800"
          >
            Forgot password?
          </Link>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Signing in…' : 'Log in'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-500">
        Don&apos;t have an account?{' '}
        <Link to="/signup" className="font-semibold text-brand-700 hover:text-brand-800">
          Sign up
        </Link>
      </p>
      <p className="mt-3 text-center text-xs text-ink-400">
        Demo tip: any email/password works. Toggle 2FA via{' '}
        <Link to="/2fa" className="underline">
          /2fa
        </Link>
        .
      </p>
    </div>
  );
}
