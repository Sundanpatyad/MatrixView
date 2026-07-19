import { cn } from '@/lib/cn';

const AVATAR_COLORS = [
  'bg-teal-700',
  'bg-sky-700',
  'bg-amber-700',
  'bg-rose-700',
  'bg-indigo-700',
  'bg-emerald-700',
  'bg-orange-700',
  'bg-cyan-800',
];

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?';
}

function avatarColor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash + seed.charCodeAt(i) * 17) % AVATAR_COLORS.length;
  return AVATAR_COLORS[hash];
}

const sizeClass = {
  xs: 'h-5 w-5 text-[8px]',
  sm: 'h-6 w-6 text-[9px]',
  md: 'h-8 w-8 text-[10px]',
  lg: 'h-10 w-10 text-xs',
  xl: 'h-20 w-20 text-lg',
} as const;

type Size = keyof typeof sizeClass;

type Props = {
  name: string;
  src?: string | null;
  seed?: string;
  size?: Size;
  className?: string;
  title?: string;
  /** Disable default ring (use when stacking with a shared border) */
  bare?: boolean;
};

export function UserAvatar({
  name,
  src,
  seed,
  size = 'md',
  className,
  title,
  bare = false,
}: Props) {
  const label = title ?? name;
  const color = avatarColor(seed || name || 'user');

  return (
    <span
      title={label}
      className={cn(
        'relative grid shrink-0 place-items-center overflow-hidden rounded-full leading-none',
        !bare && 'ring-1 ring-black/5',
        sizeClass[size],
        src ? 'bg-ink-200' : color,
        !src && 'font-bold text-white',
        className,
      )}
    >
      {src ? (
        <img
          src={src}
          alt={name}
          className="absolute inset-0 h-full w-full object-cover"
          draggable={false}
        />
      ) : (
        <span className="relative z-[1] select-none">{initials(name)}</span>
      )}
    </span>
  );
}

/** Resolve avatar from project members by member id or name */
export function avatarFromMembers(
  members: Array<{ id: string; name: string; avatarUrl?: string | null }>,
  assigneeId?: string | null,
  assigneeName?: string | null,
): string | null {
  if (assigneeId) {
    const byId = members.find((m) => m.id === assigneeId);
    if (byId?.avatarUrl) return byId.avatarUrl;
  }
  if (assigneeName) {
    const name = assigneeName.trim().toLowerCase();
    const byName = members.find((m) => m.name.trim().toLowerCase() === name);
    if (byName?.avatarUrl) return byName.avatarUrl;
  }
  return null;
}
