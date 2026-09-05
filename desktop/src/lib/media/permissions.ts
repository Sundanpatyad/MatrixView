import { invoke } from '@tauri-apps/api/core';
import { isTauriApp } from '@/lib/webrtc/screenShare';

export type MediaAccessKind = 'audio' | 'video';

export function isMediaPermissionError(err: unknown): boolean {
  if (err instanceof DOMException) {
    return (
      err.name === 'NotAllowedError' ||
      err.name === 'PermissionDeniedError' ||
      err.name === 'SecurityError' ||
      err.name === 'NotFoundError' ||
      err.name === 'NotReadableError'
    );
  }
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return (
    /permission/i.test(msg) && /(camera|microphone|media|denied|required)/i.test(msg)
  );
}

export function mediaKindFromPermissionError(
  err: unknown,
  fallback: MediaAccessKind = 'audio',
): MediaAccessKind {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  if (/camera/i.test(msg) || /video/i.test(msg)) return 'video';
  if (/microphone|mic/i.test(msg) || /audio/i.test(msg)) return 'audio';
  return fallback;
}

function isMobileUserAgent() {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

/** Prefer unconstrained desktop video; facingMode only on phones. */
export function mediaConstraints(kind: MediaAccessKind): MediaStreamConstraints {
  if (kind === 'audio') return { audio: true, video: false };
  return {
    audio: true,
    video: isMobileUserAgent() ? { facingMode: 'user' } : true,
  };
}

/** Probe OS + WebView permission. Prefer native TCC on Tauri/macOS. */
export async function queryMediaPermission(
  kind: MediaAccessKind,
): Promise<PermissionState | 'unsupported'> {
  if (isTauriApp()) {
    try {
      const osStatus = await invoke<string>('os_media_permission_status', { kind });
      if (osStatus === 'authorized') return 'granted';
      if (osStatus === 'denied' || osStatus === 'restricted') return 'denied';
      if (osStatus === 'notDetermined') return 'prompt';
    } catch {
      /* fall through to the Web Permissions API */
    }
  }
  try {
    if (!navigator.permissions?.query) return 'unsupported';
    if (kind === 'video') {
      const cam = await navigator.permissions.query({ name: 'camera' as PermissionName });
      const mic = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      if (cam.state === 'denied' || mic.state === 'denied') return 'denied';
      if (cam.state === 'granted' && mic.state === 'granted') return 'granted';
      return 'prompt';
    }
    const mic = await navigator.permissions.query({ name: 'microphone' as PermissionName });
    return mic.state;
  } catch {
    return 'unsupported';
  }
}

async function waitForCaptureDevices(
  kind: MediaAccessKind,
  timeoutMs = 4000,
): Promise<boolean> {
  if (!navigator.mediaDevices?.enumerateDevices) return true;
  const needVideo = kind === 'video';
  const deadline = Date.now() + timeoutMs;
  do {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audio = devices.some((d) => d.kind === 'audioinput');
    const video = devices.some((d) => d.kind === 'videoinput');
    if (devices.length > 0 && audio && (!needVideo || video)) return true;
    await new Promise((r) => window.setTimeout(r, 150));
  } while (Date.now() < deadline);
  return false;
}

/**
 * Request camera/mic access. On macOS Tauri this first asks the OS (so DockX
 * appears in System Settings). Then it calls getUserMedia for the WebView.
 */
export async function requestMediaAccess(kind: MediaAccessKind): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Media devices are not available in this environment');
  }

  if (isTauriApp()) {
    try {
      const osStatus = await invoke<string>('request_os_media_access', { kind });
      if (osStatus === 'denied' || osStatus === 'restricted') {
        const label = kind === 'video' ? 'Camera and microphone' : 'Microphone';
        throw new DOMException(
          `${label} permission denied. Enable DockX in System Settings → Privacy & Security.`,
          'NotAllowedError',
        );
      }
    } catch (err) {
      if (isMediaPermissionError(err)) throw err;
      // Native command missing (old build) — still try getUserMedia.
    }
  }

  const devicesReady = await waitForCaptureDevices(kind);
  if (!devicesReady) {
    const label = kind === 'video' ? 'Camera and microphone' : 'Microphone';
    throw new DOMException(
      `${label} is not available. Enable DockX in System Settings → Privacy & Security.`,
      'NotAllowedError',
    );
  }

  try {
    return await navigator.mediaDevices.getUserMedia(mediaConstraints(kind));
  } catch (err) {
    const overconstrained =
      err instanceof DOMException &&
      (err.name === 'OverconstrainedError' || err.name === 'ConstraintNotSatisfiedError');
    const invalidConstraint =
      err instanceof Error && /invalid constraint/i.test(err.message);
    if ((overconstrained || invalidConstraint) && kind === 'video') {
      return navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    }
    throw err;
  }
}

export function stopMediaStream(stream: MediaStream | null | undefined) {
  stream?.getTracks().forEach((t) => {
    try {
      t.stop();
    } catch {
      /* ignore */
    }
  });
}

/** Open OS / browser privacy settings for the requested device. */
export async function openMediaPrivacySettings(kind: MediaAccessKind): Promise<boolean> {
  if (isTauriApp()) {
    try {
      await invoke('open_privacy_settings', { kind });
      return true;
    } catch {
      return false;
    }
  }

  // Browsers cannot deep-link into site permission panels reliably.
  // Best effort: open a help page / blank so the user can use the lock icon.
  try {
    window.focus();
  } catch {
    /* ignore */
  }
  return false;
}

export function mediaPermissionSteps(kind: MediaAccessKind): string[] {
  const devices = kind === 'video' ? 'Camera and Microphone' : 'Microphone';
  if (isTauriApp()) {
    const isMac = /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent);
    if (isMac) {
      return [
        `Open Privacy & Security → ${devices} and turn on DockX.`,
        'Return here and tap “Allow access” to start the call.',
      ];
    }
    return [
      'Tap “Allow access” — DockX will prompt for permission or open privacy settings.',
      `Enable DockX under ${devices} privacy settings.`,
      'Return here and tap “Allow access” again.',
    ];
  }
  return [
    'Tap “Allow access” and choose Allow in the browser prompt.',
    'If blocked, use the lock icon in the address bar to allow camera/mic.',
    'Then tap “Allow access” again.',
  ];
}
