import { CountUp } from '../../shared/ui/CountUp';
import { cn } from '../../shared/ui/styles';

export type TomDoNumero = 'neutro' | 'ok' | 'alerta' | 'perigo';

export interface NumeroDoResumo {
  rotulo: string;
  valor: number | string;
  /** Frase curta embaixo do número: "de 20 vias", "2 faltando". */
  detalhe?: string;
  tom?: TomDoNumero;
}

const COR: Record<TomDoNumero, string> = {
  neutro: 'text-slate-900',
  ok: 'text-[#176b4d]',
  alerta: 'text-amber-800',
  perigo: 'text-rose-700',
};

/** Faixa de números do resumo, no visual dos cartões do Painel. */
export function Numeros({ itens, rotulo, className }: { itens: readonly NumeroDoResumo[]; rotulo: string; className?: string }) {
  return (
    <dl aria-label={rotulo} className={cn('grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6', className)}>
      {itens.map(item => (
        <div key={item.rotulo} data-jazida-bloco className="min-w-0 rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
          <dt className="text-sm font-semibold text-slate-600">{item.rotulo}</dt>
          <dd className={cn('mt-0.5 text-2xl font-bold tabular-nums leading-tight', COR[item.tom ?? 'neutro'])}>
            {typeof item.valor === 'number' ? <CountUp value={item.valor} /> : item.valor}
          </dd>
          {item.detalhe && <dd className="text-sm text-slate-600">{item.detalhe}</dd>}
        </div>
      ))}
    </dl>
  );
}
