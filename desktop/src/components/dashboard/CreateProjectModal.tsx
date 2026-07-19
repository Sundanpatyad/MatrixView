import { useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useWorkspace } from '@/lib/workspace/WorkspaceContext';

type Props = {
  onClose: () => void;
  onCreated?: (projectId: string) => void;
};

export function CreateProjectModal({ onClose, onCreated }: Props) {
  const { createProject } = useWorkspace();
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
    onCreated?.(project.id);
    onClose();
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-ink-950/35 p-4">
      <button type="button" className="absolute inset-0" onClick={onClose} aria-label="Close" />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 w-full max-w-md border border-ink-200 bg-white p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-ink-900">New project</h2>
        <p className="mt-1 text-xs text-ink-500">You become Admin.</p>

        <form onSubmit={onSubmit} className="mt-4 space-y-2.5">
          <Input
            placeholder="Project name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />
          <Input
            placeholder="Key (e.g. ACME)"
            value={key}
            onChange={(e) => setKey(e.target.value.toUpperCase())}
            maxLength={6}
          />
          <textarea
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full border border-ink-200 px-3 py-2 text-sm outline-none focus:border-ink-400"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" size="sm" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" size="sm">
              Create
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
