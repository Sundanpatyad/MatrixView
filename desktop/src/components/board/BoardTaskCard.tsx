import { useRef } from 'react';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { TASK_TYPES, type BoardTask } from '@/lib/workspace/types';
import { cn } from '@/lib/cn';

const priorityStyles: Record<string, string> = {
  lowest: 'text-ink-400',
  low: 'text-[#3ba55d]',
  medium: 'text-[#f0b232]',
  high: 'text-[#ed4245]',
  highest: 'text-[#ed4245]',
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
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      }}
      onClick={() => {
        if (draggedRef.current) return;
        onOpen();
      }}
      className={cn(
        'select-none rounded-md border border-ink-600 bg-ink-800 p-2.5 transition-colors',
        'cursor-grab hover:border-ink-500 active:cursor-grabbing',
        dragging && 'opacity-40 ring-2 ring-brand-500/35',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={cn(
            'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-white uppercase',
            typeMeta?.color ?? 'bg-ink-700',
          )}
        >
          {typeMeta?.label ?? task.type}
        </span>
        <span className="text-[11px] font-medium tabular-nums text-ink-400">{task.key}</span>
      </div>

      <p className="mt-2 text-[13px] font-medium text-ink-50">{task.title}</p>

      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-ink-700/70 pt-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <UserAvatar
            name={task.assigneeName || 'Unassigned'}
            src={avatarUrl}
            seed={task.assigneeName || task.id}
            size="xs"
          />
          <span className="truncate text-[11px] font-medium text-ink-300">
            {task.assigneeName || 'Unassigned'}
          </span>
        </div>
        <span
          className={cn(
            'shrink-0 text-[11px] font-semibold capitalize',
            priorityStyles[task.priority],
          )}
        >
          {task.priority}
        </span>
      </div>
    </article>
  );
}
