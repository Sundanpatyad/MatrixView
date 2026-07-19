import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSent(true);
  }

  if (sent) {
    return (
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink-900">Check your email</h1>
        <p className="mt-3 text-sm text-ink-500">
          If an account exists for <span className="font-medium text-ink-700">{email}</span>,
          we sent a reset link. It expires in 30 minutes.
        </p>
        <Link to="/reset-password" className="mt-8 inline-block">
          <Button className="w-full min-w-[240px]">Continue to reset (demo)</Button>
        </Link>
        <p className="mt-6 text-center text-sm">
          <Link to="/login" className="font-semibold text-brand-700">
            Back to log in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold text-ink-900">Forgot password</h1>
      <p className="mt-2 text-sm text-ink-500">
        Enter your email and we&apos;ll send a reset link.
      </p>

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
        <Button type="submit" className="w-full">
          Send reset link
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
