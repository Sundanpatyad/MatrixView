import { useMemo, useState, type DragEvent, type FormEvent } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { BoardTaskCard } from '@/components/board/BoardTaskCard';
import { CreateTaskModal } from '@/components/board/CreateTaskModal';
import { TaskDetailModal } from '@/components/board/TaskDetailModal';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { Input } from '@/components/ui/Input';
import { IconX } from '@/components/ui/Icons';
import { Modal, ModalFooter, ModalHeader } from '@/components/ui/Modal';
import { Tooltip } from '@/components/ui/Tooltip';
import { avatarFromMembers } from '@/components/ui/UserAvatar';
import type { BoardTask, TaskStatus } from '@/lib/workspace/types';
import { useWorkspace } from '@/lib/workspace/WorkspaceContext';
import { cn } from '@/lib/cn';
import { useToast } from '@/lib/toast/ToastContext';

export function ProjectBoardPage() {
  const { projectId = '' } = useParams();
  const toast = useToast();
  const {
    getProject,
    getProjectTasks,
    updateTaskStatus,
    addColumn,
    removeColumn,
    deleteTask,
  } = useWorkspace();
  const project = getProject(projectId);
  const tasks = getProjectTasks(projectId);

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<TaskStatus | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [columnToRemove, setColumnToRemove] = useState<{ id: string; label: string } | null>(
    null,
  );
  const [removingColumn, setRemovingColumn] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<BoardTask | null>(null);
  const [deletingTask, setDeletingTask] = useState(false);

  const columns = project?.columns ?? [];

  const selected = useMemo(
    () => tasks.find((t) => t.id === selectedId) ?? null,
    [tasks, selectedId],
  );

  const byStatus = useMemo(() => {
    const map: Record<string, BoardTask[]> = {};
    for (const col of columns) map[col.id] = [];
    for (const t of tasks) {
      if (!map[t.status]) map[t.status] = [];
      map[t.status].push(t);
    }
    return map;
  }, [tasks, columns]);

  if (!project) {
    return <Navigate to="/projects" replace />;
  }

  function allowDrop(e: DragEvent, status: TaskStatus) {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    if (dropTarget !== status) setDropTarget(status);
  }

  function handleDrop(e: DragEvent, status: TaskStatus) {
    e.preventDefault();
    e.stopPropagation();
    const id =
      e.dataTransfer.getData('text/plain') ||
      e.dataTransfer.getData('text') ||
      draggingId;
    if (id) void updateTaskStatus(id, status);
    setDraggingId(null);
    setDropTarget(null);
  }

  function onAddColumn(e: FormEvent) {
    e.preventDefault();
    if (!newColumnName.trim() || !projectId) return;
    void addColumn(projectId, newColumnName);
    setNewColumnName('');
    setShowAddColumn(false);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-ink-600 bg-ink-800 px-4 py-3 md:px-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-semibold text-ink-200">
            <Link to="/projects" className="hover:text-brand-800">
              Projects
            </Link>
            <span>/</span>
            <Link to={`/projects/${project.id}`} className="hover:text-brand-800">
              {project.key}
            </Link>
            <span>/</span>
            <span className="text-ink-50">Board</span>
          </div>
          <h1 className="truncate text-xl font-bold text-ink-50">{project.name} board</h1>
          <p className="mt-0.5 text-xs font-semibold text-ink-200">
            Click a card for details · Drag between columns · Add custom columns
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-lg bg-ink-700 px-2.5 py-1 text-xs font-bold text-ink-200">
            {tasks.length} issues · {columns.length} columns
          </span>
          <Link to={`/projects/${project.id}`}>
            <Button size="sm" variant="secondary">
              Members
            </Button>
          </Link>
          <Button size="sm" variant="secondary" onClick={() => setShowAddColumn(true)}>
            + Add column
          </Button>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            + Create issue
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden bg-ink-900">
        <div
          className="grid h-full gap-3 p-4"
          style={{
            gridTemplateColumns: `repeat(${Math.max(columns.length, 1)}, minmax(220px, 1fr))`,
            minWidth: '100%',
          }}
        >
          {columns.map((col) => (
            <section
              key={col.id}
              className={cn(
                'flex h-full min-w-0 flex-col rounded-xl border-2 transition',
                dropTarget === col.id
                  ? 'border-brand-500 bg-brand-500/10'
                  : 'border-transparent bg-ink-700/50',
              )}
            >
              <header className="flex items-center gap-2 px-3 py-3">
                <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', col.accent)} />
                <h2 className="min-w-0 flex-1 truncate text-xs font-bold tracking-wide text-ink-100 uppercase">
                  {col.label}
                </h2>
                <span className="rounded bg-ink-800 px-1.5 py-0.5 text-[11px] font-bold text-ink-200">
                  {(byStatus[col.id] ?? []).length}
                </span>
                {columns.length > 1 ? (
                  <Tooltip label="Remove column" side="top">
                  <button
                    type="button"
                    aria-label="Remove column"
                    className="flex h-6 w-6 items-center justify-center rounded-md text-ink-400 hover:bg-ink-800 hover:text-[#ed4245]"
                    onClick={() => setColumnToRemove({ id: col.id, label: col.label })}
                  >
                    <IconX className="h-3.5 w-3.5" />
                  </button>
                  </Tooltip>
                ) : null}
              </header>

              <div
                className="min-h-0 flex-1 space-y-2 overflow-y-auto px-2 pb-3"
                onDragEnter={(e) => allowDrop(e, col.id)}
                onDragOver={(e) => allowDrop(e, col.id)}
                onDrop={(e) => handleDrop(e, col.id)}
              >
                {(byStatus[col.id] ?? []).map((task) => (
                  <BoardTaskCard
                    key={task.id}
                    task={task}
                    avatarUrl={avatarFromMembers(
                      project?.members ?? [],
                      task.assigneeId,
                      task.assigneeName,
                    )}
                    dragging={draggingId === task.id}
                    onOpen={() => setSelectedId(task.id)}
                    onDelete={() => setTaskToDelete(task)}
                    onDragStart={setDraggingId}
                    onDragEnd={() => {
                      setDraggingId(null);
                      setDropTarget(null);
                    }}
                  />
                ))}
                {(byStatus[col.id] ?? []).length === 0 ? (
                  <div className="rounded-lg border border-dashed border-ink-400 px-3 py-10 text-center text-xs font-bold text-ink-200">
                    Drop issues here
                  </div>
                ) : null}
              </div>
            </section>
          ))}
        </div>
      </div>

      {showAddColumn ? (
        <Modal size="sm" labelledBy="add-column-title" onClose={() => setShowAddColumn(false)}>
          <ModalHeader
            titleId="add-column-title"
            title="Add custom column"
            description="Examples: Testing, On Host, Staging, Blocked"
            onClose={() => setShowAddColumn(false)}
          />
          <form onSubmit={onAddColumn} className="flex min-h-0 flex-1 flex-col">
            <div className="space-y-4 px-5 py-4">
              <div>
                <FieldLabel htmlFor="col" required>
                  Column name
                </FieldLabel>
                <Input
                  id="col"
                  value={newColumnName}
                  onChange={(e) => setNewColumnName(e.target.value)}
                  placeholder="Testing"
                  autoFocus
                  required
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {['Testing', 'On Host', 'Staging', 'Blocked', 'QA'].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setNewColumnName(preset)}
                    className="rounded-full border border-ink-500/70 bg-ink-900/70 px-2.5 py-1 text-xs font-semibold text-ink-100 hover:border-brand-500/50"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
            <ModalFooter>
              <Button type="button" variant="secondary" onClick={() => setShowAddColumn(false)}>
                Cancel
              </Button>
              <Button type="submit">Add column</Button>
            </ModalFooter>
          </form>
        </Modal>
      ) : null}

      {showCreate ? (
        <CreateTaskModal projectId={project.id} onClose={() => setShowCreate(false)} />
      ) : null}

      {selected ? (
        <TaskDetailModal
          task={selected}
          projectName={project.name}
          columns={columns}
          onClose={() => setSelectedId(null)}
        />
      ) : null}

      <ConfirmModal
        open={Boolean(taskToDelete)}
        title="Delete task?"
        message={
          taskToDelete
            ? `Delete “${taskToDelete.title}” (${taskToDelete.key})? This can’t be undone.`
            : ''
        }
        confirmLabel="Delete"
        danger
        busy={deletingTask}
        onCancel={() => setTaskToDelete(null)}
        onConfirm={async () => {
          if (!taskToDelete) return;
          setDeletingTask(true);
          try {
            await deleteTask(taskToDelete.id);
            if (selectedId === taskToDelete.id) setSelectedId(null);
            toast.success(`Deleted ${taskToDelete.key}`);
            setTaskToDelete(null);
          } catch (err) {
            toast.fromError(err, 'Could not delete task');
          } finally {
            setDeletingTask(false);
          }
        }}
      />

      <ConfirmModal
        open={Boolean(columnToRemove)}
        title="Remove column?"
        message={
          columnToRemove
            ? `Remove “${columnToRemove.label}”? Issues move to the previous column.`
            : ''
        }
        confirmLabel="Remove"
        danger
        busy={removingColumn}
        onCancel={() => setColumnToRemove(null)}
        onConfirm={async () => {
          if (!columnToRemove) return;
          setRemovingColumn(true);
          try {
            await removeColumn(project.id, columnToRemove.id);
            setColumnToRemove(null);
          } finally {
            setRemovingColumn(false);
          }
        }}
      />
    </div>
  );
}
