import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';

type Size = 'xs' | 'sm' | 'md';

type Props = {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  size?: Size;
  clearable?: boolean;
  'aria-label'?: string;
};

const sizes: Record<Size, string> = {
  xs: 'h-7 px-2 text-[11px]',
  sm: 'h-9 px-2.5 text-xs',
  md: 'h-11 px-3 text-sm',
};

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function parseValue(value: string): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function toValue(d: Date) {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatDisplay(value: string) {
  const d = parseValue(value);
  if (!d) return '';
  return d.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'Pick a date',
  disabled,
  className,
  size = 'sm',
  clearable = true,
  'aria-label': ariaLabel,
}: Props) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selected = parseValue(value);
  const [view, setView] = useState(() => selected ?? new Date());
  const [pos, setPos] = useState({ top: 0, left: 0, openUp: false });

  useEffect(() => {
    if (open) setView(selected ?? new Date());
  }, [open, selected]);

  function updatePos() {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < 320 && rect.top > spaceBelow;
    setPos({
      top: openUp ? rect.top : rect.bottom + 4,
      left: Math.min(rect.left, window.innerWidth - 288),
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
      if (triggerRef.current?.contains(t) || panelRef.current?.contains(t)) return;
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
  }, [open]);

  const days = useMemo(() => {
    const year = view.getFullYear();
    const month = view.getMonth();
    const first = new Date(year, month, 1);
    const startPad = first.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<{ date: Date; inMonth: boolean }> = [];

    for (let i = 0; i < startPad; i++) {
      const d = new Date(year, month, i - startPad + 1);
      cells.push({ date: d, inMonth: false });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      cells.push({ date: new Date(year, month, day), inMonth: true });
    }
    while (cells.length % 7 !== 0) {
      const last = cells[cells.length - 1].date;
      const d = new Date(last);
      d.setDate(d.getDate() + 1);
      cells.push({ date: d, inMonth: false });
    }
    return cells;
  }, [view]);

  const today = new Date();

  function pick(d: Date) {
    onChange(toValue(d));
    setOpen(false);
    triggerRef.current?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel ?? 'Choose date'}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => !disabled && setOpen((v) => !v)}
        onKeyDown={onKeyDown}
        className={cn(
          'inline-flex w-full items-center justify-between gap-2 border border-ink-200 bg-white font-semibold text-ink-900 transition',
          'hover:border-ink-300 focus:border-ink-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-45',
          open && 'border-ink-500',
          sizes[size],
          className,
        )}
      >
        <span className={cn('truncate text-left', !value && 'font-medium text-ink-400')}>
          {value ? formatDisplay(value) : placeholder}
        </span>
        <span
          className="flex h-4 w-4 shrink-0 items-center justify-center border border-ink-300 text-[9px] font-bold text-ink-500"
          aria-hidden
        >
          {value ? String(parseValue(value)?.getDate() ?? '') : '·'}
        </span>
      </button>

      {open
        ? createPortal(
            <div
              ref={panelRef}
              role="dialog"
              aria-label="Calendar"
              className="fixed z-[10000] w-72 border border-ink-200 bg-white p-3 shadow-[0_8px_24px_rgba(15,23,42,0.12)]"
              style={{
                top: pos.openUp ? undefined : pos.top,
                bottom: pos.openUp ? window.innerHeight - pos.top + 4 : undefined,
                left: Math.max(8, pos.left),
              }}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <button
                  type="button"
                  className="flex h-7 w-7 items-center justify-center text-ink-500 hover:bg-ink-100 hover:text-ink-900"
                  onClick={() =>
                    setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))
                  }
                  aria-label="Previous month"
                >
                  ‹
                </button>
                <p className="text-xs font-bold text-ink-900">
                  {MONTHS[view.getMonth()]} {view.getFullYear()}
                </p>
                <button
                  type="button"
                  className="flex h-7 w-7 items-center justify-center text-ink-500 hover:bg-ink-100 hover:text-ink-900"
                  onClick={() =>
                    setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))
                  }
                  aria-label="Next month"
                >
                  ›
                </button>
              </div>

              <div className="mb-1 grid grid-cols-7 gap-0.5">
                {WEEKDAYS.map((d) => (
                  <div
                    key={d}
                    className="py-1 text-center text-[10px] font-bold text-ink-400"
                  >
                    {d}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-0.5">
                {days.map(({ date, inMonth }) => {
                  const isSelected = selected ? sameDay(date, selected) : false;
                  const isToday = sameDay(date, today);
                  return (
                    <button
                      key={date.toISOString()}
                      type="button"
                      onClick={() => pick(date)}
                      className={cn(
                        'flex h-8 items-center justify-center text-[11px] font-semibold transition',
                        !inMonth && 'text-ink-300',
                        inMonth && !isSelected && 'text-ink-800 hover:bg-ink-100',
                        isToday && !isSelected && 'ring-1 ring-ink-300',
                        isSelected && 'bg-ink-900 text-white',
                      )}
                    >
                      {date.getDate()}
                    </button>
                  );
                })}
              </div>

              <div className="mt-2 flex items-center justify-between gap-2 border-t border-ink-100 pt-2">
                <button
                  type="button"
                  className="text-[11px] font-semibold text-brand-800 hover:underline"
                  onClick={() => pick(new Date())}
                >
                  Today
                </button>
                {clearable ? (
                  <button
                    type="button"
                    className="text-[11px] font-semibold text-ink-500 hover:text-ink-800"
                    onClick={() => {
                      onChange('');
                      setOpen(false);
                    }}
                  >
                    Clear
                  </button>
                ) : null}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
