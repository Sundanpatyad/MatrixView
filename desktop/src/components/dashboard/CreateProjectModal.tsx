import { useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
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

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/55 p-4">
      <button type="button" className="absolute inset-0" onClick={onClose} aria-label="Close" />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 w-full max-w-md rounded-xl border border-ink-600 bg-ink-800 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-ink-50">New project</h2>
        <p className="mt-1 text-xs text-ink-300">You become Admin. Optional project image.</p>

        <form onSubmit={(e) => void onSubmit(e)} className="mt-4 space-y-2.5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-lg font-bold text-white"
              title="Add project image"
            >
              {preview ? (
                <img src={preview} alt="" className="h-full w-full object-cover" />
              ) : (
                (name.charAt(0).toUpperCase() || '+')
              )}
            </button>
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
                  <Button
                    type="button"
                    size="xs"
                    variant="ghost"
                    onClick={() => onPickFile(null)}
                  >
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
            className="w-full rounded-lg border border-ink-600 bg-ink-900 px-3 py-2 text-sm text-ink-50 outline-none focus:border-ink-400"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" size="sm" variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={busy}>
              {busy ? 'Creating…' : 'Create'}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
