import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { DatePicker } from '@/components/ui/DatePicker';
import { FieldError, FieldLabel } from '@/components/ui/FieldLabel';
import { Input } from '@/components/ui/Input';
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

const labelClass = 'mb-0 text-[10px] font-bold tracking-wide text-ink-300 uppercase';

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
            className="flex items-center gap-2 border border-ink-600 bg-ink-800 px-2.5 py-2"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center bg-ink-700 text-[10px] font-bold text-ink-200">
              {att.mimeType.startsWith('image/') ? 'IMG' : 'FILE'}
            </span>
            <div className="min-w-0 flex-1">
              {href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="block truncate text-xs font-semibold text-brand-800 hover:underline"
                >
                  {att.name}
                </a>
              ) : (
                <p className="truncate text-xs font-semibold text-ink-100">{att.name}</p>
              )}
              <p className="text-[10px] text-ink-300">
                {formatFileSize(att.size)} · {att.uploadedBy}
              </p>
            </div>
            {att.mimeType.startsWith('image/') && href ? (
              <img
                src={href}
                alt=""
                className="h-8 w-8 shrink-0 object-cover ring-1 ring-ink-600"
              />
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

export function TaskDetailModal({ task, projectName, columns, onClose }: Props) {
  const { user } = useAuth();
  const { getProject, getProjectTeams, getProjectSprints, updateTask, addComment, addTaskAttachments, removeTaskAttachment, getTask, deleteTask } =
    useWorkspace();
  const liveTask = getTask(task.id) ?? task;
  const [comment, setComment] = useState('');
  const [labelDraft, setLabelDraft] = useState('');
  const [commentFiles, setCommentFiles] = useState<File[]>([]);
  const [titleDraft, setTitleDraft] = useState(liveTask.title);
  const [titleError, setTitleError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const toast = useToast();
  const taskFileRef = useRef<HTMLInputElement>(null);
  const commentFileRef = useRef<HTMLInputElement>(null);

  const project = getProject(liveTask.projectId);
  const teams = getProjectTeams(liveTask.projectId);
  const sprints = getProjectSprints(liveTask.projectId);
  const members = (project?.members ?? []).filter((m) => m.status !== 'pending');
  const typeMeta = TASK_TYPES.find((t) => t.id === liveTask.type);

  useEffect(() => {
    setTitleDraft(liveTask.title);
    setTitleError('');
  }, [liveTask.id, liveTask.title]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function patch(partial: Partial<BoardTask>) {
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

  function assignMember(member: ProjectMember | null) {
    if (!member) {
      patch({ assigneeId: '', assigneeName: 'Unassigned' });
      return;
    }
    patch({ assigneeId: member.id, assigneeName: member.name });
  }

  async function onTaskFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length) return;
    const { ok, skipped } = filterFiles(files);
    try {
      if (ok.length) await addTaskAttachments(liveTask.id, ok);
      if (skipped.length) toast.error(`Skipped: ${skipped.join(', ')}`);
    } catch (err) {
      toast.fromError(err, 'Upload failed');
    }
    e.target.value = '';
  }

  function onCommentFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length) return;
    const { ok, skipped } = filterFiles(files);
    if (ok.length) setCommentFiles((prev) => [...prev, ...ok]);
    if (skipped.length) toast.error(`Skipped: ${skipped.join(', ')}`);
    e.target.value = '';
  }

  async function onAddComment(e: FormEvent) {
    e.preventDefault();
    if (!comment.trim() && commentFiles.length === 0) return;
    await addComment(liveTask.id, comment, commentFiles);
    setComment('');
    setCommentFiles([]);
  }

  function onAddLabel(e: FormEvent) {
    e.preventDefault();
    const value = labelDraft.trim();
    if (!value) return;
    if (liveTask.labels.includes(value)) {
      setLabelDraft('');
      return;
    }
    patch({ labels: [...task.labels, value] });
    setLabelDraft('');
  }

  const comments = [...(liveTask.comments ?? [])].reverse();
  const selectedMember =
    members.find(
      (m) =>
        m.id === liveTask.assigneeId ||
        m.name.toLowerCase() === liveTask.assigneeName.toLowerCase(),
    ) ?? null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/55 p-3 sm:p-6">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        aria-label="Close overlay"
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-ink-600 bg-ink-800 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-ink-600 px-5 py-3.5">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  'rounded-md px-2 py-0.5 text-[10px] font-bold uppercase text-white',
                  typeMeta?.color ?? 'bg-ink-700',
                )}
              >
                {typeMeta?.label ?? liveTask.type}
              </span>
              <div className="w-[110px]">
                <Select
                  size="xs"
                  value={liveTask.type}
                  onChange={(v) => patch({ type: v as TaskType })}
                  options={TASK_TYPES.map((t) => ({ value: t.id, label: t.label }))}
                  aria-label="Issue type"
                />
              </div>
              <span className="text-xs font-bold text-ink-200">{liveTask.key}</span>
              <span className="text-xs text-ink-400">·</span>
              <span className="text-xs font-semibold text-ink-200">{projectName}</span>
            </div>
            <FieldLabel htmlFor="task-title" required className="mt-3 mb-1">
              Title
            </FieldLabel>
            <input
              id="task-title"
              className={cn(
                'w-full rounded-lg border bg-ink-900/40 px-3 py-2 text-lg font-semibold text-ink-50 outline-none',
                titleError ? 'border-[#ed4245]/70' : 'border-ink-600 focus:border-brand-500',
              )}
              value={titleDraft}
              onChange={(e) => {
                setTitleDraft(e.target.value);
                if (e.target.value.trim()) setTitleError('');
              }}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  (e.target as HTMLInputElement).blur();
                }
              }}
              required
            />
            <FieldError>{titleError}</FieldError>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Button variant="danger" size="xs" onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
            <Button variant="secondary" size="xs" onClick={onClose}>
              Close
            </Button>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 gap-0 overflow-hidden md:grid-cols-[1fr_300px]">
          <div className="min-h-0 space-y-5 overflow-y-auto p-5">
            <section>
              <FieldLabel htmlFor="task-desc" optional>
                Description
              </FieldLabel>
              <textarea
                id="task-desc"
                className="mt-0 min-h-[100px] w-full rounded-lg border border-ink-600 bg-ink-900/30 px-3 py-2 text-sm text-ink-50 outline-none focus:border-brand-500"
                value={liveTask.description}
                onChange={(e) => patch({ description: e.target.value })}
                placeholder="Add a description"
              />
            </section>

            <section>
              <div className="flex items-center justify-between gap-2">
                <FieldLabel optional className="mb-0">
                  Attachments
                </FieldLabel>
                <button
                  type="button"
                  onClick={() => taskFileRef.current?.click()}
                  className="text-[11px] font-semibold text-brand-800 hover:underline"
                >
                  + Attach file
                </button>
                <input
                  ref={taskFileRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={onTaskFiles}
                />
              </div>
              {(liveTask.attachments ?? []).length === 0 ? (
                <p className="mt-2 text-xs text-ink-400">No files on this task yet.</p>
              ) : (
                <AttachmentList
                  items={liveTask.attachments}
                  onRemove={(id) => void removeTaskAttachment(liveTask.id, id)}
                />
              )}
            </section>

            <section>
              <FieldLabel optional>Time tracking</FieldLabel>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <label className="border border-ink-600 bg-ink-800/60 px-2.5 py-2">
                  <span className="text-[10px] font-bold text-ink-300 uppercase">Estimate</span>
                  <Input
                    type="number"
                    min={0}
                    step={0.5}
                    className="mt-1 h-8 text-xs"
                    value={liveTask.estimateHours}
                    onChange={(e) => patch({ estimateHours: Number(e.target.value) || 0 })}
                  />
                </label>
                <label className="border border-ink-600 bg-ink-800/60 px-2.5 py-2">
                  <span className="text-[10px] font-bold text-ink-300 uppercase">Logged</span>
                  <Input
                    type="number"
                    min={0}
                    step={0.5}
                    className="mt-1 h-8 text-xs"
                    value={liveTask.loggedHours}
                    onChange={(e) => patch({ loggedHours: Number(e.target.value) || 0 })}
                  />
                </label>
                <div className="border border-ink-600 bg-ink-800/60 px-2.5 py-2">
                  <p className="text-[10px] font-bold text-ink-300 uppercase">Remaining</p>
                  <p className="mt-1.5 text-base font-semibold text-ink-50">
                    {liveTask.remainingHours}h
                  </p>
                </div>
              </div>
            </section>

            <section>
              <FieldLabel optional>Labels</FieldLabel>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {liveTask.labels.map((label) => (
                  <Tooltip key={label} label="Remove label" side="top">
                  <button
                    type="button"
                    aria-label={`Remove ${label}`}
                    onClick={() => patch({ labels: liveTask.labels.filter((l) => l !== label) })}
                    className="bg-ink-700 px-2 py-0.5 text-[11px] font-semibold text-ink-200"
                  >
                    {label} ×
                  </button>
                  </Tooltip>
                ))}
              </div>
              <form onSubmit={onAddLabel} className="mt-2 flex gap-1.5">
                <Input
                  value={labelDraft}
                  onChange={(e) => setLabelDraft(e.target.value)}
                  placeholder="Add label"
                  className="h-8 text-xs"
                />
                <Button type="submit" size="xs" variant="secondary">
                  Add
                </Button>
              </form>
            </section>

            <section>
              <FieldLabel optional>Comments</FieldLabel>
              <form onSubmit={onAddComment} className="mt-2 space-y-2">
                <textarea
                  className="min-h-[72px] w-full border border-ink-600 px-3 py-2 text-sm text-ink-50 outline-none focus:border-ink-400"
                  placeholder={`Comment as ${user?.name ?? 'you'}…`}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
                {commentFiles.length > 0 ? (
                  <ul className="space-y-1">
                    {commentFiles.map((file, idx) => (
                      <li
                        key={`${file.name}-${idx}`}
                        className="flex items-center justify-between border border-ink-600 px-2.5 py-1.5 text-xs"
                      >
                        <span className="truncate font-semibold text-ink-100">
                          {file.name} · {formatFileSize(file.size)}
                        </span>
                        <button
                          type="button"
                          className="font-semibold text-ink-400 hover:text-[#ed4245]"
                          onClick={() =>
                            setCommentFiles((prev) => prev.filter((_, i) => i !== idx))
                          }
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => commentFileRef.current?.click()}
                    className="text-[11px] font-semibold text-ink-200 hover:text-ink-50"
                  >
                    Attach to comment
                  </button>
                  <input
                    ref={commentFileRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={onCommentFiles}
                  />
                  <Button
                    type="submit"
                    size="xs"
                    disabled={!comment.trim() && commentFiles.length === 0}
                  >
                    Comment
                  </Button>
                </div>
              </form>

              <div className="mt-4 space-y-2">
                {comments.length === 0 ? (
                  <p className="text-xs text-ink-400">No comments yet.</p>
                ) : (
                  comments.map((c) => (
                    <article key={c.id} className="border border-ink-600 bg-ink-800/50 px-3 py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <UserAvatar
                            name={c.authorName}
                            src={c.authorAvatarUrl}
                            seed={c.authorName}
                            size="sm"
                            userId={c.authorId}
                          />
                          <p className="text-xs font-semibold text-ink-50">{c.authorName}</p>
                        </div>
                        <p className="text-[10px] font-medium text-ink-400">
                          {formatDateTime(c.createdAt)}
                        </p>
                      </div>
                      {c.body ? (
                        <p className="mt-1.5 whitespace-pre-wrap text-sm text-ink-100">{c.body}</p>
                      ) : null}
                      <AttachmentList items={c.attachments ?? []} />
                    </article>
                  ))
                )}
              </div>
            </section>
          </div>

          <aside className="min-h-0 space-y-4 overflow-y-auto border-t border-ink-600 bg-ink-950 p-4 md:border-t-0 md:border-l">
            <div>
              <FieldLabel required>Status</FieldLabel>
              <Select
                value={liveTask.status}
                onChange={(v) => patch({ status: v as TaskStatus })}
                options={columns.map((c) => ({ value: c.id, label: c.label }))}
                aria-label="Status"
              />
            </div>

            <div>
              <FieldLabel required>Priority</FieldLabel>
              <Select
                value={liveTask.priority}
                onChange={(v) => patch({ priority: v as TaskPriority })}
                options={TASK_PRIORITIES.map((p) => ({
                  value: p,
                  label: p.charAt(0).toUpperCase() + p.slice(1),
                }))}
                aria-label="Priority"
              />
            </div>

            {sprints.length > 0 ? (
              <div>
                <FieldLabel optional>Sprint</FieldLabel>
                <Select
                  value={liveTask.sprintId ?? ''}
                  onChange={(v) => patch({ sprintId: v || null })}
                  options={[
                    { value: '', label: 'Backlog' },
                    ...sprints.map((s) => ({ value: s.id, label: s.name })),
                  ]}
                  aria-label="Sprint"
                />
              </div>
            ) : null}

            {teams.length > 0 ? (
              <div>
                <FieldLabel optional>Group</FieldLabel>
                <Select
                  value={liveTask.teamId ?? ''}
                  onChange={(v) => patch({ teamId: v || null })}
                  options={[
                    { value: '', label: 'No group' },
                    ...teams.map((t) => ({ value: t.id, label: t.name })),
                  ]}
                  aria-label="Group"
                />
              </div>
            ) : null}

            <div>
              <FieldLabel optional>Assignee</FieldLabel>
              {selectedMember ? (
                <div className="mb-2 flex items-center gap-2 rounded-lg border border-ink-600 bg-ink-800 px-2.5 py-2">
                  <UserAvatar
                    name={selectedMember.name}
                    src={selectedMember.avatarUrl}
                    seed={selectedMember.email || selectedMember.name}
                    size="sm"
                    className="!h-7 !w-7 !text-[10px]"
                    userId={selectedMember.userId || selectedMember.id}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-ink-50">{selectedMember.name}</p>
                    <p className="truncate text-[10px] text-ink-300">{selectedMember.email}</p>
                  </div>
                </div>
              ) : liveTask.assigneeName && liveTask.assigneeName !== 'Unassigned' ? (
                <div className="mb-2 rounded-lg border border-ink-600 bg-ink-800 px-2.5 py-2">
                  <p className="text-xs font-semibold text-ink-100">{liveTask.assigneeName}</p>
                  <p className="text-[10px] text-ink-400">Not a project member</p>
                </div>
              ) : null}
              <Select
                value={selectedMember?.id ?? ''}
                onChange={(id) => assignMember(members.find((m) => m.id === id) ?? null)}
                options={[
                  { value: '', label: 'Unassigned' },
                  ...members.map((m) => ({
                    value: m.id,
                    label: user && m.email.toLowerCase() === user.email.toLowerCase() ? `${m.name} (you)` : m.name,
                  })),
                ]}
                aria-label="Assignee"
              />
              {user ? (
                <button
                  type="button"
                  className="mt-1.5 text-[11px] font-semibold text-brand-800 hover:underline"
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
            </div>

            <div>
              <FieldLabel optional>Reporter</FieldLabel>
              <Input
                className="h-9 rounded-lg text-xs"
                value={liveTask.reporterName}
                onChange={(e) => patch({ reporterName: e.target.value })}
              />
            </div>

            <div>
              <FieldLabel optional>Start date</FieldLabel>
              <DatePicker
                value={liveTask.startDate}
                onChange={(v) => {
                  if (liveTask.endDate && v && liveTask.endDate < v) {
                    patch({ startDate: v, endDate: v });
                    return;
                  }
                  patch({ startDate: v });
                }}
              />
            </div>

            <div>
              <FieldLabel optional>End date</FieldLabel>
              <DatePicker
                value={liveTask.endDate}
                onChange={(v) => {
                  if (liveTask.startDate && v && v < liveTask.startDate) return;
                  patch({ endDate: v });
                }}
              />
              {liveTask.startDate && liveTask.endDate && liveTask.endDate < liveTask.startDate ? (
                <FieldError>End date cannot be before the start date.</FieldError>
              ) : null}
            </div>

            <div>
              <FieldLabel optional>Due date</FieldLabel>
              <DatePicker value={liveTask.dueDate} onChange={(v) => patch({ dueDate: v })} />
            </div>

            <div className="border-t border-ink-600 pt-3">
              <p className={labelClass}>Created by</p>
              <p className="mt-1 text-xs font-semibold text-ink-50">{liveTask.createdByName}</p>
              <p className="text-[11px] text-ink-300">{formatDateTime(liveTask.createdAt)}</p>
            </div>

            <div>
              <p className={labelClass}>Updated</p>
              <p className="mt-1 text-[11px] text-ink-200">{formatDateTime(liveTask.updatedAt)}</p>
            </div>
          </aside>
        </div>
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
    </div>,
    document.body,
  );
}
