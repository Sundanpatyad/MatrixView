import { useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { Input, Textarea } from '@/components/ui/Input';
import { Modal, ModalFooter, ModalHeader } from '@/components/ui/Modal';
import { Tooltip } from '@/components/ui/Tooltip';
import { resolveMediaUrl } from '@/lib/mediaUrl';
import { useWorkspace } from '@/lib/workspace/WorkspaceContext';

type Props = {
  onClose: () => void;
  onCreated?: (projectId: string) => void;
};

export function CreateProjectModal({ onClose, onCreated }: Props) {
  const { createProject, uploadProjectAvatar } = useWorkspace();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [description, setDescription] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function onPickFile(file: File | null) {
    if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    if (!file) {
      setAvatarFile(null);
      setPreviewUrl(null);
      return;
    }
    if (!file.type.startsWith('image/')) return;
    setAvatarFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || busy) return;
    const autoKey =
      key.trim() ||
      name
        .split(/\s+/)
        .map((w) => w[0])
        .join('')
        .slice(0, 4)
        .toUpperCase();
    setBusy(true);
    try {
      const project = await createProject({ name, key: autoKey, description });
      if (avatarFile) {
        try {
          await uploadProjectAvatar(project.id, avatarFile);
        } catch {
          /* project created; image can be added later */
        }
      }
      onCreated?.(project.id);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  const preview = resolveMediaUrl(previewUrl);

  return (
    <Modal size="md" labelledBy="create-project-title" onClose={onClose}>
      <ModalHeader
        titleId="create-project-title"
        title="New project"
        description="You become Admin. Add an optional project image, then invite people."
        onClose={onClose}
      />
      <form onSubmit={(e) => void onSubmit(e)} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="flex items-center gap-3 rounded-xl border border-ink-600/70 bg-ink-900/40 p-3">
            <Tooltip label="Add project image" side="right">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-lg font-bold text-white"
                aria-label="Add project image"
              >
                {preview ? (
                  <img src={preview} alt="" className="h-full w-full object-cover" />
                ) : (
                  name.charAt(0).toUpperCase() || '+'
                )}
              </button>
            </Tooltip>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-ink-100">Project image</p>
              <p className="text-[11px] text-ink-400">PNG or JPG, optional</p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="xs"
                  variant="secondary"
                  onClick={() => fileRef.current?.click()}
                >
                  {avatarFile ? 'Change' : 'Choose'}
                </Button>
                {avatarFile ? (
                  <Button type="button" size="xs" variant="ghost" onClick={() => onPickFile(null)}>
                    Remove
                  </Button>
                ) : null}
              </div>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
            />
          </div>

          <div>
            <FieldLabel htmlFor="project-name" required>
              Project name
            </FieldLabel>
            <Input
              id="project-name"
              placeholder="e.g. Client Portal"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div>
            <FieldLabel htmlFor="project-key" optional>
              Key
            </FieldLabel>
            <Input
              id="project-key"
              placeholder="ACME"
              value={key}
              onChange={(e) => setKey(e.target.value.toUpperCase())}
              maxLength={6}
            />
          </div>
          <div>
            <FieldLabel htmlFor="project-desc" optional>
              Description
            </FieldLabel>
            <Textarea
              id="project-desc"
              placeholder="What is this project for?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <ModalFooter>
          <Button type="button" size="sm" variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={busy || !name.trim()}>
            {busy ? 'Creating…' : 'Create project'}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
