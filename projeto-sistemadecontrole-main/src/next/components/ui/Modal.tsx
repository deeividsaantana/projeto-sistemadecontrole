import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useEffect } from 'react';

export const Modal = ({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) => {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative flex max-h-[85vh] w-full max-w-lg flex-col rounded-[var(--radius-lg)] bg-[var(--color-surface-raised)] shadow-[var(--shadow-popover)]"
      >
        <header className="flex items-center justify-between border-b border-[var(--color-border-subtle)] px-5 py-4">
          <h2 className="text-sm font-bold text-[var(--color-ink-primary)]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="grid size-8 place-items-center rounded-full text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-sunken)]"
          >
            <X className="size-4" />
          </button>
        </header>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="flex justify-end gap-2 border-t border-[var(--color-border-subtle)] px-5 py-4">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
};
