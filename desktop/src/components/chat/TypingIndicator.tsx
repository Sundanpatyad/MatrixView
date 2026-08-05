import { useEffect, useState } from 'react';

import { cn } from '@/lib/cn';

function Dot({ delayMs }: { delayMs: number }) {
  return (
    <span
      className="inline-block h-1.5 w-1.5 rounded-full bg-current"
      style={{
        animation: 'dockx-typing-bounce 1.05s ease-in-out infinite',
        animationDelay: `${delayMs}ms`,
      }}
    />
  );
}

/**
 * Animated “is typing” pill shown above the composer. Mirrors the mobile
 * TypingIndicator so desktop and the site feel the same.
 */
export function TypingIndicator({ names }: { names: string[] }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(names.length > 0);
  }, [names.length]);

  if (!visible || names.length === 0) return null;

  const label =
    names.length === 1
      ? `${names[0]} is typing`
      : names.length === 2
        ? `${names[0]} and ${names[1]} are typing`
        : `${names[0]} and ${names.length - 1} others are typing`;

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 pb-1.5 pt-1 sm:px-5',
        'animate-[dockx-typing-fade_160ms_ease-out]',
      )}
      aria-live="polite"
      aria-label={label}
    >
      <style>{`
        @keyframes dockx-typing-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.35; }
          30% { transform: translateY(-3px); opacity: 1; }
        }
        @keyframes dockx-typing-fade {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div className="inline-flex items-center gap-1 rounded-full border border-ink-600/70 bg-ink-800/90 px-3 py-2 text-ink-300">
        <Dot delayMs={0} />
        <Dot delayMs={140} />
        <Dot delayMs={280} />
      </div>
      <span className="truncate text-[12px] italic text-ink-400">{label}</span>
    </div>
  );
}
