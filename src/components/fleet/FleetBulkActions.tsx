import { Download, Trash2, X } from 'lucide-react';
import type { FleetOperationalStatus } from '../../fleet/domain';
import { FLEET_STATUS_DEFINITIONS } from '../../fleet/status';

interface Props {
  count: number;
  onClear: () => void;
  onDelete: () => void;
  onExport: () => void;
  onChangeStatus: (status: FleetOperationalStatus) => void;
}

export default function FleetBulkActions({
  count,
  onClear,
  onDelete,
  onExport,
  onChangeStatus,
}: Props) {
  if (!count) return null;
  return (
    <aside className="sticky bottom-3 z-30 flex flex-col gap-2 rounded-lg border border-slate-300 bg-slate-900 p-3 text-white shadow-xl sm:flex-row sm:items-center">
      <div className="flex items-center justify-between gap-3 sm:mr-auto">
        <strong className="text-sm">{count} registro(s) selecionado(s)</strong>
        <button type="button" onClick={onClear} className="flex size-8 items-center justify-center rounded-md border border-slate-600 sm:hidden" aria-label="Limpar seleção"><X size={14}/></button>
      </div>
      <select onChange={event => { if (event.target.value) onChangeStatus(event.target.value as FleetOperationalStatus); event.target.value = ''; }} defaultValue="" className="h-10 rounded-md border border-slate-600 bg-slate-800 px-3 text-xs font-black text-white"><option value="" disabled>Alterar status...</option>{FLEET_STATUS_DEFINITIONS.filter(item=>item.key!=='unclassified').map(item=><option key={item.value}>{item.value}</option>)}</select>
      <button type="button" onClick={onExport} className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-600 px-3 text-xs font-black hover:bg-slate-800"><Download size={14}/>Exportar seleção</button>
      <button type="button" onClick={onDelete} className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-rose-600 px-3 text-xs font-black hover:bg-rose-700"><Trash2 size={14}/>Excluir</button>
      <button type="button" onClick={onClear} className="hidden size-10 items-center justify-center rounded-md border border-slate-600 sm:flex" aria-label="Limpar seleção"><X size={14}/></button>
    </aside>
  );
}
