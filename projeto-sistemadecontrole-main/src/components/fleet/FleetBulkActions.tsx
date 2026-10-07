import { Download, PauseCircle, PlayCircle, Trash2, Wrench, X } from 'lucide-react';
import type { FleetOperationalStatus } from '../../fleet/domain';
import { FLEET_OPERATIONAL_STATUS } from '../../fleet/domain';
import { FLEET_STATUS_DEFINITIONS } from '../../fleet/status';
import { BOTAO_PERIGO_LEVE, BOTAO_SECUNDARIO, CAMPO, FOCO } from '../cadastros/estilos';

interface Props {
  count: number;
  onClear: () => void;
  onDelete: () => void;
  onExport: () => void;
  onChangeStatus: (status: FleetOperationalStatus) => void;
}

const RAPIDAS = [
  { status: FLEET_OPERATIONAL_STATUS.operating, rotulo: 'Operando', Icone: PlayCircle },
  { status: FLEET_OPERATIONAL_STATUS.maintenance, rotulo: 'Manutenção', Icone: Wrench },
  { status: FLEET_OPERATIONAL_STATUS.available, rotulo: 'À disposição', Icone: PauseCircle },
] as const;

/** Barra presa embaixo quando há lançamentos marcados: as situações mais usadas viram botão. */
export default function FleetBulkActions({
  count,
  onClear,
  onDelete,
  onExport,
  onChangeStatus,
}: Props) {
  if (!count) return null;
  const rapidas = new Set<string>(RAPIDAS.map(item => item.status));
  return (
    <aside aria-label="Ações nos lançamentos marcados" data-testid="frota-barra-selecao" className="fixed inset-x-3 bottom-3 z-30 mx-auto flex max-w-5xl flex-wrap items-center gap-2 rounded-2xl bg-white p-2.5 shadow-[0_18px_40px_-16px_rgba(15,40,31,0.45)] ring-1 ring-slate-200">
      <p className="mr-auto flex items-center gap-2 pl-1 text-sm font-bold text-slate-900">
        <span className="grid min-w-7 place-items-center rounded-full bg-[#176b4d] px-2 py-0.5 text-xs text-white">{count}</span>
        marcado(s)
      </p>
      {RAPIDAS.map(item => (
        <button key={item.status} type="button" onClick={() => onChangeStatus(item.status)} className={`${BOTAO_SECUNDARIO} px-3`}>
          <item.Icone className="size-4" aria-hidden="true" />
          {item.rotulo}
        </button>
      ))}
      <select
        onChange={event => { if (event.target.value) onChangeStatus(event.target.value as FleetOperationalStatus); event.target.value = ''; }}
        defaultValue=""
        aria-label="Outra situação"
        className={`${CAMPO} w-auto min-w-0 flex-[0_1_11rem]`}
      >
        <option value="" disabled>Outra situação…</option>
        {FLEET_STATUS_DEFINITIONS.filter(item => item.key !== 'unclassified' && !rapidas.has(item.value)).map(item => <option key={item.value}>{item.value}</option>)}
      </select>
      <button type="button" onClick={onExport} className={`${BOTAO_SECUNDARIO} px-3`}><Download className="size-4" aria-hidden="true" />Exportar</button>
      <button type="button" onClick={onDelete} className={`${BOTAO_PERIGO_LEVE} px-3`}><Trash2 className="size-4" aria-hidden="true" />Excluir</button>
      <button type="button" onClick={onClear} className={`grid size-11 place-items-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-emerald-400 hover:text-[#176b4d] ${FOCO}`} aria-label="Tirar seleção"><X className="size-4" aria-hidden="true" /></button>
    </aside>
  );
}
