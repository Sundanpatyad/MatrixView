import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging, type Messaging, type MulticastMessage } from 'firebase-admin/messaging';
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

function asString(value: unknown): string {
  if (value == null) return '';
  return String(value);
}

/** Expo category ids — no ':' or '-' (those break Android categories). */
export function categoryIdFor(type: string): string {
  if (type === 'message.new') return 'dockx_message';
  if (type === 'project.invited') return 'dockx_invite';
  if (type === 'call.incoming') return 'dockx_call';
  return '';
}

export const CALL_PUSH_TTL_MS = 45_000;

export type CallPushKind = 'incoming' | 'missed' | 'ended';

export type CallPushInput = {
  kind: CallPushKind;
  callId: string;
  conversationId: string;
  fromUserId: string;
  fromName: string;
  mediaKind: 'audio' | 'video';
  isGroup: boolean;
  conversationName?: string;
};

function asData(notification: SerializedNotification, title: string, body: string): Record<string, string> {
  const categoryId = categoryIdFor(notification.type);
  const inviteId = asString(notification.meta?.inviteId);
  const payload = {
    type: notification.type,
    href: notification.href,
    notificationId: notification.id,
    conversationId: notification.conversationId ?? '',
    taskId: notification.taskId ?? '',
    projectId: notification.projectId ?? '',
    messageId: notification.messageId ?? '',
    inviteId,
    categoryId,
  };

  return {
    ...payload,
    title,
    // Expo Android presents data-only FCM when `title` + `message` are set,
    // and attaches actions when `categoryId` matches a registered category.
    message: body,
    body: JSON.stringify(payload),
    channelId: 'default',
  };
}

const DEAD_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

async function tokensForUser(userId: string) {
  const devices = await DeviceToken.find({ userId }).select('token platform').lean();
  const androidTokens = [
    ...new Set(
      devices
        .filter((d) => d.platform !== 'ios')
        .map((d) => d.token)
        .filter(Boolean),
    ),
  ];
  const iosTokens = [
    ...new Set(
      devices
        .filter((d) => d.platform === 'ios')
        .map((d) => d.token)
        .filter(Boolean),
    ),
  ];
  return { androidTokens, iosTokens };
}

function callPushCopy(input: CallPushInput): { title: string; body: string } | null {
  const name = input.fromName.trim() || 'Someone';
  const kindLabel = input.mediaKind === 'video' ? 'Video' : 'Voice';
  if (input.kind === 'incoming') {
    const target = input.isGroup ? input.conversationName?.trim() || 'the group' : 'you';
    return {
      title: `Incoming ${kindLabel.toLowerCase()} call`,
      body: input.isGroup ? `${name} is calling ${target}` : `${name} is calling`,
    };
  }
  if (input.kind === 'missed') {
    return {
      title: `Missed ${kindLabel.toLowerCase()} call`,
      body: input.isGroup ? `${name} called ${input.conversationName?.trim() || 'the group'}` : name,
    };
  }
  return null;
}

function callPushData(input: CallPushInput, title: string, body: string): Record<string, string> {
  const type = input.kind === 'incoming' ? 'call.incoming' : input.kind === 'missed' ? 'call.missed' : 'call.ended';
  const categoryId = categoryIdFor(type);
  const payload = {
    type,
    href: `/chat?c=${encodeURIComponent(input.conversationId)}`,
    notificationId: '',
    conversationId: input.conversationId,
    taskId: '',
    projectId: '',
    messageId: '',
    inviteId: '',
    categoryId,
    callId: input.callId,
    fromUserId: input.fromUserId,
    fromName: input.fromName,
    mediaKind: input.mediaKind,
    isGroup: input.isGroup ? '1' : '0',
    conversationName: input.conversationName ?? '',
  };
  if (input.kind === 'ended') {
    return {
      ...payload,
      body: JSON.stringify(payload),
      tag: `call:${input.callId}`,
    };
  }
  return {
    ...payload,
    title,
    message: body,
    body: JSON.stringify(payload),
    channelId: input.kind === 'incoming' ? 'incoming_calls' : 'default',
    tag: `call:${input.callId}`,
    sticky: input.kind === 'incoming' ? 'true' : 'false',
    autoDismiss: input.kind === 'incoming' ? 'false' : 'true',
  };
}

async function sendMulticast(
  msg: Messaging,
  message: Omit<MulticastMessage, 'tokens'>,
  tokens: string[],
) {
  if (tokens.length === 0) return;
  const result = await msg.sendEachForMulticast({ ...message, tokens });
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
}

export async function sendPushToUser(
  userId: string,
  notification: SerializedNotification,
): Promise<void> {
  const msg = initMessaging();
  if (!msg) return;

  const { androidTokens, iosTokens } = await tokensForUser(userId);
  if (androidTokens.length === 0 && iosTokens.length === 0) return;

  const title = notification.title.slice(0, 200);
  const body = (notification.body || notification.title).slice(0, 500);
  const data = asData(notification, title, body);
  const categoryId = data.categoryId;

  try {
    // Android: data-only. A `notification` payload is drawn by the system shade
    // and Expo never gets to attach Reply / Accept action buttons.
    await sendMulticast(
      msg,
      {
        data,
        android: { priority: 'high' },
      },
      androidTokens,
    );

    await sendMulticast(
      msg,
      {
        notification: { title, body },
        data,
        apns: {
          payload: {
            aps: {
              alert: { title, body },
              sound: 'default',
              ...(categoryId ? { category: categoryId } : {}),
            },
          },
        },
      },
      iosTokens,
    );
  } catch (err) {
    console.warn('[fcm] multicast failed', err);
  }
}

/** Wake the phone for an incoming / missed call even when the app socket is offline. */
export async function sendCallPushToUser(userId: string, input: CallPushInput): Promise<void> {
  const msg = initMessaging();
  if (!msg) return;

  const { androidTokens, iosTokens } = await tokensForUser(userId);
  if (androidTokens.length === 0 && iosTokens.length === 0) return;

  const copy = callPushCopy(input);
  const title = (copy?.title ?? '').slice(0, 200);
  const body = (copy?.body ?? '').slice(0, 500);
  const data = callPushData(input, title, body);
  const categoryId = data.categoryId;
  const ttlSeconds = Math.ceil(CALL_PUSH_TTL_MS / 1000);

  try {
    if (input.kind === 'ended') {
      await sendMulticast(
        msg,
        {
          data,
          android: { priority: 'high', ttl: CALL_PUSH_TTL_MS, collapseKey: `call-${input.callId}` },
        },
        androidTokens,
      );
      await sendMulticast(
        msg,
        {
          data,
          apns: {
            headers: { 'apns-priority': '5', 'apns-expiration': String(Math.floor(Date.now() / 1000) + ttlSeconds) },
            payload: { aps: { 'content-available': 1 } },
          },
        },
        iosTokens,
      );
      return;
    }

    await sendMulticast(
      msg,
      {
        data,
        android: {
          priority: 'high',
          ttl: CALL_PUSH_TTL_MS,
          collapseKey: `call-${input.callId}`,
        },
      },
      androidTokens,
    );

    await sendMulticast(
      msg,
      {
        notification: { title, body },
        data,
        apns: {
          headers: {
            'apns-priority': '10',
            'apns-push-type': 'alert',
            'apns-expiration': String(Math.floor(Date.now() / 1000) + ttlSeconds),
          },
          payload: {
            aps: {
              alert: { title, body },
              sound: 'default',
              'interruption-level': 'time-sensitive',
              ...(categoryId ? { category: categoryId } : {}),
            },
          },
        },
      },
      iosTokens,
    );
  } catch (err) {
    console.warn('[fcm] call push failed', err);
  }
}
