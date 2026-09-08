import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AddUserModal } from '@/components/dashboard/AddUserModal';
import { AdminActivityPanel } from '@/components/dashboard/AdminActivityPanel';
import { CreateProjectModal } from '@/components/dashboard/CreateProjectModal';
import { TimelinePanel } from '@/components/dashboard/TimelinePanel';
import { OnboardingChecklist } from '@/components/onboarding/OnboardingChecklist';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Select } from '@/components/ui/Select';
import { UserAvatar, avatarFromMembers, presenceUserIdFromMembers } from '@/components/ui/UserAvatar';
import { useAttendance } from '@/lib/attendance/AttendanceContext';
import { listOrgUsers, type OrgUser } from '@/lib/api/org';
import { useAuth } from '@/lib/auth/AuthContext';
import { cn } from '@/lib/cn';
import type { BoardTask, ProjectMember } from '@/lib/workspace/types';
import { useWorkspace } from '@/lib/workspace/WorkspaceContext';

type DashTab = 'overview' | 'tasks' | 'users' | 'timeline' | 'activity';

const BASE_TABS: { id: DashTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'users', label: 'Users' },
  { id: 'timeline', label: 'Backlog' },
];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

const STATUS_META = [
  { id: 'todo', label: 'To do', color: '#80848e', fill: 'fill-ink-400' },
  { id: 'in_progress', label: 'In progress', color: '#f0b232', fill: 'fill-[#f0b232]' },
  { id: 'review', label: 'In review', color: '#00a8fc', fill: 'fill-[#00a8fc]' },
  { id: 'done', label: 'Done', color: '#23a559', fill: 'fill-[#23a559]' },
] as const;

const PRIORITY_META = [
  { id: 'highest', label: 'Highest', short: 'H+', color: '#ed4245' },
  { id: 'high', label: 'High', short: 'Hi', color: '#f07178' },
  { id: 'medium', label: 'Medium', short: 'Med', color: '#f0b232' },
  { id: 'low', label: 'Low', short: 'Lo', color: '#3ba55d' },
  { id: 'lowest', label: 'Lowest', short: 'L−', color: '#80848e' },
] as const;

function DonutChart({
  slices,
}: {
  slices: { label: string; value: number; color: string }[];
}) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  const denom = total || 1;
  const r = 48;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
      <div className="relative h-28 w-28 shrink-0">
        <svg viewBox="0 0 120 120" className="h-full w-full">
          <circle cx="60" cy="60" r={r} fill="none" stroke="var(--chart-track)" strokeWidth="12" />
          {slices.map((slice) => {
            if (slice.value <= 0) return null;
            const len = (slice.value / denom) * c;
            const draw = Math.max(len - 2.5, 0);
            const el = (
              <circle
                key={slice.label}
                cx="60"
                cy="60"
                r={r}
                fill="none"
                stroke={slice.color}
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={`${draw} ${c - draw}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 60 60)"
              />
            );
            offset += len;
            return el;
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-xl font-bold tabular-nums text-ink-50">{total}</p>
          <p className="text-[9px] font-semibold tracking-wide text-ink-400 uppercase">tasks</p>
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-1.5">
        {slices.map((s) => (
          <li key={s.label} className="flex items-center gap-2 text-[12px]">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: s.color }} />
            <span className="min-w-0 flex-1 truncate text-ink-300">{s.label}</span>
            <span className="tabular-nums font-semibold text-ink-50">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BarChart({
  bars,
}: {
  bars: { id: string; label: string; value: number; color: string }[];
}) {
  const max = Math.max(...bars.map((b) => b.value), 1);
  const h = 108;
  const gap = 12;
  const barW = 26;
  const width = Math.max(bars.length * (barW + gap) + gap, 120);

  return (
    <svg viewBox={`0 0 ${width} ${h + 24}`} className="h-36 w-full">
      {bars.map((b, i) => {
        const bh = (b.value / max) * (h - 16);
        const x = gap + i * (barW + gap);
        const y = h - bh;
        return (
          <g key={b.id}>
            <rect
              x={x}
              y={4}
              width={barW}
              height={h - 4}
              rx={5}
              fill="var(--chart-track)"
              opacity={0.3}
            />
            <rect x={x} y={y} width={barW} height={Math.max(bh, 3)} rx={5} fill={b.color} />
            <text
              x={x + barW / 2}
              y={y - 5}
              textAnchor="middle"
              style={{ fontSize: 10, fontWeight: 600, fill: 'var(--ink-50)' }}
            >
              {b.value}
            </text>
            <text
              x={x + barW / 2}
              y={h + 16}
              textAnchor="middle"
              style={{ fontSize: 9, fontWeight: 600, fill: 'var(--ink-300)' }}
            >
              {b.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'h-7 rounded-md px-2.5 text-[11px] font-semibold tracking-wide capitalize transition-[color,background-color,transform] duration-150 ease-out active:scale-[0.98]',
        active
          ? 'bg-brand-500 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]'
          : 'text-ink-300 hover:bg-ink-700 hover:text-ink-50',
      )}
    >
      {children}
    </button>
  );
}

type TeamUser = ProjectMember & { taskCount: number; openCount: number; projects: string[] };

export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const {
    projects,
    tasks,
    getProject,
    timeline,
    activeProjectId,
    setActiveProjectId,
    isProjectAdmin,
    deleteProject,
  } = useWorkspace();
  const {
    checkedIn,
    onBreak,
    checkInAt,
    checkOutAt,
    elapsedLabel,
    checkIn,
    checkOut,
    toggleBreak,
    attendanceReady,
  } =
    useAttendance();
  const [tab, setTab] = useState<DashTab>('overview');
  const [taskFilter, setTaskFilter] = useState<'all' | 'open' | 'done'>('all');
  const [selectedUserEmail, setSelectedUserEmail] = useState<string | 'all'>('all');
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [assignUser, setAssignUser] = useState<OrgUser | null>(null);
  const [orgUsers, setOrgUsers] = useState<OrgUser[]>([]);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
  const [deletingProject, setDeletingProject] = useState(false);

  const myRoleOnActive = useMemo(() => {
    if (activeProjectId === 'all' || !user) return null;
    const p = getProject(activeProjectId);
    const m = p?.members.find((x) => x.email.toLowerCase() === user.email.toLowerCase());
    return m?.role ?? null;
  }, [activeProjectId, getProject, user]);

  const canDeleteActiveProject = Boolean(
    activeProjectId !== 'all' && isProjectAdmin(activeProjectId),
  );

  const scopedProjects = useMemo(
    () =>
      activeProjectId === 'all'
        ? projects
        : projects.filter((p) => p.id === activeProjectId),
    [projects, activeProjectId],
  );

  const scopedTasks = useMemo(
    () =>
      activeProjectId === 'all'
        ? tasks
        : tasks.filter((t) => t.projectId === activeProjectId),
    [tasks, activeProjectId],
  );

  const scopedTimeline = useMemo(
    () =>
      activeProjectId === 'all'
        ? timeline
        : timeline.filter((t) => t.projectId === activeProjectId),
    [timeline, activeProjectId],
  );

  /** True if user is admin on at least one project they belong to */
  const isProjectAdminAnywhere = useMemo(
    () =>
      Boolean(
        user &&
          projects.some((p) =>
            p.members.some(
              (m) =>
                m.role === 'admin' &&
                (m.userId === user.id || m.email.toLowerCase() === user.email.toLowerCase()),
            ),
          ),
      ),
    [projects, user],
  );

  /** Activity tab: only when the selected project is one you admin (or All + admin somewhere) */
  const canViewActivity = useMemo(() => {
    if (activeProjectId === 'all') return isProjectAdminAnywhere;
    return isProjectAdmin(activeProjectId);
  }, [activeProjectId, isProjectAdmin, isProjectAdminAnywhere]);

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
  const firstName = user?.name.split(' ')[0] ?? 'there';
  const pendingTimeline = scopedTimeline.filter((t) => !t.taskId).length;
  const scopedBoardUnassigned = useMemo(() => {
    const list =
      activeProjectId === 'all'
        ? tasks
        : tasks.filter((t) => t.projectId === activeProjectId);
    return list.filter((t) => {
      const id = (t.assigneeId ?? '').trim();
      const name = (t.assigneeName ?? '').trim().toLowerCase();
      return !id || !name || name === 'unassigned';
    }).length;
  }, [tasks, activeProjectId]);
  const backlogBadge = pendingTimeline + scopedBoardUnassigned;
  const tabs = useMemo(
    () =>
      canViewActivity
        ? [...BASE_TABS, { id: 'activity' as const, label: 'Activity' }]
        : BASE_TABS,
    [canViewActivity],
  );

  useEffect(() => {
    if (!canViewActivity && tab === 'activity') setTab('overview');
  }, [canViewActivity, tab]);

  const loadOrgUsers = useCallback(async () => {
    try {
      const data = await listOrgUsers();
      setOrgUsers(data.users);
    } catch {
      /* ignore — fall back to project members */
    }
  }, []);

  useEffect(() => {
    if (tab === 'users') void loadOrgUsers();
  }, [tab, loadOrgUsers]);

  /** Only members assigned to the selected project(s) — never the full org directory. */
  const teamUsers = useMemo(() => {
    const map = new Map<string, TeamUser>();
    for (const p of scopedProjects) {
      const project = getProject(p.id);
      if (!project) continue;
      for (const m of project.members) {
        // Pending invites aren't assigned yet
        if (m.status === 'pending') continue;
        const key = m.email.toLowerCase();
        const existing = map.get(key);
        if (existing) {
          if (!existing.projects.includes(project.name)) existing.projects.push(project.name);
        } else {
          map.set(key, {
            ...m,
            taskCount: 0,
            openCount: 0,
            projects: [project.name],
          });
        }
      }
    }
    for (const t of scopedTasks) {
      const emailMatch = [...map.values()].find(
        (u) =>
          u.name.toLowerCase() === t.assigneeName.toLowerCase() ||
          u.id === t.assigneeId,
      );
      if (!emailMatch) continue;
      emailMatch.taskCount += 1;
      if (t.status !== 'done') emailMatch.openCount += 1;
    }
    return [...map.values()].sort((a, b) => b.taskCount - a.taskCount);
  }, [scopedProjects, scopedTasks, getProject]);

  useEffect(() => {
    if (selectedUserEmail === 'all') return;
    const stillVisible = teamUsers.some(
      (u) => u.email.toLowerCase() === selectedUserEmail,
    );
    if (!stillVisible) setSelectedUserEmail('all');
  }, [teamUsers, selectedUserEmail]);

  const stats = useMemo(() => {
    let scope: BoardTask[] = scopedTasks;

    if (selectedUserEmail === 'all') {
      scope = scopedTasks;
    } else {
      const member = teamUsers.find((u) => u.email.toLowerCase() === selectedUserEmail);
      scope = scopedTasks.filter(
        (t) =>
          (member &&
            (t.assigneeId === member.id ||
              t.assigneeName.toLowerCase() === member.name.toLowerCase())) ||
          t.assigneeName.toLowerCase() === selectedUserEmail,
      );
    }

    const byStatus = { todo: 0, in_progress: 0, review: 0, done: 0, other: 0 };
    const byPriority: Record<string, number> = {
      highest: 0,
      high: 0,
      medium: 0,
      low: 0,
      lowest: 0,
    };

    for (const t of scope) {
      if (t.status === 'todo') byStatus.todo += 1;
      else if (t.status === 'in_progress') byStatus.in_progress += 1;
      else if (t.status === 'review') byStatus.review += 1;
      else if (t.status === 'done') byStatus.done += 1;
      else byStatus.other += 1;
      byPriority[t.priority] = (byPriority[t.priority] ?? 0) + 1;
    }

    const open = scope.length - byStatus.done;
    const completion =
      scope.length === 0 ? 0 : Math.round((byStatus.done / scope.length) * 100);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekOut = new Date(today);
    weekOut.setDate(weekOut.getDate() + 7);

    const dueSoon = scope.filter((t) => {
      if (!t.dueDate || t.status === 'done') return false;
      const d = new Date(t.dueDate);
      return d >= today && d <= weekOut;
    }).length;

    const overdue = scope.filter((t) => {
      if (!t.dueDate || t.status === 'done') return false;
      return new Date(t.dueDate) < today;
    }).length;

    // Workload per project for bar chart
    const byProject = scopedProjects.map((p) => ({
      id: p.id,
      label: (p.key || p.name).slice(0, 5),
      value: scope.filter((t) => t.projectId === p.id).length,
      color: '#5865F2',
    }));

    return {
      scope,
      byStatus,
      byPriority,
      open,
      completion,
      dueSoon,
      overdue,
      totalTasks: scope.length,
      byProject,
    };
  }, [scopedTasks, scopedProjects, selectedUserEmail, teamUsers]);

  const taskList = useMemo(() => {
    let list = [...stats.scope];
    if (taskFilter === 'open') list = list.filter((t) => t.status !== 'done');
    if (taskFilter === 'done') list = list.filter((t) => t.status === 'done');
    return list.sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
  }, [stats.scope, taskFilter]);

  const statusSlices = STATUS_META.map((s) => ({
    label: s.label,
    value: stats.byStatus[s.id],
    color: s.color,
  }));

  const priorityBars = PRIORITY_META.map((p) => ({
    id: p.id,
    label: p.short,
    value: stats.byPriority[p.id] ?? 0,
    color: p.color,
  }));

  return (
    <div className="flex h-full min-h-0 flex-col">
      {projects.length === 0 ? (
        <section className="shrink-0 border-b border-brand-500/25 bg-brand-500/10 px-4 py-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink-50">Welcome to DockX</p>
              <p className="mt-0.5 text-xs text-ink-300">
                Create a project when you’re ready for boards and tasks. Chat works right away from
                the sidebar.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button size="sm" onClick={() => setShowCreateProject(true)}>
                New project
              </Button>
              <Link to="/chat">
                <Button size="sm" variant="secondary">
                  Open chat
                </Button>
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      {/* Top bar */}
      <section className="shrink-0 border-b border-ink-600 bg-ink-800">
        <div className="flex flex-col gap-3 px-3 py-3 sm:px-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-medium tracking-wide text-ink-400 uppercase">
              Dashboard
            </p>
            <h1 className="mt-0.5 text-lg font-semibold tracking-tight text-ink-50">
              {greeting()}, {firstName}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <div className="w-full min-w-0 sm:w-[200px] sm:shrink-0">
              <Select
                value={activeProjectId}
                onChange={(value) => setActiveProjectId(value as typeof activeProjectId)}
                options={projectSwitchOptions}
                aria-label="Switch project"
                size="sm"
              />
            </div>
            {myRoleOnActive ? (
              <span
                className={cn(
                  'hidden h-8 items-center rounded-md px-2.5 text-[11px] font-semibold tracking-wide uppercase md:inline-flex',
                  myRoleOnActive === 'admin'
                    ? 'bg-brand-500/15 text-brand-300'
                    : 'bg-ink-700 text-ink-200',
                )}
              >
                {myRoleOnActive}
              </span>
            ) : null}

            <div className="flex h-8 shrink-0 items-center gap-2 rounded-md border border-ink-600 bg-ink-900/80 px-2.5">
              <span
                className={cn(
                  'h-1.5 w-1.5 shrink-0 rounded-full',
                  !checkedIn
                    ? 'bg-ink-400'
                    : onBreak
                      ? 'bg-[#f0b232]'
                      : 'bg-[#23a559]',
                )}
              />
              <span className="hidden text-[11px] font-semibold tracking-wide text-ink-300 uppercase sm:inline">
                {!checkedIn ? 'Out' : onBreak ? 'Break' : 'In'}
              </span>
              <span className="text-xs font-semibold tabular-nums text-ink-50">
                {checkedIn ? elapsedLabel : '00:00:00'}
              </span>
              {checkedIn && checkInAt ? (
                <span className="hidden text-[11px] text-ink-400 xl:inline">
                  · in {checkInAt}
                </span>
              ) : null}
              {!checkedIn && checkOutAt ? (
                <span className="hidden text-[11px] text-ink-400 xl:inline">
                  · out {checkOutAt}
                </span>
              ) : null}
            </div>

            <div className="flex items-center gap-1.5">
              {!attendanceReady ? (
                <Button size="sm" variant="secondary" disabled>
                  …
                </Button>
              ) : !checkedIn ? (
                <Button size="sm" onClick={() => void checkIn()}>
                  Check in
                </Button>
              ) : (
                <>
                  <Button size="sm" variant="secondary" onClick={toggleBreak}>
                    {onBreak ? 'End break' : 'Break'}
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => void checkOut()}>
                    <span className="sm:hidden">Out</span>
                    <span className="hidden sm:inline">Check out</span>
                  </Button>
                </>
              )}
            </div>

            <div className="hidden h-5 w-px bg-ink-600 sm:block" aria-hidden />

            <div className="flex items-center gap-1.5">
              <Button size="sm" variant="secondary" onClick={() => setShowCreateProject(true)}>
                <span className="sm:hidden">New</span>
                <span className="hidden sm:inline">New project</span>
              </Button>
              {canDeleteActiveProject ? (
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => setProjectToDelete(activeProjectId)}
                  className="hidden sm:inline-flex"
                >
                  Delete
                </Button>
              ) : null}
              <Link to="/">
                <Button size="sm" variant="secondary">
                  My Work
                </Button>
              </Link>
              <Link
                to={
                  activeProjectId !== 'all'
                    ? `/board?project=${activeProjectId}`
                    : '/board'
                }
              >
                <Button size="sm" variant="secondary">
                  Board
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <nav className="flex gap-0.5 overflow-x-auto border-t border-ink-700 px-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                'shrink-0 border-b-2 px-3.5 py-2.5 text-[13px] font-medium transition-colors',
                tab === t.id
                  ? 'border-brand-500 text-ink-50'
                  : 'border-transparent text-ink-400 hover:text-ink-200',
              )}
            >
              {t.label}
              {t.id === 'timeline' && backlogBadge > 0 ? (
                <span className="ml-1.5 tabular-nums text-ink-400">{backlogBadge}</span>
              ) : null}
            </button>
          ))}
        </nav>
      </section>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      {tab === 'timeline' ? (
        <div className="min-h-min">
          <TimelinePanel />
        </div>
      ) : null}

      {tab === 'activity' && canViewActivity ? (
        <div className="min-h-min">
          <AdminActivityPanel
            projectId={activeProjectId === 'all' ? undefined : activeProjectId}
          />
        </div>
      ) : null}

      {tab === 'tasks' ? (
        <div className="bg-ink-800">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-600 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-ink-50">Task list</h2>
              <p className="mt-0.5 text-[12px] text-ink-400">{taskList.length} tasks</p>
            </div>
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              <div className="flex items-center gap-0.5 rounded-md border border-ink-600 bg-ink-900/50 p-0.5">
                {(['all', 'open', 'done'] as const).map((f) => (
                  <FilterChip
                    key={f}
                    active={taskFilter === f}
                    onClick={() => setTaskFilter(f)}
                  >
                    {f}
                  </FilterChip>
                ))}
              </div>
              <div className="w-full min-w-0 sm:w-[160px]">
                <Select
                  size="sm"
                  value={selectedUserEmail}
                  onChange={(v) => setSelectedUserEmail(v as string | 'all')}
                  options={[
                    { value: 'all', label: 'All users' },
                    ...teamUsers.map((u) => ({
                      value: u.email.toLowerCase(),
                      label: u.name,
                    })),
                  ]}
                  aria-label="Filter by user"
                />
              </div>
            </div>
          </div>
          <div>
            {/* Mobile cards */}
            <div className="space-y-2 p-3 md:hidden">
              {taskList.length === 0 ? (
                <p className="px-1 py-12 text-center text-xs text-ink-400">
                  No tasks in this list.
                </p>
              ) : (
                taskList.map((t) => {
                  const proj = getProject(t.projectId);
                  return (
                    <div
                      key={t.id}
                      className="rounded-lg border border-ink-700 bg-ink-900/60 px-3 py-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-ink-50">{t.title}</p>
                          <p className="text-[10px] text-ink-400">
                            {t.key}
                            {proj ? ` · ${proj.name}` : ''}
                          </p>
                        </div>
                        <span className="shrink-0 capitalize text-[10px] font-semibold text-ink-300">
                          {t.priority}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-300">
                        <span className="inline-flex items-center gap-1.5">
                          <UserAvatar
                            name={t.assigneeName || 'Unassigned'}
                            src={avatarFromMembers(
                              getProject(t.projectId)?.members ?? [],
                              t.assigneeId,
                              t.assigneeName,
                            )}
                            seed={t.assigneeName || t.id}
                            size="xs"
                            userId={presenceUserIdFromMembers(
                              getProject(t.projectId)?.members ?? [],
                              t.assigneeId,
                            )}
                          />
                          {t.assigneeName || 'Unassigned'}
                        </span>
                        <span className="capitalize">{t.status.replace('_', ' ')}</span>
                        <span>
                          {t.dueDate
                            ? new Date(t.dueDate).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                              })
                            : 'No due'}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            {/* Desktop table */}
            <table className="hidden w-full min-w-[720px] text-left text-xs md:table">
              <thead className="sticky top-0 bg-ink-900 text-[10px] font-bold tracking-wide text-ink-300 uppercase">
                <tr>
                  <th className="px-4 py-2">Task</th>
                  <th className="px-3 py-2">Project</th>
                  <th className="px-3 py-2">Assignee</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Priority</th>
                  <th className="px-4 py-2">Due</th>
                </tr>
              </thead>
              <tbody>
                {taskList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-ink-400">
                      No tasks in this list.
                    </td>
                  </tr>
                ) : (
                  taskList.map((t) => {
                    const proj = getProject(t.projectId);
                    return (
                      <tr key={t.id} className="border-t border-ink-700 hover:bg-ink-900/80">
                        <td className="px-4 py-2.5">
                          <p className="font-semibold text-ink-50">{t.title}</p>
                          <p className="text-[10px] text-ink-400">{t.key}</p>
                        </td>
                        <td className="px-3 py-2.5 text-ink-200">{proj?.name ?? '—'}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <UserAvatar
                              name={t.assigneeName || 'Unassigned'}
                              src={avatarFromMembers(
                                getProject(t.projectId)?.members ?? [],
                                t.assigneeId,
                                t.assigneeName,
                              )}
                              seed={t.assigneeName || t.id}
                              size="xs"
                              userId={presenceUserIdFromMembers(
                              getProject(t.projectId)?.members ?? [],
                              t.assigneeId,
                            )}
                            />
                            {t.assigneeName}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 capitalize text-ink-200">
                          {t.status.replace('_', ' ')}
                        </td>
                        <td className="px-3 py-2.5 capitalize">{t.priority}</td>
                        <td className="px-4 py-2.5 text-ink-300">
                          {t.dueDate
                            ? new Date(t.dueDate).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                              })
                            : '—'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === 'users' ? (
        <div className="bg-ink-800">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-600 px-4 py-2.5">
            <div>
              <h2 className="text-sm font-semibold text-ink-50">Users list</h2>
              <p className="text-[11px] text-ink-300">
                {teamUsers.length} member{teamUsers.length === 1 ? '' : 's'} on{' '}
                {activeProjectId === 'all' ? 'your projects' : 'this project'} · click to
                filter Tasks
              </p>
            </div>
            {isProjectAdminAnywhere ? (
              <Button size="xs" onClick={() => setShowAddUser(true)}>
                Add user
              </Button>
            ) : null}
          </div>
          <div>
            {/* Mobile cards */}
            <div className="space-y-2 p-3 md:hidden">
              {teamUsers.length === 0 ? (
                <p className="px-1 py-12 text-center text-xs text-ink-400">
                  {isProjectAdminAnywhere
                    ? 'No members on this project yet. Invite from the board or Add user.'
                    : 'No members on this project yet.'}
                </p>
              ) : (
                teamUsers.map((u) => {
                  const isYou =
                    u.email.toLowerCase() === (user?.email ?? '').toLowerCase() ||
                    u.name.toLowerCase() === (user?.name ?? '').toLowerCase();
                  const orgUser = orgUsers.find(
                    (ou) => ou.email.toLowerCase() === u.email.toLowerCase(),
                  );
                  return (
                    <div
                      key={u.id}
                      className="rounded-lg border border-ink-700 bg-ink-900/60 px-3 py-2.5"
                    >
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 text-left"
                        onClick={() => {
                          setSelectedUserEmail(u.email.toLowerCase());
                          setTab('tasks');
                        }}
                      >
                        <UserAvatar
                          name={u.name}
                          src={
                            orgUsers.find(
                              (ou) => ou.email.toLowerCase() === u.email.toLowerCase(),
                            )?.avatarUrl ??
                            (u.email.toLowerCase() === (user?.email ?? '').toLowerCase()
                              ? user?.avatarUrl
                              : null)
                          }
                          seed={u.email || u.name}
                          size="sm"
                          className="!h-8 !w-8 !text-[9px]"
                          userId={u.userId || u.id}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-ink-50">
                            {u.name}
                            {isYou ? (
                              <span className="ml-1 font-medium text-ink-400">(you)</span>
                            ) : null}
                          </span>
                          <span className="block truncate text-[11px] text-ink-300">
                            {u.email}
                          </span>
                        </span>
                        <span className="shrink-0 text-right text-[11px] text-ink-300">
                          <span className="block font-semibold tabular-nums text-ink-50">
                            {u.openCount} open
                          </span>
                          <span className="capitalize">{orgUser?.role ?? u.role}</span>
                        </span>
                      </button>
                      {isProjectAdminAnywhere && orgUser ? (
                        <button
                          type="button"
                          className="mt-2 text-[11px] font-semibold text-brand-300 hover:underline"
                          onClick={() => setAssignUser(orgUser)}
                        >
                          Assign project
                        </button>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
            <table className="hidden w-full min-w-[720px] text-left text-xs md:table">
              <thead className="sticky top-0 bg-ink-900 text-[10px] font-bold tracking-wide text-ink-300 uppercase">
                <tr>
                  <th className="px-4 py-2">User</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">Open</th>
                  <th className="px-3 py-2">Total</th>
                  <th className="px-3 py-2">Projects</th>
                  {isProjectAdminAnywhere ? <th className="px-4 py-2 text-right">Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {teamUsers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={isProjectAdminAnywhere ? 7 : 6}
                      className="px-4 py-12 text-center text-ink-400"
                    >
                      {isProjectAdminAnywhere
                        ? 'No members on this project yet. Invite from the board or Add user.'
                        : 'No members on this project yet.'}
                    </td>
                  </tr>
                ) : (
                  teamUsers.map((u) => {
                    const isYou =
                      u.email.toLowerCase() === (user?.email ?? '').toLowerCase() ||
                      u.name.toLowerCase() === (user?.name ?? '').toLowerCase();
                    const orgUser = orgUsers.find(
                      (ou) => ou.email.toLowerCase() === u.email.toLowerCase(),
                    );
                    return (
                      <tr
                        key={u.id}
                        className="border-t border-ink-700 hover:bg-ink-900/80"
                      >
                        <td
                          className="cursor-pointer px-4 py-2.5"
                          onClick={() => {
                            setSelectedUserEmail(u.email.toLowerCase());
                            setTab('tasks');
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <UserAvatar
                              name={u.name}
                              src={
                                orgUsers.find(
                                  (ou) => ou.email.toLowerCase() === u.email.toLowerCase(),
                                )?.avatarUrl ??
                                (u.email.toLowerCase() === (user?.email ?? '').toLowerCase()
                                  ? user?.avatarUrl
                                  : null)
                              }
                              seed={u.email || u.name}
                              size="sm"
                              className="!h-7 !w-7 !text-[9px]"
                              userId={u.userId || u.id}
                            />
                            <span className="font-semibold text-ink-50">
                              {u.name}
                              {isYou ? (
                                <span className="ml-1 font-medium text-ink-400">(you)</span>
                              ) : null}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-ink-200">{u.email}</td>
                        <td className="px-3 py-2.5 capitalize text-ink-200">
                          {orgUser?.role ?? u.role}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums font-semibold text-ink-50">
                          {u.openCount}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums text-ink-200">{u.taskCount}</td>
                        <td className="px-3 py-2.5 text-ink-300">
                          {u.projects.length > 0 ? u.projects.join(', ') : '—'}
                        </td>
                        {isProjectAdminAnywhere ? (
                          <td className="px-4 py-2.5 text-right">
                            {orgUser ? (
                              <button
                                type="button"
                                className="text-[11px] font-semibold text-brand-300 hover:underline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setAssignUser(orgUser);
                                }}
                              >
                                Assign project
                              </button>
                            ) : null}
                          </td>
                        ) : null}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === 'overview' ? (
        <>
      <div className="shrink-0 px-4 pt-3 empty:hidden">
        <OnboardingChecklist onCreateProject={() => setShowCreateProject(true)} />
      </div>
      {/* KPI strip */}
      <section className="grid shrink-0 grid-cols-2 border-b border-ink-600 bg-ink-800 sm:grid-cols-4">
        {[
          { label: 'Open tasks', value: stats.open, hint: `${stats.totalTasks} total`, accent: '#00a8fc' },
          { label: 'Done', value: stats.byStatus.done, hint: `${stats.completion}% complete`, accent: '#23a559' },
          { label: 'Due week', value: stats.dueSoon, hint: `${stats.overdue} overdue`, accent: '#f0b232' },
          {
            label: 'Projects',
            value: scopedProjects.length,
            hint: `${teamUsers.length} users`,
            accent: '#5865F2',
          },
        ].map((card, i) => (
          <div
            key={card.label}
            className={cn(
              'px-4 py-3.5',
              i < 3 && 'border-r border-ink-700',
              i >= 2 && 'border-t border-ink-700 sm:border-t-0',
            )}
          >
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: card.accent }} />
              <p className="text-[11px] font-semibold tracking-wide text-ink-400 uppercase">
                {card.label}
              </p>
            </div>
            <p className="mt-1.5 text-[1.65rem] leading-none font-semibold tabular-nums tracking-tight text-ink-50">
              {card.value}
            </p>
            <p className="mt-1 text-[12px] text-ink-400">{card.hint}</p>
          </div>
        ))}
      </section>

      {/* Main grid — same page scroll; no nested panes */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px]">
        <div>
          {/* Graphs */}
          <section className="grid border-b border-ink-600 bg-ink-800 lg:grid-cols-3">
            <div className="border-b border-ink-600 p-4 lg:border-r lg:border-b-0">
              <h2 className="text-[13px] font-semibold text-ink-50">Status mix</h2>
              <p className="mt-0.5 text-[12px] text-ink-400">Tasks by column</p>
              <div className="mt-3">
                <DonutChart slices={statusSlices} />
              </div>
            </div>
            <div className="border-b border-ink-600 p-4 lg:border-r lg:border-b-0">
              <h2 className="text-[13px] font-semibold text-ink-50">Priority</h2>
              <p className="mt-0.5 text-[12px] text-ink-400">Distribution</p>
              <div className="mt-3">
                <BarChart bars={priorityBars} />
              </div>
            </div>
            <div className="p-4">
              <h2 className="text-[13px] font-semibold text-ink-50">By project</h2>
              <p className="mt-0.5 text-[12px] text-ink-400">Workload</p>
              <div className="mt-3">
                {stats.byProject.length === 0 ? (
                  <p className="py-8 text-xs text-ink-400">No projects yet</p>
                ) : (
                  <BarChart
                    bars={stats.byProject.map((b, i) => ({
                      id: b.id,
                      label: b.label,
                      value: b.value,
                      color: ['#00a8fc', '#23a559', '#f0b232', '#ed4245'][i % 4],
                    }))}
                  />
                )}
              </div>
            </div>
          </section>

          {/* Task list */}
          <section className="flex flex-col bg-ink-800">
            <div className="flex flex-col gap-3 border-b border-ink-600 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-ink-50">Task list</h2>
                <p className="mt-0.5 text-[12px] text-ink-400">
                  {taskList.length} shown
                  {selectedUserEmail !== 'all' ? ' · filtered by user' : ''}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex flex-1 items-center gap-0.5 rounded-md border border-ink-600 bg-ink-900/50 p-0.5 sm:flex-none">
                  {(['all', 'open', 'done'] as const).map((f) => (
                    <FilterChip
                      key={f}
                      active={taskFilter === f}
                      onClick={() => setTaskFilter(f)}
                    >
                      {f}
                    </FilterChip>
                  ))}
                </div>
                <Link to="/board" className="shrink-0">
                  <Button size="sm" variant="secondary">
                    Board
                  </Button>
                </Link>
              </div>
            </div>

            <div className="space-y-2 p-3 md:hidden">
              {taskList.length === 0 ? (
                <p className="px-1 py-10 text-center text-sm text-ink-400">
                  No tasks in this view. Open the board to create one.
                </p>
              ) : (
                taskList.map((t) => {
                  const proj = getProject(t.projectId);
                  const statusColor =
                    STATUS_META.find((s) => s.id === t.status)?.color ?? '#80848e';
                  const priorityColor =
                    PRIORITY_META.find((p) => p.id === t.priority)?.color ?? '#80848e';
                  return (
                    <div
                      key={t.id}
                      className="rounded-lg border border-ink-700 bg-ink-900/60 px-3 py-2.5"
                    >
                      <p className="text-sm font-medium text-ink-50">{t.title}</p>
                      <p className="mt-0.5 text-[11px] text-ink-400">
                        {t.key}
                        {proj ? ` · ${proj.name}` : ''}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-300">
                        <span className="inline-flex items-center gap-1.5">
                          <UserAvatar
                            name={t.assigneeName || 'Unassigned'}
                            src={avatarFromMembers(
                              getProject(t.projectId)?.members ?? [],
                              t.assigneeId,
                              t.assigneeName,
                            )}
                            seed={t.assigneeName || t.id}
                            size="xs"
                            userId={presenceUserIdFromMembers(
                              getProject(t.projectId)?.members ?? [],
                              t.assigneeId,
                            )}
                          />
                          {t.assigneeName || 'Unassigned'}
                        </span>
                        <span className="inline-flex items-center gap-1.5 capitalize">
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ background: statusColor }}
                          />
                          {t.status.replace('_', ' ')}
                        </span>
                        <span style={{ color: priorityColor }} className="font-medium capitalize">
                          {t.priority}
                        </span>
                        <span>
                          {t.dueDate
                            ? new Date(t.dueDate).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                              })
                            : 'No due'}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[520px] text-left text-[13px] sm:min-w-[640px]">
                <thead className="sticky top-0 bg-ink-900 text-[11px] font-semibold tracking-wide text-ink-400 uppercase">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Task</th>
                    <th className="px-3 py-2.5 font-semibold">Project</th>
                    <th className="px-3 py-2.5 font-semibold">Assignee</th>
                    <th className="px-3 py-2.5 font-semibold">Status</th>
                    <th className="px-3 py-2.5 font-semibold">Priority</th>
                    <th className="px-3 py-2.5 font-semibold">Due</th>
                  </tr>
                </thead>
                <tbody>
                  {taskList.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-sm text-ink-400">
                        No tasks in this view. Open the board to create one.
                      </td>
                    </tr>
                  ) : (
                    taskList.map((t) => {
                      const proj = getProject(t.projectId);
                      const statusColor =
                        STATUS_META.find((s) => s.id === t.status)?.color ?? '#80848e';
                      const priorityColor =
                        PRIORITY_META.find((p) => p.id === t.priority)?.color ?? '#80848e';
                      return (
                        <tr
                          key={t.id}
                          className="border-t border-ink-700/80 transition-colors hover:bg-ink-900/60"
                        >
                          <td className="px-4 py-2.5">
                            <p className="font-medium text-ink-50">{t.title}</p>
                            <p className="mt-0.5 text-[11px] text-ink-400">{t.key}</p>
                          </td>
                          <td className="px-3 py-2.5 text-ink-300">{proj?.name ?? '—'}</td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <UserAvatar
                                name={t.assigneeName || 'Unassigned'}
                                src={avatarFromMembers(
                                  getProject(t.projectId)?.members ?? [],
                                  t.assigneeId,
                                  t.assigneeName,
                                )}
                                seed={t.assigneeName || t.id}
                                size="xs"
                                userId={presenceUserIdFromMembers(
                                  getProject(t.projectId)?.members ?? [],
                                  t.assigneeId,
                                )}
                              />
                              <span className="truncate text-ink-300">{t.assigneeName}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="inline-flex items-center gap-1.5 text-[12px] capitalize text-ink-300">
                              <span
                                className="h-1.5 w-1.5 rounded-full"
                                style={{ background: statusColor }}
                              />
                              {t.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <span
                              className="text-[12px] font-medium capitalize"
                              style={{ color: priorityColor }}
                            >
                              {t.priority}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-ink-400">
                            {t.dueDate
                              ? new Date(t.dueDate).toLocaleDateString(undefined, {
                                  month: 'short',
                                  day: 'numeric',
                                })
                              : '—'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* Users list */}
        <aside className="border-t border-ink-600 bg-ink-800 lg:border-t-0 lg:border-l">
          <div className="border-b border-ink-600 px-4 py-3">
            <h2 className="text-sm font-semibold text-ink-50">Users</h2>
            <p className="mt-0.5 text-[12px] text-ink-400">
              Project members · {teamUsers.length}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setSelectedUserEmail('all')}
            className={cn(
              'flex items-center gap-2.5 border-b border-ink-700 px-4 py-2.5 text-left text-[13px] transition-colors',
              selectedUserEmail === 'all'
                ? 'bg-brand-500/10 font-semibold'
                : 'hover:bg-ink-900/70',
            )}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-500 text-[10px] font-bold text-white">
              All
            </span>
            <div>
              <p className="text-ink-50">All members</p>
              <p className="text-[11px] font-normal text-ink-400">
                {activeProjectId === 'all' ? 'Your projects' : 'This project'}
              </p>
            </div>
          </button>

          <ul>
            {teamUsers.length === 0 ? (
              <li className="px-4 py-8 text-center text-xs text-ink-400">
                Invite members from the board.
              </li>
            ) : (
              teamUsers.map((u) => {
                const active = selectedUserEmail === u.email.toLowerCase();
                const isYou =
                  u.email.toLowerCase() === (user?.email ?? '').toLowerCase() ||
                  u.name.toLowerCase() === (user?.name ?? '').toLowerCase();
                return (
                  <li key={u.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedUserEmail(u.email.toLowerCase())}
                      className={cn(
                        'flex w-full items-center gap-2.5 border-b border-ink-700/80 px-4 py-2.5 text-left transition-colors',
                        active ? 'bg-brand-500/10' : 'hover:bg-ink-900/70',
                      )}
                    >
                      <UserAvatar
                        name={u.name}
                        src={
                          orgUsers.find(
                            (ou) => ou.email.toLowerCase() === u.email.toLowerCase(),
                          )?.avatarUrl ??
                          (u.email.toLowerCase() === (user?.email ?? '').toLowerCase()
                            ? user?.avatarUrl
                            : null)
                        }
                        seed={u.email || u.name}
                        size="sm"
                        userId={u.userId || u.id}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-ink-50">
                          {u.name}
                          {isYou ? (
                            <span className="ml-1 font-normal text-ink-400">(you)</span>
                          ) : null}
                        </p>
                        <p className="truncate text-[11px] text-ink-400">
                          {u.openCount} open · {u.taskCount} total
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })
            )}
          </ul>

          <div className="border-t border-ink-600 p-3">
            <Link to="/board" className="block">
              <Button size="sm" className="w-full">
                Open board
              </Button>
            </Link>
          </div>
        </aside>
      </div>
        </>
      ) : null}
      </div>

      {showCreateProject ? (
        <CreateProjectModal
          onClose={() => setShowCreateProject(false)}
          onCreated={(projectId) => {
            setShowCreateProject(false);
            setActiveProjectId(projectId);
            navigate(`/board?project=${projectId}`);
          }}
        />
      ) : null}

      {showAddUser ? (
        <AddUserModal
          onClose={() => setShowAddUser(false)}
          onSaved={() => void loadOrgUsers()}
        />
      ) : null}

      {assignUser ? (
        <AddUserModal
          assignTo={assignUser}
          onClose={() => setAssignUser(null)}
          onSaved={() => void loadOrgUsers()}
        />
      ) : null}

      <ConfirmModal
        open={Boolean(projectToDelete)}
        title="Delete project?"
        message={
          projectToDelete
            ? `Permanently delete “${getProject(projectToDelete)?.name ?? 'this project'}”? Tasks, timeline items, and invites for this project will be removed. This cannot be undone.`
            : ''
        }
        confirmLabel="Delete project"
        danger
        busy={deletingProject}
        onCancel={() => setProjectToDelete(null)}
        onConfirm={() => {
          if (!projectToDelete) return;
          setDeletingProject(true);
          void deleteProject(projectToDelete)
            .then(() => setProjectToDelete(null))
            .catch(() => {
              /* error surfaces via UI state if needed */
            })
            .finally(() => setDeletingProject(false));
        }}
      />
    </div>
  );
}
