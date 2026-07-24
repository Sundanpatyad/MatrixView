import { useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import type { Project, ProjectMember, ProjectRole } from '@/lib/workspace/types';
import { useWorkspace } from '@/lib/workspace/WorkspaceContext';
import { useToast } from '@/lib/toast/ToastContext';

type Props = {
  project: Project;
  onClose: () => void;
};

const ROLE_OPTIONS = [
  { value: 'member', label: 'Member' },
  { value: 'admin', label: 'Admin' },
];

export function InviteMembersModal({ project, onClose }: Props) {
  const { getProject, addMember, updateMemberRole, removeMember } = useWorkspace();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<ProjectRole>('member');
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<ProjectMember | null>(null);
  const [removing, setRemoving] = useState(false);

  const live = getProject(project.id) ?? project;
  const admins = live.members.filter((m) => m.role === 'admin' && m.status !== 'pending').length;

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    setInviteLink(null);
    setBusy(true);
    try {
      const res = await addMember(live.id, { email, role });
      if (!res.member) {
        toast.error('Could not invite — they may already be on this project.');
        return;
      }
      setEmail('');
      setRole('member');
      if (res.result === 'added') {
        toast.success('User found in DockX — added to the project.');
      } else {
        toast.success(
          res.emailSent
            ? 'Invite email sent. They’ll join after creating an account.'
            : 'Invite created. Copy the link below (email SMTP not configured).',
        );
        setInviteLink(res.inviteLink);
      }
    } catch (err) {
      toast.fromError(err, 'Could not invite member');
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      toast.success('Invite link copied.');
    } catch {
      toast.error('Could not copy — select the link manually.');
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/55 p-4">
      <button type="button" className="absolute inset-0" onClick={onClose} aria-label="Close" />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 w-full max-w-lg border border-ink-600 bg-ink-800 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-ink-50">Invite members</h2>
        <p className="mt-1 text-xs text-ink-300">
          {live.name} · If the email already exists, they join now. Otherwise we email an invite
          link; after they sign up they’re already on this project.
        </p>

        <form onSubmit={onAdd} className="mt-4 grid gap-2 sm:grid-cols-[1fr_120px_auto]">
          <Input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
          <Select
            size="md"
            value={role}
            onChange={(v) => setRole(v as ProjectRole)}
            options={ROLE_OPTIONS}
            aria-label="Role"
          />
          <Button type="submit" size="sm" disabled={busy}>
            Invite
          </Button>
        </form>
        {inviteLink ? (
          <div className="mt-2 flex gap-2">
            <input
              readOnly
              value={inviteLink}
              className="h-8 min-w-0 flex-1 truncate rounded-md border border-ink-600 bg-ink-900 px-2 text-[11px] text-ink-200"
            />
            <Button type="button" size="xs" variant="secondary" onClick={() => void copyLink()}>
              Copy link
            </Button>
          </div>
        ) : null}

        <div className="mt-4 max-h-64 overflow-y-auto border-t border-ink-700">
          {live.members.map((member) => (
            <div
              key={member.id}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-700 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink-50">
                  {member.name}
                  {member.status === 'pending' ? (
                    <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#fee75c]">
                      Pending
                    </span>
                  ) : null}
                </p>
                <p className="truncate text-xs text-ink-300">{member.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-[110px]">
                  <Select
                    size="xs"
                    value={member.role}
                    onChange={(v) =>
                      void updateMemberRole(live.id, member.id, v as ProjectRole)
                    }
                    options={ROLE_OPTIONS}
                    aria-label={`Role for ${member.name}`}
                  />
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={member.role === 'admin' && admins <= 1}
                  onClick={() => setMemberToRemove(member)}
                >
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex justify-end">
          <Button size="sm" variant="secondary" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>

      <ConfirmModal
        open={Boolean(memberToRemove)}
        title="Remove member?"
        message={
          memberToRemove
            ? `Remove ${memberToRemove.name} from this project? They’ll lose access to the board.`
            : ''
        }
        confirmLabel="Remove"
        danger
        busy={removing}
        onCancel={() => setMemberToRemove(null)}
        onConfirm={async () => {
          if (!memberToRemove) return;
          setRemoving(true);
          try {
            await removeMember(live.id, memberToRemove.id);
            setMemberToRemove(null);
          } finally {
            setRemoving(false);
          }
        }}
      />
    </div>,
    document.body,
  );
}
