import { useMemo, useState, type DragEvent, type FormEvent } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { BoardTaskCard } from '@/components/board/BoardTaskCard';
import { CreateTaskModal } from '@/components/board/CreateTaskModal';
import { TaskDetailModal } from '@/components/board/TaskDetailModal';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Input } from '@/components/ui/Input';
import { avatarFromMembers } from '@/components/ui/UserAvatar';
import type { BoardTask, TaskStatus } from '@/lib/workspace/types';
import { useWorkspace } from '@/lib/workspace/WorkspaceContext';
import { cn } from '@/lib/cn';

export function ProjectBoardPage() {
  const { projectId = '' } = useParams();
  const {
    getProject,
    getProjectTasks,
    updateTaskStatus,
    addColumn,
    removeColumn,
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
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-ink-200 bg-white px-4 py-3 md:px-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-semibold text-ink-600">
            <Link to="/projects" className="hover:text-brand-800">
              Projects
            </Link>
            <span>/</span>
            <Link to={`/projects/${project.id}`} className="hover:text-brand-800">
              {project.key}
            </Link>
            <span>/</span>
            <span className="text-ink-900">Board</span>
          </div>
          <h1 className="truncate text-xl font-bold text-ink-950">{project.name} board</h1>
          <p className="mt-0.5 text-xs font-semibold text-ink-600">
            Click a card for details · Drag between columns · Add custom columns
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-lg bg-ink-100 px-2.5 py-1 text-xs font-bold text-ink-800">
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

      <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden bg-[#EBECF0]">
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
                  ? 'border-brand-600 bg-brand-50'
                  : 'border-transparent bg-[#DFE1E6]/50',
              )}
            >
              <header className="flex items-center gap-2 px-3 py-3">
                <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', col.accent)} />
                <h2 className="min-w-0 flex-1 truncate text-xs font-bold tracking-wide text-ink-800 uppercase">
                  {col.label}
                </h2>
                <span className="rounded bg-white px-1.5 py-0.5 text-[11px] font-bold text-ink-700">
                  {(byStatus[col.id] ?? []).length}
                </span>
                {columns.length > 1 ? (
                  <button
                    type="button"
                    title="Remove column"
                    className="rounded px-1 text-xs font-bold text-ink-500 hover:bg-white hover:text-red-700"
                    onClick={() => setColumnToRemove({ id: col.id, label: col.label })}
                  >
                    ×
                  </button>
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
                    onDragStart={setDraggingId}
                    onDragEnd={() => {
                      setDraggingId(null);
                      setDropTarget(null);
                    }}
                  />
                ))}
                {(byStatus[col.id] ?? []).length === 0 ? (
                  <div className="rounded-lg border border-dashed border-ink-400 px-3 py-10 text-center text-xs font-bold text-ink-600">
                    Drop issues here
                  </div>
                ) : null}
              </div>
            </section>
          ))}
        </div>
      </div>

      {showAddColumn ? (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/55 p-4">
          <button
            type="button"
            className="absolute inset-0"
            onClick={() => setShowAddColumn(false)}
            aria-label="Close"
          />
          <form
            onSubmit={onAddColumn}
            className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-ink-950">Add custom column</h2>
            <p className="mt-1 text-sm font-medium text-ink-600">
              Examples: Testing, On Host, Staging, Blocked
            </p>
            <div className="mt-4">
              <label className="mb-1 block text-xs font-bold text-ink-700 uppercase" htmlFor="col">
                Column name
              </label>
              <Input
                id="col"
                value={newColumnName}
                onChange={(e) => setNewColumnName(e.target.value)}
                placeholder="Testing"
                autoFocus
                required
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {['Testing', 'On Host', 'Staging', 'Blocked', 'QA'].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setNewColumnName(preset)}
                  className="rounded-full border border-ink-300 bg-ink-50 px-2.5 py-1 text-xs font-bold text-ink-800 hover:border-brand-600"
                >
                  {preset}
                </button>
              ))}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setShowAddColumn(false)}>
                Cancel
              </Button>
              <Button type="submit">Add column</Button>
            </div>
          </form>
        </div>
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
