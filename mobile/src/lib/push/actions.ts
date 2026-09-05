import * as Notifications from 'expo-notifications';

import { chatApi, notificationsApi, workspaceApi } from '@/lib/api';
import {
  dataFromNotificationPayload,
  navigateToNotification,
  type NotificationNavData,
} from '@/navigation/navigationRef';

import { ACTION, QUICK_REPLY_TEXT } from './categories';
import {
  deliverCallDismiss,
  deliverIncomingCall,
  incomingFromPushData,
} from './incomingCall';
import { ensureSessionAuth } from './sessionAuth';

const handled = new Map<string, number>();
const HANDLED_TTL_MS = 60_000;

function remember(key: string): boolean {
  const now = Date.now();
  for (const [existing, at] of handled) {
    if (now - at > HANDLED_TTL_MS) handled.delete(existing);
  }
  if (handled.has(key)) return false;
  handled.set(key, now);
  return true;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') return {};
  return value as Record<string, unknown>;
}

function str(data: Record<string, unknown>, key: string): string {
  const value = data[key];
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

export function payloadFromNotification(
  notification: Notifications.Notification,
): Record<string, unknown> {
  const data = asRecord(notification.request.content.data);
  const nestedBody = data.body;
  if (typeof nestedBody === 'string' && nestedBody.startsWith('{')) {
    try {
      return { ...asRecord(JSON.parse(nestedBody)), ...data };
    } catch {
      return data;
    }
  }
  if (nestedBody && typeof nestedBody === 'object') {
    return { ...asRecord(nestedBody), ...data };
  }
  return data;
}

function actionKey(response: Notifications.NotificationResponse): string {
  return [
    response.notification.request.identifier,
    response.actionIdentifier,
    response.userText ?? '',
  ].join(':');
}

async function dismiss(response: Notifications.NotificationResponse) {
  try {
    await Notifications.dismissNotificationAsync(response.notification.request.identifier);
  } catch {
    // Shade may have already cleared the notification.
  }
}

async function markInboxRead(notificationId: string) {
  if (!notificationId) return;
  await notificationsApi.markNotificationsRead([notificationId]).catch(() => undefined);
}

export type NotificationActionResult = {
  handled: boolean;
  navigate?: NotificationNavData;
};

export async function handleNotificationAction(
  response: Notifications.NotificationResponse,
): Promise<NotificationActionResult> {
  const actionId = response.actionIdentifier;
  if (!actionId || actionId === Notifications.DEFAULT_ACTION_IDENTIFIER) {
    return { handled: false };
  }
  if (!remember(actionKey(response))) {
    return { handled: true };
  }

  const ready = await ensureSessionAuth();
  if (!ready) return { handled: true };

  const data = payloadFromNotification(response.notification);
  const conversationId = str(data, 'conversationId');
  const notificationId = str(data, 'notificationId');
  const inviteId = str(data, 'inviteId');
  const projectId = str(data, 'projectId');
  const type = str(data, 'type');
  const incoming = incomingFromPushData(data);

  try {
    if (incoming && (type === 'call.incoming' || actionId === ACTION.callAccept || actionId === ACTION.callDecline)) {
      if (actionId === ACTION.callDecline) {
        await chatApi.respondToCall({
          callId: incoming.callId,
          conversationId: incoming.conversationId,
          action: 'decline',
        });
        deliverCallDismiss(incoming.callId);
        await dismiss(response);
        return { handled: true };
      }
      deliverIncomingCall({ payload: incoming, autoAccept: actionId === ACTION.callAccept });
      if (actionId === ACTION.callAccept) {
        await dismiss(response);
        return {
          handled: true,
          navigate: dataFromNotificationPayload({ conversationId: incoming.conversationId }),
        };
      }
      return {
        handled: true,
        navigate: dataFromNotificationPayload({ conversationId: incoming.conversationId }),
      };
    }

    if (actionId === ACTION.reply) {
      const text = (response.userText ?? '').trim();
      if (conversationId && text) {
        await chatApi.sendMessage(conversationId, { body: text });
        await markInboxRead(notificationId);
      }
      await dismiss(response);
      return { handled: true };
    }

    const quickText = QUICK_REPLY_TEXT[actionId];
    if (quickText && conversationId) {
      await chatApi.sendMessage(conversationId, { body: quickText });
      await markInboxRead(notificationId);
      await dismiss(response);
      return { handled: true };
    }

    if (actionId === ACTION.markRead && conversationId) {
      await chatApi.markConversationRead(conversationId);
      await markInboxRead(notificationId);
      await dismiss(response);
      return { handled: true };
    }

    if (actionId === ACTION.mute && conversationId) {
      await chatApi.setConversationMuted(conversationId, true);
      await markInboxRead(notificationId);
      await dismiss(response);
      return { handled: true };
    }

    if (actionId === ACTION.accept && inviteId) {
      await workspaceApi.acceptInviteRequest(inviteId);
      await markInboxRead(notificationId);
      await dismiss(response);
      return {
        handled: true,
        navigate: dataFromNotificationPayload({ projectId }),
      };
    }

    if (actionId === ACTION.decline && inviteId) {
      await workspaceApi.declineInviteRequest(inviteId);
      await markInboxRead(notificationId);
      await dismiss(response);
      return { handled: true };
    }
  } catch (err) {
    console.warn('[push] notification action failed', actionId, err);
    return { handled: true, navigate: dataFromNotificationPayload(data) };
  }

  return { handled: false };
}

export function navigateFromNotificationResponse(response: Notifications.NotificationResponse) {
  navigateToNotification(dataFromNotificationPayload(payloadFromNotification(response.notification)));
}
