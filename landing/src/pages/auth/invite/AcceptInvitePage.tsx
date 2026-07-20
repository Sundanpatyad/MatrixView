import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/lib/auth/AuthContext';

export function AcceptInvitePage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 10) {
      setError('Password must be at least 10 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    login({
      id: 'u_invite',
      name: 'Riya Patel',
      email: 'riya@acme.dev',
      orgName: 'Acme Studio',
      role: 'Employee',
    });
    navigate('/dashboard');
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold text-ink-900">Accept invite</h1>
      <p className="mt-2 text-sm text-ink-500">
        You&apos;ve been invited to join <span className="font-medium text-ink-700">Acme Studio</span>.
        Set a password to continue.
      </p>
      <p className="mt-2 text-xs text-ink-400">Invite token: {token ?? '—'}</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <FormField label="Password" htmlFor="password">
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </FormField>
        <FormField label="Confirm password" htmlFor="confirm">
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </FormField>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <Button type="submit" className="w-full">
          Join organization
        </Button>
      </form>
    </div>
  );
}
