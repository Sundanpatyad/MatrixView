import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { mockProjects, type Project } from '@/data/mockProjects';

const statusTone: Record<Project['status'], 'success' | 'warning' | 'neutral'> = {
  active: 'success',
  on_hold: 'warning',
  completed: 'neutral',
};

export function ProjectsPage() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-ink-900">Projects</h1>
          <p className="mt-2 text-sm text-ink-500">
            Create projects, add members, and track milestones.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>New project</Button>
      </div>

      <div className="mt-8 space-y-3">
        {mockProjects.map((project) => (
          <article
            key={project.id}
            className="rounded-xl border border-ink-200 bg-white p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold text-ink-900">{project.name}</h2>
                  <Badge tone={statusTone[project.status]}>
                    {project.status.replace('_', ' ')}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-ink-500">
                  {project.members} members · Next: {project.milestone}
                </p>
              </div>
              <p className="text-sm font-semibold text-brand-800">{project.progress}%</p>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-ink-100">
              <div
                className="h-full rounded-full bg-brand-600"
                style={{ width: `${project.progress}%` }}
              />
            </div>
          </article>
        ))}
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="font-display text-2xl font-semibold text-ink-900">New project</h2>
            <form
              className="mt-6 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                setOpen(false);
                setName('');
              }}
            >
              <FormField label="Project name" htmlFor="projectName">
                <Input
                  id="projectName"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </FormField>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Create</Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
