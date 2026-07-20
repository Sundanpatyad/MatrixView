/**
 * Acquire a screen-share MediaStreamTrack.
 * 1) Prefer browser/OS picker (entire screen / window / tab) via getDisplayMedia
 * 2) Fall back to DockX native capture (full screen or window) for Tauri/macOS
 *    where getDisplayMedia is often blocked in WKWebView.
 */
import { invoke } from '@tauri-apps/api/core';

export type CaptureTarget = {
  id: number;
  kind: 'monitor' | 'window' | string;
  name: string;
  width: number;
  height: number;
};

export type ScreenShareHandle = {
  stream: MediaStream;
  stop: () => void;
  source: 'display-media' | 'native';
};

export function isTauriApp(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function isMobileBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)) return true;
  return navigator.maxTouchPoints > 1 && window.matchMedia('(max-width: 1024px)').matches;
}

function isOwnAppWindow(name: string): boolean {
  const n = name.trim().toLowerCase();
  return (
    n === 'dockx' ||
    n.startsWith('dockx ') ||
    n.includes('dockx —') ||
    n.includes('dockx -') ||
    n === 'app'
  );
}

export async function listNativeCaptureTargets(): Promise<CaptureTarget[]> {
  if (!isTauriApp()) return [];
  const targets = await invoke<CaptureTarget[]>('list_capture_targets');
  // Prefer windows over full screens; never offer DockX itself (mirror loop).
  const windows = targets.filter((t) => t.kind === 'window' && !isOwnAppWindow(t.name));
  const monitors = targets.filter((t) => t.kind === 'monitor');
  return [...windows, ...monitors];
}

async function tryGetDisplayMedia(): Promise<MediaStream | null> {
  if (!navigator.mediaDevices?.getDisplayMedia) return null;
  const mobile = isMobileBrowser();
  try {
    // Mobile Chrome/Android reject desktop-only constraints (displaySurface: window, etc.).
    // Keep options minimal so the system picker can open.
    if (mobile) {
      return await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
    }
    // Prefer a window/tab and exclude this browser surface to avoid hall-of-mirrors.
    return await navigator.mediaDevices.getDisplayMedia({
      video: {
        displaySurface: 'window',
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 30, max: 30 },
      } as MediaTrackConstraints,
      audio: false,
      // Chromium: hide the current tab/window from the picker
      ...({
        selfBrowserSurface: 'exclude',
        surfaceSwitching: 'include',
        preferCurrentTab: false,
      } as DisplayMediaStreamOptions),
    });
  } catch (err) {
    // User cancel → rethrow; permission/unsupported → null for fallback
    if (err instanceof DOMException && err.name === 'NotAllowedError') {
      // Could be user cancel OR silent deny (Tauri). Prefer fallback in Tauri.
      if (isTauriApp()) return null;
      throw err;
    }
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw err;
    }
    // Mobile: retry once with bare-minimum options if the first attempt failed
    // for constraint reasons (common on Android WebView / older Chrome).
    if (mobile && err instanceof DOMException && err.name === 'NotSupportedError') {
      try {
        return await navigator.mediaDevices.getDisplayMedia({ video: true });
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function startNativeCapture(target: CaptureTarget): Promise<ScreenShareHandle> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Could not create canvas for screen share');

  const stream = canvas.captureStream(12);
  const videoTrack = stream.getVideoTracks()[0];
  if (videoTrack) videoTrack.contentHint = 'detail';

  let stopped = false;
  let inFlight = false;
  const img = new Image();

  const tick = async () => {
    if (stopped || inFlight) return;
    inFlight = true;
    try {
      const bytes = await invoke<number[] | Uint8Array>('capture_frame', {
        kind: target.kind,
        id: target.id,
      });
      const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
      const blob = new Blob([u8], { type: 'image/jpeg' });
      const url = URL.createObjectURL(blob);
      try {
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('Failed to decode frame'));
          img.src = url;
        });
        if (stopped) return;
        if (canvas.width !== img.naturalWidth || canvas.height !== img.naturalHeight) {
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
        }
        ctx.drawImage(img, 0, 0);
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch {
      /* drop frame */
    } finally {
      inFlight = false;
    }
  };

  await tick();
  const timer = window.setInterval(() => {
    void tick();
  }, 90);

  const stop = () => {
    if (stopped) return;
    stopped = true;
    window.clearInterval(timer);
    stream.getTracks().forEach((t) => t.stop());
  };

  videoTrack?.addEventListener('ended', stop);

  return { stream, stop, source: 'native' };
}

/**
 * Prefer system picker; if it fails (common in Tauri), use native target.
 */
export async function acquireScreenShare(options?: {
  /** When provided, skip system picker and use DockX capture */
  nativeTarget?: CaptureTarget;
  preferNative?: boolean;
}): Promise<ScreenShareHandle> {
  if (options?.nativeTarget) {
    return startNativeCapture(options.nativeTarget);
  }

  if (!options?.preferNative) {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      throw new Error(
        isMobileBrowser()
          ? 'Screen sharing isn’t supported in this mobile browser. Try Chrome on Android, or share from a desktop.'
          : 'Screen sharing is not supported in this browser',
      );
    }
    const display = await tryGetDisplayMedia();
    if (display) {
      const stop = () => {
        display.getTracks().forEach((t) => t.stop());
      };
      display.getVideoTracks()[0]?.addEventListener('ended', stop);
      return { stream: display, stop, source: 'display-media' };
    }
  }

  if (!isTauriApp()) {
    throw new Error(
      isMobileBrowser()
        ? 'Couldn’t start screen share. On Android use Chrome and allow screen capture; iPhone/iPad browsers often block sharing.'
        : 'Screen sharing was blocked or cancelled',
    );
  }

  const targets = await listNativeCaptureTargets();
  // Prefer a window over a full display (full display includes DockX → mirror loop).
  const target =
    targets.find((t) => t.kind === 'window') ??
    targets.find((t) => t.kind === 'monitor') ??
    targets[0];
  if (!target) {
    throw new Error(
      'No screen available. Grant Screen Recording to DockX in macOS System Settings → Privacy & Security.',
    );
  }
  return startNativeCapture(target);
}
