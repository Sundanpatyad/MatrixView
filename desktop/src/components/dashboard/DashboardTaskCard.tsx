import { useRef, type DragEvent } from 'react';
import { UserAvatar, presenceUserIdFromMembers } from '@/components/ui/UserAvatar';
import { IconTrash } from '@/components/ui/Icons';
import { Tooltip } from '@/components/ui/Tooltip';
import { TASK_TYPES, type BoardTask } from '@/lib/workspace/types';
import { cn } from '@/lib/cn';
import { useWorkspace } from '@/lib/workspace/WorkspaceContext';

const typeChip: Record<string, string> = {
  task: 'bg-[#00a8fc]/12 text-[#00a8fc]',
  bug: 'bg-[#ed4245]/12 text-[#ed4245]',
  story: 'bg-[#23a559]/15 text-[#3ba55d]',
  time: 'bg-[#f0b232]/15 text-[#f0b232]',
};

const priorityChip: Record<string, string> = {
  lowest: 'bg-ink-700/80 text-ink-400',
  low: 'bg-[#3ba55d]/12 text-[#3ba55d]',
  medium: 'bg-[#f0b232]/15 text-[#f0b232]',
  high: 'bg-[#ed4245]/12 text-[#ed4245]',
  highest: 'bg-[#ed4245]/18 text-[#ff6b6e]',
};

function visibleDescription(description: string | undefined | null): string | null {
  if (!description?.trim()) return null;
  const d = description.trim();
  if (d.includes('[seed-dummy]') || /^Dummy task\b/i.test(d)) return null;
  return d;
}

type Props = {
  task: BoardTask;
  avatarUrl?: string | null;
  teamName?: string | null;
  dragging?: boolean;
  onOpen: () => void;
  onDelete?: () => void;
  onDragStart: (taskId: string) => void;
  onDragEnd: () => void;
  onDropOnCard?: (e: DragEvent) => void;
};

export function DashboardTaskCard({
  task,
  avatarUrl,
  teamName,
  dragging,
  onOpen,
  onDelete,
  onDragStart,
  onDragEnd,
  onDropOnCard,
}: Props) {
  const typeMeta = TASK_TYPES.find((t) => t.id === task.type);
  const draggedRef = useRef(false);
  const { getProject } = useWorkspace();
  const presenceUserId = presenceUserIdFromMembers(
    getProject(task.projectId)?.members ?? [],
    task.assigneeId,
  );
  const description = visibleDescription(task.description);

  return (
    <article
      draggable
      onDragStart={(e) => {
        draggedRef.current = false;
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
        'group cursor-grab select-none rounded-xl border border-ink-600/70 bg-ink-800 p-3',
        'shadow-[0_1px_0_rgba(255,255,255,0.03)]',
        'transition-[border-color,background-color,box-shadow,opacity] duration-150',
        'hover:border-ink-500 hover:bg-ink-800/95 hover:shadow-[0_8px_20px_rgba(0,0,0,0.18)]',
        'active:cursor-grabbing',
        dragging && 'opacity-40 ring-2 ring-brand-500/35',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            'inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase',
            typeChip[task.type] ?? 'bg-ink-700 text-ink-300',
          )}
        >
          {typeMeta?.label ?? task.type}
        </span>
        <div className="flex items-center gap-1">
          <span className="text-[11px] font-medium tabular-nums text-ink-500">{task.key}</span>
          {onDelete ? (
            <Tooltip label="Delete task" side="top">
              <button
                type="button"
                aria-label="Delete task"
                draggable={false}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onDelete();
                }}
                className="flex h-6 w-6 items-center justify-center rounded-md text-ink-500 opacity-100 transition hover:bg-[#ed4245]/12 hover:text-[#ed4245] sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
              >
                <IconTrash className="h-3 w-3" />
              </button>
            </Tooltip>
          ) : null}
        </div>
      </div>

      <p className="mt-2 line-clamp-2 text-[13px] leading-snug font-medium text-ink-50">
        {task.title}
      </p>

      {teamName ? (
        <span className="mt-1.5 inline-flex max-w-full truncate rounded-md bg-brand-500/10 px-1.5 py-0.5 text-[10px] font-medium text-brand-300">
          {teamName}
        </span>
      ) : null}

      {description ? (
        <p className="mt-1 line-clamp-1 text-[11px] leading-snug text-ink-400">{description}</p>
      ) : null}

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-ink-700/60 pt-2.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <UserAvatar
            name={task.assigneeName || 'Unassigned'}
            src={avatarUrl}
            seed={task.assigneeName || task.id}
            size="xs"
            userId={presenceUserId}
          />
          <span className="truncate text-[11px] font-medium text-ink-300">
            {task.assigneeName || 'Unassigned'}
          </span>
        </div>
        <span
          className={cn(
            'inline-flex shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold capitalize',
            priorityChip[task.priority] ?? 'bg-ink-700 text-ink-400',
          )}
        >
          {task.priority}
        </span>
      </div>
    </article>
  );
}
