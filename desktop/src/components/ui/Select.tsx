import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';

export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type Size = 'xs' | 'sm' | 'md';

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  size?: Size;
  'aria-label'?: string;
};

const sizes: Record<Size, string> = {
  xs: 'h-7 px-2 text-[11px]',
  sm: 'h-9 px-2.5 text-xs',
  md: 'h-11 px-3 text-sm',
};

export function Select({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  disabled,
  className,
  size = 'sm',
  'aria-label': ariaLabel,
}: Props) {
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0, openUp: false });

  const selected = options.find((o) => o.value === value);
  const enabled = options.map((o, i) => ({ o, i })).filter(({ o }) => !o.disabled);

  function updatePos() {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < 220 && rect.top > spaceBelow;
    setPos({
      top: openUp ? rect.top : rect.bottom + 4,
      left: rect.left,
      width: Math.max(rect.width, 140),
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
    const idx = options.findIndex((o) => o.value === value);
    setHighlight(idx >= 0 ? idx : enabled[0]?.i ?? -1);

    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || listRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, value, options, enabled]);

  function pick(next: string) {
    onChange(next);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      if (e.key === 'Enter' || e.key === ' ') {
        const opt = options[highlight];
        if (opt && !opt.disabled) pick(opt.value);
      } else {
        moveHighlight(1);
      }
    } else if (e.key === 'ArrowUp' && open) {
      e.preventDefault();
      moveHighlight(-1);
    }
  }

  function moveHighlight(dir: number) {
    if (enabled.length === 0) return;
    const positions = enabled.map(({ i }) => i);
    const cur = positions.indexOf(highlight);
    const next =
      cur < 0
        ? positions[0]
        : positions[(cur + dir + positions.length) % positions.length];
    setHighlight(next);
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => !disabled && setOpen((v) => !v)}
        onKeyDown={onKeyDown}
        className={cn(
          'inline-flex w-full items-center justify-between gap-2 border border-ink-600 bg-ink-800 font-semibold text-ink-50 transition',
          'hover:border-ink-500 focus:border-ink-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-45',
          open && 'border-ink-500',
          sizes[size],
          className,
        )}
      >
        <span className={cn('truncate text-left', !selected && 'font-medium text-ink-400')}>
          {selected?.label ?? placeholder}
        </span>
        <span
          className={cn(
            'shrink-0 text-[10px] text-ink-400 transition',
            open && 'rotate-180',
          )}
          aria-hidden
        >
          ▾
        </span>
      </button>

      {open
        ? createPortal(
            <ul
              ref={listRef}
              role="listbox"
              aria-labelledby={id}
              className="fixed z-[10000] max-h-56 overflow-y-auto border border-ink-600 bg-ink-800 py-1 shadow-[0_8px_24px_rgba(15,23,42,0.12)]"
              style={{
                top: pos.openUp ? undefined : pos.top,
                bottom: pos.openUp ? window.innerHeight - pos.top + 4 : undefined,
                left: pos.left,
                width: pos.width,
              }}
            >
              {options.length === 0 ? (
                <li className="px-3 py-2 text-xs text-ink-400">No options</li>
              ) : (
                options.map((opt, i) => (
                  <li key={opt.value || `opt-${i}`} role="option" aria-selected={opt.value === value}>
                    <button
                      type="button"
                      disabled={opt.disabled}
                      onMouseEnter={() => setHighlight(i)}
                      onClick={() => !opt.disabled && pick(opt.value)}
                      className={cn(
                        'flex w-full items-center px-3 py-2 text-left text-xs font-semibold transition',
                        opt.disabled && 'cursor-not-allowed opacity-40',
                        opt.value === value
                          ? 'bg-brand-500 text-white'
                          : highlight === i
                            ? 'bg-ink-600 text-ink-50'
                            : 'text-ink-200 hover:bg-ink-700',
                      )}
                    >
                      {opt.label}
                    </button>
                  </li>
                ))
              )}
            </ul>,
            document.body,
          )
        : null}
    </>
  );
}
