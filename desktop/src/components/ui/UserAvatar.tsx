import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { resolveMediaUrl } from '@/lib/mediaUrl';
import { useSocketOptional } from '@/lib/socket/SocketContext';

const AVATAR_COLORS = [
  'bg-[#4BDE80]',
  'bg-[#6fe99a]',
  'bg-[#eb459e]',
  'bg-[#00a8fc]',
  'bg-[#fee75c]',
  'bg-[#ed4245]',
  'bg-[#2FC46A]',
  'bg-[#4BDE80]',
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

const presenceDotClass = {
  xs: 'h-1.5 w-1.5 border',
  sm: 'h-2 w-2 border-[1.5px]',
  md: 'h-2.5 w-2.5 border-2',
  lg: 'h-2.5 w-2.5 border-2',
  xl: 'h-3.5 w-3.5 border-[3px]',
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
  /** Live socket presence for this user (desktop, website, and chat). */
  userId?: string | null;
  /** Explicit online flag when not using live socket lookup. */
  online?: boolean;
  /** Hide the presence pip even if userId is set (e.g. attendance overlay). */
  showPresence?: boolean;
};

export function UserAvatar({
  name,
  src,
  seed,
  size = 'md',
  className,
  title,
  bare = false,
  userId,
  online,
  showPresence = true,
}: Props) {
  const socket = useSocketOptional();
  const live = userId && socket ? socket.isOnline(userId) : undefined;
  const flag = live ?? online;
  const showDot = showPresence && (userId != null || online !== undefined);
  const label =
    title === ''
      ? undefined
      : title ?? (showDot ? `${name} · ${flag ? 'Online' : 'Offline'}` : name);
  const color = avatarColor(seed || name || 'user');
  const resolved = resolveMediaUrl(src);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [resolved]);

  const showPhoto = Boolean(resolved) && !failed;

  return (
    <span
      title={label}
      className={cn('relative inline-grid shrink-0', sizeClass[size], className)}
    >
      <span
        className={cn(
          'relative grid h-full w-full place-items-center overflow-hidden rounded-full leading-none',
          !bare && 'ring-1 ring-black/5',
          showPhoto ? 'bg-ink-700' : color,
          !showPhoto && 'font-bold text-white',
        )}
      >
        {showPhoto ? (
          <img
            src={resolved}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            draggable={false}
            referrerPolicy="no-referrer"
            onError={() => setFailed(true)}
          />
        ) : (
          <span className="relative z-[1] select-none">{initials(name)}</span>
        )}
      </span>
      {showDot ? (
        <span
          className={cn(
            'pointer-events-none absolute right-0 bottom-0 z-[2] rounded-full border-ink-900',
            presenceDotClass[size],
            flag ? 'bg-[#4BDE80]' : 'bg-ink-400',
          )}
          aria-hidden
        />
      ) : null}
    </span>
  );
}

/** Resolve a project-member seat id (or user id) to the User id used for socket presence. */
export function presenceUserIdFromMembers(
  members: Array<{ id: string; userId?: string | null }>,
  assigneeId?: string | null,
): string | undefined {
  if (!assigneeId) return undefined;
  const match = members.find((m) => m.id === assigneeId || m.userId === assigneeId);
  return match?.userId || match?.id || assigneeId;
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
