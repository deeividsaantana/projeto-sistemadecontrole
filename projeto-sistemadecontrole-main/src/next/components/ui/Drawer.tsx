import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';

export const Drawer = ({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) => {
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative flex h-full w-full max-w-md flex-col bg-[var(--color-surface-raised)] shadow-[var(--shadow-popover)]"
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
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
};
