import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';

export function HomePage() {
  return (
    <div className="atmosphere relative min-h-screen overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'linear-gradient(rgba(15,23,42,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.04) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
        }}
      />

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-8">
        <header className="flex items-center justify-between">
          <p className="font-display text-2xl font-semibold tracking-tight text-ink-900">
            TaskTrack
          </p>
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="text-sm font-semibold text-ink-700 transition hover:text-brand-700"
            >
              Log in
            </Link>
            <Link to="/signup">
              <Button size="sm">Sign up</Button>
            </Link>
          </div>
        </header>

        <section className="flex flex-1 flex-col justify-center py-16 md:py-24">
          <p className="font-display text-5xl leading-[1.05] font-semibold tracking-tight text-ink-950 md:text-7xl">
            TaskTrack
          </p>
          <h1 className="mt-6 max-w-xl text-xl font-medium text-ink-700 md:text-2xl">
            Capture work at the desk. Decide from the dashboard.
          </h1>
          <p className="mt-4 max-w-lg text-base text-ink-500">
            One backend of record for time, tasks, and teams — Desktop for
            employees, Web for managers.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Link to="/signup">
              <Button size="lg">Start free</Button>
            </Link>
            <Link to="/login">
              <Button size="lg" variant="secondary">
                Log in to portal
              </Button>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
