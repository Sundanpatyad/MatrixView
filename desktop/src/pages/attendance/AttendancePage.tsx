import { Button } from '@/components/ui/Button';
import { useAttendance } from '@/lib/attendance/AttendanceContext';

const history = [
  { date: 'Jul 19', in: '09:04', out: '—', breakMins: 25, note: 'Today' },
  { date: 'Jul 18', in: '09:01', out: '18:12', breakMins: 45, note: 'On time' },
  { date: 'Jul 17', in: '09:28', out: '18:05', breakMins: 30, note: 'Late' },
];

export function AttendancePage() {
  const { checkedIn, onBreak, checkInAt, checkIn, checkOut, toggleBreak } = useAttendance();

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-3xl font-semibold text-ink-50">Attendance</h1>
      <p className="mt-2 text-sm text-ink-300">
        Check in/out, break, and lunch. Corrections are handled by HR on web.
      </p>

      <div className="mt-8 rounded-2xl border border-ink-600 bg-ink-800 p-5">
        <p className="text-lg font-semibold text-ink-50">
          {!checkedIn
            ? 'You are checked out'
            : onBreak
              ? 'You are on break'
              : `Checked in since ${checkInAt}`}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {!checkedIn ? (
            <Button onClick={checkIn}>Check in</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={toggleBreak}>
                {onBreak ? 'Resume work' : 'Break / lunch'}
              </Button>
              <Button variant="danger" onClick={checkOut}>
                Check out
              </Button>
            </>
          )}
        </div>
      </div>

      <h2 className="mt-10 text-sm font-semibold tracking-wide text-ink-300 uppercase">
        Recent days
      </h2>
      <div className="mt-3 space-y-2">
        {history.map((row) => (
          <div
            key={row.date}
            className="flex items-center justify-between rounded-xl border border-ink-600 bg-ink-800 px-4 py-3"
          >
            <div>
              <p className="text-sm font-semibold text-ink-50">{row.date}</p>
              <p className="text-xs text-ink-300">
                {row.in} – {row.out} · Break {row.breakMins}m
              </p>
            </div>
            <span className="text-xs font-semibold text-ink-200">{row.note}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
