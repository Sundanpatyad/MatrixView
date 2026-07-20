import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';

export function ResetPasswordPage() {
  const navigate = useNavigate();
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
    navigate('/login');
  }

  const strength =
    password.length >= 10 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password)
      ? 'Strong'
      : password.length >= 6
        ? 'Fair'
        : password
          ? 'Weak'
          : '';

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold text-ink-900">Set a new password</h1>
      <p className="mt-2 text-sm text-ink-500">Choose a password you haven&apos;t used here before.</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <FormField
          label="New password"
          htmlFor="password"
          hint={strength ? `Strength: ${strength}` : undefined}
        >
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
          Update password
        </Button>
      </form>

      <p className="mt-6 text-center text-sm">
        <Link to="/login" className="font-semibold text-brand-700">
          Back to log in
        </Link>
      </p>
    </div>
  );
}
