import type { ReactNode } from 'react';
import { FileDown } from 'lucide-react';
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO } from '../cadastros/estilos';
import { Modal } from '../../shared/ui';

export interface FleetImportPreviewStat {
  label: string;
  value: number;
  tone: string;
}

export interface FleetImportPreviewRow {
  key: string;
  rowNumber: number;
  dispositionLabel: string;
  prefixo: string;
  pessoa: string;
  data: string;
  messages: string;
}

interface Props {
  open: boolean;
  title: string;
  description: string;
  stats: FleetImportPreviewStat[];
  rows: FleetImportPreviewRow[];
  applyCount: number;
  canApply: boolean;
  onClose: () => void;
  onApply: () => void;
  /** Texto do botão de confirmar, quando a importação faz mais do que lançamentos. */
  applyLabel?: string;
  children?: ReactNode;
}

/**
 * Prévia de importação em lote, usada pela planilha do Controle de Frotas e
 * pelo apontamento do SGE: mesmo esqueleto visual (cartões de contagem + lista
 * linha a linha) para as duas fontes nunca divergirem sem querer.
 */
export default function FleetImportPreviewModal({ open, title, description, stats, rows, applyCount, canApply, onClose, onApply, applyLabel, children }: Props) {
  return (
    <Modal
      open={open}
      title={title}
      description={description}
      size="xl"
      onClose={onClose}
      footer={<>
        <button type="button" onClick={onClose} className={BOTAO_SECUNDARIO}>Cancelar</button>
        <button type="button" disabled={!canApply} onClick={onApply} className={BOTAO_PRIMARIO}>
          <FileDown className="size-4" aria-hidden="true" />
          {applyLabel || `Importar ${applyCount} lançamento(s)`}
        </button>
      </>}
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {stats.map(stat => (
          <div key={stat.label} className={`rounded-xl p-3 ${stat.tone}`}>
            <span className="text-[11px] font-bold uppercase">{stat.label}</span>
            <strong className="block text-2xl font-bold tabular-nums">{stat.value}</strong>
          </div>
        ))}
      </div>
      <ul className="mt-3 max-h-[45vh] divide-y divide-slate-100 overflow-auto rounded-xl border border-slate-200">
        {rows.slice(0, 500).map(row => (
          <li key={row.key} className="grid gap-1 px-3 py-2 text-sm sm:grid-cols-[4rem_7rem_minmax(0,1fr)_minmax(0,1.4fr)] sm:items-center">
            <span className="font-mono text-xs text-slate-500">linha {row.rowNumber}</span>
            <span className="font-bold text-slate-800">{row.dispositionLabel}</span>
            <span className="truncate"><span className="font-mono font-bold">{row.prefixo || '—'}</span> · {row.pessoa || 'Sem motorista'} · {row.data || '—'}</span>
            <span className="text-xs text-slate-600">{row.messages || 'Sem divergências.'}</span>
          </li>
        ))}
      </ul>
      {children}
    </Modal>
  );
}
