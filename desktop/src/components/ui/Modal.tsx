import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { IconX } from '@/components/ui/Icons';
import { cn } from '@/lib/cn';

const SIZE = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-3xl',
  '2xl': 'max-w-4xl',
  '3xl': 'max-w-[74rem]',
} as const;

type ModalProps = {
  children: ReactNode;
  onClose: () => void;
  size?: keyof typeof SIZE;
  labelledBy?: string;
  describedBy?: string;
  className?: string;
  overlayClassName?: string;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  zClass?: string;
};

export function Modal({
  children,
  onClose,
  size = 'md',
  labelledBy,
  describedBy,
  className,
  overlayClassName,
  closeOnBackdrop = true,
  closeOnEscape = true,
  zClass = 'z-[9999]',
}: ModalProps) {
  useEffect(() => {
    if (!closeOnEscape) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeOnEscape, onClose]);

  return createPortal(
    <div
      className={cn(
        'dockx-modal-layer fixed inset-0 flex items-end justify-center bg-black/60 p-0 backdrop-blur-[2px] sm:items-center sm:p-5',
        zClass,
        overlayClassName,
      )}
    >
      {closeOnBackdrop ? (
        <button
          type="button"
          className="absolute inset-0 cursor-default"
          onClick={onClose}
          aria-label="Close"
        />
      ) : (
        <div className="absolute inset-0" aria-hidden />
      )}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        className={cn(
          'relative z-10 flex w-full flex-col overflow-hidden rounded-t-2xl border border-ink-600/80 bg-ink-800',
          'shadow-[0_24px_80px_rgba(0,0,0,0.5)] sm:rounded-2xl',
          'max-h-[100dvh] sm:max-h-[min(92vh,840px)]',
          SIZE[size],
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

type HeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  kicker?: ReactNode;
  onClose?: () => void;
  extra?: ReactNode;
  titleId?: string;
};

export function ModalHeader({
  title,
  description,
  kicker,
  onClose,
  extra,
  titleId,
}: HeaderProps) {
  return (
    <header className="flex shrink-0 items-start justify-between gap-3 border-b border-ink-700/80 px-5 py-4">
      <div className="min-w-0 flex-1">
        {kicker ? (
          <p className="text-[11px] font-semibold tracking-wide text-ink-400 uppercase">{kicker}</p>
        ) : null}
        <h2
          id={titleId}
          className={cn('font-semibold tracking-tight text-ink-50', kicker ? 'mt-0.5 text-lg' : 'text-lg')}
        >
          {title}
        </h2>
        {description ? (
          <p className="mt-1 text-sm leading-relaxed text-ink-300">{description}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {extra}
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-400 transition hover:bg-ink-700 hover:text-ink-50"
          >
            <IconX className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </header>
  );
}

export function ModalBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn('min-h-0 flex-1 overflow-y-auto px-5 py-4', className)}>{children}</div>;
}

export function ModalFooter({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-end gap-2 border-t border-ink-700/80 px-5 py-3.5',
        className,
      )}
    >
      {children}
    </div>
  );
}
