import { Check, Eye, Pencil, Trash2, X } from 'lucide-react';
import type { FleetCurrentState } from '../../fleet/domain';
import FleetStatusBadge from './FleetStatusBadge';
import { BOTAO_SECUNDARIO, FOCO } from '../cadastros/estilos';

interface Props {
  state: FleetCurrentState;
  selected: boolean;
  onSelect: (selected: boolean) => void;
  onEdit: () => void;
  onDetails: () => void;
  onDelete: () => void;
  canApprove?: boolean;
  onApprove?: (status: 'APROVADO' | 'REJEITADO') => void;
}

/** Lançamento no celular: tudo à vista e os botões com nome, sem menu escondido. */
export default function FleetMobileCard({
  state,
  selected,
  onSelect,
  onEdit,
  onDetails,
  onDelete,
  canApprove = false,
  onApprove,
}: Props) {
  const observacao = [state.maintenanceReason, state.note].filter(Boolean).join('. ');
  const fatos: Array<[string, string]> = [
    ['Saída', state.departureTime || '—'],
    ['Parado', state.stoppedDurationLabel],
    ['Local', state.location || 'Não informado'],
  ];
  return (
    <article className={`rounded-2xl border bg-white p-3 transition duration-200 ${selected ? 'border-[#176b4d] ring-2 ring-[#176b4d]/15' : 'border-slate-200'}`}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={event => onSelect(event.target.checked)}
          aria-label={`Selecionar ${state.equipment.prefix}`}
          className="mt-1 size-5 shrink-0 accent-[#176b4d]"
        />
        <button type="button" onClick={onDetails} className={`min-w-0 flex-1 rounded-lg text-left ${FOCO}`}>
          <span className="flex flex-wrap items-center justify-between gap-2">
            <strong className="font-mono text-base font-bold text-slate-950">{state.equipment.prefix}</strong>
            <FleetStatusBadge status={state.operationalStatus} compact />
          </span>
          <span className="block truncate text-xs uppercase text-slate-500">{state.equipment.equipmentType || state.equipment.family || 'Sem tipo'}</span>
          <span className="mt-1 block truncate text-sm font-semibold text-slate-800">
            {state.driver?.employeeName || 'Sem motorista'}
            {state.driver?.employeeCode && <span className="ml-1 font-mono text-xs font-normal text-slate-500">{state.driver.employeeCode}</span>}
          </span>
        </button>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-[#f7f8f6] p-2 text-xs">
        {fatos.map(([rotulo, valor]) => (
          <div key={rotulo} className="min-w-0">
            <dt className="text-[11px] font-semibold text-slate-500">{rotulo}</dt>
            <dd className="mt-0.5 truncate font-bold text-slate-800">{valor}</dd>
          </div>
        ))}
      </dl>
      {observacao && <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-600">{observacao}</p>}
      {canApprove && state.approvalStatus === 'PENDENTE' && onApprove && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => onApprove('APROVADO')} className={`${BOTAO_SECUNDARIO} text-[#176b4d]`}><Check className="size-4" aria-hidden="true" />Aprovar</button>
          <button type="button" onClick={() => onApprove('REJEITADO')} className={`${BOTAO_SECUNDARIO} text-rose-700`}><X className="size-4" aria-hidden="true" />Rejeitar</button>
        </div>
      )}
      <div className="mt-2 grid grid-cols-[1fr_1fr_auto] gap-2">
        <button type="button" onClick={onDetails} className={BOTAO_SECUNDARIO}><Eye className="size-4" aria-hidden="true" />Detalhes</button>
        <button type="button" onClick={onEdit} className={BOTAO_SECUNDARIO}><Pencil className="size-4" aria-hidden="true" />Editar</button>
        <button type="button" onClick={onDelete} aria-label={`Excluir ${state.equipment.prefix}`} className={`${BOTAO_SECUNDARIO} px-3 text-slate-500 hover:border-rose-300 hover:text-rose-700`}><Trash2 className="size-4" aria-hidden="true" /></button>
      </div>
    </article>
  );
}
