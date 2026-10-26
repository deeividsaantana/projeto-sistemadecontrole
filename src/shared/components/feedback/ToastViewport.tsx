import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import type { AppNotification } from '../../../types';

interface ToastViewportProps {
  toasts: AppNotification[];
}

const getToastColorClass = (type: AppNotification['type']) => {
  if (type === 'success') return 'border-emerald-500/30 bg-white';
  if (type === 'warning') return 'border-amber-500/30 bg-white';
  if (type === 'error') return 'border-rose-500/30 bg-white';
  return 'border-blue-500/30 bg-white';
};

const ToastIcon = ({ type }: { type: AppNotification['type'] }) => {
  if (type === 'success') return <CheckCircle2 className="w-5 h-5 text-emerald-700" aria-hidden="true" />;
  if (type === 'warning') return <AlertTriangle className="w-5 h-5 text-amber-700" aria-hidden="true" />;
  if (type === 'error') return <XCircle className="w-5 h-5 text-rose-700" aria-hidden="true" />;
  return <Info className="w-5 h-5 text-blue-700" aria-hidden="true" />;
};

/**
 * Avisos rápidos no canto. Letra legível (auditoria de 21/10/2026): título
 * sem caixa alta espremida, hora em cinza de 4,5:1 (antes ficava a 1,5:1 com
 * opacidade) e sem o jargão "Tempo Real". O leitor de tela anuncia cada aviso.
 */
export function ToastViewport({ toasts }: ToastViewportProps) {
  return (
    <div role="status" aria-live="polite" className="fixed top-4 right-4 z-50 flex flex-col gap-3 w-[calc(100%-2rem)] max-w-sm pointer-events-none select-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`renea-enter-toast pointer-events-auto border p-4 rounded-2xl shadow-2xl flex gap-3 items-start ${getToastColorClass(toast.type)}`}
          >
            <div className="mt-0.5 shrink-0">
              <ToastIcon type={toast.type} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold block text-slate-900">{toast.title}</span>
                <span className="text-xs tabular-nums shrink-0 text-[#5b6870]">{toast.timestamp}</span>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed mt-1">{toast.message}</p>
              {toast.source && <p className="mt-1.5 text-xs font-semibold text-emerald-800">{toast.source}</p>}
            </div>
          </div>
        ))}
    </div>
  );
}
