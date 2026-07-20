import { useRef } from 'react';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { TASK_TYPES, type BoardTask } from '@/lib/workspace/types';
import { cn } from '@/lib/cn';

const priorityStyles: Record<string, string> = {
  lowest: 'text-ink-200 bg-ink-700',
  low: 'text-[#18783f] dark:text-[#57f287] bg-[#23a559]/15',
  medium: 'text-[#9a6700] dark:text-[#fee75c] bg-[#f0b232]/15',
  high: 'text-[#c03537] dark:text-[#ed4245] bg-[#ed4245]/15',
  highest: 'text-white bg-[#ed4245]',
};

type Props = {
  task: BoardTask;
  avatarUrl?: string | null;
  dragging?: boolean;
  onOpen: () => void;
  onDragStart: (taskId: string) => void;
  onDragEnd: () => void;
};

export function BoardTaskCard({
  task,
  avatarUrl,
  dragging,
  onOpen,
  onDragStart,
  onDragEnd,
}: Props) {
  const typeMeta = TASK_TYPES.find((t) => t.id === task.type);
  const draggedRef = useRef(false);

  return (
    <article
      draggable
      onDragStart={(e) => {
        draggedRef.current = false;
        // text/plain works in all browsers + Tauri webview; custom types often don't
        e.dataTransfer.setData('text/plain', task.id);
        e.dataTransfer.effectAllowed = 'move';
        onDragStart(task.id);
      }}
      onDrag={() => {
        draggedRef.current = true;
      }}
      onDragEnd={() => {
        onDragEnd();
        window.setTimeout(() => {
          draggedRef.current = false;
        }, 50);
      }}
      onDragOver={(e) => {
        // Allow dropping onto/near cards inside a column
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      }}
      onClick={() => {
        if (draggedRef.current) return;
        onOpen();
      }}
      className={cn(
        'select-none rounded-lg border border-ink-500 bg-ink-800 p-3 shadow-sm transition hover:border-ink-500',
        'cursor-grab active:cursor-grabbing',
        dragging && 'opacity-40 ring-2 ring-brand-600',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={cn(
            'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white',
            typeMeta?.color ?? 'bg-ink-700',
          )}
        >
          {typeMeta?.label ?? task.type}
        </span>
        <span className="text-[10px] font-bold text-ink-200">{task.key}</span>
      </div>

      <p className="mt-2 text-sm font-bold text-ink-50">{task.title}</p>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span
          className={cn(
            'rounded px-1.5 py-0.5 text-[10px] font-bold capitalize',
            priorityStyles[task.priority],
          )}
        >
          {task.priority}
        </span>
        <span className="rounded bg-ink-700 px-1.5 py-0.5 text-[10px] font-bold text-ink-200">
          {task.estimateHours}h est
        </span>
        {task.loggedHours > 0 ? (
          <span className="rounded bg-brand-500/10 px-1.5 py-0.5 text-[10px] font-bold text-brand-600 dark:text-brand-300">
            {task.loggedHours}h logged
          </span>
        ) : null}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-ink-200">{task.assigneeName}</span>
        <UserAvatar
          name={task.assigneeName || 'Unassigned'}
          src={avatarUrl}
          seed={task.assigneeName || task.id}
          size="sm"
        />
      </div>
    </article>
  );
}
