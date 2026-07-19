import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AddUserModal } from '@/components/dashboard/AddUserModal';
import { AdminActivityPanel } from '@/components/dashboard/AdminActivityPanel';
import { CreateProjectModal } from '@/components/dashboard/CreateProjectModal';
import { TimelinePanel } from '@/components/dashboard/TimelinePanel';
import { Button } from '@/components/ui/Button';
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
  { id: 'todo', label: 'To do', color: '#64748b', fill: 'fill-ink-400' },
  { id: 'in_progress', label: 'In progress', color: '#f59e0b', fill: 'fill-amber-500' },
  { id: 'review', label: 'In review', color: '#0ea5e9', fill: 'fill-sky-500' },
  { id: 'done', label: 'Done', color: '#10b981', fill: 'fill-emerald-500' },
] as const;

const PRIORITY_META = [
  { id: 'highest', label: 'Highest', color: '#dc2626' },
  { id: 'high', label: 'High', color: '#ea580c' },
  { id: 'medium', label: 'Medium', color: '#d97706' },
  { id: 'low', label: 'Low', color: '#059669' },
  { id: 'lowest', label: 'Lowest', color: '#94a3b8' },
] as const;

function DonutChart({
  slices,
}: {
  slices: { label: string; value: number; color: string }[];
}) {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  const r = 54;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 140 140" className="h-36 w-36 shrink-0">
        <circle cx="70" cy="70" r={r} fill="none" stroke="#e2e8f0" strokeWidth="16" />
        {slices.map((slice) => {
          const len = (slice.value / total) * c;
          const el = (
            <circle
              key={slice.label}
              cx="70"
              cy="70"
              r={r}
              fill="none"
              stroke={slice.color}
              strokeWidth="16"
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 70 70)"
            />
          );
          offset += len;
          return el;
        })}
        <text
          x="70"
          y="66"
          textAnchor="middle"
          className="fill-ink-900"
          style={{ fontSize: 22, fontWeight: 700 }}
        >
          {slices.reduce((s, x) => s + x.value, 0)}
        </text>
        <text
          x="70"
          y="84"
          textAnchor="middle"
          className="fill-ink-500"
          style={{ fontSize: 10, fontWeight: 600 }}
        >
          tasks
        </text>
      </svg>
      <ul className="space-y-1.5">
        {slices.map((s) => (
          <li key={s.label} className="flex items-center gap-2 text-xs">
            <span className="h-2 w-2 shrink-0" style={{ background: s.color }} />
            <span className="font-medium text-ink-700">{s.label}</span>
            <span className="ml-auto tabular-nums text-ink-500">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BarChart({
  bars,
}: {
  bars: { label: string; value: number; color: string }[];
}) {
  const max = Math.max(...bars.map((b) => b.value), 1);
  const h = 140;
  const gap = 12;
  const barW = 36;
  const width = bars.length * (barW + gap) + gap;

  return (
    <svg viewBox={`0 0 ${width} ${h + 28}`} className="h-44 w-full max-w-md">
      {bars.map((b, i) => {
        const bh = (b.value / max) * (h - 16);
        const x = gap + i * (barW + gap);
        const y = h - bh;
        return (
          <g key={b.label}>
            <rect x={x} y={y} width={barW} height={Math.max(bh, 2)} fill={b.color} />
            <text
              x={x + barW / 2}
              y={y - 6}
              textAnchor="middle"
              style={{ fontSize: 10, fontWeight: 700, fill: '#0f172a' }}
            >
              {b.value}
            </text>
            <text
              x={x + barW / 2}
              y={h + 16}
              textAnchor="middle"
              style={{ fontSize: 9, fontWeight: 600, fill: '#64748b' }}
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
  const { projects, tasks, getProject, timeline } = useWorkspace();
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

  const isAdmin = user?.role === 'Admin';
  const firstName = user?.name.split(' ')[0] ?? 'there';
  const pendingTimeline = timeline.filter((t) => !t.taskId).length;
  const tabs = useMemo(
    () =>
      isAdmin
        ? [...BASE_TABS, { id: 'activity' as const, label: 'Activity' }]
        : BASE_TABS,
    [isAdmin],
  );

  useEffect(() => {
    if (!isAdmin && tab === 'activity') setTab('overview');
  }, [isAdmin, tab]);

  const loadOrgUsers = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const data = await listOrgUsers();
      setOrgUsers(data.users);
    } catch {
      /* ignore — fall back to project members */
    }
  }, [isAdmin]);

  useEffect(() => {
    if (tab === 'users' && isAdmin) void loadOrgUsers();
  }, [tab, isAdmin, loadOrgUsers]);

  const teamUsers = useMemo(() => {
    const map = new Map<string, TeamUser>();
    for (const p of projects) {
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
    for (const t of tasks) {
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
  }, [projects, tasks, getProject, orgUsers]);

  const stats = useMemo(() => {
    let scope: BoardTask[] = tasks;

    if (selectedUserEmail === 'all') {
      scope = tasks;
    } else {
      const member = teamUsers.find((u) => u.email.toLowerCase() === selectedUserEmail);
      scope = tasks.filter(
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
    const byProject = projects.map((p) => ({
      label: p.key.slice(0, 4),
      value: scope.filter((t) => t.projectId === p.id).length,
      color: '#0f766e',
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
  }, [tasks, projects, selectedUserEmail, teamUsers]);

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
    label: p.label.slice(0, 3),
    value: stats.byPriority[p.id] ?? 0,
    color: p.color,
  }));

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {/* Top bar */}
      <section className="shrink-0 border-b border-ink-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-5">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold tracking-wide text-ink-400 uppercase">
              Dashboard
            </p>
            <h1 className="truncate text-lg font-semibold text-ink-950 md:text-xl">
              {greeting()}, {firstName}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex h-8 items-center gap-2 border border-ink-200 bg-ink-50 px-2.5">
              <span
                className={cn(
                  'h-1.5 w-1.5 shrink-0 rounded-full',
                  !checkedIn
                    ? 'bg-ink-300'
                    : onBreak
                      ? 'bg-amber-500'
                      : 'bg-emerald-500',
                )}
              />
              <span className="text-[10px] font-semibold tracking-wide text-ink-500 uppercase">
                {!checkedIn ? 'Out' : onBreak ? 'Break' : 'In'}
              </span>
              <span className="text-sm font-semibold tabular-nums text-ink-950">
                {checkedIn ? elapsedLabel : '00:00:00'}
              </span>
              {checkedIn && checkInAt ? (
                <span className="hidden text-[10px] text-ink-400 sm:inline">
                  · in {checkInAt}
                </span>
              ) : null}
              {!checkedIn && checkOutAt ? (
                <span className="hidden text-[10px] text-ink-400 sm:inline">
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
                  Check out
                </Button>
              </>
            )}
            {isAdmin ? (
              <Button size="xs" variant="secondary" onClick={() => setShowCreateProject(true)}>
                New project
              </Button>
            ) : null}
            <Link to="/board">
              <Button size="xs" variant="secondary">
                Board
              </Button>
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <nav className="flex flex-wrap gap-0 border-t border-ink-100 px-2 md:px-3">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                'border-b-2 px-3 py-2 text-xs font-semibold transition',
                tab === t.id
                  ? 'border-ink-900 text-ink-900'
                  : 'border-transparent text-ink-500 hover:text-ink-800',
              )}
            >
              {t.label}
              {t.id === 'timeline' && pendingTimeline > 0 ? (
                <span className="ml-1.5 tabular-nums text-ink-400">{pendingTimeline}</span>
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

      {tab === 'activity' && isAdmin ? (
        <div className="min-h-0 flex-1 overflow-hidden">
          <AdminActivityPanel />
        </div>
      ) : null}

      {tab === 'tasks' ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-200 px-4 py-2.5">
            <div>
              <h2 className="text-sm font-semibold text-ink-900">Task list view</h2>
              <p className="text-[11px] text-ink-500">{taskList.length} tasks</p>
            </div>
            <div className="flex items-center gap-1">
              {(['all', 'open', 'done'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setTaskFilter(f)}
                  className={cn(
                    'px-2.5 py-1 text-[11px] font-semibold capitalize',
                    taskFilter === f
                      ? 'bg-ink-900 text-white'
                      : 'text-ink-600 hover:bg-ink-100',
                  )}
                >
                  {f}
                </button>
              ))}
              <div className="ml-2 w-[140px]">
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
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead className="sticky top-0 bg-ink-50 text-[10px] font-bold tracking-wide text-ink-500 uppercase">
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
                      <tr key={t.id} className="border-t border-ink-100 hover:bg-ink-50/80">
                        <td className="px-4 py-2.5">
                          <p className="font-semibold text-ink-900">{t.title}</p>
                          <p className="text-[10px] text-ink-400">{t.key}</p>
                        </td>
                        <td className="px-3 py-2.5 text-ink-600">{proj?.name ?? '—'}</td>
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
                        <td className="px-3 py-2.5 capitalize text-ink-600">
                          {t.status.replace('_', ' ')}
                        </td>
                        <td className="px-3 py-2.5 capitalize">{t.priority}</td>
                        <td className="px-4 py-2.5 text-ink-500">
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
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-200 px-4 py-2.5">
            <div>
              <h2 className="text-sm font-semibold text-ink-900">Users list</h2>
              <p className="text-[11px] text-ink-500">
                {teamUsers.length} people across projects · click to filter Tasks tab
              </p>
            </div>
            {isAdmin ? (
              <Button size="xs" onClick={() => setShowAddUser(true)}>
                Add user
              </Button>
            ) : null}
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead className="sticky top-0 bg-ink-50 text-[10px] font-bold tracking-wide text-ink-500 uppercase">
                <tr>
                  <th className="px-4 py-2">User</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">Open</th>
                  <th className="px-3 py-2">Total</th>
                  <th className="px-3 py-2">Projects</th>
                  {isAdmin ? <th className="px-4 py-2 text-right">Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {teamUsers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={isAdmin ? 7 : 6}
                      className="px-4 py-12 text-center text-ink-400"
                    >
                      {isAdmin
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
                        className="border-t border-ink-100 hover:bg-ink-50/80"
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
                            <span className="font-semibold text-ink-900">
                              {u.name}
                              {isYou ? (
                                <span className="ml-1 font-medium text-ink-400">(you)</span>
                              ) : null}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-ink-600">{u.email}</td>
                        <td className="px-3 py-2.5 capitalize text-ink-600">
                          {orgUser?.role ?? u.role}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums font-semibold text-ink-900">
                          {u.openCount}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums text-ink-600">{u.taskCount}</td>
                        <td className="px-3 py-2.5 text-ink-500">
                          {u.projects.length > 0 ? u.projects.join(', ') : '—'}
                        </td>
                        {isAdmin ? (
                          <td className="px-4 py-2.5 text-right">
                            {orgUser ? (
                              <button
                                type="button"
                                className="text-[11px] font-semibold text-teal-800 hover:underline"
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
      <section className="grid shrink-0 grid-cols-2 border-b border-ink-200 bg-white sm:grid-cols-4">
        {[
          { label: 'Open tasks', value: stats.open, hint: `${stats.totalTasks} total` },
          { label: 'Done', value: stats.byStatus.done, hint: `${stats.completion}%` },
          { label: 'Due week', value: stats.dueSoon, hint: `${stats.overdue} overdue` },
          { label: 'Projects', value: projects.length, hint: `${teamUsers.length} users` },
        ].map((card, i) => (
          <div
            key={card.label}
            className={cn(
              'px-4 py-3',
              i < 3 && 'border-r border-ink-100',
              i >= 2 && 'border-t border-ink-100 sm:border-t-0',
            )}
          >
            <p className="text-[10px] font-bold tracking-wide text-ink-500 uppercase">
              {card.label}
            </p>
            <p className="mt-0.5 text-2xl font-semibold tabular-nums text-ink-950">{card.value}</p>
            <p className="text-[11px] text-ink-500">{card.hint}</p>
          </div>
        ))}
      </section>

      {/* Main full-screen grid */}
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1fr_320px]">
        <div className="min-h-0 overflow-y-auto">
          {/* Graphs */}
          <section className="grid border-b border-ink-200 bg-white lg:grid-cols-3">
            <div className="border-b border-ink-200 p-4 lg:border-r lg:border-b-0">
              <h2 className="text-xs font-semibold text-ink-900">Status mix</h2>
              <p className="text-[11px] text-ink-500">Tasks by column</p>
              <div className="mt-3">
                <DonutChart slices={statusSlices} />
              </div>
            </div>
            <div className="border-b border-ink-200 p-4 lg:border-r lg:border-b-0">
              <h2 className="text-xs font-semibold text-ink-900">Priority</h2>
              <p className="text-[11px] text-ink-500">Distribution</p>
              <div className="mt-3 flex justify-center">
                <BarChart bars={priorityBars} />
              </div>
            </div>
            <div className="p-4">
              <h2 className="text-xs font-semibold text-ink-900">By project</h2>
              <p className="text-[11px] text-ink-500">Workload</p>
              <div className="mt-3 flex justify-center">
                {stats.byProject.length === 0 ? (
                  <p className="py-10 text-xs text-ink-400">No projects yet</p>
                ) : (
                  <BarChart
                    bars={stats.byProject.map((b, i) => ({
                      ...b,
                      color: ['#0f766e', '#0369a1', '#b45309', '#be123c'][i % 4],
                    }))}
                  />
                )}
              </div>
            </div>
          </section>

          {/* Task list */}
          <section className="flex min-h-[320px] flex-col bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-200 px-4 py-2.5">
              <div>
                <h2 className="text-sm font-semibold text-ink-900">Task list</h2>
                <p className="text-[11px] text-ink-500">
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
                      'px-2.5 py-1 text-[11px] font-semibold capitalize',
                      taskFilter === f
                        ? 'bg-ink-900 text-white'
                        : 'text-ink-600 hover:bg-ink-100',
                    )}
                  >
                    {f}
                  </button>
                ))}
                <Link to="/board" className="ml-2">
                  <Button size="xs" variant="secondary">
                    Board
                  </Button>
                </Link>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead className="sticky top-0 bg-ink-50 text-[10px] font-bold tracking-wide text-ink-500 uppercase">
                  <tr>
                    <th className="px-4 py-2 font-bold">Task</th>
                    <th className="px-3 py-2 font-bold">Project</th>
                    <th className="px-3 py-2 font-bold">Assignee</th>
                    <th className="px-3 py-2 font-bold">Status</th>
                    <th className="px-3 py-2 font-bold">Priority</th>
                    <th className="px-4 py-2 font-bold">Due</th>
                  </tr>
                </thead>
                <tbody>
                  {taskList.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-ink-400">
                        No tasks in this view. Open the board to create one.
                      </td>
                    </tr>
                  ) : (
                    taskList.map((t) => {
                      const proj = getProject(t.projectId);
                      return (
                        <tr
                          key={t.id}
                          className="border-t border-ink-100 transition hover:bg-ink-50/80"
                        >
                          <td className="px-4 py-2.5">
                            <p className="font-semibold text-ink-900">{t.title}</p>
                            <p className="text-[10px] text-ink-400">{t.key}</p>
                          </td>
                          <td className="px-3 py-2.5 text-ink-600">{proj?.name ?? '—'}</td>
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
                              <span className="truncate text-ink-700">{t.assigneeName}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 capitalize text-ink-600">
                            {t.status.replace('_', ' ')}
                          </td>
                          <td className="px-3 py-2.5 capitalize text-ink-600">{t.priority}</td>
                          <td className="px-4 py-2.5 text-ink-500">
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
        <aside className="flex min-h-0 flex-col border-t border-ink-200 bg-white lg:border-t-0 lg:border-l">
          <div className="border-b border-ink-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-ink-900">Users</h2>
            <p className="text-[11px] text-ink-500">
              Click to filter tasks · {teamUsers.length} people
            </p>
          </div>

          <button
            type="button"
            onClick={() => setSelectedUserEmail('all')}
            className={cn(
              'flex items-center gap-2.5 border-b border-ink-100 px-4 py-2.5 text-left text-xs',
              selectedUserEmail === 'all' ? 'bg-ink-100 font-semibold' : 'hover:bg-ink-50',
            )}
          >
            <span className="flex h-8 w-8 items-center justify-center bg-ink-900 text-[10px] font-bold text-white">
              All
            </span>
            <div>
              <p className="text-ink-900">All users</p>
              <p className="text-[11px] font-normal text-ink-500">Full workspace view</p>
            </div>
          </button>

          <ul className="min-h-0 flex-1 overflow-y-auto">
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
                        'flex w-full items-center gap-2.5 border-b border-ink-100 px-4 py-2.5 text-left',
                        active ? 'bg-brand-50' : 'hover:bg-ink-50',
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
                        size="md"
                        className={cn(active && 'ring-2 ring-ink-900 ring-offset-1')}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-ink-900">
                          {u.name}
                          {isYou ? (
                            <span className="ml-1 font-medium text-ink-400">(you)</span>
                          ) : null}
                        </p>
                        <p className="truncate text-[11px] text-ink-500">
                          {u.openCount} open · {u.taskCount} total · {u.role}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })
            )}
          </ul>

          <div className="border-t border-ink-200 p-3">
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
    </div>
  );
}
