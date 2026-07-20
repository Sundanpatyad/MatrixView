import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { useAttendance } from '@/lib/attendance/AttendanceContext';
import { useAuth } from '@/lib/auth/AuthContext';
import { ApiError } from '@/lib/api/client';
import { cn } from '@/lib/cn';
import { resolveMediaUrl } from '@/lib/mediaUrl';
import { useWorkspace } from '@/lib/workspace/WorkspaceContext';

type Props = {
  open: boolean;
  onClose: () => void;
};

export function ProfileModal({ open, onClose }: Props) {
  const { user, updateProfile, uploadAvatar } = useAuth();
  const { projects } = useWorkspace();
  const { checkedIn, onBreak, elapsedLabel } = useAttendance();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !user) return;
    setName(user.name);
    setPhone(user.phone ?? '');
    setPendingFile(null);
    setError(null);
    setMessage(null);
    setPreviewUrl((prev) => {
      if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
      return null;
    });
  }, [open, user?.id, user?.name, user?.phone, user?.avatarUrl]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  if (!open || !user) return null;

  const displayAvatarSrc = previewUrl || resolveMediaUrl(user.avatarUrl);
  const displayName = name.trim() || user.name;
  const adminCount = projects.filter((p) =>
    p.members.some(
      (m) =>
        m.email.toLowerCase() === user.email.toLowerCase() && m.role === 'admin',
    ),
  ).length;
  const statusLabel = !checkedIn ? 'Checked out' : onBreak ? 'On break' : 'Working';
  const statusColor = !checkedIn
    ? 'bg-ink-400'
    : onBreak
      ? 'bg-[#f0b232]'
      : 'bg-[#23a559]';

  function onPickAvatar(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file');
      return;
    }
    setError(null);
    setMessage(null);
    setPreviewUrl((prev) => {
      if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setPendingFile(file);
  }

  function removePendingPhoto() {
    setPendingFile(null);
    setPreviewUrl((prev) => {
      if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
      return null;
    });
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!user || saving || !name.trim()) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await updateProfile({ name: name.trim(), phone: phone.trim() });
      if (pendingFile) {
        await uploadAvatar(pendingFile);
      }
      setPendingFile(null);
      setPreviewUrl((prev) => {
        if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
        return null;
      });
      setMessage('Profile saved');
      window.setTimeout(() => onClose(), 450);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save profile');
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]">
      <button type="button" className="absolute inset-0" aria-label="Close" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-modal-title"
        className="relative z-10 flex max-h-[min(720px,92vh)] w-full max-w-4xl overflow-hidden rounded-2xl border border-ink-600 bg-ink-800 shadow-[0_24px_80px_rgba(0,0,0,0.45)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left: editor */}
        <form
          onSubmit={(e) => void onSave(e)}
          className="flex w-full max-w-sm shrink-0 flex-col border-r border-ink-600 bg-ink-900/80"
        >
          <div className="flex items-center justify-between border-b border-ink-600 px-4 py-3">
            <div>
              <p id="profile-modal-title" className="text-sm font-bold text-ink-50">
                User profile
              </p>
              <p className="text-[11px] text-ink-400">Edit your DockX identity</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-2 py-1 text-sm font-bold text-ink-400 hover:bg-ink-700 hover:text-ink-100"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
            <div>
              <p className="mb-2 text-[11px] font-bold tracking-wide text-ink-400 uppercase">
                Avatar
              </p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  title="Choose photo"
                  onClick={() => fileRef.current?.click()}
                  className="rounded-full ring-2 ring-ink-600 transition hover:ring-brand-500"
                >
                  <UserAvatar
                    name={displayName}
                    src={displayAvatarSrc}
                    seed={user.email}
                    size="xl"
                    className="!h-16 !w-16 !text-base"
                  />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-ink-100">{displayName}</p>
                  <p className="truncate text-[11px] text-ink-400">{user.email}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Button
                      type="button"
                      size="xs"
                      variant="secondary"
                      onClick={() => fileRef.current?.click()}
                    >
                      {pendingFile ? 'Change photo' : 'Choose photo'}
                    </Button>
                    {pendingFile ? (
                      <Button
                        type="button"
                        size="xs"
                        variant="ghost"
                        onClick={removePendingPhoto}
                      >
                        Discard
                      </Button>
                    ) : null}
                  </div>
                  <p className="mt-1.5 text-[10px] text-ink-400">
                    Photo uploads only when you hit Save
                  </p>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onPickAvatar}
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-ink-200" htmlFor="profile-name">
                Display name
              </label>
              <Input
                id="profile-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={120}
                autoComplete="name"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-ink-200" htmlFor="profile-email">
                Email
              </label>
              <Input id="profile-email" value={user.email} disabled />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-ink-200" htmlFor="profile-phone">
                Mobile number
              </label>
              <Input
                id="profile-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                inputMode="tel"
                autoComplete="tel"
                maxLength={32}
              />
            </div>

            <div className="rounded-xl border border-ink-600 bg-ink-800/80 p-3">
              <p className="text-[11px] font-bold tracking-wide text-ink-400 uppercase">
                Workspace
              </p>
              <p className="mt-1 text-xs font-semibold text-ink-100">{user.orgName}</p>
              <p className="mt-0.5 text-[11px] text-ink-400">
                Role: {user.role} · {projects.length} project
                {projects.length === 1 ? '' : 's'}
              </p>
            </div>

            {error ? <p className="text-xs font-medium text-[#ed4245]">{error}</p> : null}
            {message ? <p className="text-xs font-medium text-[#57f287]">{message}</p> : null}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-ink-600 px-4 py-3">
            <Button type="button" size="sm" variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={saving || !name.trim()}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </form>

        {/* Right: live preview */}
        <div className="hidden min-w-0 flex-1 flex-col bg-ink-800 sm:flex">
          <div className="border-b border-ink-600 px-5 py-3">
            <p className="text-sm font-bold text-ink-50">Preview</p>
            <p className="text-[11px] text-ink-400">How teammates see you in DockX</p>
          </div>

          <div className="flex flex-1 flex-col overflow-y-auto p-5">
            <div className="overflow-hidden rounded-2xl border border-ink-600 bg-ink-900 shadow-lg">
              <div className="relative h-28 bg-gradient-to-br from-brand-500 via-brand-600 to-[#4752c4]">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(255,255,255,0.22),transparent_45%)]" />
              </div>

              <div className="relative px-5 pb-5">
                <div className="absolute -top-10 left-5">
                  <span className="relative inline-block rounded-full ring-[6px] ring-ink-900">
                    <UserAvatar
                      name={displayName}
                      src={displayAvatarSrc}
                      seed={user.email}
                      size="xl"
                      bare
                      className="!h-20 !w-20 !text-xl"
                    />
                    <span
                      className={cn(
                        'absolute right-1 bottom-1 h-4 w-4 rounded-full border-[3px] border-ink-900',
                        statusColor,
                      )}
                      title={statusLabel}
                    />
                  </span>
                </div>

                <div className="pt-12">
                  <h2 className="text-xl font-bold text-ink-50">{displayName}</h2>
                  <p className="mt-0.5 text-sm text-ink-300">{user.email}</p>
                  {phone.trim() ? (
                    <p className="mt-0.5 text-xs text-ink-400">{phone.trim()}</p>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="rounded-md border border-brand-500/30 bg-brand-500/15 px-2 py-1 text-[11px] font-bold text-brand-600 dark:text-brand-300">
                      {user.role}
                    </span>
                    <span className="rounded-md border border-ink-600 bg-ink-800 px-2 py-1 text-[11px] font-semibold text-ink-200">
                      {statusLabel}
                      {checkedIn ? ` · ${elapsedLabel}` : ''}
                    </span>
                  </div>

                  <div className="mt-5 grid grid-cols-3 gap-2">
                    <div className="rounded-xl border border-ink-600 bg-ink-800/80 px-3 py-2.5">
                      <p className="text-[10px] font-bold tracking-wide text-ink-400 uppercase">
                        Projects
                      </p>
                      <p className="mt-1 text-lg font-bold tabular-nums text-ink-50">
                        {projects.length}
                      </p>
                    </div>
                    <div className="rounded-xl border border-ink-600 bg-ink-800/80 px-3 py-2.5">
                      <p className="text-[10px] font-bold tracking-wide text-ink-400 uppercase">
                        Admin of
                      </p>
                      <p className="mt-1 text-lg font-bold tabular-nums text-ink-50">
                        {adminCount}
                      </p>
                    </div>
                    <div className="rounded-xl border border-ink-600 bg-ink-800/80 px-3 py-2.5">
                      <p className="text-[10px] font-bold tracking-wide text-ink-400 uppercase">
                        Org
                      </p>
                      <p className="mt-1 truncate text-sm font-bold text-ink-50">
                        {user.orgName.split(' ')[0]}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-ink-600 bg-ink-800/60 p-3">
                    <p className="text-[10px] font-bold tracking-wide text-ink-400 uppercase">
                      About
                    </p>
                    <p className="mt-1.5 text-xs leading-relaxed text-ink-300">
                      Member of {user.orgName}. Project access is controlled by admin and
                      member roles on each board.
                    </p>
                  </div>

                  {pendingFile ? (
                    <p className="mt-3 rounded-lg border border-brand-500/25 bg-brand-500/10 px-3 py-2 text-[11px] font-medium text-brand-600 dark:text-brand-300">
                      New photo ready — it will upload when you save.
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
