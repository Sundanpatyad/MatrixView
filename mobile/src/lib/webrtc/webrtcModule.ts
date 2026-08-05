import { NativeModules, PermissionsAndroid, Platform } from 'react-native';

type WebRTCApi = typeof import('react-native-webrtc');

export type RTCMediaStream = InstanceType<WebRTCApi['MediaStream']>;
export type RTCMediaStreamTrack = InstanceType<WebRTCApi['MediaStreamTrack']>;
export type RTCPeer = InstanceType<WebRTCApi['RTCPeerConnection']>;

export const CALLING_UNSUPPORTED_MESSAGE =
  'Calling needs the native WebRTC module, which Expo Go does not bundle. Run a development build to place and receive calls.';

let cached: WebRTCApi | null | undefined;

/**
 * react-native-webrtc throws at import time when its native module is absent,
 * which is always the case in Expo Go. Loading it lazily behind a guard keeps
 * the rest of the app usable there while calls light up in a dev build.
 */
export function getWebRTC(): WebRTCApi | null {
  if (cached !== undefined) return cached;

  if (!NativeModules.WebRTCModule) {
    cached = null;
    return cached;
  }

  try {
    const mod = require('react-native-webrtc') as WebRTCApi;
    cached = typeof mod?.RTCPeerConnection === 'function' ? mod : null;
  } catch {
    cached = null;
  }

  return cached;
}

export function isCallingSupported(): boolean {
  return getWebRTC() !== null;
}

/**
 * getUserMedia surfaces the OS prompt on iOS but fails outright on Android
 * unless the runtime permissions were granted first.
 */
export async function ensureCallPermissions(withVideo: boolean): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  const required = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];
  if (withVideo) required.push(PermissionsAndroid.PERMISSIONS.CAMERA);

  const result = await PermissionsAndroid.requestMultiple(required);
  return required.every((permission) => result[permission] === PermissionsAndroid.RESULTS.GRANTED);
}
