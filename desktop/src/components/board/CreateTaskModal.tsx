import { useEffect, useMemo, useState, type FormEvent, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/Button';
import { DatePicker } from '@/components/ui/DatePicker';
import { FieldError, FieldLabel } from '@/components/ui/FieldLabel';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Tooltip } from '@/components/ui/Tooltip';
import { useAuth } from '@/lib/auth/AuthContext';
import { cn } from '@/lib/cn';
import { memberForUser } from '@/lib/workspace/taskHelpers';
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
  sprintId?: string | null;
};

function todayIso() {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

export function CreateTaskModal({
  projectId,
  onClose,
  defaultAssignee,
  defaultTeamId = null,
  sprintId = null,
}: Props) {
  const { user } = useAuth();
  const { createTask, getProject, getProjectTeams, getProjectSprints } = useWorkspace();
  const project = getProject(projectId);
  const teams = getProjectTeams(projectId);
  const sprints = getProjectSprints(projectId);
  const members = useMemo(
    () => (project?.members ?? []).filter((m) => m.status !== 'pending'),
    [project?.members],
  );

  const initialAssignee = useMemo(() => {
    if (defaultAssignee?.id) return defaultAssignee.id;
    const me = memberForUser(project, user);
    return me?.id ?? '';
  }, [defaultAssignee?.id, project, user]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<TaskType>('task');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [estimateHours, setEstimateHours] = useState<string>('2');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [teamId, setTeamId] = useState<string>(defaultTeamId ?? '');
  const [selectedSprintId, setSelectedSprintId] = useState(sprintId ?? '');
  const [status, setStatus] = useState('');
  const [assigneeId, setAssigneeId] = useState(initialAssignee);
  const [labelDraft, setLabelDraft] = useState('');
  const [labels, setLabels] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const activeSprint = sprints.find((s) => s.id === selectedSprintId);
  const columns = useMemo(() => {
    if (activeSprint?.columns?.length) return activeSprint.columns;
    return project?.columns ?? [];
  }, [activeSprint, project?.columns]);

  useEffect(() => {
    if (!columns.length) return;
    setStatus((prev) => (prev && columns.some((c) => c.id === prev) ? prev : columns[0]!.id));
  }, [columns]);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const titleError = !title.trim() ? 'Title is required.' : '';
  const estimateValue = Number(estimateHours);
  const estimateError =
    estimateHours.trim() === ''
      ? ''
      : !Number.isFinite(estimateValue) || estimateValue < 0
        ? 'Estimate must be 0 or more.'
        : estimateValue > 1000
          ? 'Estimate cannot exceed 1000 hours.'
          : '';
  const rangeError =
    startDate && endDate && endDate < startDate ? 'End date cannot be before the start date.' : '';
  const dueError = dueDate && dueDate < todayIso() ? 'Due date cannot be in the past.' : '';

  function addLabel() {
    const value = labelDraft.trim();
    if (!value || labels.includes(value)) {
      setLabelDraft('');
      return;
    }
    setLabels((prev) => [...prev, value].slice(0, 20));
    setLabelDraft('');
  }

  function onLabelKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addLabel();
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (titleError || estimateError || rangeError || dueError || busy) return;
    const member = members.find((m) => m.id === assigneeId);
    setBusy(true);
    try {
      await createTask({
        projectId,
        title: title.trim(),
        description: description.trim(),
        type,
        priority,
        estimateHours: Number.isFinite(estimateValue) ? estimateValue : 0,
        assigneeName: member?.name ?? 'Unassigned',
        assigneeId: member?.id ?? '',
        startDate,
        endDate,
        dueDate,
        labels,
        status: status || undefined,
        teamId: teams.length > 0 ? teamId || null : null,
        sprintId: selectedSprintId || null,
      });
      onClose();
    } finally {
      setBusy(false);
    }
  }

  const invalid = (show: boolean) =>
    show ? 'border-[#ed4245]/70 focus:border-[#ed4245]' : undefined;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/55 p-4">
      <button type="button" className="absolute inset-0" onClick={onClose} aria-label="Close" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-task-title"
        className="relative z-10 flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-ink-600 bg-ink-800 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="shrink-0 border-b border-ink-600 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold tracking-wide text-ink-300 uppercase">
                {project?.key ?? 'Project'}
              </p>
              <h2 id="create-task-title" className="mt-0.5 text-xl font-bold text-ink-50">
                Create task
              </h2>
              <p className="mt-1 text-sm font-medium text-ink-200">
                Assign it now and it shows up on My Work for that person.
              </p>
            </div>
            <Button type="button" variant="secondary" size="xs" onClick={onClose}>
              Close
            </Button>
          </div>
        </header>

        <form onSubmit={(e) => void onSubmit(e)} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
            <section>
              <FieldLabel htmlFor="title" required>
                Title
              </FieldLabel>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What needs to be done?"
                required
                autoFocus
                aria-invalid={submitted && Boolean(titleError)}
                className={cn('rounded-lg', invalid(submitted && Boolean(titleError)))}
              />
              <FieldError>{submitted ? titleError : null}</FieldError>
            </section>

            <section>
              <FieldLabel htmlFor="desc" optional>
                Description
              </FieldLabel>
              <textarea
                id="desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 text-sm font-medium text-ink-50 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none"
                placeholder="Details, steps, acceptance criteria"
              />
            </section>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <FieldLabel required>Type</FieldLabel>
                <Select
                  size="md"
                  value={type}
                  onChange={(v) => setType(v as TaskType)}
                  options={TASK_TYPES.map((t) => ({ value: t.id, label: t.label }))}
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
                />
              </div>
              <div>
                <FieldLabel required>Status</FieldLabel>
                <Select
                  size="md"
                  value={status}
                  onChange={setStatus}
                  options={columns.map((c) => ({ value: c.id, label: c.label }))}
                  aria-label="Status"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <FieldLabel htmlFor="estimate" optional>
                  Estimate (hours)
                </FieldLabel>
                <Input
                  id="estimate"
                  type="number"
                  min={0}
                  max={1000}
                  step={0.5}
                  value={estimateHours}
                  onChange={(e) => setEstimateHours(e.target.value)}
                  className={cn('rounded-lg', invalid(Boolean(estimateError)))}
                />
                <FieldError>{estimateError}</FieldError>
              </div>
              <div>
                <FieldLabel optional>Due date</FieldLabel>
                <DatePicker
                  size="md"
                  value={dueDate}
                  onChange={setDueDate}
                  className={invalid(Boolean(dueError))}
                />
                <FieldError>{dueError}</FieldError>
              </div>
              <div>
                <FieldLabel optional>Start date</FieldLabel>
                <DatePicker size="md" value={startDate} onChange={setStartDate} />
              </div>
              <div>
                <FieldLabel optional>End date</FieldLabel>
                <DatePicker
                  size="md"
                  value={endDate}
                  onChange={setEndDate}
                  className={invalid(Boolean(rangeError))}
                />
                <FieldError>{rangeError}</FieldError>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <FieldLabel optional>Assigned to</FieldLabel>
                <Select
                  size="md"
                  value={assigneeId}
                  onChange={setAssigneeId}
                  options={[
                    { value: '', label: 'Unassigned' },
                    ...members.map((m) => ({
                      value: m.id,
                      label:
                        user && m.email.toLowerCase() === user.email.toLowerCase()
                          ? `${m.name} (you)`
                          : m.name,
                    })),
                  ]}
                  aria-label="Assigned to"
                />
              </div>
              {sprints.length > 0 ? (
                <div>
                  <FieldLabel optional>Sprint</FieldLabel>
                  <Select
                    size="md"
                    value={selectedSprintId}
                    onChange={setSelectedSprintId}
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
                    size="md"
                    value={teamId}
                    onChange={setTeamId}
                    options={[
                      { value: '', label: 'No group' },
                      ...teams.map((t) => ({ value: t.id, label: t.name })),
                    ]}
                  />
                </div>
              ) : null}
            </div>

            <section>
              <FieldLabel htmlFor="label-draft" optional>
                Labels
              </FieldLabel>
              {labels.length > 0 ? (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {labels.map((label) => (
                    <Tooltip key={label} label="Remove label" side="top">
                    <button
                      type="button"
                      aria-label={`Remove ${label}`}
                      onClick={() => setLabels((prev) => prev.filter((item) => item !== label))}
                      className="rounded-full bg-ink-700 px-2.5 py-0.5 text-[11px] font-semibold text-ink-200 hover:bg-ink-600"
                    >
                      {label} x
                    </button>
                    </Tooltip>
                  ))}
                </div>
              ) : null}
              <div className="flex gap-1.5">
                <Input
                  id="label-draft"
                  value={labelDraft}
                  onChange={(e) => setLabelDraft(e.target.value)}
                  onKeyDown={onLabelKey}
                  placeholder="Add a label"
                  className="h-9 rounded-lg text-xs"
                />
                <Button type="button" size="sm" variant="secondary" onClick={addLabel}>
                  Add
                </Button>
              </div>
            </section>
          </div>

          <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-ink-600 px-5 py-3.5">
            <p className="text-[11px] font-medium text-ink-400">
              <span className="text-[#ed4245]">*</span> Required
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy || (submitted && Boolean(titleError))}>
                {busy ? 'Creating…' : 'Create task'}
              </Button>
            </div>
          </footer>
        </form>
      </div>
    </div>,
    document.body,
  );
}
