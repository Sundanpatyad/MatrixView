import { Link, Outlet } from 'react-router-dom';

export function AuthLayout() {
  return (
    <div className="atmosphere relative min-h-screen">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-8">
        <header className="flex items-center justify-between">
          <Link to="/" className="font-display text-2xl font-semibold tracking-tight text-ink-900">
            TaskTrack
          </Link>
          <Link
            to="/"
            className="text-sm font-medium text-ink-600 transition hover:text-brand-700"
          >
            Back to home
          </Link>
        </header>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-md">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}
