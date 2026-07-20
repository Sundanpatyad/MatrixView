import { useRef, type DragEvent } from 'react';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { TASK_TYPES, type BoardTask } from '@/lib/workspace/types';
import { cn } from '@/lib/cn';

const typeChip: Record<string, string> = {
  task: 'bg-[#00a8fc]/10 text-[#006fae] dark:text-[#00a8fc] ring-[#00a8fc]/20',
  bug: 'bg-[#ed4245]/10 text-[#c03537] dark:text-[#ed4245] ring-[#ed4245]/20',
  story: 'bg-[#23a559]/15 text-[#18783f] dark:text-[#57f287] ring-[#23a559]/20',
  time: 'bg-[#f0b232]/15 text-[#9a6700] dark:text-[#fee75c] ring-[#f0b232]/20',
};

const priorityChip: Record<string, string> = {
  lowest: 'bg-ink-700 text-ink-300',
  low: 'bg-[#23a559]/15 text-[#18783f] dark:text-[#57f287]',
  medium: 'bg-[#f0b232]/15 text-[#9a6700] dark:text-[#fee75c]',
  high: 'bg-[#ed4245]/10 text-[#c03537] dark:text-[#ed4245]',
  highest: 'bg-[#ed4245]/15 text-[#c03537] dark:text-[#ed4245]',
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
        'group cursor-grab select-none rounded-lg border border-ink-600/80 bg-ink-800 p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition',
        'hover:border-ink-500 hover:shadow-[0_4px_12px_rgba(15,23,42,0.07)] active:cursor-grabbing',
        dragging && 'scale-[0.98] opacity-45 shadow-none ring-2 ring-brand-500/30',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            'inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase ring-1 ring-inset',
            typeChip[task.type] ?? 'bg-ink-900 text-ink-200 ring-ink-100',
          )}
        >
          {typeMeta?.label ?? task.type}
        </span>
        <span className="text-[10px] font-semibold text-ink-400">{task.key}</span>
      </div>

      <p className="mt-2 text-[13px] leading-snug font-semibold text-ink-50 group-hover:text-ink-50">
        {task.title}
      </p>

      {task.description ? (
        <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-ink-300">
          {task.description}
        </p>
      ) : null}

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-ink-700 pt-2.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <UserAvatar
            name={task.assigneeName || 'Unassigned'}
            src={avatarUrl}
            seed={task.assigneeName || task.id}
            size="xs"
          />
          <span className="truncate text-[11px] font-medium text-ink-200">{task.assigneeName}</span>
        </div>
        <span
          className={cn(
            'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold capitalize',
            priorityChip[task.priority] ?? 'bg-ink-900 text-ink-300',
          )}
        >
          {task.priority}
        </span>
      </div>
    </article>
  );
}
