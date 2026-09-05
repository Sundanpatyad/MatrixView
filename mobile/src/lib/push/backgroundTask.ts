import * as Notifications from 'expo-notifications';

import { handleNotificationAction, payloadFromNotification } from './actions';
import { registerNotificationCategories } from './categories';
import { incomingFromPushData } from './incomingCall';
import { startCallRingtone, stopCallRingtone } from './callRingtone';

export const BACKGROUND_NOTIFICATION_TASK = 'DOCKX_NOTIFICATION_TASK';

function defineBackgroundTask() {
  try {
    // Native module is only present after a rebuild that includes expo-task-manager.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const TaskManager = require('expo-task-manager') as typeof import('expo-task-manager');
    if (typeof TaskManager.defineTask !== 'function') return;

    TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async ({ data, error }) => {
      if (error || !data) return;
      if (typeof data === 'object' && data && 'actionIdentifier' in data) {
        await handleNotificationAction(data as Notifications.NotificationResponse);
        return;
      }
      const record = data as Record<string, unknown>;
      const notification = record.notification as Notifications.Notification | undefined;
      const payload = notification ? payloadFromNotification(notification) : record;
      const type = typeof payload.type === 'string' ? payload.type : '';
      if (type === 'call.incoming' && incomingFromPushData(payload)) {
        startCallRingtone();
        return;
      }
      if (type === 'call.ended' || type === 'call.missed') {
        stopCallRingtone();
      }
    });
  } catch (err) {
    console.warn('[push] expo-task-manager unavailable', err);
  }
}

defineBackgroundTask();

export function registerNotificationBackgroundTask() {
  void registerNotificationCategories().catch((err) => {
    console.warn('[push] failed to register categories', err);
  });
  void Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK).catch((err) => {
    console.warn('[push] failed to register notification task', err);
  });
}
