import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { CallOverlay } from '@/components/calls/CallOverlay';
import { AuthProvider } from '@/context/AuthContext';
import { CallProvider } from '@/context/CallContext';
import { ChatProvider } from '@/context/ChatContext';
import { NotificationProvider } from '@/context/NotificationContext';
import { ConfirmProvider } from '@/context/ConfirmContext';
import { SocketProvider } from '@/context/SocketContext';
import { ToastProvider } from '@/context/ToastContext';
import { WorkspaceProvider } from '@/context/WorkspaceContext';
import { PushTokenRegistrar } from '@/lib/push/PushTokenRegistrar';
import { RootNavigator } from '@/navigation/RootNavigator';
import { ThemeProvider, useTheme } from '@/theme';

function ThemedStatusBar() {
  const { isDark } = useTheme();
  return <StatusBar style={isDark ? 'light' : 'dark'} />;
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <ToastProvider>
            <ConfirmProvider>
              <AuthProvider>
                <SocketProvider>
                  <WorkspaceProvider>
                    <ChatProvider>
                      <NotificationProvider>
                        {/* Calls live above the navigator so they survive screen changes. */}
                        <CallProvider>
                          <ThemedStatusBar />
                          <PushTokenRegistrar />
                          <RootNavigator />
                          <CallOverlay />
                        </CallProvider>
                      </NotificationProvider>
                    </ChatProvider>
                  </WorkspaceProvider>
                </SocketProvider>
              </AuthProvider>
            </ConfirmProvider>
          </ToastProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
