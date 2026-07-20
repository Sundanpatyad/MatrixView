import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/lib/auth/AuthContext';

const checklist = [
  {
    title: 'Invite employees',
    description: 'Bring your team into TaskTrack with roles and departments.',
    to: '/employees',
    cta: 'Invite people',
  },
  {
    title: 'Set up organization',
    description: 'Timezone, working hours, departments, and branding.',
    to: '/org',
    cta: 'Open org settings',
  },
  {
    title: 'Create your first project',
    description: 'Add a project, members, and a milestone.',
    to: '/projects',
    cta: 'Go to projects',
  },
];

const shortcuts = [
  { label: 'Tasks board', to: '/tasks' },
  { label: 'Attendance', to: '/attendance' },
  { label: 'Live monitoring', to: '/monitoring' },
  { label: 'Reports', to: '/reports' },
];

export function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="mx-auto max-w-4xl">
      <p className="text-sm font-semibold tracking-wide text-brand-700 uppercase">
        Welcome back
      </p>
      <h1 className="mt-2 font-display text-3xl font-semibold text-ink-900 md:text-4xl">
        {user?.orgName ?? 'Your organization'}
      </h1>
      <p className="mt-3 max-w-2xl text-ink-500">
        Management portal overview — onboard people, structure the org, then run
        work from projects and tasks.
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-4">
        {[
          { label: 'Active today', value: '12' },
          { label: 'Open tasks', value: '27' },
          { label: 'Projects', value: '4' },
          { label: 'Attendance', value: '94%' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-ink-200 bg-white px-4 py-4">
            <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">
              {stat.label}
            </p>
            <p className="mt-2 font-display text-2xl font-semibold text-ink-900">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 space-y-3">
        <h2 className="text-sm font-semibold tracking-wide text-ink-500 uppercase">
          Getting started
        </h2>
        {checklist.map((item) => (
          <div
            key={item.title}
            className="flex flex-col gap-4 rounded-xl border border-ink-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <h3 className="text-base font-semibold text-ink-900">{item.title}</h3>
              <p className="mt-1 text-sm text-ink-500">{item.description}</p>
            </div>
            <Link to={item.to}>
              <Button variant="secondary">{item.cta}</Button>
            </Link>
          </div>
        ))}
      </div>

      <div className="mt-10">
        <h2 className="text-sm font-semibold tracking-wide text-ink-500 uppercase">
          Jump to
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {shortcuts.map((item) => (
            <Link key={item.to} to={item.to}>
              <Button variant="secondary" size="sm">
                {item.label}
              </Button>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
