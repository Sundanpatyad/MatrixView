import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AddUserModal } from '@/components/dashboard/AddUserModal';
import { AdminActivityPanel } from '@/components/dashboard/AdminActivityPanel';
import { CreateProjectModal } from '@/components/dashboard/CreateProjectModal';
import { TimelinePanel } from '@/components/dashboard/TimelinePanel';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Select } from '@/components/ui/Select';
import { UserAvatar, avatarFromMembers } from '@/components/ui/UserAvatar';
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
  { id: 'timeline', label: 'Timeline' },
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
  { id: 'highest', label: 'Highest', color: '#ed4245' },
  { id: 'high', label: 'High', color: '#f07178' },
  { id: 'medium', label: 'Medium', color: '#f0b232' },
  { id: 'low', label: 'Low', color: '#3ba55d' },
  { id: 'lowest', label: 'Lowest', color: '#80848e' },
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
    <div className="flex items-center gap-4">
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
      <ul className="min-w-0 flex-1 space-y-1">
        {slices.map((s) => (
          <li key={s.label} className="flex items-center gap-2 text-[11px]">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: s.color }} />
            <span className="min-w-0 flex-1 truncate text-ink-200">{s.label}</span>
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
  const h = 112;
  const gap = 10;
  const barW = 28;
  const width = Math.max(bars.length * (barW + gap) + gap, 120);

  return (
    <svg viewBox={`0 0 ${width} ${h + 22}`} className="h-36 w-full">
      {bars.map((b, i) => {
        const bh = (b.value / max) * (h - 14);
        const x = gap + i * (barW + gap);
        const y = h - bh;
        return (
          <g key={b.id}>
            <rect
              x={x}
              y={4}
              width={barW}
              height={h - 4}
              rx={6}
              fill="var(--chart-track)"
              opacity={0.35}
            />
            <rect x={x} y={y} width={barW} height={Math.max(bh, 3)} rx={6} fill={b.color} />
            <text
              x={x + barW / 2}
              y={y - 4}
              textAnchor="middle"
              style={{ fontSize: 9, fontWeight: 700, fill: 'var(--ink-50)' }}
            >
              {b.value}
            </text>
            <text
              x={x + barW / 2}
              y={h + 14}
              textAnchor="middle"
              style={{ fontSize: 8, fontWeight: 600, fill: 'var(--ink-300)' }}
            >
              {b.label}
            </text>
          </g>
        );
      })}
    </svg>
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
                m.email.toLowerCase() === user.email.toLowerCase(),
            ),
          ),
      ),
    [projects, user],
  );

  const projectSwitchOptions = useMemo(
    () => [
      { value: 'all', label: `All projects (${projects.length})` },
      ...projects.map((p) => {
        const role =
          user &&
          p.members.find((m) => m.email.toLowerCase() === user.email.toLowerCase())?.role;
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
      isProjectAdminAnywhere
        ? [...BASE_TABS, { id: 'activity' as const, label: 'Activity' }]
        : BASE_TABS,
    [isProjectAdminAnywhere],
  );

  useEffect(() => {
    if (!isProjectAdminAnywhere && tab === 'activity') setTab('overview');
  }, [isProjectAdminAnywhere, tab]);

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

  const teamUsers = useMemo(() => {
    const map = new Map<string, TeamUser>();
    for (const p of scopedProjects) {
      const project = getProject(p.id);
      if (!project) continue;
      for (const m of project.members) {
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
    // Include org users who may not be on a project yet
    for (const ou of orgUsers) {
      const key = ou.email.toLowerCase();
      const existing = map.get(key);
      if (existing) {
        for (const p of ou.projects) {
          if (!existing.projects.includes(p.name)) existing.projects.push(p.name);
        }
      } else {
        map.set(key, {
          id: ou.id,
          name: ou.name,
          email: ou.email,
          role: 'member',
          addedAt: ou.createdAt ?? '',
          taskCount: 0,
          openCount: 0,
          projects: ou.projects.map((p) => p.name),
        });
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
  }, [scopedProjects, scopedTasks, getProject, orgUsers]);

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
      label: p.key.slice(0, 4),
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
    label: p.label.slice(0, 3),
    value: stats.byPriority[p.id] ?? 0,
    color: p.color,
  }));

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {/* Top bar */}
      <section className="shrink-0 border-b border-ink-600 bg-ink-800">
        <div className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-4">
          <div className="min-w-0 shrink-0">
            <p className="text-[10px] font-semibold tracking-wide text-ink-400 uppercase">
              Dashboard
            </p>
            <h1 className="truncate text-base font-semibold text-ink-50 sm:text-lg">
              {greeting()}, {firstName}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
            <div className="w-[160px] shrink-0 sm:w-[200px]">
              <Select
                value={activeProjectId}
                onChange={(value) => setActiveProjectId(value as typeof activeProjectId)}
                options={projectSwitchOptions}
                aria-label="Switch project"
                size="xs"
              />
            </div>
            {myRoleOnActive ? (
              <span
                className={cn(
                  'hidden rounded-md px-2 py-1 text-[10px] font-bold tracking-wide uppercase md:inline',
                  myRoleOnActive === 'admin'
                    ? 'bg-brand-500/10 text-brand-300'
                    : 'bg-ink-700 text-ink-200',
                )}
              >
                {myRoleOnActive}
              </span>
            ) : null}

            <div className="flex h-7 shrink-0 items-center gap-1.5 border border-ink-600 bg-ink-900 px-2">
              <span
                className={cn(
                  'h-1.5 w-1.5 shrink-0 rounded-full',
                  !checkedIn
                    ? 'bg-ink-300'
                    : onBreak
                      ? 'bg-[#f0b232]'
                      : 'bg-[#23a559]',
                )}
              />
              <span className="hidden text-[10px] font-semibold tracking-wide text-ink-300 uppercase sm:inline">
                {!checkedIn ? 'Out' : onBreak ? 'Break' : 'In'}
              </span>
              <span className="text-xs font-semibold tabular-nums text-ink-50">
                {checkedIn ? elapsedLabel : '00:00:00'}
              </span>
              {checkedIn && checkInAt ? (
                <span className="hidden text-[10px] text-ink-400 lg:inline">
                  · in {checkInAt}
                </span>
              ) : null}
              {!checkedIn && checkOutAt ? (
                <span className="hidden text-[10px] text-ink-400 lg:inline">
                  · out {checkOutAt}
                </span>
              ) : null}
            </div>

            {!attendanceReady ? (
              <Button size="xs" variant="secondary" disabled>
                …
              </Button>
            ) : !checkedIn ? (
              <Button size="xs" onClick={() => void checkIn()}>
                Check in
              </Button>
            ) : (
              <>
                <Button size="xs" variant="secondary" onClick={toggleBreak}>
                  {onBreak ? 'End break' : 'Break'}
                </Button>
                <Button size="xs" variant="danger" onClick={() => void checkOut()}>
                  <span className="sm:hidden">Out</span>
                  <span className="hidden sm:inline">Check out</span>
                </Button>
              </>
            )}
            <Button size="xs" variant="secondary" onClick={() => setShowCreateProject(true)}>
              <span className="sm:hidden">New</span>
              <span className="hidden sm:inline">New project</span>
            </Button>
            {canDeleteActiveProject ? (
              <Button
                size="xs"
                variant="danger"
                onClick={() => setProjectToDelete(activeProjectId)}
                className="hidden sm:inline-flex"
              >
                Delete
              </Button>
            ) : null}
            <Link
              to={
                activeProjectId !== 'all'
                  ? `/board?project=${activeProjectId}`
                  : '/board'
              }
            >
              <Button size="xs" variant="secondary">
                Board
              </Button>
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <nav className="flex gap-0 overflow-x-auto border-t border-ink-700 px-2 md:px-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                'shrink-0 border-b-2 px-3 py-2 text-xs font-semibold transition',
                tab === t.id
                  ? 'border-ink-900 text-ink-50'
                  : 'border-transparent text-ink-300 hover:text-ink-100',
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

      {tab === 'timeline' ? (
        <div className="min-h-0 flex-1 overflow-hidden">
          <TimelinePanel />
        </div>
      ) : null}

      {tab === 'activity' && isProjectAdminAnywhere ? (
        <div className="min-h-0 flex-1 overflow-hidden">
          <AdminActivityPanel />
        </div>
      ) : null}

      {tab === 'tasks' ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-ink-800">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-600 px-4 py-2.5">
            <div>
              <h2 className="text-sm font-semibold text-ink-50">Task list view</h2>
              <p className="text-[11px] text-ink-300">{taskList.length} tasks</p>
            </div>
            <div className="flex w-full flex-wrap items-center gap-1 sm:w-auto">
              {(['all', 'open', 'done'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setTaskFilter(f)}
                  className={cn(
                    'px-2.5 py-1 text-[11px] font-semibold capitalize',
                    taskFilter === f
                      ? 'bg-brand-500 text-white'
                      : 'text-ink-200 hover:bg-ink-700',
                  )}
                >
                  {f}
                </button>
              ))}
              <div className="ml-0 w-full min-w-0 sm:ml-2 sm:w-[140px]">
                <Select
                  size="xs"
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
          <div className="min-h-0 flex-1 overflow-auto">
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
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-ink-800">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-600 px-4 py-2.5">
            <div>
              <h2 className="text-sm font-semibold text-ink-50">Users list</h2>
              <p className="text-[11px] text-ink-300">
                {teamUsers.length} people across projects · click to filter Tasks tab
              </p>
            </div>
            {isProjectAdminAnywhere ? (
              <Button size="xs" onClick={() => setShowAddUser(true)}>
                Add user
              </Button>
            ) : null}
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            {/* Mobile cards */}
            <div className="space-y-2 p-3 md:hidden">
              {teamUsers.length === 0 ? (
                <p className="px-1 py-12 text-center text-xs text-ink-400">
                  {isProjectAdminAnywhere
                    ? 'No users yet. Click Add user to create one.'
                    : 'No users yet.'}
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
                        ? 'No users yet. Click Add user to create one.'
                        : 'No users yet.'}
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
      {/* KPI strip */}
      <section className="grid shrink-0 grid-cols-2 border-b border-ink-600 bg-ink-800 sm:grid-cols-4">
        {[
          { label: 'Open tasks', value: stats.open, hint: `${stats.totalTasks} total`, accent: '#00a8fc' },
          { label: 'Done', value: stats.byStatus.done, hint: `${stats.completion}%`, accent: '#23a559' },
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
              'px-4 py-2.5',
              i < 3 && 'border-r border-ink-700',
              i >= 2 && 'border-t border-ink-700 sm:border-t-0',
            )}
          >
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: card.accent }} />
              <p className="text-[10px] font-bold tracking-wide text-ink-400 uppercase">
                {card.label}
              </p>
            </div>
            <p className="mt-0.5 text-2xl font-semibold tabular-nums text-ink-50">{card.value}</p>
            <p className="text-[11px] text-ink-400">{card.hint}</p>
          </div>
        ))}
      </section>

      {/* Main full-screen grid */}
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1fr_280px]">
        <div className="min-h-0 overflow-y-auto">
          {/* Graphs */}
          <section className="grid border-b border-ink-600 bg-ink-800 lg:grid-cols-3">
            <div className="border-b border-ink-600 p-3 lg:border-r lg:border-b-0">
              <h2 className="text-xs font-semibold text-ink-50">Status mix</h2>
              <p className="text-[10px] text-ink-400">Tasks by column</p>
              <div className="mt-2">
                <DonutChart slices={statusSlices} />
              </div>
            </div>
            <div className="border-b border-ink-600 p-3 lg:border-r lg:border-b-0">
              <h2 className="text-xs font-semibold text-ink-50">Priority</h2>
              <p className="text-[10px] text-ink-400">Distribution</p>
              <div className="mt-2">
                <BarChart bars={priorityBars} />
              </div>
            </div>
            <div className="p-3">
              <h2 className="text-xs font-semibold text-ink-50">By project</h2>
              <p className="text-[10px] text-ink-400">Workload</p>
              <div className="mt-2">
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
          <section className="flex min-h-[280px] flex-col bg-ink-800">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-600 px-3 py-2">
              <div>
                <h2 className="text-sm font-semibold text-ink-50">Task list</h2>
                <p className="text-[10px] text-ink-400">
                  {taskList.length} shown
                  {selectedUserEmail !== 'all' ? ' · filtered by user' : ''}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {(['all', 'open', 'done'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setTaskFilter(f)}
                    className={cn(
                      'px-2 py-1 text-[11px] font-semibold capitalize',
                      taskFilter === f
                        ? 'bg-brand-500 text-white'
                        : 'text-ink-200 hover:bg-ink-700',
                    )}
                  >
                    {f}
                  </button>
                ))}
                <Link to="/board" className="ml-1">
                  <Button size="xs" variant="secondary">
                    Board
                  </Button>
                </Link>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-xs sm:min-w-[640px]">
                <thead className="sticky top-0 bg-ink-900 text-[10px] font-bold tracking-wide text-ink-400 uppercase">
                  <tr>
                    <th className="px-3 py-2 font-bold">Task</th>
                    <th className="px-3 py-2 font-bold">Project</th>
                    <th className="px-3 py-2 font-bold">Assignee</th>
                    <th className="px-3 py-2 font-bold">Status</th>
                    <th className="px-3 py-2 font-bold">Priority</th>
                    <th className="px-3 py-2 font-bold">Due</th>
                  </tr>
                </thead>
                <tbody>
                  {taskList.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-ink-400">
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
                          className="border-t border-ink-700 transition hover:bg-ink-900/70"
                        >
                          <td className="px-3 py-2">
                            <p className="font-semibold text-ink-50">{t.title}</p>
                            <p className="text-[10px] text-ink-400">{t.key}</p>
                          </td>
                          <td className="px-3 py-2 text-ink-200">{proj?.name ?? '—'}</td>
                          <td className="px-3 py-2">
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
                              />
                              <span className="truncate text-ink-200">{t.assigneeName}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <span className="inline-flex items-center gap-1 text-[11px] capitalize text-ink-200">
                              <span
                                className="h-1.5 w-1.5 rounded-full"
                                style={{ background: statusColor }}
                              />
                              {t.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className="text-[11px] font-semibold capitalize"
                              style={{ color: priorityColor }}
                            >
                              {t.priority}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-ink-300">
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
        <aside className="flex min-h-0 flex-col border-t border-ink-600 bg-ink-800 lg:border-t-0 lg:border-l">
          <div className="border-b border-ink-600 px-3 py-2">
            <h2 className="text-sm font-semibold text-ink-50">Users</h2>
            <p className="text-[10px] text-ink-400">
              Click to filter · {teamUsers.length} people
            </p>
          </div>

          <button
            type="button"
            onClick={() => setSelectedUserEmail('all')}
            className={cn(
              'flex items-center gap-2 border-b border-ink-700 px-3 py-2 text-left text-xs',
              selectedUserEmail === 'all'
                ? 'bg-brand-500/10 font-semibold'
                : 'hover:bg-ink-700',
            )}
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-500 text-[10px] font-bold text-white">
              All
            </span>
            <div>
              <p className="text-ink-50">All users</p>
              <p className="text-[10px] font-normal text-ink-400">Full workspace</p>
            </div>
          </button>

          <ul className="min-h-0 flex-1 overflow-y-auto">
            {teamUsers.length === 0 ? (
              <li className="px-3 py-6 text-center text-xs text-ink-400">
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
                        'flex w-full items-center gap-2 border-b border-ink-700 px-3 py-2 text-left',
                        active ? 'bg-brand-500/10' : 'hover:bg-ink-700',
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
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-ink-50">
                          {u.name}
                          {isYou ? (
                            <span className="ml-1 font-medium text-ink-400">(you)</span>
                          ) : null}
                        </p>
                        <p className="truncate text-[10px] text-ink-400">
                          {u.openCount} open · {u.taskCount} total
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })
            )}
          </ul>

          <div className="border-t border-ink-600 p-2">
            <Link to="/board" className="block">
              <Button size="xs" className="w-full">
                Open board
              </Button>
            </Link>
          </div>
        </aside>
      </div>
        </>
      ) : null}

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
