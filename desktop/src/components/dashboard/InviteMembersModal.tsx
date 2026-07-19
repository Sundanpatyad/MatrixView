import { useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import type { Project, ProjectMember, ProjectRole } from '@/lib/workspace/types';
import { useWorkspace } from '@/lib/workspace/WorkspaceContext';

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
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<ProjectRole>('member');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<ProjectMember | null>(null);
  const [removing, setRemoving] = useState(false);

  const live = getProject(project.id) ?? project;
  const admins = live.members.filter((m) => m.role === 'admin' && m.status !== 'pending').length;

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    setError('');
    setInfo('');
    setInviteLink(null);
    setBusy(true);
    try {
      const res = await addMember(live.id, { email, role });
      if (!res.member) {
        setError('Could not invite — they may already be on this project.');
        return;
      }
      setEmail('');
      setRole('member');
      if (res.result === 'added') {
        setInfo('User found in TaskTrack — added to the project.');
      } else {
        setInfo(
          res.emailSent
            ? 'Invite email sent. They’ll join this project after creating an account.'
            : 'Invite created. Copy the link below (email SMTP not configured).',
        );
        setInviteLink(res.inviteLink);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not invite member');
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setInfo('Invite link copied.');
    } catch {
      setInfo('Could not copy — select the link manually.');
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-ink-950/35 p-4">
      <button type="button" className="absolute inset-0" onClick={onClose} aria-label="Close" />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 w-full max-w-lg border border-ink-200 bg-white p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-ink-900">Invite members</h2>
        <p className="mt-1 text-xs text-ink-500">
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
        {error ? <p className="mt-2 text-xs font-medium text-red-700">{error}</p> : null}
        {info ? <p className="mt-2 text-xs font-medium text-emerald-700">{info}</p> : null}
        {inviteLink ? (
          <div className="mt-2 flex gap-2">
            <input
              readOnly
              value={inviteLink}
              className="h-8 min-w-0 flex-1 truncate rounded-md border border-ink-200 bg-ink-50 px-2 text-[11px] text-ink-700"
            />
            <Button type="button" size="xs" variant="secondary" onClick={() => void copyLink()}>
              Copy link
            </Button>
          </div>
        ) : null}

        <div className="mt-4 max-h-64 overflow-y-auto border-t border-ink-100">
          {live.members.map((member) => (
            <div
              key={member.id}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink-900">
                  {member.name}
                  {member.status === 'pending' ? (
                    <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                      Pending
                    </span>
                  ) : null}
                </p>
                <p className="truncate text-xs text-ink-500">{member.email}</p>
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
