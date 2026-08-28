import React, { useState } from 'react';
import { MoreVertical } from 'lucide-react';
import type { FleetCurrentState } from '../../fleet/domain';
import FleetStatusBadge from './FleetStatusBadge';

interface Props {
  state: FleetCurrentState;
  selected: boolean;
  onSelect: (selected: boolean) => void;
  onEdit: () => void;
  onDetails: () => void;
  onDelete: () => void;
}

export default function FleetMobileCard({
  state,
  selected,
  onSelect,
  onEdit,
  onDetails,
  onDelete,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <article className={`rounded-lg border bg-white p-3 ${selected ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-slate-200'}`}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={event => onSelect(event.target.checked)}
          aria-label={`Selecionar ${state.equipment.prefix}`}
          className="mt-1 size-5 shrink-0 accent-emerald-600"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <strong className="block text-base font-black text-slate-950">
                {state.equipment.prefix}
              </strong>
              <span className="block truncate text-sm font-bold text-slate-700">
                {state.driver?.employeeName || 'Sem motorista'}
              </span>
              <span className="text-[11px] text-slate-500">
                Matrícula {state.driver?.employeeCode || 'não informada'}
              </span>
            </div>
            <FleetStatusBadge status={state.operationalStatus} compact />
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 rounded-md bg-slate-50 p-2 text-xs">
            <div>
              <dt className="text-[9px] font-black uppercase text-slate-400">Grupo</dt>
              <dd className="mt-0.5 truncate font-bold text-slate-800">{state.equipment.family || 'Não informado'}</dd>
            </div>
            <div>
              <dt className="text-[9px] font-black uppercase text-slate-400">Tipo</dt>
              <dd className="mt-0.5 truncate font-bold text-slate-800">{state.equipment.equipmentType || 'Não informado'}</dd>
            </div>
            <div>
              <dt className="text-[9px] font-black uppercase text-slate-400">Saída</dt>
              <dd className="mt-0.5 font-bold text-slate-800">{state.departureTime || '—'}</dd>
            </div>
            <div>
              <dt className="text-[9px] font-black uppercase text-slate-400">Tempo parado</dt>
              <dd className="mt-0.5 font-bold text-slate-800">{state.stoppedDurationLabel}</dd>
            </div>
            <div>
              <dt className="text-[9px] font-black uppercase text-slate-400">Local</dt>
              <dd className="mt-0.5 truncate font-bold text-slate-800">{state.location || 'Não informado'}</dd>
            </div>
            <div>
              <dt className="text-[9px] font-black uppercase text-slate-400">Liberação</dt>
              <dd className="mt-0.5 font-bold text-slate-800">{state.releaseTime || '—'}</dd>
            </div>
          </dl>
          {(state.note || state.maintenanceReason) && (
            <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-600">
              {state.maintenanceReason ? `${state.maintenanceReason}. ` : ''}
              {state.note}
            </p>
          )}
        </div>
        <div className="relative">
          <button
            type="button"
            aria-label={`Ações de ${state.equipment.prefix}`}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(open => !open)}
            className="flex size-10 items-center justify-center rounded-md border border-slate-200 text-slate-600"
          >
            <MoreVertical size={18} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 z-20 mt-1 w-40 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-xl">
              <button type="button" onClick={() => { setMenuOpen(false); onDetails(); }} className="block w-full px-3 py-2 text-left text-xs font-bold text-slate-700 hover:bg-slate-50">Ver detalhes</button>
              <button type="button" onClick={() => { setMenuOpen(false); onEdit(); }} className="block w-full px-3 py-2 text-left text-xs font-bold text-emerald-700 hover:bg-emerald-50">Editar</button>
              <button type="button" onClick={() => { setMenuOpen(false); onDelete(); }} className="block w-full px-3 py-2 text-left text-xs font-bold text-rose-700 hover:bg-rose-50">Excluir</button>
            </div>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onDetails}
        className="mt-3 min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-xs font-black text-slate-700"
      >
        Detalhes e histórico
      </button>
    </article>
  );
}
