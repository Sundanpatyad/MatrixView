import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AttendanceProvider } from '@/lib/attendance/AttendanceContext';
import { AuthProvider } from '@/lib/auth/AuthContext';
import { OfflineProvider } from '@/lib/offline/OfflineContext';
import { WorkspaceProvider } from '@/lib/workspace/WorkspaceContext';
import App from './App';
import './styles/globals.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <OfflineProvider>
          <WorkspaceProvider>
            <AttendanceProvider>
              <App />
            </AttendanceProvider>
          </WorkspaceProvider>
        </OfflineProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
