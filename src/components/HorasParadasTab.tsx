/** Horas paradas: onde a frota perdeu tempo no período, e por quê. */
import { useMemo, useState } from 'react';
import { AlertTriangle, TimerOff } from 'lucide-react';
import type { ControleEquipamentoDiario, Equipamento, OrdemServico } from '../types';
import { listarParadas, paradasSemHorario, somarPor, type Parada } from '../utils/horasParadas';
import { Card, EmptyState, PageHeader, PeriodFilter, TableBody, TableHead, TableShell, buildPeriod, type PeriodValue } from '../shared/ui';

interface HorasParadasTabProps {
  controlesEquipamentos: ControleEquipamentoDiario[];
  ordensServico: OrdemServico[];
  equipamentos: Equipamento[];
}

const horas = (valor: number) => `${valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h`;
const formatarData = (valor: string) => valor.split('-').reverse().join('/');

const Ranking = ({ titulo, dados }: { titulo: string; dados: ReturnType<typeof somarPor> }) => {
  const maior = dados[0]?.horas || 1;
  return (
    <Card title={titulo} flush>
      {dados.length === 0 ? (
        <EmptyState icon={TimerOff} title="Sem paradas no período" compact />
      ) : (
        <ul className="divide-y divide-slate-100">
          {dados.slice(0, 8).map(item => (
            <li key={item.chave} className="px-5 py-3">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="min-w-0 truncate font-bold text-slate-700">{item.chave}</span>
                <span className="shrink-0 font-mono text-slate-900">{horas(item.horas)}</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-emerald-600 transition-[width] duration-500" style={{ width: `${Math.max(3, (item.horas / maior) * 100)}%` }} />
              </div>
              <span className="mt-1 block text-[10px] text-slate-400">{item.ocorrencias} parada(s)</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
};

export default function HorasParadasTab({ controlesEquipamentos, ordensServico, equipamentos }: HorasParadasTabProps) {
  const [periodo, setPeriodo] = useState<PeriodValue>(() => buildPeriod('mes'));

  const { paradas, semHorario } = useMemo(() => {
    const noPeriodo = controlesEquipamentos.filter(item => item.data >= periodo.from && item.data <= periodo.to);
    return {
      paradas: listarParadas(noPeriodo, ordensServico, equipamentos).sort((a, b) => b.data.localeCompare(a.data) || b.horas - a.horas),
      semHorario: paradasSemHorario(noPeriodo),
    };
  }, [controlesEquipamentos, ordensServico, equipamentos, periodo.from, periodo.to]);

  const total = paradas.reduce((soma, parada) => soma + parada.horas, 0);
  const porDia = somarPor(paradas, parada => parada.data);
  const dias = porDia.length || 1;

  return (
    <div id="horas-paradas-tab" className="min-h-full w-full bg-[#f7f8f6] px-4 pb-12 pt-6 sm:px-7 lg:px-9">
      <PageHeader title="Horas Paradas" description="Indisponibilidade medida no controle diário, da entrada em manutenção até a liberação." />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <PeriodFilter value={periodo} onChange={setPeriodo} />
        <span className="text-xs font-medium text-slate-500">{formatarData(periodo.from)} a {formatarData(periodo.to)}</span>
      </div>

      <section className="mt-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {[
          { label: 'Total parado', valor: horas(total) },
          { label: 'Paradas registradas', valor: String(paradas.length) },
          { label: 'Média por dia com parada', valor: horas(total / dias) },
          { label: 'Em curso', valor: String(paradas.filter(parada => parada.emCurso).length) },
        ].map(item => (
          <div key={item.label} className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-[10px] font-bold uppercase leading-tight tracking-wide text-slate-500">{item.label}</p>
            <strong className="mt-1.5 block text-2xl font-black tabular-nums text-slate-900">{item.valor}</strong>
          </div>
        ))}
      </section>

      {semHorario > 0 && (
        <p className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          {semHorario} registro(s) parado(s) sem horário de entrada. Ficam fora da conta até a operação preencher — o sistema não estima hora.
        </p>
      )}

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Ranking titulo="Por equipamento" dados={somarPor(paradas, parada => parada.prefixo)} />
        <Ranking titulo="Por categoria" dados={somarPor(paradas, parada => parada.categoria)} />
        <Ranking titulo="Por dia" dados={porDia.map(item => ({ ...item, chave: formatarData(item.chave) }))} />
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white">
        {paradas.length === 0 ? (
          <EmptyState icon={TimerOff} title="Nenhuma parada no período" description="As paradas aparecem quando o controle diário registra entrada em manutenção." />
        ) : (
          <TableShell minWidth={900}>
            <TableHead>
              <tr>
                <th className="p-3">Data</th>
                <th className="p-3">Equipamento</th>
                <th className="p-3">Início</th>
                <th className="p-3">Fim</th>
                <th className="p-3">Duração</th>
                <th className="p-3">Motivo</th>
                <th className="p-3">Frente</th>
                <th className="p-3">OS</th>
              </tr>
            </TableHead>
            <TableBody>
              {paradas.map((parada: Parada) => (
                <tr key={parada.id} className="transition-colors hover:bg-slate-50">
                  <td className="p-3 text-slate-600">{formatarData(parada.data)}</td>
                  <td className="p-3 font-bold text-slate-800">{parada.prefixo}</td>
                  <td className="p-3 font-mono text-slate-600">{parada.inicio}</td>
                  <td className="p-3 font-mono text-slate-600">{parada.fim || <span className="text-amber-700">em curso</span>}</td>
                  <td className="p-3 font-mono font-bold text-slate-900">{horas(parada.horas)}</td>
                  <td className="max-w-[260px] p-3"><span className="block truncate text-slate-600" title={parada.motivo}>{parada.motivo}</span></td>
                  <td className="p-3 text-slate-600">{parada.frente || '—'}</td>
                  <td className="p-3 font-mono text-slate-600">{parada.ordemNumero || '—'}</td>
                </tr>
              ))}
            </TableBody>
          </TableShell>
        )}
      </div>
    </div>
  );
}
