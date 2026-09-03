import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { Button } from '@/components/ui/Button';
import {
  peekInviteToken,
  rememberInviteToken,
  takeInviteToken,
} from '@/lib/auth/inviteToken';
import { useAuth } from '@/lib/auth/AuthContext';
import {
  acceptInviteByTokenRequest,
  fetchInvitePreview,
  type InvitePreview,
} from '@/lib/api/workspace';
import { useToast } from '@/lib/toast/ToastContext';
import { useWorkspace } from '@/lib/workspace/WorkspaceContext';

export function InviteAcceptPage() {
  const { user, isAuthenticated, isBootstrapping, logout } = useAuth();
  const { refresh, declineInvite, setActiveProjectId } = useWorkspace();
  const toast = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token')?.trim() || peekInviteToken();

  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (token) rememberInviteToken(token);
  }, [token]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchInvitePreview(token);
        if (!cancelled) {
          setPreview(data.invite);
          setLoadError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Invite is invalid or expired');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (isBootstrapping) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-ink-950 text-sm text-ink-300">
        Restoring session…
      </div>
    );
  }

  if (!token) {
    return <Navigate to={isAuthenticated ? '/' : '/login'} replace />;
  }

  const invitedEmail = preview?.email.toLowerCase() ?? '';
  const signedInEmail = user?.email.toLowerCase() ?? '';
  const emailMatches = Boolean(invitedEmail && signedInEmail && invitedEmail === signedInEmail);

  async function onAccept() {
    if (!token) return;
    setBusy(true);
    try {
      const { project } = await acceptInviteByTokenRequest(token);
      takeInviteToken();
      await refresh();
      setActiveProjectId(project.id);
      toast.success(`You joined ${project.name}.`);
      navigate(`/board?project=${encodeURIComponent(project.id)}`, { replace: true });
    } catch (err) {
      toast.fromError(err, 'Could not accept invite');
    } finally {
      setBusy(false);
    }
  }

  async function onDecline() {
    if (!preview) return;
    setBusy(true);
    try {
      await declineInvite(preview.id);
      takeInviteToken();
      toast.info('Invite declined.');
      navigate('/', { replace: true });
    } catch (err) {
      toast.fromError(err, 'Could not decline invite');
    } finally {
      setBusy(false);
    }
  }

  async function onSwitchAccount() {
    rememberInviteToken(token);
    await logout();
    navigate(`/login?invite=${encodeURIComponent(token)}`, { replace: true });
  }

  if (loadError) {
    return (
      <AuthLayout title="Invite unavailable" subtitle={loadError}>
        <p className="text-sm text-ink-300">
          Ask the project admin to send a new invite, or sign in if you already joined.
        </p>
        <div className="mt-4">
          <Link to={isAuthenticated ? '/' : '/login'}>
            <Button size="sm">{isAuthenticated ? 'Go to My Work' : 'Sign in'}</Button>
          </Link>
        </div>
      </AuthLayout>
    );
  }

  if (!preview) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-ink-950 text-sm text-ink-300">
        Loading invite…
      </div>
    );
  }

  return (
    <AuthLayout
      title="You’re invited"
      subtitle={`${preview.inviterName} invited you to ${preview.projectName} as ${preview.role}.`}
    >
      <div className="mb-5 border-l-2 border-brand-400 pl-3.5">
        <p className="text-[11px] font-semibold tracking-wide text-brand-300 uppercase">
          Project invite
        </p>
        <p className="mt-1 text-sm font-medium text-ink-50">{preview.projectName}</p>
        <p className="mt-0.5 text-xs text-ink-300">
          For {preview.email} · Role · {preview.role}
        </p>
      </div>

      <p className="mb-4 text-sm leading-relaxed text-ink-300">
        You will not see the board until you Accept. Pending invites do not add you automatically.
      </p>

      {isAuthenticated && emailMatches ? (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={busy} onClick={() => void onAccept()}>
            {busy ? 'Joining…' : 'Accept invite'}
          </Button>
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => void onDecline()}>
            Decline
          </Button>
        </div>
      ) : isAuthenticated && !emailMatches ? (
        <div className="space-y-3">
          <p className="text-sm text-ink-300">
            You’re signed in as <span className="font-medium text-ink-50">{user?.email}</span>. This
            invite is for <span className="font-medium text-ink-50">{preview.email}</span>.
          </p>
          <Button size="sm" onClick={() => void onSwitchAccount()}>
            Switch account
          </Button>
        </div>
      ) : preview.hasAccount ? (
        <div className="space-y-3">
          <p className="text-sm text-ink-300">Sign in with {preview.email} to accept.</p>
          <Link to={`/login?invite=${encodeURIComponent(token)}`}>
            <Button size="sm">Sign in to accept</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-ink-300">
            Create an account with {preview.email}. Signing up accepts this invite.
          </p>
          <Link to={`/register?invite=${encodeURIComponent(token)}`}>
            <Button size="sm">Create account</Button>
          </Link>
          <p className="text-xs text-ink-400">
            Already have an account?{' '}
            <Link
              to={`/login?invite=${encodeURIComponent(token)}`}
              className="font-semibold text-brand-300 hover:text-brand-200"
            >
              Sign in
            </Link>
          </p>
        </div>
      )}
    </AuthLayout>
  );
}
