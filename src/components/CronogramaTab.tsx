/**
 * Cronograma (Gantt simples) montado sobre o que já existe: planos de produção e
 * frentes com data prevista. Não existe entidade "tarefa de cronograma" — ela
 * duplicaria o planejamento e as duas versões divergiriam na primeira semana.
 * O avanço da barra é o mesmo avanço físico calculado no planejamento.
 */
import { useMemo, useState } from 'react';
import { Activity, AlertTriangle, CalendarClock } from 'lucide-react';
import type { FrenteServico, PlanejamentoItem, RegistroProducao } from '../types';
import {
  barrasDoCronograma,
  janelaDoCronograma,
  posicaoDaBarra,
  posicaoDeHoje,
} from '../utils/cronograma';
import { Badge, EmptyState, PageHeader, StatCard, isoDay } from '../shared/ui';
import { formatarData } from '../utils/formato';

interface CronogramaTabProps {
  planos: PlanejamentoItem[];
  producao: RegistroProducao[];
  frentes: FrenteServico[];
}


export default function CronogramaTab({ planos, producao, frentes }: CronogramaTabProps) {
  const hoje = isoDay(new Date());
  const [filtro, setFiltro] = useState<'todas' | 'planos' | 'frentes'>('todas');

  const barras = useMemo(() => barrasDoCronograma(planos, producao, frentes, hoje)
    .filter(item => filtro === 'todas'
      || (filtro === 'planos' ? item.origem === 'Plano' : item.origem === 'Frente')),
  [planos, producao, frentes, hoje, filtro]);

  const janela = useMemo(() => janelaDoCronograma(barras, hoje), [barras, hoje]);
  const marcaHoje = posicaoDeHoje(janela, hoje);
  const atrasadas = barras.filter(item => item.atrasado).length;

  return (
    <div id="cronograma-tab" className="min-h-full w-full bg-[#f7f8f6] px-4 pb-12 pt-6 sm:px-7 lg:px-9">
      <PageHeader
        title="Cronograma"
        description="Planos de produção e frentes com data prevista, na mesma linha do tempo."
      />

      <section className="mt-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {[
          { label: 'Barras', valor: barras.length, tone: 'info' as const, icone: CalendarClock },
          { label: 'Atrasadas', valor: atrasadas, tone: 'danger' as const, icone: AlertTriangle },
          { label: 'Início', valor: formatarData(janela.inicio), tone: 'neutral' as const, icone: CalendarClock },
          { label: 'Fim', valor: formatarData(janela.fim), tone: 'neutral' as const, icone: CalendarClock },
        ].map(item => (
          <StatCard key={item.label} label={item.label} value={item.valor} tone={item.tone} icon={item.icone} />
        ))}
      </section>

      <div className="mt-4 flex gap-1 rounded-lg border border-slate-200 bg-white p-1">
        {([['todas', 'Tudo'], ['planos', 'Planos'], ['frentes', 'Frentes']] as const).map(([id, rotulo]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFiltro(id)}
            aria-pressed={filtro === id}
            className={`min-h-10 flex-1 rounded-md text-xs font-bold transition-colors ${filtro === id ? 'bg-emerald-700 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            {rotulo}
          </button>
        ))}
      </div>

      <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-white">
        {barras.length === 0 ? (
          <EmptyState icon={CalendarClock} title="Nada no cronograma" description="Crie planos de produção ou informe as datas previstas das frentes." />
        ) : (
          <div className="overflow-x-auto">
            <ul className="min-w-[720px] divide-y divide-slate-100">
              {barras.map(barra => {
                const posicao = posicaoDaBarra(barra, janela);
                return (
                  <li key={barra.id} className="grid grid-cols-[minmax(10rem,16rem)_1fr] items-center gap-3 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-800">{barra.titulo}</p>
                      <p className="truncate text-[11px] text-slate-500">
                        {formatarData(barra.inicio)} → {formatarData(barra.fim)}
                        {barra.subtitulo ? ` · ${barra.subtitulo}` : ''}
                      </p>
                    </div>
                    <div className="relative h-8 min-w-0 rounded-md bg-slate-50">
                      {marcaHoje !== undefined && (
                        <span className="absolute inset-y-0 w-px bg-sky-400" style={{ left: `${marcaHoje}%` }} aria-hidden />
                      )}
                      <div
                        className={`absolute inset-y-1 rounded ${barra.atrasado ? 'bg-rose-200' : 'bg-emerald-200'}`}
                        style={{ left: `${posicao.esquerda}%`, width: `${posicao.largura}%` }}
                        title={`${barra.titulo}: ${barra.progresso}%`}
                      >
                        <div
                          className={`h-full rounded ${barra.atrasado ? 'bg-rose-600' : 'bg-emerald-600'}`}
                          style={{ width: `${barra.progresso}%` }}
                        />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-4 rounded bg-emerald-600" /> avanço executado</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-4 rounded bg-rose-600" /> prazo vencido</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-px bg-sky-400" /> hoje</span>
        <Badge tone="neutral">Frentes usam a situação informada; planos usam o avanço físico real</Badge>
      </div>
    </div>
  );
}
