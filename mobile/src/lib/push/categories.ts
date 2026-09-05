import * as Notifications from 'expo-notifications';

export const MESSAGE_CATEGORY = 'dockx_message';
export const INVITE_CATEGORY = 'dockx_invite';
export const CALL_CATEGORY = 'dockx_call';

export const ACTION = {
  reply: 'reply',
  markRead: 'mark_read',
  mute: 'mute',
  qrWhatsUp: 'qr_whats_up',
  qrHowAreYou: 'qr_how_are_you',
  accept: 'accept',
  decline: 'decline',
  callAccept: 'call_accept',
  callDecline: 'call_decline',
} as const;

export const QUICK_REPLY_TEXT: Record<string, string> = {
  [ACTION.qrWhatsUp]: "What's up?",
  [ACTION.qrHowAreYou]: 'How are you?',
};

const shadeOnly = { opensAppToForeground: false };

export async function registerNotificationCategories(): Promise<void> {
  // Android shows at most 3 shade actions. Extra buttons are dropped.
  await Notifications.setNotificationCategoryAsync(MESSAGE_CATEGORY, [
    {
      identifier: ACTION.reply,
      buttonTitle: 'Reply',
      options: shadeOnly,
      textInput: {
        placeholder: 'Reply…',
        submitButtonTitle: 'Send',
      },
    },
    {
      identifier: ACTION.markRead,
      buttonTitle: 'Mark as read',
      options: shadeOnly,
    },
    {
      identifier: ACTION.mute,
      buttonTitle: 'Mute',
      options: shadeOnly,
    },
  ]);

  await Notifications.setNotificationCategoryAsync(INVITE_CATEGORY, [
    {
      identifier: ACTION.accept,
      buttonTitle: 'Accept',
      options: { opensAppToForeground: true },
    },
    {
      identifier: ACTION.decline,
      buttonTitle: 'Decline',
      options: { opensAppToForeground: false, isDestructive: true },
    },
  ]);

  await Notifications.setNotificationCategoryAsync(CALL_CATEGORY, [
    {
      identifier: ACTION.callAccept,
      buttonTitle: 'Accept',
      options: { opensAppToForeground: true },
    },
    {
      identifier: ACTION.callDecline,
      buttonTitle: 'Decline',
      options: { opensAppToForeground: false, isDestructive: true },
    },
  ]);
}
