import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

import { useAuth } from '@/context/AuthContext';
import { registerDeviceToken, unregisterDeviceToken } from '@/lib/push/api';
import { dataFromNotificationPayload, navigateToNotification } from '@/navigation/navigationRef';

Notifications.setNotificationHandler({
  handleNotification: async () => {
    const inForeground = AppState.currentState === 'active';
    return {
      shouldShowAlert: !inForeground,
      shouldPlaySound: !inForeground,
      shouldSetBadge: true,
      shouldShowBanner: !inForeground,
      shouldShowList: true,
    };
  },
});

let handledLaunchResponse = false;

function readData(response: Notifications.NotificationResponse | null) {
  const data = response?.notification.request.content.data;
  if (!data || typeof data !== 'object') return undefined;
  return data as Record<string, unknown>;
}

export function PushTokenRegistrar() {
  const { isAuthenticated } = useAuth();
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'android' || !isAuthenticated) return;

    let cancelled = false;
    const subscriptions: { remove: () => void }[] = [];

    async function sendToken(token: string) {
      if (!token || cancelled) return;
      tokenRef.current = token;
      await registerDeviceToken({
        token,
        platform: 'android',
        deviceId: Device.modelName,
      });
    }

    async function register() {
      try {
        const permission = await Notifications.requestPermissionsAsync();
        if (!permission.granted) return;

        await Notifications.setNotificationChannelAsync('default', {
          name: 'Default',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#3B82F6',
        });

        const devicePush = await Notifications.getDevicePushTokenAsync();
        const token = typeof devicePush.data === 'string' ? devicePush.data : '';
        await sendToken(token);
      } catch (err) {
        console.warn('[push] failed to register FCM token', err);
      }
    }

    void register();

    subscriptions.push(
      Notifications.addPushTokenListener((devicePush) => {
        const token = typeof devicePush.data === 'string' ? devicePush.data : '';
        void sendToken(token).catch((err) => console.warn('[push] token refresh failed', err));
      }),
    );

    subscriptions.push(
      Notifications.addNotificationResponseReceivedListener((response) => {
        navigateToNotification(dataFromNotificationPayload(readData(response)));
      }),
    );

    if (!handledLaunchResponse) {
      handledLaunchResponse = true;
      void Notifications.getLastNotificationResponseAsync().then((response) => {
        if (!response) return;
        navigateToNotification(dataFromNotificationPayload(readData(response)));
      });
    }

    return () => {
      cancelled = true;
      subscriptions.forEach((sub) => sub.remove());
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) return;
    const token = tokenRef.current;
    tokenRef.current = null;
    if (!token) return;
    void unregisterDeviceToken(token).catch(() => undefined);
  }, [isAuthenticated]);

  return null;
}
