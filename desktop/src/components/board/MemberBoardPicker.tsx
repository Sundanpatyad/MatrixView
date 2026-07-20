import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { cn } from '@/lib/cn';
import type { ProjectMember } from '@/lib/workspace/types';

const VISIBLE = 5;

type Props = {
  members: ProjectMember[];
  selectedIds: string[];
  onToggle: (memberId: string) => void;
  className?: string;
};

export function MemberBoardPicker({ members, selectedIds, onToggle, className }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 280 });

  const visible = members.slice(0, VISIBLE);
  const overflow = Math.max(0, members.length - VISIBLE);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q),
    );
  }, [members, search]);

  useEffect(() => {
    if (!open) return;
    const el = triggerRef.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      const width = 280;
      const left = Math.min(
        Math.max(8, rect.right - width),
        window.innerWidth - width - 8,
      );
      setPos({ top: rect.bottom + 6, left, width });
    }

    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || panelRef.current?.contains(t)) return;
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

  useEffect(() => {
    if (!open) setSearch('');
  }, [open]);

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <p className="hidden text-[10px] font-medium text-ink-400 lg:block">
        {selectedIds.length} selected
      </p>

      <div className="flex items-center" role="group" aria-label="Member boards">
        {visible.map((m, i) => {
          const active = selectedIds.includes(m.id);
          return (
            <button
              key={m.id}
              type="button"
              title={
                active
                  ? `Hide ${m.name}'s tasks (click again)`
                  : `Add ${m.name}'s tasks`
              }
              aria-pressed={active}
              onClick={() => onToggle(m.id)}
              style={{ zIndex: i + 1 }}
              className={cn(
                'relative h-7 w-7 shrink-0 rounded-full p-0 transition',
                'ring-2 ring-ink-800',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                i > 0 && '-ml-1.5',
                active
                  ? 'opacity-100'
                  : 'scale-90 opacity-40 grayscale hover:scale-100 hover:opacity-100 hover:grayscale-0',
              )}
            >
              <UserAvatar
                name={m.name}
                src={m.avatarUrl}
                seed={m.email || m.name}
                size="md"
                bare
                className="!h-7 !w-7 !text-[9px]"
              />
              {active ? (
                <span className="absolute -right-0.5 -bottom-0.5 h-2 w-2 rounded-full border-2 border-ink-800 bg-brand-500" />
              ) : null}
            </button>
          );
        })}

        {overflow > 0 ? (
          <button
            ref={triggerRef}
            type="button"
            aria-expanded={open}
            aria-haspopup="dialog"
            onClick={() => setOpen((v) => !v)}
            style={{ zIndex: visible.length + 1 }}
            className={cn(
              'relative -ml-1.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
              'border border-ink-500 bg-ink-700 text-[10px] font-bold text-ink-100 ring-2 ring-ink-800',
              'transition hover:border-brand-500 hover:bg-brand-500/15 hover:text-brand-600 dark:hover:text-brand-300',
              open && 'border-brand-500 bg-brand-500/20 text-brand-600 dark:text-brand-300',
            )}
            title={`Show ${overflow} more members`}
          >
            +{overflow}
          </button>
        ) : null}
      </div>

      {open
        ? createPortal(
            <div
              ref={panelRef}
              role="dialog"
              aria-label="Select member boards"
              className="fixed z-[10000] overflow-hidden rounded-xl border border-ink-600 bg-ink-800 shadow-[0_16px_40px_rgba(0,0,0,0.35)]"
              style={{ top: pos.top, left: pos.left, width: pos.width }}
            >
              <div className="border-b border-ink-600 px-3 py-2.5">
                <p className="text-[11px] font-bold text-ink-100">All members</p>
                <p className="text-[10px] text-ink-400">
                  Multi-select to combine boards
                </p>
                <label className="relative mt-2 block">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-ink-400"
                    aria-hidden
                  >
                    <circle cx="11" cy="11" r="7" />
                    <path d="m20 20-3.5-3.5" />
                  </svg>
                  <input
                    autoFocus
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search members…"
                    className="h-8 w-full rounded-lg border border-ink-600 bg-ink-900 pr-2 pl-8 text-xs text-ink-50 outline-none placeholder:text-ink-400 focus:border-brand-500"
                  />
                </label>
              </div>
              <ul className="max-h-64 overflow-y-auto py-1">
                {filtered.length === 0 ? (
                  <li className="px-3 py-4 text-center text-xs text-ink-400">No matches</li>
                ) : (
                  filtered.map((m) => {
                    const active = selectedIds.includes(m.id);
                    return (
                      <li key={m.id}>
                        <button
                          type="button"
                          onClick={() => onToggle(m.id)}
                          className={cn(
                            'flex w-full items-center gap-2.5 px-3 py-2 text-left transition',
                            active ? 'bg-brand-500/10' : 'hover:bg-ink-700',
                          )}
                        >
                          <UserAvatar
                            name={m.name}
                            src={m.avatarUrl}
                            seed={m.email || m.name}
                            size="sm"
                            bare
                            className="!h-7 !w-7 !text-[9px]"
                          />
                          <span className="min-w-0 flex-1 truncate text-xs font-semibold text-ink-50">
                            {m.name}
                          </span>
                          <span
                            className={cn(
                              'flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] font-bold',
                              active
                                ? 'border-brand-500 bg-brand-500 text-white'
                                : 'border-ink-500 text-transparent',
                            )}
                          >
                            ✓
                          </span>
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
