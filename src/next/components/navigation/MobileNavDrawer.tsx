import { createPortal } from 'react-dom';
import { Lock, X } from 'lucide-react';
import { MODULES } from '../../constants/navigation';
import { PRODUCT_NAME } from '../../constants/brand';

export const MobileNavDrawer = ({
  open,
  onClose,
  currentPath,
  onNavigate,
}: {
  open: boolean;
  onClose: () => void;
  currentPath: string;
  onNavigate: (path: string) => void;
}) => {
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex md:hidden">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <nav
        aria-label="Navegação"
        className="relative flex h-full w-72 flex-col bg-[var(--color-surface-inverse)] text-[var(--color-ink-inverse)]"
      >
        <div className="flex h-16 items-center justify-between px-4">
          <span className="flex items-center gap-2 text-sm font-black tracking-tight">
            <span className="grid size-8 place-items-center rounded-[var(--radius-md)] bg-[var(--color-brand-500)] text-white">{PRODUCT_NAME.charAt(0)}</span>
            {PRODUCT_NAME}
          </span>
          <button type="button" onClick={onClose} aria-label="Fechar menu" className="grid size-8 place-items-center rounded-full hover:bg-white/10">
            <X className="size-4" />
          </button>
        </div>
        <div className="flex-1 space-y-0.5 overflow-y-auto px-2 py-2">
          {MODULES.map(module => {
            const active = module.path === currentPath;
            const Icon = module.icon;
            return (
              <button
                key={module.id}
                type="button"
                onClick={() => onNavigate(module.path)}
                className={`flex w-full items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-sm font-semibold ${
                  active ? 'bg-[var(--color-brand-600)] text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="size-4.5 shrink-0" aria-hidden="true" />
                <span className="flex-1 text-left">{module.label}</span>
                {!module.ready && <Lock className="size-3.5 shrink-0 opacity-50" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      </nav>
    </div>,
    document.body,
  );
};
