import { useRef, type DragEvent } from 'react';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { TASK_TYPES, type BoardTask } from '@/lib/workspace/types';
import { cn } from '@/lib/cn';

const typeChip: Record<string, string> = {
  task: 'bg-sky-50 text-sky-800 ring-sky-100',
  bug: 'bg-red-50 text-red-800 ring-red-100',
  story: 'bg-emerald-50 text-emerald-800 ring-emerald-100',
  time: 'bg-amber-50 text-amber-900 ring-amber-100',
};

const priorityChip: Record<string, string> = {
  lowest: 'bg-ink-50 text-ink-500',
  low: 'bg-emerald-50 text-emerald-700',
  medium: 'bg-amber-50 text-amber-800',
  high: 'bg-orange-50 text-orange-800',
  highest: 'bg-red-50 text-red-800',
};

type Props = {
  task: BoardTask;
  avatarUrl?: string | null;
  dragging?: boolean;
  onOpen: () => void;
  onDragStart: (taskId: string) => void;
  onDragEnd: () => void;
  onDropOnCard?: (e: DragEvent) => void;
};

export function DashboardTaskCard({
  task,
  avatarUrl,
  dragging,
  onOpen,
  onDragStart,
  onDragEnd,
  onDropOnCard,
}: Props) {
  const typeMeta = TASK_TYPES.find((t) => t.id === task.type);
  const draggedRef = useRef(false);
  return (
    <article
      draggable
      onDragStart={(e) => {
        draggedRef.current = false;
        // text/plain is required for reliable DnD in Tauri/WebView
        e.dataTransfer.setData('text/plain', task.id);
        e.dataTransfer.setData('text', task.id);
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
        }, 80);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onDropOnCard?.(e);
      }}
      onClick={() => {
        if (draggedRef.current) return;
        onOpen();
      }}
      className={cn(
        'group cursor-grab select-none rounded-lg border border-ink-200/80 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition',
        'hover:border-ink-300 hover:shadow-[0_4px_12px_rgba(15,23,42,0.07)] active:cursor-grabbing',
        dragging && 'scale-[0.98] opacity-45 shadow-none ring-2 ring-brand-500/30',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            'inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase ring-1 ring-inset',
            typeChip[task.type] ?? 'bg-ink-50 text-ink-600 ring-ink-100',
          )}
        >
          {typeMeta?.label ?? task.type}
        </span>
        <span className="text-[10px] font-semibold text-ink-400">{task.key}</span>
      </div>

      <p className="mt-2 text-[13px] leading-snug font-semibold text-ink-900 group-hover:text-ink-950">
        {task.title}
      </p>

      {task.description ? (
        <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-ink-500">
          {task.description}
        </p>
      ) : null}

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-ink-100 pt-2.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <UserAvatar
            name={task.assigneeName || 'Unassigned'}
            src={avatarUrl}
            seed={task.assigneeName || task.id}
            size="xs"
          />
          <span className="truncate text-[11px] font-medium text-ink-600">{task.assigneeName}</span>
        </div>
        <span
          className={cn(
            'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold capitalize',
            priorityChip[task.priority] ?? 'bg-ink-50 text-ink-500',
          )}
        >
          {task.priority}
        </span>
      </div>
    </article>
  );
}
