import type { DesktopTask } from '@/data/mockTasks';
import { cn } from '@/lib/cn';

const priorityStyles = {
  low: 'bg-[#23a559]/15 text-[#18783f] dark:text-[#57f287] border border-[#23a559]/25',
  medium: 'bg-[#f0b232]/15 text-[#b77900] dark:text-[#fee75c] border border-[#f0b232]/30',
  high: 'bg-[#ed4245]/15 text-[#c03537] dark:text-[#ed4245] border border-[#ed4245]/30',
} as const;

const barStyles = {
  todo: 'bg-ink-500',
  in_progress: 'bg-amber-600',
  review: 'bg-[#00a8fc]',
  done: 'bg-[#23a559]',
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
        'w-full rounded-2xl border bg-ink-800 p-3.5 text-left shadow-sm transition',
        draggable && 'cursor-grab active:cursor-grabbing',
        active
          ? 'border-brand-700 ring-2 ring-brand-600/30'
          : 'border-ink-500 hover:border-ink-400',
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
          <span className="text-ink-300" title="Drag to move" aria-hidden>
            ⋮⋮
          </span>
        ) : null}
      </div>

      <button type="button" onClick={onSelect} className="mt-2 w-full text-left">
        <p className="text-sm font-bold text-ink-50">{task.title}</p>
        <p className="mt-0.5 text-xs font-medium text-ink-200">{task.subtitle}</p>
      </button>

      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-ink-200">
          <span>
            {task.progressDone}/{task.progressTotal}
          </span>
          <span>{pct}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-ink-700">
          <div
            className={cn('h-full rounded-full', barStyles[task.status])}
            style={{ width: `${Math.max(pct, 4)}%` }}
          />
        </div>
      </div>

      <p className="mt-3 text-[11px] font-semibold text-ink-200">Due: {task.due}</p>

      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex -space-x-1.5">
          {task.assignees.map((a) => (
            <span
              key={a}
              className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-ink-800 bg-brand-500 text-[9px] font-bold text-white"
            >
              {a}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2 text-[11px] font-semibold text-ink-200">
          <span>{task.attachments} files</span>
          <span>{task.comments} notes</span>
        </div>
      </div>
    </article>
  );
}
