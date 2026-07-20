import { useRef, useState, type ChangeEvent } from 'react';
import { cn } from '@/lib/cn';
import { resolveMediaUrl } from '@/lib/mediaUrl';

type Size = 'sm' | 'md' | 'lg';

const sizes: Record<Size, string> = {
  sm: 'h-8 w-8 text-[10px]',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-lg',
};

type Props = {
  name: string;
  avatarUrl?: string | null;
  size?: Size;
  className?: string;
  editable?: boolean;
  busy?: boolean;
  onUpload?: (file: File) => void | Promise<void>;
  onRemove?: () => void | Promise<void>;
};

export function ProjectAvatar({
  name,
  avatarUrl,
  size = 'md',
  className,
  editable,
  busy,
  onUpload,
  onRemove,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const src = resolveMediaUrl(avatarUrl);

  async function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    setMenuOpen(false);
    if (!file || !onUpload) return;
    if (!file.type.startsWith('image/')) return;
    await onUpload(file);
  }

  const badge = (
    <span
      className={cn(
        'relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 font-bold text-white shadow-sm shadow-brand-500/20',
        sizes[size],
        className,
      )}
    >
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        name.charAt(0).toUpperCase() || 'P'
      )}
      {busy ? (
        <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-[10px] font-semibold text-white">
          …
        </span>
      ) : null}
    </span>
  );

  if (!editable) return badge;

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        title={avatarUrl ? 'Change project image' : 'Add project image'}
        disabled={busy}
        onClick={() => setMenuOpen((v) => !v)}
        className={cn(
          'rounded-xl outline-none transition focus-visible:ring-2 focus-visible:ring-brand-500',
          busy && 'opacity-70',
        )}
      >
        {badge}
      </button>

      {menuOpen ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40"
            aria-label="Close"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute top-full left-0 z-50 mt-1.5 min-w-[150px] overflow-hidden rounded-lg border border-ink-600 bg-ink-800 py-1 shadow-[0_12px_28px_rgba(0,0,0,0.35)]">
            <button
              type="button"
              className="block w-full px-3 py-2 text-left text-xs font-semibold text-ink-50 hover:bg-ink-700"
              onClick={() => {
                setMenuOpen(false);
                fileRef.current?.click();
              }}
            >
              {avatarUrl ? 'Change image' : 'Add image'}
            </button>
            {avatarUrl ? (
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-xs font-semibold text-[#ed4245] hover:bg-ink-700"
                onClick={() => {
                  setMenuOpen(false);
                  void onRemove?.();
                }}
              >
                Remove image
              </button>
            ) : null}
          </div>
        </>
      ) : null}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void onFileChange(e)}
      />
    </div>
  );
}
