import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { IconCheck, IconX } from '@/components/ui/Icons';
import { cn } from '@/lib/cn';
import { useWorkspace } from '@/lib/workspace/WorkspaceContext';

const DISMISS_KEY = 'dockx.onboarding.dismissed';

type Props = {
  onCreateProject?: () => void;
  onInvite?: () => void;
  onCreateTask?: () => void;
};

function readDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

export function OnboardingChecklist({ onCreateProject, onInvite, onCreateTask }: Props) {
  const navigate = useNavigate();
  const { projects, tasks } = useWorkspace();
  const [dismissed, setDismissed] = useState(readDismissed);

  const steps = useMemo(() => {
    const hasProject = projects.length > 0;
    const hasInvite = projects.some(
      (p) =>
        p.members.some((m) => m.status === 'pending') ||
        p.members.filter((m) => m.status !== 'pending').length > 1,
    );
    const hasTask = tasks.length > 0;
    const hasMoved = tasks.some((t) => t.status !== 'todo');
    return [
      {
        id: 'project',
        title: 'Create a project',
        done: hasProject,
        action: onCreateProject
          ? { label: 'Create', onClick: onCreateProject }
          : { label: 'Create', onClick: () => navigate('/board') },
      },
      {
        id: 'invite',
        title: 'Invite someone',
        done: hasInvite,
        action:
          hasProject && onInvite
            ? { label: 'Invite', onClick: onInvite }
            : { label: 'Board', onClick: () => navigate('/board') },
      },
      {
        id: 'task',
        title: 'Create a task',
        done: hasTask,
        action:
          hasProject && onCreateTask
            ? { label: 'New task', onClick: onCreateTask }
            : { label: 'Board', onClick: () => navigate('/board') },
      },
      {
        id: 'move',
        title: 'Move a task on the board',
        done: hasMoved,
        action: { label: 'Open board', onClick: () => navigate('/board') },
      },
    ];
  }, [projects, tasks, navigate, onCreateProject, onInvite, onCreateTask]);

  const remaining = steps.filter((s) => !s.done).length;
  const allDone = remaining === 0;

  if (dismissed || allDone) return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
    setDismissed(true);
  }

  return (
    <section className="rounded-xl border border-ink-600 bg-ink-800 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink-50">Get started</p>
          <p className="mt-0.5 text-xs text-ink-400">
            {remaining} step{remaining === 1 ? '' : 's'} left — then DockX is ready for daily work.
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="rounded-md p-1 text-ink-400 hover:bg-ink-700 hover:text-ink-100"
          aria-label="Dismiss setup"
        >
          <IconX className="h-4 w-4" />
        </button>
      </div>
      <ol className="mt-3 space-y-1.5">
        {steps.map((step, i) => (
          <li
            key={step.id}
            className="flex items-center gap-2.5 rounded-lg px-1 py-1.5"
          >
            <span
              className={cn(
                'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                step.done
                  ? 'bg-[#23a559] text-white'
                  : 'border border-ink-500 text-ink-400',
              )}
            >
              {step.done ? <IconCheck className="h-3 w-3" /> : i + 1}
            </span>
            <span
              className={cn(
                'min-w-0 flex-1 text-[13px]',
                step.done ? 'text-ink-400 line-through' : 'font-medium text-ink-100',
              )}
            >
              {step.title}
            </span>
            {!step.done ? (
              <Button type="button" size="xs" variant="secondary" onClick={step.action.onClick}>
                {step.action.label}
              </Button>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
