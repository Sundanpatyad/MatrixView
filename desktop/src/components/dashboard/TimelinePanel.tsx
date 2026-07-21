import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { EditTimelineModal } from '@/components/dashboard/EditTimelineModal';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { DatePicker } from '@/components/ui/DatePicker';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { UserAvatar, avatarFromMembers } from '@/components/ui/UserAvatar';
import { cn } from '@/lib/cn';
import {
  TASK_PRIORITIES,
  TASK_TYPES,
  attachmentHref,
  formatFileSize,
  type BoardTask,
  type Project,
  type ProjectMember,
  type TaskAttachment,
  type TaskPriority,
  type TaskType,
  type TimelineItem,
} from '@/lib/workspace/types';
import { useWorkspace } from '@/lib/workspace/WorkspaceContext';

const MAX_FILE_BYTES = 2 * 1024 * 1024;

type WorkFilter = 'backlog' | 'assigned' | 'all';
type RangeMode = 'day' | 'week' | 'month';

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

function isBoardUnassigned(task: BoardTask) {
  const id = (task.assigneeId ?? '').trim();
  const name = (task.assigneeName ?? '').trim().toLowerCase();
  return !id || !name || name === 'unassigned';
}

function toYmd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayYmd() {
  return toYmd(new Date());
}

/** Normalize dueDate / ISO strings to YYYY-MM-DD (local). Empty if missing/invalid. */
function dueKey(raw: string) {
  if (!raw?.trim()) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw.trim());
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '';
  return toYmd(d);
}

function parseYmd(value: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return new Date();
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function startOfWeek(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (x.getDay() + 6) % 7; // Monday = 0
  x.setDate(x.getDate() - day);
  return x;
}

function endOfWeek(d: Date) {
  const s = startOfWeek(d);
  s.setDate(s.getDate() + 6);
  return s;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function addDays(d: Date, n: number) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + n);
  return x;
}

function rangeBounds(anchor: string, mode: RangeMode): { start: string; end: string; label: string } {
  const d = parseYmd(anchor || todayYmd());
  if (mode === 'day') {
    const ymd = toYmd(d);
    return {
      start: ymd,
      end: ymd,
      label: d.toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
    };
  }
  if (mode === 'week') {
    const s = startOfWeek(d);
    const e = endOfWeek(d);
    return {
      start: toYmd(s),
      end: toYmd(e),
      label: `${s.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${e.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`,
    };
  }
  const s = startOfMonth(d);
  const e = endOfMonth(d);
  return {
    start: toYmd(s),
    end: toYmd(e),
    label: d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
  };
}

function formatDueHeading(key: string) {
  if (!key) return 'No due date';
  const d = parseYmd(key);
  const today = todayYmd();
  const tomorrow = toYmd(addDays(new Date(), 1));
  const base = d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  if (key === today) return `Today · ${base}`;
  if (key === tomorrow) return `Tomorrow · ${base}`;
  return base;
}

/** Unified row: backlog TimelineItems + all board Tasks for the project. */
type WorkRow = {
  key: string;
  source: 'backlog' | 'board';
  projectId: string;
  title: string;
  description: string;
  type: TaskType;
  priority: TaskPriority;
  dueDate: string;
  teamId: string | null;
  attachments: TaskAttachment[];
  createdByName: string;
  createdAt: string;
  /** Board column label or "Backlog" */
  statusLabel: string;
  inBacklog: boolean;
  assigneeId: string | null;
  assigneeName: string | null;
  timelineItem?: TimelineItem;
  task?: BoardTask;
};

type TeamBucket = {
  teamKey: string;
  teamLabel: string;
  rows: WorkRow[];
};

type DateBucket = {
  dateKey: string;
  dateLabel: string;
  teams: TeamBucket[] | null;
  rows: WorkRow[];
};

const label = 'text-[10px] font-bold tracking-wide text-ink-300 uppercase';

function AttachmentChips({
  items,
  onRemove,
  compact,
}: {
  items: TaskAttachment[];
  onRemove?: (id: string) => void;
  compact?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <ul className={cn('flex flex-wrap gap-1.5', !compact && 'mt-2 space-y-0')}>
      {items.map((att) => (
        <li
          key={att.id}
          className={cn(
            'flex items-center gap-2 border border-ink-600 bg-ink-800',
            compact ? 'px-2 py-1' : 'px-2.5 py-2',
          )}
        >
          {att.mimeType.startsWith('image/') && attachmentHref(att) ? (
            <img
              src={attachmentHref(att)}
              alt=""
              className={cn('shrink-0 object-cover', compact ? 'h-6 w-6' : 'h-8 w-8')}
            />
          ) : (
            <span
              className={cn(
                'flex shrink-0 items-center justify-center bg-ink-700 text-[9px] font-bold text-ink-200',
                compact ? 'h-6 w-6' : 'h-7 w-7',
              )}
            >
              FILE
            </span>
          )}
          <div className="min-w-0">
            {attachmentHref(att) ? (
              <a
                href={attachmentHref(att)}
                target="_blank"
                rel="noreferrer"
                className="block max-w-[160px] truncate text-[11px] font-semibold text-ink-100 hover:text-brand-800"
              >
                {att.name}
              </a>
            ) : (
              <p className="max-w-[160px] truncate text-[11px] font-semibold text-ink-100">
                {att.name}
              </p>
            )}
            {!compact ? (
              <p className="text-[10px] text-ink-400">{formatFileSize(att.size)}</p>
            ) : null}
          </div>
          {onRemove ? (
            <button
              type="button"
              onClick={() => onRemove(att.id)}
              className="text-[11px] font-semibold text-ink-400 hover:text-[#ed4245]"
            >
              ×
            </button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function TimelineTable({
  rows,
  getProject,
  isProjectAdmin,
  onAssign,
  onEdit,
  onDelete,
}: {
  rows: WorkRow[];
  getProject: (id: string) => Project | undefined;
  isProjectAdmin: (projectId: string) => boolean;
  onAssign: (row: WorkRow, memberId: string) => Promise<void>;
  onEdit: (item: TimelineItem) => void;
  onDelete: (item: TimelineItem) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left md:min-w-[880px]">
        <thead className="border-b border-ink-700 bg-ink-900/80 text-[10px] font-bold tracking-wide text-ink-400 uppercase">
          <tr>
            <th className="px-3 py-2 font-bold md:px-4">Task</th>
            <th className="px-2 py-2 font-bold">Project</th>
            <th className="px-2 py-2 font-bold">Status</th>
            <th className="px-2 py-2 font-bold">Priority</th>
            <th className="px-2 py-2 font-bold">Assignee</th>
            <th className="px-2 py-2 font-bold">Files</th>
            <th className="px-3 py-2 text-right font-bold md:px-4">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const proj = getProject(row.projectId);
            const canManageAssign = isProjectAdmin(row.projectId);
            const itemMembers = proj?.members ?? [];
            const memberOptions = itemMembers.map((m) => ({
              value: m.id,
              label: m.name,
            }));
            const currentAssigneeId =
              itemMembers.find(
                (m) =>
                  m.id === row.assigneeId ||
                  m.name.toLowerCase() === (row.assigneeName ?? '').toLowerCase(),
              )?.id ?? '';
            return (
              <tr
                key={row.key}
                className="border-b border-ink-700/80 transition last:border-b-0 hover:bg-ink-800/70"
              >
                <td className="px-3 py-2.5 md:px-4">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 bg-ink-700 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-ink-200 uppercase">
                      {row.type}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink-50">
                        {row.task?.key ? (
                          <span className="mr-1.5 text-[11px] font-bold text-ink-400">
                            {row.task.key}
                          </span>
                        ) : null}
                        {row.title}
                      </p>
                      {row.description ? (
                        <p className="mt-0.5 line-clamp-1 text-[11px] text-ink-300">
                          {row.description}
                        </p>
                      ) : null}
                      <p className="mt-1 text-[10px] text-ink-400">
                        {row.createdByName} · {formatDate(row.createdAt)}
                        {row.source === 'board' ? ' · Board' : ' · Backlog'}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-2 py-2.5 text-xs font-medium text-ink-200">
                  {proj?.name ?? '—'}
                </td>
                <td className="px-2 py-2.5">
                  <span
                    className={cn(
                      'inline-block px-1.5 py-0.5 text-[10px] font-bold uppercase',
                      row.inBacklog
                        ? 'bg-[#f0b232]/15 text-[#9a6700] dark:text-[#fee75c]'
                        : 'bg-[#23a559]/15 text-[#18783f] dark:text-[#57f287]',
                    )}
                  >
                    {row.statusLabel}
                  </span>
                </td>
                <td className="px-2 py-2.5 text-xs capitalize text-ink-200">{row.priority}</td>
                <td className="px-2 py-2.5">
                  {canManageAssign && memberOptions.length > 0 ? (
                    <div className="w-[150px]">
                      <Select
                        size="xs"
                        value={currentAssigneeId}
                        placeholder={row.inBacklog ? 'Assign to…' : 'Reassign…'}
                        onChange={(memberId) => {
                          if (!memberId || memberId === currentAssigneeId) return;
                          void onAssign(row, memberId);
                        }}
                        options={
                          row.inBacklog
                            ? [
                                { value: '', label: 'Assign to…', disabled: true },
                                ...memberOptions,
                              ]
                            : memberOptions
                        }
                        aria-label={
                          row.inBacklog ? `Assign ${row.title}` : `Reassign ${row.title}`
                        }
                      />
                    </div>
                  ) : row.assigneeName ? (
                    <div className="flex items-center gap-1.5">
                      <UserAvatar
                        name={row.assigneeName}
                        src={avatarFromMembers(
                          itemMembers,
                          row.assigneeId,
                          row.assigneeName,
                        )}
                        seed={row.assigneeName}
                        size="sm"
                      />
                      <span className="text-xs font-semibold text-ink-100">
                        {row.assigneeName}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-ink-400">Unassigned</span>
                  )}
                </td>
                <td className="px-2 py-2.5">
                  {row.attachments.length > 0 ? (
                    <AttachmentChips items={row.attachments} compact />
                  ) : (
                    <span className="text-xs text-ink-300">—</span>
                  )}
                </td>
                <td className="px-3 py-2.5 md:px-4">
                  <div className="flex items-center justify-end gap-2">
                    {row.source === 'backlog' && row.timelineItem && canManageAssign ? (
                      <>
                        <button
                          type="button"
                          onClick={() => onEdit(row.timelineItem!)}
                          className="text-[11px] font-semibold text-ink-200 hover:text-ink-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(row.timelineItem!)}
                          className="text-[11px] font-semibold text-ink-400 hover:text-[#ed4245]"
                        >
                          Remove
                        </button>
                      </>
                    ) : row.source === 'board' ? (
                      <span className="text-[10px] text-ink-400">On board</span>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const UNASSIGNED_FILTER = '__unassigned__';

/** One person across all scoped projects (deduped by email / userId). */
type FilterPerson = {
  /** Stable filter key (email or userId) */
  key: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  /** All project-member ids for this person (tasks may use any of them) */
  memberIds: string[];
  projectLabels: string[];
  teamLabels: string[];
};

function personKey(m: ProjectMember) {
  const email = (m.email ?? '').trim().toLowerCase();
  if (email) return `email:${email}`;
  if (m.userId) return `user:${m.userId}`;
  return `member:${m.id}`;
}

function UserMultiFilter({
  people,
  selectedIds,
  onChange,
}: {
  people: FilterPerson[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return people;
    return people.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        p.projectLabels.some((x) => x.toLowerCase().includes(q)) ||
        p.teamLabels.some((x) => x.toLowerCase().includes(q)),
    );
  }, [people, search]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open) setSearch('');
  }, [open]);

  function toggle(id: string) {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id],
    );
  }

  const labelText =
    selectedIds.length === 0
      ? 'All people'
      : selectedIds.length === 1
        ? selectedIds[0] === UNASSIGNED_FILTER
          ? 'Unassigned'
          : people.find((p) => p.key === selectedIds[0])?.name ?? '1 person'
        : `${selectedIds.length} people`;

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'inline-flex h-8 max-w-[200px] items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-semibold transition',
          selectedIds.length > 0
            ? 'border-brand-500/50 bg-brand-500/10 text-brand-200'
            : 'border-ink-600 bg-ink-900 text-ink-200 hover:bg-ink-700 hover:text-ink-50',
        )}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="truncate">{labelText}</span>
        <span className="text-ink-400">▾</span>
      </button>

      {open ? (
        <div className="absolute top-full right-0 z-40 mt-1.5 w-80 overflow-hidden rounded-xl border border-ink-600 bg-ink-800 shadow-xl">
          <div className="border-b border-ink-600 p-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search people, project, or team…"
              className="h-8 w-full rounded-md border border-ink-600 bg-ink-900 px-2.5 text-xs text-ink-50 outline-none placeholder:text-ink-400 focus:border-brand-500"
              autoFocus
            />
          </div>
          <div className="flex items-center justify-between gap-2 border-b border-ink-700 px-2.5 py-1.5">
            <button
              type="button"
              className="text-[10px] font-semibold text-brand-300 hover:text-brand-200"
              onClick={() =>
                onChange([UNASSIGNED_FILTER, ...people.map((p) => p.key)])
              }
            >
              Select all
            </button>
            <button
              type="button"
              className="text-[10px] font-semibold text-ink-400 hover:text-ink-200"
              onClick={() => onChange([])}
            >
              Clear
            </button>
          </div>
          <ul className="max-h-64 overflow-y-auto p-1" role="listbox" aria-multiselectable>
            <li>
              <label
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-ink-700',
                  selectedIds.includes(UNASSIGNED_FILTER) && 'bg-brand-500/10',
                )}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(UNASSIGNED_FILTER)}
                  onChange={() => toggle(UNASSIGNED_FILTER)}
                  className="accent-brand-500"
                />
                <span className="font-medium text-ink-100">Unassigned</span>
              </label>
            </li>
            {filtered.length === 0 ? (
              <li className="px-2 py-3 text-center text-[11px] text-ink-400">No people match</li>
            ) : (
              filtered.map((p) => {
                const on = selectedIds.includes(p.key);
                const meta = [
                  p.projectLabels.length
                    ? p.projectLabels.join(', ')
                    : null,
                  p.teamLabels.length ? `Teams: ${p.teamLabels.join(', ')}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ');
                return (
                  <li key={p.key}>
                    <label
                      className={cn(
                        'flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-ink-700',
                        on && 'bg-brand-500/10',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => toggle(p.key)}
                        className="mt-0.5 accent-brand-500"
                      />
                      <UserAvatar
                        name={p.name}
                        src={p.avatarUrl}
                        seed={p.email || p.name}
                        size="xs"
                        bare
                        className="mt-0.5"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-ink-100">
                          {p.name}
                        </span>
                        {meta ? (
                          <span className="mt-0.5 block line-clamp-2 text-[10px] leading-snug text-ink-400">
                            {meta}
                          </span>
                        ) : null}
                      </span>
                    </label>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function TimelinePanel() {
  const {
    projects,
    tasks,
    timeline,
    getProject,
    getProjectTeams,
    createTimelineItem,
    assignTimelineItem,
    deleteTimelineItem,
    updateTask,
    isProjectAdmin,
    activeProjectId: dashProjectId,
  } = useWorkspace();

  const adminProjects = projects.filter((p) => isProjectAdmin(p.id));
  const [projectId, setProjectId] = useState(adminProjects[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<TaskType>('task');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [teamId, setTeamId] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState('');
  const [filter, setFilter] = useState<WorkFilter>('all');
  const [rangeMode, setRangeMode] = useState<RangeMode>('week');
  const [anchorDate, setAnchorDate] = useState(todayYmd);
  /** Empty = all people. Includes UNASSIGNED_FILTER for unassigned work. */
  const [userFilterIds, setUserFilterIds] = useState<string[]>([]);
  const [editingItem, setEditingItem] = useState<TimelineItem | null>(null);
  const [itemToDelete, setItemToDelete] = useState<TimelineItem | null>(null);
  const [deletingItem, setDeletingItem] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (dashProjectId !== 'all' && isProjectAdmin(dashProjectId)) {
      setProjectId(dashProjectId);
    }
  }, [dashProjectId, isProjectAdmin]);

  const activeProjectId = adminProjects.some((p) => p.id === projectId)
    ? projectId
    : (adminProjects[0]?.id ?? '');

  const project = activeProjectId ? getProject(activeProjectId) : undefined;
  const members = project?.members ?? [];
  const createTeams = activeProjectId ? getProjectTeams(activeProjectId) : [];

  useEffect(() => {
    if (teamId && !createTeams.some((t) => t.id === teamId)) setTeamId('');
  }, [createTeams, teamId]);

  const scopeProjectIds = useMemo(() => {
    if (dashProjectId === 'all') return new Set(adminProjects.map((p) => p.id));
    return new Set([dashProjectId].filter(Boolean));
  }, [adminProjects, dashProjectId]);

  const filterPeople = useMemo((): FilterPerson[] => {
    type Acc = {
      key: string;
      name: string;
      email: string;
      avatarUrl?: string | null;
      memberIds: Set<string>;
      projects: Set<string>;
      teams: Set<string>;
    };
    const byPerson = new Map<string, Acc>();

    for (const projectId of scopeProjectIds) {
      const proj = getProject(projectId);
      if (!proj) continue;
      const projectLabel = proj.key || proj.name;
      const teams = getProjectTeams(projectId);

      for (const m of proj.members) {
        if (m.status === 'pending') continue;
        const key = personKey(m);
        let acc = byPerson.get(key);
        if (!acc) {
          acc = {
            key,
            name: m.name,
            email: m.email,
            avatarUrl: m.avatarUrl,
            memberIds: new Set(),
            projects: new Set(),
            teams: new Set(),
          };
          byPerson.set(key, acc);
        }
        acc.memberIds.add(m.id);
        acc.projects.add(projectLabel);
        if (m.avatarUrl && !acc.avatarUrl) acc.avatarUrl = m.avatarUrl;
        // Prefer longer/capitalized display name if we have a stub like "sundan"
        if (m.name.length > acc.name.length) acc.name = m.name;

        for (const team of teams) {
          if (team.memberIds.includes(m.id)) {
            acc.teams.add(team.name);
          }
        }
      }
    }

    return [...byPerson.values()]
      .map((a) => ({
        key: a.key,
        name: a.name,
        email: a.email,
        avatarUrl: a.avatarUrl,
        memberIds: [...a.memberIds],
        projectLabels: [...a.projects].sort((x, y) => x.localeCompare(y)),
        teamLabels: [...a.teams].sort((x, y) => x.localeCompare(y)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [scopeProjectIds, getProject, getProjectTeams]);

  useEffect(() => {
    const valid = new Set(filterPeople.map((p) => p.key));
    setUserFilterIds((prev) =>
      prev.filter((id) => id === UNASSIGNED_FILTER || valid.has(id)),
    );
  }, [filterPeople]);

  const scopedTeams = useMemo(() => {
    const list = [];
    for (const id of scopeProjectIds) {
      list.push(...getProjectTeams(id));
    }
    return list;
  }, [scopeProjectIds, getProjectTeams]);

  const hasTeams = scopedTeams.length > 0;

  const teamNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of scopedTeams) map.set(t.id, t.name);
    return map;
  }, [scopedTeams]);

  const rows = useMemo(() => {
    const list: WorkRow[] = [];

    // Backlog: timeline items not yet promoted to the board
    for (const item of timeline) {
      if (!scopeProjectIds.has(item.projectId)) continue;
      if (item.taskId) continue;
      list.push({
        key: `backlog-${item.id}`,
        source: 'backlog',
        projectId: item.projectId,
        title: item.title,
        description: item.description,
        type: item.type,
        priority: item.priority,
        dueDate: item.dueDate,
        teamId: item.teamId ?? null,
        attachments: item.attachments ?? [],
        createdByName: item.createdByName,
        createdAt: item.createdAt,
        statusLabel: 'Backlog',
        inBacklog: true,
        assigneeId: null,
        assigneeName: null,
        timelineItem: item,
      });
    }

    // All board tasks for scoped projects (assigned + unassigned)
    for (const task of tasks) {
      if (!scopeProjectIds.has(task.projectId)) continue;
      const proj = getProject(task.projectId);
      const col = proj?.columns.find((c) => c.id === task.status);
      const unassigned = isBoardUnassigned(task);
      list.push({
        key: `board-${task.id}`,
        source: 'board',
        projectId: task.projectId,
        title: task.title,
        description: task.description,
        type: task.type,
        priority: task.priority,
        dueDate: task.dueDate,
        teamId: task.teamId ?? null,
        attachments: task.attachments ?? [],
        createdByName: task.createdByName || task.reporterName || '—',
        createdAt: task.createdAt,
        statusLabel: col?.label ?? task.status,
        inBacklog: unassigned,
        assigneeId: unassigned ? null : task.assigneeId,
        assigneeName: unassigned ? null : task.assigneeName,
        task,
      });
    }

    return list.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  }, [timeline, tasks, scopeProjectIds, getProject]);

  const { start: rangeStart, end: rangeEnd, label: rangeLabel } = useMemo(
    () => rangeBounds(anchorDate, rangeMode),
    [anchorDate, rangeMode],
  );

  const items = useMemo(() => {
    let list = rows;
    if (filter === 'backlog') list = list.filter((r) => r.inBacklog);
    else if (filter === 'assigned') list = list.filter((r) => !r.inBacklog);

    list = list.filter((r) => {
      const key = dueKey(r.dueDate);
      if (!key) return true; // always show undated in a dedicated group
      return key >= rangeStart && key <= rangeEnd;
    });

    if (userFilterIds.length > 0) {
      const wantUnassigned = userFilterIds.includes(UNASSIGNED_FILTER);
      const selectedPeople = filterPeople.filter((p) =>
        userFilterIds.includes(p.key),
      );
      const selectedMemberIds = new Set(
        selectedPeople.flatMap((p) => p.memberIds),
      );
      const selectedNames = new Set(
        selectedPeople.map((p) => p.name.trim().toLowerCase()),
      );
      list = list.filter((r) => {
        const unassigned = !r.assigneeId && !(r.assigneeName ?? '').trim();
        if (unassigned) return wantUnassigned;
        if (r.assigneeId && selectedMemberIds.has(r.assigneeId)) return true;
        const name = (r.assigneeName ?? '').trim().toLowerCase();
        return Boolean(name && selectedNames.has(name));
      });
    }

    return list;
  }, [rows, filter, rangeStart, rangeEnd, userFilterIds, filterPeople]);

  const grouped = useMemo((): DateBucket[] => {
    const byDate = new Map<string, WorkRow[]>();
    for (const row of items) {
      const key = dueKey(row.dueDate);
      const bucket = byDate.get(key) ?? [];
      bucket.push(row);
      byDate.set(key, bucket);
    }

    const keys = [...byDate.keys()].sort((a, b) => {
      if (!a) return 1;
      if (!b) return -1;
      return a.localeCompare(b);
    });

    return keys.map((dateKey) => {
      const dateRows = byDate.get(dateKey) ?? [];
      if (!hasTeams) {
        return {
          dateKey,
          dateLabel: formatDueHeading(dateKey),
          teams: null,
          rows: dateRows,
        };
      }

      const byTeam = new Map<string, WorkRow[]>();
      for (const row of dateRows) {
        const tk = row.teamId ?? '';
        const bucket = byTeam.get(tk) ?? [];
        bucket.push(row);
        byTeam.set(tk, bucket);
      }
      const teamKeys = [...byTeam.keys()].sort((a, b) => {
        if (!a) return 1;
        if (!b) return -1;
        const na = teamNameById.get(a) ?? a;
        const nb = teamNameById.get(b) ?? b;
        return na.localeCompare(nb);
      });

      return {
        dateKey,
        dateLabel: formatDueHeading(dateKey),
        teams: teamKeys.map((teamKey) => ({
          teamKey,
          teamLabel: teamKey
            ? teamNameById.get(teamKey) ?? 'Unknown team'
            : 'Project-wide',
          rows: byTeam.get(teamKey) ?? [],
        })),
        rows: [],
      };
    });
  }, [items, hasTeams, teamNameById]);

  const backlogCount = rows.filter((r) => r.inBacklog).length;
  const assignedCount = rows.filter((r) => !r.inBacklog).length;

  function shiftAnchor(delta: number) {
    const d = parseYmd(anchorDate || todayYmd());
    if (rangeMode === 'day') setAnchorDate(toYmd(addDays(d, delta)));
    else if (rangeMode === 'week') setAnchorDate(toYmd(addDays(d, delta * 7)));
    else setAnchorDate(toYmd(new Date(d.getFullYear(), d.getMonth() + delta, 1)));
  }

  function onFiles(e: ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files;
    if (!picked?.length) return;
    setFileError('');
    const ok: File[] = [];
    const skipped: string[] = [];
    for (const file of Array.from(picked)) {
      if (file.size > MAX_FILE_BYTES) skipped.push(`${file.name} (max 2MB)`);
      else ok.push(file);
    }
    if (ok.length) setFiles((prev) => [...prev, ...ok]);
    if (skipped.length) setFileError(`Skipped: ${skipped.join(', ')}`);
    e.target.value = '';
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !activeProjectId) return;
    await createTimelineItem({
      projectId: activeProjectId,
      title,
      description,
      type,
      priority,
      dueDate,
      teamId: teamId || null,
      files,
    });
    setTitle('');
    setDescription('');
    setDueDate('');
    setTeamId('');
    setType('task');
    setPriority('medium');
    setFiles([]);
    setFileError('');
    setFilter('backlog');
  }

  async function onAssign(row: WorkRow, memberId: string) {
    const itemMembers = getProject(row.projectId)?.members ?? [];
    const member = itemMembers.find((m) => m.id === memberId);
    if (!member) return;

    if (row.source === 'backlog' && row.timelineItem) {
      await assignTimelineItem(row.timelineItem.id, {
        id: member.id,
        name: member.name,
      });
      return;
    }
    if (row.task) {
      await updateTask(row.task.id, {
        assigneeId: member.id,
        assigneeName: member.name,
      });
    }
  }

  if (adminProjects.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-ink-900 p-8">
        <div className="max-w-sm border border-ink-600 bg-ink-800 px-6 py-8 text-center">
          <p className="text-sm font-semibold text-ink-50">Project timeline</p>
          <p className="mt-2 text-xs leading-relaxed text-ink-300">
            You need to be a project Admin to manage the backlog and assign work. Create a
            project on the board (you become Admin) or ask an admin to promote you.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-ink-900 lg:flex-row">
      <section className="max-h-[42vh] w-full shrink-0 overflow-y-auto border-b border-ink-600 bg-ink-800 lg:max-h-none lg:w-[340px] lg:border-r lg:border-b-0">
        <div className="border-b border-ink-700 px-5 py-4">
          <p className="text-[10px] font-bold tracking-wide text-ink-300 uppercase">Backlog</p>
          <h2 className="mt-0.5 text-base font-semibold text-ink-50">Create backlog task</h2>
          <p className="mt-1 text-[11px] leading-relaxed text-ink-300">
            Add work now without an assignee. Assign to a teammate whenever you are ready.
          </p>
        </div>

        <form onSubmit={onCreate} className="space-y-3.5 px-5 py-4">
          <div>
            <label className={label}>Project</label>
            <div className="mt-1">
              <Select
                value={activeProjectId}
                onChange={setProjectId}
                options={adminProjects.map((p) => ({
                  value: p.id,
                  label: `${p.name} (${p.key})`,
                }))}
                aria-label="Project"
              />
            </div>
          </div>

          <div>
            <label className={label}>Title</label>
            <Input
              placeholder="What needs to be done?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="mt-1 h-9 text-xs"
            />
          </div>

          <div>
            <label className={label}>Description</label>
            <textarea
              placeholder="Notes, context, acceptance criteria…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mt-1 w-full border border-ink-600 bg-ink-800 px-2.5 py-2 text-xs outline-none focus:border-ink-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className={label}>Type</label>
              <div className="mt-1">
                <Select
                  value={type}
                  onChange={(v) => setType(v as TaskType)}
                  options={TASK_TYPES.map((t) => ({ value: t.id, label: t.label }))}
                />
              </div>
            </div>
            <div>
              <label className={label}>Priority</label>
              <div className="mt-1">
                <Select
                  value={priority}
                  onChange={(v) => setPriority(v as TaskPriority)}
                  options={TASK_PRIORITIES.map((p) => ({
                    value: p,
                    label: p.charAt(0).toUpperCase() + p.slice(1),
                  }))}
                />
              </div>
            </div>
          </div>

          <div>
            <label className={label}>Due date</label>
            <div className="mt-1">
              <DatePicker value={dueDate} onChange={setDueDate} clearable />
            </div>
          </div>

          {createTeams.length > 0 ? (
            <div>
              <label className={label}>Team</label>
              <div className="mt-1">
                <Select
                  value={teamId}
                  onChange={setTeamId}
                  options={[
                    { value: '', label: 'Project-wide' },
                    ...createTeams.map((t) => ({ value: t.id, label: t.name })),
                  ]}
                  aria-label="Team"
                />
              </div>
            </div>
          ) : null}

          <div>
            <div className="flex items-center justify-between">
              <label className={label}>Attachments</label>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="text-[11px] font-semibold text-brand-800 hover:underline"
              >
                + Add file
              </button>
              <input
                ref={fileRef}
                type="file"
                multiple
                className="hidden"
                onChange={onFiles}
              />
            </div>
            <p className="mt-1 text-[10px] text-ink-400">Images & files up to 2MB each</p>
            {files.length === 0 ? (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="mt-2 flex w-full flex-col items-center justify-center border border-dashed border-ink-500 bg-ink-900 px-3 py-5 text-center transition hover:border-brand-500 hover:bg-brand-500/5"
              >
                <span className="text-xs font-semibold text-ink-200">Drop or browse files</span>
                <span className="mt-0.5 text-[10px] text-ink-400">Optional · max 2MB</span>
              </button>
            ) : (
              <ul className="mt-2 space-y-1">
                {files.map((file, idx) => (
                  <li
                    key={`${file.name}-${idx}`}
                    className="flex items-center justify-between border border-ink-600 bg-ink-800 px-2.5 py-1.5 text-[11px]"
                  >
                    <span className="truncate font-semibold text-ink-100">
                      {file.name} · {formatFileSize(file.size)}
                    </span>
                    <button
                      type="button"
                      className="font-semibold text-ink-400 hover:text-[#ed4245]"
                      onClick={() => setFiles((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {fileError ? (
              <p className="mt-1.5 text-[11px] font-medium text-[#ed4245]">{fileError}</p>
            ) : null}
          </div>

          <Button type="submit" size="sm" className="w-full" disabled={!title.trim()}>
            Add to backlog
          </Button>
        </form>
      </section>

      <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-ink-800">
        <div className="space-y-2.5 border-b border-ink-600 px-4 py-2.5 md:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-ink-50">Project work</h2>
              <p className="text-[11px] text-ink-300">
                {backlogCount} backlog · {assignedCount} assigned · {items.length} in range
                {dashProjectId !== 'all' && project ? ` · ${project.name}` : ''}
                {hasTeams ? ' · grouped by date & team' : ' · grouped by date'}
              </p>
            </div>
            <div className="flex gap-0.5 border border-ink-600 bg-ink-900 p-0.5">
              {(
                [
                  { id: 'backlog', label: 'Backlog' },
                  { id: 'assigned', label: 'Assigned' },
                  { id: 'all', label: 'All' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  className={cn(
                    'px-3 py-1 text-[11px] font-semibold',
                    filter === f.id
                      ? 'bg-brand-500 text-white'
                      : 'text-ink-300 hover:bg-ink-700 hover:text-ink-50',
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-0.5 border border-ink-600 bg-ink-900 p-0.5">
              {(
                [
                  { id: 'day', label: 'Day' },
                  { id: 'week', label: 'Week' },
                  { id: 'month', label: 'Month' },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setRangeMode(m.id)}
                  className={cn(
                    'px-3 py-1 text-[11px] font-semibold',
                    rangeMode === m.id
                      ? 'bg-ink-600 text-ink-50'
                      : 'text-ink-300 hover:bg-ink-700 hover:text-ink-50',
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => shiftAnchor(-1)}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-ink-600 text-ink-300 hover:bg-ink-700 hover:text-ink-50"
                aria-label="Previous"
              >
                ‹
              </button>
              <div className="w-[148px]">
                <DatePicker
                  size="sm"
                  value={anchorDate}
                  onChange={setAnchorDate}
                  aria-label="Jump to date"
                />
              </div>
              <button
                type="button"
                onClick={() => shiftAnchor(1)}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-ink-600 text-ink-300 hover:bg-ink-700 hover:text-ink-50"
                aria-label="Next"
              >
                ›
              </button>
              <button
                type="button"
                onClick={() => setAnchorDate(todayYmd())}
                className="h-8 rounded-md border border-ink-600 px-2.5 text-[11px] font-semibold text-ink-200 hover:bg-ink-700 hover:text-ink-50"
              >
                Today
              </button>
            </div>

            <p className="text-[11px] font-medium text-ink-300">{rangeLabel}</p>

            <UserMultiFilter
              people={filterPeople}
              selectedIds={userFilterIds}
              onChange={setUserFilterIds}
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {items.length === 0 ? (
            <div className="flex h-full min-h-[240px] flex-col items-center justify-center px-6 py-16 text-center">
              <p className="text-sm font-semibold text-ink-100">No items in this view</p>
              <p className="mt-1 max-w-sm text-xs text-ink-300">
                {filter === 'backlog'
                  ? 'Create a backlog task on the left with a due date in this range.'
                  : filter === 'assigned'
                    ? 'No assigned tasks due in this range. Try Week or Month, or switch to All.'
                    : 'Nothing due in this range. Pick another day, week, or month.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4 px-3 py-3 md:px-4">
              {grouped.map((dateGroup) => (
                <section
                  key={dateGroup.dateKey || 'undated'}
                  className="overflow-hidden rounded-xl border border-ink-600 bg-ink-900/40"
                >
                  <header className="flex items-center justify-between gap-2 border-b border-ink-600 bg-ink-900 px-3 py-2.5 md:px-4">
                    <h3 className="text-xs font-bold tracking-wide text-ink-100 uppercase">
                      {dateGroup.dateLabel}
                    </h3>
                    <span className="text-[10px] font-semibold text-ink-400">
                      {(dateGroup.teams
                        ? dateGroup.teams.reduce((n, t) => n + t.rows.length, 0)
                        : dateGroup.rows.length)}{' '}
                      task
                      {(dateGroup.teams
                        ? dateGroup.teams.reduce((n, t) => n + t.rows.length, 0)
                        : dateGroup.rows.length) === 1
                        ? ''
                        : 's'}
                    </span>
                  </header>

                  {dateGroup.teams
                    ? dateGroup.teams.map((team) => (
                        <div key={`${dateGroup.dateKey}-${team.teamKey || 'global'}`}>
                          <div className="flex items-center gap-2 border-b border-ink-700/80 bg-ink-800/60 px-3 py-1.5 md:px-4">
                            <span className="rounded bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-bold text-brand-300">
                              {team.teamLabel}
                            </span>
                            <span className="text-[10px] text-ink-400">
                              {team.rows.length} item{team.rows.length === 1 ? '' : 's'}
                            </span>
                          </div>
                          <TimelineTable
                            rows={team.rows}
                            getProject={getProject}
                            isProjectAdmin={isProjectAdmin}
                            onAssign={onAssign}
                            onEdit={setEditingItem}
                            onDelete={setItemToDelete}
                          />
                        </div>
                      ))
                    : (
                        <TimelineTable
                          rows={dateGroup.rows}
                          getProject={getProject}
                          isProjectAdmin={isProjectAdmin}
                          onAssign={onAssign}
                          onEdit={setEditingItem}
                          onDelete={setItemToDelete}
                        />
                      )}
                </section>
              ))}
            </div>
          )}
        </div>

        {members.length > 0 && activeProjectId ? (
          <p className="border-t border-ink-600 px-4 py-2 text-[11px] text-ink-400 md:px-5">
            {project?.name} · {members.length} members ready to assign · Backlog + board tasks
          </p>
        ) : null}
      </section>

      {editingItem ? (
        <EditTimelineModal item={editingItem} onClose={() => setEditingItem(null)} />
      ) : null}

      <ConfirmModal
        open={Boolean(itemToDelete)}
        title="Remove backlog item?"
        message={
          itemToDelete ? `Remove “${itemToDelete.title}”? This can’t be undone.` : ''
        }
        confirmLabel="Remove"
        danger
        busy={deletingItem}
        onCancel={() => setItemToDelete(null)}
        onConfirm={async () => {
          if (!itemToDelete) return;
          setDeletingItem(true);
          try {
            await deleteTimelineItem(itemToDelete.id);
            setItemToDelete(null);
          } finally {
            setDeletingItem(false);
          }
        }}
      />
    </div>
  );
}
