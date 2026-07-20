import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { RequireAuth } from '@/components/layout/RequireAuth';
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { DashboardPage } from '@/pages/dashboard/DashboardPage';
import { BoardWorkspacePage } from '@/pages/board/BoardWorkspacePage';
import { ChatPage } from '@/pages/chat/ChatPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/board" element={<BoardWorkspacePage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/profile" element={<Navigate to="/" replace />} />
          {/* Legacy routes */}
          <Route path="/projects" element={<Navigate to="/board" replace />} />
          <Route path="/projects/:projectId" element={<Navigate to="/board" replace />} />
          <Route path="/projects/:projectId/board" element={<Navigate to="/board" replace />} />
          <Route path="/attendance" element={<Navigate to="/" replace />} />
          <Route path="/activity" element={<Navigate to="/" replace />} />
          <Route path="/notifications" element={<Navigate to="/" replace />} />
          <Route path="/tasks" element={<Navigate to="/board" replace />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
