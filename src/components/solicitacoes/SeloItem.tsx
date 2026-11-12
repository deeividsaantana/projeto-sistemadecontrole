import type { SituacaoItem } from '../../utils/solicitacoes';

const TOM: Record<SituacaoItem, string> = {
  Aguardando: 'bg-slate-100 text-slate-700 ring-slate-200',
  Parcial: 'bg-amber-50 text-amber-900 ring-amber-200',
  Falta: 'bg-rose-50 text-rose-700 ring-rose-200',
  Chegou: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
};

/** Selo da conferência do item: aguardando, parcial, falta ou chegou. */
export function SeloItem({ situacao }: { situacao: SituacaoItem }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ring-inset ${TOM[situacao]}`}>
      {situacao}
    </span>
  );
}
