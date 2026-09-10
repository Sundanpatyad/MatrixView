import { useMemo, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { Input } from '@/components/ui/Input';
import { Modal, ModalFooter, ModalHeader } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { assignUserProjects, createOrgUser, type OrgUser } from '@/lib/api/org';
import { useWorkspace } from '@/lib/workspace/WorkspaceContext';
import type { ProjectRole } from '@/lib/workspace/types';
import { cn } from '@/lib/cn';
import { useToast } from '@/lib/toast/ToastContext';

type Props = {
  onClose: () => void;
  onSaved?: (user: OrgUser) => void;
  /** When set, modal assigns projects to an existing user instead of creating one */
  assignTo?: OrgUser | null;
};

const ORG_ROLES = [
  { value: 'Member', label: 'Member' },
  { value: 'Manager', label: 'Manager' },
  { value: 'Admin', label: 'Admin' },
];

const PROJECT_ROLES = [
  { value: 'member', label: 'Project member' },
  { value: 'admin', label: 'Project admin' },
];

export function AddUserModal({ onClose, onSaved, assignTo }: Props) {
  const { projects, refresh } = useWorkspace();
  const toast = useToast();
  const isAssign = Boolean(assignTo);

  const availableProjects = useMemo(() => {
    if (!assignTo) return projects;
    const already = new Set(assignTo.projects.map((p) => p.id));
    return projects.filter((p) => !already.has(p.id));
  }, [projects, assignTo]);

  const [name, setName] = useState(assignTo?.name ?? '');
  const [email, setEmail] = useState(assignTo?.email ?? '');
  const [password, setPassword] = useState('');
  const [orgRole, setOrgRole] = useState<'Admin' | 'Manager' | 'Member'>('Member');
  const [projectRole, setProjectRole] = useState<ProjectRole>('member');
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  function toggleProject(id: string) {
    setSelectedProjects((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      let user: OrgUser;
      if (isAssign && assignTo) {
        if (selectedProjects.length === 0) {
          toast.error('Select at least one project to assign.');
          setSaving(false);
          return;
        }
        const res = await assignUserProjects(assignTo.id, {
          projectIds: selectedProjects,
          projectRole,
        });
        user = res.user;
      } else {
        const res = await createOrgUser({
          name,
          email,
          password,
          role: orgRole,
          projectIds: selectedProjects,
          projectRole,
        });
        user = res.user;
      }
      await refresh();
      onSaved?.(user);
      onClose();
    } catch (err) {
      toast.fromError(err, 'Could not save user');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal size="md" labelledBy="add-user-title" onClose={onClose}>
      <ModalHeader
        titleId="add-user-title"
        title={isAssign ? 'Assign projects' : 'Add user'}
        description={
          isAssign
            ? `Add ${assignTo?.name} to one or more projects.`
            : 'Create a login for this person. Optionally assign projects now, or later.'
        }
        onClose={onClose}
      />
      <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {!isAssign ? (
            <>
              <div>
                <FieldLabel htmlFor="user-name" required>
                  Full name
                </FieldLabel>
                <Input
                  id="user-name"
                  placeholder="Jane Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div>
                <FieldLabel htmlFor="user-email" required>
                  Work email
                </FieldLabel>
                <Input
                  id="user-email"
                  type="email"
                  placeholder="jane@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div>
                <FieldLabel htmlFor="user-password" required>
                  Temporary password
                </FieldLabel>
                <Input
                  id="user-password"
                  type="password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
              <div>
                <FieldLabel required>Org role</FieldLabel>
                <Select
                  size="md"
                  value={orgRole}
                  onChange={(v) => setOrgRole(v as 'Admin' | 'Manager' | 'Member')}
                  options={ORG_ROLES}
                  aria-label="Org role"
                />
              </div>
            </>
          ) : null}

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <FieldLabel className="mb-0">Projects</FieldLabel>
              {!isAssign ? (
                <span className="text-[10px] text-ink-400">Optional — assign later</span>
              ) : null}
            </div>
            {availableProjects.length === 0 ? (
              <p className="rounded-xl border border-dashed border-ink-600 px-3 py-4 text-center text-xs text-ink-400">
                {isAssign
                  ? 'Already on all projects.'
                  : 'No projects yet — create one first, or add the user and assign later.'}
              </p>
            ) : (
              <ul className="max-h-40 space-y-0.5 overflow-y-auto rounded-xl border border-ink-600/70 bg-ink-900/30 p-1.5">
                {availableProjects.map((p) => {
                  const checked = selectedProjects.includes(p.id);
                  return (
                    <li key={p.id}>
                      <label
                        className={cn(
                          'flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-xs',
                          checked ? 'bg-brand-500/10' : 'hover:bg-ink-800',
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleProject(p.id)}
                          className="accent-brand-500"
                        />
                        <span className="font-semibold text-ink-50">{p.name}</span>
                        <span className="text-ink-400">{p.key}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {selectedProjects.length > 0 || isAssign ? (
            <div>
              <FieldLabel required>Role on selected projects</FieldLabel>
              <Select
                size="md"
                value={projectRole}
                onChange={(v) => setProjectRole(v as ProjectRole)}
                options={PROJECT_ROLES}
                aria-label="Project role"
              />
            </div>
          ) : null}
        </div>
        <ModalFooter>
          <Button type="button" size="sm" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? 'Saving…' : isAssign ? 'Assign' : 'Add user'}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
