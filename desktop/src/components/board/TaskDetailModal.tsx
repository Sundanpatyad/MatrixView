import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent, type KeyboardEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { DatePicker } from '@/components/ui/DatePicker';
import { FieldError } from '@/components/ui/FieldLabel';
import { Input } from '@/components/ui/Input';
import {
  IconCollapse,
  IconExpand,
  IconPaperclip,
  IconTrash,
  IconX,
} from '@/components/ui/Icons';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { Tooltip } from '@/components/ui/Tooltip';
import { useAuth } from '@/lib/auth/AuthContext';
import {
  TASK_PRIORITIES,
  TASK_TYPES,
  attachmentHref,
  formatFileSize,
  type BoardColumn,
  type BoardTask,
  type ProjectMember,
  type TaskAttachment,
  type TaskPriority,
  type TaskStatus,
  type TaskType,
} from '@/lib/workspace/types';
import { useWorkspace } from '@/lib/workspace/WorkspaceContext';
import { cn } from '@/lib/cn';
import { useToast } from '@/lib/toast/ToastContext';

type Props = {
  task: BoardTask;
  projectName: string;
  columns: BoardColumn[];
  onClose: () => void;
};

const MAX_FILE_BYTES = 2 * 1024 * 1024;
type ActivityTab = 'all' | 'comments' | 'history' | 'worklog';

type HistoryEvent = {
  id: string;
  kind: 'comment' | 'history' | 'worklog';
  at: string;
  actorName: string;
  actorAvatarUrl?: string | null;
  actorId?: string;
  action: string;
  body?: string;
  from?: string;
  to?: string;
  fromTone?: string;
  toTone?: string;
  attachments?: TaskAttachment[];
};

const QUICK_REPLIES = [
  { id: 'status', label: 'Status update…', text: 'Status update: ' },
  { id: 'thanks', label: 'Thanks…', text: 'Thanks!' },
  { id: 'agree', label: 'Agree…', text: 'Agreed — ' },
];

function filterFiles(files: FileList | File[]): { ok: File[]; skipped: string[] } {
  const ok: File[] = [];
  const skipped: string[] = [];
  for (const file of Array.from(files)) {
    if (file.size > MAX_FILE_BYTES) skipped.push(`${file.name} (max 2MB)`);
    else ok.push(file);
  }
  return { ok, skipped };
}

function formatDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString([], {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

function formatRelative(iso: string) {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return iso;
  const delta = Date.now() - then;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (delta < minute) return 'just now';
  if (delta < hour) {
    const n = Math.floor(delta / minute);
    return `${n} minute${n === 1 ? '' : 's'} ago`;
  }
  if (delta < day) {
    const n = Math.floor(delta / hour);
    return `${n} hour${n === 1 ? '' : 's'} ago`;
  }
  if (delta < 7 * day) {
    const n = Math.floor(delta / day);
    return n === 1 ? 'yesterday' : `${n} days ago`;
  }
  return formatDateTime(iso);
}

function statusTone(col?: BoardColumn | null) {
  const id = col?.id ?? '';
  const label = col?.label ?? '';
  if (id === 'done' || /done|complete/i.test(label)) return 'bg-[#1f845a] text-white border-transparent';
  if (id === 'in_progress' || /progress/i.test(label)) return 'bg-[#0c66e4] text-white border-transparent';
  if (id === 'review' || /review/i.test(label)) return 'bg-[#5c53d8] text-white border-transparent';
  if (id === 'todo' || /to\s?do|open|reopen/i.test(label)) return 'bg-ink-600 text-ink-50 border-transparent';
  return 'bg-ink-700 text-ink-50 border-transparent';
}

function pillTone(label: string, columns: BoardColumn[]) {
  const col = columns.find((c) => c.id === label || c.label === label);
  return statusTone(col);
}

function AttachmentList({
  items,
  onRemove,
}: {
  items: TaskAttachment[];
  onRemove?: (id: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <ul className="mt-2 space-y-1.5">
      {items.map((att) => {
        const href = attachmentHref(att);
        return (
          <li
            key={att.id}
            className="flex items-center gap-2 rounded-lg border border-ink-600/70 bg-ink-900/50 px-2.5 py-2"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-ink-700 text-[10px] font-bold text-ink-200">
              {att.mimeType.startsWith('image/') ? 'IMG' : 'FILE'}
            </span>
            <div className="min-w-0 flex-1">
              {href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="block truncate text-xs font-semibold text-brand-300 hover:underline"
                >
                  {att.name}
                </a>
              ) : (
                <p className="truncate text-xs font-semibold text-ink-100">{att.name}</p>
              )}
              <p className="text-[10px] text-ink-400">
                {formatFileSize(att.size)} · {att.uploadedBy}
              </p>
            </div>
            {att.mimeType.startsWith('image/') && href ? (
              <img src={href} alt="" className="h-8 w-8 shrink-0 rounded object-cover ring-1 ring-ink-600" />
            ) : null}
            {onRemove ? (
              <button
                type="button"
                onClick={() => onRemove(att.id)}
                className="text-[11px] font-semibold text-ink-400 hover:text-[#ed4245]"
              >
                Remove
              </button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[92px_minmax(0,1fr)] items-center gap-2 py-1.5">
      <span className="text-[13px] text-ink-400">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function ChangePills({
  from,
  to,
  fromTone,
  toTone,
}: {
  from?: string;
  to?: string;
  fromTone?: string;
  toTone?: string;
}) {
  if (!from && !to) return null;
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[12px]">
      <span className={cn('inline-flex rounded px-1.5 py-0.5 font-medium', fromTone ?? 'bg-ink-700 text-ink-200')}>
        {from || 'None'}
      </span>
      <span className="text-ink-500">→</span>
      <span className={cn('inline-flex rounded px-1.5 py-0.5 font-medium', toTone ?? 'bg-ink-700 text-ink-200')}>
        {to || 'None'}
      </span>
    </div>
  );
}

export function TaskDetailModal({ task, projectName, columns, onClose }: Props) {
  const { user } = useAuth();
  const {
    getProject,
    getProjectTeams,
    getProjectSprints,
    updateTask,
    addComment,
    addTaskAttachments,
    removeTaskAttachment,
    getTask,
    deleteTask,
  } = useWorkspace();
  const liveTask = getTask(task.id) ?? task;
  const [comment, setComment] = useState('');
  const [commentFocused, setCommentFocused] = useState(false);
  const [labelDraft, setLabelDraft] = useState('');
  const [addingLabel, setAddingLabel] = useState(false);
  const [commentFiles, setCommentFiles] = useState<File[]>([]);
  const [titleDraft, setTitleDraft] = useState(liveTask.title);
  const [descDraft, setDescDraft] = useState(liveTask.description);
  const [titleError, setTitleError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activityTab, setActivityTab] = useState<ActivityTab>('comments');
  const [expanded, setExpanded] = useState(false);
  const [dropActive, setDropActive] = useState(false);
  const [localHistory, setLocalHistory] = useState<HistoryEvent[]>([]);
  const [logHours, setLogHours] = useState('');
  const toast = useToast();
  const taskFileRef = useRef<HTMLInputElement>(null);
  const commentFileRef = useRef<HTMLInputElement>(null);
  const commentRef = useRef<HTMLTextAreaElement>(null);

  const project = getProject(liveTask.projectId);
  const teams = getProjectTeams(liveTask.projectId);
  const sprints = getProjectSprints(liveTask.projectId);
  const members = (project?.members ?? []).filter((m) => m.status !== 'pending');
  const typeMeta = TASK_TYPES.find((t) => t.id === liveTask.type);
  const currentCol = columns.find((c) => c.id === liveTask.status);

  useEffect(() => {
    setTitleDraft(liveTask.title);
    setDescDraft(liveTask.description);
    setTitleError('');
  }, [liveTask.id, liveTask.title, liveTask.description]);

  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || el?.isContentEditable) return;
      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        setActivityTab('comments');
        window.setTimeout(() => commentRef.current?.focus(), 0);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function recordHistory(event: Omit<HistoryEvent, 'id' | 'at' | 'actorName'> & { actorName?: string }) {
    setLocalHistory((prev) => [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        at: new Date().toISOString(),
        actorName: event.actorName ?? user?.name ?? 'You',
        actorId: user?.id,
        ...event,
      },
      ...prev,
    ]);
  }

  function patch(partial: Partial<BoardTask>) {
    if (partial.status && partial.status !== liveTask.status) {
      const from = columns.find((c) => c.id === liveTask.status);
      const to = columns.find((c) => c.id === partial.status);
      recordHistory({
        kind: 'history',
        action: 'changed the Status',
        from: from?.label ?? liveTask.status,
        to: to?.label ?? partial.status,
        fromTone: statusTone(from),
        toTone: statusTone(to),
      });
    }
    if (partial.assigneeName !== undefined && partial.assigneeName !== liveTask.assigneeName) {
      recordHistory({
        kind: 'history',
        action: 'changed the Assignee',
        from: liveTask.assigneeName || 'Unassigned',
        to: partial.assigneeName || 'Unassigned',
      });
    }
    if (partial.description !== undefined && partial.description !== liveTask.description) {
      recordHistory({
        kind: 'history',
        action: 'updated the Description',
        from: liveTask.description.trim() ? liveTask.description : 'None',
        to: partial.description.trim() ? partial.description : 'None',
      });
    }
    if (partial.priority && partial.priority !== liveTask.priority) {
      recordHistory({
        kind: 'history',
        action: 'changed the Priority',
        from: liveTask.priority,
        to: partial.priority,
      });
    }
    if (partial.loggedHours !== undefined && partial.loggedHours !== liveTask.loggedHours) {
      const added = Number(partial.loggedHours) - liveTask.loggedHours;
      recordHistory({
        kind: 'worklog',
        action: added > 0 ? `logged ${added}h` : 'updated time spent',
        to: `${partial.loggedHours}h total`,
      });
    }
    void updateTask(liveTask.id, partial);
  }

  function commitTitle() {
    const next = titleDraft.trim();
    if (!next) {
      setTitleError('Title is required.');
      setTitleDraft(liveTask.title);
      return;
    }
    setTitleError('');
    if (next !== liveTask.title) patch({ title: next });
  }

  function commitDescription() {
    if (descDraft !== liveTask.description) patch({ description: descDraft });
  }

  function assignMember(member: ProjectMember | null) {
    if (!member) {
      patch({ assigneeId: '', assigneeName: 'Unassigned' });
      return;
    }
    patch({ assigneeId: member.id, assigneeName: member.name });
  }

  async function uploadFiles(files: File[]) {
    const { ok, skipped } = filterFiles(files);
    try {
      if (ok.length) await addTaskAttachments(liveTask.id, ok);
      if (skipped.length) toast.error(`Skipped: ${skipped.join(', ')}`);
    } catch (err) {
      toast.fromError(err, 'Upload failed');
    }
  }

  async function onTaskFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length) return;
    await uploadFiles(Array.from(files));
    e.target.value = '';
  }

  function onDropFiles(e: DragEvent) {
    e.preventDefault();
    setDropActive(false);
    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length) void uploadFiles(files);
  }

  function onCommentFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length) return;
    const { ok, skipped } = filterFiles(files);
    if (ok.length) setCommentFiles((prev) => [...prev, ...ok]);
    if (skipped.length) toast.error(`Skipped: ${skipped.join(', ')}`);
    e.target.value = '';
  }

  async function onAddComment(e?: FormEvent) {
    e?.preventDefault();
    if (!comment.trim() && commentFiles.length === 0) return;
    await addComment(liveTask.id, comment, commentFiles);
    setComment('');
    setCommentFiles([]);
    setCommentFocused(false);
  }

  function onCommentKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      void onAddComment();
    }
  }

  function onAddLabel(e: FormEvent) {
    e.preventDefault();
    const value = labelDraft.trim();
    if (!value) return;
    if (liveTask.labels.includes(value)) {
      setLabelDraft('');
      setAddingLabel(false);
      return;
    }
    patch({ labels: [...liveTask.labels, value] });
    setLabelDraft('');
    setAddingLabel(false);
  }

  function logTime(e: FormEvent) {
    e.preventDefault();
    const hours = Number(logHours);
    if (!Number.isFinite(hours) || hours <= 0) return;
    patch({ loggedHours: liveTask.loggedHours + hours });
    setLogHours('');
  }

  const selectedMember =
    members.find(
      (m) =>
        m.id === liveTask.assigneeId ||
        m.name.toLowerCase() === liveTask.assigneeName.toLowerCase(),
    ) ?? null;

  const reporterMember =
    members.find((m) => m.name.toLowerCase() === (liveTask.reporterName || liveTask.createdByName).toLowerCase()) ??
    null;

  const activity = useMemo(() => {
    const items: HistoryEvent[] = [
      {
        id: `created-${liveTask.id}`,
        kind: 'history',
        at: liveTask.createdAt,
        actorName: liveTask.createdByName,
        action: 'created this task',
      },
      ...localHistory,
      ...(liveTask.comments ?? []).map((c) => ({
        id: c.id,
        kind: 'comment' as const,
        at: c.createdAt,
        actorName: c.authorName,
        actorAvatarUrl: c.authorAvatarUrl,
        actorId: c.authorId,
        action: 'commented',
        body: c.body,
        attachments: c.attachments,
      })),
    ];
    if (liveTask.loggedHours > 0 && !localHistory.some((h) => h.kind === 'worklog')) {
      items.push({
        id: `logged-${liveTask.id}`,
        kind: 'worklog',
        at: liveTask.updatedAt,
        actorName: liveTask.assigneeName || liveTask.createdByName,
        action: `logged ${liveTask.loggedHours}h`,
        to: `${liveTask.remainingHours}h remaining`,
      });
    }
    return items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [liveTask, localHistory]);

  const visibleActivity = activity.filter((item) => {
    if (activityTab === 'all') return true;
    if (activityTab === 'comments') return item.kind === 'comment';
    if (activityTab === 'history') return item.kind === 'history';
    return item.kind === 'worklog';
  });

  const iconBtn =
    'flex h-8 w-8 items-center justify-center rounded-lg text-ink-400 transition hover:bg-ink-700 hover:text-ink-50';

  return (
    <Modal
      size="3xl"
      onClose={onClose}
      labelledBy="task-title"
      className={cn(
        'max-h-[96vh] bg-[#1d2125]',
        expanded && 'h-[96vh] max-w-[min(96vw,86rem)]',
      )}
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-ink-700/70 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-1.5 text-[13px]">
          <span className="truncate font-medium text-ink-300">{project?.key ?? projectName}</span>
          <span className="text-ink-600">/</span>
          <span
            className={cn(
              'inline-flex h-5 items-center rounded px-1.5 text-[10px] font-bold uppercase text-white',
              typeMeta?.color ?? 'bg-ink-700',
            )}
          >
            {typeMeta?.label ?? liveTask.type}
          </span>
          <span className="font-semibold tabular-nums text-ink-200">{liveTask.key}</span>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <Tooltip label="Delete task" side="bottom">
            <button type="button" aria-label="Delete task" className={iconBtn} onClick={() => setConfirmDelete(true)}>
              <IconTrash className="h-4 w-4" />
            </button>
          </Tooltip>
          <Tooltip label={expanded ? 'Exit full screen' : 'Full screen'} side="bottom">
            <button
              type="button"
              aria-label={expanded ? 'Exit full screen' : 'Full screen'}
              className={iconBtn}
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? <IconCollapse className="h-4 w-4" /> : <IconExpand className="h-4 w-4" />}
            </button>
          </Tooltip>
          <button type="button" aria-label="Close" className={iconBtn} onClick={onClose}>
            <IconX className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 overflow-hidden md:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-h-0 space-y-6 overflow-y-auto px-6 py-5">
          <div>
            <textarea
              id="task-title"
              value={titleDraft}
              rows={Math.min(3, Math.max(1, Math.ceil(titleDraft.length / 72)))}
              onChange={(e) => {
                setTitleDraft(e.target.value);
                if (e.target.value.trim()) setTitleError('');
              }}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  (e.target as HTMLTextAreaElement).blur();
                }
              }}
              className={cn(
                'w-full resize-none bg-transparent text-[22px] font-semibold leading-snug text-ink-50 outline-none',
                'rounded-lg px-1.5 py-1 -mx-1.5',
                'hover:bg-ink-900/40 focus:bg-ink-900/50 focus:ring-1 focus:ring-brand-500/35',
                titleError && 'ring-1 ring-[#ed4245]/70',
              )}
            />
            <FieldError>{titleError}</FieldError>
          </div>

          <section>
            <h3 className="mb-2 text-sm font-semibold text-ink-50">Description</h3>
            <textarea
              value={descDraft}
              onChange={(e) => setDescDraft(e.target.value)}
              onBlur={commitDescription}
              placeholder="Add a description…"
              rows={descDraft ? 6 : 3}
              className="min-h-[4.5rem] w-full resize-y rounded-lg border border-transparent bg-ink-900/40 px-3 py-2.5 text-sm leading-relaxed text-ink-100 outline-none placeholder:text-ink-500 hover:border-ink-600 focus:border-brand-500/50 focus:bg-ink-900/60"
            />
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold text-ink-50">Attachments</h3>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDropActive(true);
              }}
              onDragLeave={() => setDropActive(false)}
              onDrop={onDropFiles}
              className={cn(
                'flex flex-col items-center justify-center rounded-xl border border-dashed px-4 py-7 text-center',
                dropActive ? 'border-brand-400 bg-brand-500/10' : 'border-ink-600 bg-ink-900/25',
              )}
            >
              <Button type="button" size="sm" variant="secondary" onClick={() => taskFileRef.current?.click()}>
                <IconPaperclip className="h-3.5 w-3.5" />
                Add attachment
              </Button>
              <p className="mt-2 text-[11px] text-ink-500">Drop files here · max 2MB each</p>
              <input ref={taskFileRef} type="file" multiple className="hidden" onChange={onTaskFiles} />
            </div>
            <AttachmentList
              items={liveTask.attachments ?? []}
              onRemove={(id) => void removeTaskAttachment(liveTask.id, id)}
            />
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-ink-50">Activity</h3>
            </div>
            <div className="mb-4 flex flex-wrap items-center gap-1.5">
              {(
                [
                  ['all', 'All'],
                  ['comments', 'Comments'],
                  ['history', 'History'],
                  ['worklog', 'Work log'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActivityTab(id)}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-[13px] font-medium transition',
                    activityTab === id
                      ? 'bg-ink-800 text-ink-50 ring-1 ring-[#579dff]'
                      : 'text-ink-300 hover:bg-ink-800 hover:text-ink-50',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {activityTab === 'all' || activityTab === 'comments' ? (
              <form onSubmit={(e) => void onAddComment(e)} className="mb-5 flex gap-2.5">
                <UserAvatar
                  name={user?.name ?? 'You'}
                  src={user?.avatarUrl}
                  seed={user?.email || user?.name}
                  size="md"
                  className="!h-8 !w-8 !text-[10px]"
                  userId={user?.id}
                />
                <div className="min-w-0 flex-1">
                  <div
                    className={cn(
                      'rounded-lg border bg-ink-900/50 transition',
                      commentFocused ? 'border-brand-500/50' : 'border-ink-600',
                    )}
                  >
                    <textarea
                      ref={commentRef}
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      onFocus={() => setCommentFocused(true)}
                      onBlur={() => {
                        if (!comment.trim() && commentFiles.length === 0) setCommentFocused(false);
                      }}
                      onKeyDown={onCommentKey}
                      placeholder="Add a comment…"
                      rows={commentFocused || comment ? 3 : 1}
                      className="w-full resize-none bg-transparent px-3 py-2.5 text-sm text-ink-50 outline-none placeholder:text-ink-500"
                    />
                    {commentFocused || comment ? (
                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink-700/80 px-2 py-2">
                        <div className="flex flex-wrap gap-1.5">
                          {QUICK_REPLIES.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => {
                                setComment(item.text);
                                commentRef.current?.focus();
                              }}
                              className="rounded-full border border-ink-600 px-2.5 py-0.5 text-[11px] font-medium text-ink-200 hover:border-ink-400 hover:text-ink-50"
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Tooltip label="Attach files" side="top">
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => commentFileRef.current?.click()}
                              className={iconBtn}
                            >
                              <IconPaperclip className="h-3.5 w-3.5" />
                            </button>
                          </Tooltip>
                          <Button
                            type="submit"
                            size="xs"
                            disabled={!comment.trim() && commentFiles.length === 0}
                          >
                            Comment
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                  {commentFiles.length > 0 ? (
                    <ul className="mt-1.5 space-y-1">
                      {commentFiles.map((file, idx) => (
                        <li
                          key={`${file.name}-${idx}`}
                          className="flex items-center justify-between rounded-md border border-ink-600 px-2.5 py-1.5 text-xs"
                        >
                          <span className="truncate font-semibold text-ink-100">
                            {file.name} · {formatFileSize(file.size)}
                          </span>
                          <button
                            type="button"
                            className="font-semibold text-ink-400 hover:text-[#ed4245]"
                            onClick={() => setCommentFiles((prev) => prev.filter((_, i) => i !== idx))}
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <p className="mt-1.5 text-[11px] text-ink-500">
                    Pro tip: press{' '}
                    <kbd className="rounded border border-ink-600 bg-ink-800 px-1 py-px font-medium text-ink-300">M</kbd>{' '}
                    to comment
                  </p>
                  <input ref={commentFileRef} type="file" multiple className="hidden" onChange={onCommentFiles} />
                </div>
              </form>
            ) : activityTab === 'worklog' ? (
              <form onSubmit={logTime} className="mb-5 flex flex-wrap items-end gap-2 rounded-xl border border-ink-600/70 bg-ink-900/30 p-3">
                <div className="min-w-[120px] flex-1">
                  <p className="mb-1 text-[11px] font-medium text-ink-400">Log hours</p>
                  <Input
                    type="number"
                    min={0.25}
                    step={0.25}
                    size="sm"
                    value={logHours}
                    onChange={(e) => setLogHours(e.target.value)}
                    placeholder="e.g. 1.5"
                  />
                </div>
                <Button type="submit" size="sm" disabled={!logHours || Number(logHours) <= 0}>
                  Log time
                </Button>
                <p className="w-full text-[11px] text-ink-500">
                  {liveTask.loggedHours}h logged · {liveTask.estimateHours}h estimated · {liveTask.remainingHours}h remaining
                </p>
              </form>
            ) : null}

            <div className="space-y-4">
              {visibleActivity.length === 0 ? (
                <p className="py-6 text-center text-sm text-ink-500">
                  {activityTab === 'comments'
                    ? 'No comments yet.'
                    : activityTab === 'worklog'
                      ? 'No work logged yet.'
                      : 'No activity yet.'}
                </p>
              ) : (
                visibleActivity.map((item) => (
                  <article key={item.id}>
                    <div className="flex gap-2.5">
                      <UserAvatar
                        name={item.actorName}
                        src={item.actorAvatarUrl}
                        seed={item.actorName}
                        size="md"
                        className="!h-8 !w-8 !text-[10px]"
                        userId={item.actorId}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] leading-snug">
                          <span className="font-semibold text-ink-50">{item.actorName}</span>{' '}
                          <span className="text-ink-400">{item.action}</span>
                        </p>
                        <p className="mt-0.5 text-[12px] text-ink-500">{formatRelative(item.at)}</p>
                        {item.kind === 'comment' && item.body ? (
                          <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed text-ink-100">
                            {item.body}
                          </p>
                        ) : null}
                        {item.kind === 'comment' ? <AttachmentList items={item.attachments ?? []} /> : null}
                        {item.kind === 'history' ? (
                          item.from || item.to ? (
                            item.action.includes('Description') ? (
                              <div className="mt-1.5 pl-0 text-[12px] text-ink-300">
                                <span className="text-ink-500">{item.from}</span>
                                <span className="mx-1.5 text-ink-600">→</span>
                                <span className="whitespace-pre-wrap text-ink-200">{item.to}</span>
                              </div>
                            ) : (
                              <ChangePills
                                from={item.from}
                                to={item.to}
                                fromTone={item.fromTone ?? (item.from ? pillTone(item.from, columns) : undefined)}
                                toTone={item.toTone ?? (item.to ? pillTone(item.to, columns) : undefined)}
                              />
                            )
                          ) : null
                        ) : null}
                        {item.kind === 'worklog' && item.to ? (
                          <p className="mt-1 text-[12px] text-ink-400">{item.to}</p>
                        ) : null}
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>

        <aside className="min-h-0 space-y-4 overflow-y-auto border-t border-ink-700/70 bg-[#1b1f23] px-4 py-4 md:border-t-0 md:border-l">
          <Select
            size="md"
            value={liveTask.status}
            onChange={(v) => patch({ status: v as TaskStatus })}
            options={columns.map((c) => ({ value: c.id, label: c.label }))}
            aria-label="Status"
            className={cn('font-semibold', statusTone(currentCol))}
          />

          <div>
            <p className="mb-1 text-[13px] font-semibold text-ink-200">Details</p>
            <DetailRow label="Assignee">
              <Select
                size="sm"
                value={selectedMember?.id ?? ''}
                onChange={(id) => assignMember(members.find((m) => m.id === id) ?? null)}
                options={[
                  { value: '', label: 'Unassigned' },
                  ...members.map((m) => ({
                    value: m.id,
                    label:
                      user && m.email.toLowerCase() === user.email.toLowerCase() ? `${m.name} (you)` : m.name,
                  })),
                ]}
                aria-label="Assignee"
              />
              {user ? (
                <button
                  type="button"
                  className="mt-1 text-[11px] font-semibold text-brand-300 hover:underline"
                  onClick={() => {
                    const me =
                      members.find(
                        (m) =>
                          m.email.toLowerCase() === user.email.toLowerCase() ||
                          m.name.toLowerCase() === user.name.toLowerCase(),
                      ) ?? null;
                    if (me) assignMember(me);
                    else patch({ assigneeId: user.id, assigneeName: user.name });
                  }}
                >
                  Assign to me
                </button>
              ) : null}
            </DetailRow>

            <DetailRow label="Type">
              <Select
                size="sm"
                value={liveTask.type}
                onChange={(v) => patch({ type: v as TaskType })}
                options={TASK_TYPES.map((t) => ({ value: t.id, label: t.label }))}
                aria-label="Issue type"
              />
            </DetailRow>

            <DetailRow label="Priority">
              <Select
                size="sm"
                value={liveTask.priority}
                onChange={(v) => patch({ priority: v as TaskPriority })}
                options={TASK_PRIORITIES.map((p) => ({
                  value: p,
                  label: p.charAt(0).toUpperCase() + p.slice(1),
                }))}
                aria-label="Priority"
              />
            </DetailRow>

            <DetailRow label="Labels">
              <div className="flex flex-wrap items-center gap-1">
                {liveTask.labels.map((label) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => patch({ labels: liveTask.labels.filter((l) => l !== label) })}
                    className="rounded bg-ink-700 px-1.5 py-0.5 text-[11px] font-medium text-ink-200 hover:bg-ink-600"
                  >
                    {label} ×
                  </button>
                ))}
                {addingLabel ? (
                  <form onSubmit={onAddLabel} className="min-w-[120px] flex-1">
                    <Input
                      autoFocus
                      size="sm"
                      value={labelDraft}
                      onChange={(e) => setLabelDraft(e.target.value)}
                      onBlur={() => {
                        if (!labelDraft.trim()) setAddingLabel(false);
                      }}
                      placeholder="Label"
                    />
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAddingLabel(true)}
                    className="text-[12px] font-medium text-ink-500 hover:text-ink-200"
                  >
                    + Add
                  </button>
                )}
              </div>
            </DetailRow>

            {sprints.length > 0 ? (
              <DetailRow label="Sprint">
                <Select
                  size="sm"
                  value={liveTask.sprintId ?? ''}
                  onChange={(v) => patch({ sprintId: v || null })}
                  options={[
                    { value: '', label: 'Backlog' },
                    ...sprints.map((s) => ({ value: s.id, label: s.name })),
                  ]}
                  aria-label="Sprint"
                />
              </DetailRow>
            ) : null}

            {teams.length > 0 ? (
              <DetailRow label="Group">
                <Select
                  size="sm"
                  value={liveTask.teamId ?? ''}
                  onChange={(v) => patch({ teamId: v || null })}
                  options={[
                    { value: '', label: 'No group' },
                    ...teams.map((t) => ({ value: t.id, label: t.name })),
                  ]}
                  aria-label="Group"
                />
              </DetailRow>
            ) : null}

            <DetailRow label="Reporter">
              {reporterMember ? (
                <div className="flex items-center gap-2">
                  <UserAvatar
                    name={reporterMember.name}
                    src={reporterMember.avatarUrl}
                    seed={reporterMember.email || reporterMember.name}
                    size="xs"
                    userId={reporterMember.userId || reporterMember.id}
                  />
                  <span className="truncate text-[13px] text-ink-100">{reporterMember.name}</span>
                </div>
              ) : (
                <span className="text-[13px] text-ink-200">{liveTask.reporterName || liveTask.createdByName}</span>
              )}
            </DetailRow>

            <DetailRow label="Due date">
              <DatePicker
                size="sm"
                clearable
                value={liveTask.dueDate}
                onChange={(v) => patch({ dueDate: v })}
              />
            </DetailRow>

            <DetailRow label="Start">
              <DatePicker
                size="sm"
                clearable
                value={liveTask.startDate}
                onChange={(v) => {
                  if (liveTask.endDate && v && liveTask.endDate < v) {
                    patch({ startDate: v, endDate: v });
                    return;
                  }
                  patch({ startDate: v });
                }}
              />
            </DetailRow>

            <DetailRow label="End">
              <DatePicker
                size="sm"
                clearable
                value={liveTask.endDate}
                onChange={(v) => {
                  if (liveTask.startDate && v && v < liveTask.startDate) return;
                  patch({ endDate: v });
                }}
              />
            </DetailRow>
          </div>

          <div>
            <p className="mb-1 text-[13px] font-semibold text-ink-200">Time tracking</p>
            <div className="grid grid-cols-3 gap-1.5">
              <label className="rounded-lg bg-ink-900/50 px-2 py-1.5">
                <span className="text-[10px] font-medium text-ink-500">Estimate</span>
                <Input
                  type="number"
                  min={0}
                  step={0.5}
                  size="sm"
                  className="mt-1 h-7 border-0 bg-transparent px-0"
                  value={liveTask.estimateHours}
                  onChange={(e) => patch({ estimateHours: Number(e.target.value) || 0 })}
                />
              </label>
              <label className="rounded-lg bg-ink-900/50 px-2 py-1.5">
                <span className="text-[10px] font-medium text-ink-500">Logged</span>
                <Input
                  type="number"
                  min={0}
                  step={0.5}
                  size="sm"
                  className="mt-1 h-7 border-0 bg-transparent px-0"
                  value={liveTask.loggedHours}
                  onChange={(e) => patch({ loggedHours: Number(e.target.value) || 0 })}
                />
              </label>
              <div className="rounded-lg bg-ink-900/50 px-2 py-1.5">
                <p className="text-[10px] font-medium text-ink-500">Left</p>
                <p className="mt-1.5 text-sm font-semibold text-ink-50">{liveTask.remainingHours}h</p>
              </div>
            </div>
          </div>

          <div className="border-t border-ink-700/70 pt-3 text-[11px] leading-relaxed text-ink-500">
            <p>Created {formatRelative(liveTask.createdAt)}</p>
            <p>Updated {formatRelative(liveTask.updatedAt)}</p>
          </div>
        </aside>
      </div>

      <ConfirmModal
        open={confirmDelete}
        title="Delete task?"
        message={`Delete “${liveTask.title}”? This can’t be undone.`}
        confirmLabel="Delete"
        danger
        busy={deleting}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          setDeleting(true);
          try {
            await deleteTask(liveTask.id);
            toast.success(`Deleted ${liveTask.key}`);
            setConfirmDelete(false);
            onClose();
          } catch (err) {
            toast.fromError(err, 'Could not delete task');
          } finally {
            setDeleting(false);
          }
        }}
      />
    </Modal>
  );
}
