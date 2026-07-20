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
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { ProfileModal } from '@/components/profile/ProfileModal';
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
];

export function AppShell() {
  const { user, logout } = useAuth();
  const { checkedIn, onBreak, elapsedLabel } = useAttendance();
  const { online, syncing, pendingCount, sqliteReady } = useOffline();
  const navigate = useNavigate();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

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
    <div className="flex h-screen overflow-hidden bg-ink-900">
      <aside className="flex w-14 shrink-0 flex-col items-center border-r border-ink-800 bg-ink-950 py-4">
        <button
          type="button"
          title="DockX"
          onClick={() => navigate('/')}
          className="overflow-hidden rounded-lg shadow-sm shadow-brand-500/20"
        >
          <img src="/logo.png" alt="DockX" className="h-8 w-8 object-cover" />
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
                  'flex h-9 w-9 items-center justify-center rounded-xl transition-colors',
                  isActive
                    ? 'bg-brand-500 text-white'
                    : 'text-ink-300 hover:bg-brand-500/80 hover:text-white',
                )
              }
            >
              <item.Icon />
            </NavLink>
          ))}
          <button
            type="button"
            title="Profile"
            onClick={() => setProfileOpen(true)}
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-xl transition-colors',
              profileOpen
                ? 'bg-brand-500 text-white'
                : 'text-ink-300 hover:bg-brand-500/80 hover:text-white',
            )}
          >
            <IconProfile />
          </button>
        </nav>
        <button
          type="button"
          title="Sign out"
          onClick={() => setConfirmLogout(true)}
          className="mb-1 flex h-9 w-9 items-center justify-center rounded-md text-ink-400 transition-colors hover:bg-ink-900 hover:text-ink-100"
        >
          <IconLogout />
        </button>
      </aside>

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
        <header className="flex h-11 shrink-0 items-center justify-between border-b border-ink-800 bg-ink-900 px-4 md:px-5">
          <div className="flex items-center gap-2 text-sm">
            <img src="/logo.png" alt="" className="h-5 w-5 rounded-md object-cover" />
            <span className="font-semibold text-ink-50">DockX</span>
            <span className="text-ink-200">·</span>
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
              {status}
              {checkedIn ? (
                <span className="font-semibold tabular-nums text-ink-200">
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
          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <button
              type="button"
              title="My profile"
              onClick={() => setProfileOpen(true)}
              className="flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-ink-700"
            >
              <div className="text-right leading-tight">
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
