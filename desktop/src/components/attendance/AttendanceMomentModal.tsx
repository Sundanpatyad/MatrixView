import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';

export type CheckPopupKind = 'in' | 'out';

type Props = {
  open: boolean;
  mode: 'confirm' | 'success';
  kind: CheckPopupKind;
  message: string;
  timeLabel?: string | null;
  busy?: boolean;
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
  onClose?: () => void;
  onShuffle?: () => void;
};

function ClockMark({ mode }: { mode: 'confirm' | 'success' }) {
  return (
    <div
      className={cn(
        'attendance-mark relative flex h-16 w-16 items-center justify-center border border-ink-600 bg-ink-900',
        mode === 'success' && 'attendance-mark-pop',
      )}
    >
      <span className="attendance-ring" aria-hidden />
      <svg
        viewBox="0 0 48 48"
        className={cn(
          'relative z-[1] h-9 w-9 text-ink-100',
          mode === 'confirm' && 'attendance-tick',
        )}
        fill="none"
        aria-hidden
      >
        <circle cx="24" cy="24" r="18" stroke="currentColor" strokeWidth="2.2" opacity="0.35" />
        {mode === 'success' ? (
          <path
            d="M15 24.5 21.5 31 33 17"
            stroke="currentColor"
            strokeWidth="2.8"
            strokeLinecap="square"
            strokeLinejoin="miter"
            className="attendance-check"
          />
        ) : (
          <>
            <path
              d="M24 14v11l7 4"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="square"
              strokeLinejoin="miter"
            />
            <circle cx="24" cy="24" r="2.2" fill="currentColor" />
          </>
        )}
      </svg>
    </div>
  );
}

export function AttendanceMomentModal({
  open,
  mode,
  kind,
  message,
  timeLabel,
  busy = false,
  onConfirm,
  onCancel,
  onClose,
  onShuffle,
}: Props) {
  const titleId = useId();
  const isIn = kind === 'in';
  const isConfirm = mode === 'confirm';
  const [hoverPause, setHoverPause] = useState(false);
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) {
        if (isConfirm) onCancel?.();
        else onClose?.();
      }
      if (e.key === 'Enter' && isConfirm && !busy) {
        e.preventDefault();
        void onConfirm?.();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, isConfirm, onCancel, onClose, onConfirm]);

  useEffect(() => {
    if (!open || isConfirm || hoverPause) return;
    const timer = window.setTimeout(() => onClose?.(), 5200);
    return () => window.clearTimeout(timer);
  }, [open, isConfirm, hoverPause, onClose, message]);

  if (!open) return null;

  const title = isConfirm
    ? isIn
      ? 'Ready to check in?'
      : 'Ready to check out?'
    : isIn
      ? 'You’re on the clock'
      : 'That’s a wrap';

  const eyebrow = isConfirm
    ? isIn
      ? 'Start your day'
      : 'End your session'
    : isIn
      ? `Checked in${timeLabel ? ` · ${timeLabel}` : ''}`
      : `Checked out${timeLabel ? ` · ${timeLabel}` : ''}`;

  function handleShuffle() {
    onShuffle?.();
    setShake(true);
    window.setTimeout(() => setShake(false), 420);
  }

  return createPortal(
    <div className="attendance-backdrop fixed inset-0 z-[10000] flex items-center justify-center bg-black/55 p-4">
      <button
        type="button"
        className="absolute inset-0"
        onClick={() => {
          if (busy) return;
          if (isConfirm) onCancel?.();
          else onClose?.();
        }}
        aria-label="Close"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="attendance-card relative z-10 w-full max-w-sm border border-ink-600 bg-ink-800 shadow-lg"
        onClick={(e) => e.stopPropagation()}
        onMouseEnter={() => setHoverPause(true)}
        onMouseLeave={() => setHoverPause(false)}
      >
        <div className="attendance-sheen" aria-hidden />

        <div className="relative p-5">
          <div className="flex justify-center">
            <ClockMark mode={mode} />
          </div>

          <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-300">
            {eyebrow}
          </p>

          <h2
            id={titleId}
            className="font-display mt-2 text-xl font-semibold leading-tight text-ink-50"
          >
            {title}
          </h2>

          <p
            className={cn(
              'mt-2 min-h-[3.25rem] text-sm leading-relaxed text-ink-200',
              shake && 'attendance-msg-shake',
            )}
          >
            {message}
          </p>

          {onShuffle ? (
            <button
              type="button"
              onClick={handleShuffle}
              disabled={busy}
              className="mt-2 border border-ink-600 bg-ink-800 px-3 py-1 text-[11px] font-semibold text-ink-200 transition hover:border-ink-500 hover:bg-ink-900 hover:text-ink-50 active:scale-[0.98] disabled:opacity-40"
            >
              Another line
            </button>
          ) : null}

          <div className="mt-5 flex justify-end gap-2">
            {isConfirm ? (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={busy}
                  onClick={onCancel}
                >
                  Not yet
                </Button>
                <Button
                  type="button"
                  variant={isIn ? 'primary' : 'danger'}
                  size="sm"
                  disabled={busy}
                  onClick={() => void onConfirm?.()}
                  className="attendance-cta"
                >
                  {busy ? 'Working…' : isIn ? 'Check in' : 'Check out'}
                </Button>
              </>
            ) : (
              <Button type="button" size="sm" onClick={onClose} className="attendance-cta">
                {isIn ? 'Let’s go' : 'See you'}
              </Button>
            )}
          </div>

          {!isConfirm ? (
            <div className="mt-4 h-1 overflow-hidden bg-ink-700">
              <div
                key={message}
                className={cn(
                  'attendance-dismiss-bar h-full bg-brand-500',
                  hoverPause && 'attendance-dismiss-paused',
                )}
              />
            </div>
          ) : (
            <p className="mt-3 text-[11px] text-ink-400">
              Press Enter to confirm · Esc to cancel
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
