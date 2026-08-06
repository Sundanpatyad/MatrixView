import { useEffect, useState, type ComponentType, type SVGProps } from 'react';
import { createPortal } from 'react-dom';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  IconBoard,
  IconChat,
  IconDashboard,
  IconLogout,
  IconMenu,
  IconProfile,
  IconX,
} from '@/components/ui/Icons';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { ProfileModal } from '@/components/profile/ProfileModal';
import { RouteErrorBoundary } from '@/components/layout/RouteErrorBoundary';
import { useAttendance } from '@/lib/attendance/AttendanceContext';
import { useAuth } from '@/lib/auth/AuthContext';
import { useOffline } from '@/lib/offline/OfflineContext';
import { cn } from '@/lib/cn';

/** Above every portaled modal so primary nav is never blocked. */
const NAV_RAIL_Z = 2147483000;

type NavItem = {
  to: string;
  label: string;
  end?: boolean;
  Icon: ComponentType<SVGProps<SVGSVGElement> & { className?: string }>;
};

const nav: NavItem[] = [
  { to: '/', label: 'Dashboard', Icon: IconDashboard, end: true },
  { to: '/board', label: 'Board', Icon: IconBoard },
  { to: '/chat', label: 'Chat', Icon: IconChat },
];

export function AppShell() {
  const { user, logout } = useAuth();
  const { checkedIn, onBreak, elapsedLabel } = useAttendance();
  const { online, syncing, pendingCount, sqliteReady } = useOffline();
  const navigate = useNavigate();
  const location = useLocation();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    document.documentElement.style.setProperty('--dockx-sidebar-w', '3.5rem');
  }, []);

  useEffect(() => {
    setMobileNavOpen(false);
    setProfileOpen(false);
    setConfirmLogout(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileNavOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileNavOpen]);

  function go(to: string) {
    setMobileNavOpen(false);
    setProfileOpen(false);
    setConfirmLogout(false);
    navigate(to);
  }

  const status = !checkedIn ? 'Out' : onBreak ? 'Break' : 'In';
  const offlineLabel = !online
    ? 'Offline'
    : syncing
      ? 'Syncing…'
      : pendingCount > 0
        ? `${pendingCount} pending`
        : sqliteReady
          ? 'Local DB'
          : null;

  const escapeRail =
    typeof document !== 'undefined'
      ? createPortal(
          <nav
            aria-label="Primary"
            className="pointer-events-auto fixed inset-y-0 left-0 hidden w-14 flex-col items-center gap-1.5 border-r border-ink-800 bg-ink-950 py-4 md:flex"
            style={{ zIndex: NAV_RAIL_Z }}
          >
            <button
              type="button"
              title="DockX home"
              onClick={() => go('/')}
              className="mb-3 shrink-0 overflow-hidden rounded-lg"
            >
              <img src="/logo.png" alt="DockX" className="h-8 w-8 object-cover" />
            </button>
            {nav.map((item) => {
              const active = item.end
                ? location.pathname === item.to
                : location.pathname === item.to ||
                  location.pathname.startsWith(`${item.to}/`);
              return (
                <button
                  key={item.to}
                  type="button"
                  title={item.label}
                  onClick={() => go(item.to)}
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-xl transition-colors',
                    active
                      ? 'bg-brand-500 text-[#062816]'
                      : 'text-ink-300 hover:bg-brand-500/80 hover:text-[#062816]',
                  )}
                >
                  <item.Icon className="shrink-0" />
                </button>
              );
            })}
            <button
              type="button"
              title="Profile"
              onClick={() => setProfileOpen(true)}
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-xl transition-colors',
                profileOpen
                  ? 'bg-brand-500 text-[#062816]'
                  : 'text-ink-300 hover:bg-brand-500/80 hover:text-[#062816]',
              )}
            >
              <IconProfile className="shrink-0" />
            </button>
            <button
              type="button"
              title="Sign out"
              onClick={() => setConfirmLogout(true)}
              className="mt-auto mb-1 flex h-9 w-9 items-center justify-center rounded-md text-ink-400 hover:bg-ink-900 hover:text-ink-100"
            >
              <IconLogout className="shrink-0" />
            </button>
          </nav>,
          document.body,
        )
      : null;

  const mobileDrawer =
    mobileNavOpen && typeof document !== 'undefined'
      ? createPortal(
          <div className="fixed inset-0 md:hidden" style={{ zIndex: NAV_RAIL_Z }}>
            <button
              type="button"
              aria-label="Close menu"
              className="absolute inset-0 bg-black/50"
              onClick={() => setMobileNavOpen(false)}
            />
            <aside className="absolute inset-y-0 left-0 flex w-[min(18rem,85vw)] flex-col border-r border-ink-800 bg-ink-950 px-3 py-4 shadow-xl">
              <div className="flex items-center justify-between gap-2 px-1">
                <div className="flex min-w-0 items-center gap-2.5">
                  <img
                    src="/logo.png"
                    alt=""
                    className="h-8 w-8 shrink-0 rounded-lg object-cover"
                  />
                  <span className="truncate text-sm font-semibold text-ink-50">DockX</span>
                </div>
                <button
                  type="button"
                  aria-label="Close menu"
                  onClick={() => setMobileNavOpen(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-md text-ink-400 hover:bg-ink-900 hover:text-ink-100"
                >
                  <IconX className="h-5 w-5" />
                </button>
              </div>
              <nav className="mt-6 flex flex-1 flex-col gap-1.5">
                {nav.map((item) => {
                  const active = item.end
                    ? location.pathname === item.to
                    : location.pathname === item.to ||
                      location.pathname.startsWith(`${item.to}/`);
                  return (
                    <button
                      key={item.to}
                      type="button"
                      onClick={() => go(item.to)}
                      className={cn(
                        'flex h-9 items-center gap-2.5 rounded-xl px-2.5 text-sm font-medium transition-colors',
                        active
                          ? 'bg-brand-500 text-[#062816]'
                          : 'text-ink-300 hover:bg-brand-500/80 hover:text-[#062816]',
                      )}
                    >
                      <item.Icon className="shrink-0" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => {
                    setMobileNavOpen(false);
                    setProfileOpen(true);
                  }}
                  className={cn(
                    'flex h-9 items-center gap-2.5 rounded-xl px-2.5 text-sm font-medium transition-colors',
                    profileOpen
                      ? 'bg-brand-500 text-[#062816]'
                      : 'text-ink-300 hover:bg-brand-500/80 hover:text-[#062816]',
                  )}
                >
                  <IconProfile className="shrink-0" />
                  <span>Profile</span>
                </button>
              </nav>
              <button
                type="button"
                onClick={() => {
                  setMobileNavOpen(false);
                  setConfirmLogout(true);
                }}
                className="mb-1 flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium text-ink-400 transition-colors hover:bg-ink-900 hover:text-ink-100"
              >
                <IconLogout className="shrink-0" />
                <span>Sign out</span>
              </button>
            </aside>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-ink-900">
      {escapeRail}
      {mobileDrawer}

      <div className="hidden w-14 shrink-0 md:block" aria-hidden />

      <ConfirmModal
        open={confirmLogout}
        title="Sign out?"
        message="You’ll need to sign in again to use DockX on this device."
        confirmLabel="Sign out"
        danger
        busy={loggingOut}
        onCancel={() => setConfirmLogout(false)}
        onConfirm={async () => {
          setLoggingOut(true);
          try {
            await logout();
            setConfirmLogout(false);
            navigate('/login');
          } finally {
            setLoggingOut(false);
          }
        }}
      />

      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="relative z-20 flex h-12 shrink-0 items-center justify-between gap-3 border-b border-ink-800 bg-ink-900 px-3 sm:px-4 md:px-5">
          <div className="flex min-w-0 items-center gap-2.5 text-sm">
            <button
              type="button"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-300 hover:bg-ink-700 hover:text-ink-50 md:hidden"
              aria-label="Open menu"
              onClick={() => setMobileNavOpen(true)}
            >
              <IconMenu className="h-5 w-5" />
            </button>
            <span className="font-semibold tracking-tight text-ink-50">DockX</span>
            <div className="flex items-center gap-0.5">
              {nav.map((item) => {
                const active = item.end
                  ? location.pathname === item.to
                  : location.pathname === item.to ||
                    location.pathname.startsWith(`${item.to}/`);
                return (
                  <button
                    key={item.to}
                    type="button"
                    onClick={() => go(item.to)}
                    className={cn(
                      'rounded-md px-2 py-1 text-xs font-semibold transition-colors',
                      active
                        ? 'bg-brand-500/15 text-brand-300'
                        : 'text-ink-400 hover:bg-ink-700 hover:text-ink-100',
                    )}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
            <span className="hidden h-4 w-px bg-ink-600 sm:block" aria-hidden />
            <span className="flex items-center gap-1.5 text-xs text-ink-300">
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  !checkedIn
                    ? 'bg-ink-400'
                    : onBreak
                      ? 'bg-[#f0b232]'
                      : 'bg-[#4BDE80]',
                )}
              />
              <span className="hidden sm:inline">{status}</span>
              {checkedIn ? (
                <span className="font-semibold tabular-nums text-ink-200">
                  {elapsedLabel}
                </span>
              ) : null}
            </span>
            {offlineLabel ? (
              <>
                <span className="hidden h-4 w-px bg-ink-600 sm:block" aria-hidden />
                <span
                  className={cn(
                    'hidden items-center gap-1.5 text-xs font-medium sm:flex',
                    !online ? 'text-[#fee75c]' : 'text-ink-400',
                  )}
                  title="SQLite offline cache"
                >
                  <span
                    className={cn(
                      'h-1.5 w-1.5 rounded-full',
                      !online ? 'bg-[#f0b232]' : syncing ? 'bg-[#00a8fc]' : 'bg-ink-400',
                    )}
                  />
                  {offlineLabel}
                </span>
              </>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <NotificationBell />
            <ThemeToggle />
            <button
              type="button"
              title="My profile"
              onClick={() => setProfileOpen(true)}
              className="ml-1 flex items-center gap-2 rounded-md px-2 py-1 transition-colors hover:bg-ink-700"
            >
              <div className="hidden text-right leading-tight sm:block">
                <p className="text-xs font-semibold text-ink-50">{user?.name}</p>
                <p className="text-[11px] text-ink-400">{user?.role}</p>
              </div>
              <UserAvatar
                name={user?.name || 'User'}
                src={user?.avatarUrl}
                seed={user?.email || user?.name || 'user'}
                size="sm"
                className="!h-7 !w-7 !text-[10px]"
              />
            </button>
          </div>
        </header>

        <main className="relative z-0 min-h-0 flex-1 overflow-hidden bg-ink-900">
          <RouteErrorBoundary key={location.pathname}>
            <Outlet />
          </RouteErrorBoundary>
        </main>
      </div>
    </div>
  );
}
