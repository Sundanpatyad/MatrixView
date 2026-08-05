import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconMic, IconVideo, IconX } from '@/components/ui/Icons';
import { Button } from '@/components/ui/Button';
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
  /** Called after permission is successfully granted */
  onGranted?: () => void;
};

export function MediaPermissionModal({ open, kind, onClose, onGranted }: Props) {
  const titleId = useId();
  const [busy, setBusy] = useState(false);
  const [openingSettings, setOpeningSettings] = useState(false);
  const [status, setStatus] = useState<PermissionState | 'unsupported'>('unsupported');
  const [hint, setHint] = useState<string | null>(null);
  const steps = mediaPermissionSteps(kind);
  const desktop = isTauriApp();
  const title =
    kind === 'video' ? 'Allow camera & microphone' : 'Allow microphone';
  const Icon = kind === 'video' ? IconVideo : IconMic;

  useEffect(() => {
    if (!open) {
      setBusy(false);
      setOpeningSettings(false);
      setHint(null);
      return;
    }
    void queryMediaPermission(kind).then(setStatus);
  }, [open, kind]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy && !openingSettings) onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, openingSettings, onClose]);

  if (!open) return null;

  async function openSettingsHint(opened: boolean) {
    setHint(
      opened
        ? 'Opened system settings. Enable DockX, then return here and tap “Allow access” again.'
        : desktop
          ? 'Could not open settings automatically. Enable DockX under Privacy & Security, then try again.'
          : 'Use the lock icon in the address bar to allow camera/microphone, then try again.',
    );
  }

  async function onAllow() {
    if (busy) return;
    setBusy(true);
    setHint(null);
    try {
      // Already blocked — OS will not show a prompt again; jump to Settings.
      if (status === 'denied') {
        const opened = await openMediaPrivacySettings(kind);
        await openSettingsHint(opened);
        return;
      }

      const stream = await requestMediaAccess(kind);
      stopMediaStream(stream);
      setStatus('granted');
      setHint('Access enabled. You can start your call now.');
      onGranted?.();
    } catch (err) {
      const denied = isMediaPermissionError(err);
      const invalid =
        err instanceof Error && /invalid constraint/i.test(err.message);
      if (denied) setStatus('denied');

      if (denied || invalid || desktop) {
        // Prompt failed or unavailable — open privacy settings so the user can enable DockX.
        const opened = await openMediaPrivacySettings(kind);
        await openSettingsHint(opened);
      } else {
        setHint(err instanceof Error ? err.message : 'Could not access media devices.');
      }
      void queryMediaPermission(kind).then(setStatus);
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
        className="relative z-10 w-full max-w-md rounded-2xl border border-ink-600 bg-ink-800 p-5 sm:p-6"
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
              <button
                type="button"
                title="Close"
                disabled={busy || openingSettings}
                onClick={onClose}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-400 transition hover:bg-ink-700 hover:text-ink-50 disabled:opacity-40"
              >
                <IconX className="h-4 w-4" />
              </button>
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
          <p
            className={`mt-4 text-[13px] leading-relaxed ${
              status === 'granted' ? 'text-[#23a559]' : 'text-ink-300'
            }`}
          >
            {hint}
          </p>
        ) : null}

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={busy || openingSettings}
            onClick={onClose}
          >
            {status === 'granted' ? 'Close' : 'Not now'}
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
            disabled={busy || openingSettings || status === 'granted'}
            onClick={() => void onAllow()}
          >
            {busy
              ? status === 'denied'
                ? 'Opening…'
                : 'Requesting…'
              : status === 'granted'
                ? 'Access enabled'
                : status === 'denied'
                  ? 'Open Settings'
                  : 'Allow access'}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
