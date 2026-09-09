import type { LucideIcon } from 'lucide-react';
import { ChevronRight } from 'lucide-react';
import { ESTADO_CLASSES, type EstadoOperacional } from './tokens';
import { cn } from './styles';

interface KpiCardProps {
  label: string;
  valor: string | number;
  /** Linha de contexto embaixo do número: "de 32 equipamentos". */
  contexto?: string;
  /** Percentual da barra inferior. Sem valor, a barra não aparece. */
  percentual?: number;
  /** Texto curto à direita do número, como "87,5%". */
  destaque?: string;
  icone?: LucideIcon;
  estado?: EstadoOperacional;
  onClick?: () => void;
  className?: string;
}

/**
 * Cartão de indicador do painel: ícone discreto, número grande, contexto e uma
 * barra fina de proporção. Compacto de propósito — quatro deles precisam caber
 * em uma linha sem empurrar o conteúdo da tela para baixo.
 */
export function KpiCard({
  label,
  valor,
  contexto,
  percentual,
  destaque,
  icone: Icone,
  estado = 'neutro',
  onClick,
  className,
}: KpiCardProps) {
  const cores = ESTADO_CLASSES[estado];
  const Raiz = onClick ? 'button' : 'div';

  return (
    <Raiz
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      className={cn(
        'group flex w-full flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-slate-300',
        onClick && 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 active:scale-[0.995]',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-start gap-2">
          {Icone && (
            <span className={cn('grid size-8 shrink-0 place-items-center rounded-lg', cores.icone)}>
              <Icone className="h-4 w-4" strokeWidth={2.2} />
            </span>
          )}
          <span className="min-w-0 text-[12px] font-semibold leading-tight text-slate-600">{label}</span>
        </span>
        {onClick && <ChevronRight className="h-4 w-4 shrink-0 text-slate-700 transition-colors group-hover:text-emerald-600" />}
      </div>

      <div className="flex flex-wrap items-baseline gap-x-2">
        <strong className={cn('text-[30px] font-bold leading-none tabular-nums', cores.valor)}>{valor}</strong>
        {destaque && <span className="text-[12px] font-semibold text-slate-500">{destaque}</span>}
      </div>

      {contexto && <p className="-mt-1 text-[11px] leading-tight text-slate-500">{contexto}</p>}

      {percentual !== undefined && (
        <div className="h-1 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={cn('h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none', cores.barra)}
            style={{ width: `${Math.max(0, Math.min(100, percentual))}%` }}
          />
        </div>
      )}
    </Raiz>
  );
}

interface CompactMetricProps {
  label: string;
  valor: string | number;
  contexto?: string;
  /** Pill curto à direita: "84%", "+12%". */
  variacao?: string;
  estado?: EstadoOperacional;
  icone?: LucideIcon;
  onClick?: () => void;
  className?: string;
}

/** Métrica secundária: mesma linguagem do KPI, com metade da altura. */
export function CompactMetric({
  label,
  valor,
  contexto,
  variacao,
  estado = 'neutro',
  icone: Icone,
  onClick,
  className,
}: CompactMetricProps) {
  const cores = ESTADO_CLASSES[estado];
  const Raiz = onClick ? 'button' : 'div';

  return (
    <Raiz
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-slate-300',
        onClick && 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 active:scale-[0.995]',
        className,
      )}
    >
      {Icone && (
        <span className={cn('grid size-9 shrink-0 place-items-center rounded-lg', cores.icone)}>
          <Icone className="h-4.5 w-4.5" strokeWidth={2.2} />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-[12px] font-semibold leading-tight text-slate-600">{label}</span>
        <span className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
          <strong className="text-[22px] font-bold leading-none tabular-nums text-slate-900">{valor}</strong>
          {contexto && <span className="text-[11px] text-slate-500">{contexto}</span>}
        </span>
      </span>
      {variacao && (
        <span className={cn('shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold', cores.chip)}>{variacao}</span>
      )}
    </Raiz>
  );
}
