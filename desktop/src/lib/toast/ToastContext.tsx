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

type ToastItem = {
  id: string;
  message: string;
  tone: ToastTone;
};

type ToastApi = {
  push: (message: string, tone?: ToastTone) => void;
  error: (message: string) => void;
  success: (message: string) => void;
  info: (message: string) => void;
  fromError: (err: unknown, fallback?: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

let toastId = 0;

const TONE_STYLES: Record<ToastTone, string> = {
  error:
    'border-[#ed4245]/35 bg-[#ed4245]/12 text-[#c03537] dark:text-[#ffb4b4]',
  success:
    'border-[#23a559]/35 bg-[#23a559]/12 text-[#1a7a42] dark:text-[#57f287]',
  info: 'border-brand-500/35 bg-brand-500/12 text-brand-700 dark:text-brand-300',
};

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
      className="pointer-events-none fixed inset-x-0 top-0 z-[200] flex flex-col items-center gap-1.5 px-3 pt-3 sm:items-end sm:px-4 sm:pt-4"
      aria-live="polite"
      aria-relevant="additions"
    >
      {items.map((t) => (
        <div
          key={t.id}
          role={t.tone === 'error' ? 'alert' : 'status'}
          className={cn(
            'pointer-events-auto flex max-w-[280px] min-w-0 items-center gap-2 rounded-lg border px-2.5 py-1.5 shadow-md backdrop-blur-md',
            'animate-[toast-in_0.22s_ease-out]',
            TONE_STYLES[t.tone],
          )}
        >
          <p className="min-w-0 flex-1 text-[11px] font-medium leading-snug">{t.message}</p>
          <button
            type="button"
            onClick={() => onDismiss(t.id)}
            className="shrink-0 rounded px-1 py-0.5 text-[10px] font-semibold leading-none opacity-70 transition hover:opacity-100"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      ))}
    </div>,
    document.body,
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (message: string, tone: ToastTone = 'info') => {
      const text = message.trim();
      if (!text) return;
      const id = `toast-${++toastId}`;
      setItems((prev) => [...prev.slice(-4), { id, message: text, tone }]);
      window.setTimeout(() => dismiss(id), tone === 'error' ? 5500 : 3800);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      push,
      error: (message) => push(message, 'error'),
      success: (message) => push(message, 'success'),
      info: (message) => push(message, 'info'),
      fromError: (err, fallback = 'Something went wrong') => {
        if (err instanceof ApiError) push(err.message || fallback, 'error');
        else if (err instanceof Error) push(err.message || fallback, 'error');
        else push(fallback, 'error');
      },
    }),
    [push],
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
