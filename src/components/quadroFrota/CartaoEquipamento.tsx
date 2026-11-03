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
      className={`group relative flex h-full min-h-[10rem] w-full flex-col overflow-hidden rounded-2xl bg-white text-left transition duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-1 hover:shadow-[0_20px_40px_-10px_rgba(15,40,31,0.15)] active:scale-[0.97] shadow-[0_2px_8px_rgba(15,40,31,0.08)] ring-1 ring-slate-200 hover:ring-slate-300 ${FOCO}`}
    >
      <span className={`relative grid h-14 place-items-center overflow-hidden rounded-t-xl bg-gradient-to-b pr-9 ${tom.fundo}`}>
        <span className={`absolute inset-x-0 top-0 h-1.5 ${tom.faixa}`} aria-hidden="true" />
        {cartao.foto
          ? <img src={cartao.foto} alt="" className="h-full w-full object-cover" loading="lazy" />
          : <DesenhoMaquina tipo={cartao.silhueta} className="h-10 w-20 drop-shadow-[0_6px_6px_rgba(15,40,31,0.12)] transition duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:-translate-y-0.5 group-hover:scale-[1.08]" />}
      </span>
      <span className="flex flex-1 flex-col gap-1.5 p-3">
        <strong className="font-mono text-base font-extrabold leading-tight tracking-tight text-slate-900">{cartao.prefixo}</strong>
        <span className="line-clamp-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{cartao.modelo}</span>
        <span className="flex items-center gap-1.5 font-mono text-xs text-slate-600">
          <Gauge className="size-3.5 text-slate-400 flex-shrink-0" aria-hidden="true" />
          <span>{cartao.horimetro ? `${numero(cartao.horimetro)} h` : 'sem horímetro'}</span>
        </span>
        <span className="flex min-w-0 items-center gap-2 mt-auto">
          {cartao.operador ? (
            <>
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#176b4d] text-xs font-bold text-white shadow-sm" aria-hidden="true">{iniciais(cartao.operador)}</span>
              <span className="truncate text-xs font-semibold text-slate-700">{cartao.operador.split(' ')[0]}</span>
            </>
          ) : (
            <>
              <span className="grid size-6 shrink-0 place-items-center rounded-full border-2 border-[#f26a2e] text-xs font-bold text-[#c2410c] bg-orange-50" aria-hidden="true">?</span>
              <span className="truncate text-xs font-medium text-slate-500">sem operador</span>
            </>
          )}
        </span>
        <span className="mt-1.5">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold uppercase ring-1 ring-inset ${tom.etiqueta}`}>
            <span className={`size-2 rounded-full ${tom.ponto} ${cartao.grupo === 'operando' ? 'animate-pulse motion-reduce:animate-none' : ''}`} aria-hidden="true" />
            {ROTULO_GRUPO[cartao.grupo]}
          </span>
        </span>
      </span>
    </button>
  );
}
