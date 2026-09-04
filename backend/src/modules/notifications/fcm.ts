import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging, type Messaging } from 'firebase-admin/messaging';
import { config } from '../../config.js';
import { DeviceToken } from './models/DeviceToken.js';
import type { SerializedNotification } from './service.js';

let messaging: Messaging | null | undefined;

function initMessaging(): Messaging | null {
  if (messaging !== undefined) return messaging;
  messaging = null;

  try {
    if (getApps().length === 0) {
      const creds = resolveCredentials();
      if (!creds) {
        console.warn('[fcm] Firebase credentials missing; push notifications disabled');
        return null;
      }
      initializeApp({ credential: cert(creds) });
    }
    messaging = getMessaging();
  } catch (err) {
    console.error('[fcm] failed to initialize Firebase Admin', err);
    messaging = null;
  }

  return messaging;
}

function resolveCredentials(): {
  projectId: string;
  clientEmail: string;
  privateKey: string;
} | null {
  const { projectId, clientEmail, privateKey } = config.firebase;
  if (!projectId || !clientEmail || !privateKey) return null;
  return {
    projectId,
    clientEmail,
    privateKey: privateKey.replace(/\\n/g, '\n'),
  };
}

function asData(notification: SerializedNotification): Record<string, string> {
  return {
    type: notification.type,
    href: notification.href,
    notificationId: notification.id,
    conversationId: notification.conversationId ?? '',
    taskId: notification.taskId ?? '',
    projectId: notification.projectId ?? '',
    messageId: notification.messageId ?? '',
  };
}

const DEAD_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

export async function sendPushToUser(
  userId: string,
  notification: SerializedNotification,
): Promise<void> {
  const msg = initMessaging();
  if (!msg) return;

  const devices = await DeviceToken.find({ userId }).select('token').lean();
  const tokens = [...new Set(devices.map((d) => d.token).filter(Boolean))];
  if (tokens.length === 0) return;

  const title = notification.title.slice(0, 200);
  const body = (notification.body || notification.title).slice(0, 500);
  const data = asData(notification);

  try {
    const result = await msg.sendEachForMulticast({
      tokens,
      notification: { title, body },
      data,
      android: {
        priority: 'high',
        notification: {
          channelId: 'default',
          sound: 'default',
        },
      },
    });

    const stale: string[] = [];
    result.responses.forEach((res, i) => {
      if (res.success) return;
      const code = res.error?.code ?? '';
      if (DEAD_TOKEN_CODES.has(code) || code.includes('registration-token')) {
        stale.push(tokens[i]!);
      } else {
        console.warn('[fcm] send failed', code, res.error?.message);
      }
    });
    if (stale.length > 0) {
      await DeviceToken.deleteMany({ token: { $in: stale } });
    }
  } catch (err) {
    console.warn('[fcm] multicast failed', err);
  }
}
