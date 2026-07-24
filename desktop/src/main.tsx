import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AttendanceProvider } from '@/lib/attendance/AttendanceContext';
import { AuthProvider } from '@/lib/auth/AuthContext';
import { OfflineProvider } from '@/lib/offline/OfflineContext';
import { WorkspaceProvider } from '@/lib/workspace/WorkspaceContext';
import { NotificationProvider } from '@/lib/notifications/NotificationContext';
import { ToastProvider } from '@/lib/toast/ToastContext';
import App from './App';
import './styles/globals.css';

const storedTheme = window.localStorage.getItem('dockx.theme');
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
const initialTheme = storedTheme === 'light' || storedTheme === 'dark'
  ? storedTheme
  : prefersDark
    ? 'dark'
    : 'light';
document.documentElement.classList.toggle('dark', initialTheme === 'dark');
document.documentElement.style.colorScheme = initialTheme;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <OfflineProvider>
            <WorkspaceProvider>
              <AttendanceProvider>
                <NotificationProvider>
                  <App />
                </NotificationProvider>
              </AttendanceProvider>
            </WorkspaceProvider>
          </OfflineProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
);
