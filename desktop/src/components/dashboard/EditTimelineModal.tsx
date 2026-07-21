import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/Button';
import { DatePicker } from '@/components/ui/DatePicker';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import {
  TASK_PRIORITIES,
  TASK_TYPES,
  attachmentHref,
  formatFileSize,
  type TaskAttachment,
  type TaskPriority,
  type TaskType,
  type TimelineItem,
} from '@/lib/workspace/types';
import { useWorkspace } from '@/lib/workspace/WorkspaceContext';

const MAX_FILE_BYTES = 2 * 1024 * 1024;

type Props = {
  item: TimelineItem;
  onClose: () => void;
};

export function EditTimelineModal({ item, onClose }: Props) {
  const { updateTimelineItem, getProject, getProjectTeams } = useWorkspace();
  const project = getProject(item.projectId);
  const members = project?.members ?? [];
  const teams = getProjectTeams(item.projectId);

  const initialAssigneeId = useMemo(() => {
    return (
      members.find(
        (m) =>
          m.id === item.assigneeId ||
          m.name.toLowerCase() === (item.assigneeName ?? '').toLowerCase(),
      )?.id ?? ''
    );
  }, [members, item.assigneeId, item.assigneeName]);

  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState(item.description);
  const [type, setType] = useState<TaskType>(item.type);
  const [priority, setPriority] = useState<TaskPriority>(item.priority);
  const [dueDate, setDueDate] = useState(item.dueDate);
  const [teamId, setTeamId] = useState(item.teamId ?? '');
  const [assigneeId, setAssigneeId] = useState(initialAssigneeId);
  const [kept, setKept] = useState<TaskAttachment[]>(item.attachments ?? []);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

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
    if (ok.length) setNewFiles((prev) => [...prev, ...ok]);
    if (skipped.length) setFileError(`Skipped: ${skipped.join(', ')}`);
    e.target.value = '';
  }

  function removeExisting(id: string) {
    setKept((prev) => prev.filter((a) => a.id !== id));
    setRemovedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError('');
    try {
      const member = members.find((m) => m.id === assigneeId);
      await updateTimelineItem(item.id, {
        title,
        description,
        type,
        priority,
        dueDate,
        teamId: teamId || null,
        files: newFiles,
        removeAttachmentIds: removedIds,
        assigneeId: member?.id ?? '',
        assigneeName: member?.name ?? '',
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save changes');
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/55 p-4">
      <button type="button" className="absolute inset-0" onClick={onClose} aria-label="Close" />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto border border-ink-600 bg-ink-800 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-ink-50">Edit timeline task</h2>
        <p className="mt-1 text-xs text-ink-300">
          Update name, assignee, details, and files
          {item.taskId ? ' — board task stays in sync.' : '.'}
        </p>

        <form onSubmit={onSubmit} className="mt-4 space-y-3">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task name"
            required
            autoFocus
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Description"
            className="w-full border border-ink-600 px-3 py-2 text-sm outline-none focus:border-ink-400"
          />
          <div className="grid grid-cols-2 gap-2">
            <Select
              size="sm"
              value={type}
              onChange={(v) => setType(v as TaskType)}
              options={TASK_TYPES.map((t) => ({ value: t.id, label: t.label }))}
              aria-label="Type"
            />
            <Select
              size="sm"
              value={priority}
              onChange={(v) => setPriority(v as TaskPriority)}
              options={TASK_PRIORITIES.map((p) => ({
                value: p,
                label: p.charAt(0).toUpperCase() + p.slice(1),
              }))}
              aria-label="Priority"
            />
          </div>
          <DatePicker value={dueDate} onChange={setDueDate} clearable />

          {teams.length > 0 ? (
            <div>
              <p className="mb-1.5 text-[10px] font-bold tracking-wide text-ink-300 uppercase">
                Team
              </p>
              <Select
                size="sm"
                value={teamId}
                onChange={setTeamId}
                options={[
                  { value: '', label: 'Project-wide' },
                  ...teams.map((t) => ({ value: t.id, label: t.name })),
                ]}
                aria-label="Team"
              />
            </div>
          ) : null}

          <div>
            <p className="mb-1.5 text-[10px] font-bold tracking-wide text-ink-300 uppercase">
              Assignee
            </p>
            {members.length === 0 ? (
              <p className="text-xs text-ink-400">Invite project members to assign this task.</p>
            ) : (
              <Select
                size="sm"
                value={assigneeId}
                placeholder="Unassigned"
                onChange={setAssigneeId}
                options={[
                  ...(item.taskId
                    ? []
                    : [{ value: '', label: 'Unassigned' }]),
                  ...members.map((m) => ({ value: m.id, label: m.name })),
                ]}
                aria-label="Assignee"
              />
            )}
            {item.taskId ? (
              <p className="mt-1 text-[10px] text-ink-400">
                Changing assignee updates the board task.
              </p>
            ) : (
              <p className="mt-1 text-[10px] text-ink-400">
                Choosing someone assigns this to the board.
              </p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold tracking-wide text-ink-300 uppercase">
                Files / images
              </p>
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
                accept="image/*,.pdf,.txt,.doc,.docx"
                className="hidden"
                onChange={onFiles}
              />
            </div>

            {kept.length === 0 && newFiles.length === 0 ? (
              <p className="mt-2 text-xs text-ink-400">No files attached.</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {kept.map((att) => {
                  const href = attachmentHref(att);
                  return (
                    <li
                      key={att.id}
                      className="flex items-center gap-2 border border-ink-600 px-2.5 py-2"
                    >
                      {att.mimeType.startsWith('image/') && href ? (
                        <img src={href} alt="" className="h-8 w-8 object-cover" />
                      ) : (
                        <span className="flex h-8 w-8 items-center justify-center bg-ink-700 text-[9px] font-bold text-ink-200">
                          FILE
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-ink-100">{att.name}</p>
                        <p className="text-[10px] text-ink-400">{formatFileSize(att.size)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeExisting(att.id)}
                        className="text-[11px] font-semibold text-ink-400 hover:text-[#ed4245]"
                      >
                        Remove
                      </button>
                    </li>
                  );
                })}
                {newFiles.map((file, idx) => (
                  <li
                    key={`${file.name}-${idx}`}
                    className="flex items-center justify-between border border-dashed border-ink-500 px-2.5 py-2 text-xs"
                  >
                    <span className="truncate font-semibold text-ink-100">
                      New · {file.name} · {formatFileSize(file.size)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setNewFiles((prev) => prev.filter((_, i) => i !== idx))}
                      className="font-semibold text-ink-400 hover:text-[#ed4245]"
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

          {error ? <p className="text-sm text-[#ed4245]">{error}</p> : null}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" size="sm" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={saving || !title.trim()}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
