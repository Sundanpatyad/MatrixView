import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ProjectAvatar } from '@/components/board/ProjectAvatar';
import { cn } from '@/lib/cn';

type ProjectOption = {
  id: string;
  name: string;
  key: string;
  avatarUrl?: string | null;
};

type Props = {
  projects: ProjectOption[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
  placeholder?: string;
  /** Slim trigger for board chrome — text + chevron only */
  compact?: boolean;
  /** Hide the project avatar inside the trigger */
  hideAvatar?: boolean;
};

export function ProjectSelect({
  projects,
  value,
  onChange,
  className,
  placeholder = 'Select project',
  compact = false,
  hideAvatar = false,
}: Props) {
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 240, openUp: false });

  const selected = projects.find((p) => p.id === value);

  function updatePos() {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < 260 && rect.top > spaceBelow;
    setPos({
      top: openUp ? rect.top : rect.bottom + 6,
      left: rect.left,
      width: Math.max(rect.width, 240),
      openUp,
    });
  }

  useLayoutEffect(() => {
    if (!open) return;
    updatePos();
    const onScroll = () => updatePos();
    window.addEventListener('resize', onScroll);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || listRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Switch project"
        disabled={projects.length === 0}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex min-w-0 items-center justify-between text-left transition',
          'hover:border-ink-500 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/15',
          'disabled:cursor-not-allowed disabled:opacity-45',
          open && 'border-brand-500 ring-2 ring-brand-500/15',
          compact
            ? 'w-auto max-w-full gap-1 rounded-md border-0 bg-transparent px-0 py-0.5 focus:ring-0'
            : 'w-full max-w-none gap-3 rounded-xl border border-ink-600 bg-ink-900 px-3 py-2 sm:min-w-[200px] sm:max-w-xs sm:w-auto',
          className,
        )}
      >
        <span className={cn('flex min-w-0 items-center', compact ? 'gap-1.5' : 'gap-2.5')}>
          {selected ? (
            <>
              {!hideAvatar && !compact ? (
                <ProjectAvatar
                  name={selected.name}
                  avatarUrl={selected.avatarUrl}
                  size="sm"
                  className="!rounded-lg"
                />
              ) : null}
              <span className="min-w-0">
                <span
                  className={cn(
                    'block truncate font-semibold text-ink-50',
                    compact ? 'text-sm' : 'text-sm',
                  )}
                >
                  {selected.name}
                </span>
                {!compact ? (
                  <span className="mt-0.5 block truncate text-[10px] font-bold tracking-wide text-ink-400 uppercase">
                    {selected.key}
                  </span>
                ) : null}
              </span>
              {compact ? (
                <span className="shrink-0 rounded border border-ink-600 px-1 py-px text-[9px] font-bold tracking-wide text-ink-400 uppercase">
                  {selected.key}
                </span>
              ) : null}
            </>
          ) : (
            <span className="text-sm font-medium text-ink-400">{placeholder}</span>
          )}
        </span>
        <span
          className={cn(
            'flex shrink-0 items-center justify-center text-[10px] text-ink-300 transition',
            compact
              ? 'h-5 w-5 rounded text-ink-400'
              : 'h-6 w-6 rounded-md bg-ink-800',
            open &&
              (compact
                ? 'rotate-180 text-brand-500'
                : 'rotate-180 bg-brand-500/15 text-brand-600 dark:text-brand-300'),
          )}
          aria-hidden
        >
          ▾
        </span>
      </button>

      {open
        ? createPortal(
            <div
              ref={listRef}
              role="listbox"
              aria-labelledby={id}
              className="fixed z-[10000] overflow-hidden rounded-xl border border-ink-600 bg-ink-800 py-1 shadow-[0_16px_40px_rgba(0,0,0,0.35)]"
              style={{
                top: pos.openUp ? undefined : pos.top,
                bottom: pos.openUp ? window.innerHeight - pos.top + 4 : undefined,
                left: pos.left,
                width: pos.width,
              }}
            >
              <p className="px-3 py-2 text-[10px] font-bold tracking-wide text-ink-400 uppercase">
                Projects
              </p>
              {projects.length === 0 ? (
                <p className="px-3 py-3 text-xs text-ink-400">No projects</p>
              ) : (
                projects.map((p) => {
                  const active = p.id === value;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => {
                        onChange(p.id);
                        setOpen(false);
                        triggerRef.current?.focus();
                      }}
                      className={cn(
                        'flex w-full items-center gap-3 px-3 py-2.5 text-left transition',
                        active ? 'bg-brand-500/15' : 'hover:bg-ink-700',
                      )}
                    >
                      <ProjectAvatar
                        name={p.name}
                        avatarUrl={p.avatarUrl}
                        size="sm"
                        className="!rounded-lg"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold text-ink-50">
                          {p.name}
                        </span>
                        <span className="block truncate text-[10px] font-bold text-ink-400 uppercase">
                          {p.key}
                        </span>
                      </span>
                      {active ? (
                        <span className="text-[10px] font-bold text-brand-600 dark:text-brand-300">
                          ✓
                        </span>
                      ) : null}
                    </button>
                  );
                })
              )}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
