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
    <div className="atmosphere relative flex min-h-[100dvh] overflow-hidden text-ink-50">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.04] dark:opacity-[0.035]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

      <ThemeToggle className="absolute top-4 right-4 z-20 sm:top-5 sm:right-5" />

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col lg:flex-row lg:items-stretch">
        {/* Brand panel */}
        <aside className="relative flex flex-col justify-between px-6 pt-10 pb-6 sm:px-10 lg:w-[46%] lg:px-12 lg:py-14">
          <Link to="/login" className="inline-flex items-center gap-3 self-start">
            <span className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-brand-500 shadow-[0_8px_28px_rgba(88,101,242,0.28)] ring-1 ring-black/5 dark:ring-white/15">
              <img src="/logo.png" alt="" className="h-7 w-7 object-cover" />
            </span>
            <span className="font-display text-[1.65rem] leading-none font-semibold tracking-tight text-ink-50">
              DockX
            </span>
          </Link>

          <div className="mt-10 max-w-md lg:mt-0 lg:pb-8">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-brand-300 uppercase">
              Workspace OS
            </p>
            <h1 className="font-display mt-3 text-[2.15rem] leading-[1.12] font-semibold tracking-tight text-ink-50 sm:text-[2.55rem]">
              Ship work together.
              <span className="mt-1 block text-ink-300">Stay in sync.</span>
            </h1>
            <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-ink-300">
              Boards, chat, attendance, and timelines in one calm desktop workspace built for
              focused teams.
            </p>

            <ul className="mt-8 hidden space-y-3 sm:block">
              {[
                'Projects & kanban that stay live',
                'Presence and attendance at a glance',
                'Secure silent login after first sign-in',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-ink-200">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <p className="hidden text-xs text-ink-400 lg:block">
            © {new Date().getFullYear()} DockX
          </p>
        </aside>

        {/* Form panel */}
        <section className="flex flex-1 items-center justify-center px-5 pb-10 sm:px-8 lg:px-10 lg:py-14">
          <div
            className={cn(
              'w-full max-w-[420px] rounded-2xl border border-ink-600 bg-ink-800/90 p-6 shadow-xl shadow-black/5 backdrop-blur-xl sm:p-8 dark:bg-ink-800/80 dark:shadow-black/40',
              'animate-[auth-rise_420ms_cubic-bezier(0.22,1,0.36,1)_both]',
              className,
            )}
          >
            <div className="mb-7">
              <h2 className="text-[1.35rem] font-semibold tracking-tight text-ink-50">{title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-300">{subtitle}</p>
            </div>
            {children}
            {footer ? <div className="mt-6">{footer}</div> : null}
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
        'h-11 w-full rounded-xl border border-ink-600 bg-ink-900/80 px-3.5 text-sm text-ink-50',
        'placeholder:text-ink-400 transition-[border-color,box-shadow,background-color]',
        'hover:border-ink-500 hover:bg-ink-900',
        'focus:border-brand-500 focus:bg-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-500/25',
        'disabled:cursor-not-allowed disabled:opacity-60',
        'read-only:bg-ink-900 read-only:text-ink-300',
        className,
      )}
      {...props}
    />
  );
}

export function AuthError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="rounded-xl border border-[#ed4245]/30 bg-[#ed4245]/10 px-3.5 py-2.5 text-sm text-[#c03537] dark:text-[#ffb4b4]"
    >
      {message}
    </div>
  );
}
