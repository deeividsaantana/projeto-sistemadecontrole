import { Building2, CalendarDays, Clock3, MapPin, Pencil, UserRound, Wrench } from 'lucide-react';
import type { FleetCurrentState } from '../../fleet/domain';
import { isBasculanteWithoutPlate } from '../../fleet/domain';
import { formatBrazilianDateTime } from '../../fleet/time';
import FleetStatusBadge from './FleetStatusBadge';
import { BOTAO_PRIMARIO } from '../cadastros/estilos';
import { Modal } from '../../shared/ui';

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

/**
 * Detalhes de um lançamento do dia. Usa o Modal padrão (A11 da auditoria de
 * 21/10/2026): o foco fica preso dentro, Esc e clique fora fecham e o corpo
 * da página para de rolar; no celular abre como folha inferior.
 */
export default function FleetDetailDrawer({ state, onClose, onEdit }: Props) {
  if (!state) return null;
  return (
    <Modal
      open
      size="lg"
      title={`Lançamento do dia: ${state.equipment.prefix}`}
      description={state.equipment.equipmentName}
      onClose={onClose}
      footer={<button type="button" onClick={() => onEdit(state)} className={`${BOTAO_PRIMARIO} min-h-12 w-full`}><Pencil className="size-4" aria-hidden="true"/>Editar lançamento</button>}
    >
        <div>
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4"><span className="text-sm font-semibold text-slate-500">Situação agora</span><FleetStatusBadge status={state.operationalStatus}/></div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="flex gap-3 rounded-xl bg-slate-50 p-3"><UserRound size={17} className="mt-0.5 shrink-0 text-[#176b4d]" aria-hidden="true"/><div><span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Motorista</span><strong className="mt-1 block text-sm text-slate-900">{state.driver?.employeeName || 'Sem motorista'}</strong><small className="text-slate-500">{state.driver?.employeeCode || 'Matrícula não informada'}</small></div></div>
              <div className="flex gap-3 rounded-xl bg-slate-50 p-3"><Building2 size={17} className="mt-0.5 shrink-0 text-[#176b4d]" aria-hidden="true"/><div><span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Empresa</span><strong className="mt-1 block text-sm text-slate-900">{state.equipment.companyName}</strong>{!isBasculanteWithoutPlate(state.equipment)&&<small className="font-mono text-slate-500">{state.equipment.plate || 'Placa não informada'}</small>}</div></div>
              <div className="flex gap-3 rounded-xl bg-slate-50 p-3"><Clock3 size={17} className="mt-0.5 shrink-0 text-[#176b4d]" aria-hidden="true"/><div><span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Horário</span><strong className="mt-1 block font-mono text-sm text-slate-900">{state.departureTime || state.maintenanceEntryTime || state.availableSince || '—'}</strong><small className="text-slate-500">Parado: {state.stoppedDurationLabel}</small></div></div>
              <div className="flex gap-3 rounded-xl bg-slate-50 p-3"><MapPin size={17} className="mt-0.5 shrink-0 text-[#176b4d]" aria-hidden="true"/><div><span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Local</span><strong className="mt-1 block text-sm text-slate-900">{state.location || 'Não informado'}</strong><small className="flex items-center gap-1 text-slate-500"><CalendarDays size={11}/>{new Date(`${state.date}T12:00:00`).toLocaleDateString('pt-BR')}</small></div></div>
            </div>
          </section>
          <section className="mt-5">
            <div className="flex items-center justify-between"><h3 className="text-xs font-bold uppercase tracking-[0.12em] text-slate-700">Movimentações</h3><span className="text-xs font-bold text-[#5b6870]">{state.events.length} evento(s)</span></div>
            <div className="mt-3 space-y-0">
              {[...state.events].reverse().map((event, index) => (
                <article key={event.id} className="relative flex gap-3 pb-5">
                  {index < state.events.length - 1 && <span className="absolute left-[11px] top-6 h-full w-px bg-slate-200"/>}
                  <span className="relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700"><Clock3 size={12}/></span>
                  <div className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2"><strong className="text-sm text-slate-900">{eventLabels[event.kind] || event.kind}</strong><time className="text-xs font-bold text-slate-500">{formatBrazilianDateTime(event.occurredAt)}</time></div>
                    <p className="mt-1 text-xs text-slate-600">{event.previousStatus ? `${event.previousStatus} → ` : ''}{event.nextStatus}</p>
                    {(event.reason || event.note) && <p className="mt-2 rounded bg-slate-50 p-2 text-xs leading-5 text-slate-600">{event.reason ? `${event.reason}. ` : ''}{event.note}</p>}
                  </div>
                </article>
              ))}
              {!state.events.length && <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Nenhuma movimentação histórica registrada.</div>}
            </div>
          </section>
          <section className="mt-4 rounded-2xl border border-rose-100 bg-rose-50 p-3">
            <div className="flex items-center gap-2 text-rose-800"><Wrench size={16}/><h3 className="text-xs font-bold uppercase tracking-[0.12em]">Manutenção</h3></div>
            <p className="mt-2 text-sm text-rose-900">{state.maintenanceReason || 'Nenhuma ocorrência de manutenção informada.'}</p>
            {state.maintenanceOrderId && <span className="mt-2 inline-block rounded-lg bg-white px-2 py-1 text-xs font-bold text-rose-700">OS vinculada: {state.maintenanceOrderId}</span>}
          </section>
          {state.reviewMessages.length > 0 && <section className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3"><h3 className="text-xs font-bold uppercase tracking-[0.12em] text-amber-800">O que conferir</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-900">{state.reviewMessages.map(message=><li key={message}>{message}</li>)}</ul></section>}
        </div>
    </Modal>
  );
}
