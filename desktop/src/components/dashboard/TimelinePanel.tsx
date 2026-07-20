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
  type TaskAttachment,
  type TaskPriority,
  type TaskType,
  type TimelineItem,
} from '@/lib/workspace/types';
import { useWorkspace } from '@/lib/workspace/WorkspaceContext';

const MAX_FILE_BYTES = 2 * 1024 * 1024;

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

type WorkFilter = 'backlog' | 'assigned' | 'all';

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

export function TimelinePanel() {
  const {
    projects,
    tasks,
    timeline,
    getProject,
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
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState('');
  const [filter, setFilter] = useState<WorkFilter>('all');
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

  const scopeProjectIds = useMemo(() => {
    if (dashProjectId === 'all') return new Set(adminProjects.map((p) => p.id));
    return new Set([dashProjectId].filter(Boolean));
  }, [adminProjects, dashProjectId]);

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

  const items = useMemo(() => {
    if (filter === 'backlog') return rows.filter((r) => r.inBacklog);
    if (filter === 'assigned') return rows.filter((r) => !r.inBacklog);
    return rows;
  }, [rows, filter]);

  const backlogCount = rows.filter((r) => r.inBacklog).length;
  const assignedCount = rows.filter((r) => !r.inBacklog).length;

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
      files,
    });
    setTitle('');
    setDescription('');
    setDueDate('');
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
              <DatePicker value={dueDate} onChange={setDueDate} />
            </div>
          </div>

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
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-600 px-4 py-2.5 md:px-5">
          <div>
            <h2 className="text-sm font-semibold text-ink-50">Project work</h2>
            <p className="text-[11px] text-ink-300">
              {backlogCount} backlog · {assignedCount} assigned · {items.length} shown
              {dashProjectId !== 'all' && project ? ` · ${project.name}` : ''}
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

        <div className="min-h-0 flex-1 overflow-auto">
          {items.length === 0 ? (
            <div className="flex h-full min-h-[240px] flex-col items-center justify-center px-6 py-16 text-center">
              <p className="text-sm font-semibold text-ink-100">No items in this view</p>
              <p className="mt-1 max-w-sm text-xs text-ink-300">
                {filter === 'backlog'
                  ? 'Create a backlog task on the left, then assign it to a teammate when ready.'
                  : filter === 'assigned'
                    ? 'No assigned tasks yet. Open Backlog or All, then pick an assignee.'
                    : 'Create a backlog task or add work from the board for this project.'}
              </p>
            </div>
          ) : (
            <table className="w-full min-w-[640px] text-left md:min-w-[920px]">
              <thead className="sticky top-0 z-[1] border-b border-ink-600 bg-ink-900 text-[10px] font-bold tracking-wide text-ink-300 uppercase">
                <tr>
                  <th className="px-4 py-2.5 font-bold md:px-5">Task</th>
                  <th className="px-3 py-2.5 font-bold">Project</th>
                  <th className="px-3 py-2.5 font-bold">Status</th>
                  <th className="px-3 py-2.5 font-bold">Priority</th>
                  <th className="px-3 py-2.5 font-bold">Due</th>
                  <th className="px-3 py-2.5 font-bold">Assignee</th>
                  <th className="px-3 py-2.5 font-bold">Files</th>
                  <th className="px-4 py-2.5 text-right font-bold md:px-5">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => {
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
                      className="border-b border-ink-700 transition hover:bg-ink-800/70"
                    >
                      <td className="px-4 py-3 md:px-5">
                        <div className="flex items-start gap-2.5">
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
                      <td className="px-3 py-3 text-xs font-medium text-ink-200">
                        {proj?.name ?? '—'}
                      </td>
                      <td className="px-3 py-3">
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
                      <td className="px-3 py-3 text-xs capitalize text-ink-200">{row.priority}</td>
                      <td className="px-3 py-3 text-xs text-ink-200">
                        {row.dueDate
                          ? new Date(row.dueDate).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })
                          : '—'}
                      </td>
                      <td className="px-3 py-3">
                        {canManageAssign && memberOptions.length > 0 ? (
                          <div className="w-[160px]">
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
                                row.inBacklog
                                  ? `Assign ${row.title}`
                                  : `Reassign ${row.title}`
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
                      <td className="px-3 py-3">
                        {row.attachments.length > 0 ? (
                          <AttachmentChips items={row.attachments} compact />
                        ) : (
                          <span className="text-xs text-ink-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 md:px-5">
                        <div className="flex items-center justify-end gap-2">
                          {row.source === 'backlog' && row.timelineItem && canManageAssign ? (
                            <>
                              <button
                                type="button"
                                onClick={() => setEditingItem(row.timelineItem!)}
                                className="text-[11px] font-semibold text-ink-200 hover:text-ink-50"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => setItemToDelete(row.timelineItem!)}
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
