import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Input } from '@/components/ui/Input';
import { IconPlus, IconUsers, IconX } from '@/components/ui/Icons';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { cn } from '@/lib/cn';
import type { ProjectMember, ProjectTeam } from '@/lib/workspace/types';
import { useWorkspace } from '@/lib/workspace/WorkspaceContext';
import { useToast } from '@/lib/toast/ToastContext';

type Props = {
  projectId: string;
  onClose: () => void;
  /** Jump to this team's tasks on the board */
  onViewTeamTasks?: (teamId: string, memberIds: string[]) => void;
};

export function ManageTeamsModal({ projectId, onClose, onViewTeamTasks }: Props) {
  const {
    getProject,
    getProjectTeams,
    getProjectTasks,
    createTeam,
    updateTeam,
    addTeamMembers,
    removeTeamMember,
    deleteTeam,
    isProjectAdmin,
  } = useWorkspace();
  const toast = useToast();

  const project = getProject(projectId);
  const teams = getProjectTeams(projectId);
  const members = useMemo(
    () => (project?.members ?? []).filter((m) => m.status !== 'pending'),
    [project?.members],
  );
  const canManage = isProjectAdmin(projectId);
  const projectTasks = getProjectTasks(projectId);

  const [selectedId, setSelectedId] = useState<string | 'new' | null>(null);
  const [name, setName] = useState('');
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [memberQuery, setMemberQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [toDelete, setToDelete] = useState<ProjectTeam | null>(null);
  const [deleting, setDeleting] = useState(false);

  const selectedTeam =
    selectedId && selectedId !== 'new'
      ? teams.find((t) => t.id === selectedId) ?? null
      : null;

  useEffect(() => {
    if (selectedId === 'new') return;
    if (selectedId && !teams.some((t) => t.id === selectedId)) {
      setSelectedId(teams[0]?.id ?? null);
    } else if (!selectedId && teams.length > 0) {
      setSelectedId(teams[0].id);
    }
  }, [teams, selectedId]);

  useEffect(() => {
    if (selectedId === 'new') {
      setName('');
      setMemberIds([]);
      setMemberQuery('');
      return;
    }
    if (!selectedTeam) return;
    setName(selectedTeam.name);
    setMemberIds([...selectedTeam.memberIds]);
    setMemberQuery('');
  }, [selectedId, selectedTeam]);

  const sortedMembers = useMemo(
    () => [...members].sort((a, b) => a.name.localeCompare(b.name)),
    [members],
  );

  const filteredMembers = useMemo(() => {
    const q = memberQuery.trim().toLowerCase();
    if (!q) return sortedMembers;
    return sortedMembers.filter(
      (m) =>
        m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q),
    );
  }, [sortedMembers, memberQuery]);

  const teamMembers = useMemo(
    () => sortedMembers.filter((m) => memberIds.includes(m.id)),
    [sortedMembers, memberIds],
  );

  const availableMembers = useMemo(
    () => filteredMembers.filter((m) => !memberIds.includes(m.id)),
    [filteredMembers, memberIds],
  );

  function taskCountFor(teamId: string) {
    return projectTasks.filter((t) => t.teamId === teamId).length;
  }

  function startCreate() {
    setSelectedId('new');
    setName('');
    setMemberIds([]);
    setMemberQuery('');
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!canManage || !name.trim()) return;
    setBusy(true);
    try {
      if (selectedId === 'new') {
        const team = await createTeam(projectId, {
          name: name.trim(),
          memberIds,
        });
        setSelectedId(team.id);
      } else if (selectedTeam) {
        await updateTeam(selectedTeam.id, {
          name: name.trim(),
          memberIds,
        });
      }
    } catch (err) {
      toast.fromError(err, 'Could not save team');
    } finally {
      setBusy(false);
    }
  }

  async function onAddMember(member: ProjectMember) {
    if (!canManage) return;
    if (selectedId === 'new') {
      setMemberIds((prev) => (prev.includes(member.id) ? prev : [...prev, member.id]));
      return;
    }
    if (!selectedTeam) return;
    setBusy(true);
    try {
      const team = await addTeamMembers(selectedTeam.id, [member.id]);
      setMemberIds([...team.memberIds]);
    } catch (err) {
      toast.fromError(err, 'Could not add member');
    } finally {
      setBusy(false);
    }
  }

  async function onRemoveMember(memberId: string) {
    if (!canManage) return;
    if (selectedId === 'new') {
      setMemberIds((prev) => prev.filter((id) => id !== memberId));
      return;
    }
    if (!selectedTeam) return;
    setBusy(true);
    try {
      const team = await removeTeamMember(selectedTeam.id, memberId);
      setMemberIds([...team.memberIds]);
    } catch (err) {
      toast.fromError(err, 'Could not remove member');
    } finally {
      setBusy(false);
    }
  }

  const dirty =
    selectedId === 'new'
      ? Boolean(name.trim()) || memberIds.length > 0
      : selectedTeam
        ? name.trim() !== selectedTeam.name ||
          memberIds.length !== selectedTeam.memberIds.length ||
          memberIds.some((id) => !selectedTeam.memberIds.includes(id))
        : false;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/55 p-4">
      <button type="button" className="absolute inset-0" onClick={onClose} aria-label="Close" />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 flex max-h-[min(92vh,720px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-ink-600 bg-ink-800 shadow-2xl sm:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Team list */}
        <aside className="flex w-full shrink-0 flex-col border-b border-ink-600 sm:w-56 sm:border-r sm:border-b-0">
          <div className="flex items-start justify-between gap-2 border-b border-ink-600 px-4 py-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wide text-ink-300">
                {project?.key ?? 'Project'}
              </p>
              <h2 className="text-sm font-semibold text-ink-50">Teams</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 text-ink-300 hover:bg-ink-700 hover:text-ink-50 sm:hidden"
            >
              <IconX className="h-4 w-4" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {teams.length === 0 && selectedId !== 'new' ? (
              <p className="px-2 py-6 text-center text-[11px] text-ink-400">
                No teams yet. Create one to segregate work.
              </p>
            ) : (
              <ul className="space-y-1">
                {teams.map((team) => {
                  const active = selectedId === team.id;
                  const count = taskCountFor(team.id);
                  return (
                    <li key={team.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(team.id)}
                        className={cn(
                          'flex w-full flex-col rounded-lg px-2.5 py-2 text-left transition',
                          active ? 'bg-brand-500/15 ring-1 ring-brand-500/40' : 'hover:bg-ink-700',
                        )}
                      >
                        <span className="truncate text-xs font-semibold text-ink-50">
                          {team.name}
                        </span>
                        <span className="mt-0.5 text-[10px] text-ink-400">
                          {team.memberIds.length} member
                          {team.memberIds.length === 1 ? '' : 's'} · {count} task
                          {count === 1 ? '' : 's'}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {canManage ? (
            <div className="border-t border-ink-600 p-2">
              <Button
                type="button"
                size="sm"
                variant={selectedId === 'new' ? 'primary' : 'secondary'}
                className="w-full"
                onClick={startCreate}
              >
                <IconPlus className="h-3.5 w-3.5" />
                New team
              </Button>
            </div>
          ) : null}
        </aside>

        {/* Detail */}
        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-3 border-b border-ink-600 px-5 py-3">
            <div className="min-w-0">
              <h3 className="truncate text-base font-semibold text-ink-50">
                {selectedId === 'new'
                  ? 'Create team'
                  : selectedTeam?.name ?? 'Select a team'}
              </h3>
              <p className="mt-0.5 text-[11px] text-ink-400">
                {canManage
                  ? 'Edit name, add or remove members, and open the team board.'
                  : 'View team members and tasks. Only project admins can edit.'}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="hidden rounded-md p-1 text-ink-300 hover:bg-ink-700 hover:text-ink-50 sm:inline-flex"
            >
              <IconX className="h-4 w-4" />
            </button>
          </div>

          {!selectedId ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-12 text-center">
              <IconUsers className="h-8 w-8 text-ink-500" />
              <p className="text-sm text-ink-300">Select a team or create one to get started.</p>
            </div>
          ) : (
            <form onSubmit={onSave} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-ink-300">
                    Team name
                  </label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Design, Backend, QA"
                    required
                    disabled={!canManage || busy}
                    className="h-9 text-sm"
                    maxLength={80}
                  />
                </div>

                {selectedTeam ? (
                  <div className="flex flex-wrap items-center gap-2 rounded-lg border border-ink-600 bg-ink-900/50 px-3 py-2">
                    <span className="text-[11px] text-ink-300">
                      <span className="font-semibold text-ink-100">
                        {taskCountFor(selectedTeam.id)}
                      </span>{' '}
                      tasks on this team
                    </span>
                    {onViewTeamTasks ? (
                      <Button
                        type="button"
                        size="xs"
                        variant="secondary"
                        onClick={() =>
                          onViewTeamTasks(selectedTeam.id, [...memberIds])
                        }
                      >
                        View on board
                      </Button>
                    ) : null}
                  </div>
                ) : null}

                <div>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-ink-300">
                      Members ({teamMembers.length})
                    </p>
                  </div>

                  {teamMembers.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-ink-600 px-3 py-4 text-center text-[11px] text-ink-400">
                      No members yet — add people from the project below.
                    </p>
                  ) : (
                    <ul className="space-y-1 rounded-lg border border-ink-600 bg-ink-900/40 p-1.5">
                      {teamMembers.map((m) => (
                        <li
                          key={m.id}
                          className="flex items-center gap-2 rounded-md px-2 py-1.5"
                        >
                          <UserAvatar
                            name={m.name}
                            src={m.avatarUrl}
                            seed={m.email || m.name}
                            size="sm"
                            bare
                            className="!h-7 !w-7 !text-[10px]"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-medium text-ink-100">
                              {m.name}
                            </span>
                            <span className="block truncate text-[10px] text-ink-400">
                              {m.email}
                            </span>
                          </span>
                          {canManage ? (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void onRemoveMember(m.id)}
                              className="shrink-0 text-[11px] font-semibold text-ink-400 hover:text-[#ed4245]"
                            >
                              Remove
                            </button>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {canManage ? (
                  <div>
                    <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-ink-300">
                      Add members
                    </p>
                    <Input
                      value={memberQuery}
                      onChange={(e) => setMemberQuery(e.target.value)}
                      placeholder="Search project members…"
                      className="mb-2 h-8 text-xs"
                      disabled={busy}
                    />
                    <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-ink-600 bg-ink-900/40 p-1.5">
                      {sortedMembers.length === 0 ? (
                        <p className="px-2 py-3 text-center text-[11px] text-ink-400">
                          Invite project members first
                        </p>
                      ) : availableMembers.length === 0 ? (
                        <p className="px-2 py-3 text-center text-[11px] text-ink-400">
                          {memberQuery.trim()
                            ? 'No matching members'
                            : 'Everyone is already on this team'}
                        </p>
                      ) : (
                        availableMembers.map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            disabled={busy}
                            onClick={() => void onAddMember(m)}
                            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-ink-700"
                          >
                            <UserAvatar
                              name={m.name}
                              src={m.avatarUrl}
                              seed={m.email || m.name}
                              size="sm"
                              bare
                              className="!h-7 !w-7 !text-[10px]"
                            />
                            <span className="min-w-0 flex-1 truncate text-xs font-medium text-ink-100">
                              {m.name}
                            </span>
                            <span className="shrink-0 text-[11px] font-semibold text-brand-400">
                              Add
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2 border-t border-ink-600 px-5 py-3">
                {canManage && selectedTeam ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="danger"
                    disabled={busy || deleting}
                    onClick={() => setToDelete(selectedTeam)}
                  >
                    Delete team
                  </Button>
                ) : null}
                <div className="flex-1" />
                {canManage ? (
                  <Button
                    type="submit"
                    size="sm"
                    disabled={busy || !name.trim() || (selectedId !== 'new' && !dirty)}
                  >
                    {busy
                      ? 'Saving…'
                      : selectedId === 'new'
                        ? 'Create team'
                        : 'Save changes'}
                  </Button>
                ) : null}
              </div>
            </form>
          )}
        </section>
      </div>

      <ConfirmModal
        open={Boolean(toDelete)}
        title="Delete team?"
        message={
          toDelete
            ? `Delete “${toDelete.name}”? Its ${taskCountFor(toDelete.id)} task(s) become project-wide (not deleted).`
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
            setToDelete(null);
            setSelectedId(null);
          } finally {
            setDeleting(false);
          }
        }}
      />
    </div>,
    document.body,
  );
}
