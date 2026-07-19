import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useWorkspace } from '@/lib/workspace/WorkspaceContext';

export function ProjectsPage() {
  const { projects, createProject } = useWorkspace();
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(projects.length === 0);
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [description, setDescription] = useState('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const autoKey =
      key.trim() ||
      name
        .split(/\s+/)
        .map((w) => w[0])
        .join('')
        .slice(0, 4)
        .toUpperCase();
    const project = await createProject({ name, key: autoKey, description });
    setShowCreate(false);
    setName('');
    setKey('');
    setDescription('');
    navigate(`/projects/${project.id}`);
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-ink-950">Projects</h1>
          <p className="mt-2 text-sm font-medium text-ink-700">
            Create a project, add members, then work on the board.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>+ Create project</Button>
      </div>

      {projects.length === 0 && !showCreate ? (
        <div className="mt-10 rounded-2xl border-2 border-dashed border-ink-300 bg-white px-6 py-16 text-center">
          <p className="text-lg font-bold text-ink-950">No projects yet</p>
          <p className="mt-2 text-sm font-medium text-ink-600">
            Create a project to start adding your team.
          </p>
          <Button className="mt-6" onClick={() => setShowCreate(true)}>
            Create your first project
          </Button>
        </div>
      ) : null}

      <div className="mt-8 space-y-3">
        {projects.map((project) => (
          <div
            key={project.id}
            className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-ink-300 bg-white px-5 py-4 shadow-sm"
          >
            <Link
              to={`/projects/${project.id}/board`}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-xl transition hover:opacity-90"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-700 text-sm font-bold text-white">
                {project.key.slice(0, 2)}
              </span>
              <div className="min-w-0">
                <p className="text-base font-bold text-ink-950">{project.name}</p>
                <p className="text-xs font-semibold text-ink-600">
                  {project.key} · {project.members.length} members · by {project.createdBy}
                </p>
              </div>
            </Link>
            <div className="flex shrink-0 items-center gap-2">
              <Link to={`/projects/${project.id}`}>
                <Button size="sm" variant="secondary">
                  Members
                </Button>
              </Link>
              <Link to={`/projects/${project.id}/board`}>
                <Button size="sm">Open board</Button>
              </Link>
            </div>
          </div>
        ))}
      </div>

      {showCreate ? (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/55 p-4">
          <button
            type="button"
            className="absolute inset-0"
            onClick={() => projects.length > 0 && setShowCreate(false)}
            aria-label="Close"
          />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <h2 className="text-xl font-bold text-ink-950">Create project</h2>
            <p className="mt-1 text-sm font-medium text-ink-600">
              You become Admin. Add members next.
            </p>
            <form onSubmit={onSubmit} className="mt-5 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-bold text-ink-700 uppercase" htmlFor="name">
                  Project name
                </label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Client Portal"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-ink-700 uppercase" htmlFor="key">
                  Project key
                </label>
                <Input
                  id="key"
                  value={key}
                  onChange={(e) => setKey(e.target.value.toUpperCase())}
                  placeholder="e.g. CP"
                  maxLength={6}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-ink-700 uppercase" htmlFor="desc">
                  Description
                </label>
                <textarea
                  id="desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-ink-300 px-3 py-2 text-sm font-medium"
                  placeholder="What is this project for?"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                {projects.length > 0 ? (
                  <Button type="button" variant="secondary" onClick={() => setShowCreate(false)}>
                    Cancel
                  </Button>
                ) : null}
                <Button type="submit">Create project</Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
