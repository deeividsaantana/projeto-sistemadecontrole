import { Check } from 'lucide-react';
import { ETAPAS, NOME_DA_ETAPA, SITUACOES } from '../../../api/_shared/contratacao-regras.js';
import type { Etapa, PedidoContratacao, SituacaoContratacao } from '../../services/contratacaoApi';
import { dataHoraBr } from './formatos';

const TOM: Record<SituacaoContratacao, string> = {
  aguardando_rh: 'bg-amber-50 text-amber-800 ring-amber-200',
  aguardando_gerente: 'bg-amber-50 text-amber-800 ring-amber-200',
  aprovada: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  recusada: 'bg-rose-50 text-rose-800 ring-rose-200',
};

export function SeloSituacaoContratacao({ situacao }: { situacao: SituacaoContratacao }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ring-inset ${TOM[situacao]}`}>{SITUACOES[situacao]}</span>;
}

/** Linha de etapas, como rastreio: Solicitante → RH → Gerente → Aprovada. */
export function LinhaDeEtapas({ pedido, compacta = false }: { pedido: PedidoContratacao; compacta?: boolean }) {
  const passos = [...(ETAPAS as Etapa[]).map(etapa => ({
    chave: etapa,
    rotulo: NOME_DA_ETAPA[etapa],
    feito: pedido.signatures.find(item => item.stage === etapa),
  })), { chave: 'fim', rotulo: pedido.status === 'recusada' ? 'Recusada' : 'Aprovada', feito: undefined }];
  const fim = pedido.status === 'aprovada' || pedido.status === 'recusada';
  return (
    <ol className="flex items-start" aria-label="Etapas do pedido">
      {passos.map((passo, indice) => {
        const concluido = passo.chave === 'fim' ? fim : Boolean(passo.feito);
        const recusa = passo.chave === 'fim' && pedido.status === 'recusada';
        return (
          <li key={passo.chave} className="relative flex min-w-0 flex-1 flex-col items-center text-center">
            {indice > 0 && <span aria-hidden="true" className={`absolute right-1/2 top-3 h-0.5 w-full ${concluido ? 'bg-[#176b4d]' : 'bg-slate-200'}`} />}
            <span className={`relative z-10 grid size-6 place-items-center rounded-full text-xs font-black ${recusa ? 'bg-rose-700 text-white' : concluido ? 'bg-[#176b4d] text-white' : 'border-2 border-slate-300 bg-white text-slate-500'}`}>
              {concluido && !recusa ? <Check className="size-3.5" aria-hidden="true" /> : indice + 1}
            </span>
            <span className={`mt-1 text-xs font-bold ${concluido ? 'text-slate-900' : 'text-[#5b6870]'}`}>{passo.rotulo}</span>
            {!compacta && passo.feito && <span className="hidden text-xs text-[#5b6870] sm:block">{dataHoraBr(passo.feito.signed_at)}</span>}
          </li>
        );
      })}
    </ol>
  );
}
