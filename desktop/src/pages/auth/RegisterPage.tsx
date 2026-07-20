import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useAuth } from '@/lib/auth/AuthContext';
import { ApiError, apiFetch } from '@/lib/api/client';

type InvitePreview = {
  email: string;
  name: string;
  role: string;
  projectName: string;
  orgName: string;
  expiresAt: string;
};

export function RegisterPage() {
  const { register, isAuthenticated, isBootstrapping } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const inviteToken = params.get('invite')?.trim() || '';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [invite, setInvite] = useState<InvitePreview | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!inviteToken) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch<{ invite: InvitePreview }>(
          `/api/auth/invites/${encodeURIComponent(inviteToken)}`,
        );
        if (cancelled) return;
        setInvite(data.invite);
        setEmail(data.invite.email);
        if (data.invite.name) setName(data.invite.name);
      } catch (err) {
        if (!cancelled) {
          setInviteError(err instanceof ApiError ? err.message : 'Invite is invalid or expired');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [inviteToken]);

  if (isBootstrapping) {
    return (
      <div className="atmosphere flex min-h-screen items-center justify-center text-sm text-ink-300">
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
      await register({
        name,
        email,
        password,
        inviteToken: inviteToken || undefined,
      });
      navigate('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to create account');
    } finally {
      setLoading(false);
    }
  }

  const isInvite = Boolean(inviteToken);

  return (
    <div className="atmosphere relative flex min-h-screen items-center justify-center px-6">
      <ThemeToggle className="absolute top-5 right-5" />
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="DockX"
            className="h-12 w-12 rounded-xl object-cover shadow-sm shadow-brand-500/25"
          />
          <div>
            <p className="font-display text-3xl font-semibold text-ink-50">DockX</p>
            <h1 className="text-lg font-semibold text-ink-100">
              {isInvite ? 'Join project' : 'Create your account'}
            </h1>
          </div>
        </div>
        <p className="mt-3 text-sm text-ink-300">
          {isInvite
            ? invite
              ? `You’ve been invited to ${invite.projectName} as ${invite.role}. Create your account to get in.`
              : inviteError || 'Loading invite…'
            : 'Sign up free — create projects and invite teammates as admin or member.'}
        </p>

        {isInvite && inviteError ? (
          <p className="mt-6 text-sm text-[#ed4245]">
            {inviteError}{' '}
            <Link to="/register" className="font-medium text-brand-400 underline">
              Sign up without invite
            </Link>{' '}
            instead.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <div>
              <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-ink-200">
                Your name
              </label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-ink-200">
                Email
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                readOnly={isInvite}
                className={isInvite ? 'bg-ink-900' : undefined}
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-ink-200">
                Password
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            {error ? <p className="text-sm text-[#ed4245]">{error}</p> : null}
            <Button
              type="submit"
              className="w-full"
              disabled={loading || (isInvite && !invite)}
            >
              {loading ? 'Creating…' : isInvite ? 'Join project' : 'Create account'}
            </Button>
          </form>
        )}
        <p className="mt-4 text-center text-sm text-ink-300">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-brand-400 underline-offset-2 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
