/**
 * Card de um pedido com a linha de etapas, como acompanhamento de entrega:
 * Pedido → Compras (Suprimentos) → Aprovação → A caminho → Entregue. Tocar no card
 * abre a ficha com a linha do tempo completa (o histórico oficial do pedido).
 */
import { Check } from 'lucide-react';
import { CARTAO } from '../cadastros/estilos';
import { PASSOS_RASTREIO, rastreioDe, situacaoDe, type Solicitacao } from '../../utils/solicitacoes';
import { SeloSituacao } from './SeloSituacao';

const COR_FRASE = {
  normal: 'text-slate-700',
  atraso: 'font-bold text-rose-700',
  falta: 'font-bold text-[#c2410c]',
  fechado: 'text-[#176b4d]',
  cancelado: 'text-slate-600',
} as const;

interface CartaoRastreioProps {
  sol: Solicitacao;
  hoje: string;
  ativo: boolean;
  onAbrir: () => void;
}

export function CartaoRastreio({ sol, hoje, ativo, onAbrir }: CartaoRastreioProps) {
  const rastreio = rastreioDe(sol, hoje);
  const parado = rastreio.tom === 'atraso' || rastreio.tom === 'falta';
  const cancelado = rastreio.tom === 'cancelado';
  const primeiro = sol.itens[0]?.descricao ?? '';
  return (
    <li data-testid="pedido-card">
      <button type="button" onClick={onAbrir} aria-current={ativo || undefined}
        className={`${CARTAO} grid h-full w-full gap-3 p-4 text-left transition-colors hover:border-[#176b4d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--renea-focus) ${ativo ? 'border-[#176b4d]' : ''} ${rastreio.tom === 'atraso' ? 'border-rose-300' : ''}`}>
        <span className="flex items-start justify-between gap-2">
          <span className="min-w-0">
            <strong className="block text-base font-black text-slate-900">{sol.numero}</strong>
            <span className="block truncate text-sm text-slate-600">
              {sol.solicitante}{sol.numeroSc ? ` · SC ${sol.numeroSc}` : ''}
            </span>
          </span>
          <span className="flex shrink-0 flex-col items-end gap-1">
            <SeloSituacao situacao={situacaoDe(sol, hoje)} />
            {sol.prioridade !== undefined && sol.etapa !== 'Entregue' && sol.etapa !== 'Cancelado' && (
              <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-bold text-[#c2410c] ring-1 ring-inset ring-orange-200">Prioridade {sol.prioridade}º</span>
            )}
          </span>
        </span>

        <span className="block text-sm text-slate-800">
          <span className="line-clamp-2">{primeiro}</span>
          {sol.itens.length > 1 && <span className="text-slate-600"> e mais {sol.itens.length - 1} item(ns)</span>}
        </span>

        {!cancelado && (
          <ol className="grid grid-cols-5" aria-label={`Etapa: ${PASSOS_RASTREIO[rastreio.passo]}`}>
            {PASSOS_RASTREIO.map((passo, indice) => {
              const feito = indice < rastreio.passo || rastreio.passo === 4;
              const agora = indice === rastreio.passo && rastreio.passo !== 4;
              const corBolinha = feito
                ? 'bg-[#176b4d] text-white'
                : agora
                  ? (parado ? 'bg-rose-600 text-white' : 'bg-[#c2410c] text-white')
                  : 'bg-slate-200 text-slate-500';
              return (
                <li key={passo} className="relative flex flex-col items-center gap-1" aria-current={agora ? 'step' : undefined}>
                  {indice > 0 && (
                    <span aria-hidden="true" className={`absolute right-1/2 top-3 h-0.5 w-full ${indice <= rastreio.passo ? 'bg-[#176b4d]' : 'bg-slate-200'}`} />
                  )}
                  <span aria-hidden="true" className={`relative z-10 grid size-6 place-items-center rounded-full text-xs font-black ${corBolinha}`}>
                    {feito ? <Check className="size-3.5" /> : indice + 1}
                  </span>
                  <span className={`break-words px-0.5 text-center text-xs leading-tight ${agora ? 'font-bold text-slate-900' : 'text-slate-600'}`}>{passo}</span>
                </li>
              );
            })}
          </ol>
        )}

        <span className={`block text-sm ${COR_FRASE[rastreio.tom]}`}>{rastreio.frase}</span>
        {rastreio.itensTotal > 1 && !cancelado && rastreio.tom !== 'fechado' && (
          <span className="block text-xs text-slate-600">{rastreio.itensChegaram} de {rastreio.itensTotal} itens já chegaram</span>
        )}
      </button>
    </li>
  );
}
