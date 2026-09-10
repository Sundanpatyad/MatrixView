import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconMic, IconVideo, IconX } from '@/components/ui/Icons';
import { Button } from '@/components/ui/Button';
import { Tooltip } from '@/components/ui/Tooltip';
import {
  isMediaPermissionError,
  mediaPermissionSteps,
  openMediaPrivacySettings,
  queryMediaPermission,
  requestMediaAccess,
  stopMediaStream,
  type MediaAccessKind,
} from '@/lib/media/permissions';
import { isTauriApp } from '@/lib/webrtc/screenShare';

type Props = {
  open: boolean;
  kind: MediaAccessKind;
  onClose: () => void;
  /** Called after getUserMedia actually succeeds — parent should retry the call. */
  onGranted?: () => void;
};

export function MediaPermissionModal({ open, kind, onClose, onGranted }: Props) {
  const titleId = useId();
  const [busy, setBusy] = useState(false);
  const [openingSettings, setOpeningSettings] = useState(false);
  const [status, setStatus] = useState<PermissionState | 'unsupported'>('prompt');
  const [hint, setHint] = useState<string | null>(null);
  const steps = mediaPermissionSteps(kind);
  const desktop = isTauriApp();
  const title =
    kind === 'video' ? 'Allow camera & microphone' : 'Allow microphone';
  const Icon = kind === 'video' ? IconVideo : IconMic;
  const onGrantedRef = useRef(onGranted);
  onGrantedRef.current = onGranted;
  const openRef = useRef(open);
  openRef.current = open;

  function finishGranted() {
    setStatus('granted');
    onGrantedRef.current?.();
  }

  useEffect(() => {
    if (!open) {
      setBusy(false);
      setOpeningSettings(false);
      setHint(null);
      setStatus('prompt');
      return;
    }

    let cancelled = false;
    void queryMediaPermission(kind).then((queried) => {
      if (cancelled || !openRef.current) return;
      setStatus(queried === 'denied' ? 'denied' : 'prompt');
    });
    return () => {
      cancelled = true;
    };
  }, [open, kind]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy && !openingSettings) onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, openingSettings, onClose]);

  function applyAccessError(err: unknown) {
    const denied = isMediaPermissionError(err);
    const invalid = err instanceof Error && /invalid constraint/i.test(err.message);
    if (denied) setStatus('denied');
    else setStatus('prompt');

    if (denied) {
      setHint(
        desktop
          ? 'macOS blocked access. Tap Open Settings, enable DockX under Camera and Microphone, then tap Allow access again.'
          : 'Permission was blocked. Allow camera/microphone, then try again.',
      );
    } else if (invalid) {
      setHint('This camera/microphone could not be opened. Check that no other app is using them.');
    } else {
      setHint(err instanceof Error ? err.message : 'Could not access media devices.');
    }
  }

  if (!open) return null;

  async function onAllow() {
    if (busy) return;
    setBusy(true);
    setHint(null);
    try {
      const stream = await requestMediaAccess(kind);
      stopMediaStream(stream);
      finishGranted();
    } catch (err) {
      applyAccessError(err);
    } finally {
      setBusy(false);
    }
  }

  async function onOpenSettings() {
    if (openingSettings) return;
    setOpeningSettings(true);
    setHint(null);
    try {
      const opened = await openMediaPrivacySettings(kind);
      setHint(
        opened
          ? 'Settings opened. Enable DockX, then return and tap “Allow access”.'
          : desktop
            ? 'Could not open settings. Open Privacy & Security manually for DockX.'
            : 'Open the lock icon in your browser address bar to manage site permissions.',
      );
    } finally {
      setOpeningSettings(false);
    }
  }

  return createPortal(
    <div className="dockx-modal-layer fixed inset-0 z-[11050] flex items-center justify-center bg-black/60 p-4">
      <button
        type="button"
        className="absolute inset-0"
        aria-label="Close"
        onClick={() => {
          if (!busy && !openingSettings) onClose();
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-ink-600/80 bg-ink-800 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.45)] sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-500/15 text-brand-300">
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h2 id={titleId} className="text-base font-semibold tracking-tight text-ink-50">
                {title}
              </h2>
              <Tooltip label="Close" side="left">
              <button
                type="button"
                aria-label="Close"
                disabled={busy || openingSettings}
                onClick={onClose}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-400 transition hover:bg-ink-700 hover:text-ink-50 disabled:opacity-40"
              >
                <IconX className="h-4 w-4" />
              </button>
              </Tooltip>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-300">
              {kind === 'video'
                ? 'DockX needs camera and microphone access to start a video call.'
                : 'DockX needs microphone access to start an audio call.'}
            </p>
          </div>
        </div>

        {status === 'denied' ? (
          <div className="mt-4 rounded-xl border border-[#ed4245]/30 bg-[#ed4245]/10 px-3.5 py-3">
            <p className="text-[13px] font-semibold text-[#ed4245]">Permission blocked</p>
            <p className="mt-1 text-[12px] leading-relaxed text-ink-200">
              {desktop
                ? 'Turn on DockX in system privacy settings, then tap Allow access again.'
                : 'Allow camera/microphone for this site, then tap Allow access again.'}
            </p>
          </div>
        ) : null}

        <ol className="mt-4 space-y-2.5">
          {steps.map((step, i) => (
            <li key={step} className="flex gap-2.5 text-[13px] leading-relaxed text-ink-200">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink-900 text-[11px] font-semibold text-ink-300">
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>

        {hint ? (
          <p className="mt-4 text-[13px] leading-relaxed text-ink-300">{hint}</p>
        ) : null}

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={busy || openingSettings}
            onClick={onClose}
          >
            Not now
          </Button>
          {desktop || status === 'denied' ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={busy || openingSettings}
              onClick={() => void onOpenSettings()}
            >
              {openingSettings ? 'Opening…' : 'Open Settings'}
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            disabled={busy || openingSettings}
            onClick={() => {
              if (status === 'granted') onGrantedRef.current?.();
              else void onAllow();
            }}
          >
            {busy ? 'Requesting…' : status === 'granted' ? 'Start call' : 'Allow access'}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
