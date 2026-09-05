import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { isTauriApp } from '@/lib/webrtc/screenShare';

export const DESKTOP_OPEN_HREF_EVENT = 'dockx:open-href';

type PushContext = {
  conversationId?: string | null;
};

let pushContext: PushContext = {};
let permissionPromise: Promise<boolean> | null = null;

export function setDesktopPushContext(next: PushContext) {
  pushContext = { ...pushContext, ...next };
}

export async function ensureDesktopNotificationPermission(): Promise<boolean> {
  if (permissionPromise) return permissionPromise;
  permissionPromise = (async () => {
    try {
      if (isTauriApp()) {
        let granted = await isPermissionGranted();
        if (!granted) granted = (await requestPermission()) === 'granted';
        return granted;
      }
      if (typeof Notification === 'undefined') return false;
      if (Notification.permission === 'granted') return true;
      if (Notification.permission === 'denied') return false;
      return (await Notification.requestPermission()) === 'granted';
    } catch (err) {
      console.warn('[desktop-push] permission failed', err);
      permissionPromise = null;
      return false;
    }
  })();
  return permissionPromise;
}

export async function focusDockXWindow() {
  try {
    if (isTauriApp()) {
      const win = getCurrentWindow();
      await win.unminimize();
      await win.show();
      await win.setFocus();
      return;
    }
  } catch {
    /* fall through */
  }
  window.focus();
}

export function openDesktopHref(href: string) {
  window.dispatchEvent(new CustomEvent(DESKTOP_OPEN_HREF_EVENT, { detail: { href } }));
}

function lookingAtHref(href: string): boolean {
  if (!href) return false;
  try {
    const target = new URL(href, window.location.origin);
    const here = new URL(window.location.href);
    if (target.pathname === '/chat') {
      const conv = target.searchParams.get('c');
      if (!conv) return here.pathname === '/chat';
      if (conv === pushContext.conversationId) return true;
      return here.pathname === '/chat' && here.searchParams.get('c') === conv;
    }
    if (target.pathname !== here.pathname) return false;
    for (const [key, value] of target.searchParams) {
      if (here.searchParams.get(key) !== value) return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function shouldShowDesktopPush(href?: string): boolean {
  if (!document.hasFocus()) return true;
  if (!href) return false;
  return !lookingAtHref(href);
}

type ShowOpts = {
  title: string;
  body?: string;
  href?: string;
  tag?: string;
};

export async function showDesktopPush(opts: ShowOpts): Promise<void> {
  if (!shouldShowDesktopPush(opts.href)) return;
  const granted = await ensureDesktopNotificationPermission();
  if (!granted) return;

  const title = opts.title.trim() || 'DockX';
  const body = (opts.body ?? '').trim();
  const href = opts.href ?? '';
  const tag = opts.tag || href || title;

  const onClick = () => {
    void focusDockXWindow();
    if (href) openDesktopHref(href);
  };

  try {
    if (typeof Notification !== 'undefined') {
      const note = new Notification(title, { body, tag });
      note.onclick = () => {
        note.close();
        onClick();
      };
      return;
    }
  } catch (err) {
    console.warn('[desktop-push] Notification API failed', err);
  }

  try {
    sendNotification({ title, body, extra: { href } });
  } catch (err) {
    console.warn('[desktop-push] sendNotification failed', err);
  }
}
