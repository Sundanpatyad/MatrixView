import { useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/Button';
import { DatePicker } from '@/components/ui/DatePicker';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useAuth } from '@/lib/auth/AuthContext';
import {
  TASK_PRIORITIES,
  TASK_TYPES,
  type TaskPriority,
  type TaskType,
} from '@/lib/workspace/types';
import { useWorkspace } from '@/lib/workspace/WorkspaceContext';

type Props = {
  projectId: string;
  onClose: () => void;
  defaultAssignee?: { id: string; name: string };
  defaultTeamId?: string | null;
};

export function CreateTaskModal({
  projectId,
  onClose,
  defaultAssignee,
  defaultTeamId = null,
}: Props) {
  const { user } = useAuth();
  const { createTask, getProjectTeams } = useWorkspace();
  const teams = getProjectTeams(projectId);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<TaskType>('task');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [estimateHours, setEstimateHours] = useState(2);
  const [dueDate, setDueDate] = useState('');
  const [teamId, setTeamId] = useState<string>(defaultTeamId ?? '');
  const assigneeName = defaultAssignee?.name ?? user?.name ?? 'You';
  const assigneeId = defaultAssignee?.id;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await createTask({
      projectId,
      title,
      description,
      type,
      priority,
      estimateHours: Number(estimateHours) || 0,
      assigneeName,
      assigneeId,
      dueDate,
      teamId: teams.length > 0 ? teamId || null : null,
    });
    onClose();
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/55 p-4">
      <button type="button" className="absolute inset-0" onClick={onClose} aria-label="Close" />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 w-full max-w-lg rounded-2xl bg-ink-800 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold text-ink-50">Create issue</h2>
        <p className="mt-1 text-sm font-medium text-ink-200">
          Choose type: Task, Bug, Story, or Time.
        </p>

        <form onSubmit={onSubmit} className="mt-5 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-bold text-ink-200 uppercase" htmlFor="title">
              Summary
            </label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-ink-200 uppercase" htmlFor="desc">
              Description
            </label>
            <textarea
              id="desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-ink-500 bg-ink-800 px-3 py-2 text-sm font-medium text-ink-50"
              placeholder="Details, steps to reproduce, acceptance criteria…"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-bold text-ink-200 uppercase">Type</label>
              <Select
                size="md"
                value={type}
                onChange={(v) => setType(v as TaskType)}
                options={TASK_TYPES.map((t) => ({ value: t.id, label: t.label }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-ink-200 uppercase">
                Priority
              </label>
              <Select
                size="md"
                value={priority}
                onChange={(v) => setPriority(v as TaskPriority)}
                options={TASK_PRIORITIES.map((p) => ({
                  value: p,
                  label: p.charAt(0).toUpperCase() + p.slice(1),
                }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                className="mb-1 block text-xs font-bold text-ink-200 uppercase"
                htmlFor="estimate"
              >
                Estimate (hours)
              </label>
              <Input
                id="estimate"
                type="number"
                min={0}
                step={0.5}
                value={estimateHours}
                onChange={(e) => setEstimateHours(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-ink-200 uppercase">
                Due date
              </label>
              <DatePicker size="md" value={dueDate} onChange={setDueDate} />
            </div>
          </div>

          {teams.length > 0 ? (
            <div>
              <label className="mb-1 block text-xs font-bold text-ink-200 uppercase">Team</label>
              <Select
                size="md"
                value={teamId}
                onChange={setTeamId}
                options={[
                  { value: '', label: 'Project-wide (no team)' },
                  ...teams.map((t) => ({ value: t.id, label: t.name })),
                ]}
              />
            </div>
          ) : null}

          <div>
            <label className="mb-1 block text-xs font-bold text-ink-200 uppercase">
              Assigned to
            </label>
            <p className="rounded-lg border border-ink-600 bg-ink-900 px-3 py-2.5 text-sm font-semibold text-ink-100">
              {assigneeName}
              {assigneeName === user?.name ? (
                <span className="font-medium text-ink-300"> (you)</span>
              ) : (
                <span className="font-medium text-ink-300"> — current board</span>
              )}
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">Create</Button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
