import { useEffect, useState } from 'react';
import { IconMoon, IconSun } from '@/components/ui/Icons';
import { Tooltip } from '@/components/ui/Tooltip';
import { cn } from '@/lib/cn';

const STORAGE_KEY = 'dockx.theme';

type Theme = 'light' | 'dark';

function resolveInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.style.colorScheme = theme;
}

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>(resolveInitialTheme);

  useEffect(() => {
    applyTheme(theme);
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const nextTheme = theme === 'dark' ? 'light' : 'dark';
  const label = `Switch to ${nextTheme} mode`;

  return (
    <Tooltip label={label} side="bottom">
      <button
        type="button"
        onClick={() => {
          const next = theme === 'dark' ? 'light' : 'dark';
          applyTheme(next);
          window.localStorage.setItem(STORAGE_KEY, next);
          setTheme(next);
        }}
        className={cn(
          'inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-300 transition-colors hover:bg-ink-700 hover:text-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
          className,
        )}
        aria-label={label}
      >
        {theme === 'dark' ? (
          <IconSun className="h-4 w-4" />
        ) : (
          <IconMoon className="h-4 w-4" />
        )}
      </button>
    </Tooltip>
  );
}
