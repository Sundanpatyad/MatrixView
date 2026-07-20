import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/cn';

const steps = [
  'Org info',
  'Timezone & hours',
  'Branding',
  'Invite admins',
  'Done',
] as const;

export function OrgSetupPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [orgName, setOrgName] = useState('Acme Studio');
  const [industry, setIndustry] = useState('Software');
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [hours, setHours] = useState('09:00 – 18:00');
  const [brandColor, setBrandColor] = useState('#0F766E');
  const [adminEmail, setAdminEmail] = useState('');

  function next() {
    if (step >= steps.length - 1) {
      navigate('/dashboard');
      return;
    }
    setStep((s) => s + 1);
  }

  function back() {
    setStep((s) => Math.max(0, s - 1));
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-3xl font-semibold text-ink-900">Organization setup</h1>
      <p className="mt-2 text-sm text-ink-500">
        Skippable after step 1 — sensible defaults never block time-to-value.
      </p>

      <ol className="mt-8 flex flex-wrap gap-2">
        {steps.map((label, i) => (
          <li
            key={label}
            className={cn(
              'rounded-md px-2.5 py-1 text-xs font-semibold',
              i === step
                ? 'bg-brand-700 text-white'
                : i < step
                  ? 'bg-brand-50 text-brand-800'
                  : 'bg-ink-100 text-ink-500',
            )}
          >
            {i + 1}. {label}
          </li>
        ))}
      </ol>

      <div className="mt-6 rounded-xl border border-ink-200 bg-white p-6">
        {step === 0 && (
          <div className="space-y-4">
            <FormField label="Organization name" htmlFor="orgName">
              <Input id="orgName" value={orgName} onChange={(e) => setOrgName(e.target.value)} />
            </FormField>
            <FormField label="Industry" htmlFor="industry">
              <Input
                id="industry"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
              />
            </FormField>
          </div>
        )}
        {step === 1 && (
          <div className="space-y-4">
            <FormField label="Timezone" htmlFor="tz">
              <Input id="tz" value={timezone} onChange={(e) => setTimezone(e.target.value)} />
            </FormField>
            <FormField label="Default working hours" htmlFor="hours">
              <Input id="hours" value={hours} onChange={(e) => setHours(e.target.value)} />
            </FormField>
          </div>
        )}
        {step === 2 && (
          <div className="space-y-4">
            <FormField label="Brand color" htmlFor="color">
              <Input
                id="color"
                value={brandColor}
                onChange={(e) => setBrandColor(e.target.value)}
              />
            </FormField>
            <div
              className="h-16 rounded-lg border border-ink-200"
              style={{ background: brandColor }}
            />
          </div>
        )}
        {step === 3 && (
          <div className="space-y-4">
            <FormField
              label="Invite first admin (optional)"
              htmlFor="adminEmail"
              hint="You can invite more from Employees later."
            >
              <Input
                id="adminEmail"
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="admin@company.com"
              />
            </FormField>
          </div>
        )}
        {step === 4 && (
          <div>
            <p className="font-display text-2xl font-semibold text-ink-900">You&apos;re set</p>
            <p className="mt-2 text-sm text-ink-500">
              Next: invite employees and create your first department from the dashboard.
            </p>
          </div>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          {step > 0 && step < 4 ? (
            <Button variant="secondary" onClick={back}>
              Back
            </Button>
          ) : null}
          {step === 0 ? (
            <Button variant="ghost" onClick={() => navigate('/dashboard')}>
              Skip for now
            </Button>
          ) : null}
          <Button onClick={next}>{step === 4 ? 'Go to dashboard' : 'Continue'}</Button>
        </div>
      </div>
    </div>
  );
}
