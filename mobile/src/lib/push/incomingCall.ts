import * as Notifications from 'expo-notifications';
import { AppState, Platform } from 'react-native';

import { CALL_CATEGORY } from './categories';
import { startCallRingtone, stopCallRingtone } from './callRingtone';
import type { CallIncomingPayload } from '@/lib/socket/socket';

export const INCOMING_CALLS_CHANNEL = 'incoming_calls';

export type IncomingCallEvent = {
  payload: CallIncomingPayload;
  autoAccept?: boolean;
};

type Listener = (event: IncomingCallEvent) => void;

const listeners = new Set<Listener>();
const dismissListeners = new Set<(callId: string) => void>();
let pending: IncomingCallEvent | null = null;

export function callNotificationId(callId: string) {
  return `call:${callId}`;
}

export function incomingFromPushData(data: Record<string, unknown>): CallIncomingPayload | null {
  const callId = typeof data.callId === 'string' ? data.callId.trim() : '';
  const conversationId = typeof data.conversationId === 'string' ? data.conversationId.trim() : '';
  if (!callId || !conversationId) return null;
  return {
    callId,
    conversationId,
    fromUserId: typeof data.fromUserId === 'string' ? data.fromUserId : '',
    fromName: typeof data.fromName === 'string' && data.fromName.trim() ? data.fromName : 'Someone',
    mediaKind: data.mediaKind === 'video' ? 'video' : 'audio',
    isGroup: data.isGroup === '1' || data.isGroup === true,
    conversationName: typeof data.conversationName === 'string' ? data.conversationName : undefined,
  };
}

export function deliverIncomingCall(event: IncomingCallEvent) {
  pending = event;
  startCallRingtone();
  listeners.forEach((listener) => listener(event));
}

export function subscribeIncomingCall(listener: Listener) {
  listeners.add(listener);
  if (pending) listener(pending);
  return () => {
    listeners.delete(listener);
  };
}

export function deliverCallDismiss(callId: string) {
  if (pending?.payload.callId === callId) pending = null;
  stopCallRingtone();
  dismissListeners.forEach((listener) => listener(callId));
  void dismissIncomingCallNotification(callId);
}

export function subscribeCallDismiss(listener: (callId: string) => void) {
  dismissListeners.add(listener);
  return () => {
    dismissListeners.delete(listener);
  };
}

export function consumePendingIncomingCall() {
  const event = pending;
  pending = null;
  return event;
}

export async function dismissIncomingCallNotification(callId: string) {
  stopCallRingtone();
  try {
    await Notifications.dismissNotificationAsync(callNotificationId(callId));
  } catch {
    /* already gone */
  }
}

export async function presentIncomingCallNotification(payload: CallIncomingPayload) {
  startCallRingtone();
  if (AppState.currentState === 'active') return;
  const kind = payload.mediaKind === 'video' ? 'video' : 'voice';
  const title = `Incoming ${kind} call`;
  const body = payload.isGroup
    ? `${payload.fromName} is calling ${payload.conversationName ?? 'the group'}`
    : `${payload.fromName} is calling`;

  try {
    await Notifications.scheduleNotificationAsync({
      identifier: callNotificationId(payload.callId),
      content: {
        title,
        body,
        sound: Platform.OS === 'ios' ? 'defaultRingtone' : true,
        sticky: true,
        autoDismiss: false,
        priority: Notifications.AndroidNotificationPriority.MAX,
        categoryIdentifier: CALL_CATEGORY,
        interruptionLevel: 'timeSensitive',
        data: {
          type: 'call.incoming',
          callId: payload.callId,
          conversationId: payload.conversationId,
          fromUserId: payload.fromUserId,
          fromName: payload.fromName,
          mediaKind: payload.mediaKind ?? 'audio',
          isGroup: payload.isGroup ? '1' : '0',
          conversationName: payload.conversationName ?? '',
          categoryId: CALL_CATEGORY,
          href: `/chat?c=${encodeURIComponent(payload.conversationId)}`,
        },
      },
      trigger: { channelId: INCOMING_CALLS_CHANNEL },
    });
  } catch (err) {
    console.warn('[push] failed to present incoming call', err);
  }
}
