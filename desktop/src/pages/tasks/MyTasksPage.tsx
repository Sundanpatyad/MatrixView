import { Button } from '@/components/ui/Button';
import { myTasks } from '@/data/mockTasks';
import { useAttendance } from '@/lib/attendance/AttendanceContext';
import { cn } from '@/lib/cn';

export function MyTasksPage() {
  const { activeTaskId, setActiveTask, checkedIn } = useAttendance();

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-3xl font-semibold text-ink-50">My tasks</h1>
      <p className="mt-2 text-sm text-ink-300">
        Execute work here. Full authoring stays on the web portal.
      </p>

      <div className="mt-8 space-y-2">
        {myTasks.map((task) => {
          const active = task.id === activeTaskId;
          return (
            <article
              key={task.id}
              className={cn(
                'rounded-xl border bg-ink-800 p-4',
                active ? 'border-brand-300' : 'border-ink-600',
                task.status === 'done' && 'opacity-60',
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-ink-50">{task.title}</p>
                  <p className="mt-1 text-xs text-ink-300">
                    {task.project} · {task.priority} · Due {task.due}
                  </p>
                </div>
                {task.status !== 'done' ? (
                  <Button
                    size="sm"
                    variant={active ? 'secondary' : 'primary'}
                    disabled={!checkedIn}
                    onClick={() => setActiveTask(active ? null : task.id)}
                  >
                    {active ? 'Pause' : 'Start'}
                  </Button>
                ) : (
                  <span className="text-xs font-semibold text-ink-300">Done</span>
                )}
              </div>
            </article>
          );
        })}
      </div>
      {!checkedIn ? (
        <p className="mt-4 text-xs text-ink-300">Check in on Today to start tracking a task.</p>
      ) : null}
    </div>
  );
}
