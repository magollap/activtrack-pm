import { useState, type ReactNode } from 'react';
import { Modal } from '@/components/Modal';
import { useToast } from '@/hooks/useToast';

interface ConfirmDialogProps {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
  destructive?: boolean;
  requireText?: string;
  children?: ReactNode;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  onClose,
  destructive = true,
  requireText,
  children,
}: ConfirmDialogProps) {
  const toast = useToast();
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const blocked = requireText !== undefined && typed !== requireText;

  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
      onClose();
    } catch (error) {
      toast.error(error);
      setBusy(false);
    }
  };

  return (
    <Modal
      title={title}
      onClose={onClose}
      size="sm"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className={destructive ? 'btn-danger' : 'btn-primary'}
            onClick={confirm}
            disabled={blocked || busy}
            autoFocus={requireText === undefined}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300">
        <div>{message}</div>
        {children}
        {requireText !== undefined && (
          <div>
            <label className="label" htmlFor="confirm-text">Type {requireText} to confirm</label>
            <input
              id="confirm-text"
              className="input"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              autoFocus
            />
          </div>
        )}
      </div>
    </Modal>
  );
}
