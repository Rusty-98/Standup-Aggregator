import React, { useEffect, useRef } from 'react';

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
  labelledById?: string;
}

export const Modal: React.FC<ModalProps> = ({
  open,
  title,
  onClose,
  children,
  wide = false,
  labelledById = 'modal-title'
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const focusable = panel?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    focusable?.[0]?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !panel || !focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previousFocus.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-scrim" onClick={onClose} role="presentation">
      <div
        ref={panelRef}
        className="modal-panel"
        style={wide ? { maxWidth: 720 } : undefined}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledById}
        onClick={e => e.stopPropagation()}
      >
        <h2 id={labelledById} className="modal-title">{title}</h2>
        {children}
      </div>
    </div>
  );
};

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  busy = false,
  onConfirm,
  onCancel
}) => (
  <Modal open={open} title={title} onClose={onCancel}>
    <p className="modal-body">{message}</p>
    <div className="modal-actions">
      <button type="button" className="btn-secondary" onClick={onCancel} disabled={busy}>
        {cancelLabel}
      </button>
      <button
        type="button"
        className={danger ? 'btn-danger' : 'btn-primary'}
        onClick={onConfirm}
        disabled={busy}
      >
        {busy ? 'Working…' : confirmLabel}
      </button>
    </div>
  </Modal>
);
