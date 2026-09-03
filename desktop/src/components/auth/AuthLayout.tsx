import type { InputHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { cn } from '@/lib/cn';

type AuthLayoutProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
};

export function AuthLayout({ title, subtitle, children, footer, className }: AuthLayoutProps) {
  return (
    <div className="atmosphere relative flex min-h-[100dvh] text-ink-50">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.04] dark:opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

      <ThemeToggle className="absolute top-5 right-5 z-20" />

      <div className="relative z-10 mx-auto grid w-full max-w-6xl flex-1 lg:grid-cols-2">
        {/* Brand column */}
        <aside className="flex flex-col justify-between px-8 pt-10 pb-8 sm:px-12 lg:border-r lg:border-ink-600/60 lg:px-14 lg:py-14">
          <Link to="/login" className="inline-flex items-center gap-2.5 self-start">
            <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg">
              <img src="/logo.png" alt="" className="h-9 w-9 object-cover" />
            </span>
            <span className="text-[1.25rem] font-semibold tracking-tight text-ink-50">DockX</span>
          </Link>

          <div className="mt-14 max-w-md lg:mt-0">
            <p className="text-[11px] font-semibold tracking-[0.2em] text-brand-300 uppercase">
              Workspace OS
            </p>
            <h1 className="font-display mt-3 text-[2.25rem] leading-[1.12] font-semibold tracking-tight text-ink-50 sm:text-[2.6rem]">
              Ship work together.
              <br />
              Stay in sync.
            </h1>
            <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-ink-300">
              Boards, chat, attendance, and timelines in one desktop workspace built for focused
              teams.
            </p>

            <ul className="mt-9 hidden space-y-3 lg:block">
              {[
                'Projects and kanban that stay live',
                'Presence and attendance at a glance',
                'Secure sign-in that remembers this device',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-ink-200">
                  <svg
                    className="mt-0.5 h-4 w-4 shrink-0 text-brand-400"
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden
                  >
                    <path
                      d="M3.5 8.5 6.5 11.5 12.5 4.5"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <p className="mt-12 text-xs text-ink-400 lg:mt-0">
            © {new Date().getFullYear()} DockX
          </p>
        </aside>

        {/* Form column — flush, no card */}
        <section className="flex items-center px-8 py-10 sm:px-12 lg:px-14 lg:py-14">
          <div
            className={cn(
              'mx-auto w-full max-w-[380px]',
              'animate-[auth-rise_420ms_cubic-bezier(0.22,1,0.36,1)_both]',
              className,
            )}
          >
            <header className="mb-7">
              <h2 className="text-[1.375rem] font-semibold tracking-tight text-ink-50">{title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-300">{subtitle}</p>
            </header>

            {children}

            {footer ? <div className="mt-7">{footer}</div> : null}
          </div>
        </section>
      </div>
    </div>
  );
}

export function AuthField({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="block text-[13px] font-medium text-ink-200">
          {label}
        </label>
        {hint ? <span className="text-[11px] text-ink-400">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

export function AuthInput({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-11 w-full rounded-lg border border-ink-600 bg-ink-900/55 px-3.5 text-sm text-ink-50',
        'placeholder:text-ink-400 transition-[border-color,background-color]',
        'hover:border-ink-500',
        'focus:border-brand-500 focus:bg-ink-900/80 focus:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-55',
        'read-only:bg-ink-900/40 read-only:text-ink-300',
        className,
      )}
      {...props}
    />
  );
}

export function AuthError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-sm text-[#c03537] dark:text-[#ffb4b4]">
      {message}
    </p>
  );
}

export function AuthDivider({ label = 'or' }: { label?: string }) {
  return (
    <div className="flex items-center gap-3" aria-hidden>
      <div className="h-px flex-1 bg-ink-600" />
      <span className="text-[11px] font-medium tracking-wide text-ink-400 uppercase">{label}</span>
      <div className="h-px flex-1 bg-ink-600" />
    </div>
  );
}
