import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/Button';
import { DatePicker } from '@/components/ui/DatePicker';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { UserAvatar } from '@/components/ui/UserAvatar';
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

type Props = {
  task: BoardTask;
  projectName: string;
  columns: BoardColumn[];
  onClose: () => void;
};

const MAX_FILE_BYTES = 2 * 1024 * 1024;

const labelClass = 'text-[10px] font-bold tracking-wide text-ink-500 uppercase';

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
            className="flex items-center gap-2 border border-ink-200 bg-white px-2.5 py-2"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center bg-ink-100 text-[10px] font-bold text-ink-600">
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
                <p className="truncate text-xs font-semibold text-ink-800">{att.name}</p>
              )}
              <p className="text-[10px] text-ink-500">
                {formatFileSize(att.size)} · {att.uploadedBy}
              </p>
            </div>
            {att.mimeType.startsWith('image/') && href ? (
              <img
                src={href}
                alt=""
                className="h-8 w-8 shrink-0 object-cover ring-1 ring-ink-200"
              />
            ) : null}
            {onRemove ? (
              <button
                type="button"
                onClick={() => onRemove(att.id)}
                className="text-[11px] font-semibold text-ink-400 hover:text-red-600"
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
  const { getProject, updateTask, addComment, addTaskAttachments, removeTaskAttachment, getTask } =
    useWorkspace();
  const liveTask = getTask(task.id) ?? task;
  const [comment, setComment] = useState('');
  const [labelDraft, setLabelDraft] = useState('');
  const [commentFiles, setCommentFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState('');
  const taskFileRef = useRef<HTMLInputElement>(null);
  const commentFileRef = useRef<HTMLInputElement>(null);

  const project = getProject(liveTask.projectId);
  const members = project?.members ?? [];
  const typeMeta = TASK_TYPES.find((t) => t.id === liveTask.type);

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
    setFileError('');
    const { ok, skipped } = filterFiles(files);
    try {
      if (ok.length) await addTaskAttachments(liveTask.id, ok);
      if (skipped.length) setFileError(`Skipped: ${skipped.join(', ')}`);
    } catch (err) {
      setFileError(err instanceof Error ? err.message : 'Upload failed');
    }
    e.target.value = '';
  }

  function onCommentFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length) return;
    setFileError('');
    const { ok, skipped } = filterFiles(files);
    if (ok.length) setCommentFiles((prev) => [...prev, ...ok]);
    if (skipped.length) setFileError(`Skipped: ${skipped.join(', ')}`);
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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-ink-950/40 p-3 sm:p-6">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        aria-label="Close overlay"
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden border border-ink-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-ink-200 px-5 py-3.5">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  'rounded px-2 py-0.5 text-[10px] font-bold uppercase text-white',
                  typeMeta?.color ?? 'bg-ink-700',
                )}
              >
                {typeMeta?.label ?? liveTask.type}
              </span>
              <div className="w-[96px]">
                <Select
                  size="xs"
                  value={liveTask.type}
                  onChange={(v) => patch({ type: v as TaskType })}
                  options={TASK_TYPES.map((t) => ({ value: t.id, label: t.label }))}
                  aria-label="Issue type"
                />
              </div>
              <span className="text-xs font-bold text-ink-600">{liveTask.key}</span>
              <span className="text-xs text-ink-400">·</span>
              <span className="text-xs font-semibold text-ink-700">{projectName}</span>
            </div>
            <input
              className="mt-1.5 w-full border-0 bg-transparent text-lg font-semibold text-ink-950 outline-none"
              value={liveTask.title}
              onChange={(e) => patch({ title: e.target.value })}
            />
          </div>
          <Button variant="secondary" size="xs" onClick={onClose}>
            Close
          </Button>
        </header>

        <div className="grid min-h-0 flex-1 gap-0 overflow-hidden md:grid-cols-[1fr_300px]">
          <div className="min-h-0 space-y-5 overflow-y-auto p-5">
            <section>
              <p className={labelClass}>Description</p>
              <textarea
                className="mt-1.5 min-h-[100px] w-full border border-ink-200 px-3 py-2 text-sm text-ink-900 outline-none focus:border-ink-400"
                value={liveTask.description}
                onChange={(e) => patch({ description: e.target.value })}
                placeholder="Add a description…"
              />
            </section>

            <section>
              <div className="flex items-center justify-between gap-2">
                <p className={labelClass}>Attachments</p>
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
              <p className={labelClass}>Time tracking</p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <label className="border border-ink-200 bg-ink-50/60 px-2.5 py-2">
                  <span className="text-[10px] font-bold text-ink-500 uppercase">Estimate</span>
                  <Input
                    type="number"
                    min={0}
                    step={0.5}
                    className="mt-1 h-8 text-xs"
                    value={liveTask.estimateHours}
                    onChange={(e) => patch({ estimateHours: Number(e.target.value) || 0 })}
                  />
                </label>
                <label className="border border-ink-200 bg-ink-50/60 px-2.5 py-2">
                  <span className="text-[10px] font-bold text-ink-500 uppercase">Logged</span>
                  <Input
                    type="number"
                    min={0}
                    step={0.5}
                    className="mt-1 h-8 text-xs"
                    value={liveTask.loggedHours}
                    onChange={(e) => patch({ loggedHours: Number(e.target.value) || 0 })}
                  />
                </label>
                <div className="border border-ink-200 bg-ink-50/60 px-2.5 py-2">
                  <p className="text-[10px] font-bold text-ink-500 uppercase">Remaining</p>
                  <p className="mt-1.5 text-base font-semibold text-ink-900">
                    {liveTask.remainingHours}h
                  </p>
                </div>
              </div>
            </section>

            <section>
              <p className={labelClass}>Labels</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {liveTask.labels.map((label) => (
                  <button
                    key={label}
                    type="button"
                    title="Remove label"
                    onClick={() => patch({ labels: liveTask.labels.filter((l) => l !== label) })}
                    className="bg-ink-100 px-2 py-0.5 text-[11px] font-semibold text-ink-700"
                  >
                    {label} ×
                  </button>
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
              <p className={labelClass}>Comments</p>
              <form onSubmit={onAddComment} className="mt-2 space-y-2">
                <textarea
                  className="min-h-[72px] w-full border border-ink-200 px-3 py-2 text-sm text-ink-900 outline-none focus:border-ink-400"
                  placeholder={`Comment as ${user?.name ?? 'you'}…`}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
                {commentFiles.length > 0 ? (
                  <ul className="space-y-1">
                    {commentFiles.map((file, idx) => (
                      <li
                        key={`${file.name}-${idx}`}
                        className="flex items-center justify-between border border-ink-200 px-2.5 py-1.5 text-xs"
                      >
                        <span className="truncate font-semibold text-ink-800">
                          {file.name} · {formatFileSize(file.size)}
                        </span>
                        <button
                          type="button"
                          className="font-semibold text-ink-400 hover:text-red-600"
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
                    className="text-[11px] font-semibold text-ink-600 hover:text-ink-900"
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
              {fileError ? (
                <p className="mt-2 text-[11px] font-medium text-red-600">{fileError}</p>
              ) : null}

              <div className="mt-4 space-y-2">
                {comments.length === 0 ? (
                  <p className="text-xs text-ink-400">No comments yet.</p>
                ) : (
                  comments.map((c) => (
                    <article key={c.id} className="border border-ink-200 bg-ink-50/50 px-3 py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <UserAvatar
                            name={c.authorName}
                            src={c.authorAvatarUrl}
                            seed={c.authorName}
                            size="sm"
                          />
                          <p className="text-xs font-semibold text-ink-900">{c.authorName}</p>
                        </div>
                        <p className="text-[10px] font-medium text-ink-400">
                          {formatDateTime(c.createdAt)}
                        </p>
                      </div>
                      {c.body ? (
                        <p className="mt-1.5 whitespace-pre-wrap text-sm text-ink-800">{c.body}</p>
                      ) : null}
                      <AttachmentList items={c.attachments ?? []} />
                    </article>
                  ))
                )}
              </div>
            </section>
          </div>

          <aside className="min-h-0 space-y-4 overflow-y-auto border-t border-ink-200 bg-[#F8F9FB] p-4 md:border-t-0 md:border-l">
            <div>
              <p className={labelClass}>Status</p>
              <div className="mt-1">
                <Select
                  value={liveTask.status}
                  onChange={(v) => patch({ status: v as TaskStatus })}
                  options={columns.map((c) => ({ value: c.id, label: c.label }))}
                  aria-label="Status"
                />
              </div>
            </div>

            <div>
              <p className={labelClass}>Assignee</p>
              <p className="mt-1 text-[11px] text-ink-500">Pick a project member</p>

              {selectedMember || liveTask.assigneeName === 'Unassigned' || !liveTask.assigneeName ? (
                <div className="mt-2 flex items-center gap-2 border border-ink-200 bg-white px-2.5 py-2">
                  {selectedMember ? (
                    <>
                      <UserAvatar
                        name={selectedMember.name}
                        src={selectedMember.avatarUrl}
                        seed={selectedMember.email || selectedMember.name}
                        size="sm"
                        className="!h-7 !w-7 !text-[10px]"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-ink-900">
                          {selectedMember.name}
                        </p>
                        <p className="truncate text-[10px] text-ink-500">{selectedMember.role}</p>
                      </div>
                    </>
                  ) : (
                    <p className="text-xs font-medium text-ink-500">Unassigned</p>
                  )}
                </div>
              ) : (
                <div className="mt-2 border border-ink-200 bg-white px-2.5 py-2">
                  <p className="text-xs font-semibold text-ink-800">{liveTask.assigneeName}</p>
                  <p className="text-[10px] text-ink-400">Not in team list</p>
                </div>
              )}

              <div className="mt-2 max-h-48 space-y-1 overflow-y-auto border border-ink-200 bg-white p-1">
                <button
                  type="button"
                  onClick={() => assignMember(null)}
                  className={cn(
                    'flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs',
                    !selectedMember &&
                      (liveTask.assigneeName === 'Unassigned' || !liveTask.assigneeName)
                      ? 'bg-ink-100 font-semibold text-ink-900'
                      : 'text-ink-600 hover:bg-ink-50',
                  )}
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink-200 text-[9px] font-bold text-ink-600">
                    —
                  </span>
                  Unassigned
                </button>
                {members.length === 0 ? (
                  <p className="px-2 py-3 text-[11px] text-ink-400">
                    Invite members to assign this liveTask.
                  </p>
                ) : (
                  members.map((m) => {
                    const active =
                      selectedMember?.id === m.id ||
                      (!selectedMember &&
                        m.name.toLowerCase() === liveTask.assigneeName.toLowerCase());
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => assignMember(m)}
                        className={cn(
                          'flex w-full items-center gap-2 px-2 py-1.5 text-left',
                          active
                            ? 'bg-brand-50 ring-1 ring-brand-600/30'
                            : 'hover:bg-ink-50',
                        )}
                      >
                        <UserAvatar
                          name={m.name}
                          src={m.avatarUrl}
                          seed={m.email || m.name}
                          size="sm"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-ink-900">{m.name}</p>
                          <p className="truncate text-[10px] text-ink-500">{m.email}</p>
                        </div>
                        <span className="shrink-0 text-[10px] font-semibold capitalize text-ink-400">
                          {m.role}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>

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
              <p className={labelClass}>Reporter</p>
              <Input
                className="mt-1 h-9 text-xs"
                value={liveTask.reporterName}
                onChange={(e) => patch({ reporterName: e.target.value })}
              />
            </div>

            <div>
              <p className={labelClass}>Priority</p>
              <div className="mt-1">
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
            </div>

            <div>
              <p className={labelClass}>Start date</p>
              <div className="mt-1">
                <DatePicker
                  value={liveTask.startDate}
                  onChange={(v) => patch({ startDate: v })}
                />
              </div>
            </div>

            <div>
              <p className={labelClass}>End date</p>
              <div className="mt-1">
                <DatePicker value={liveTask.endDate} onChange={(v) => patch({ endDate: v })} />
              </div>
            </div>

            <div>
              <p className={labelClass}>Due date</p>
              <div className="mt-1">
                <DatePicker value={liveTask.dueDate} onChange={(v) => patch({ dueDate: v })} />
              </div>
            </div>

            <div className="border-t border-ink-200 pt-3">
              <p className={labelClass}>Created by</p>
              <p className="mt-1 text-xs font-semibold text-ink-900">{liveTask.createdByName}</p>
              <p className="text-[11px] text-ink-500">{formatDateTime(liveTask.createdAt)}</p>
            </div>

            <div>
              <p className={labelClass}>Updated</p>
              <p className="mt-1 text-[11px] text-ink-600">{formatDateTime(liveTask.updatedAt)}</p>
            </div>
          </aside>
        </div>
      </div>
    </div>,
    document.body,
  );
}
