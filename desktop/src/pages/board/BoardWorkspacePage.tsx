import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { useSearchParams } from 'react-router-dom';
import { CreateTaskModal } from '@/components/board/CreateTaskModal';
import { TaskDetailModal } from '@/components/board/TaskDetailModal';
import { CreateProjectModal } from '@/components/dashboard/CreateProjectModal';
import { DashboardTaskCard } from '@/components/dashboard/DashboardTaskCard';
import { InviteMembersModal } from '@/components/dashboard/InviteMembersModal';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Select } from '@/components/ui/Select';
import { UserAvatar, avatarFromMembers } from '@/components/ui/UserAvatar';
import { useAttendance } from '@/lib/attendance/AttendanceContext';
import { useAuth } from '@/lib/auth/AuthContext';
import { cn } from '@/lib/cn';
import {
  TASK_PRIORITIES,
  TASK_TYPES,
  type BoardTask,
  type TaskPriority,
  type TaskStatus,
  type TaskType,
} from '@/lib/workspace/types';
import { useWorkspace } from '@/lib/workspace/WorkspaceContext';

/** Tasks on a member's personal board = assigned to that member */
function isMemberBoardTask(
  task: BoardTask,
  member: { id: string; name: string } | null,
) {
  if (!member) return false;
  const name = member.name.trim().toLowerCase();
  return (
    (member.id && task.assigneeId === member.id) ||
    task.assigneeName.trim().toLowerCase() === name
  );
}

export function BoardWorkspacePage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    projects,
    getProject,
    getProjectTasks,
    updateTaskStatus,
    addColumn,
    renameColumn,
    removeColumn,
    reorderColumns,
    isProjectAdmin,
  } = useWorkspace();
  const { checkedIn, onBreak, elapsedLabel, checkIn, checkOut, toggleBreak } = useAttendance();

  const queryProjectId = searchParams.get('project') ?? '';
  const [projectId, setProjectId] = useState(queryProjectId || projects[0]?.id || '');
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<TaskType | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');

  const [showCreateProject, setShowCreateProject] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<TaskStatus | null>(null);
  const draggingIdRef = useRef<string | null>(null);
  const [boardMemberIds, setBoardMemberIds] = useState<string[]>([]);
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
  const [editingColumnLabel, setEditingColumnLabel] = useState('');
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [columnBusy, setColumnBusy] = useState(false);
  const [columnToRemove, setColumnToRemove] = useState<{ id: string; label: string } | null>(
    null,
  );
  const renameInputRef = useRef<HTMLInputElement>(null);
  const addColumnInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (queryProjectId && projects.some((p) => p.id === queryProjectId)) {
      setProjectId(queryProjectId);
      return;
    }
    if (!projectId && projects[0]) setProjectId(projects[0].id);
    if (projectId && !projects.some((p) => p.id === projectId)) {
      setProjectId(projects[0]?.id ?? '');
    }
  }, [projects, projectId, queryProjectId]);

  function selectProject(id: string) {
    setProjectId(id);
    if (searchParams.has('project')) {
      const next = new URLSearchParams(searchParams);
      next.set('project', id);
      setSearchParams(next, { replace: true });
    }
  }

  const project = projectId ? getProject(projectId) : undefined;
  const columns = project?.columns ?? [];
  const members = project?.members ?? [];
  const canEditColumns = Boolean(
    project &&
      user &&
      (user.role === 'Admin' ||
        isProjectAdmin(project.id) ||
        members.some((m) => m.email.toLowerCase() === user.email.toLowerCase())),
  );

  useEffect(() => {
    if (editingColumnId) renameInputRef.current?.focus();
  }, [editingColumnId]);

  useEffect(() => {
    if (addingColumn) addColumnInputRef.current?.focus();
  }, [addingColumn]);

  function beginRenameColumn(colId: string, currentLabel: string) {
    if (!canEditColumns) return;
    setEditingColumnId(colId);
    setEditingColumnLabel(currentLabel);
  }

  async function commitRenameColumn() {
    if (!projectId || !editingColumnId) return;
    const label = editingColumnLabel.trim();
    const colId = editingColumnId;
    setEditingColumnId(null);
    if (!label) return;
    const current = columns.find((c) => c.id === colId);
    if (current && current.label === label) return;
    setColumnBusy(true);
    try {
      await renameColumn(projectId, colId, label);
    } finally {
      setColumnBusy(false);
    }
  }

  function onRenameKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      void commitRenameColumn();
    } else if (e.key === 'Escape') {
      setEditingColumnId(null);
    }
  }

  async function onAddColumn(e: FormEvent) {
    e.preventDefault();
    if (!projectId || !newColumnName.trim() || columnBusy) return;
    setColumnBusy(true);
    try {
      await addColumn(projectId, newColumnName.trim());
      setNewColumnName('');
      setAddingColumn(false);
    } finally {
      setColumnBusy(false);
    }
  }

  function requestRemoveColumn(colId: string, label: string) {
    if (!projectId || !canEditColumns || columns.length <= 1) return;
    setColumnToRemove({ id: colId, label });
  }

  async function confirmRemoveColumn() {
    if (!projectId || !columnToRemove) return;
    setColumnBusy(true);
    try {
      await removeColumn(projectId, columnToRemove.id);
      setColumnToRemove(null);
    } finally {
      setColumnBusy(false);
    }
  }

  async function onMoveColumn(colId: string, direction: -1 | 1) {
    if (!projectId || !canEditColumns || columnBusy) return;
    const index = columns.findIndex((c) => c.id === colId);
    const next = index + direction;
    if (index < 0 || next < 0 || next >= columns.length) return;
    const ordered = columns.map((c) => c.id);
    const [moved] = ordered.splice(index, 1);
    ordered.splice(next, 0, moved);
    setColumnBusy(true);
    try {
      await reorderColumns(projectId, ordered);
    } finally {
      setColumnBusy(false);
    }
  }

  // Default / repair selected board members when project or team changes
  useEffect(() => {
    if (!members.length) {
      setBoardMemberIds([]);
      return;
    }
    const valid = boardMemberIds.filter((id) => members.some((m) => m.id === id));
    if (valid.length > 0) {
      if (valid.length !== boardMemberIds.length) setBoardMemberIds(valid);
      return;
    }
    const me = members.find(
      (m) =>
        m.email.toLowerCase() === (user?.email ?? '').toLowerCase() ||
        m.name.toLowerCase() === (user?.name ?? '').toLowerCase(),
    );
    setBoardMemberIds([me?.id ?? members[0].id]);
  }, [members, boardMemberIds, user?.email, user?.name]);

  const selectedMembers = useMemo(
    () => members.filter((m) => boardMemberIds.includes(m.id)),
    [members, boardMemberIds],
  );

  function toggleBoardMember(memberId: string) {
    setBoardMemberIds((prev) => {
      if (prev.includes(memberId)) {
        // Keep at least one selected
        if (prev.length <= 1) return prev;
        return prev.filter((id) => id !== memberId);
      }
      return [...prev, memberId];
    });
  }

  const boardLabel = useMemo(() => {
    if (selectedMembers.length === 0) return null;
    if (selectedMembers.length === members.length && members.length > 1) return 'Everyone';
    const names = selectedMembers.map((m) => {
      const isYou =
        m.email.toLowerCase() === (user?.email ?? '').toLowerCase() ||
        m.name.toLowerCase() === (user?.name ?? '').toLowerCase();
      return isYou ? 'You' : m.name.split(' ')[0];
    });
    if (names.length <= 2) return names.join(' + ');
    return `${names[0]} + ${names.length - 1} more`;
  }, [selectedMembers, members.length, user?.email, user?.name]);

  const defaultAssignee = useMemo(() => {
    const me = selectedMembers.find(
      (m) =>
        m.email.toLowerCase() === (user?.email ?? '').toLowerCase() ||
        m.name.toLowerCase() === (user?.name ?? '').toLowerCase(),
    );
    return me ?? selectedMembers[0] ?? null;
  }, [selectedMembers, user?.email, user?.name]);

  const boardTasks = useMemo(() => {
    if (!projectId || selectedMembers.length === 0) return [];
    return getProjectTasks(projectId).filter((t) =>
      selectedMembers.some((m) => isMemberBoardTask(t, m)),
    );
  }, [getProjectTasks, projectId, selectedMembers]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return boardTasks.filter((t) => {
      if (typeFilter !== 'all' && t.type !== typeFilter) return false;
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        t.key.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q)
      );
    });
  }, [boardTasks, query, typeFilter, priorityFilter, statusFilter]);

  const byStatus = useMemo(() => {
    const map: Record<string, BoardTask[]> = {};
    for (const col of columns) map[col.id] = [];
    for (const t of filtered) {
      if (!map[t.status]) map[t.status] = [];
      map[t.status].push(t);
    }
    return map;
  }, [filtered, columns]);

  const selected = useMemo(
    () => boardTasks.find((t) => t.id === selectedId) ?? null,
    [boardTasks, selectedId],
  );

  function allowDrop(e: DragEvent, status: TaskStatus) {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    if (dropTarget !== status) setDropTarget(status);
  }

  function leaveColumn(e: DragEvent, status: TaskStatus) {
    const related = e.relatedTarget as Node | null;
    if (related && e.currentTarget.contains(related)) return;
    setDropTarget((cur) => (cur === status ? null : cur));
  }

  async function handleDrop(e: DragEvent, status: TaskStatus) {
    e.preventDefault();
    e.stopPropagation();
    const id =
      draggingIdRef.current ||
      e.dataTransfer.getData('text/plain') ||
      e.dataTransfer.getData('text') ||
      draggingId;
    setDraggingId(null);
    draggingIdRef.current = null;
    setDropTarget(null);
    if (!id) return;

    const task = boardTasks.find((t) => t.id === id);
    if (task && task.status === status) return;

    // If a column filter is active, clear it so the moved card stays visible
    if (statusFilter !== 'all' && statusFilter !== status) {
      setStatusFilter('all');
    }

    try {
      await updateTaskStatus(id, status);
    } catch {
      /* WorkspaceContext reverts via refresh */
    }
  }

  function beginDrag(taskId: string) {
    draggingIdRef.current = taskId;
    setDraggingId(taskId);
  }

  function endDrag() {
    draggingIdRef.current = null;
    setDraggingId(null);
    setDropTarget(null);
  }

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-ink-200 bg-white px-4 py-2">
          <div className="flex items-center gap-1 rounded-lg border border-ink-200 bg-ink-50/80 p-0.5">
            {!checkedIn ? (
              <Button size="xs" onClick={() => void checkIn()}>
                Check in
              </Button>
            ) : (
              <>
                <Button size="xs" variant="ghost" onClick={toggleBreak}>
                  {onBreak ? 'End break' : 'Break'}
                </Button>
                <Button size="xs" variant="danger" onClick={() => void checkOut()}>
                  Check out
                </Button>
              </>
            )}
          </div>

          <div className="flex items-center gap-1 rounded-lg border border-ink-200 bg-ink-50/80 p-0.5">
            <Button
              size="xs"
              variant="ghost"
              disabled={!project}
              onClick={() => setShowInvite(true)}
            >
              Invite
            </Button>
            <Button size="xs" variant="ghost" onClick={() => setShowCreateProject(true)}>
              New project
            </Button>
            <Button size="xs" disabled={!project} onClick={() => setShowCreateTask(true)}>
              New task
            </Button>
            {canEditColumns ? (
              addingColumn ? (
                <form
                  onSubmit={(e) => void onAddColumn(e)}
                  className="flex items-center gap-1 pl-1"
                >
                  <input
                    ref={addColumnInputRef}
                    value={newColumnName}
                    onChange={(e) => setNewColumnName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setAddingColumn(false);
                        setNewColumnName('');
                      }
                    }}
                    placeholder="Column name"
                    disabled={columnBusy}
                    className="h-7 w-36 rounded-md border border-ink-200 bg-white px-2 text-xs outline-none focus:border-brand-500"
                  />
                  <Button
                    type="submit"
                    size="xs"
                    disabled={columnBusy || !newColumnName.trim()}
                  >
                    Add
                  </Button>
                  <Button
                    type="button"
                    size="xs"
                    variant="ghost"
                    disabled={columnBusy}
                    onClick={() => {
                      setAddingColumn(false);
                      setNewColumnName('');
                    }}
                  >
                    Cancel
                  </Button>
                </form>
              ) : (
                <Button
                  size="xs"
                  variant="ghost"
                  disabled={!project || columnBusy}
                  onClick={() => setAddingColumn(true)}
                >
                  Add column
                </Button>
              )
            ) : null}
          </div>

          <div className="ml-auto flex items-center gap-1.5 rounded-md border border-ink-200 bg-ink-50 px-2 py-1">
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                !checkedIn ? 'bg-ink-300' : onBreak ? 'bg-amber-500' : 'bg-emerald-500',
              )}
            />
            <span className="text-[11px] tabular-nums font-semibold text-ink-800">
              {checkedIn ? elapsedLabel : '00:00:00'}
            </span>
          </div>
        </div>

        {/* Project name + tabs + filters */}
        <div className="border-b border-ink-200 bg-white px-4 py-2.5">
          {project ? (
            <div className="mb-2 flex flex-wrap items-center gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink-900">{project.name}</p>
                <p className="text-[11px] text-ink-500">
                  {project.key}
                  {project.description ? ` · ${project.description}` : ''}
                  {boardLabel ? (
                    <>
                      {' '}
                      · Board:{' '}
                      <span className="font-semibold text-ink-700">{boardLabel}</span>
                    </>
                  ) : null}
                </p>
                <p className="text-[10px] text-ink-400">
                  Multi-select avatars to combine boards
                </p>
              </div>
              <div className="flex items-center" role="group" aria-label="Member boards">
                {members.map((m, i) => {
                  const active = boardMemberIds.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      title={
                        active
                          ? `Hide ${m.name}'s tasks (click again)`
                          : `Add ${m.name}'s tasks`
                      }
                      aria-pressed={active}
                      onClick={() => toggleBoardMember(m.id)}
                      style={{ zIndex: i + 1 }}
                      className={cn(
                        'relative h-8 w-8 shrink-0 rounded-full p-0 transition',
                        'shadow-[0_0_0_2px_#fff]',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-400',
                        i > 0 && '-ml-2.5',
                        active ? 'opacity-100' : 'opacity-40 hover:opacity-100',
                      )}
                    >
                      <UserAvatar
                        name={m.name}
                        src={m.avatarUrl}
                        seed={m.email || m.name}
                        size="md"
                        bare
                        className="!h-8 !w-8 !text-[9px]"
                      />
                      {active ? (
                        <span className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-ink-900" />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            {projects.length === 0 ? (
              <span className="text-xs text-ink-500">No projects</span>
            ) : (
              projects.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => selectProject(p.id)}
                  className={cn(
                    'px-2.5 py-1 text-left text-xs',
                    projectId === p.id
                      ? 'bg-ink-900 text-white'
                      : 'text-ink-600 hover:bg-ink-100',
                  )}
                >
                  <span className="font-semibold">{p.name}</span>
                  <span className={cn('ml-1.5', projectId === p.id ? 'text-white/70' : 'text-ink-400')}>
                    {p.key}
                  </span>
                </button>
              ))
            )}
            <div className="ml-auto flex flex-wrap items-center gap-1.5">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter…"
                className="h-8 w-36 border border-ink-200 bg-white px-2 text-xs outline-none focus:border-ink-400"
              />
              <div className="w-[110px]">
                <Select
                  size="xs"
                  value={typeFilter}
                  onChange={(v) => setTypeFilter(v as TaskType | 'all')}
                  options={[
                    { value: 'all', label: 'Type' },
                    ...TASK_TYPES.map((t) => ({ value: t.id, label: t.label })),
                  ]}
                  aria-label="Filter by type"
                />
              </div>
              <div className="w-[110px]">
                <Select
                  size="xs"
                  value={priorityFilter}
                  onChange={(v) => setPriorityFilter(v as TaskPriority | 'all')}
                  options={[
                    { value: 'all', label: 'Priority' },
                    ...TASK_PRIORITIES.map((p) => ({ value: p, label: p })),
                  ]}
                  aria-label="Filter by priority"
                />
              </div>
              <div className="w-[110px]">
                <Select
                  size="xs"
                  value={statusFilter}
                  onChange={setStatusFilter}
                  options={[
                    { value: 'all', label: 'Column' },
                    ...columns.map((c) => ({ value: c.id, label: c.label })),
                  ]}
                  aria-label="Filter by column"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Board */}
        <div className="min-h-0 flex-1 overflow-auto p-3">
          {!project ? (
            <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-ink-300 bg-white px-6 py-12 text-center">
              <p className="text-sm font-semibold text-ink-900">Create a project to begin</p>
              <Button className="mt-4" size="sm" onClick={() => setShowCreateProject(true)}>
                New project
              </Button>
            </div>
          ) : (
            <div
              className="grid h-full min-h-[420px] gap-3"
              style={{
                gridTemplateColumns: `repeat(${Math.max(columns.length, 1)}, minmax(220px, 1fr))`,
              }}
            >
              {columns.map((col, idx) => {
                const count = (byStatus[col.id] ?? []).length;
                const accents = [
                  'bg-ink-400',
                  'bg-amber-500',
                  'bg-sky-500',
                  'bg-emerald-500',
                  'bg-teal-600',
                ];
                const renaming = editingColumnId === col.id;
                return (
                  <section
                    key={col.id}
                    onDragOver={(e) => allowDrop(e, col.id)}
                    onDragEnter={(e) => allowDrop(e, col.id)}
                    onDragLeave={(e) => leaveColumn(e, col.id)}
                    onDrop={(e) => void handleDrop(e, col.id)}
                    className={cn(
                      'flex h-full min-h-0 flex-col rounded-xl border border-ink-200/90 bg-[#F7F8FA] transition',
                      dropTarget === col.id &&
                        'border-brand-600 bg-brand-50/40 ring-2 ring-brand-600/20',
                    )}
                  >
                    <div className="flex shrink-0 items-center justify-between gap-1 px-3 pt-3 pb-2">
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <span
                          className={cn(
                            'h-1.5 w-1.5 shrink-0 rounded-full',
                            col.accent || accents[idx % accents.length],
                          )}
                        />
                        {renaming ? (
                          <input
                            ref={renameInputRef}
                            value={editingColumnLabel}
                            onChange={(e) => setEditingColumnLabel(e.target.value)}
                            onBlur={() => void commitRenameColumn()}
                            onKeyDown={onRenameKeyDown}
                            disabled={columnBusy}
                            className="h-7 min-w-0 flex-1 rounded-md border border-brand-500 bg-white px-2 text-xs font-semibold text-ink-800 outline-none"
                            aria-label="Column name"
                          />
                        ) : (
                          <button
                            type="button"
                            title={canEditColumns ? 'Click to rename column' : col.label}
                            disabled={!canEditColumns}
                            onClick={() => beginRenameColumn(col.id, col.label)}
                            className={cn(
                              'min-w-0 truncate text-left text-xs font-semibold text-ink-800',
                              canEditColumns &&
                                'rounded px-1 -mx-1 hover:bg-white hover:ring-1 hover:ring-ink-200',
                            )}
                          >
                            {col.label}
                          </button>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-0.5">
                        <span className="inline-flex min-w-5 items-center justify-center rounded-md bg-white px-1.5 py-0.5 text-[10px] font-bold text-ink-600 ring-1 ring-ink-200/80">
                          {count}
                        </span>
                        {canEditColumns ? (
                          <>
                            <button
                              type="button"
                              title="Move column left"
                              disabled={columnBusy || idx === 0}
                              onClick={() => void onMoveColumn(col.id, -1)}
                              className="rounded px-1 text-[11px] font-bold text-ink-400 hover:bg-white hover:text-ink-700 disabled:opacity-30"
                            >
                              ‹
                            </button>
                            <button
                              type="button"
                              title="Move column right"
                              disabled={columnBusy || idx === columns.length - 1}
                              onClick={() => void onMoveColumn(col.id, 1)}
                              className="rounded px-1 text-[11px] font-bold text-ink-400 hover:bg-white hover:text-ink-700 disabled:opacity-30"
                            >
                              ›
                            </button>
                            {columns.length > 1 ? (
                              <button
                                type="button"
                                title="Remove column"
                                disabled={columnBusy}
                                onClick={() => requestRemoveColumn(col.id, col.label)}
                                className="rounded px-1 text-xs font-bold text-ink-400 hover:bg-white hover:text-red-600"
                              >
                                ×
                              </button>
                            ) : null}
                          </>
                        ) : null}
                      </div>
                    </div>
                    <div
                      className="flex min-h-[120px] flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2"
                      onDragOver={(e) => allowDrop(e, col.id)}
                      onDrop={(e) => void handleDrop(e, col.id)}
                    >
                      {(byStatus[col.id] ?? []).map((task) => (
                        <DashboardTaskCard
                          key={task.id}
                          task={task}
                          avatarUrl={avatarFromMembers(
                            members,
                            task.assigneeId,
                            task.assigneeName,
                          )}
                          dragging={draggingId === task.id}
                          onOpen={() => setSelectedId(task.id)}
                          onDragStart={beginDrag}
                          onDragEnd={endDrag}
                          onDropOnCard={(e) => void handleDrop(e, col.id)}
                        />
                      ))}
                      {count === 0 ? (
                        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-ink-200 bg-white/50 px-3 py-8">
                          <p className="text-center text-[11px] font-medium text-ink-400">
                            Drop tasks here
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Team members */}
      <aside className="flex w-60 shrink-0 flex-col border-l border-ink-200 bg-white">
        <div className="border-b border-ink-200 px-3 py-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[11px] font-medium tracking-wide text-ink-500 uppercase">
                Project
              </p>
              <p className="mt-0.5 truncate text-sm font-semibold text-ink-900">
                {project?.name ?? 'No project'}
              </p>
              {project ? (
                <p className="truncate text-[11px] text-ink-500">{project.key}</p>
              ) : null}
            </div>
            <button
              type="button"
              disabled={!project}
              onClick={() => setShowInvite(true)}
              className="shrink-0 text-xs font-semibold text-brand-800 disabled:opacity-40"
            >
              + Add
            </button>
          </div>
        </div>

        <div className="border-b border-ink-100 px-3 py-2">
          <p className="text-[11px] font-medium tracking-wide text-ink-500 uppercase">
            Team boards · {members.length}
          </p>
          <p className="mt-0.5 text-[11px] text-ink-400">
            Multi-select to combine · {selectedMembers.length} selected
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2">
          {!project ? (
            <p className="px-1 py-4 text-xs text-ink-400">Select or create a project.</p>
          ) : members.length === 0 ? (
            <p className="px-1 py-4 text-xs text-ink-400">No members yet.</p>
          ) : (
            <ul className="space-y-1">
              {members.map((m) => {
                const isYou =
                  m.email.toLowerCase() === (user?.email ?? '').toLowerCase() ||
                  m.name.toLowerCase() === (user?.name ?? '').toLowerCase();
                const active = boardMemberIds.includes(m.id);
                const count = getProjectTasks(project.id).filter((t) =>
                  isMemberBoardTask(t, m),
                ).length;
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => toggleBoardMember(m.id)}
                      aria-pressed={active}
                      title={active ? `Remove ${m.name}` : `Add ${m.name}`}
                      className={cn(
                        'flex w-full items-center gap-2.5 px-1.5 py-2 text-left transition',
                        active ? 'bg-ink-100' : 'hover:bg-ink-50',
                      )}
                    >
                      <span
                        className={cn(
                          'relative h-9 w-9 shrink-0 rounded-full',
                          active ? 'opacity-100' : 'opacity-45',
                        )}
                      >
                        <UserAvatar
                          name={m.name}
                          src={m.avatarUrl}
                          seed={m.email || m.name}
                          size="lg"
                          bare
                          className="!h-9 !w-9 !text-[11px]"
                        />
                        {active ? (
                          <span className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-ink-900" />
                        ) : null}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-ink-900">
                          {m.name}
                          {isYou ? (
                            <span className="ml-1 font-medium text-ink-400">(you)</span>
                          ) : null}
                        </p>
                        <p className="truncate text-[11px] text-ink-500">
                          {count} task{count === 1 ? '' : 's'} · {m.role}
                        </p>
                      </div>
                      <span
                        className={cn(
                          'flex h-4 w-4 shrink-0 items-center justify-center border text-[10px] font-bold',
                          active
                            ? 'border-ink-900 bg-ink-900 text-white'
                            : 'border-ink-300 text-transparent',
                        )}
                      >
                        ✓
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {project && selectedMembers.length > 0 ? (
          <p className="border-t border-ink-100 px-3 py-2 text-[11px] text-ink-400">
            {filtered.length} task{filtered.length === 1 ? '' : 's'} · {boardLabel}
          </p>
        ) : null}
      </aside>

      {showCreateProject ? (
        <CreateProjectModal
          onClose={() => setShowCreateProject(false)}
          onCreated={(id) => selectProject(id)}
        />
      ) : null}
      {showInvite && project ? (
        <InviteMembersModal project={project} onClose={() => setShowInvite(false)} />
      ) : null}
      {showCreateTask && projectId && defaultAssignee ? (
        <CreateTaskModal
          projectId={projectId}
          defaultAssignee={{ id: defaultAssignee.id, name: defaultAssignee.name }}
          onClose={() => setShowCreateTask(false)}
        />
      ) : null}
      {selected && project ? (
        <TaskDetailModal
          task={selected}
          projectName={project.name}
          columns={columns}
          onClose={() => setSelectedId(null)}
        />
      ) : null}

      <ConfirmModal
        open={Boolean(columnToRemove)}
        title="Remove column?"
        message={
          columnToRemove
            ? `Remove “${columnToRemove.label}”? Tasks in it will move to another column.`
            : ''
        }
        confirmLabel="Remove"
        danger
        busy={columnBusy}
        onCancel={() => setColumnToRemove(null)}
        onConfirm={() => confirmRemoveColumn()}
      />
    </div>
  );
}
