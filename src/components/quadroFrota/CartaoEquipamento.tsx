/**
 * Cartão de uma máquina no quadro: desenho ou foto num fundo da cor da
 * situação, prefixo grande, modelo, horímetro e operador. O cartão inteiro é
 * o botão que abre o detalhe.
 */
import { Gauge } from 'lucide-react';
import { ROTULO_GRUPO, type CartaoFrota, type GrupoStatus } from '../../modules/frota/quadroFrota';
import { DesenhoMaquina } from './DesenhoMaquina';
import { FOCO } from '../cadastros/estilos';

/** Cor de cada situação: faixa, fundo do desenho, etiqueta e bolinha. */
export const TOM: Record<GrupoStatus, { faixa: string; fundo: string; etiqueta: string; ponto: string }> = {
  operando: { faixa: 'bg-[#176b4d]', fundo: 'from-emerald-50 to-white', etiqueta: 'bg-emerald-50 text-emerald-800 ring-emerald-200', ponto: 'bg-emerald-500' },
  manutencao: { faixa: 'bg-rose-600', fundo: 'from-rose-50 to-white', etiqueta: 'bg-rose-50 text-rose-800 ring-rose-200', ponto: 'bg-rose-500' },
  parado: { faixa: 'bg-amber-400', fundo: 'from-amber-50 to-white', etiqueta: 'bg-amber-50 text-amber-800 ring-amber-200', ponto: 'bg-amber-400' },
  'sem-lancamento': { faixa: 'bg-slate-300', fundo: 'from-slate-100 to-white', etiqueta: 'bg-slate-100 text-slate-600 ring-slate-200', ponto: 'bg-slate-400' },
};

export const numero = (valor: number) => valor.toLocaleString('pt-BR');

const iniciais = (nome: string) => nome.split(/\s+/).filter(Boolean).slice(0, 2).map(parte => parte[0]).join('').toUpperCase();

export function CartaoEquipamento({ cartao, onAbrir }: { cartao: CartaoFrota; onAbrir: () => void }) {
  const tom = TOM[cartao.grupo];
  return (
    <button
      type="button"
      onClick={onAbrir}
      data-quadro-cartao
      data-testid={`quadro-cartao-${cartao.prefixo}`}
      aria-label={`${cartao.prefixo}, ${cartao.modelo}, ${ROTULO_GRUPO[cartao.grupo]}${cartao.operador ? `, operador ${cartao.operador}` : ', sem operador'}`}
      className={`group relative flex min-h-48 flex-col overflow-hidden rounded-2xl bg-white p-1.5 text-left shadow-[0_1px_2px_rgba(15,40,31,0.06)] ring-1 ring-slate-200 transition duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-1 hover:shadow-[0_18px_32px_-18px_rgba(15,40,31,0.35)] hover:ring-emerald-300 active:scale-[0.98] ${FOCO}`}
    >
      <span className={`relative grid h-[4.75rem] place-items-center overflow-hidden rounded-[0.9rem] bg-gradient-to-b ${tom.fundo}`}>
        <span className={`absolute inset-x-0 top-0 h-1 ${tom.faixa}`} aria-hidden="true" />
        {cartao.foto
          ? <img src={cartao.foto} alt="" className="h-full w-full object-cover" loading="lazy" />
          : <DesenhoMaquina tipo={cartao.silhueta} className="h-16 w-[6.5rem] drop-shadow-[0_6px_6px_rgba(15,40,31,0.12)] transition duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:-translate-y-0.5 group-hover:scale-[1.06]" />}
      </span>
      <span className="flex flex-1 flex-col px-1.5 pb-1 pt-2">
        <strong className="font-mono text-[15px] font-bold leading-tight tracking-tight text-slate-900">{cartao.prefixo}</strong>
        <span className="line-clamp-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{cartao.modelo}</span>
        <span className="mt-1.5 flex items-center gap-1 font-mono text-[10px] text-slate-500">
          <Gauge className="size-3 text-slate-400" aria-hidden="true" />
          {cartao.horimetro ? `${numero(cartao.horimetro)} h` : 'sem horímetro'}
        </span>
        <span className="mt-1.5 flex min-w-0 items-center gap-1.5">
          {cartao.operador ? (
            <>
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[#176b4d] text-[9px] font-bold text-white" aria-hidden="true">{iniciais(cartao.operador)}</span>
              <span className="truncate text-[11px] font-bold uppercase text-slate-700">{cartao.operador.split(' ')[0]}</span>
            </>
          ) : (
            <>
              <span className="grid size-5 shrink-0 place-items-center rounded-full border border-dashed border-[#f26a2e] text-[9px] font-bold text-[#f26a2e]" aria-hidden="true">?</span>
              <span className="truncate text-[11px] font-medium italic text-slate-400">sem operador</span>
            </>
          )}
        </span>
        <span className="mt-auto pt-2">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ring-1 ring-inset ${tom.etiqueta}`}>
            <span className={`size-1.5 rounded-full ${tom.ponto} ${cartao.grupo === 'operando' ? 'animate-pulse motion-reduce:animate-none' : ''}`} aria-hidden="true" />
            {ROTULO_GRUPO[cartao.grupo]}
          </span>
        </span>
      </span>
    </button>
  );
}
