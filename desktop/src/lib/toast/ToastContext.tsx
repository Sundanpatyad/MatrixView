import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';
import { ApiError } from '@/lib/api/client';

export type ToastTone = 'error' | 'success' | 'info';

export type ToastAction = {
  label: string;
  variant?: 'primary' | 'secondary';
  onClick: () => void;
};

export type ToastOptions = {
  tone?: ToastTone;
  sticky?: boolean;
  loading?: boolean;
  progress?: number | null;
  durationMs?: number;
  actions?: ToastAction[];
};

type ToastItem = {
  id: string;
  message: string;
  tone: ToastTone;
  sticky?: boolean;
  loading?: boolean;
  progress?: number | null;
  actions?: ToastAction[];
};

type ToastApi = {
  push: (message: string, toneOrOpts?: ToastTone | ToastOptions) => string;
  update: (id: string, patch: { message?: string } & ToastOptions) => void;
  dismiss: (id: string) => void;
  error: (message: string) => void;
  success: (message: string) => void;
  info: (message: string) => void;
  fromError: (err: unknown, fallback?: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

let toastId = 0;
const timers = new Map<string, number>();

const TONE_STYLES: Record<ToastTone, string> = {
  error:
    'border-[#ed4245]/35 bg-[#ed4245]/12 text-[#c03537] dark:text-[#ffb4b4]',
  success:
    'border-[#4BDE80]/35 bg-[#4BDE80]/12 text-[#1a7a42] dark:text-[#6fe99a]',
  info: 'border-brand-500/35 bg-brand-500/12 text-brand-700 dark:text-brand-300',
};

function normalize(toneOrOpts?: ToastTone | ToastOptions): ToastOptions {
  if (!toneOrOpts) return {};
  if (typeof toneOrOpts === 'string') return { tone: toneOrOpts };
  return toneOrOpts;
}

function ToastViewport({
  items,
  onDismiss,
}: {
  items: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[11000] flex flex-col items-center gap-1.5 px-3 pt-3 sm:items-end sm:px-4 sm:pt-4"
      aria-live="polite"
      aria-relevant="additions"
    >
      {items.map((t) => (
        <div
          key={t.id}
          role={t.tone === 'error' ? 'alert' : 'status'}
          className={cn(
            'pointer-events-auto w-full max-w-[360px] min-w-0 overflow-hidden rounded-lg border shadow-md backdrop-blur-md',
            'animate-[toast-in_0.22s_ease-out]',
            TONE_STYLES[t.tone],
          )}
        >
          <div className="flex items-start gap-2 px-2.5 py-1.5">
            {t.loading ? (
              <span className="mt-0.5 h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : null}
            <p className="min-w-0 flex-1 text-[11px] font-medium leading-snug">{t.message}</p>
            {!t.sticky && !t.actions?.length ? (
              <button
                type="button"
                onClick={() => onDismiss(t.id)}
                className="shrink-0 rounded px-1 py-0.5 text-[10px] font-semibold leading-none opacity-70 transition hover:opacity-100"
                aria-label="Dismiss"
              >
                ✕
              </button>
            ) : null}
          </div>
          {t.loading && t.progress == null ? (
            <div className="h-1 overflow-hidden bg-black/15">
              <div className="h-full w-1/3 rounded-full bg-current opacity-70 animate-[toast-progress-indeterminate_1.2s_ease-in-out_infinite]" />
            </div>
          ) : null}
          {typeof t.progress === 'number' ? (
            <div className="h-1 overflow-hidden bg-black/15">
              <div
                className="h-full bg-current opacity-80 transition-[width] duration-300 ease-out"
                style={{ width: `${Math.max(2, Math.min(100, t.progress))}%` }}
              />
            </div>
          ) : null}
          {t.actions && t.actions.length > 0 ? (
            <div className="flex justify-end gap-1.5 border-t border-current/10 px-2 py-1.5">
              {t.actions.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  onClick={action.onClick}
                  className={cn(
                    'rounded-md px-2 py-1 text-[10px] font-semibold',
                    action.variant === 'primary'
                      ? 'bg-brand-500 text-[#062816]'
                      : 'bg-black/10 hover:bg-black/15',
                  )}
                >
                  {action.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>,
    document.body,
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    const timer = timers.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timers.delete(id);
    }
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const scheduleDismiss = useCallback(
    (id: string, durationMs: number) => {
      const prev = timers.get(id);
      if (prev) window.clearTimeout(prev);
      timers.set(
        id,
        window.setTimeout(() => dismiss(id), durationMs),
      );
    },
    [dismiss],
  );

  const push = useCallback(
    (message: string, toneOrOpts?: ToastTone | ToastOptions) => {
      const opts = normalize(toneOrOpts);
      const text = message.trim();
      if (!text) return '';
      const id = `toast-${++toastId}`;
      const sticky = Boolean(opts.sticky || opts.actions?.length || opts.loading || opts.progress != null);
      setItems((prev) => [
        ...prev.slice(-4),
        {
          id,
          message: text,
          tone: opts.tone ?? 'info',
          sticky,
          loading: opts.loading,
          progress: opts.progress,
          actions: opts.actions,
        },
      ]);
      if (!sticky) {
        scheduleDismiss(id, opts.durationMs ?? (opts.tone === 'error' ? 5500 : 3800));
      }
      return id;
    },
    [scheduleDismiss],
  );

  const update = useCallback(
    (id: string, patch: { message?: string } & ToastOptions) => {
      setItems((prev) =>
        prev.map((item) => {
          if (item.id !== id) return item;
          const actions =
            patch.actions !== undefined
              ? patch.actions.length
                ? patch.actions
                : undefined
              : item.actions;
          const loading = patch.loading !== undefined ? patch.loading : item.loading;
          const progress = patch.progress === undefined ? item.progress : patch.progress;
          const sticky =
            patch.sticky !== undefined
              ? patch.sticky
              : Boolean(item.sticky || actions?.length || loading || progress != null);
          return {
            ...item,
            message: patch.message ?? item.message,
            tone: patch.tone ?? item.tone,
            sticky,
            loading,
            progress,
            actions,
          };
        }),
      );
      const keep =
        patch.sticky === true ||
        Boolean(patch.loading) ||
        Boolean(patch.actions?.length) ||
        patch.progress != null;
      if (keep) {
        const prev = timers.get(id);
        if (prev) {
          window.clearTimeout(prev);
          timers.delete(id);
        }
      } else if (patch.sticky === false) {
        scheduleDismiss(id, patch.durationMs ?? 3800);
      }
    },
    [scheduleDismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      push,
      update,
      dismiss,
      error: (message) => {
        push(message, 'error');
      },
      success: (message) => {
        push(message, 'success');
      },
      info: (message) => {
        push(message, 'info');
      },
      fromError: (err, fallback = 'Something went wrong') => {
        if (err instanceof ApiError) push(err.message || fallback, 'error');
        else if (err instanceof Error) push(err.message || fallback, 'error');
        else push(fallback, 'error');
      },
    }),
    [push, update, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport items={items} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
