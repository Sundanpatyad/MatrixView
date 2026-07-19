import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/cn';
import { useAuth } from '@/lib/auth/AuthContext';

const tabs = ['Profile', 'Security', 'Preferences'] as const;

export function SettingsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<(typeof tabs)[number]>('Profile');

  return (
    <div className="mx-auto max-w-3xl">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink-900">Settings</h1>
        <p className="mt-2 text-sm text-ink-500">
          Personal preferences and security. Org-wide settings live under Organization.
        </p>
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
        {tab === 'Profile' && (
          <div className="grid max-w-lg gap-4">
            <FormField label="Name" htmlFor="name">
              <Input id="name" defaultValue={user?.name} />
            </FormField>
            <FormField label="Email" htmlFor="email">
              <Input id="email" defaultValue={user?.email} disabled />
            </FormField>
            <Button className="w-fit">Save profile</Button>
          </div>
        )}

        {tab === 'Security' && (
          <div className="space-y-4">
            <div className="rounded-lg border border-ink-200 px-4 py-3">
              <p className="text-sm font-semibold text-ink-900">Active sessions</p>
              <p className="mt-1 text-xs text-ink-500">
                Chrome · Mac · Mumbai · Last active just now
              </p>
              <Button size="sm" variant="secondary" className="mt-3">
                Revoke other sessions
              </Button>
            </div>
            <div className="rounded-lg border border-ink-200 px-4 py-3">
              <p className="text-sm font-semibold text-ink-900">Two-factor authentication</p>
              <p className="mt-1 text-xs text-ink-500">Optional in MVP; enforceable by Admin.</p>
              <Button size="sm" variant="secondary" className="mt-3">
                Enable 2FA
              </Button>
            </div>
          </div>
        )}

        {tab === 'Preferences' && (
          <div className="space-y-3">
            <label className="flex items-center justify-between gap-4 rounded-lg border border-ink-200 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-ink-900">Email digests</p>
                <p className="text-xs text-ink-500">Daily summary of assignments and mentions.</p>
              </div>
              <input type="checkbox" defaultChecked className="h-4 w-4 accent-brand-700" />
            </label>
            <label className="flex items-center justify-between gap-4 rounded-lg border border-ink-200 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-ink-900">Desktop download reminder</p>
                <p className="text-xs text-ink-500">Nudge employees who haven&apos;t installed the agent.</p>
              </div>
              <input type="checkbox" defaultChecked className="h-4 w-4 accent-brand-700" />
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
