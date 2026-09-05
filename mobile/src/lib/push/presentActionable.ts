import * as Notifications from 'expo-notifications';
import { AppState, Platform } from 'react-native';

import { payloadFromNotification } from './actions';
import {
  INVITE_CATEGORY,
  MESSAGE_CATEGORY,
  registerNotificationCategories,
} from './categories';

const ACTIONABLE = new Set([MESSAGE_CATEGORY, INVITE_CATEGORY]);
const presented = new Set<string>();

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function str(data: Record<string, unknown>, key: string): string {
  const value = data[key];
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function parseBody(raw: unknown): Record<string, unknown> {
  if (typeof raw === 'string' && raw.startsWith('{')) {
    try {
      return asRecord(JSON.parse(raw));
    } catch {
      return {};
    }
  }
  return asRecord(raw);
}

/** Flatten Expo's FCM task payload (`{ data: { ... } }`) plus JSON `body`. */
export function recordFromTaskData(input: unknown): Record<string, unknown> {
  const root = asRecord(input);
  const nested = asRecord(root.data);
  const fromBody = parseBody(nested.body ?? root.body);
  let merged: Record<string, unknown> = { ...fromBody, ...root, ...nested };
  const notification = root.notification;
  if (notification && typeof notification === 'object' && 'request' in notification) {
    merged = {
      ...payloadFromNotification(notification as Notifications.Notification),
      ...merged,
    };
  }
  return merged;
}

async function ensureDefaultChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Default',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#3B82F6',
  });
}

/**
 * Android FCM auto-presentation ignores category actions in background/killed.
 * Replace that tray item with a local notification that carries `categoryIdentifier`.
 */
export async function presentActionableFromData(data: Record<string, unknown>): Promise<void> {
  if (Platform.OS !== 'android') return;
  if (AppState.currentState === 'active') return;
  if (str(data, 'presented') === '1') return;

  const type = str(data, 'type');
  if (type.startsWith('call.')) return;

  const categoryId = str(data, 'categoryId') || str(data, 'categoryIdentifier');
  if (!ACTIONABLE.has(categoryId)) return;

  const title = str(data, 'title') || str(data, 'alertTitle') || 'DockX';
  const rawBody = str(data, 'message') || str(data, 'alertBody');
  const body = rawBody && !rawBody.startsWith('{') ? rawBody : str(data, 'alertBody');
  if (!title && !body) return;

  const identifier =
    str(data, 'tag') ||
    str(data, 'notificationId') ||
    str(data, 'conversationId') ||
    str(data, 'inviteId');
  if (!identifier || presented.has(identifier)) return;
  presented.add(identifier);

  try {
    await registerNotificationCategories();
    await ensureDefaultChannel();
    await Notifications.scheduleNotificationAsync({
      identifier,
      content: {
        title,
        body: body || title,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        categoryIdentifier: categoryId,
        data: {
          ...data,
          categoryId,
          categoryIdentifier: categoryId,
          presented: '1',
        },
      },
      trigger: { channelId: str(data, 'channelId') || 'default' },
    });
  } catch (err) {
    presented.delete(identifier);
    console.warn('[push] failed to present actionable notification', err);
  }
}

export async function presentActionableFromNotification(
  notification: Notifications.Notification,
): Promise<void> {
  const data = payloadFromNotification(notification);
  const categoryId =
    str(data, 'categoryId') ||
    str(data, 'categoryIdentifier') ||
    notification.request.content.categoryIdentifier ||
    '';
  await presentActionableFromData({
    ...data,
    categoryId,
    title: str(data, 'title') || notification.request.content.title || '',
    message: str(data, 'message') || notification.request.content.body || '',
    tag: notification.request.identifier,
  });
}
