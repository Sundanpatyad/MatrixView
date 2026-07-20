import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth/AuthContext';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';

const navItems = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/org', label: 'Organization' },
  { to: '/employees', label: 'Employees' },
  { to: '/projects', label: 'Projects' },
  { to: '/tasks', label: 'Tasks' },
  { to: '/attendance', label: 'Attendance' },
  { to: '/monitoring', label: 'Monitoring' },
  { to: '/reports', label: 'Reports' },
  { to: '/audit', label: 'Audit' },
  { to: '/settings', label: 'Settings' },
] as const;

export function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen bg-ink-50">
      <aside className="flex w-64 shrink-0 flex-col border-r border-ink-200 bg-white">
        <div className="border-b border-ink-100 px-5 py-5">
          <p className="font-display text-xl font-semibold text-ink-900">TaskTrack</p>
          <p className="mt-1 truncate text-xs text-ink-500">{user?.orgName ?? 'Organization'}</p>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/dashboard'}
              className={({ isActive }) =>
                cn(
                  'block rounded-lg px-3 py-2 text-sm font-medium transition',
                  isActive
                    ? 'bg-brand-50 text-brand-800'
                    : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-ink-200 bg-white px-6">
          <div>
            <p className="text-sm font-semibold text-ink-900">{user?.name}</p>
            <p className="text-xs text-ink-500">
              {user?.role} · {user?.email}
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              logout();
              navigate('/login');
            }}
          >
            Log out
          </Button>
        </header>
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
