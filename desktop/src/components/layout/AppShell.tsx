import { useEffect, useState, type ComponentType, type SVGProps } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  IconBoard,
  IconChat,
  IconChevronLeft,
  IconChevronRight,
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
import { useAttendance } from '@/lib/attendance/AttendanceContext';
import { useAuth } from '@/lib/auth/AuthContext';
import { useOffline } from '@/lib/offline/OfflineContext';
import { cn } from '@/lib/cn';

const SIDEBAR_COLLAPSED_KEY = 'dockx-sidebar-collapsed';

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

function NavItems({
  collapsed,
  onNavigate,
  profileOpen,
  onOpenProfile,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
  profileOpen: boolean;
  onOpenProfile: () => void;
}) {
  return (
    <>
      {nav.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          title={collapsed ? item.label : undefined}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center rounded-xl transition-colors',
              collapsed
                ? 'h-9 w-9 justify-center'
                : 'h-9 gap-2.5 px-2.5 text-sm font-medium',
              isActive
                ? 'bg-brand-500 text-white'
                : 'text-ink-300 hover:bg-brand-500/80 hover:text-white',
            )
          }
        >
          <item.Icon className="shrink-0" />
          {!collapsed ? <span className="truncate">{item.label}</span> : null}
        </NavLink>
      ))}
      <button
        type="button"
        title={collapsed ? 'Profile' : undefined}
        onClick={() => {
          onOpenProfile();
          onNavigate?.();
        }}
        className={cn(
          'flex items-center rounded-xl transition-colors',
          collapsed
            ? 'h-9 w-9 justify-center'
            : 'h-9 gap-2.5 px-2.5 text-sm font-medium',
          profileOpen
            ? 'bg-brand-500 text-white'
            : 'text-ink-300 hover:bg-brand-500/80 hover:text-white',
        )}
      >
        <IconProfile className="shrink-0" />
        {!collapsed ? <span className="truncate">Profile</span> : null}
      </button>
    </>
  );
}

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
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) !== 'false';
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? 'true' : 'false');
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileNavOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileNavOpen]);

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

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-ink-900">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden shrink-0 flex-col border-r border-ink-800 bg-ink-950 py-4 transition-[width] duration-200 ease-out md:flex',
          collapsed ? 'w-14 items-center px-0' : 'w-52 px-3',
        )}
      >
        <div
          className={cn(
            'flex items-center',
            collapsed ? 'justify-center' : 'gap-2.5 px-1',
          )}
        >
          <button
            type="button"
            title="DockX"
            onClick={() => navigate('/')}
            className="shrink-0 overflow-hidden rounded-lg shadow-sm shadow-brand-500/20"
          >
            <img src="/logo.png" alt="DockX" className="h-8 w-8 object-cover" />
          </button>
          {!collapsed ? (
            <span className="truncate text-sm font-semibold tracking-tight text-ink-50">
              DockX
            </span>
          ) : null}
        </div>

        <nav
          className={cn(
            'mt-6 flex flex-1 flex-col gap-1.5',
            collapsed ? 'items-center' : 'items-stretch',
          )}
        >
          <NavItems
            collapsed={collapsed}
            profileOpen={profileOpen}
            onOpenProfile={() => setProfileOpen(true)}
          />
        </nav>

        <div
          className={cn(
            'flex flex-col gap-1',
            collapsed ? 'items-center' : 'items-stretch',
          )}
        >
          <button
            type="button"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            onClick={() => setCollapsed((v) => !v)}
            className={cn(
              'flex items-center rounded-md text-ink-400 transition-colors hover:bg-ink-900 hover:text-ink-100',
              collapsed
                ? 'h-9 w-9 justify-center'
                : 'h-9 gap-2.5 px-2.5 text-sm font-medium',
            )}
          >
            {collapsed ? (
              <IconChevronRight className="shrink-0" />
            ) : (
              <>
                <IconChevronLeft className="shrink-0" />
                <span className="truncate">Collapse</span>
              </>
            )}
          </button>
          <button
            type="button"
            title={collapsed ? 'Sign out' : undefined}
            onClick={() => setConfirmLogout(true)}
            className={cn(
              'mb-1 flex items-center rounded-md text-ink-400 transition-colors hover:bg-ink-900 hover:text-ink-100',
              collapsed
                ? 'h-9 w-9 justify-center'
                : 'h-9 gap-2.5 px-2.5 text-sm font-medium',
            )}
          >
            <IconLogout className="shrink-0" />
            {!collapsed ? <span className="truncate">Sign out</span> : null}
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileNavOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
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
              <NavItems
                collapsed={false}
                onNavigate={() => setMobileNavOpen(false)}
                profileOpen={profileOpen}
                onOpenProfile={() => setProfileOpen(true)}
              />
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
        </div>
      ) : null}

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
        <header className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-ink-800 bg-ink-900 px-3 sm:px-4 md:px-5">
          <div className="flex min-w-0 items-center gap-2 text-sm">
            <button
              type="button"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-300 hover:bg-ink-700 hover:text-ink-50 md:hidden"
              aria-label="Open menu"
              onClick={() => setMobileNavOpen(true)}
            >
              <IconMenu className="h-5 w-5" />
            </button>
            <img
              src="/logo.png"
              alt=""
              className="hidden h-5 w-5 rounded-md object-cover sm:block"
            />
            <span className="font-semibold text-ink-50">DockX</span>
            <span className="hidden text-ink-200 sm:inline">·</span>
            <span className="flex items-center gap-1.5 text-xs text-ink-300">
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  !checkedIn
                    ? 'bg-ink-300'
                    : onBreak
                      ? 'bg-[#f0b232]'
                      : 'bg-[#23a559]',
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
                <span className="hidden text-ink-200 sm:inline">·</span>
                <span
                  className={cn(
                    'hidden items-center gap-1.5 text-xs font-medium sm:flex',
                    !online ? 'text-[#fee75c]' : 'text-ink-300',
                  )}
                  title="SQLite offline cache"
                >
                  <span
                    className={cn(
                      'h-1.5 w-1.5 rounded-full',
                      !online ? 'bg-[#f0b232]' : syncing ? 'bg-[#00a8fc]' : 'bg-ink-300',
                    )}
                  />
                  {offlineLabel}
                </span>
              </>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <NotificationBell />
            <ThemeToggle />
            <button
              type="button"
              title="My profile"
              onClick={() => setProfileOpen(true)}
              className="flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-ink-700"
            >
              <div className="hidden text-right leading-tight sm:block">
                <p className="text-xs font-semibold text-ink-50">{user?.name}</p>
                <p className="text-[10px] text-ink-400">{user?.role}</p>
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

        <main className="min-h-0 flex-1 overflow-hidden bg-ink-900">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
