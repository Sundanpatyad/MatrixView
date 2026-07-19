import type { DesktopTask } from '@/data/mockTasks';
import { cn } from '@/lib/cn';

const priorityStyles = {
  low: 'bg-emerald-100 text-emerald-900 border border-emerald-200',
  medium: 'bg-amber-100 text-amber-950 border border-amber-200',
  high: 'bg-red-100 text-red-900 border border-red-200',
} as const;

const barStyles = {
  todo: 'bg-ink-500',
  in_progress: 'bg-amber-600',
  review: 'bg-sky-600',
  done: 'bg-emerald-600',
} as const;

type Props = {
  task: DesktopTask;
  active?: boolean;
  onSelect?: () => void;
  draggable?: boolean;
  onDragStart?: (taskId: string) => void;
  onDragEnd?: () => void;
};

export function TaskCard({
  task,
  active,
  onSelect,
  draggable = false,
  onDragStart,
  onDragEnd,
}: Props) {
  const pct =
    task.progressTotal === 0
      ? 0
      : Math.round((task.progressDone / task.progressTotal) * 100);

  return (
    <article
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/task-id', task.id);
        e.dataTransfer.effectAllowed = 'move';
        onDragStart?.(task.id);
      }}
      onDragEnd={() => onDragEnd?.()}
      className={cn(
        'w-full rounded-2xl border bg-white p-3.5 text-left shadow-sm transition',
        draggable && 'cursor-grab active:cursor-grabbing',
        active
          ? 'border-brand-700 ring-2 ring-brand-600/30'
          : 'border-ink-300 hover:border-ink-400',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={cn(
            'inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold capitalize',
            priorityStyles[task.priority],
          )}
        >
          {task.priority}
        </span>
        {draggable ? (
          <span className="text-ink-500" title="Drag to move" aria-hidden>
            ⋮⋮
          </span>
        ) : null}
      </div>

      <button type="button" onClick={onSelect} className="mt-2 w-full text-left">
        <p className="text-sm font-bold text-ink-950">{task.title}</p>
        <p className="mt-0.5 text-xs font-medium text-ink-600">{task.subtitle}</p>
      </button>

      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-ink-600">
          <span>
            {task.progressDone}/{task.progressTotal}
          </span>
          <span>{pct}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-ink-200">
          <div
            className={cn('h-full rounded-full', barStyles[task.status])}
            style={{ width: `${Math.max(pct, 4)}%` }}
          />
        </div>
      </div>

      <p className="mt-3 text-[11px] font-semibold text-ink-700">Due: {task.due}</p>

      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex -space-x-1.5">
          {task.assignees.map((a) => (
            <span
              key={a}
              className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-brand-700 text-[9px] font-bold text-white"
            >
              {a}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2 text-[11px] font-semibold text-ink-600">
          <span>{task.attachments} files</span>
          <span>{task.comments} notes</span>
        </div>
      </div>
    </article>
  );
}
