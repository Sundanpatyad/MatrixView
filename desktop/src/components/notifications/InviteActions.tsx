import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import type { AppNotification } from '@/lib/api/notifications';
import { useToast } from '@/lib/toast/ToastContext';
import { useWorkspace } from '@/lib/workspace/WorkspaceContext';

export function inviteIdOf(notification: AppNotification): string | null {
  const raw = notification.meta?.inviteId;
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
}

function metaString(notification: AppNotification, key: string): string | null {
  const raw = notification.meta?.[key];
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
}

export function InviteActions({
  notification,
  onResolved,
  compact = false,
}: {
  notification: AppNotification;
  onResolved?: () => void;
  compact?: boolean;
}) {
  const { pendingInvites, acceptInvite, declineInvite, setActiveProjectId } = useWorkspace();
  const toast = useToast();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null);
  const [resolved, setResolved] = useState(false);

  const inviteId = inviteIdOf(notification);
  const pending = inviteId ? pendingInvites.find((invite) => invite.id === inviteId) : undefined;
  const projectName =
    pending?.projectName || metaString(notification, 'projectName') || 'this project';
  const inviterName =
    pending?.inviterName ||
    metaString(notification, 'inviterName') ||
    notification.actorName ||
    'A teammate';
  const role = pending?.role || metaString(notification, 'role') || 'member';

  if (notification.type !== 'project.invited') return null;

  if (!inviteId || resolved) {
    return (
      <p className={cn('text-ink-400', compact ? 'text-[11px]' : 'mt-4 text-sm')}>
        This invite is no longer pending.
      </p>
    );
  }

  async function onAccept() {
    if (!inviteId) return;
    setBusy('accept');
    try {
      const project = await acceptInvite(inviteId);
      setActiveProjectId(project.id);
      toast.success(`You joined ${project.name}.`);
      setResolved(true);
      onResolved?.();
      navigate(`/board?project=${encodeURIComponent(project.id)}`);
    } catch (err) {
      toast.fromError(err, 'Could not accept invite');
    } finally {
      setBusy(null);
    }
  }

  async function onDecline() {
    if (!inviteId) return;
    setBusy('decline');
    try {
      await declineInvite(inviteId);
      toast.info('Invite declined.');
      setResolved(true);
      onResolved?.();
    } catch (err) {
      toast.fromError(err, 'Could not decline invite');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div
      className={cn(
        'rounded-xl border border-[#f0b232]/35 bg-[#f0b232]/8',
        compact ? 'px-3 py-2' : 'p-4',
      )}
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
    >
      {compact ? null : <p className="text-sm font-semibold text-ink-50">{projectName}</p>}
      <p className={cn('text-ink-400', compact ? 'text-[11px] leading-4' : 'mt-0.5 text-xs')}>
        {inviterName} invited you{compact ? ` to ${projectName}` : ''} as {role}.
      </p>
      <div className={cn('flex flex-wrap gap-2', compact ? 'mt-2' : 'mt-3')}>
        <Button type="button" size={compact ? 'xs' : 'sm'} disabled={Boolean(busy)} onClick={() => void onAccept()}>
          {busy === 'accept' ? '…' : 'Accept'}
        </Button>
        <Button
          type="button"
          size={compact ? 'xs' : 'sm'}
          variant="secondary"
          disabled={Boolean(busy)}
          onClick={() => void onDecline()}
        >
          {busy === 'decline' ? '…' : 'Decline'}
        </Button>
      </div>
    </div>
  );
}
