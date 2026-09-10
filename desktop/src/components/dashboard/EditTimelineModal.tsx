import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { DatePicker } from '@/components/ui/DatePicker';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { Input, Textarea } from '@/components/ui/Input';
import { Modal, ModalFooter, ModalHeader } from '@/components/ui/Modal';
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
import { useToast } from '@/lib/toast/ToastContext';

const MAX_FILE_BYTES = 2 * 1024 * 1024;

type Props = {
  item: TimelineItem;
  onClose: () => void;
};

export function EditTimelineModal({ item, onClose }: Props) {
  const { updateTimelineItem, getProject, getProjectTeams } = useWorkspace();
  const toast = useToast();
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
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function onFiles(e: ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files;
    if (!picked?.length) return;
        const ok: File[] = [];
    const skipped: string[] = [];
    for (const file of Array.from(picked)) {
      if (file.size > MAX_FILE_BYTES) skipped.push(`${file.name} (max 2MB)`);
      else ok.push(file);
    }
    if (ok.length) setNewFiles((prev) => [...prev, ...ok]);
    if (skipped.length) toast.error(`Skipped: ${skipped.join(', ')}`);
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
      toast.fromError(err, 'Could not save changes');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal size="lg" labelledBy="edit-timeline-title" onClose={onClose}>
      <ModalHeader
        titleId="edit-timeline-title"
        title="Edit timeline task"
        description={
          item.taskId
            ? 'Update name, assignee, details, and files — the board task stays in sync.'
            : 'Update name, assignee, details, and files.'
        }
        onClose={onClose}
      />
      <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div>
            <FieldLabel htmlFor="timeline-title" required>
              Task name
            </FieldLabel>
            <Input
              id="timeline-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task name"
              required
              autoFocus
            />
          </div>
          <div>
            <FieldLabel htmlFor="timeline-desc" optional>
              Description
            </FieldLabel>
            <Textarea
              id="timeline-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Description"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel required>Type</FieldLabel>
              <Select
                size="md"
                value={type}
                onChange={(v) => setType(v as TaskType)}
                options={TASK_TYPES.map((t) => ({ value: t.id, label: t.label }))}
                aria-label="Type"
              />
            </div>
            <div>
              <FieldLabel required>Priority</FieldLabel>
              <Select
                size="md"
                value={priority}
                onChange={(v) => setPriority(v as TaskPriority)}
                options={TASK_PRIORITIES.map((p) => ({
                  value: p,
                  label: p.charAt(0).toUpperCase() + p.slice(1),
                }))}
                aria-label="Priority"
              />
            </div>
          </div>
          <div>
            <FieldLabel optional>Due date</FieldLabel>
            <DatePicker value={dueDate} onChange={setDueDate} clearable size="md" />
          </div>

          {teams.length > 0 ? (
            <div>
              <FieldLabel optional>Group</FieldLabel>
              <Select
                size="md"
                value={teamId}
                onChange={setTeamId}
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
            {members.length === 0 ? (
              <p className="text-xs text-ink-400">Invite project members to assign this task.</p>
            ) : (
              <Select
                size="md"
                value={assigneeId}
                placeholder="Unassigned"
                onChange={setAssigneeId}
                options={[
                  ...(item.taskId ? [] : [{ value: '', label: 'Unassigned' }]),
                  ...members.map((m) => ({ value: m.id, label: m.name })),
                ]}
                aria-label="Assignee"
              />
            )}
            <p className="mt-1 text-[11px] text-ink-400">
              {item.taskId
                ? 'Changing assignee updates the board task.'
                : 'Choosing someone assigns this to the board.'}
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <FieldLabel optional className="mb-0">
                Files / images
              </FieldLabel>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="text-[11px] font-semibold text-brand-300 hover:underline"
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
              <p className="mt-2 rounded-xl border border-dashed border-ink-600 px-3 py-4 text-center text-xs text-ink-400">
                No files attached.
              </p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {kept.map((att) => {
                  const href = attachmentHref(att);
                  return (
                    <li
                      key={att.id}
                      className="flex items-center gap-2 rounded-xl border border-ink-600/70 bg-ink-900/40 px-2.5 py-2"
                    >
                      {att.mimeType.startsWith('image/') && href ? (
                        <img src={href} alt="" className="h-8 w-8 rounded-md object-cover" />
                      ) : (
                        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-ink-700 text-[9px] font-bold text-ink-200">
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
                    className="flex items-center justify-between rounded-xl border border-dashed border-ink-500 px-2.5 py-2 text-xs"
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
          </div>
        </div>
        <ModalFooter>
          <Button type="button" size="sm" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={saving || !title.trim()}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
