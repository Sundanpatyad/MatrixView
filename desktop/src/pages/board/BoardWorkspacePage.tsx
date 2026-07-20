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
import { ManageTeamsModal } from '@/components/board/ManageTeamsModal';
import { MemberBoardPicker } from '@/components/board/MemberBoardPicker';
import { ProjectAvatar } from '@/components/board/ProjectAvatar';
import { ProjectSelect } from '@/components/board/ProjectSelect';
import { TaskDetailModal } from '@/components/board/TaskDetailModal';
import { CreateProjectModal } from '@/components/dashboard/CreateProjectModal';
import { DashboardTaskCard } from '@/components/dashboard/DashboardTaskCard';
import { InviteMembersModal } from '@/components/dashboard/InviteMembersModal';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { IconUsers, IconX } from '@/components/ui/Icons';
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

/** 'all' = every task; 'global' = no team; otherwise a team id */
type TeamFilter = 'all' | 'global' | string;

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
    getProjectTeams,
    updateTaskStatus,
    addColumn,
    renameColumn,
    removeColumn,
    reorderColumns,
    isProjectAdmin,
    uploadProjectAvatar,
    removeProjectAvatar,
  } = useWorkspace();
  const { checkedIn, onBreak, elapsedLabel, checkIn, checkOut, toggleBreak } = useAttendance();

  const queryProjectId = searchParams.get('project') ?? '';
  const [projectId, setProjectId] = useState(queryProjectId || projects[0]?.id || '');
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<TaskType | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [teamFilter, setTeamFilter] = useState<TeamFilter>('all');

  const [showCreateProject, setShowCreateProject] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showTeams, setShowTeams] = useState(false);
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
  const [memberSearch, setMemberSearch] = useState('');
  const [sidebarMembersOpen, setSidebarMembersOpen] = useState(false);
  const [membersPanelOpen, setMembersPanelOpen] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const addColumnInputRef = useRef<HTMLInputElement>(null);
  const SIDEBAR_VISIBLE = 5;

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
  const projectTeams = useMemo(
    () => (projectId ? getProjectTeams(projectId) : []),
    [getProjectTeams, projectId],
  );
  const hasTeams = projectTeams.length > 0;
  const canEditColumns = Boolean(project && user && isProjectAdmin(project.id));

  useEffect(() => {
    setTeamFilter('all');
  }, [projectId]);

  useEffect(() => {
    if (teamFilter === 'all' || teamFilter === 'global') return;
    if (!projectTeams.some((t) => t.id === teamFilter)) setTeamFilter('all');
  }, [projectTeams, teamFilter]);

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

  const filteredSidebarMembers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q),
    );
  }, [members, memberSearch]);

  const isMemberSearching = memberSearch.trim().length > 0;
  const sidebarVisibleMembers =
    isMemberSearching || sidebarMembersOpen
      ? filteredSidebarMembers
      : filteredSidebarMembers.slice(0, SIDEBAR_VISIBLE);
  const sidebarOverflow =
    isMemberSearching || sidebarMembersOpen
      ? 0
      : Math.max(0, filteredSidebarMembers.length - SIDEBAR_VISIBLE);

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
    return getProjectTasks(projectId).filter((t) => {
      if (hasTeams) {
        if (teamFilter === 'global' && t.teamId) return false;
        if (teamFilter !== 'all' && teamFilter !== 'global' && t.teamId !== teamFilter) {
          return false;
        }
      }
      return selectedMembers.some((m) => isMemberBoardTask(t, m));
    });
  }, [getProjectTasks, projectId, selectedMembers, hasTeams, teamFilter]);

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
    <div className="relative flex h-full min-h-0 overflow-hidden">
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-ink-600 bg-ink-800 px-3 py-2 sm:px-4">
          <div className="flex items-center gap-1 rounded-lg border border-ink-600 bg-ink-900/80 p-0.5">
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
                  <span className="sm:hidden">Out</span>
                  <span className="hidden sm:inline">Check out</span>
                </Button>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1 rounded-lg border border-ink-600 bg-ink-900/80 p-0.5">
            <Button
              size="xs"
              variant="ghost"
              disabled={!project}
              onClick={() => setShowInvite(true)}
            >
              Invite
            </Button>
            <Button
              size="xs"
              variant="ghost"
              disabled={!project}
              onClick={() => setShowTeams(true)}
            >
              Teams
            </Button>
            <Button size="xs" variant="ghost" onClick={() => setShowCreateProject(true)}>
              <span className="sm:hidden">New</span>
              <span className="hidden sm:inline">New project</span>
            </Button>
            <Button size="xs" disabled={!project} onClick={() => setShowCreateTask(true)}>
              <span className="sm:hidden">Task</span>
              <span className="hidden sm:inline">New task</span>
            </Button>
            {canEditColumns ? (
              addingColumn ? (
                <form
                  onSubmit={(e) => void onAddColumn(e)}
                  className="flex max-w-full flex-wrap items-center gap-1 pl-1"
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
                    className="h-7 w-28 rounded-md border border-ink-600 bg-ink-800 px-2 text-xs outline-none focus:border-brand-500 sm:w-36"
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
                  className="hidden sm:inline-flex"
                >
                  Add column
                </Button>
              )
            ) : null}
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <Button
              size="xs"
              variant="secondary"
              disabled={!project}
              onClick={() => setMembersPanelOpen(true)}
              className="lg:hidden"
              title="Project & members"
            >
              <IconUsers className="h-3.5 w-3.5" />
              Members
            </Button>
            <div className="hidden items-center gap-1.5 rounded-md border border-ink-600 bg-ink-900 px-2 py-1 sm:flex">
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  !checkedIn ? 'bg-ink-300' : onBreak ? 'bg-[#f0b232]' : 'bg-[#23a559]',
                )}
              />
              <span className="text-[11px] font-semibold tabular-nums text-ink-100">
                {checkedIn ? elapsedLabel : '00:00:00'}
              </span>
            </div>
          </div>
        </div>

        {/* Project overview + filters */}
        <div className="border-b border-ink-600 bg-ink-800 px-3 py-3 sm:px-4">
          {project ? (
            <div className="flex flex-col gap-3 border-b border-ink-600/80 pb-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <ProjectAvatar
                  name={project.name}
                  avatarUrl={project.avatarUrl}
                  size="md"
                  editable={canEditColumns}
                  busy={avatarBusy}
                  onUpload={async (file) => {
                    setAvatarBusy(true);
                    try {
                      await uploadProjectAvatar(project.id, file);
                    } finally {
                      setAvatarBusy(false);
                    }
                  }}
                  onRemove={async () => {
                    setAvatarBusy(true);
                    try {
                      await removeProjectAvatar(project.id);
                    } finally {
                      setAvatarBusy(false);
                    }
                  }}
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="truncate text-base font-bold text-ink-50">{project.name}</h1>
                    <span className="rounded-md border border-brand-500/25 bg-brand-500/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-brand-600 uppercase dark:text-brand-300">
                      {project.key}
                    </span>
                  </div>
                  <p className="mt-0.5 max-w-2xl truncate text-xs text-ink-300">
                    {project.description || 'Organize, assign, and track work across the team.'}
                  </p>
                  {canEditColumns ? (
                    <p className="mt-1 hidden text-[10px] font-medium text-ink-400 sm:block">
                      Click the image to add, change, or remove
                    </p>
                  ) : null}
                  {boardLabel ? (
                    <p className="mt-1 text-[11px] font-medium text-ink-400">
                      Viewing <span className="text-ink-200">{boardLabel}</span>
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="hidden shrink-0 items-center gap-3 rounded-xl border border-ink-600 bg-ink-900/70 px-3 py-2 md:flex">
                <MemberBoardPicker
                  members={members}
                  selectedIds={boardMemberIds}
                  onToggle={toggleBoardMember}
                />
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-2 pt-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_auto]">
              <ProjectSelect
                projects={projects}
                value={projectId}
                onChange={selectProject}
                placeholder="Select project"
                className="w-full min-w-0 max-w-none"
              />
              {hasTeams ? (
                <div className="min-w-0 sm:max-w-[200px]">
                  <Select
                    size="xs"
                    value={teamFilter}
                    onChange={(v) => setTeamFilter(v as TeamFilter)}
                    options={[
                      { value: 'all', label: 'All teams' },
                      { value: 'global', label: 'Project-wide' },
                      ...projectTeams.map((t) => ({ value: t.id, label: t.name })),
                    ]}
                    aria-label="Filter by team"
                  />
                </div>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
              <label className="relative col-span-2 min-w-0 flex-1 sm:min-w-44 sm:max-w-xs">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-ink-400"
                  aria-hidden
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search tasks…"
                  className="h-9 w-full rounded-lg border border-ink-600 bg-ink-900 pr-3 pl-9 text-xs text-ink-50 outline-none transition placeholder:text-ink-400 hover:border-ink-500 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15"
                />
              </label>
              <div className="min-w-0 sm:w-[120px]">
                <Select
                  size="sm"
                  className="rounded-lg bg-ink-900"
                  value={typeFilter}
                  onChange={(v) => setTypeFilter(v as TaskType | 'all')}
                  options={[
                    { value: 'all', label: 'Type' },
                    ...TASK_TYPES.map((t) => ({ value: t.id, label: t.label })),
                  ]}
                  aria-label="Filter by type"
                />
              </div>
              <div className="min-w-0 sm:w-[120px]">
                <Select
                  size="sm"
                  className="rounded-lg bg-ink-900"
                  value={priorityFilter}
                  onChange={(v) => setPriorityFilter(v as TaskPriority | 'all')}
                  options={[
                    { value: 'all', label: 'Priority' },
                    ...TASK_PRIORITIES.map((p) => ({ value: p, label: p })),
                  ]}
                  aria-label="Filter by priority"
                />
              </div>
              <div className="col-span-2 min-w-0 sm:col-span-1 sm:w-[120px]">
                <Select
                  size="sm"
                  className="rounded-lg bg-ink-900"
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

        {/* Board — horizontal scroll of fixed-width columns */}
        <div className="min-h-0 flex-1 overflow-auto p-2 sm:p-3">
          {!project ? (
            <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-ink-500 bg-ink-800 px-6 py-12 text-center">
              <p className="text-sm font-semibold text-ink-50">Create a project to begin</p>
              <Button className="mt-4" size="sm" onClick={() => setShowCreateProject(true)}>
                New project
              </Button>
            </div>
          ) : (
            <div className="flex h-full min-h-[380px] gap-3">
              {columns.map((col, idx) => {
                const count = (byStatus[col.id] ?? []).length;
                const accents = [
                  'bg-ink-400',
                  'bg-[#f0b232]',
                  'bg-[#00a8fc]',
                  'bg-[#23a559]',
                  'bg-brand-500',
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
                      'flex h-full min-h-0 w-[min(85vw,280px)] shrink-0 flex-col rounded-xl border border-ink-600/90 bg-ink-900 transition sm:w-[260px]',
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
                            className="h-7 min-w-0 flex-1 rounded-md border border-brand-500 bg-ink-800 px-2 text-xs font-semibold text-ink-100 outline-none"
                            aria-label="Column name"
                          />
                        ) : (
                          <button
                            type="button"
                            title={canEditColumns ? 'Click to rename column' : col.label}
                            disabled={!canEditColumns}
                            onClick={() => beginRenameColumn(col.id, col.label)}
                            className={cn(
                              'min-w-0 truncate text-left text-xs font-semibold text-ink-100',
                              canEditColumns &&
                                'rounded px-1 -mx-1 hover:bg-ink-800 hover:ring-1 hover:ring-ink-600',
                            )}
                          >
                            {col.label}
                          </button>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-0.5">
                        <span className="inline-flex min-w-5 items-center justify-center rounded-md bg-ink-800 px-1.5 py-0.5 text-[10px] font-bold text-ink-200 ring-1 ring-ink-600/80">
                          {count}
                        </span>
                        {canEditColumns ? (
                          <>
                            <button
                              type="button"
                              title="Move column left"
                              disabled={columnBusy || idx === 0}
                              onClick={() => void onMoveColumn(col.id, -1)}
                              className="rounded px-1 text-[11px] font-bold text-ink-400 hover:bg-ink-800 hover:text-ink-200 disabled:opacity-30"
                            >
                              ‹
                            </button>
                            <button
                              type="button"
                              title="Move column right"
                              disabled={columnBusy || idx === columns.length - 1}
                              onClick={() => void onMoveColumn(col.id, 1)}
                              className="rounded px-1 text-[11px] font-bold text-ink-400 hover:bg-ink-800 hover:text-ink-200 disabled:opacity-30"
                            >
                              ›
                            </button>
                            {columns.length > 1 ? (
                              <button
                                type="button"
                                title="Remove column"
                                disabled={columnBusy}
                                onClick={() => requestRemoveColumn(col.id, col.label)}
                                className="rounded px-1 text-xs font-bold text-ink-400 hover:bg-ink-800 hover:text-[#ed4245]"
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
                        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-ink-600 bg-ink-800/50 px-3 py-8">
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

      {membersPanelOpen ? (
        <button
          type="button"
          aria-label="Close members panel"
          className="absolute inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setMembersPanelOpen(false)}
        />
      ) : null}

      <aside
        className={cn(
          'flex w-[min(18rem,92vw)] shrink-0 flex-col border-l border-ink-600 bg-ink-800',
          'absolute inset-y-0 right-0 z-40 shadow-xl transition-transform duration-200 ease-out',
          'lg:static lg:z-auto lg:w-60 lg:translate-x-0 lg:shadow-none lg:pointer-events-auto',
          membersPanelOpen
            ? 'translate-x-0'
            : 'pointer-events-none translate-x-full max-lg:translate-x-full',
        )}
      >
        <div className="border-b border-ink-600 px-3 py-3">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[11px] font-medium tracking-wide text-ink-300 uppercase">
              Project
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!project}
                onClick={() => setShowInvite(true)}
                className="shrink-0 text-xs font-semibold text-brand-800 disabled:opacity-40"
              >
                + Add
              </button>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setMembersPanelOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-ink-400 hover:bg-ink-700 hover:text-ink-100 lg:hidden"
              >
                <IconX className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="mt-2">
            <ProjectSelect
              projects={projects}
              value={projectId}
              onChange={(id) => {
                selectProject(id);
                setMembersPanelOpen(false);
              }}
              className="w-full min-w-0 max-w-none"
              placeholder="Select project"
            />
          </div>
        </div>

        <div className="border-b border-ink-700 px-3 py-2">
          <p className="text-[11px] font-medium tracking-wide text-ink-300 uppercase">
            Team boards · {members.length}
          </p>
          <p className="mt-0.5 text-[11px] text-ink-400">
            Multi-select to combine · {selectedMembers.length} selected
          </p>
          <label className="relative mt-2 block">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-ink-400"
              aria-hidden
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              value={memberSearch}
              onChange={(e) => {
                setMemberSearch(e.target.value);
                setSidebarMembersOpen(false);
              }}
              placeholder="Search members…"
              className="h-8 w-full rounded-lg border border-ink-600 bg-ink-900 pr-2 pl-8 text-xs text-ink-50 outline-none placeholder:text-ink-400 focus:border-brand-500"
            />
          </label>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2">
          {!project ? (
            <p className="px-1 py-4 text-xs text-ink-400">Select or create a project.</p>
          ) : members.length === 0 ? (
            <p className="px-1 py-4 text-xs text-ink-400">No members yet.</p>
          ) : filteredSidebarMembers.length === 0 ? (
            <p className="px-1 py-4 text-xs text-ink-400">No members match.</p>
          ) : (
            <ul className="space-y-1">
              {sidebarVisibleMembers.map((m) => {
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
                        'flex w-full items-center gap-2.5 rounded-lg px-1.5 py-2 text-left transition',
                        active ? 'bg-brand-500/10' : 'hover:bg-ink-700',
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
                          <span className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-ink-800 bg-brand-500" />
                        ) : null}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-ink-50">
                          {m.name}
                          {isYou ? (
                            <span className="ml-1 font-medium text-ink-400">(you)</span>
                          ) : null}
                        </p>
                        <p className="truncate text-[11px] text-ink-300">
                          {count} task{count === 1 ? '' : 's'} · {m.role}
                        </p>
                      </div>
                      <span
                        className={cn(
                          'flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] font-bold',
                          active
                            ? 'border-brand-500 bg-brand-500 text-white'
                            : 'border-ink-500 text-transparent',
                        )}
                      >
                        ✓
                      </span>
                    </button>
                  </li>
                );
              })}
              {!sidebarMembersOpen && sidebarOverflow > 0 ? (
                <li>
                  <button
                    type="button"
                    onClick={() => setSidebarMembersOpen(true)}
                    className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-ink-600 px-2 py-2 text-xs font-semibold text-ink-200 transition hover:border-brand-500 hover:bg-brand-500/10 hover:text-brand-600 dark:hover:text-brand-300"
                  >
                    +{sidebarOverflow} more
                  </button>
                </li>
              ) : null}
              {sidebarMembersOpen &&
              !isMemberSearching &&
              filteredSidebarMembers.length > SIDEBAR_VISIBLE ? (
                <li>
                  <button
                    type="button"
                    onClick={() => setSidebarMembersOpen(false)}
                    className="mt-1 flex w-full items-center justify-center rounded-lg px-2 py-1.5 text-[11px] font-semibold text-ink-400 hover:text-ink-200"
                  >
                    Show less
                  </button>
                </li>
              ) : null}
            </ul>
          )}
        </div>

        {project && selectedMembers.length > 0 ? (
          <p className="border-t border-ink-700 px-3 py-2 text-[11px] text-ink-400">
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
      {showTeams && projectId ? (
        <ManageTeamsModal projectId={projectId} onClose={() => setShowTeams(false)} />
      ) : null}
      {showCreateTask && projectId && defaultAssignee ? (
        <CreateTaskModal
          projectId={projectId}
          defaultAssignee={{ id: defaultAssignee.id, name: defaultAssignee.name }}
          defaultTeamId={
            hasTeams && teamFilter !== 'all' && teamFilter !== 'global' ? teamFilter : null
          }
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
