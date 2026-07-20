export function ThemeToggle({ className = "" }: { className?: string }) {
  function toggleTheme() {
    const root = document.documentElement;
    const nextIsDark = !root.classList.contains("dark");
    root.classList.toggle("dark", nextIsDark);
    root.style.colorScheme = nextIsDark ? "dark" : "light";
    window.localStorage.setItem("dockx.theme", nextIsDark ? "dark" : "light");
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full border border-ink-600 bg-ink-800 text-ink-200 transition-colors hover:bg-ink-700 hover:text-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${className}`}
      title="Toggle light and dark mode"
      aria-label="Toggle light and dark mode"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4 dark:hidden" fill="none" aria-hidden>
        <path
          d="M20 15.2A8 8 0 0 1 8.8 4a8 8 0 1 0 11.2 11.2Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
      <svg viewBox="0 0 24 24" className="hidden h-4 w-4 dark:block" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}
