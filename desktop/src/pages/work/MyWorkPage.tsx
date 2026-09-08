import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreateTaskModal } from '@/components/board/CreateTaskModal';
import { TaskDetailModal } from '@/components/board/TaskDetailModal';
import { CreateProjectModal } from '@/components/dashboard/CreateProjectModal';
import { InviteMembersModal } from '@/components/dashboard/InviteMembersModal';
import { OnboardingChecklist } from '@/components/onboarding/OnboardingChecklist';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Tooltip } from '@/components/ui/Tooltip';
import { UserAvatar, avatarFromMembers, presenceUserIdFromMembers } from '@/components/ui/UserAvatar';
import { useAttendance } from '@/lib/attendance/AttendanceContext';
import { useAuth } from '@/lib/auth/AuthContext';
import { cn } from '@/lib/cn';
import {
  compareMyWork,
  formatDueLabel,
  isDueSoon,
  isOverdue,
  isTaskAssignedToUser,
  isTaskOpen,
} from '@/lib/workspace/taskHelpers';
import { TASK_TYPES, type BoardTask } from '@/lib/workspace/types';
import { useWorkspace } from '@/lib/workspace/WorkspaceContext';

type WorkFilter = 'open' | 'done' | 'all';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function MyWorkPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { projects, tasks, getProject, isLoading, activeProjectId, setActiveProjectId } =
    useWorkspace();
  const {
    checkedIn,
    onBreak,
    elapsedLabel,
    checkIn,
    checkOut,
    toggleBreak,
    attendanceReady,
    activeTaskId,
    setActiveTask,
  } = useAttendance();

  const [filter, setFilter] = useState<WorkFilter>('open');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);

  const firstName = user?.name.split(' ')[0] ?? 'there';
  const homeProject =
    (activeProjectId !== 'all' ? projects.find((p) => p.id === activeProjectId) : undefined) ??
    projects[0];
  const canInvite = Boolean(homeProject);
  const boardHref =
    activeProjectId !== 'all' ? `/board?project=${activeProjectId}` : '/board';

  const projectSwitchOptions = useMemo(
    () => [
      { value: 'all', label: `All projects (${projects.length})` },
      ...projects.map((p) => {
        const role =
          user &&
          p.members.find(
            (m) =>
              (user.id && m.userId === user.id) ||
              m.email.toLowerCase() === user.email.toLowerCase(),
          )?.role;
        return {
          value: p.id,
          label: `${p.name} · ${role === 'admin' ? 'Admin' : 'Member'}`,
        };
      }),
    ],
    [projects, user],
  );

  const mine = useMemo(
    () =>
      tasks.filter((t) => {
        if (activeProjectId !== 'all' && t.projectId !== activeProjectId) return false;
        const project = getProject(t.projectId);
        return isTaskAssignedToUser(t, user, project);
      }),
    [tasks, user, getProject, activeProjectId],
  );

  const openMine = useMemo(
    () => mine.filter((t) => isTaskOpen(t, getProject(t.projectId))),
    [mine, getProject],
  );

  const visible = useMemo(() => {
    const list =
      filter === 'open'
        ? openMine
        : filter === 'done'
          ? mine.filter((t) => !isTaskOpen(t, getProject(t.projectId)))
          : mine;
    return [...list].sort(compareMyWork);
  }, [filter, mine, openMine, getProject]);

  const overdue = openMine.filter(isOverdue).length;
  const dueSoon = openMine.filter((t) => isDueSoon(t)).length;

  const selected = useMemo(
    () => (selectedId ? (tasks.find((t) => t.id === selectedId) ?? null) : null),
    [selectedId, tasks],
  );
  const selectedProject = selected ? getProject(selected.projectId) : undefined;

  function statusLabel(task: BoardTask) {
    const project = getProject(task.projectId);
    return project?.columns.find((c) => c.id === task.status)?.label ?? task.status;
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto">
      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-3 py-5 sm:px-6 sm:py-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight text-ink-50">
              {greeting()}, {firstName}
            </h1>
            <p className="mt-1 text-sm leading-relaxed text-ink-400">
              {activeProjectId === 'all'
                ? 'Your assigned work for today. Planning lives on the board.'
                : `Your assigned work in ${homeProject?.name ?? 'this project'}. Planning lives on the board.`}
            </p>
          </div>
          <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
            {projects.length > 0 ? (
              <div className="w-full min-w-0 sm:w-[200px] sm:shrink-0">
                <Select
                  value={activeProjectId}
                  onChange={(value) => setActiveProjectId(value as typeof activeProjectId)}
                  options={projectSwitchOptions}
                  aria-label="Switch project"
                  size="sm"
                />
              </div>
            ) : null}
            <div className="flex flex-wrap items-center gap-1.5">
            {!attendanceReady ? (
              <Button size="sm" variant="secondary" disabled>
                …
              </Button>
            ) : !checkedIn ? (
              <Button size="sm" className="flex-1 sm:flex-none" onClick={() => void checkIn()}>
                Check in
              </Button>
            ) : (
              <>
                <Button size="sm" variant="secondary" onClick={toggleBreak}>
                  {onBreak ? 'End break' : 'Break'}
                </Button>
                <Button size="sm" variant="danger" onClick={() => void checkOut()}>
                  Check out
                </Button>
                <span className="ml-0.5 text-xs font-semibold tabular-nums text-ink-300">
                  {elapsedLabel}
                </span>
              </>
            )}
            </div>
          </div>
        </header>

        <OnboardingChecklist
          onCreateProject={() => setShowCreateProject(true)}
          onInvite={canInvite ? () => setShowInvite(true) : undefined}
          onCreateTask={homeProject ? () => setShowCreateTask(true) : undefined}
        />

        <div className="grid grid-cols-3 gap-2">
          <Stat label="Open" value={openMine.length} />
          <Stat label="Overdue" value={overdue} warn={overdue > 0} />
          <Stat label="Due soon" value={dueSoon} />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex w-full rounded-lg border border-ink-600 bg-ink-800 p-0.5 sm:w-auto">
            {(['open', 'done', 'all'] as const).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setFilter(id)}
                className={cn(
                  'h-8 min-h-8 flex-1 rounded-md px-3 text-[12px] font-semibold capitalize sm:h-7 sm:flex-none',
                  filter === id ? 'bg-brand-500 text-white' : 'text-ink-300 hover:text-ink-50',
                )}
              >
                {id}
              </button>
            ))}
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center">
            {homeProject ? (
              <Button size="sm" className="w-full sm:w-auto" onClick={() => setShowCreateTask(true)}>
                New task
              </Button>
            ) : (
              <Button size="sm" className="w-full sm:w-auto" onClick={() => setShowCreateProject(true)}>
                New project
              </Button>
            )}
            <Button
              size="sm"
              variant="secondary"
              className="w-full sm:w-auto"
              onClick={() => navigate(boardHref)}
            >
              Board
            </Button>
          </div>
        </div>

        {isLoading && mine.length === 0 ? (
          <p className="py-12 text-center text-sm text-ink-400">Loading your tasks…</p>
        ) : visible.length === 0 ? (
          <div className="rounded-xl border border-dashed border-ink-600 bg-ink-800/60 px-4 py-10 text-center sm:px-6 sm:py-12">
            <p className="text-sm font-semibold text-ink-50">
              {projects.length === 0
                ? 'No project yet'
                : filter === 'open'
                  ? activeProjectId === 'all'
                    ? 'Nothing assigned to you'
                    : `Nothing assigned in ${homeProject?.name ?? 'this project'}`
                  : 'No tasks in this view'}
            </p>
            <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-ink-400">
              {projects.length === 0
                ? 'Create a project, invite people, then add a task. It will show up here when it is assigned to you.'
                : 'Tasks assigned to you appear here. Create one for yourself, or open the board to plan the project.'}
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-center">
              {projects.length === 0 ? (
                <Button size="sm" className="w-full sm:w-auto" onClick={() => setShowCreateProject(true)}>
                  Create project
                </Button>
              ) : (
                <Button size="sm" className="w-full sm:w-auto" onClick={() => setShowCreateTask(true)}>
                  Create a task for me
                </Button>
              )}
              <Button
                size="sm"
                variant="secondary"
                className="w-full sm:w-auto"
                onClick={() => navigate(boardHref)}
              >
                Open board
              </Button>
            </div>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {visible.map((task) => {
              const project = getProject(task.projectId);
              const typeMeta = TASK_TYPES.find((t) => t.id === task.type);
              const overdueTask = isOverdue(task);
              const due = formatDueLabel(task.dueDate);
              const active = activeTaskId === task.id;
              const open = isTaskOpen(task, project);
              return (
                <li key={task.id}>
                  <article
                    className={cn(
                      'flex cursor-pointer items-start gap-3 rounded-xl border border-ink-600 bg-ink-800 px-3 py-2.5 transition hover:border-ink-500',
                      active && 'border-brand-500/60 ring-1 ring-brand-500/30',
                    )}
                    onClick={() => setSelectedId(task.id)}
                  >
                    <UserAvatar
                      name={task.assigneeName || user?.name || 'You'}
                      src={avatarFromMembers(
                        project?.members ?? [],
                        task.assigneeId,
                        task.assigneeName,
                      )}
                      seed={task.assigneeName || task.id}
                      size="sm"
                      className="mt-0.5 !h-8 !w-8 !text-[10px]"
                      userId={presenceUserIdFromMembers(
                        project?.members ?? [],
                        task.assigneeId,
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={cn(
                            'rounded px-1.5 py-0.5 text-[10px] font-bold uppercase text-white',
                            typeMeta?.color ?? 'bg-ink-700',
                          )}
                        >
                          {typeMeta?.label ?? task.type}
                        </span>
                        <span className="text-[11px] font-medium tabular-nums text-ink-400">
                          {task.key}
                        </span>
                        {project ? (
                          <span className="truncate text-[11px] text-ink-400">{project.name}</span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-[13px] font-medium text-ink-50">{task.title}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-ink-400">
                        <span>{statusLabel(task)}</span>
                        {due ? (
                          <span className={overdueTask ? 'font-semibold text-[#ed4245]' : ''}>
                            {due}
                          </span>
                        ) : null}
                      </p>
                    </div>
                    {open ? (
                      <Tooltip
                        label={checkedIn ? '' : 'Check in to start tracking'}
                        side="top"
                      >
                      <Button
                        size="xs"
                        className="shrink-0"
                        variant={active ? 'secondary' : 'primary'}
                        disabled={!checkedIn}
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveTask(active ? null : task.id);
                        }}
                      >
                        {active ? 'Pause' : 'Start'}
                      </Button>
                      </Tooltip>
                    ) : (
                      <span className="mt-1 text-[11px] font-semibold text-ink-400">Done</span>
                    )}
                  </article>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {showCreateProject ? (
        <CreateProjectModal
          onClose={() => setShowCreateProject(false)}
          onCreated={() => setShowCreateProject(false)}
        />
      ) : null}
      {showInvite && homeProject ? (
        <InviteMembersModal project={homeProject} onClose={() => setShowInvite(false)} />
      ) : null}
      {showCreateTask && homeProject ? (
        <CreateTaskModal
          projectId={homeProject.id}
          defaultAssignee={
            user
              ? {
                  id:
                    homeProject.members.find(
                      (m) => m.email.toLowerCase() === user.email.toLowerCase(),
                    )?.id ?? '',
                  name: user.name,
                }
              : undefined
          }
          onClose={() => setShowCreateTask(false)}
        />
      ) : null}
      {selected && selectedProject ? (
        <TaskDetailModal
          task={selected}
          projectName={selectedProject.name}
          columns={selectedProject.columns}
          onClose={() => setSelectedId(null)}
        />
      ) : null}
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className="min-w-0 rounded-xl border border-ink-600 bg-ink-800 px-2.5 py-3 sm:px-3">
      <p className="text-[10px] leading-tight font-bold tracking-wide text-ink-400 uppercase">
        {label}
      </p>
      <p className={cn('mt-1 text-lg font-semibold tabular-nums', warn ? 'text-[#ed4245]' : 'text-ink-50')}>
        {value}
      </p>
    </div>
  );
}
