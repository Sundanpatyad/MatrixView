import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { useAuth } from '@/lib/auth/AuthContext';
import { ApiError } from '@/lib/api/client';
import { cn } from '@/lib/cn';

export function ProfilePage() {
  const { user, updateProfile, uploadAvatar } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(user?.name ?? '');
    setPhone(user?.phone ?? '');
  }, [user?.name, user?.phone]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!user || saving) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      await updateProfile({ name: name.trim(), phone: phone.trim() });
      setMessage('Profile saved');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save profile');
    } finally {
      setSaving(false);
    }
  }

  async function onAvatarChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file');
      return;
    }
    setUploading(true);
    setMessage(null);
    setError(null);
    try {
      await uploadAvatar(file);
      setMessage('Photo updated');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not upload photo');
    } finally {
      setUploading(false);
    }
  }

  if (!user) return null;

  return (
    <div className="h-full overflow-y-auto px-4 py-6 md:px-8">
      <div className="mx-auto max-w-lg">
        <h1 className="font-display text-3xl font-semibold text-ink-900">My profile</h1>
        <p className="mt-2 text-sm text-ink-500">
          Update your name, photo, and mobile number. Email and role are managed by your org.
        </p>

        <form
          onSubmit={(e) => void onSave(e)}
          className="mt-8 space-y-5 rounded-2xl border border-ink-200 bg-white p-5"
        >
          <div className="flex items-center gap-4">
            <button
              type="button"
              title="Change photo"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className={cn(
                'rounded-full ring-2 ring-ink-100 transition hover:ring-ink-300',
                uploading && 'opacity-60',
              )}
            >
              <UserAvatar
                name={user.name}
                src={user.avatarUrl}
                seed={user.email}
                size="xl"
              />
            </button>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink-900">{user.name}</p>
              <p className="truncate text-xs text-ink-500">{user.email}</p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="mt-2"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? 'Uploading…' : 'Change photo'}
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => void onAvatarChange(e)}
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-700" htmlFor="name">
              Name
            </label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={120}
              autoComplete="name"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-700" htmlFor="email">
              Email
            </label>
            <Input id="email" value={user.email} disabled />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-700" htmlFor="phone">
              Mobile number
            </label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
              inputMode="tel"
              autoComplete="tel"
              maxLength={32}
            />
          </div>

          <p className="text-xs text-ink-500">
            Role: {user.role} · Org: {user.orgName}
          </p>

          {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
          {message ? <p className="text-sm font-medium text-emerald-700">{message}</p> : null}

          <Button type="submit" className="w-fit" disabled={saving || !name.trim()}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </form>
      </div>
    </div>
  );
}
