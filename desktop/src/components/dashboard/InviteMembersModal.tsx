import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { Input } from '@/components/ui/Input';
import { Modal, ModalFooter, ModalHeader } from '@/components/ui/Modal';
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
    const emailNorm = email.trim().toLowerCase();
    const existing = live.members.find((m) => m.email.toLowerCase() === emailNorm);
    if (existing?.status === 'pending') {
      toast.error('This person already has a pending invite. They must Accept it first.');
      return;
    }
    if (existing) {
      toast.error('This person is already on the project.');
      return;
    }
    setInviteLink(null);
    setBusy(true);
    try {
      const res = await addMember(live.id, { email, role });
      if (!res.member) {
        toast.error('Could not invite. They may already be on this project.');
        return;
      }
      setEmail('');
      setRole('member');
      toast.success(
        res.emailSent
          ? 'Invite sent. They must Accept before they can see the board.'
          : 'Invite created. Copy the link below — they must Accept to join.',
      );
      if (res.inviteLink) setInviteLink(res.inviteLink);
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

  return (
    <>
      <Modal size="lg" labelledBy="invite-members-title" onClose={onClose}>
        <ModalHeader
          titleId="invite-members-title"
          title="Invite members"
          description={`${live.name} · They stay Pending until they Accept. They cannot see the board until then.`}
          onClose={onClose}
        />
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <form onSubmit={onAdd} className="grid gap-2 sm:grid-cols-[1fr_140px_auto]">
            <div className="min-w-0">
              <FieldLabel htmlFor="invite-email" required>
                Email
              </FieldLabel>
              <Input
                id="invite-email"
                type="email"
                placeholder="colleague@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div>
              <FieldLabel required>Role</FieldLabel>
              <Select
                size="md"
                value={role}
                onChange={(v) => setRole(v as ProjectRole)}
                options={ROLE_OPTIONS}
                aria-label="Role"
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" size="sm" disabled={busy} className="h-10 w-full sm:w-auto">
                Invite
              </Button>
            </div>
          </form>
          {inviteLink ? (
            <div className="flex gap-2 rounded-xl border border-ink-600/70 bg-ink-900/40 p-2">
              <Input readOnly value={inviteLink} size="sm" className="min-w-0 flex-1 truncate" />
              <Button type="button" size="sm" variant="secondary" onClick={() => void copyLink()}>
                Copy link
              </Button>
            </div>
          ) : null}

          <div>
            <p className="mb-2 text-[11px] font-semibold tracking-wide text-ink-400 uppercase">
              People on this project
            </p>
            <div className="max-h-72 overflow-y-auto rounded-xl border border-ink-600/70">
              {live.members.map((member) => (
                <div
                  key={member.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-700/80 px-3 py-2.5 last:border-b-0"
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
                    <p className="truncate text-xs text-ink-400">{member.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-[118px]">
                      <Select
                        size="sm"
                        value={member.role}
                        onChange={(v) => void updateMemberRole(live.id, member.id, v as ProjectRole)}
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
          </div>
        </div>
        <ModalFooter>
          <Button size="sm" variant="secondary" onClick={onClose}>
            Done
          </Button>
        </ModalFooter>
      </Modal>

      <ConfirmModal
        open={Boolean(memberToRemove)}
        title="Remove member?"
        message={
          memberToRemove
            ? `Remove ${memberToRemove.name} from this project? They’ll lose access. Their tasks move to the backlog (unassigned).`
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
    </>
  );
}
