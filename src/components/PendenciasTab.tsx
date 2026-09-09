/**
 * Central de pendências. Nada aqui é salvo: cada linha é derivada dos próprios
 * registros e some sozinha quando a origem é resolvida. Por isso a tela sempre
 * leva para onde a pendência se resolve, em vez de virar uma segunda lista.
 */
import { useMemo, useState } from 'react';
import { ArrowUpRight, CheckCircle2, ChevronRight, ListChecks } from 'lucide-react';
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
  const [selectedId, setSelectedId] = useState('');
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
  const selecionada = pendencias.find(item => item.id === selectedId) || pendencias[0];

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
        // grid-cols-[minmax(0,1fr)] explícito: a trilha padrão é minmax(auto,1fr)
        // e o min-content da lista (rótulo com truncate) estourava 169 px no
        // celular.
        <div className="mt-4 grid grid-cols-[minmax(0,1fr)] items-start gap-3 xl:grid-cols-[minmax(0,1.05fr)_minmax(23rem,.95fr)]">
          <div className="space-y-3">
            {porCategoria.map(([categoria, itens]) => (
              <section key={categoria} className="overflow-hidden rounded-[3px] border border-slate-200 bg-white">
                <h2 className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">
                  <ListChecks className="h-4 w-4 text-emerald-600" /> {categoria}
                </h2>
                <ul className="divide-y divide-slate-100">
                  {itens.map(item => {
                    const active = selecionada?.id === item.id;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(item.id)}
                          aria-pressed={active}
                          className={`relative flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition-all ${active ? 'bg-emerald-50' : 'hover:bg-slate-50'}`}
                        >
                          <i className={`absolute inset-y-0 left-0 w-1 ${item.gravidade === 'alta' ? 'bg-orange-600' : item.gravidade === 'media' ? 'bg-amber-400' : 'bg-slate-300'}`} />
                          <strong className="grid size-10 shrink-0 place-items-center rounded-[2px] border border-slate-200 bg-white text-sm font-black tabular-nums text-slate-800">
                            {item.quantidade}
                          </strong>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-bold text-slate-800">{item.titulo}</span>
                            {item.detalhe && <span className="block truncate text-[11px] text-slate-500">{item.detalhe}</span>}
                          </span>
                          <Badge tone={TOM[item.gravidade]}>{ROTULO[item.gravidade]}</Badge>
                          <ChevronRight className={`h-4 w-4 shrink-0 transition-transform ${active ? 'translate-x-1 text-emerald-700' : 'text-slate-400'}`} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>

          {selecionada && (
            <aside key={selecionada.id} className="sticky top-4 overflow-hidden rounded-[3px] border border-slate-200 bg-white p-5 shadow-none xl:min-h-[25rem]">
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[.2em] text-emerald-700">Detalhe da pendência</p>
                  <p className="mt-2 text-xs text-slate-500">{selecionada.categoria}</p>
                </div>
                <Badge tone={TOM[selecionada.gravidade]}>{ROTULO[selecionada.gravidade]}</Badge>
              </div>
              <strong className="mt-6 block max-w-[18ch] text-3xl font-black leading-[.98] tracking-[-.04em] text-slate-950">{selecionada.titulo}</strong>
              <div className="mt-5 grid grid-cols-[auto_1fr] gap-x-5 gap-y-1 border-y border-slate-100 py-4">
                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Quantidade</span>
                <b className="text-right text-2xl tabular-nums text-slate-950">{selecionada.quantidade}</b>
                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Área</span>
                <b className="text-right text-sm text-slate-800">{selecionada.categoria}</b>
              </div>
              {selecionada.detalhe && <p className="mt-5 text-sm leading-relaxed text-slate-600">{selecionada.detalhe}</p>}
              <button type="button" onClick={() => onNavigate(selecionada.tab)} className="mt-8 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[3px] bg-emerald-700 px-5 text-sm font-bold text-white hover:bg-emerald-800">
                Abrir área responsável <ArrowUpRight className="h-4 w-4" />
              </button>
            </aside>
          )}
        </div>
      )}
    </div>
  );
}
