/**
 * Linha do tempo unificada dos fatos operacionais. Não existe coleção de
 * eventos: cada linha é lida do módulo de origem, então um registro corrigido
 * ou apagado lá some daqui sem reprocessamento nenhum.
 */
import { useMemo, useState } from 'react';
import { History } from 'lucide-react';
import type { Equipamento } from '../types';
import {
  agruparPorDia,
  montarTimeline,
  tiposDaTimeline,
  type FontesTimeline,
} from '../utils/timeline';
import { EmptyState, PageHeader, PeriodFilter, buildPeriod, type PeriodValue } from '../shared/ui';

interface TimelineTabProps {
  fontes: FontesTimeline;
  equipamentos: Equipamento[];
  onNavigate: (tab: string) => void;
}

const formatarData = (valor: string) => valor.split('-').reverse().join('/');

export default function TimelineTab({ fontes, equipamentos, onNavigate }: TimelineTabProps) {
  const [period, setPeriod] = useState<PeriodValue>(() => buildPeriod('semana'));
  const [equipamentoId, setEquipamentoId] = useState('');
  const [tipo, setTipo] = useState('');

  const todos = useMemo(
    () => montarTimeline(fontes, { inicio: period.from, fim: period.to, equipamentoId: equipamentoId || undefined }),
    [fontes, period.from, period.to, equipamentoId],
  );
  const tipos = useMemo(() => tiposDaTimeline(todos), [todos]);
  const eventos = useMemo(() => tipo ? todos.filter(item => item.tipo === tipo) : todos, [todos, tipo]);
  const dias = useMemo(() => agruparPorDia(eventos), [eventos]);

  return (
    <div id="timeline-tab" className="min-h-full w-full bg-[#f7f8f6] px-4 pb-12 pt-6 sm:px-7 lg:px-9">
      <PageHeader
        title="Timeline"
        description="Tudo que aconteceu no período, na ordem em que aconteceu, lido dos módulos de origem."
        actions={<PeriodFilter value={period} onChange={setPeriod} />}
      />

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs font-bold text-slate-600">
          Equipamento
          <select
            value={equipamentoId}
            onChange={event => setEquipamentoId(event.target.value)}
            className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500"
          >
            <option value="">Todos</option>
            {equipamentos.map(item => <option key={item.id} value={item.id}>{item.prefixo}</option>)}
          </select>
        </label>
        <label className="text-xs font-bold text-slate-600">
          Tipo de evento
          <select
            value={tipo}
            onChange={event => setTipo(event.target.value)}
            className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500"
          >
            <option value="">Todos</option>
            {tipos.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 sm:col-span-2">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Eventos no período</p>
          <strong className="mt-1 block text-2xl font-black tabular-nums text-slate-900">{eventos.length}</strong>
        </div>
      </div>

      <div className="mt-4">
        {dias.length === 0 ? (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <EmptyState icon={History} title="Nada aconteceu no período" description="Ajuste o período ou os filtros." />
          </div>
        ) : (
          <ol className="space-y-4">
            {dias.map(([dia, itens]) => (
              <li key={dia}>
                <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">{formatarData(dia)} · {itens.length} evento(s)</h2>
                <ul className="mt-2 space-y-1.5 border-l-2 border-slate-200 pl-3">
                  {itens.map(evento => (
                    <li key={evento.id}>
                      <button
                        type="button"
                        onClick={() => onNavigate(evento.tab)}
                        className="flex min-h-12 w-full items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left transition-colors hover:border-emerald-400 hover:bg-emerald-50/40"
                      >
                        <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                          {evento.tipo}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold text-slate-800">{evento.titulo}</span>
                          {evento.descricao && <span className="block truncate text-[11px] text-slate-500">{evento.descricao}</span>}
                        </span>
                        {evento.hora && <span className="shrink-0 font-mono text-[11px] text-slate-500">{evento.hora}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
