import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { cn } from '@/lib/cn';
import {
  kanbanColumns,
  mockTasks,
  type TaskPriority,
  type TaskStatus,
} from '@/data/mockTasks';

const priorityTone: Record<TaskPriority, 'neutral' | 'brand' | 'warning' | 'danger'> = {
  low: 'neutral',
  medium: 'brand',
  high: 'warning',
  urgent: 'danger',
};

export function TasksPage() {
  const [view, setView] = useState<'kanban' | 'list'>('kanban');

  const byStatus = useMemo(() => {
    const map: Record<TaskStatus, typeof mockTasks> = {
      todo: [],
      in_progress: [],
      review: [],
      done: [],
    };
    for (const task of mockTasks) map[task.status].push(task);
    return map;
  }, []);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-ink-900">Tasks</h1>
          <p className="mt-2 text-sm text-ink-500">
            Plan and assign work — Kanban and List views.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={view === 'kanban' ? 'primary' : 'secondary'}
            onClick={() => setView('kanban')}
          >
            Kanban
          </Button>
          <Button
            size="sm"
            variant={view === 'list' ? 'primary' : 'secondary'}
            onClick={() => setView('list')}
          >
            List
          </Button>
          <Button size="sm">New task</Button>
        </div>
      </div>

      {view === 'kanban' ? (
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {kanbanColumns.map((col) => (
            <section key={col.id} className="min-h-[320px] rounded-xl bg-ink-100/70 p-3">
              <h2 className="px-1 text-xs font-semibold tracking-wide text-ink-500 uppercase">
                {col.label}{' '}
                <span className="text-ink-400">({byStatus[col.id].length})</span>
              </h2>
              <div className="mt-3 space-y-2">
                {byStatus[col.id].map((task) => (
                  <article
                    key={task.id}
                    className="rounded-lg border border-ink-200 bg-white p-3 shadow-sm"
                  >
                    <p className="text-sm font-semibold text-ink-900">{task.title}</p>
                    <p className="mt-1 text-xs text-ink-500">{task.project}</p>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <Badge tone={priorityTone[task.priority]}>{task.priority}</Badge>
                      <span className="text-xs text-ink-500">{task.due}</span>
                    </div>
                    <p className="mt-2 text-xs font-medium text-ink-600">{task.assignee}</p>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="mt-8">
          <Table>
            <THead>
              <TR>
                <TH>Task</TH>
                <TH>Project</TH>
                <TH>Assignee</TH>
                <TH>Priority</TH>
                <TH>Status</TH>
                <TH>Due</TH>
              </TR>
            </THead>
            <TBody>
              {mockTasks.map((task) => (
                <TR key={task.id}>
                  <TD className="font-semibold">{task.title}</TD>
                  <TD>{task.project}</TD>
                  <TD>{task.assignee}</TD>
                  <TD>
                    <Badge tone={priorityTone[task.priority]}>{task.priority}</Badge>
                  </TD>
                  <TD>
                    <span className={cn('text-sm capitalize')}>
                      {task.status.replace('_', ' ')}
                    </span>
                  </TD>
                  <TD>{task.due}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}
    </div>
  );
}
