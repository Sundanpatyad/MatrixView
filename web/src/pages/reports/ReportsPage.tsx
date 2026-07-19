import { Button } from '@/components/ui/Button';

const reports = [
  {
    title: 'Attendance summary',
    description: 'Present / late / absent by team for the selected range.',
  },
  {
    title: 'Task status',
    description: 'Open vs completed tasks, by project and assignee.',
  },
  {
    title: 'Billable hours (preview)',
    description: 'Time captured from Desktop against project tasks.',
  },
];

export function ReportsPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-ink-900">Reports</h1>
          <p className="mt-2 text-sm text-ink-500">
            Basic MVP reports — attendance and task status.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm">
            Last 7 days
          </Button>
          <Button variant="secondary" size="sm">
            This month
          </Button>
        </div>
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Avg. productive hrs', value: '6.4h' },
          { label: 'Tasks completed', value: '38' },
          { label: 'Attendance rate', value: '94%' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-ink-200 bg-white px-4 py-4">
            <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">
              {stat.label}
            </p>
            <p className="mt-2 font-display text-3xl font-semibold text-ink-900">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 space-y-3">
        {reports.map((report) => (
          <div
            key={report.title}
            className="flex flex-col gap-3 rounded-xl border border-ink-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <h2 className="text-base font-semibold text-ink-900">{report.title}</h2>
              <p className="mt-1 text-sm text-ink-500">{report.description}</p>
            </div>
            <Button variant="secondary" size="sm">
              Generate
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
