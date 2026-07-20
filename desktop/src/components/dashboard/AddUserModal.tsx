import { useMemo, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { assignUserProjects, createOrgUser, type OrgUser } from '@/lib/api/org';
import { useWorkspace } from '@/lib/workspace/WorkspaceContext';
import type { ProjectRole } from '@/lib/workspace/types';
import { cn } from '@/lib/cn';

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
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function toggleProject(id: string) {
    setSelectedProjects((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      let user: OrgUser;
      if (isAssign && assignTo) {
        if (selectedProjects.length === 0) {
          setError('Select at least one project to assign.');
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
      setError(err instanceof Error ? err.message : 'Could not save user');
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/55 p-4">
      <button type="button" className="absolute inset-0" onClick={onClose} aria-label="Close" />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 max-h-[90vh] w-full max-w-md overflow-y-auto border border-ink-600 bg-ink-800 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-ink-50">
          {isAssign ? 'Assign projects' : 'Add user'}
        </h2>
        <p className="mt-1 text-xs text-ink-300">
          {isAssign
            ? `Add ${assignTo?.name} to one or more projects.`
            : 'Create a login for this person. Optionally assign projects now, or later.'}
        </p>

        <form onSubmit={onSubmit} className="mt-4 space-y-3">
          {!isAssign ? (
            <>
              <Input
                placeholder="Full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />
              <Input
                type="email"
                placeholder="Work email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Input
                type="password"
                placeholder="Temporary password (min 8)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
              <div>
                <p className="mb-1 text-[10px] font-bold tracking-wide text-ink-300 uppercase">
                  Org role
                </p>
                <Select
                  size="sm"
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
              <p className="text-[10px] font-bold tracking-wide text-ink-300 uppercase">
                Projects {isAssign ? '' : '(optional)'}
              </p>
              {!isAssign ? (
                <span className="text-[10px] text-ink-400">Leave empty to assign later</span>
              ) : null}
            </div>
            {availableProjects.length === 0 ? (
              <p className="border border-dashed border-ink-600 px-3 py-4 text-center text-xs text-ink-400">
                {isAssign
                  ? 'Already on all projects.'
                  : 'No projects yet — create one first, or add the user and assign later.'}
              </p>
            ) : (
              <ul className="max-h-40 space-y-1 overflow-y-auto border border-ink-600 p-2">
                {availableProjects.map((p) => {
                  const checked = selectedProjects.includes(p.id);
                  return (
                    <li key={p.id}>
                      <label
                        className={cn(
                          'flex cursor-pointer items-center gap-2 px-2 py-1.5 text-xs',
                          checked ? 'bg-ink-900' : 'hover:bg-ink-900/80',
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
              <p className="mb-1 text-[10px] font-bold tracking-wide text-ink-300 uppercase">
                Role on selected projects
              </p>
              <Select
                size="sm"
                value={projectRole}
                onChange={(v) => setProjectRole(v as ProjectRole)}
                options={PROJECT_ROLES}
                aria-label="Project role"
              />
            </div>
          ) : null}

          {error ? <p className="text-sm text-[#ed4245]">{error}</p> : null}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" size="sm" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? 'Saving…' : isAssign ? 'Assign' : 'Add user'}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
