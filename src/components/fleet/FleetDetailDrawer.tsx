import React, { useEffect } from 'react';
import { Clock3, Pencil, Wrench, X } from 'lucide-react';
import type { FleetCurrentState } from '../../fleet/domain';
import { isBasculanteWithoutPlate } from '../../fleet/domain';
import { formatBrazilianDateTime } from '../../fleet/time';
import FleetStatusBadge from './FleetStatusBadge';

interface Props {
  state?: FleetCurrentState;
  onClose: () => void;
  onEdit: (state: FleetCurrentState) => void;
}

const eventLabels: Record<string, string> = {
  OPERATION_STARTED: 'Saiu para operação',
  MAINTENANCE_ENTERED: 'Entrou em manutenção',
  MAINTENANCE_RELEASED: 'Manutenção liberada',
  RETURNED_TO_OPERATION: 'Retornou à operação',
  AVAILABLE_SINCE: 'Ficou à disposição',
  DRIVER_ASSIGNED: 'Motorista atribuído',
  DRIVER_REMOVED: 'Motorista removido',
  STATUS_CHANGED: 'Status alterado',
  NOTE_ADDED: 'Observação adicionada',
  IMPORTED: 'Registro importado',
};

export default function FleetDetailDrawer({ state, onClose, onEdit }: Props) {
  useEffect(() => {
    if (!state) return undefined;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, state]);
  if (!state) return null;
  return (
    <div className="fixed inset-0 z-[90] bg-slate-950/35" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <aside role="dialog" aria-modal="true" aria-labelledby="fleet-detail-title" className="ml-auto flex h-full w-full max-w-xl flex-col overflow-hidden bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-slate-200 px-4 py-4">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-emerald-700">Histórico do equipamento</p>
            <h2 id="fleet-detail-title" className="mt-1 text-2xl font-black text-slate-950">{state.equipment.prefix}</h2>
            <p className="text-sm text-slate-500">{state.equipment.equipmentName}</p>
          </div>
          <button type="button" onClick={onClose} className="flex size-10 items-center justify-center rounded-md border border-slate-200 text-slate-600" aria-label="Fechar detalhes"><X size={18}/></button>
        </header>
        <div className="flex-1 overflow-y-auto p-4">
          <section className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
            <div className="col-span-2 flex items-center justify-between gap-3 border-b border-slate-200 pb-3"><span className="font-black text-slate-500">Status atual</span><FleetStatusBadge status={state.operationalStatus}/></div>
            <div><span className="block text-[9px] font-black uppercase text-slate-400">Motorista atual</span><strong className="mt-1 block text-slate-900">{state.driver?.employeeName || 'Sem motorista'}</strong></div>
            <div><span className="block text-[9px] font-black uppercase text-slate-400">Matrícula</span><strong className="mt-1 block text-slate-900">{state.driver?.employeeCode || 'Não informada'}</strong></div>
            <div><span className="block text-[9px] font-black uppercase text-slate-400">Empresa</span><strong className="mt-1 block text-slate-900">{state.equipment.companyName}</strong></div>
            {!isBasculanteWithoutPlate(state.equipment) && <div><span className="block text-[9px] font-black uppercase text-slate-400">Placa</span><strong className="mt-1 block text-slate-900">{state.equipment.plate || 'Não informada'}</strong></div>}
            <div><span className="block text-[9px] font-black uppercase text-slate-400">Saída</span><strong className="mt-1 block font-mono text-slate-900">{state.departureTime || '—'}</strong></div>
            <div><span className="block text-[9px] font-black uppercase text-slate-400">Tempo parado</span><strong className="mt-1 block font-mono text-slate-900">{state.stoppedDurationLabel}</strong></div>
            <div className="col-span-2"><span className="block text-[9px] font-black uppercase text-slate-400">Local</span><strong className="mt-1 block text-slate-900">{state.location || 'Não informado'}</strong></div>
          </section>
          <section className="mt-5">
            <div className="flex items-center justify-between"><h3 className="text-xs font-black uppercase tracking-wider text-slate-700">Movimentações</h3><span className="text-[10px] font-bold text-slate-400">{state.events.length} evento(s)</span></div>
            <div className="mt-3 space-y-0">
              {[...state.events].reverse().map((event, index) => (
                <article key={event.id} className="relative flex gap-3 pb-5">
                  {index < state.events.length - 1 && <span className="absolute left-[11px] top-6 h-full w-px bg-slate-200"/>}
                  <span className="relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700"><Clock3 size={12}/></span>
                  <div className="min-w-0 flex-1 rounded-md border border-slate-200 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2"><strong className="text-sm text-slate-900">{eventLabels[event.kind] || event.kind}</strong><time className="text-[10px] font-bold text-slate-500">{formatBrazilianDateTime(event.occurredAt)}</time></div>
                    <p className="mt-1 text-xs text-slate-600">{event.previousStatus ? `${event.previousStatus} → ` : ''}{event.nextStatus}</p>
                    {(event.reason || event.note) && <p className="mt-2 rounded bg-slate-50 p-2 text-xs leading-5 text-slate-600">{event.reason ? `${event.reason}. ` : ''}{event.note}</p>}
                  </div>
                </article>
              ))}
              {!state.events.length && <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Nenhuma movimentação histórica registrada.</div>}
            </div>
          </section>
          <section className="mt-4 rounded-lg border border-rose-100 bg-rose-50 p-3">
            <div className="flex items-center gap-2 text-rose-800"><Wrench size={16}/><h3 className="text-xs font-black uppercase">Manutenções</h3></div>
            <p className="mt-2 text-sm text-rose-900">{state.maintenanceReason || 'Nenhuma ocorrência de manutenção informada.'}</p>
            {state.maintenanceOrderId && <span className="mt-2 inline-block rounded bg-white px-2 py-1 text-xs font-black text-rose-700">OS vinculada: {state.maintenanceOrderId}</span>}
          </section>
          {state.reviewMessages.length > 0 && <section className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3"><h3 className="text-xs font-black uppercase text-amber-800">Pendências do registro</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-900">{state.reviewMessages.map(message=><li key={message}>{message}</li>)}</ul></section>}
        </div>
        <footer className="border-t border-slate-200 bg-white p-4"><button type="button" onClick={()=>onEdit(state)} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 text-sm font-black text-white"><Pencil size={16}/>Editar lançamento</button></footer>
      </aside>
    </div>
  );
}
