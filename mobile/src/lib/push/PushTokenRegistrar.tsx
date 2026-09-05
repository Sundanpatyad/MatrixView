import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

import { useAuth } from '@/context/AuthContext';
import { registerDeviceToken, unregisterDeviceToken } from '@/lib/push/api';
import {
  handleNotificationAction,
  navigateFromNotificationResponse,
  payloadFromNotification,
} from '@/lib/push/actions';
import { registerNotificationCategories } from '@/lib/push/categories';
import { presentActionableFromNotification } from '@/lib/push/presentActionable';
import {
  deliverCallDismiss,
  deliverIncomingCall,
  incomingFromPushData,
} from '@/lib/push/incomingCall';
import { ensureIncomingCallChannel } from '@/lib/push/callRingtone';
import { navigateToNotification } from '@/navigation/navigationRef';

function dataType(data: Record<string, unknown>) {
  const value = data.type;
  return typeof value === 'string' ? value : '';
}

function dataCallId(data: Record<string, unknown>) {
  const value = data.callId;
  return typeof value === 'string' ? value.trim() : '';
}

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = payloadFromNotification(notification);
    const isIncomingCall = dataType(data) === 'call.incoming';
    const inForeground = AppState.currentState === 'active';
    return {
      shouldShowAlert: !inForeground,
      shouldPlaySound: isIncomingCall || !inForeground,
      shouldSetBadge: true,
      shouldShowBanner: !inForeground,
      shouldShowList: !isIncomingCall || !inForeground,
    };
  },
});

let handledLaunchResponse = false;

async function onNotificationResponse(response: Notifications.NotificationResponse) {
  const data = payloadFromNotification(response.notification);
  const incoming = incomingFromPushData(data);
  const isDefault =
    !response.actionIdentifier ||
    response.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER;
  if (incoming && dataType(data) === 'call.incoming' && isDefault) {
    deliverIncomingCall({ payload: incoming });
  }

  const result = await handleNotificationAction(response);
  if (result.handled) {
    if (result.navigate) navigateToNotification(result.navigate);
    return;
  }
  navigateFromNotificationResponse(response);
}

function onNotificationReceived(notification: Notifications.Notification) {
  const data = payloadFromNotification(notification);
  const type = dataType(data);
  const callId = dataCallId(data);
  if ((type === 'call.ended' || type === 'call.missed') && callId) {
    deliverCallDismiss(callId);
    return;
  }
  if (type === 'call.incoming') {
    const incoming = incomingFromPushData(data);
    if (incoming) deliverIncomingCall({ payload: incoming });
    return;
  }
  void presentActionableFromNotification(notification);
}

async function ensureCallChannel() {
  if (Platform.OS !== 'android') return;
  ensureIncomingCallChannel();
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Default',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#3B82F6',
  });
}

export function PushTokenRegistrar() {
  const { isAuthenticated } = useAuth();
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    void registerNotificationCategories().catch((err) => {
      console.warn('[push] failed to register categories', err);
    });
    void ensureCallChannel().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;

    const subscriptions = [
      Notifications.addNotificationResponseReceivedListener(onNotificationResponse),
      Notifications.addNotificationReceivedListener(onNotificationReceived),
    ];

    if (!handledLaunchResponse) {
      handledLaunchResponse = true;
      void Notifications.getLastNotificationResponseAsync().then((response) => {
        if (!response) return;
        void onNotificationResponse(response);
      });
    }

    return () => {
      subscriptions.forEach((sub) => sub.remove());
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (Platform.OS !== 'android' || !isAuthenticated) return;

    let cancelled = false;

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

        await ensureCallChannel();
        await registerNotificationCategories();

        const devicePush = await Notifications.getDevicePushTokenAsync();
        const token = typeof devicePush.data === 'string' ? devicePush.data : '';
        await sendToken(token);
      } catch (err) {
        console.warn('[push] failed to register FCM token', err);
      }
    }

    void register();

    const tokenSub = Notifications.addPushTokenListener((devicePush) => {
      const token = typeof devicePush.data === 'string' ? devicePush.data : '';
      void sendToken(token).catch((err) => console.warn('[push] token refresh failed', err));
    });

    return () => {
      cancelled = true;
      tokenSub.remove();
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
