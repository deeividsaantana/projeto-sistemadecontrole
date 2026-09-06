import type { LucideIcon } from 'lucide-react';
import { ESTADO_CLASSES, type EstadoOperacional } from './tokens';
import { cn } from './styles';

interface QuickActionProps {
  titulo: string;
  descricao?: string;
  icone: LucideIcon;
  estado?: EstadoOperacional;
  onClick: () => void;
  className?: string;
}

/**
 * Ação grande de campo e do assistente. Alvo alto de propósito: quem usa está
 * de luva, no sol, com o celular em uma mão só.
 */
export function QuickAction({ titulo, descricao, icone: Icone, estado = 'operacao', onClick, className }: QuickActionProps) {
  const cores = ESTADO_CLASSES[estado];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex min-h-16 w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left transition-all hover:border-emerald-500 hover:bg-emerald-50/30 active:scale-[0.99]',
        className,
      )}
    >
      <span className={cn('grid size-10 shrink-0 place-items-center rounded-lg', cores.icone)}>
        <Icone className="h-5 w-5" strokeWidth={2.2} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[14px] font-semibold text-slate-800">{titulo}</span>
        {descricao && <span className="block truncate text-[11px] text-slate-500">{descricao}</span>}
      </span>
    </button>
  );
}
