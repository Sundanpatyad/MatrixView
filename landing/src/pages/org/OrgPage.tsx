import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/cn';
import { useAuth } from '@/lib/auth/AuthContext';

const tabs = ['General', 'Structure', 'Policies', 'Branding'] as const;
type Tab = (typeof tabs)[number];

const departments = [
  { name: 'Engineering', teams: ['Platform', 'Product'] },
  { name: 'Design', teams: ['Brand'] },
  { name: 'People', teams: ['HR Ops'] },
];

export function OrgPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('General');
  const [orgName, setOrgName] = useState(user?.orgName ?? 'Acme Studio');
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [hours, setHours] = useState('09:00 – 18:00');
  const [enforce2fa, setEnforce2fa] = useState(false);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-ink-900">Organization</h1>
          <p className="mt-2 text-sm text-ink-500">
            Structure and policies every other module keys off of.
          </p>
        </div>
        <Link to="/org/setup">
          <Button variant="secondary" size="sm">
            Re-run setup wizard
          </Button>
        </Link>
      </div>

      <div className="mt-8 flex gap-2 border-b border-ink-200">
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              'border-b-2 px-3 py-2.5 text-sm font-semibold transition',
              tab === t
                ? 'border-brand-700 text-brand-800'
                : 'border-transparent text-ink-500 hover:text-ink-800',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mt-6 rounded-xl border border-ink-200 bg-white p-6">
        {tab === 'General' && (
          <div className="grid max-w-lg gap-4">
            <FormField label="Organization name" htmlFor="orgName">
              <Input
                id="orgName"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
              />
            </FormField>
            <FormField label="Timezone" htmlFor="timezone">
              <Input
                id="timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
              />
            </FormField>
            <FormField label="Default working hours" htmlFor="hours">
              <Input id="hours" value={hours} onChange={(e) => setHours(e.target.value)} />
            </FormField>
            <Button className="w-fit">Save changes</Button>
          </div>
        )}

        {tab === 'Structure' && (
          <div className="space-y-4">
            {departments.map((dept) => (
              <div key={dept.name} className="border-b border-ink-100 pb-4 last:border-0">
                <p className="font-semibold text-ink-900">{dept.name}</p>
                <p className="mt-1 text-sm text-ink-500">
                  Teams: {dept.teams.join(', ')}
                </p>
              </div>
            ))}
            <Button variant="secondary" className="w-fit">
              Add department
            </Button>
          </div>
        )}

        {tab === 'Policies' && (
          <div className="space-y-4">
            <label className="flex items-center justify-between gap-4 rounded-lg border border-ink-200 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-ink-900">Enforce 2FA</p>
                <p className="text-xs text-ink-500">Require TOTP for Admin and HR roles.</p>
              </div>
              <input
                type="checkbox"
                checked={enforce2fa}
                onChange={(e) => setEnforce2fa(e.target.checked)}
                className="h-4 w-4 accent-brand-700"
              />
            </label>
            <label className="flex items-center justify-between gap-4 rounded-lg border border-ink-200 px-4 py-3 opacity-70">
              <div>
                <p className="text-sm font-semibold text-ink-900">Allow self-registration</p>
                <p className="text-xs text-ink-500">Off by default for invite-only MVP.</p>
              </div>
              <input type="checkbox" disabled className="h-4 w-4" />
            </label>
          </div>
        )}

        {tab === 'Branding' && (
          <div className="grid max-w-lg gap-4">
            <FormField label="Primary color" htmlFor="brandColor" hint="Used in portal header accents.">
              <Input id="brandColor" defaultValue="#0F766E" />
            </FormField>
            <FormField label="Logo URL" htmlFor="logo">
              <Input id="logo" placeholder="https://…" />
            </FormField>
            <Button className="w-fit">Save branding</Button>
          </div>
        )}
      </div>
    </div>
  );
}
