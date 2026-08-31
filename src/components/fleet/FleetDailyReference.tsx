import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardCheck, Truck } from 'lucide-react';
import type { ControleEquipamentoDiario } from '../../types';
import {
  reconcileOperationalFleetDay,
  type OperationalFleetReferenceGroup,
  type OperationalFleetReferenceStatus,
} from '../../fleet/operationalFleetReference';

interface Props {
  records: ControleEquipamentoDiario[];
  date: string;
}

type VisibilityFilter = 'pending' | 'all' | 'informed';

const GROUPS: readonly OperationalFleetReferenceGroup[] = ['Basculantes', 'Apoio'];

const formatDate = (date: string): string => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  return new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR');
};

const statusTone = (item: OperationalFleetReferenceStatus): string => {
  if (!item.informed) return 'border-amber-200 bg-amber-50';
  if (item.operationalStatus === 'Em manutenção' || item.operationalStatus === 'Aguardando manutenção') return 'border-rose-200 bg-rose-50';
  return 'border-emerald-200 bg-emerald-50/70';
};

const statusTextTone = (item: OperationalFleetReferenceStatus): string => {
  if (!item.informed) return 'text-amber-700';
  if (item.operationalStatus === 'Em manutenção' || item.operationalStatus === 'Aguardando manutenção') return 'text-rose-700';
  return 'text-emerald-700';
};

const FleetChip = ({ item }: { item: OperationalFleetReferenceStatus }) => (
  <li className={`flex min-h-14 items-center justify-between gap-3 rounded-md border px-3 py-2 ${statusTone(item)}`}>
    <div className="min-w-0">
      <strong className="block text-sm text-slate-950">{item.prefix}</strong>
      <span className="block truncate text-[10px] font-bold uppercase tracking-wide text-slate-500">{item.equipmentType}</span>
    </div>
    <span className={`inline-flex shrink-0 items-center gap-1 text-right text-[10px] font-black uppercase ${statusTextTone(item)}`}>
      {item.informed ? <CheckCircle2 size={15}/> : <AlertTriangle size={15}/>}
      <span>{item.informed ? item.operationalStatus || 'Informado' : 'A confirmar'}{item.departureTime ? <small className="block text-[9px]">{item.departureTime}</small> : null}</span>
    </span>
  </li>
);

export default function FleetDailyReference({ records, date }: Props) {
  const [visibility, setVisibility] = useState<VisibilityFilter>('pending');
  const reconciliation = useMemo(
    () => reconcileOperationalFleetDay(records, date),
    [date, records],
  );
  const progress = reconciliation.total
    ? Math.round((reconciliation.informed / reconciliation.total) * 100)
    : 0;
  const visibleItems = visibility === 'all'
    ? reconciliation.items
    : reconciliation.items.filter(item => visibility === 'informed' ? item.informed : !item.informed);

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white" aria-labelledby="fleet-reference-title">
      <header className="grid gap-4 border-b border-slate-200 p-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-md bg-emerald-50 text-emerald-700"><ClipboardCheck size={20}/></span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">Conferência automática · {formatDate(date)}</p>
            <h2 id="fleet-reference-title" className="mt-1 text-lg font-black text-slate-950">Relação operacional do dia</h2>
            <p className="mt-1 text-xs text-slate-500">Base esperada: 32 basculantes e 7 equipamentos de apoio. Não informados entram automaticamente como “A confirmar”.</p>
          </div>
        </div>
        <div className="grid grid-cols-2 overflow-hidden rounded-md border border-slate-200 bg-slate-50 text-center sm:grid-cols-4">
          <div className="px-4 py-2"><span className="block text-[9px] font-black uppercase text-slate-500">Esperados</span><strong className="text-xl text-slate-950">{reconciliation.total}</strong></div>
          <div className="border-l border-slate-200 px-4 py-2"><span className="block text-[9px] font-black uppercase text-emerald-700">Em operação</span><strong className="text-xl text-emerald-700">{reconciliation.operating}</strong></div>
          <div className="border-l border-t border-slate-200 px-4 py-2 sm:border-t-0"><span className="block text-[9px] font-black uppercase text-rose-700">Manutenção</span><strong className="text-xl text-rose-700">{reconciliation.maintenance}</strong></div>
          <div className="border-l border-t border-slate-200 px-4 py-2 sm:border-t-0"><span className="block text-[9px] font-black uppercase text-amber-700">A confirmar</span><strong className="text-xl text-amber-700">{reconciliation.missing}</strong></div>
        </div>
      </header>

      <div className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center justify-between text-[10px] font-black uppercase tracking-wide text-slate-500"><span>Preenchimento diário</span><span>{progress}%</span></div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-600 transition-[width]" style={{ width: `${progress}%` }}/></div>
          </div>
          <div className="flex rounded-md border border-slate-200 bg-slate-50 p-1" role="group" aria-label="Filtrar relação operacional">
            {([
              ['pending', `A confirmar ${reconciliation.missing}`],
              ['all', `Todos ${reconciliation.total}`],
              ['informed', `Informados ${reconciliation.informed}`],
            ] as const).map(([id, label]) => (
              <button key={id} type="button" onClick={() => setVisibility(id)} className={`min-h-9 rounded px-3 text-[11px] font-black transition-colors ${visibility === id ? 'bg-white text-slate-950 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-800'}`}>{label}</button>
            ))}
          </div>
        </div>

        <p className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700"><strong>Fechamento da relação:</strong> {reconciliation.operating} em operação + {reconciliation.maintenance} em manutenção + {reconciliation.missing} a confirmar = {reconciliation.operating + reconciliation.maintenance + reconciliation.missing} de {reconciliation.total} equipamentos esperados. <span className="text-slate-500">{reconciliation.informed} já informados.</span></p>

        {reconciliation.missing === 0 && visibility === 'pending' ? (
          <div className="mt-4 flex items-center gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-emerald-800"><CheckCircle2 size={20}/><div><strong className="block text-sm">Relação completa</strong><span className="text-xs">Os 39 equipamentos foram informados nesta data.</span></div></div>
        ) : (
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            {GROUPS.map(group => {
              const groupItems = visibleItems.filter(item => item.group === group);
              const allGroupItems = reconciliation.items.filter(item => item.group === group);
              const informed = allGroupItems.filter(item => item.informed).length;
              if (!groupItems.length) return null;
              return (
                <article key={group} className="rounded-md border border-slate-200 bg-slate-50/50 p-3">
                  <header className="mb-3 flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Truck size={17} className="text-emerald-700"/><h3 className="text-sm font-black text-slate-950">{group}</h3></div><span className="text-[10px] font-black uppercase text-slate-500">{informed}/{allGroupItems.length} informados</span></header>
                  <ul className="grid gap-2 sm:grid-cols-2">{groupItems.map(item => <FleetChip key={item.prefix} item={item}/>)}</ul>
                </article>
              );
            })}
          </div>
        )}

        {(reconciliation.unexpectedPrefixes.length > 0 || reconciliation.duplicatePrefixes.length > 0) && (
          <div className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
            {reconciliation.unexpectedPrefixes.length > 0 && <p className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sky-800"><strong>Fora da relação-base:</strong> {reconciliation.unexpectedPrefixes.join(', ')}</p>}
            {reconciliation.duplicatePrefixes.length > 0 && <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-rose-800"><strong>Prefixos duplicados no dia:</strong> {reconciliation.duplicatePrefixes.join(', ')}</p>}
          </div>
        )}
      </div>
    </section>
  );
}
