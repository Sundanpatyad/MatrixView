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
    <div className="relative flex min-h-[100dvh] overflow-hidden bg-ink-950 text-ink-50">
      {/* Ambient canvas */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 55% 45% at 12% 18%, var(--atmosphere-glow), transparent 58%),
            radial-gradient(ellipse 40% 35% at 88% 82%, var(--atmosphere-glow-soft), transparent 55%),
            linear-gradient(155deg, var(--atmosphere-start) 0%, var(--atmosphere-mid) 52%, var(--atmosphere-end) 100%)
          `,
        }}
      />
      <div
        aria-hidden
        className="auth-grid pointer-events-none absolute inset-0 opacity-[0.045] dark:opacity-[0.07]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.035] dark:opacity-[0.04]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

      <ThemeToggle className="absolute top-4 right-4 z-30 sm:top-6 sm:right-6" />

      <div className="relative z-10 mx-auto grid w-full max-w-6xl flex-1 lg:grid-cols-[1.05fr_0.95fr]">
        {/* Brand stage */}
        <aside className="relative flex flex-col justify-between overflow-hidden px-6 pt-10 pb-8 sm:px-10 lg:min-h-[100dvh] lg:px-14 lg:py-16">
          <div
            aria-hidden
            className="auth-orb absolute -top-24 -left-16 h-72 w-72 rounded-full bg-brand-500/20 blur-3xl dark:bg-brand-500/25"
          />
          <div
            aria-hidden
            className="auth-orb-slow absolute right-[-10%] bottom-[8%] h-80 w-80 rounded-full bg-[#23a559]/10 blur-3xl dark:bg-[#23a559]/15"
          />

          <Link
            to="/login"
            className="auth-fade-in relative z-10 inline-flex items-center gap-3 self-start"
          >
            <span className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-[1.15rem] bg-brand-500 shadow-[0_12px_40px_rgba(88,101,242,0.35)] ring-1 ring-white/20">
              <img src="/logo.png" alt="" className="h-7 w-7 object-cover" />
            </span>
            <span className="font-display text-[1.85rem] leading-none font-semibold tracking-tight text-ink-50">
              DockX
            </span>
          </Link>

          <div className="auth-rise relative z-10 mt-14 max-w-lg lg:mt-0 lg:pb-6">
            <p className="text-[11px] font-semibold tracking-[0.22em] text-brand-300 uppercase">
              Desktop workspace
            </p>
            <h1 className="font-display mt-4 text-[2.35rem] leading-[1.08] font-semibold tracking-tight text-ink-50 sm:text-[2.85rem] lg:text-[3.15rem]">
              Focused work.
              <span className="mt-1 block text-ink-300">One calm surface.</span>
            </h1>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-ink-300 sm:text-base">
              Boards, chat, attendance, and timelines — designed for teams that ship together
              without the noise.
            </p>

            <div className="mt-10 hidden gap-8 sm:flex">
              {[
                { label: 'Live boards', detail: 'Realtime kanban' },
                { label: 'Presence', detail: 'Know who’s in' },
                { label: 'Silent login', detail: 'Stay signed in' },
              ].map((item) => (
                <div key={item.label} className="min-w-0">
                  <p className="text-sm font-semibold text-ink-50">{item.label}</p>
                  <p className="mt-1 text-xs text-ink-400">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="relative z-10 hidden text-xs tracking-wide text-ink-400 lg:block">
            © {new Date().getFullYear()} DockX
          </p>
        </aside>

        {/* Sign-in stage */}
        <section className="relative flex items-center justify-center px-5 pb-12 sm:px-8 lg:px-10 lg:py-16">
          <div
            className={cn(
              'auth-rise relative w-full max-w-[400px]',
              'rounded-[1.75rem] border border-ink-600/80 bg-ink-800/75 p-7 shadow-[0_30px_80px_rgba(0,0,0,0.12)] backdrop-blur-2xl sm:p-9',
              'dark:border-white/[0.07] dark:bg-[#1a1b1e]/75 dark:shadow-[0_40px_100px_rgba(0,0,0,0.55)]',
              className,
            )}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-brand-400/50 to-transparent"
            />

            <div className="mb-8">
              <h2 className="text-[1.5rem] font-semibold tracking-tight text-ink-50">{title}</h2>
              <p className="mt-2 text-[13.5px] leading-relaxed text-ink-300">{subtitle}</p>
            </div>

            {children}

            {footer ? (
              <div className="mt-7 border-t border-ink-600/70 pt-6 dark:border-white/[0.06]">
                {footer}
              </div>
            ) : null}
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
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="block text-[12.5px] font-medium tracking-wide text-ink-200">
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
        'h-12 w-full rounded-2xl border border-ink-600/90 bg-ink-900/50 px-4 text-[14px] text-ink-50',
        'placeholder:text-ink-400/90 transition-[border-color,box-shadow,background-color,transform]',
        'hover:border-ink-500 hover:bg-ink-900/80',
        'focus:border-brand-500 focus:bg-ink-900 focus:outline-none focus:ring-[3px] focus:ring-brand-500/20',
        'disabled:cursor-not-allowed disabled:opacity-60',
        'read-only:bg-ink-900/70 read-only:text-ink-300',
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
      className="rounded-2xl border border-[#ed4245]/25 bg-[#ed4245]/10 px-4 py-3 text-[13px] text-[#c03537] dark:text-[#ffb4b4]"
    >
      {message}
    </div>
  );
}
