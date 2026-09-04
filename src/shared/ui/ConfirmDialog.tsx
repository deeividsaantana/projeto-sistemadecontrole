import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';
import { cn } from './styles';

type ConfirmTone = 'danger' | 'warning' | 'neutral';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

const confirmToneClass: Record<ConfirmTone, string> = {
  danger: 'bg-rose-600 hover:bg-rose-700 focus:ring-rose-500',
  warning: 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500',
  neutral: 'bg-slate-800 hover:bg-slate-900 focus:ring-slate-500',
};

const iconToneClass: Record<ConfirmTone, string> = {
  danger: 'bg-rose-50 text-rose-600',
  warning: 'bg-amber-50 text-amber-600',
  neutral: 'bg-slate-100 text-slate-600',
};

/** Confirmação para ações destrutivas ou críticas. Não usar em ações comuns. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  tone = 'danger',
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      role="alertdialog"
      size="sm"
      busy={busy}
      onClose={onCancel}
      footer={(
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onConfirm()}
            className={cn(
              'min-h-11 rounded-lg px-4 text-sm font-bold text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-wait disabled:opacity-60',
              confirmToneClass[tone],
            )}
          >
            {busy ? 'Processando...' : confirmLabel}
          </button>
        </div>
      )}
    >
      <div className="flex items-start gap-3">
        <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-full', iconToneClass[tone])}>
          <AlertTriangle size={20} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold text-slate-900">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
        </div>
      </div>
    </Modal>
  );
}
