import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AuthField,
  AuthInput,
  AuthLayout,
} from '@/components/auth/AuthLayout';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/lib/auth/AuthContext';
import { apiFetch } from '@/lib/api/client';
import { useToast } from '@/lib/toast/ToastContext';

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
  const toast = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const inviteToken = params.get('invite')?.trim() || '';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [invite, setInvite] = useState<InvitePreview | null>(null);
  const [inviteBroken, setInviteBroken] = useState(false);
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
          setInviteBroken(true);
          toast.fromError(err, 'Invite is invalid or expired');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [inviteToken]);

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
      await register({
        name,
        email,
        password,
        inviteToken: inviteToken || undefined,
      });
      navigate('/');
    } catch (err) {
      toast.fromError(err, 'Unable to create account');
    } finally {
      setLoading(false);
    }
  }

  const isInvite = Boolean(inviteToken);

  const subtitle = isInvite
    ? invite
      ? `You’ve been invited to ${invite.projectName} as ${invite.role}. Create your account to join.`
      : inviteBroken
        ? 'This invite could not be loaded.'
        : 'Loading your invite…'
    : 'Create a free account to start projects and invite your team.';

  return (
    <AuthLayout
      title={isInvite ? 'Join your project' : 'Create your account'}
      subtitle={subtitle}
      footer={
        <p className="text-center text-sm text-ink-300">
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-semibold text-brand-300 transition hover:text-brand-400"
          >
            Sign in
          </Link>
        </p>
      }
    >
      {isInvite && invite ? (
        <div className="mb-5 rounded-xl border border-brand-500/25 bg-brand-500/10 px-3.5 py-3">
          <p className="text-[11px] font-semibold tracking-wide text-brand-300 uppercase">
            Invite
          </p>
          <p className="mt-1 text-sm font-medium text-ink-50">
            {invite.projectName}
            {invite.orgName ? (
              <span className="font-normal text-ink-300"> · {invite.orgName}</span>
            ) : null}
          </p>
          <p className="mt-0.5 text-xs capitalize text-ink-300">Role · {invite.role}</p>
        </div>
      ) : null}

      {isInvite && inviteBroken ? (
        <div className="space-y-4">
          <p className="text-sm text-ink-300">
            <Link to="/register" className="font-semibold text-brand-300 hover:text-brand-400">
              Sign up without an invite
            </Link>{' '}
            instead.
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <AuthField id="name" label="Full name">
            <AuthInput
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
              placeholder="Alex Rivera"
              autoFocus={!isInvite}
            />
          </AuthField>

          <AuthField
            id="email"
            label="Work email"
            hint={isInvite ? 'From invite' : undefined}
          >
            <AuthInput
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              readOnly={isInvite}
              autoComplete="email"
              placeholder="you@company.com"
            />
          </AuthField>

          <AuthField id="password" label="Password" hint="Min. 8 characters">
            <div className="relative">
              <AuthInput
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="Create a strong password"
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

          <Button
            type="submit"
            size="lg"
            className="mt-1 w-full rounded-xl"
            disabled={loading || (isInvite && !invite)}
          >
            {loading ? 'Creating…' : isInvite ? 'Accept invite' : 'Create account'}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
