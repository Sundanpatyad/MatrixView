import { useState, type ComponentType, type SVGProps } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  IconBoard,
  IconChat,
  IconDashboard,
  IconLogout,
  IconProfile,
} from '@/components/ui/Icons';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { useAttendance } from '@/lib/attendance/AttendanceContext';
import { useAuth } from '@/lib/auth/AuthContext';
import { useOffline } from '@/lib/offline/OfflineContext';
import { cn } from '@/lib/cn';

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
  { to: '/profile', label: 'Profile', Icon: IconProfile },
];

export function AppShell() {
  const { user, logout } = useAuth();
  const { checkedIn, onBreak, elapsedLabel } = useAttendance();
  const { online, syncing, pendingCount, sqliteReady } = useOffline();
  const navigate = useNavigate();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

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
    <div className="flex h-screen overflow-hidden bg-white">
      <aside className="flex w-14 shrink-0 flex-col items-center border-r border-ink-200 bg-white py-4">
        <button
          type="button"
          title="TaskTrack"
          onClick={() => navigate('/')}
          className="flex h-8 w-8 items-center justify-center bg-ink-900 text-xs font-bold text-white"
        >
          T
        </button>
        <nav className="mt-6 flex flex-1 flex-col items-center gap-1.5">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              title={item.label}
              className={({ isActive }) =>
                cn(
                  'flex h-9 w-9 items-center justify-center rounded-md transition-colors',
                  isActive
                    ? 'bg-ink-900 text-white'
                    : 'text-ink-400 hover:bg-ink-50 hover:text-ink-800',
                )
              }
            >
              <item.Icon />
            </NavLink>
          ))}
        </nav>
        <button
          type="button"
          title="Sign out"
          onClick={() => setConfirmLogout(true)}
          className="mb-1 flex h-9 w-9 items-center justify-center rounded-md text-ink-400 transition-colors hover:bg-ink-50 hover:text-ink-800"
        >
          <IconLogout />
        </button>
      </aside>

      <ConfirmModal
        open={confirmLogout}
        title="Sign out?"
        message="You’ll need to sign in again to use TaskTrack on this device."
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

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-11 shrink-0 items-center justify-between border-b border-ink-200 px-4 md:px-5">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-semibold text-ink-900">TaskTrack</span>
            <span className="text-ink-200">·</span>
            <span className="flex items-center gap-1.5 text-xs text-ink-500">
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  !checkedIn
                    ? 'bg-ink-300'
                    : onBreak
                      ? 'bg-amber-500'
                      : 'bg-emerald-500',
                )}
              />
              {status}
              {checkedIn ? (
                <span className="font-semibold tabular-nums text-ink-700">
                  {elapsedLabel}
                </span>
              ) : null}
            </span>
            {offlineLabel ? (
              <>
                <span className="text-ink-200">·</span>
                <span
                  className={cn(
                    'flex items-center gap-1.5 text-xs font-medium',
                    !online ? 'text-amber-700' : 'text-ink-500',
                  )}
                  title="SQLite offline cache"
                >
                  <span
                    className={cn(
                      'h-1.5 w-1.5 rounded-full',
                      !online ? 'bg-amber-500' : syncing ? 'bg-sky-500' : 'bg-ink-300',
                    )}
                  />
                  {offlineLabel}
                </span>
              </>
            ) : null}
          </div>
          <button
            type="button"
            title="My profile"
            onClick={() => navigate('/profile')}
            className="flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-ink-50"
          >
            <div className="text-right leading-tight">
              <p className="text-xs font-semibold text-ink-900">{user?.name}</p>
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
        </header>

        <main className="min-h-0 flex-1 overflow-hidden bg-ink-50">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
