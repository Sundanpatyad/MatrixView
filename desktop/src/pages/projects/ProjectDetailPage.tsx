import { useState, type FormEvent } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { UserAvatar } from '@/components/ui/UserAvatar';
import type { ProjectMember, ProjectRole } from '@/lib/workspace/types';
import { useWorkspace } from '@/lib/workspace/WorkspaceContext';
import { useToast } from '@/lib/toast/ToastContext';

const ROLE_OPTIONS = [
  { value: 'member', label: 'Member' },
  { value: 'admin', label: 'Admin' },
];

export function ProjectDetailPage() {
  const { projectId = '' } = useParams();
  const { getProject, addMember, updateMemberRole, removeMember } = useWorkspace();
  const toast = useToast();
  const project = getProject(projectId);

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<ProjectRole>('member');
  const [memberToRemove, setMemberToRemove] = useState<ProjectMember | null>(null);
  const [removing, setRemoving] = useState(false);

  if (!project) {
    return <Navigate to="/projects" replace />;
  }

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    try {
      const res = await addMember(project!.id, { email, role });
      if (!res.member) {
        toast.error('Could not invite. They may already be on the project.');
        return;
      }
      setEmail('');
      setRole('member');
      toast.success(
        res.result === 'added'
          ? 'User found — added to the project.'
          : res.emailSent
            ? 'Invite email sent.'
            : res.inviteLink
              ? `Invite created: ${res.inviteLink}`
              : 'Invite created.',
      );
    } catch (err) {
      toast.fromError(err, 'Could not add member');
    }
  }

  const admins = project.members.filter((m) => m.role === 'admin').length;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center gap-2 text-xs font-semibold text-ink-200">
        <Link to="/projects" className="hover:text-brand-800">
          Projects
        </Link>
        <span>/</span>
        <span className="text-ink-50">{project.key}</span>
      </div>

      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold text-ink-50">{project.name}</h1>
          <p className="mt-2 text-sm font-medium text-ink-200">
            {project.description || 'No description.'} · Created by {project.createdBy}
          </p>
        </div>
        <Link to={`/projects/${project.id}/board`}>
          <Button>Open board</Button>
        </Link>
      </div>

      <section className="mt-8 rounded-2xl border border-ink-500 bg-ink-800 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-ink-50">Members</h2>
            <p className="text-sm font-medium text-ink-200">
              Roles: <span className="font-bold text-ink-100">Admin</span> or{' '}
              <span className="font-bold text-ink-100">Member</span>
            </p>
          </div>
          <span className="rounded-lg bg-ink-700 px-2.5 py-1 text-xs font-bold text-ink-200">
            {project.members.length} people
          </span>
        </div>

        <form onSubmit={onAdd} className="mt-5 grid gap-3 sm:grid-cols-[1fr_140px_auto]">
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Select
            size="md"
            value={role}
            onChange={(v) => setRole(v as ProjectRole)}
            options={ROLE_OPTIONS}
            aria-label="Role"
          />
          <Button type="submit">Invite</Button>
        </form>
        
        <div className="mt-6 space-y-2">
          {project.members.map((member) => (
            <div
              key={member.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-600 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <UserAvatar
                  name={member.name}
                  src={member.avatarUrl}
                  seed={member.email || member.name}
                  size="lg"
                  className="!h-9 !w-9"
                />
                <div>
                  <p className="text-sm font-bold text-ink-50">{member.name}</p>
                  <p className="text-xs font-semibold text-ink-200">{member.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-[110px]">
                  <Select
                    size="xs"
                    value={member.role}
                    onChange={(v) =>
                      void updateMemberRole(project.id, member.id, v as ProjectRole)
                    }
                    options={ROLE_OPTIONS}
                    aria-label={`Role for ${member.name}`}
                  />
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={member.role === 'admin' && admins <= 1}
                  onClick={() => setMemberToRemove(member)}
                >
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

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
            await removeMember(project.id, memberToRemove.id);
            setMemberToRemove(null);
          } finally {
            setRemoving(false);
          }
        }}
      />
    </div>
  );
}
