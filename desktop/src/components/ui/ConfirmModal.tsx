import { Button } from '@/components/ui/Button';
import { Modal, ModalFooter, ModalHeader } from '@/components/ui/Modal';
import { useEffect, useId, useState } from 'react';

type Props = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Use danger styling for destructive actions */
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
};

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: Props) {
  const titleId = useId();
  const [pending, setPending] = useState(false);
  const loading = busy || pending;

  useEffect(() => {
    if (!open) setPending(false);
  }, [open]);

  if (!open) return null;

  async function handleConfirm() {
    if (loading) return;
    setPending(true);
    try {
      await onConfirm();
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      size="sm"
      labelledBy={titleId}
      onClose={onCancel}
      closeOnBackdrop={!loading}
      closeOnEscape={!loading}
      zClass="z-[10000]"
      className="sm:max-h-none"
    >
      <ModalHeader title={title} titleId={titleId} onClose={loading ? undefined : onCancel} />
      <p className="px-5 py-4 text-sm leading-relaxed text-ink-200">{message}</p>
      <ModalFooter>
        <Button type="button" variant="secondary" size="sm" disabled={loading} onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button
          type="button"
          variant={danger ? 'danger' : 'primary'}
          size="sm"
          disabled={loading}
          onClick={() => void handleConfirm()}
        >
          {loading ? 'Please wait…' : confirmLabel}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
