import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { useAttendance } from '@/lib/attendance/AttendanceContext';
import { useAuth } from '@/lib/auth/AuthContext';
import { useWorkspace } from '@/lib/workspace/WorkspaceContext';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function TodayPage() {
  const { user } = useAuth();
  const { projects } = useWorkspace();
  const { checkedIn, onBreak, checkInAt, checkIn, checkOut, toggleBreak } = useAttendance();
  const firstName = user?.name.split(' ')[0] ?? 'there';

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-3xl font-semibold text-ink-50">
        {greeting()}, {firstName}
      </h1>
      <p className="mt-2 text-sm font-medium text-ink-200">
        Check in / out, then open projects and boards.
      </p>

      <section className="mt-8 rounded-2xl border border-ink-500 bg-ink-800 p-6">
        <p className="text-xs font-bold tracking-wide text-ink-200 uppercase">Attendance</p>
        <p className="mt-2 text-2xl font-bold text-ink-50">
          {!checkedIn
            ? 'Not checked in'
            : onBreak
              ? `On break · since ${checkInAt}`
              : `Checked in · ${checkInAt}`}
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          {!checkedIn ? (
            <Button size="lg" onClick={checkIn}>
              Check in
            </Button>
          ) : (
            <>
              <Button size="lg" variant="secondary" onClick={toggleBreak}>
                {onBreak ? 'End break' : 'Break'}
              </Button>
              <Button size="lg" variant="danger" onClick={checkOut}>
                Check out
              </Button>
            </>
          )}
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-ink-500 bg-ink-800 p-5">
        <h2 className="text-base font-bold text-ink-50">Projects</h2>
        <p className="mt-1 text-sm font-medium text-ink-200">
          {projects.length === 0
            ? 'Create a project, add members, then use the board.'
            : `${projects.length} project${projects.length === 1 ? '' : 's'} ready.`}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link to="/projects">
            <Button variant="secondary">
              {projects.length === 0 ? 'Create project' : 'All projects'}
            </Button>
          </Link>
          {projects[0] ? (
            <Link to={`/projects/${projects[0].id}/board`}>
              <Button>Open {projects[0].key} board</Button>
            </Link>
          ) : null}
        </div>
      </section>
    </div>
  );
}
