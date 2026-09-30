import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { t } from '../../i18n/translations';

interface ConfirmDialogProps {
  title: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Shared destructive-action confirmation. Rendered in a portal (cards use
 * transforms/overflow that would trap a fixed overlay), exposed as a modal
 * alertdialog, focuses the safe choice, closes on Escape or backdrop tap and
 * returns focus to the control that opened it. Buttons keep 44px tap targets.
 */
export function ConfirmDialog({ title, confirmLabel, cancelLabel, onConfirm, onCancel }: ConfirmDialogProps) {
  const titleId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCancel();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      opener?.focus?.();
    };
  }, [onCancel]);

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 p-4" onClick={onCancel}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-xs rounded-[var(--app-radius-card)] bg-white p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <p id={titleId} className="mb-4 text-sm font-medium text-neutral-900">{title}</p>
        <div className="flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="min-h-[var(--app-touch-target)] rounded-lg px-4 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100"
          >
            {cancelLabel || t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="min-h-[var(--app-touch-target)] rounded-lg bg-red-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-red-700"
          >
            {confirmLabel || t('common.delete')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * In-app replacement for window.confirm(): `confirm(title, onConfirm)` opens
 * the shared dialog; render `dialog` once in the component tree.
 */
export function useConfirmDialog(): { confirm: (title: string, onConfirm: () => void, confirmLabel?: string) => void; dialog: ReactNode } {
  const [pending, setPending] = useState<{ title: string; onConfirm: () => void; confirmLabel?: string } | null>(null);
  const confirm = useCallback((title: string, onConfirm: () => void, confirmLabel?: string) => setPending({ title, onConfirm, confirmLabel }), []);
  const cancel = useCallback(() => setPending(null), []);
  const dialog = pending ? (
    <ConfirmDialog
      title={pending.title}
      confirmLabel={pending.confirmLabel}
      onCancel={cancel}
      onConfirm={() => {
        setPending(null);
        pending.onConfirm();
      }}
    />
  ) : null;
  return { confirm, dialog };
}
