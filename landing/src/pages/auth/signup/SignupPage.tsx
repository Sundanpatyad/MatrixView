import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/lib/auth/AuthContext';

export function SignupPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [orgName, setOrgName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 10) {
      setError('Password must be at least 10 characters.');
      return;
    }
    login({
      id: 'u_new',
      name: fullName || 'Org Owner',
      email,
      orgName: orgName || 'My Organization',
      role: 'Org Owner',
    });
    navigate('/org/setup');
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold text-ink-900">Sign up</h1>
      <p className="mt-2 text-sm text-ink-500">
        Create your organization and become its first owner.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <FormField label="Full name" htmlFor="fullName">
          <Input
            id="fullName"
            autoComplete="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
        </FormField>
        <FormField label="Work email" htmlFor="email">
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </FormField>
        <FormField label="Organization name" htmlFor="orgName">
          <Input
            id="orgName"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            required
          />
        </FormField>
        <FormField
          label="Password"
          htmlFor="password"
          hint="Min 10 chars, with upper, lower, and a number."
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

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <Button type="submit" className="w-full">
          Create account
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-500">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-brand-700 hover:text-brand-800">
          Log in
        </Link>
      </p>
    </div>
  );
}
