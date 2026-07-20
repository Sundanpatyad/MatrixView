import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { mockAudit } from '@/data/mockAudit';

export function AuditPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink-900">Audit logs</h1>
        <p className="mt-2 text-sm text-ink-500">
          Login events, permission changes, and attendance edits.
        </p>
      </div>

      <div className="mt-8">
        <Table>
          <THead>
            <TR>
              <TH>When</TH>
              <TH>Actor</TH>
              <TH>Action</TH>
              <TH>Target</TH>
              <TH>IP</TH>
            </TR>
          </THead>
          <TBody>
            {mockAudit.map((event) => (
              <TR key={event.id}>
                <TD className="whitespace-nowrap text-ink-500">{event.at}</TD>
                <TD className="font-semibold">{event.actor}</TD>
                <TD>{event.action}</TD>
                <TD>{event.target}</TD>
                <TD className="text-ink-500">{event.ip}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>
    </div>
  );
}
