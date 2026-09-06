/**
 * Central de pendências. Nada aqui é salvo: cada linha é derivada dos próprios
 * registros e some sozinha quando a origem é resolvida. Por isso a tela sempre
 * leva para onde a pendência se resolve, em vez de virar uma segunda lista.
 */
import { useMemo, useState } from 'react';
import { CheckCircle2, ChevronRight, ListChecks } from 'lucide-react';
import { listarPendencias, resumoPendencias, type ContextoPendencias, type GravidadePendencia } from '../utils/pendencias';
import { Badge, EmptyState, PageHeader, PeriodFilter, buildPeriod, type PeriodValue } from '../shared/ui';

interface PendenciasTabProps {
  dados: Omit<ContextoPendencias, 'hoje' | 'inicio' | 'fim'>;
  onNavigate: (tab: string) => void;
}

const TOM: Record<GravidadePendencia, 'danger' | 'warning' | 'neutral'> = {
  alta: 'danger',
  media: 'warning',
  baixa: 'neutral',
};

const ROTULO: Record<GravidadePendencia, string> = {
  alta: 'Alta',
  media: 'Média',
  baixa: 'Baixa',
};

export default function PendenciasTab({ dados, onNavigate }: PendenciasTabProps) {
  const [period, setPeriod] = useState<PeriodValue>(() => buildPeriod('mes'));
  const hoje = new Date().toISOString().slice(0, 10);

  const pendencias = useMemo(
    () => listarPendencias({ ...dados, hoje, inicio: period.from, fim: period.to }),
    [dados, hoje, period.from, period.to],
  );
  const resumo = resumoPendencias(pendencias);

  const porCategoria = useMemo(() => {
    const mapa = new Map<string, typeof pendencias>();
    pendencias.forEach(item => mapa.set(item.categoria, [...(mapa.get(item.categoria) || []), item]));
    return [...mapa.entries()];
  }, [pendencias]);

  return (
    <div id="pendencias-tab" className="min-h-full w-full bg-[#f7f8f6] px-4 pb-12 pt-6 sm:px-7 lg:px-9">
      <PageHeader
        title="Pendências"
        description="Tudo que está em aberto no sistema, derivado dos registros — cada linha leva para onde se resolve."
        actions={<PeriodFilter value={period} onChange={setPeriod} />}
      />

      <section className="mt-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {[
          { label: 'Tipos de pendência', valor: String(resumo.itens) },
          { label: 'Registros pendentes', valor: String(resumo.registros) },
          { label: 'Gravidade alta', valor: String(resumo.altas) },
          { label: 'Áreas afetadas', valor: String(resumo.categorias) },
        ].map(item => (
          <div key={item.label} className="min-w-0 rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-[10px] font-bold uppercase leading-tight tracking-wide text-slate-500">{item.label}</p>
            <strong className="mt-1.5 block text-2xl font-black tabular-nums text-slate-900">{item.valor}</strong>
          </div>
        ))}
      </section>

      {pendencias.length === 0 ? (
        <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white">
          <EmptyState icon={CheckCircle2} title="Nenhuma pendência no período" description="Todos os registros do período estão em dia." />
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {porCategoria.map(([categoria, itens]) => (
            <section key={categoria} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <h2 className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">
                <ListChecks className="h-4 w-4 text-emerald-600" /> {categoria}
              </h2>
              <ul className="divide-y divide-slate-100">
                {itens.map(item => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => onNavigate(item.tab)}
                      className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50"
                    >
                      <strong className="grid size-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-sm font-black tabular-nums text-slate-800">
                        {item.quantidade}
                      </strong>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-slate-800">{item.titulo}</span>
                        {item.detalhe && <span className="block truncate text-[11px] text-slate-500">{item.detalhe}</span>}
                      </span>
                      <Badge tone={TOM[item.gravidade]}>{ROTULO[item.gravidade]}</Badge>
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
