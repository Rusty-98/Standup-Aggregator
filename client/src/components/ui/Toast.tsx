import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export type ToastKind = 'ok' | 'err';

export interface ToastMessage {
  id: number;
  type: ToastKind;
  text: string;
}

interface ToastHostProps {
  toasts: ToastMessage[];
  onDismiss: (id: number) => void;
}

export const ToastHost: React.FC<ToastHostProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-host" aria-live="polite" aria-relevant="additions">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`} role="status">
          <div className="toast-body">{t.text}</div>
          <button
            type="button"
            className="toast-dismiss"
            aria-label="Dismiss"
            onClick={() => onDismiss(t.id)}
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
};

export function useToasts(ttlMs = 4000) {
  const [toasts, setToasts] = React.useState<ToastMessage[]>([]);
  const seq = React.useRef(0);

  const dismiss = React.useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const notify = React.useCallback((type: ToastKind, text: string) => {
    const id = ++seq.current;
    setToasts(prev => [...prev.slice(-4), { id, type, text }]);
    window.setTimeout(() => dismiss(id), ttlMs);
  }, [dismiss, ttlMs]);

  return { toasts, notify, dismiss };
}

/** Auto-dismiss wrapper used when parent only needs notify + host */
export const ToastStack: React.FC<{
  notice: { type: ToastKind; text: string } | null;
  onClear: () => void;
}> = ({ notice, onClear }) => {
  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(onClear, 4000);
    return () => window.clearTimeout(t);
  }, [notice, onClear]);

  if (!notice) return null;
  return (
    <div className="toast-host" aria-live="polite">
      <div className={`toast toast-${notice.type}`} role="status">
        <div className="toast-body">{notice.text}</div>
        <button type="button" className="toast-dismiss" aria-label="Dismiss" onClick={onClear}>
          <X size={14} />
        </button>
      </div>
    </div>
  );
};
