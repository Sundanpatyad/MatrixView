import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CreateTaskModal } from '@/components/board/CreateTaskModal';
import { ManageTeamsModal } from '@/components/board/ManageTeamsModal';
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
import { useAuth } from '@/lib/auth/AuthContext';
import { cn } from '@/lib/cn';
import { useToast } from '@/lib/toast/ToastContext';
import {
  isTaskAssignedTo,
  isTaskAssignedToUser,
  isUnassigned,
  memberForUser,
} from '@/lib/workspace/taskHelpers';
import {
  TASK_PRIORITIES,
  TASK_TYPES,
  type BoardTask,
  type ProjectMember,
  type TaskPriority,
  type TaskStatus,
  type TaskType,
} from '@/lib/workspace/types';
import { useWorkspace } from '@/lib/workspace/WorkspaceContext';

/** 'all' = every task; 'global' = no group; otherwise a group id */
type GroupFilter = 'all' | 'global' | string;
/** everyone = full project; me / unassigned / member id */
type AssigneeFilter = 'everyone' | 'me' | 'unassigned' | string;

export function BoardWorkspacePage() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
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
    removeMember,
  } = useWorkspace();

  const queryProjectId = searchParams.get('project') ?? '';
  const queryTaskId = searchParams.get('task') ?? '';
  const queryAssignee = searchParams.get('assignee') ?? 'everyone';
  const queryGroup = searchParams.get('group') ?? 'all';
  const [projectId, setProjectId] = useState(queryProjectId || projects[0]?.id || '');
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<TaskType | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [groupFilter, setGroupFilter] = useState<GroupFilter>(queryGroup);
  const [assigneeFilter, setAssigneeFilter] = useState<AssigneeFilter>(
    queryAssignee || 'everyone',
  );
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [showCreateProject, setShowCreateProject] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showTeams, setShowTeams] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(queryTaskId || null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<TaskStatus | null>(null);
  const draggingIdRef = useRef<string | null>(null);
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
  const [editingColumnLabel, setEditingColumnLabel] = useState('');
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [columnBusy, setColumnBusy] = useState(false);
  const [columnToRemove, setColumnToRemove] = useState<{ id: string; label: string } | null>(
    null,
  );
  const [membersPanelOpen, setMembersPanelOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<ProjectMember | null>(null);
  const [removingMember, setRemovingMember] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const addColumnInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const stillHasQuery = Boolean(
      queryProjectId && projects.some((p) => p.id === queryProjectId),
    );
    if (stillHasQuery) {
      setProjectId(queryProjectId);
      return;
    }

    if (queryProjectId) {
      const next = new URLSearchParams(searchParams);
      next.delete('project');
      next.delete('task');
      setSearchParams(next, { replace: true });
      setSelectedId(null);
      setProjectId(projects[0]?.id ?? '');
      return;
    }

    if (!projectId && projects[0]) setProjectId(projects[0].id);
    if (projectId && !projects.some((p) => p.id === projectId)) {
      setProjectId(projects[0]?.id ?? '');
      setSelectedId(null);
    }
  }, [projects, projectId, queryProjectId, searchParams, setSearchParams]);

  useEffect(() => {
    if (!queryTaskId) return;
    setSelectedId(queryTaskId);
  }, [queryTaskId]);

  function writeBoardParams(patch: {
    project?: string;
    task?: string | null;
    assignee?: AssigneeFilter;
    group?: GroupFilter;
  }) {
    const next = new URLSearchParams(searchParams);
    const project = patch.project ?? projectId;
    if (project) next.set('project', project);
    else next.delete('project');

    const task = patch.task !== undefined ? patch.task : selectedId;
    if (task) next.set('task', task);
    else next.delete('task');

    const assignee = patch.assignee ?? assigneeFilter;
    if (assignee && assignee !== 'everyone') next.set('assignee', assignee);
    else next.delete('assignee');

    const group = patch.group ?? groupFilter;
    if (group && group !== 'all') next.set('group', group);
    else next.delete('group');

    setSearchParams(next, { replace: true });
  }

  function selectProject(id: string) {
    setProjectId(id);
    setAssigneeFilter('everyone');
    setGroupFilter('all');
    writeBoardParams({ project: id, assignee: 'everyone', group: 'all', task: null });
  }

  function openTask(id: string | null) {
    setSelectedId(id);
    writeBoardParams({ task: id });
  }

  function onAssigneeChange(value: AssigneeFilter) {
    setAssigneeFilter(value);
    writeBoardParams({ assignee: value });
  }

  function onGroupChange(value: GroupFilter) {
    setGroupFilter(value);
    writeBoardParams({ group: value });
  }

  const project = projectId ? getProject(projectId) : undefined;
  const columns = project?.columns ?? [];
  const members = project?.members ?? [];
  const projectTeams = useMemo(
    () => (projectId ? getProjectTeams(projectId) : []),
    [getProjectTeams, projectId],
  );
  const hasGroups = projectTeams.length > 0;
  const canEditColumns = Boolean(project && user && isProjectAdmin(project.id));
  const canManageProject = Boolean(project && user && isProjectAdmin(project.id));
  const meMember = memberForUser(project, user);

  const groupNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of projectTeams) map.set(t.id, t.name);
    return map;
  }, [projectTeams]);

  useEffect(() => {
    if (groupFilter === 'all' || groupFilter === 'global') return;
    if (!projectTeams.some((t) => t.id === groupFilter)) setGroupFilter('all');
  }, [projectTeams, groupFilter]);

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

  // Keep assignee filter valid when members change
  useEffect(() => {
    if (
      assigneeFilter === 'everyone' ||
      assigneeFilter === 'me' ||
      assigneeFilter === 'unassigned'
    ) {
      return;
    }
    if (!members.some((m) => m.id === assigneeFilter)) setAssigneeFilter('everyone');
  }, [members, assigneeFilter]);

  const selectedMember = useMemo(() => {
    if (assigneeFilter === 'me') return meMember;
    if (assigneeFilter === 'everyone' || assigneeFilter === 'unassigned') return null;
    return members.find((m) => m.id === assigneeFilter) ?? null;
  }, [assigneeFilter, meMember, members]);

  const boardLabel = useMemo(() => {
    const parts: string[] = [];
    if (hasGroups && groupFilter !== 'all' && groupFilter !== 'global') {
      parts.push(groupNameById.get(groupFilter) ?? 'Group');
    } else if (groupFilter === 'global') {
      parts.push('No group');
    }
    if (assigneeFilter === 'me') parts.push('Assigned to you');
    else if (assigneeFilter === 'unassigned') parts.push('Unassigned');
    else if (selectedMember) parts.push(`Assigned to ${selectedMember.name.split(' ')[0]}`);
    else parts.push('Everyone');
    return parts.join(' · ');
  }, [hasGroups, groupFilter, groupNameById, assigneeFilter, selectedMember]);

  const defaultAssignee = useMemo(() => {
    if (selectedMember) return selectedMember;
    return meMember;
  }, [selectedMember, meMember]);

  const boardTasks = useMemo(() => {
    if (!projectId) return [];
    return getProjectTasks(projectId).filter((t) => {
      if (hasGroups) {
        if (groupFilter === 'global' && t.teamId) return false;
        if (groupFilter !== 'all' && groupFilter !== 'global' && t.teamId !== groupFilter) {
          return false;
        }
      }
      if (assigneeFilter === 'everyone') return true;
      if (assigneeFilter === 'unassigned') return isUnassigned(t);
      if (assigneeFilter === 'me') return isTaskAssignedToUser(t, user, project);
      return isTaskAssignedTo(t, selectedMember);
    });
  }, [
    getProjectTasks,
    projectId,
    hasGroups,
    groupFilter,
    assigneeFilter,
    user,
    project,
    selectedMember,
  ]);

  function viewGroupOnBoard(teamId: string) {
    setGroupFilter(teamId);
    writeBoardParams({ group: teamId });
    setShowTeams(false);
  }

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
    () =>
      projectId
        ? (getProjectTasks(projectId).find((t) => t.id === selectedId) ?? null)
        : null,
    [getProjectTasks, projectId, selectedId],
  );

  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || el?.isContentEditable) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') return;
      if (e.key === '/' ) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
      if (e.key.toLowerCase() === 'c' && projectId) {
        e.preventDefault();
        setShowCreateTask(true);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [projectId]);

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

  // Soft empty board — no selects/panels/overlays that can trap navigation.
  if (projects.length === 0) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-ink-600 bg-ink-800 px-3 py-2.5 sm:px-4">
          <Button size="sm" onClick={() => setShowCreateProject(true)}>
            New project
          </Button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="text-sm font-semibold text-ink-50">No project yet</p>
          <p className="max-w-sm text-xs leading-relaxed text-ink-400">
            Create a project, invite people, then add tasks. Assigned work also shows on My Work.
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
            <Button size="sm" onClick={() => setShowCreateProject(true)}>
              New project
            </Button>
            <Button size="sm" variant="secondary" onClick={() => navigate('/')}>
              My Work
            </Button>
          </div>
        </div>
        {showCreateProject ? (
          <CreateProjectModal
            onClose={() => setShowCreateProject(false)}
            onCreated={(id) => {
              selectProject(id);
              setShowCreateProject(false);
            }}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-0 overflow-hidden">
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Toolbar */}
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-ink-600 bg-ink-800 px-3 py-2.5 sm:px-4">
          <div className="flex flex-wrap items-center gap-1.5">
            {canManageProject ? (
              <Button
                size="sm"
                variant="secondary"
                disabled={!project}
                onClick={() => setShowInvite(true)}
              >
                Invite
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="secondary"
              disabled={!project}
              onClick={() => setShowTeams(true)}
            >
              Groups
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setShowCreateProject(true)}>
              <span className="sm:hidden">New</span>
              <span className="hidden sm:inline">New project</span>
            </Button>
            <Button size="sm" disabled={!project} onClick={() => setShowCreateTask(true)}>
              <span className="sm:hidden">Task</span>
              <span className="hidden sm:inline">New task</span>
            </Button>
            {canEditColumns ? (
              addingColumn ? (
                <form
                  onSubmit={(e) => void onAddColumn(e)}
                  className="flex max-w-full flex-wrap items-center gap-1.5"
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
                    className="h-8 w-28 rounded-md border border-ink-600 bg-ink-900 px-2.5 text-xs text-ink-50 outline-none focus:border-brand-500 sm:w-36"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    disabled={columnBusy || !newColumnName.trim()}
                  >
                    Add
                  </Button>
                  <Button
                    type="button"
                    size="sm"
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
                  size="sm"
                  variant="secondary"
                  disabled={!project || columnBusy}
                  onClick={() => setAddingColumn(true)}
                  className="hidden sm:inline-flex"
                >
                  Add column
                </Button>
              )
            ) : null}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={!project}
              onClick={() => setMembersPanelOpen(true)}
              title="People on this project"
            >
              <IconUsers className="h-3.5 w-3.5" />
              People
            </Button>
          </div>
        </div>

        {/* Project chrome + filters — hide filters until a project exists */}
        <div className="shrink-0 border-b border-ink-600 bg-ink-800 px-3 py-2.5 sm:px-4">
            <div className={cn('flex items-center gap-2.5', project && 'mb-2.5')}>
              {project ? (
                <ProjectAvatar
                  name={project.name}
                  avatarUrl={project.avatarUrl}
                  size="sm"
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
              ) : null}
              <div className="min-w-0 flex-1">
                <ProjectSelect
                  projects={projects}
                  value={projectId}
                  onChange={selectProject}
                  placeholder="Select project"
                  compact
                  hideAvatar
                  className="max-w-full"
                />
                {boardLabel ? (
                  <p className="mt-0.5 truncate text-[12px] text-ink-400">
                    Viewing <span className="font-medium text-ink-200">{boardLabel}</span>
                  </p>
                ) : null}
              </div>
            </div>

            {project ? (
              <div className="flex items-center gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="w-[148px] shrink-0">
                  <Select
                    size="sm"
                    value={assigneeFilter}
                    onChange={(v) => onAssigneeChange(v as AssigneeFilter)}
                    options={[
                      { value: 'everyone', label: 'Everyone' },
                      { value: 'me', label: 'Assigned to me' },
                      { value: 'unassigned', label: 'Unassigned' },
                      ...members
                        .filter((m) => m.status !== 'pending')
                        .map((m) => ({
                          value: m.id,
                          label:
                            meMember?.id === m.id ? `${m.name} (you)` : m.name,
                        })),
                    ]}
                    aria-label="Assigned to"
                  />
                </div>
                {hasGroups ? (
                  <div className="w-[132px] shrink-0">
                    <Select
                      size="sm"
                      value={groupFilter}
                      onChange={(v) => onGroupChange(v as GroupFilter)}
                      options={[
                        { value: 'all', label: 'All groups' },
                        { value: 'global', label: 'No group' },
                        ...projectTeams.map((t) => ({ value: t.id, label: t.name })),
                      ]}
                      aria-label="Filter by group"
                    />
                  </div>
                ) : null}
                <label className="relative min-w-[160px] flex-1 sm:max-w-[220px]">
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
                    ref={searchInputRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search tasks…  /"
                    className="h-8 w-full rounded-md border border-ink-600 bg-ink-900 pr-2.5 pl-8 text-xs text-ink-50 outline-none placeholder:text-ink-400 focus:border-brand-500"
                  />
                </label>
                <div className="w-[100px] shrink-0">
                  <Select
                    size="sm"
                    value={typeFilter}
                    onChange={(v) => setTypeFilter(v as TaskType | 'all')}
                    options={[
                      { value: 'all', label: 'Type' },
                      ...TASK_TYPES.map((t) => ({ value: t.id, label: t.label })),
                    ]}
                    aria-label="Filter by type"
                  />
                </div>
                <div className="w-[110px] shrink-0">
                  <Select
                    size="sm"
                    value={priorityFilter}
                    onChange={(v) => setPriorityFilter(v as TaskPriority | 'all')}
                    options={[
                      { value: 'all', label: 'Priority' },
                      ...TASK_PRIORITIES.map((p) => ({ value: p, label: p })),
                    ]}
                    aria-label="Filter by priority"
                  />
                </div>
                <div className="w-[110px] shrink-0">
                  <Select
                    size="sm"
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
            ) : null}
        </div>

        {/* Board fills remaining viewport */}
        <div className="min-h-0 flex-1 overflow-hidden p-2 sm:p-2.5">
            {!project ? (
              <div className="flex h-full flex-col items-center justify-center border border-dashed border-ink-600 bg-ink-800/60 px-6 py-12 text-center">
                <p className="text-sm font-semibold text-ink-50">No project yet</p>
                <p className="mt-1 max-w-sm text-xs leading-relaxed text-ink-400">
                  Boards need a project. Chat and My Work work without one.
                </p>
                <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                  <Button size="sm" onClick={() => setShowCreateProject(true)}>
                    New project
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => navigate('/')}>
                    My Work
                  </Button>
                </div>
              </div>
            ) : (
              <div
                className={cn(
                  'flex h-full min-h-0 gap-2 overflow-x-auto overflow-y-hidden sm:gap-2.5',
                  columns.length <= 6 && 'md:overflow-x-hidden',
                )}
              >
                {columns.map((col, idx) => {
                  const count = (byStatus[col.id] ?? []).length;
                  const accents = [
                    'bg-ink-400',
                    'bg-[#f0b232]',
                    'bg-[#00a8fc]',
                    'bg-[#4BDE80]',
                    'bg-brand-500',
                  ];
                  const renaming = editingColumnId === col.id;
                  const fillWidth = columns.length <= 6;
                  return (
                    <section
                      key={col.id}
                      onDragOver={(e) => allowDrop(e, col.id)}
                      onDragEnter={(e) => allowDrop(e, col.id)}
                      onDragLeave={(e) => leaveColumn(e, col.id)}
                      onDrop={(e) => void handleDrop(e, col.id)}
                      className={cn(
                        'flex h-full min-h-0 flex-col rounded-md border border-ink-600 bg-ink-900/80 transition-colors',
                        'w-[min(82vw,260px)] shrink-0',
                        fillWidth
                          ? 'md:w-auto md:min-w-0 md:flex-1 md:shrink'
                          : 'md:w-[calc((100%-5*0.625rem)/6)] md:min-w-[calc((100%-5*0.625rem)/6)] md:shrink-0',
                        dropTarget === col.id &&
                          'border-brand-500 bg-brand-500/5',
                      )}
                    >
                    <div className="flex shrink-0 items-center justify-between gap-1.5 border-b border-ink-700/70 px-2.5 py-2">
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
                            className="h-7 min-w-0 flex-1 rounded-md border border-brand-500 bg-ink-800 px-2 text-[13px] font-semibold text-ink-50 outline-none"
                            aria-label="Column name"
                          />
                        ) : (
                          <button
                            type="button"
                            title={canEditColumns ? 'Click to rename column' : col.label}
                            disabled={!canEditColumns}
                            onClick={() => beginRenameColumn(col.id, col.label)}
                            className={cn(
                              'min-w-0 truncate text-left text-[13px] font-semibold text-ink-50',
                              canEditColumns &&
                                'rounded-md px-1 -mx-1 hover:bg-ink-800',
                            )}
                          >
                            {col.label}
                          </button>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-0.5">
                        <span className="inline-flex min-w-5 items-center justify-center rounded-md bg-ink-800 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-ink-300">
                          {count}
                        </span>
                        {canEditColumns ? (
                          <>
                            <button
                              type="button"
                              title="Move column left"
                              disabled={columnBusy || idx === 0}
                              onClick={() => void onMoveColumn(col.id, -1)}
                              className="flex h-6 w-6 items-center justify-center rounded-md text-ink-400 hover:bg-ink-800 hover:text-ink-200 disabled:opacity-30"
                            >
                              ‹
                            </button>
                            <button
                              type="button"
                              title="Move column right"
                              disabled={columnBusy || idx === columns.length - 1}
                              onClick={() => void onMoveColumn(col.id, 1)}
                              className="flex h-6 w-6 items-center justify-center rounded-md text-ink-400 hover:bg-ink-800 hover:text-ink-200 disabled:opacity-30"
                            >
                              ›
                            </button>
                            {columns.length > 1 ? (
                              <button
                                type="button"
                                title="Remove column"
                                disabled={columnBusy}
                                onClick={() => requestRemoveColumn(col.id, col.label)}
                                className="flex h-6 w-6 items-center justify-center rounded-md text-ink-400 hover:bg-ink-800 hover:text-[#ed4245]"
                              >
                                ×
                              </button>
                            ) : null}
                          </>
                        ) : null}
                      </div>
                    </div>
                    <div
                      className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-2 py-2"
                      onDragOver={(e) => allowDrop(e, col.id)}
                      onDrop={(e) => void handleDrop(e, col.id)}
                    >
                      {(byStatus[col.id] ?? []).map((task) => (
                        <DashboardTaskCard
                          key={task.id}
                          task={task}
                          teamName={
                            task.teamId ? groupNameById.get(task.teamId) ?? null : null
                          }
                          avatarUrl={avatarFromMembers(
                            members,
                            task.assigneeId,
                            task.assigneeName,
                          )}
                          dragging={draggingId === task.id}
                          onOpen={() => openTask(task.id)}
                          onDragStart={beginDrag}
                          onDragEnd={endDrag}
                          onDropOnCard={(e) => void handleDrop(e, col.id)}
                        />
                      ))}
                      {count === 0 ? (
                        <div className="flex min-h-[5.5rem] flex-1 items-center justify-center border border-dashed border-ink-600 px-3 py-4">
                          <p className="text-center text-[12px] font-medium text-ink-400">
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
        <>
          <button
            type="button"
            aria-label="Close people panel"
            className="absolute inset-0 z-30 bg-black/50"
            onClick={() => setMembersPanelOpen(false)}
          />
          <aside className="absolute inset-y-0 right-0 z-40 flex w-[min(18rem,92vw)] flex-col border-l border-ink-600 bg-ink-800 sm:w-60">
            <div className="border-b border-ink-600 px-3 py-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[11px] font-medium tracking-wide text-ink-300 uppercase">
                    People
                  </p>
                  <p className="mt-0.5 text-[11px] text-ink-400">
                    Filter the board by assignee
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {canManageProject ? (
                    <button
                      type="button"
                      disabled={!project}
                      onClick={() => setShowInvite(true)}
                      className="shrink-0 px-1 text-xs font-semibold text-brand-800 disabled:opacity-40"
                    >
                      Invite
                    </button>
                  ) : null}
                  <button
                    type="button"
                    aria-label="Close"
                    onClick={() => setMembersPanelOpen(false)}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-ink-400 hover:bg-ink-700 hover:text-ink-100"
                  >
                    <IconX className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-2 py-2">
              {!project ? (
                <p className="px-1 py-4 text-xs text-ink-400">Select or create a project.</p>
              ) : (
                <ul className="space-y-1">
                  <li>
                    <button
                      type="button"
                      onClick={() => onAssigneeChange('everyone')}
                      className={cn(
                        'flex w-full items-center rounded-lg px-2 py-2 text-left text-xs font-semibold',
                        assigneeFilter === 'everyone'
                          ? 'bg-brand-500/10 text-ink-50'
                          : 'text-ink-200 hover:bg-ink-700',
                      )}
                    >
                      Everyone
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => onAssigneeChange('unassigned')}
                      className={cn(
                        'flex w-full items-center rounded-lg px-2 py-2 text-left text-xs font-semibold',
                        assigneeFilter === 'unassigned'
                          ? 'bg-brand-500/10 text-ink-50'
                          : 'text-ink-200 hover:bg-ink-700',
                      )}
                    >
                      Unassigned
                    </button>
                  </li>
                  {members.map((m) => {
                      const isYou = meMember?.id === m.id;
                      const pending = m.status === 'pending';
                      const active =
                        !pending &&
                        (assigneeFilter === m.id || (assigneeFilter === 'me' && isYou));
                      const count = getProjectTasks(project.id).filter((t) =>
                        isTaskAssignedTo(t, m),
                      ).length;
                      const canRemove =
                        canManageProject && !(m.role === 'admin' && members.filter((x) => x.role === 'admin' && x.status !== 'pending').length <= 1);
                      return (
                        <li key={m.id}>
                          <div
                            className={cn(
                              'flex w-full items-center gap-2.5 rounded-lg px-1.5 py-2',
                              active ? 'bg-brand-500/10' : 'hover:bg-ink-700',
                            )}
                          >
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => onAssigneeChange(isYou ? 'me' : m.id)}
                              className="flex min-w-0 flex-1 items-center gap-2.5 text-left disabled:cursor-default"
                            >
                            <UserAvatar
                              name={m.name}
                              src={m.avatarUrl}
                              seed={m.email || m.name}
                              size="lg"
                              bare
                              className="!h-8 !w-8 !text-[11px]"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-semibold text-ink-50">
                                {m.name}
                                {isYou ? (
                                  <span className="ml-1 font-medium text-ink-400">(you)</span>
                                ) : null}
                                {pending ? (
                                  <span className="ml-1 font-semibold uppercase tracking-wide text-[#fee75c]">
                                    Pending
                                  </span>
                                ) : null}
                              </p>
                              <p className="truncate text-[11px] text-ink-300">
                                {pending
                                  ? `Invite sent · ${m.role}`
                                  : `${count} task${count === 1 ? '' : 's'} · ${m.role}`}
                              </p>
                            </div>
                            </button>
                            {canRemove ? (
                              <button
                                type="button"
                                title="Remove from project"
                                onClick={() => setMemberToRemove(m)}
                                className="shrink-0 px-1 text-[11px] font-semibold text-[#ed4245] hover:underline"
                              >
                                Remove
                              </button>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                </ul>
              )}
            </div>

            {project ? (
              <p className="border-t border-ink-700 px-3 py-2 text-[11px] text-ink-400">
                {filtered.length} task{filtered.length === 1 ? '' : 's'} · {boardLabel}
              </p>
            ) : null}
          </aside>
        </>
      ) : null}

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
        <ManageTeamsModal
          projectId={projectId}
          onClose={() => setShowTeams(false)}
          onViewTeamTasks={(teamId) => viewGroupOnBoard(teamId)}
        />
      ) : null}
      {showCreateTask && projectId ? (
        <CreateTaskModal
          projectId={projectId}
          defaultAssignee={
            defaultAssignee
              ? { id: defaultAssignee.id, name: defaultAssignee.name }
              : undefined
          }
          defaultTeamId={
            hasGroups && groupFilter !== 'all' && groupFilter !== 'global' ? groupFilter : null
          }
          onClose={() => setShowCreateTask(false)}
        />
      ) : null}
      {selected && project ? (
        <TaskDetailModal
          task={selected}
          projectName={project.name}
          columns={columns}
          onClose={() => openTask(null)}
        />
      ) : null}

      <ConfirmModal
        open={Boolean(memberToRemove)}
        title="Remove member?"
        message={
          memberToRemove
            ? `Remove ${memberToRemove.name} from this project? Their tasks will move to the backlog (unassigned).`
            : ''
        }
        confirmLabel="Remove"
        danger
        busy={removingMember}
        onCancel={() => setMemberToRemove(null)}
        onConfirm={async () => {
          if (!memberToRemove || !project) return;
          setRemovingMember(true);
          try {
            await removeMember(project.id, memberToRemove.id);
            toast.success(`${memberToRemove.name} removed. Their tasks are in the backlog.`);
            setMemberToRemove(null);
          } catch (err) {
            toast.fromError(err, 'Could not remove member');
          } finally {
            setRemovingMember(false);
          }
        }}
      />

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
