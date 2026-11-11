import type { SituacaoSolicitacao } from '../../utils/solicitacoes';

const TOM: Record<SituacaoSolicitacao, string> = {
  'Pendente Suprimentos': 'bg-amber-50 text-amber-900 ring-amber-200',
  'Em Cotação': 'bg-sky-50 text-sky-900 ring-sky-200',
  'Aguardando Aprovação': 'bg-orange-50 text-[#c2410c] ring-orange-200',
  Aprovado: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  'Em Trânsito': 'bg-indigo-50 text-indigo-900 ring-indigo-200',
  Entregue: 'bg-slate-100 text-slate-700 ring-slate-200',
  Cancelado: 'bg-slate-100 text-slate-600 ring-slate-200',
  'Em Atraso': 'bg-rose-700 text-white ring-rose-700',
};

/** Selo da situação, com a mesma cor em toda a aba. */
export function SeloSituacao({ situacao }: { situacao: SituacaoSolicitacao }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ring-inset ${TOM[situacao]}`}>
      {situacao}
    </span>
  );
}
