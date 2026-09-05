import { requireOptionalNativeModule } from 'expo';

type CallRingtoneNative = {
  start: () => void;
  stop: () => void;
  ensureIncomingCallChannel: () => void;
};

const native = requireOptionalNativeModule<CallRingtoneNative>('CallRingtone');

/** Loops the user's default phone ringtone on the call/ringer volume stream. */
export function startCallRingtone() {
  try {
    native?.start();
  } catch (err) {
    console.warn('[call-ringtone] start failed', err);
  }
}

export function stopCallRingtone() {
  try {
    native?.stop();
  } catch (err) {
    console.warn('[call-ringtone] stop failed', err);
  }
}

export function ensureIncomingCallChannel() {
  try {
    native?.ensureIncomingCallChannel();
  } catch (err) {
    console.warn('[call-ringtone] channel setup failed', err);
  }
}
