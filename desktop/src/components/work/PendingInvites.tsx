import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/lib/toast/ToastContext';
import { useWorkspace } from '@/lib/workspace/WorkspaceContext';

export function PendingInvites() {
  const { pendingInvites, acceptInvite, declineInvite, setActiveProjectId } = useWorkspace();
  const toast = useToast();
  const navigate = useNavigate();
  const [busyId, setBusyId] = useState<string | null>(null);

  if (pendingInvites.length === 0) return null;

  async function onAccept(inviteId: string) {
    setBusyId(inviteId);
    try {
      const project = await acceptInvite(inviteId);
      setActiveProjectId(project.id);
      toast.success(`You joined ${project.name}.`);
      navigate(`/board?project=${encodeURIComponent(project.id)}`);
    } catch (err) {
      toast.fromError(err, 'Could not accept invite');
    } finally {
      setBusyId(null);
    }
  }

  async function onDecline(inviteId: string) {
    setBusyId(inviteId);
    try {
      await declineInvite(inviteId);
      toast.info('Invite declined.');
    } catch (err) {
      toast.fromError(err, 'Could not decline invite');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="rounded-xl border border-[#f0b232]/35 bg-[#f0b232]/8 px-4 py-3">
      <h2 className="text-sm font-semibold text-ink-50">
        {pendingInvites.length === 1 ? 'Project invite' : 'Project invites'}
      </h2>
      <p className="mt-0.5 text-xs text-ink-400">
        Accept to join. You will not see the board until then.
      </p>
      <ul className="mt-3 space-y-2">
        {pendingInvites.map((invite) => {
          const busy = busyId === invite.id;
          return (
            <li
              key={invite.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ink-600/80 bg-ink-800/80 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink-50">
                  {invite.projectName}{' '}
                  <span className="font-normal text-ink-400">({invite.projectKey})</span>
                </p>
                <p className="truncate text-[11px] text-ink-400">
                  {invite.inviterName} invited you as {invite.role}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  size="xs"
                  disabled={busy}
                  onClick={() => void onAccept(invite.id)}
                >
                  {busy ? '…' : 'Accept'}
                </Button>
                <Button
                  size="xs"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => void onDecline(invite.id)}
                >
                  Decline
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
