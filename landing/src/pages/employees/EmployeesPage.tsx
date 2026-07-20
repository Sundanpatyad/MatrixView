import { useMemo, useState, type FormEvent } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { mockEmployees, type EmployeeStatus } from '@/data/mockEmployees';

const statusTone: Record<
  EmployeeStatus,
  'success' | 'brand' | 'warning' | 'neutral'
> = {
  active: 'success',
  invited: 'brand',
  on_leave: 'warning',
  deactivated: 'neutral',
};

const statusLabel: Record<EmployeeStatus, string> = {
  active: 'Active',
  invited: 'Invited',
  on_leave: 'On leave',
  deactivated: 'Deactivated',
};

export function EmployeesPage() {
  const [query, setQuery] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('Employee');
  const [toast, setToast] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return mockEmployees;
    return mockEmployees.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        e.department.toLowerCase().includes(q) ||
        e.team.toLowerCase().includes(q) ||
        e.role.toLowerCase().includes(q),
    );
  }, [query]);

  function onInvite(e: FormEvent) {
    e.preventDefault();
    setToast(`Invite sent to ${inviteEmail} (mock)`);
    setShowInvite(false);
    setInviteName('');
    setInviteEmail('');
    setInviteRole('Employee');
    window.setTimeout(() => setToast(''), 3000);
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-ink-900">Employees</h1>
          <p className="mt-2 text-sm text-ink-500">
            Directory for who works here, in what capacity, reporting to whom.
          </p>
        </div>
        <Button onClick={() => setShowInvite(true)}>Invite employee</Button>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="w-full max-w-sm">
          <Input
            placeholder="Search name, email, department…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search employees"
          />
        </div>
        <p className="text-sm text-ink-500">
          {filtered.length} of {mockEmployees.length}
        </p>
      </div>

      {toast ? (
        <p className="mt-4 rounded-lg bg-brand-50 px-3 py-2 text-sm font-medium text-brand-800">
          {toast}
        </p>
      ) : null}

      <div className="mt-6">
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-ink-300 bg-white px-6 py-16 text-center">
            <p className="font-semibold text-ink-800">No employees match</p>
            <p className="mt-1 text-sm text-ink-500">Try another search or invite someone new.</p>
          </div>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Name</TH>
                <TH>Role</TH>
                <TH>Department</TH>
                <TH>Team</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {filtered.map((employee) => (
                <TR key={employee.id}>
                  <TD>
                    <div>
                      <p className="font-semibold text-ink-900">{employee.name}</p>
                      <p className="text-xs text-ink-500">{employee.email}</p>
                    </div>
                  </TD>
                  <TD>{employee.role}</TD>
                  <TD>{employee.department}</TD>
                  <TD>{employee.team}</TD>
                  <TD>
                    <Badge tone={statusTone[employee.status]}>
                      {statusLabel[employee.status]}
                    </Badge>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </div>

      {showInvite ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="invite-title"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
          >
            <h2 id="invite-title" className="font-display text-2xl font-semibold text-ink-900">
              Invite employee
            </h2>
            <p className="mt-1 text-sm text-ink-500">
              They&apos;ll receive an email to set a password and join.
            </p>
            <form onSubmit={onInvite} className="mt-6 space-y-4">
              <FormField label="Full name" htmlFor="inviteName">
                <Input
                  id="inviteName"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  required
                />
              </FormField>
              <FormField label="Work email" htmlFor="inviteEmail">
                <Input
                  id="inviteEmail"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                />
              </FormField>
              <FormField label="Role" htmlFor="inviteRole">
                <Input
                  id="inviteRole"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  required
                />
              </FormField>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={() => setShowInvite(false)}>
                  Cancel
                </Button>
                <Button type="submit">Send invite</Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
