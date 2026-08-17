import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import type { AppNotification } from '../../../types';

interface ToastViewportProps {
  toasts: AppNotification[];
}

const getToastColorClass = (type: AppNotification['type']) => {
  if (type === 'success') return 'border-emerald-500/20 bg-slate-900/95 text-emerald-400';
  if (type === 'warning') return 'border-amber-500/20 bg-slate-900/95 text-amber-400';
  if (type === 'error') return 'border-rose-500/20 bg-slate-900/95 text-rose-400';
  return 'border-blue-500/20 bg-slate-900/95 text-blue-400';
};

const ToastIcon = ({ type }: { type: AppNotification['type'] }) => {
  if (type === 'success') return <CheckCircle2 className="w-5 h-5 text-emerald-400" />;
  if (type === 'warning') return <AlertTriangle className="w-5 h-5 text-amber-400" />;
  if (type === 'error') return <XCircle className="w-5 h-5 text-rose-400" />;
  return <Info className="w-5 h-5 text-blue-400" />;
};

export function ToastViewport({ toasts }: ToastViewportProps) {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-3 w-full max-w-sm pointer-events-none select-none">
      <AnimatePresence>
        {toasts.map(toast => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 50, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 50, scale: 0.95 }}
            className={`pointer-events-auto border p-4 rounded-2xl shadow-2xl flex gap-3 items-start backdrop-blur-md ${getToastColorClass(toast.type)}`}
          >
            <div className="mt-0.5 shrink-0">
              <ToastIcon type={toast.type} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider block truncate text-slate-100">{toast.title}</span>
                <span className="text-[9px] font-mono opacity-50 shrink-0 text-slate-400">{toast.timestamp}</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed mt-1">{toast.message}</p>
              <div className="flex items-center gap-1.5 mt-2">
                <span className="text-[8px] px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-md font-mono uppercase font-black">{toast.source}</span>
                <span className="text-[9px] text-slate-500">Tempo Real</span>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
