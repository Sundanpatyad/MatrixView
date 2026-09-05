import { useMemo, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/Button';
import { DatePicker } from '@/components/ui/DatePicker';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/lib/toast/ToastContext';
import { useWorkspace } from '@/lib/workspace/WorkspaceContext';

type PhaseDraft = { key: string; name: string; startDate: string; endDate: string };

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(iso: string, days: number) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, (m ?? 1) - 1, (d ?? 1) + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function addMonths(iso: string, months: number) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, (m ?? 1) - 1 + months, d ?? 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function statusLabel(status: string) {
  if (status === 'active') return 'Active';
  if (status === 'done') return 'Done';
  return 'Planned';
}

type Props = {
  projectId: string;
  onClose: () => void;
  onOpenSprint?: (sprintId: string) => void;
};

export function PlanSprintsModal({ projectId, onClose, onOpenSprint }: Props) {
  const toast = useToast();
  const {
    getProjectPhases,
    getProjectSprints,
    createPhases,
    startPhase,
    completePhase,
    createSprint,
    startSprint,
    extendSprint,
    completeSprint,
  } = useWorkspace();

  const phases = getProjectPhases(projectId);
  const sprints = getProjectSprints(projectId);

  const [tab, setTab] = useState<'sprints' | 'phases'>('sprints');
  const [busy, setBusy] = useState(false);
  const [extendId, setExtendId] = useState<string | null>(null);
  const [extendDate, setExtendDate] = useState('');

  const [sprintName, setSprintName] = useState('');
  const [sprintPhaseId, setSprintPhaseId] = useState('none');
  const [startDate, setStartDate] = useState(todayIso());
  const [endDate, setEndDate] = useState(addDays(todayIso(), 13));

  const [phaseRows, setPhaseRows] = useState<PhaseDraft[]>([
    { key: 'p1', name: '', startDate: '', endDate: '' },
  ]);

  const phaseOptions = useMemo(
    () => [
      { value: 'none', label: 'No phase' },
      ...phases.filter((p) => p.status !== 'done').map((p) => ({ value: p.id, label: p.name })),
    ],
    [phases],
  );

  function applyDuration(kind: 'week' | 'two' | 'month') {
    const start = startDate || todayIso();
    setStartDate(start);
    if (kind === 'week') setEndDate(addDays(start, 6));
    else if (kind === 'two') setEndDate(addDays(start, 13));
    else setEndDate(addMonths(start, 1));
  }

  async function onCreateSprint(e: FormEvent) {
    e.preventDefault();
    if (!sprintName.trim() || busy) return;
    setBusy(true);
    try {
      const sprint = await createSprint(projectId, {
        name: sprintName.trim(),
        phaseId: sprintPhaseId === 'none' ? null : sprintPhaseId,
        startDate,
        endDate,
      });
      setSprintName('');
      toast.success('Sprint created');
      if (sprint) onOpenSprint?.(sprint.id);
    } catch (err) {
      toast.fromError(err, 'Could not create the sprint.');
    } finally {
      setBusy(false);
    }
  }

  async function onCreatePhases(e: FormEvent) {
    e.preventDefault();
    const rows = phaseRows
      .map((row) => ({
        name: row.name.trim(),
        startDate: row.startDate || undefined,
        endDate: row.endDate || undefined,
      }))
      .filter((row) => row.name);
    if (rows.length === 0 || busy) return;
    setBusy(true);
    try {
      await createPhases(projectId, rows);
      setPhaseRows([{ key: 'p1', name: '', startDate: '', endDate: '' }]);
      toast.success(rows.length === 1 ? 'Phase created' : 'Phases created');
    } catch (err) {
      toast.fromError(err, 'Could not create phases.');
    } finally {
      setBusy(false);
    }
  }

  async function run(label: string, fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      toast.fromError(err, `Could not ${label}.`);
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div className="dockx-modal-layer fixed inset-0 z-[9999] flex items-center justify-center bg-black/55 p-4">
      <button type="button" className="absolute inset-0" onClick={onClose} aria-label="Close" />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 flex max-h-[min(90vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-ink-600 bg-ink-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-ink-600 px-5 py-3">
          <div>
            <h2 className="text-base font-semibold text-ink-50">Plan</h2>
            <p className="text-[11px] text-ink-400">Phases are optional. Each sprint is its own board.</p>
          </div>
          <div className="flex rounded-md border border-ink-600 p-0.5">
            {(['sprints', 'phases'] as const).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={
                  tab === id
                    ? 'rounded px-2.5 py-1 text-[11px] font-semibold bg-brand-500 text-[#062816]'
                    : 'rounded px-2.5 py-1 text-[11px] font-semibold text-ink-300 hover:text-ink-50'
                }
              >
                {id === 'sprints' ? 'Sprints' : 'Phases'}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {tab === 'sprints' ? (
            <div className="space-y-4">
              <form onSubmit={(e) => void onCreateSprint(e)} className="space-y-2.5 rounded-lg border border-ink-600 p-3">
                <p className="text-xs font-semibold text-ink-50">New sprint</p>
                <Input
                  value={sprintName}
                  onChange={(e) => setSprintName(e.target.value)}
                  placeholder="Sprint name"
                />
                <Select
                  size="sm"
                  value={sprintPhaseId}
                  onChange={(v) => setSprintPhaseId(v as string)}
                  options={phaseOptions}
                  aria-label="Phase"
                />
                <div className="flex flex-wrap gap-1.5">
                  <Button type="button" size="xs" variant="secondary" onClick={() => applyDuration('week')}>
                    1 week
                  </Button>
                  <Button type="button" size="xs" variant="secondary" onClick={() => applyDuration('two')}>
                    2 weeks
                  </Button>
                  <Button type="button" size="xs" variant="secondary" onClick={() => applyDuration('month')}>
                    1 month
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-ink-400">Start</p>
                    <DatePicker size="sm" value={startDate} onChange={setStartDate} />
                  </div>
                  <div>
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-ink-400">End</p>
                    <DatePicker size="sm" value={endDate} onChange={setEndDate} />
                  </div>
                </div>
                <Button type="submit" size="sm" disabled={busy || !sprintName.trim()} className="w-full">
                  Create sprint
                </Button>
              </form>

              <ul className="space-y-2">
                {sprints.length === 0 ? (
                  <p className="py-4 text-center text-xs text-ink-400">No sprints yet. Work stays on Backlog until you create one.</p>
                ) : (
                  sprints.map((sprint) => {
                    const phase = phases.find((p) => p.id === sprint.phaseId);
                    return (
                      <li key={sprint.id} className="rounded-lg border border-ink-600 px-3 py-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-ink-50">{sprint.name}</p>
                            <p className="text-[11px] text-ink-400">
                              {sprint.startDate} → {sprint.endDate}
                              {phase ? ` · ${phase.name}` : ''} · {statusLabel(sprint.status)}
                            </p>
                          </div>
                          <button
                            type="button"
                            className="shrink-0 text-[11px] font-semibold text-brand-300 hover:underline"
                            onClick={() => onOpenSprint?.(sprint.id)}
                          >
                            Open
                          </button>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {sprint.status === 'planned' ? (
                            <Button
                              size="xs"
                              variant="secondary"
                              disabled={busy}
                              onClick={() => void run('start the sprint', () => startSprint(projectId, sprint.id))}
                            >
                              Start
                            </Button>
                          ) : null}
                          {sprint.status !== 'done' ? (
                            <>
                              {extendId === sprint.id ? (
                                <div className="flex items-center gap-1.5">
                                  <DatePicker size="xs" value={extendDate} onChange={setExtendDate} />
                                  <Button
                                    size="xs"
                                    disabled={busy || !extendDate}
                                    onClick={() =>
                                      void run('extend the sprint', async () => {
                                        await extendSprint(projectId, sprint.id, extendDate);
                                        setExtendId(null);
                                      })
                                    }
                                  >
                                    Save
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  size="xs"
                                  variant="secondary"
                                  disabled={busy}
                                  onClick={() => {
                                    setExtendId(sprint.id);
                                    setExtendDate(addDays(sprint.endDate, 7));
                                  }}
                                >
                                  Extend
                                </Button>
                              )}
                              <Button
                                size="xs"
                                variant="danger"
                                disabled={busy}
                                onClick={() => void run('complete the sprint', () => completeSprint(projectId, sprint.id))}
                              >
                                Complete
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </li>
                    );
                  })
                )}
              </ul>
            </div>
          ) : (
            <div className="space-y-4">
              <form onSubmit={(e) => void onCreatePhases(e)} className="space-y-2.5 rounded-lg border border-ink-600 p-3">
                <p className="text-xs font-semibold text-ink-50">New phases</p>
                {phaseRows.map((row, index) => (
                  <div key={row.key} className="space-y-1.5 rounded-md border border-ink-700 p-2">
                    <Input
                      value={row.name}
                      onChange={(e) =>
                        setPhaseRows((prev) =>
                          prev.map((r) => (r.key === row.key ? { ...r, name: e.target.value } : r)),
                        )
                      }
                      placeholder={`Phase ${index + 1} name`}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <DatePicker
                        size="xs"
                        clearable
                        value={row.startDate}
                        onChange={(value) =>
                          setPhaseRows((prev) =>
                            prev.map((r) => (r.key === row.key ? { ...r, startDate: value } : r)),
                          )
                        }
                        placeholder="Start"
                      />
                      <DatePicker
                        size="xs"
                        clearable
                        value={row.endDate}
                        onChange={(value) =>
                          setPhaseRows((prev) =>
                            prev.map((r) => (r.key === row.key ? { ...r, endDate: value } : r)),
                          )
                        }
                        placeholder="End"
                      />
                    </div>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      setPhaseRows((prev) => [
                        ...prev,
                        { key: `p${prev.length + 1}-${Date.now()}`, name: '', startDate: '', endDate: '' },
                      ])
                    }
                  >
                    Add another
                  </Button>
                  <Button type="submit" size="sm" disabled={busy} className="flex-1">
                    Create phases
                  </Button>
                </div>
              </form>

              <ul className="space-y-2">
                {phases.length === 0 ? (
                  <p className="py-4 text-center text-xs text-ink-400">No phases. Sprints can live on the project without one.</p>
                ) : (
                  phases.map((phase) => (
                    <li key={phase.id} className="rounded-lg border border-ink-600 px-3 py-2">
                      <p className="text-sm font-semibold text-ink-50">{phase.name}</p>
                      <p className="text-[11px] text-ink-400">
                        {phase.startDate || phase.endDate
                          ? `${phase.startDate || '—'} → ${phase.endDate || '—'}`
                          : 'No dates'}{' '}
                        · {statusLabel(phase.status)} · {sprints.filter((s) => s.phaseId === phase.id).length} sprints
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {phase.status === 'planned' ? (
                          <Button
                            size="xs"
                            variant="secondary"
                            disabled={busy}
                            onClick={() => void run('start the phase', () => startPhase(projectId, phase.id))}
                          >
                            Start
                          </Button>
                        ) : null}
                        {phase.status !== 'done' ? (
                          <Button
                            size="xs"
                            variant="danger"
                            disabled={busy}
                            onClick={() => void run('complete the phase', () => completePhase(projectId, phase.id))}
                          >
                            Complete
                          </Button>
                        ) : null}
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>
          )}
        </div>

        <div className="border-t border-ink-600 px-5 py-3">
          <Button size="sm" variant="secondary" className="w-full" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
