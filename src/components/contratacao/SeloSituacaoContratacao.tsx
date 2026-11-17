import { Check } from 'lucide-react';
import { ETAPAS, SITUACOES, etapaPendente, nomeDaEtapa } from '../../../api/_shared/contratacao-regras.js';
import type { Etapa, PedidoContratacao, SituacaoContratacao, Titulares } from '../../services/contratacaoApi';
import { dataHoraBr } from './formatos';

const TOM: Record<SituacaoContratacao, string> = {
  etapa_1: 'bg-amber-50 text-amber-800 ring-amber-200',
  etapa_2: 'bg-amber-50 text-amber-800 ring-amber-200',
  etapa_3: 'bg-amber-50 text-amber-800 ring-amber-200',
  concluido: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  recusada: 'bg-rose-50 text-rose-800 ring-rose-200',
};

export function SeloSituacaoContratacao({ situacao }: { situacao: SituacaoContratacao }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ring-inset ${TOM[situacao] ?? TOM.etapa_1}`}>{SITUACOES[situacao] ?? situacao}</span>;
}

/**
 * Os 3 selos em ordem: 1. RH → 2. Bruno (Gerente) →
 * 3. Marcelo Suegama (Gerente). Verde = já assinou; âmbar = é a vez; cinza = ainda não chegou.
 */
export function SelosDasEtapas({ pedido, titulares }: { pedido: PedidoContratacao; titulares: Titulares }) {
  const vez = etapaPendente(pedido);
  return (
    <ol className="flex flex-wrap items-center gap-1" aria-label="Assinaturas do pedido">
      {(ETAPAS as Etapa[]).map((etapa, indice) => {
        const feito = pedido.signatures.some(item => item.stage === etapa);
        const daVez = vez === etapa;
        const recusou = pedido.status === 'recusada' && pedido.rejected_stage === etapa;
        const tom = recusou ? 'bg-rose-50 text-rose-800 ring-rose-200'
          : feito ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
            : daVez ? 'bg-amber-50 text-amber-900 ring-amber-300'
              : 'bg-slate-50 text-[#5b6870] ring-slate-200';
        return (
          <li key={etapa} className="flex items-center gap-1">
            {indice > 0 && <span aria-hidden="true" className="text-[#5b6870]">›</span>}
            <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-bold ring-1 ring-inset ${tom}`}>
              {feito && <Check className="size-3" aria-hidden="true" />}
              {indice + 1}. {nomeDaEtapa(etapa, titulares)}
              <span className="sr-only">{recusou ? ' (recusou)' : feito ? ' (assinou)' : daVez ? ' (é a vez)' : ' (aguardando)'}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Linha de etapas, como rastreio: RH → 2ª → 3ª → Concluído. */
export function LinhaDeEtapas({ pedido, titulares, compacta = false }: { pedido: PedidoContratacao; titulares: Titulares; compacta?: boolean }) {
  const passos = [...(ETAPAS as Etapa[]).map(etapa => ({
    chave: etapa,
    rotulo: nomeDaEtapa(etapa, titulares),
    feito: pedido.signatures.find(item => item.stage === etapa),
  })), { chave: 'fim', rotulo: pedido.status === 'recusada' ? 'Recusada' : 'Concluído', feito: undefined }];
  const fim = pedido.status === 'concluido' || pedido.status === 'recusada';
  return (
    <ol className="flex items-start" aria-label="Etapas do pedido">
      {passos.map((passo, indice) => {
        const concluido = passo.chave === 'fim' ? fim : Boolean(passo.feito);
        const recusa = passo.chave === 'fim' && pedido.status === 'recusada';
        return (
          <li key={passo.chave} className="relative flex min-w-0 flex-1 flex-col items-center text-center">
            {indice > 0 && <span aria-hidden="true" className={`absolute right-1/2 top-3 h-0.5 w-full ${concluido ? 'bg-[#176b4d]' : 'bg-slate-200'}`} />}
            <span className={`relative z-10 grid size-6 place-items-center rounded-full text-xs font-black ${recusa ? 'bg-rose-700 text-white' : concluido ? 'bg-[#176b4d] text-white' : 'border-2 border-slate-300 bg-white text-[#5b6870]'}`}>
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
