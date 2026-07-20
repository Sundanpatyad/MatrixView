import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { RequireAuth } from '@/components/layout/RequireAuth';
import { HomePage } from '@/pages/website/HomePage';
import { LoginPage } from '@/pages/auth/login/LoginPage';
import { SignupPage } from '@/pages/auth/signup/SignupPage';
import { ForgotPasswordPage } from '@/pages/auth/forgot-password/ForgotPasswordPage';
import { ResetPasswordPage } from '@/pages/auth/reset-password/ResetPasswordPage';
import { AcceptInvitePage } from '@/pages/auth/invite/AcceptInvitePage';
import { TwoFactorPage } from '@/pages/auth/two-factor/TwoFactorPage';
import { DashboardPage } from '@/pages/dashboard/DashboardPage';
import { OrgPage } from '@/pages/org/OrgPage';
import { OrgSetupPage } from '@/pages/org/OrgSetupPage';
import { EmployeesPage } from '@/pages/employees/EmployeesPage';
import { ProjectsPage } from '@/pages/projects/ProjectsPage';
import { TasksPage } from '@/pages/tasks/TasksPage';
import { AttendancePage } from '@/pages/attendance/AttendancePage';
import { MonitoringPage } from '@/pages/monitoring/MonitoringPage';
import { ReportsPage } from '@/pages/reports/ReportsPage';
import { AuditPage } from '@/pages/audit/AuditPage';
import { SettingsPage } from '@/pages/settings/SettingsPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />

      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signin" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/invite/:token" element={<AcceptInvitePage />} />
        <Route path="/2fa" element={<TwoFactorPage />} />
      </Route>

      <Route element={<RequireAuth />}>
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/org" element={<OrgPage />} />
          <Route path="/org/setup" element={<OrgSetupPage />} />
          <Route path="/employees" element={<EmployeesPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/attendance" element={<AttendancePage />} />
          <Route path="/monitoring" element={<MonitoringPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/audit" element={<AuditPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
