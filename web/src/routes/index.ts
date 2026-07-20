/**
 * Canonical route map for TaskTrack web (trust-layer pass).
 */
export const routes = [
  { path: '/', page: 'website/HomePage', status: 'designed' },
  { path: '/login', page: 'auth/login/LoginPage', status: 'designed' },
  { path: '/signin', page: 'auth/login/LoginPage', status: 'designed' },
  { path: '/signup', page: 'auth/signup/SignupPage', status: 'designed' },
  { path: '/forgot-password', page: 'auth/forgot-password/ForgotPasswordPage', status: 'designed' },
  { path: '/reset-password', page: 'auth/reset-password/ResetPasswordPage', status: 'designed' },
  { path: '/invite/:token', page: 'auth/invite/AcceptInvitePage', status: 'designed' },
  { path: '/2fa', page: 'auth/two-factor/TwoFactorPage', status: 'designed' },
  { path: '/dashboard', page: 'dashboard/DashboardPage', status: 'designed' },
  { path: '/org', page: 'org/OrgPage', status: 'designed' },
  { path: '/org/setup', page: 'org/OrgSetupPage', status: 'designed' },
  { path: '/employees', page: 'employees/EmployeesPage', status: 'designed' },
] as const;
