import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { mockAttendance, type AttendanceRow } from '@/data/mockAttendance';

const tone: Record<AttendanceRow['status'], 'success' | 'warning' | 'danger' | 'brand'> = {
  present: 'success',
  late: 'warning',
  absent: 'danger',
  remote: 'brand',
};

export function AttendancePage() {
  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-ink-900">Attendance</h1>
          <p className="mt-2 text-sm text-ink-500">
            History and manual corrections. Check-in happens on Desktop.
          </p>
        </div>
        <Button variant="secondary">Export CSV</Button>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Present today', value: '12' },
          { label: 'Late', value: '2' },
          { label: 'Absent / offline', value: '1' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-ink-200 bg-white px-4 py-4">
            <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">
              {stat.label}
            </p>
            <p className="mt-2 font-display text-3xl font-semibold text-ink-900">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <Table>
          <THead>
            <TR>
              <TH>Employee</TH>
              <TH>Date</TH>
              <TH>Check in</TH>
              <TH>Check out</TH>
              <TH>Break</TH>
              <TH>Status</TH>
              <TH>Actions</TH>
            </TR>
          </THead>
          <TBody>
            {mockAttendance.map((row) => (
              <TR key={row.id}>
                <TD className="font-semibold">{row.employee}</TD>
                <TD>{row.date}</TD>
                <TD>{row.checkIn}</TD>
                <TD>{row.checkOut}</TD>
                <TD>{row.breakMins}m</TD>
                <TD>
                  <Badge tone={tone[row.status]}>{row.status}</Badge>
                </TD>
                <TD>
                  <Button size="sm" variant="ghost">
                    Correct
                  </Button>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>
    </div>
  );
}
