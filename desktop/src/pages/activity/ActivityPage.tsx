export function ActivityPage() {
  const timeline = [
    { time: '15:40', event: 'Active · VS Code · Wire invite email template' },
    { time: '15:12', event: 'Idle · 8 minutes' },
    { time: '14:55', event: 'Active · Chrome · docs.tasktrack.local' },
    { time: '13:30', event: 'Break ended' },
    { time: '12:45', event: 'Break started' },
    { time: '09:04', event: 'Checked in' },
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-3xl font-semibold text-ink-900">My activity</h1>
      <p className="mt-2 text-sm text-ink-500">
        Your signals only — app/window tracking for today. You never see other employees here.
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Active', value: '5h 02m' },
          { label: 'Idle', value: '28m' },
          { label: 'Break', value: '45m' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-ink-200 bg-white px-4 py-3">
            <p className="text-[11px] font-semibold tracking-wide text-ink-500 uppercase">
              {s.label}
            </p>
            <p className="mt-1 font-display text-2xl font-semibold text-ink-900">{s.value}</p>
          </div>
        ))}
      </div>

      <ol className="mt-8 space-y-0 border-l border-ink-200 pl-4">
        {timeline.map((item) => (
          <li key={item.time} className="relative pb-5 last:pb-0">
            <span className="absolute top-1.5 -left-[21px] h-2.5 w-2.5 rounded-full bg-brand-600" />
            <p className="text-xs font-semibold text-ink-500">{item.time}</p>
            <p className="mt-0.5 text-sm text-ink-800">{item.event}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
