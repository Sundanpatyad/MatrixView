import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';

/** Above the nav rail so sidebar tips are never clipped. */
export const TOOLTIP_Z = 2147483645;

type Side = 'top' | 'bottom' | 'left' | 'right';

type Props = {
  label: ReactNode;
  side?: Side;
  delay?: number;
  children: ReactNode;
  className?: string;
};

export function Tooltip({
  label,
  side = 'bottom',
  delay = 180,
  children,
  className,
}: Props) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const timerRef = useRef(0);
  const tipId = useId();

  const hide = useCallback(() => {
    window.clearTimeout(timerRef.current);
    setVisible(false);
  }, []);

  const show = useCallback(() => {
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      const el = wrapRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const gap = 8;
      let top = 0;
      let left = 0;
      switch (side) {
        case 'right':
          top = r.top + r.height / 2;
          left = r.right + gap;
          break;
        case 'left':
          top = r.top + r.height / 2;
          left = r.left - gap;
          break;
        case 'top':
          top = r.top - gap;
          left = r.left + r.width / 2;
          break;
        default:
          top = r.bottom + gap;
          left = r.left + r.width / 2;
      }
      setPos({ top, left });
      setVisible(true);
    }, delay);
  }, [delay, side]);

  useEffect(() => {
    if (!visible) return;
    const onMove = () => hide();
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => {
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
    };
  }, [visible, hide]);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  if (label == null || label === '') return <>{children}</>;

  const transform =
    side === 'right'
      ? 'translateY(-50%)'
      : side === 'left'
        ? 'translate(-100%, -50%)'
        : side === 'top'
          ? 'translate(-50%, -100%)'
          : 'translateX(-50%)';

  return (
    <>
      <span
        ref={wrapRef}
        className={cn('inline-flex', className)}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
      >
        {children}
      </span>
      {visible && pos
        ? createPortal(
            <span
              id={tipId}
              role="tooltip"
              className={cn(
                'pointer-events-none fixed z-[2147483645] max-w-[16rem] whitespace-nowrap rounded-md',
                'border border-ink-600/90 bg-ink-950 px-2 py-1 text-[11px] font-medium leading-tight',
                'tracking-wide text-ink-50 shadow-lg shadow-black/45',
              )}
              style={{ top: pos.top, left: pos.left, transform }}
            >
              {label}
            </span>,
            document.body,
          )
        : null}
    </>
  );
}
