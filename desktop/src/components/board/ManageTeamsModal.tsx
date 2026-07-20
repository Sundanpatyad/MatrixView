import { useMemo, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Input } from '@/components/ui/Input';
import { IconX } from '@/components/ui/Icons';
import { cn } from '@/lib/cn';
import type { ProjectTeam } from '@/lib/workspace/types';
import { useWorkspace } from '@/lib/workspace/WorkspaceContext';

type Props = {
  projectId: string;
  onClose: () => void;
};

export function ManageTeamsModal({ projectId, onClose }: Props) {
  const {
    getProject,
    getProjectTeams,
    createTeam,
    updateTeam,
    deleteTeam,
    isProjectAdmin,
  } = useWorkspace();

  const project = getProject(projectId);
  const teams = getProjectTeams(projectId);
  const members = project?.members ?? [];
  const canManage = isProjectAdmin(projectId);

  const [name, setName] = useState('');
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [editing, setEditing] = useState<ProjectTeam | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [toDelete, setToDelete] = useState<ProjectTeam | null>(null);
  const [deleting, setDeleting] = useState(false);

  const sortedMembers = useMemo(
    () => [...members].sort((a, b) => a.name.localeCompare(b.name)),
    [members],
  );

  function startEdit(team: ProjectTeam) {
    setEditing(team);
    setName(team.name);
    setMemberIds([...team.memberIds]);
    setError('');
  }

  function resetForm() {
    setEditing(null);
    setName('');
    setMemberIds([]);
    setError('');
  }

  function toggleMember(id: string) {
    setMemberIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canManage || !name.trim()) return;
    setBusy(true);
    setError('');
    try {
      if (editing) {
        await updateTeam(editing.id, { name: name.trim(), memberIds });
      } else {
        await createTeam(projectId, { name: name.trim(), memberIds });
      }
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save team');
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/55 p-4">
      <button type="button" className="absolute inset-0" onClick={onClose} aria-label="Close" />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 flex max-h-[min(90vh,640px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-ink-600 bg-ink-800 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-ink-600 px-5 py-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-ink-300">
              {project?.key ?? 'Project'}
            </p>
            <h2 className="text-base font-semibold text-ink-50">Teams</h2>
            <p className="mt-1 text-[11px] text-ink-300">
              Create teams to segregate tasks. With no teams, all tasks stay project-wide.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-ink-300 hover:bg-ink-700 hover:text-ink-50"
          >
            <IconX className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {teams.length === 0 ? (
            <p className="rounded-lg border border-dashed border-ink-600 bg-ink-900/50 px-3 py-4 text-center text-xs text-ink-300">
              No teams yet — tasks are global for this project.
            </p>
          ) : (
            <ul className="space-y-2">
              {teams.map((team) => (
                <li
                  key={team.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-ink-600 bg-ink-900/60 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink-50">{team.name}</p>
                    <p className="text-[11px] text-ink-400">
                      {team.memberIds.length} member{team.memberIds.length === 1 ? '' : 's'}
                    </p>
                  </div>
                  {canManage ? (
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        className="text-[11px] font-semibold text-ink-200 hover:text-ink-50"
                        onClick={() => startEdit(team)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-[11px] font-semibold text-ink-400 hover:text-[#ed4245]"
                        onClick={() => setToDelete(team)}
                      >
                        Delete
                      </button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          {canManage ? (
            <form onSubmit={onSubmit} className="space-y-3 rounded-xl border border-ink-600 bg-ink-900/40 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-ink-300">
                {editing ? 'Edit team' : 'New team'}
              </p>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Team name"
                required
                className="h-9 text-xs"
              />
              <div>
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-ink-300">
                  Members
                </p>
                <div className="max-h-36 space-y-1 overflow-y-auto rounded-lg border border-ink-600 bg-ink-800 p-1.5">
                  {sortedMembers.length === 0 ? (
                    <p className="px-2 py-3 text-center text-[11px] text-ink-400">
                      Invite project members first
                    </p>
                  ) : (
                    sortedMembers.map((m) => {
                      const on = memberIds.includes(m.id);
                      return (
                        <label
                          key={m.id}
                          className={cn(
                            'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-ink-700',
                            on && 'bg-brand-500/10',
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={() => toggleMember(m.id)}
                            className="accent-brand-500"
                          />
                          <span className="min-w-0 flex-1 truncate font-medium text-ink-100">
                            {m.name}
                          </span>
                          <span className="truncate text-[10px] text-ink-400">{m.email}</span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
              {error ? (
                <p className="text-[11px] font-medium text-[#ed4245]">{error}</p>
              ) : null}
              <div className="flex gap-2">
                {editing ? (
                  <Button type="button" variant="secondary" size="sm" onClick={resetForm}>
                    Cancel
                  </Button>
                ) : null}
                <Button type="submit" size="sm" disabled={busy || !name.trim()} className="flex-1">
                  {busy ? 'Saving…' : editing ? 'Save team' : 'Create team'}
                </Button>
              </div>
            </form>
          ) : (
            <p className="text-center text-[11px] text-ink-400">
              Only project admins can create or edit teams.
            </p>
          )}
        </div>
      </div>

      <ConfirmModal
        open={Boolean(toDelete)}
        title="Delete team?"
        message={
          toDelete
            ? `Delete “${toDelete.name}”? Its tasks become project-global (not deleted).`
            : ''
        }
        confirmLabel="Delete"
        danger
        busy={deleting}
        onCancel={() => setToDelete(null)}
        onConfirm={async () => {
          if (!toDelete) return;
          setDeleting(true);
          try {
            await deleteTeam(toDelete.id);
            if (editing?.id === toDelete.id) resetForm();
            setToDelete(null);
          } finally {
            setDeleting(false);
          }
        }}
      />
    </div>,
    document.body,
  );
}
