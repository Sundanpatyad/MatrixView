import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/lib/auth/AuthContext';

export function TwoFactorPage() {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError('Enter a valid 6-digit code.');
      return;
    }
    if (!isAuthenticated) {
      login({
        id: 'u_1',
        name: 'Neha Sharma',
        email: 'neha@acme.dev',
        orgName: 'Acme Studio',
        role: 'Admin',
      });
    }
    navigate('/dashboard');
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold text-ink-900">
        Two-factor authentication
      </h1>
      <p className="mt-2 text-sm text-ink-500">
        Enter the 6-digit code from your authenticator app.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <FormField label="Code" htmlFor="totp">
          <Input
            id="totp"
            inputMode="numeric"
            maxLength={6}
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className="tracking-[0.35em]"
            required
          />
        </FormField>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <Button type="submit" className="w-full">
          Verify
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
