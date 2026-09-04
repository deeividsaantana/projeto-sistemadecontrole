import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from './styles';

type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

interface ModalProps {
  open: boolean;
  title?: ReactNode;
  description?: ReactNode;
  size?: ModalSize;
  /** Bloqueia fechar por ESC/clique fora enquanto uma ação está em andamento. */
  busy?: boolean;
  role?: 'dialog' | 'alertdialog';
  footer?: ReactNode;
  onClose: () => void;
  children?: ReactNode;
  className?: string;
}

const sizeClass: Record<ModalSize, string> = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-xl',
  lg: 'sm:max-w-3xl',
  xl: 'sm:max-w-5xl',
};

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Base de todos os diálogos do sistema: ESC fecha, clique fora fecha, o corpo
 * para de rolar e o foco fica preso dentro do diálogo. No celular abre como
 * folha inferior para o conteúdo nunca sair da tela.
 */
export function Modal({
  open,
  title,
  description,
  size = 'md',
  busy = false,
  role = 'dialog',
  footer,
  onClose,
  children,
  className,
}: ModalProps) {
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) {
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;
      const controls = panel.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!controls.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [busy, onClose, open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/45 backdrop-blur-[1px] sm:items-center sm:p-4"
      role="presentation"
      onMouseDown={event => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <section
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        className={cn(
          'flex max-h-[92vh] w-full flex-col rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:max-h-[88vh] sm:rounded-2xl',
          sizeClass[size],
          className,
        )}
      >
        {(title || description) && (
          <header className="flex items-start gap-3 border-b border-slate-100 px-5 py-4">
            <div className="min-w-0 flex-1">
              {title && <h2 className="text-base font-bold text-slate-900">{title}</h2>}
              {description && <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>}
            </div>
            <button
              type="button"
              aria-label="Fechar"
              disabled={busy}
              onClick={onClose}
              className="shrink-0 rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
            >
              <X size={18} />
            </button>
          </header>
        )}
        {children && <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>}
        {footer && <footer className="border-t border-slate-100 px-5 py-4">{footer}</footer>}
      </section>
    </div>
  );
}
